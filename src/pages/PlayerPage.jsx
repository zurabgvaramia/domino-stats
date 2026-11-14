import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { formatDateTime } from '../lib/dates'
import { georgianError } from '../lib/errors'
import { diffCount, formatPct, formatSigned, personName, WIN_LABEL } from '../lib/format'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { unwrap } from '../lib/query'
import { analyzeResults, pickOpponents, pickPartners } from '../lib/streaks'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

const EMPTY_STATS = {
  games: 0,
  wins: 0,
  losses: 0,
  net_points: 0,
  points_won: 0,
  points_lost: 0,
  koksi_made: 0,
  koksi_taken: 0,
  sukhoi_made: 0,
  sukhoi_taken: 0,
}

function RelationTable({ title, rows, search }) {
  const sorted = [...rows].sort((a, b) => (Number(b.games) || 0) - (Number(a.games) || 0) || a.name.localeCompare(b.name, 'ka'))
  return (
    <section className="block">
      <h2>{title}</h2>
      {sorted.length === 0 ? <EmptyNote>ჯერ არ არის.</EmptyNote> : (
        <div className="mini-table">
          {sorted.map((row) => (
            <Link key={row.id} className="mini-row" to={{ pathname: `/player/${row.id}`, search }}>
              <span className="mini-name">{row.name}</span>
              <span>{row.games} თამაში</span>
              <span>{row.wins}:{row.losses}</span>
              <span>{formatPct(row)}</span>
              <span className={Number(row.net_points) > 0 ? 'pos' : Number(row.net_points) < 0 ? 'neg' : ''}>{formatSigned(row.net_points)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function Pick({ label, row, search, detail }) {
  return (
    <article className="pick">
      <span>{label}</span>
      {row ? (
        <>
          <Link to={{ pathname: `/player/${row.id}`, search }}>{row.name}</Link>
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
    if (!supabase || period.customIncomplete) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    setMissing(false)
    let resultsQuery = supabase
      .from('v_player_results')
      .select('*')
      .eq('player_id', id)
      .order('played_at', { ascending: true })
      .limit(2000)
    if (period.fromIso) resultsQuery = resultsQuery.gte('played_at', period.fromIso)
    if (period.toIso) resultsQuery = resultsQuery.lt('played_at', period.toIso)

    Promise.all([
      fetchPlayers(),
      supabase.rpc('player_stats', { p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      supabase.rpc('partner_stats', { p_player: id, p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      supabase.rpc('opponent_stats', { p_player: id, p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      resultsQuery.then(unwrap),
    ])
      .then(([people, statsRows, partnerRows, opponentRows, resultRows]) => {
        if (!alive) return
        const found = people.find((item) => item.id === id) || null
        const stat = statsRows.find((row) => row.player_id === id) || null
        if (!found && !stat) {
          setMissing(true)
          setPlayer(null)
        } else {
          setPlayer(found || { id, name: stat.name, nickname: null })
          setStats({ ...EMPTY_STATS, ...stat })
        }
        setById(indexPlayers(people))
        setPartners(partnerRows)
        setOpponents(opponentRows)
        setResults(resultRows)
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
  }, [id, period.fromIso, period.toIso, period.customIncomplete, tick])

  const analysis = useMemo(() => analyzeResults(results), [results])
  const partnerPicks = useMemo(() => pickPartners(partners), [partners])
  const opponentPicks = useMemo(() => pickOpponents(opponents), [opponents])
  const nameOf = (playerId) => personName(byId, playerId)
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
      {loading && isSupabaseConfigured ? <Skeleton rows={6} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {missing && !loading && !error ? <EmptyNote>მოთამაშე ვერ მოიძებნა.</EmptyNote> : null}
      {!loading && !error && !missing && isSupabaseConfigured && !period.customIncomplete ? (
        <>
          {player?.nickname ? <p className="kicker">{player.nickname}</p> : null}
          <div className="stat-cards">
            <article className="stat-card"><span className="stat-label">თამაში</span><strong>{stats.games}</strong></article>
            <article className="stat-card"><span className="stat-label">მოგება</span><strong>{formatPct(stats)}</strong></article>
            <article className="stat-card span">
              <span className="stat-label">ქულები</span>
              <strong className={Number(stats.net_points) > 0 ? 'pos' : Number(stats.net_points) < 0 ? 'neg' : ''}>{formatSigned(stats.net_points)}</strong>
              <small>მოიგო {stats.points_won} · დათმო {stats.points_lost}</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">კოქსი</span>
              <strong>{formatSigned(diffCount(stats, 'koksi_made', 'koksi_taken'))}</strong>
              <small>{stats.koksi_made} / {stats.koksi_taken}</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">სუხოი</span>
              <strong>{formatSigned(diffCount(stats, 'sukhoi_made', 'sukhoi_taken'))}</strong>
              <small>{stats.sukhoi_made} / {stats.sukhoi_taken}</small>
            </article>
          </div>

          <section className="block">
            <h2>ფორმა</h2>
            {analysis.last.length === 0 ? <EmptyNote>ჯერ პარტია არ არის.</EmptyNote> : (
              <>
                <p className="hint">ძველი → ახალი</p>
                <div className="form-row" aria-label="ბოლო 10 პარტია">
                  {analysis.last.map((row) => (
                    <span
                      key={row.match_id || row.played_at}
                      className={row.won ? 'dot win' : 'dot loss'}
                      title={`${row.won ? 'მოგება' : 'წაგება'} · ${WIN_LABEL[row.win_type] || ''}`}
                    >
                      {row.win_type === 'koksi' ? 'კ' : row.win_type === 'sukhoi' ? 'ს' : ''}
                    </span>
                  ))}
                </div>
                <div className="recent-list">
                  {[...analysis.last].reverse().map((row) => (
                    <p key={`list-${row.match_id || row.played_at}`}>
                      <b className={row.won ? 'pos' : 'neg'}>{row.won ? 'მოგება' : 'წაგება'}</b>
                      {' · '}{formatDateTime(row.played_at)}
                      {' · '}{nameOf(row.partner_id)}
                      {' წინააღმდეგ '}{nameOf(row.opp1)} · {nameOf(row.opp2)}
                      {row.win_type && row.win_type !== 'regular' ? ` · ${WIN_LABEL[row.win_type]}` : ''}
                    </p>
                  ))}
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
                detail={(row) => `${formatPct(row)} · ${row.games} თამაში · ${formatSigned(row.net_points)}`}
              />
              <Pick
                label="ყველაზე ცუდი პარტნიორი"
                row={partnerPicks.worst}
                search={location.search}
                detail={(row) => `${formatPct(row)} · ${row.games} თამაში · ${formatSigned(row.net_points)}`}
              />
            </div>
            {!partnerPicks.best ? <p className="hint">შეფასებას სჭირდება მინიმუმ 3 ერთად თამაში.</p> : null}
          </section>

          <section className="block">
            <h2>მოწინააღმდეგეები</h2>
            <div className="picks">
              <Pick
                label="ვის უგებს ყველაზე ხშირად"
                row={opponentPicks.beaten}
                search={location.search}
                detail={(row) => `${row.wins} მოგება ${row.games} თამაშიდან`}
              />
              <Pick
                label="ვისთან აგებს"
                row={opponentPicks.lostTo}
                search={location.search}
                detail={(row) => `${row.losses} წაგება ${row.games} თამაშიდან`}
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
