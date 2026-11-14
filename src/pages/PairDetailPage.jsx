import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import MatchLine from '../components/MatchLine'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { georgianError } from '../lib/errors'
import { diffCount, formatPct, formatSigned, personName } from '../lib/format'
import { summarizePair } from '../lib/headtohead'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { unwrap } from '../lib/query'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

export default function PairDetailPage() {
  const { p1, p2 } = useParams()
  const location = useLocation()
  const period = usePeriod()
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
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
      .or(`and(p1.eq.${p1},p2.eq.${p2}),and(p1.eq.${p2},p2.eq.${p1})`)
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
        const found = pairs.find(
          (row) => (row.p1 === p1 && row.p2 === p2) || (row.p1 === p2 && row.p2 === p1),
        )
        setStats(found || null)
        setRows(matches)
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
  }, [p1, p2, period.fromIso, period.toIso, period.customIncomplete, tick])

  const byId = useMemo(() => indexPlayers(players), [players])
  const nameOf = (id) => personName(byId, id)
  const summary = useMemo(() => summarizePair(rows), [rows])
  const title = !isSupabaseConfigured
    ? 'წყვილი'
    : stats
      ? `${stats.p1_name} · ${stats.p2_name}`
      : `${nameOf(p1)} · ${nameOf(p2)}`

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
      {loading && isSupabaseConfigured ? <Skeleton rows={5} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {!loading && !error && isSupabaseConfigured && !period.customIncomplete ? (
        <>
          <div className="stat-cards">
            <article className="stat-card"><span className="stat-label">თამაში</span><strong>{stats?.games ?? summary.matches.length}</strong></article>
            <article className="stat-card"><span className="stat-label">მოგება</span><strong>{stats ? formatPct(stats) : '—'}</strong></article>
            <article className="stat-card span"><span className="stat-label">ქულები</span><strong className={Number(stats?.net_points) > 0 ? 'pos' : Number(stats?.net_points) < 0 ? 'neg' : ''}>{formatSigned(stats?.net_points ?? 0)}</strong></article>
            <article className="stat-card"><span className="stat-label">კოქსი</span><strong>{formatSigned(diffCount(stats || {}, 'koksi_made', 'koksi_taken'))}</strong><small>{stats?.koksi_made ?? 0} / {stats?.koksi_taken ?? 0}</small></article>
            <article className="stat-card"><span className="stat-label">სუხოი</span><strong>{formatSigned(diffCount(stats || {}, 'sukhoi_made', 'sukhoi_taken'))}</strong><small>{stats?.sukhoi_made ?? 0} / {stats?.sukhoi_taken ?? 0}</small></article>
          </div>

          <section className="block">
            <h2>მოწინააღმდეგეები</h2>
            {summary.head.length === 0 ? <EmptyNote>ამ პერიოდში პარტია არ არის.</EmptyNote> : (
              <div className="mini-table">
                {summary.head.map((row) => (
                  <Link key={row.key} className="mini-row" to={{ pathname: `/pairs/${row.o1}/${row.o2}`, search: location.search }}>
                    <span className="mini-name">{nameOf(row.o1)} · {nameOf(row.o2)}</span>
                    <span>{row.wins}:{row.losses}</span>
                    <span>{row.games} თამაში</span>
                    <span className={row.net > 0 ? 'pos' : row.net < 0 ? 'neg' : ''}>{formatSigned(row.net)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="block">
            <h2>პარტიები</h2>
            <div className="match-list">
              {summary.matches.map((match) => (
                <MatchLine
                  key={`${match.played_at}-${match.o1}-${match.o2}-${match.win_type}`}
                  match={{
                    played_at: match.played_at,
                    a1: match.won ? p1 : match.o1,
                    a2: match.won ? p2 : match.o2,
                    b1: match.won ? match.o1 : p1,
                    b2: match.won ? match.o2 : p2,
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
