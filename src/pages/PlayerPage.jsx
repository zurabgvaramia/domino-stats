import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { formatDateTime } from '../lib/dates'
import { georgianError } from '../lib/errors'
import { formatSigned, personName, toId, WIN_LABEL, WIN_TYPES } from '../lib/format'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { unwrap } from '../lib/query'
import { analyzeResults, pickOpponents, pickPartners } from '../lib/streaks'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

const EMPTY_STATS = {
  games: 0,
  net_points: 0,
  points_won: 0,
  points_lost: 0,
  oini_made: 0,
  oini_taken: 0,
  sukhoi_made: 0,
  sukhoi_taken: 0,
  koksi_made: 0,
  koksi_taken: 0,
}

const TYPE_FIELD = {
  regular: 'oini',
  sukhoi: 'sukhoi',
  koksi: 'koksi',
}

function numericRow(row, idKey) {
  const id = toId(row?.[idKey] ?? row?.id)
  if (id == null) return { ...row, id: null }
  return { ...row, id }
}

function StatCards({ stats }) {
  const row = { ...EMPTY_STATS, ...stats }
  const net = Number(row.net_points)
  const netClass = net > 0 ? 'pos' : net < 0 ? 'neg' : ''
  const place = row.place == null || row.place === '' ? '—' : row.place
  return (
    <div className="stat-cards">
      <article className="stat-card">
        <span className="stat-label">ადგილი</span>
        <strong>{place}</strong>
      </article>
      <article className="stat-card">
        <span className="stat-label">ქულა</span>
        <strong className={netClass}>{formatSigned(row.net_points)}</strong>
      </article>
      <article className="stat-card">
        <span className="stat-label">თამაში</span>
        <strong>{row.games}</strong>
      </article>
      <article className="stat-card">
        <span className="stat-label">მოგება (ქულა)</span>
        <strong>{row.points_won}</strong>
      </article>
      <article className="stat-card">
        <span className="stat-label">წაგება (ქულა)</span>
        <strong>{row.points_lost}</strong>
      </article>
      {WIN_TYPES.map((type) => {
        const field = TYPE_FIELD[type.id]
        return (
          <article key={type.id} className="stat-card">
            <span className="stat-label">{type.label}</span>
            <strong>{row[`${field}_made`]}</strong>
            <small>მიიღო: {row[`${field}_taken`]}</small>
          </article>
        )
      })}
    </div>
  )
}

