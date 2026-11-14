import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MatchLine from '../components/MatchLine'
import PageHead from '../components/PageHead'
import { PairName } from '../components/PlayerName'
import StatsBoard from '../components/StatsBoard'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { asDayKey, dayBounds, formatTime, labelForDay } from '../lib/dates'
import { compareSearch, firstPlace, neighborDays } from '../lib/days'
import { georgianError } from '../lib/errors'
import { formatSigned, toId } from '../lib/format'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clockSpan(first, last) {
  if (!first && !last) return ''
  const start = first ? formatTime(first) : ''
  const end = last ? formatTime(last) : ''
  if (!start || !end || start === end) return start || end
  return `${start}–${end}`
}

export default function DayPage() {
  const { date = '' } = useParams()
  const bounds = useMemo(() => dayBounds(date), [date])
  const [people, setPeople] = useState([])
  const [rows, setRows] = useState([])
  const [matchups, setMatchups] = useState([])
  const [matches, setMatches] = useState([])
  const [dayKeys, setDayKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const [sort, setSort] = useState('place')
  const [dir, setDir] = useState('asc')

  useEffect(() => {
    if (!bounds || !supabase) {
      setLoading(false)
      setRows([])
      setMatchups([])
      setMatches([])
      setDayKeys([])
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      fetchPlayers(),
      supabase.rpc('pair_stats', { p_from: bounds.fromIso, p_to: bounds.toIso }),
      supabase.rpc('day_matchups', { p_day: bounds.key }),
      supabase
        .from('matches')
        .select('*')
        .gte('played_at', bounds.fromIso)
        .lt('played_at', bounds.toIso)
        .order('played_at', { ascending: true }),
      supabase.rpc('played_days', { p_from: null, p_to: null }),
    ]).then(([list, stats, meetings, games, played]) => {
      if (!alive) return
      if (stats.error) throw stats.error
      if (meetings.error) throw meetings.error
      if (games.error) throw games.error
      if (played.error) console.error(played.error)
      setPeople(list)
      setRows(stats.data ?? [])
      setMatchups(meetings.data ?? [])
      setMatches(games.data ?? [])
      setDayKeys(played.error ? [] : (played.data ?? []).map((row) => asDayKey(row.day)).filter(Boolean))
      setLoading(false)
    }).catch((err) => {
      console.error(err)
      if (!alive) return
      setError(georgianError(err))
      setRows([])
      setMatchups([])
      setMatches([])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [bounds, tick])

  const byId = useMemo(() => indexPlayers(people), [people])
  const champs = useMemo(() => firstPlace(rows), [rows])
  const neighbors = useMemo(() => neighborDays(dayKeys, bounds?.key || ''), [dayKeys, bounds])
  const label = bounds ? labelForDay(bounds.key) : 'დღე'
  const played = rows.length > 0 || matchups.length > 0 || matches.length > 0

  function onSort(key) {
    if (key === 'place') {
      setSort('place')
      setDir('asc')
      return
    }
    if (sort === key) {
      setDir((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSort(key)
    setDir(key === 'name' ? 'asc' : 'desc')
  }

  return (
    <>
      {bounds && (neighbors.older || neighbors.newer) ? (
        <div className="day-nav">
          {neighbors.older ? <Link to={`/days/${neighbors.older}`}>← წინა დღე</Link> : <span />}
          {neighbors.newer ? <Link to={`/days/${neighbors.newer}`}>შემდეგი დღე →</Link> : <span />}
        </div>
      ) : null}
      <PageHead title={label} />
      {!bounds ? <EmptyNote>ამ დღეს არ უთამაშიათ.</EmptyNote> : null}
      {bounds && !isSupabaseConfigured ? <EmptyNote>ბაზა ჯერ არ არის მიბმული.</EmptyNote> : null}
      {bounds && loading && isSupabaseConfigured ? <Skeleton rows={5} /> : null}
      {bounds && error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {bounds && !loading && !error && isSupabaseConfigured && !played ? (
        <EmptyNote>ამ დღეს არ უთამაშიათ.</EmptyNote>
      ) : null}
      {bounds && !loading && !error && champs.length > 0 ? (
        <section className="block">
          <h2>დღის გამარჯვებული</h2>
          {champs.length > 1 ? <p className="hint">გაიყვეს</p> : null}
          {champs.map((row) => (
            <article className="champ-card" key={`${row.p1}-${row.p2}`}>
              <PairName a={row.p1} b={row.p2} byId={byId} names={[row.p1_name, row.p2_name]} />
              <p className="score-num">{formatSigned(row.net_points)}</p>
              <p>მოგება {count(row.points_won)} · წაგება {count(row.points_lost)}</p>
              <p>კოქსი {count(row.koksi_made)} · სუხოი {count(row.sukhoi_made)}</p>
            </article>
          ))}
        </section>
      ) : null}
      {bounds && !loading && !error && rows.length > 0 ? (
        <section className="block">
          <h2>დღის ცხრილი</h2>
          <StatsBoard
            rows={rows}
            min={0}
            onMin={() => {}}
            sort={sort}
            dir={dir}
            onSort={onSort}
            showMin={false}
            trustPlace
            nameLabel="წყვილი"
            nameOf={(row) => `${row.p1_name || '—'} · ${row.p2_name || '—'}`}
            renderName={(row) => (
              <PairName a={row.p1} b={row.p2} byId={byId} names={[row.p1_name, row.p2_name]} compact />
            )}
            hrefOf={(row) => {
              const a = toId(row.p1)
              const b = toId(row.p2)
              if (a == null || b == null) return null
              return `/pairs/${a}/${b}`
            }}
            rowId={(row) => `${toId(row.p1)}-${toId(row.p2)}`}
            empty="ამ დღეს წყვილები არ არის."
            noun="წყვილები"
          />
        </section>
      ) : null}
      {bounds && !loading && !error && matchups.length > 0 ? (
        <section className="block">
          <h2>დაპირისპირებები</h2>
          <div className="matchup-list">
            {matchups.map((row, index) => {
              const search = compareSearch(row, bounds.key)
              const aPoints = count(row.a_points)
              const bPoints = count(row.b_points)
              const body = (
                <>
                  <span className={aPoints > bPoints ? 'side lead' : 'side'}>
                    <PairName a={row.a1} b={row.a2} byId={byId} compact />
                  </span>
                  <span className="tally">
                    <span className={aPoints > bPoints ? 'num lead' : 'num'}>{aPoints}</span>
                    <span className="sep">:</span>
                    <span className={bPoints > aPoints ? 'num lead' : 'num'}>{bPoints}</span>
                  </span>
                  <span className={bPoints > aPoints ? 'side right lead' : 'side right'}>
                    <PairName a={row.b1} b={row.b2} byId={byId} compact />
                  </span>
                  <span className="meta">
                    {`${count(row.games)} პარტია · კოქსი ${count(row.a_koksi)} : ${count(row.b_koksi)} · სუხოი ${count(row.a_sukhoi)} : ${count(row.b_sukhoi)}`}
                  </span>
                  <span className="meta time">{clockSpan(row.first_played, row.last_played)}</span>
                </>
              )
              const key = `${row.a1}-${row.a2}-${row.b1}-${row.b2}-${index}`
              if (!search) return <div key={key} className="matchup">{body}</div>
              return (
                <Link key={key} className="matchup" to={{ pathname: '/compare', search }}>
                  {body}
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}
      {bounds && !loading && !error && matches.length > 0 ? (
        <section className="block">
          <h2>პარტიები</h2>
          <div className="match-list">
            {matches.map((match) => <MatchLine key={match.id} match={match} byId={byId} />)}
          </div>
        </section>
      ) : null}
    </>
  )
}
