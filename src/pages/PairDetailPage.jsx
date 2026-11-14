import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import MatchLine from '../components/MatchLine'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { georgianError } from '../lib/errors'
import { formatSigned, personName, toId, WIN_TYPES } from '../lib/format'
import { summarizePair } from '../lib/headtohead'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { unwrap } from '../lib/query'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { periodSearchFrom, usePeriod } from '../lib/usePeriod'

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

function orderedPair(a, b) {
  const x = toId(a)
  const y = toId(b)
  if (x == null || y == null || x === y) return null
  return x < y ? [x, y] : [y, x]
}

function samePair(row, a, b) {
  const x = toId(row.p1)
  const y = toId(row.p2)
  if (x == null || y == null) return false
  return (x === a && y === b) || (x === b && y === a)
}

function compareTo(usA, usB, themA, themB, search) {
  const us = orderedPair(usA, usB)
  const them = orderedPair(themA, themB)
  if (!us || !them) return null
  const params = new URLSearchParams()
  params.set('a', `${us[0]}-${us[1]}`)
  params.set('b', `${them[0]}-${them[1]}`)
  const period = new URLSearchParams(periodSearchFrom(search))
  for (const key of ['period', 'from', 'to']) {
    const value = period.get(key)
    if (value) params.set(key, value)
  }
  return { pathname: '/compare', search: `?${params.toString()}` }
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

export default function PairDetailPage() {
  const { p1, p2 } = useParams()
  const leftId = toId(p1)
  const rightId = toId(p2)
  const idsReady = leftId != null && rightId != null
  const location = useLocation()
  const period = usePeriod()
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (leftId == null || rightId == null) {
      setLoading(false)
      setError(null)
      setStats(null)
      setRows([])
      setPlayers([])
      return undefined
    }
    if (!supabase || period.customIncomplete) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    let results = supabase
      .from('v_pair_results')
      .select('*')
      .or(`and(p1.eq.${leftId},p2.eq.${rightId}),and(p1.eq.${rightId},p2.eq.${leftId})`)
      .limit(1000)
    if (period.fromIso) results = results.gte('played_at', period.fromIso)
    if (period.toIso) results = results.lt('played_at', period.toIso)

    Promise.all([
      fetchPlayers(),
      supabase.rpc('pair_stats', { p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      results.then(unwrap),
    ])
      .then(([people, pairs, matches]) => {
        if (!alive) return
        setPlayers(people)
        const found = pairs.find((row) => samePair(row, leftId, rightId)) || null
        setStats(found)
        setRows(
          matches
            .filter((row) => samePair(row, leftId, rightId))
            .map((row) => ({
              ...row,
              p1: toId(row.p1),
              p2: toId(row.p2),
              o1: toId(row.o1),
              o2: toId(row.o2),
            })),
        )
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
  }, [leftId, rightId, period.fromIso, period.toIso, period.customIncomplete, tick])

  const byId = useMemo(() => indexPlayers(players), [players])
  const nameOf = (who) => personName(byId, toId(who))
  const summary = useMemo(() => summarizePair(rows), [rows])
  const title = !idsReady
    ? 'წყვილი'
    : stats
      ? `${stats.p1_name} · ${stats.p2_name}`
      : `${nameOf(leftId)} · ${nameOf(rightId)}`

  return (
    <>
      <PageHead title={loading ? 'წყვილი' : title}>
        <Link className="back" to={{ pathname: '/pairs', search: location.search }}>წყვილებზე დაბრუნება</Link>
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
      {loading && isSupabaseConfigured && idsReady ? <Skeleton rows={5} /> : null}
      {error && idsReady ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {!idsReady ? <EmptyNote>წყვილი ვერ მოიძებნა.</EmptyNote> : null}
      {idsReady && !loading && !error && isSupabaseConfigured && !period.customIncomplete ? (
        <>
          <StatCards stats={stats} />

          <section className="block">
            <h2>მოწინააღმდეგეები</h2>
            {summary.head.length === 0 ? <EmptyNote>ამ პერიოდში პარტია არ არის.</EmptyNote> : (
              <div className="mini-table">
                {summary.head.map((row) => {
                  const opp = orderedPair(row.o1, row.o2)
                  const compareTarget = compareTo(leftId, rightId, row.o1, row.o2, location.search)
                  const names = `${nameOf(row.o1)} · ${nameOf(row.o2)}`
                  return (
                    <div key={row.key} className="mini-row">
                      {opp ? (
                        <Link className="mini-name" to={{ pathname: `/pairs/${opp[0]}/${opp[1]}`, search: location.search }}>
                          {names}
                        </Link>
                      ) : (
                        <span className="mini-name">{names}</span>
                      )}
                      <span>{row.pointsFor}:{row.pointsAgainst}</span>
                      <span>{row.games} თამაში</span>
                      <span className={row.net > 0 ? 'pos' : row.net < 0 ? 'neg' : ''}>{formatSigned(row.net)}</span>
                      {compareTarget ? <Link to={compareTarget}>შედარება</Link> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="block">
            <h2>პარტიები</h2>
            <div className="match-list">
              {summary.matches.map((match) => (
                <MatchLine
                  key={match.match_id ?? `${match.played_at}-${match.o1}-${match.o2}-${match.win_type}`}
                  match={{
                    played_at: match.played_at,
                    a1: match.won ? leftId : toId(match.o1),
                    a2: match.won ? rightId : toId(match.o2),
                    b1: match.won ? toId(match.o1) : leftId,
                    b2: match.won ? toId(match.o2) : rightId,
                    winner: 'A',
                    win_type: match.win_type,
                    is_void: false,
                  }}
                  nameOf={nameOf}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}