function RelationTable({ title, rows, search }) {
  const sorted = [...rows].sort((a, b) => (Number(b.games) || 0) - (Number(a.games) || 0) || a.name.localeCompare(b.name, 'ka'))
  return (
    <section className="block">
      <h2>{title}</h2>
      {sorted.length === 0 ? <EmptyNote>ჯერ არ არის.</EmptyNote> : (
        <div className="mini-table">
          {sorted.map((row, index) => {
            const personId = toId(row.id)
            const body = (
              <>
                <span className="mini-name">{row.name}</span>
                <span>{row.games} თამაში</span>
                <span>{row.points_won}:{row.points_lost}</span>
                <span className={Number(row.net_points) > 0 ? 'pos' : Number(row.net_points) < 0 ? 'neg' : ''}>{formatSigned(row.net_points)}</span>
              </>
            )
            if (personId == null) return <div key={`${row.name}-${index}`} className="mini-row">{body}</div>
            return (
              <Link key={personId} className="mini-row" to={{ pathname: `/player/${personId}`, search }}>
                {body}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Pick({ label, row, search, detail }) {
  const personId = toId(row?.id)
  return (
    <article className="pick">
      <span>{label}</span>
      {row ? (
        <>
          {personId == null ? <strong>{row.name}</strong> : (
            <Link to={{ pathname: `/player/${personId}`, search }}>{row.name}</Link>
          )}
          <small>{detail(row)}</small>
        </>
      ) : (
        <strong>ჯერ არ არის</strong>
      )}
    </article>
  )
}

export default function PlayerPage() {
  const { id } = useParams()
  const playerId = toId(id)
  const location = useLocation()
  const period = usePeriod()
  const [player, setPlayer] = useState(null)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [partners, setPartners] = useState([])
  const [opponents, setOpponents] = useState([])
  const [results, setResults] = useState([])
  const [byId, setById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (playerId == null) {
      setLoading(false)
      setError(null)
      setMissing(true)
      setPlayer(null)
      setStats({ ...EMPTY_STATS })
      setPartners([])
      setOpponents([])
      setResults([])
      return undefined
    }
    if (!supabase || period.customIncomplete) {
      setLoading(false)
      setMissing(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    setMissing(false)
    let resultsQuery = supabase
      .from('v_player_results')
      .select('*')
      .eq('player_id', playerId)
      .order('played_at', { ascending: true })
      .limit(2000)
    if (period.fromIso) resultsQuery = resultsQuery.gte('played_at', period.fromIso)
    if (period.toIso) resultsQuery = resultsQuery.lt('played_at', period.toIso)

    Promise.all([
      fetchPlayers(),
      supabase.rpc('player_stats', { p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      supabase.rpc('partner_stats', { p_player: playerId, p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      supabase.rpc('opponent_stats', { p_player: playerId, p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      resultsQuery.then(unwrap),
    ])
      .then(([people, statsRows, partnerRows, opponentRows, resultRows]) => {
        if (!alive) return
        const found = people.find((item) => toId(item.id) === playerId) || null
        const stat = statsRows.find((row) => toId(row.player_id) === playerId) || null
        if (!found && !stat) {
          setMissing(true)
          setPlayer(null)
          setStats({ ...EMPTY_STATS })
        } else {
          setPlayer(found || { id: playerId, name: stat.name, nickname: null })
          setStats({ ...EMPTY_STATS, ...stat })
        }
        setById(indexPlayers(people))
        setPartners(partnerRows.map((row) => numericRow(row, 'partner_id')))
        setOpponents(opponentRows.map((row) => numericRow(row, 'opponent_id')))
        setResults(resultRows.filter((row) => toId(row.player_id) === playerId))
      })
      .catch((err) => {
        console.error(err)
        if (alive) setError(georgianError(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [playerId, period.fromIso, period.toIso, period.customIncomplete, tick])

  const analysis = useMemo(() => analyzeResults(results), [results])
  const partnerPicks = useMemo(() => pickPartners(partners), [partners])
  const opponentPicks = useMemo(() => pickOpponents(opponents), [opponents])
  const nameOf = (who) => personName(byId, toId(who))
  const currentLabel = analysis.sorted.length === 0
    ? 'ჯერ არ არის'
    : `${analysis.current} ${analysis.currentWin ? 'მოგება' : 'წაგება'}`

  return (
    <>
      <PageHead title={player?.name || 'მოთამაშე'}>
        <Link className="back" to={{ pathname: '/table', search: location.search }}>ცხრილზე დაბრუნება</Link>
      </PageHead>
      <PeriodPicker
        period={period.period}
        from={period.from}
        to={period.to}
        onPeriod={period.setPeriod}
        onDate={period.setCustomDate}
      />
      {!isSupabaseConfigured ? <EmptyNote>ბაზა ჯერ არ არის მიბმული.</EmptyNote> : null}
      {period.customIncomplete ? <EmptyNote>აირჩიე თარიღიდან და თარიღამდე.</EmptyNote> : null}
      {loading && isSupabaseConfigured && playerId != null ? <Skeleton rows={6} /> : null}
      {error && playerId != null ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {playerId == null || (missing && !loading && !error) ? <EmptyNote>მოთამაშე ვერ მოიძებნა.</EmptyNote> : null}
      {!loading && !error && !missing && playerId != null && isSupabaseConfigured && !period.customIncomplete ? (
        <>
          {player?.nickname ? <p className="kicker">{player.nickname}</p> : null}
          <StatCards stats={stats} />

          <section className="block">
            <h2>ფორმა</h2>
            {analysis.last.length === 0 ? <EmptyNote>ჯერ პარტია არ არის.</EmptyNote> : (
              <>
                <p className="hint">ძველი → ახალი</p>
                <div className="form-row" aria-label="ბოლო 10 პარტია">
                  {analysis.last.map((row) => {
                    const typeLabel = WIN_LABEL[row.win_type] || ''
                    const mark = row.win_type && row.win_type !== 'regular' ? typeLabel.slice(0, 1) : ''
                    return (
                      <span
                        key={row.match_id || row.played_at}
                        className={row.won ? 'dot win' : 'dot loss'}
                        title={`${row.won ? 'მოგება' : 'წაგება'}${typeLabel ? ` · ${typeLabel}` : ''}`}
                      >
                        {mark}
                      </span>
                    )
                  })}
                </div>
                <div className="recent-list">
                  {[...analysis.last].reverse().map((row) => {
                    const typeLabel = WIN_LABEL[row.win_type] || ''
                    return (
                      <p key={`list-${row.match_id || row.played_at}`}>
                        <b className={row.won ? 'pos' : 'neg'}>{row.won ? 'მოგება' : 'წაგება'}</b>
                        {' · '}{formatDateTime(row.played_at)}
                        {' · '}{nameOf(row.partner_id)}
                        {' წინააღმდეგ '}{nameOf(row.opp1)} · {nameOf(row.opp2)}
                        {typeLabel && row.win_type !== 'regular' ? ` · ${typeLabel}` : ''}
                      </p>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          <section className="block">
            <h2>სერიები</h2>
            <div className="series">
              <div><span>ახლანდელი</span><strong>{currentLabel}</strong></div>
              <div><span>მოგების სერია</span><strong>{analysis.longestWin}</strong></div>
              <div><span>წაგების სერია</span><strong>{analysis.longestLoss}</strong></div>
            </div>
          </section>

          <section className="block">
            <h2>პარტნიორები</h2>
            <div className="picks">
              <Pick
                label="საუკეთესო პარტნიორი"
                row={partnerPicks.best}
                search={location.search}
                detail={(row) => `${formatSigned(row.net_points)} ქულა · ${row.games} თამაში`}
              />
              <Pick
                label="ყველაზე ცუდი პარტნიორი"
                row={partnerPicks.worst}
                search={location.search}
                detail={(row) => `${formatSigned(row.net_points)} ქულა · ${row.games} თამაში`}
              />
            </div>
            {!partnerPicks.best ? <p className="hint">შეფასებას სჭირდება მინიმუმ 3 ერთად თამაში.</p> : null}
          </section>

          <section className="block">
            <h2>მოწინააღმდეგეები</h2>
            <div className="picks">
              <Pick
                label="ვისთან აგროვებს ყველაზე მეტ ქულას"
                row={opponentPicks.beaten}
                search={location.search}
                detail={(row) => `${row.points_won} ქულა · ${row.games} თამაში`}
              />
              <Pick
                label="ვისთან კარგავს ყველაზე მეტ ქულას"
                row={opponentPicks.lostTo}
                search={location.search}
                detail={(row) => `${row.points_lost} ქულა · ${row.games} თამაში`}
              />
            </div>
          </section>

          <RelationTable title="პარტნიორების მიხედვით" rows={partners} search={location.search} />
          <RelationTable title="მოწინააღმდეგეების მიხედვით" rows={opponents} search={location.search} />
        </>
      ) : null}
    </>
  )
}
