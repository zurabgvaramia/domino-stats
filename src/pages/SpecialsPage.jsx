import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MatchLine from '../components/MatchLine'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { PairName, PlayerName } from '../components/PlayerName'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { georgianError } from '../lib/errors'
import { WIN_LABEL } from '../lib/format'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { unwrap } from '../lib/query'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

const KINDS = [
  { made: 'oini_made', taken: 'oini_taken', label: WIN_LABEL.regular },
  { made: 'sukhoi_made', taken: 'sukhoi_taken', label: WIN_LABEL.sukhoi },
  { made: 'koksi_made', taken: 'koksi_taken', label: WIN_LABEL.koksi },
]

function topRows(rows, key, nameOf) {
  return [...rows]
    .filter((row) => Number(row[key]) > 0)
    .sort((a, b) => Number(b[key]) - Number(a[key]) || nameOf(a).localeCompare(nameOf(b), 'ka'))
    .slice(0, 5)
    .map((row) => ({
      key: `${key}-${row.player_id || row.p1}-${row.p2 || ''}`,
      row,
      count: Number(row[key]),
    }))
}

function leaderBlocks(rows, nameOf, pair) {
  const scope = pair ? 'pair' : 'player'
  return KINDS.flatMap((kind) => ([
    {
      id: `${scope}-${kind.made}`,
      title: pair ? `წყვილები — ${kind.label} გააკეთა` : `${kind.label} — გააკეთა`,
      rows: topRows(rows, kind.made, nameOf),
    },
    {
      id: `${scope}-${kind.taken}`,
      title: pair ? `წყვილები — ${kind.label} მიიღო` : `${kind.label} — მიიღო`,
      rows: topRows(rows, kind.taken, nameOf),
    },
  ]))
}

function LeaderBlock({ title, rows, hrefOf, renderName }) {
  return (
    <section className="block">
      <h2>{title}</h2>
      {rows.length === 0 ? <EmptyNote>ჯერ არ არის.</EmptyNote> : (
        <ol className="leaders">
          {rows.map((item, index) => (
            <li key={item.key}>
              <Link to={hrefOf(item.row)}>
                <span className="leader-who">
                  <span>{index + 1}.</span>
                  {renderName(item.row)}
                </span>
                <strong>{item.count}</strong>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function RecentList({ title, matches, byId }) {
  return (
    <section className="block">
      <h2>{title}</h2>
      {matches.length === 0 ? <EmptyNote>ჯერ არ არის.</EmptyNote> : (
        <div className="match-list">
          {matches.map((match) => <MatchLine key={match.id} match={match} byId={byId} />)}
        </div>
      )}
    </section>
  )
}

async function recentMatches(type, fromIso, toIso) {
  let query = supabase
    .from('matches')
    .select('*')
    .eq('is_void', false)
    .eq('win_type', type)
    .order('played_at', { ascending: false })
    .limit(10)
  if (fromIso) query = query.gte('played_at', fromIso)
  if (toIso) query = query.lt('played_at', toIso)
  return query.then(unwrap)
}

export default function SpecialsPage() {
  const period = usePeriod()
  const location = useLocation()
  const [players, setPlayers] = useState([])
  const [pairs, setPairs] = useState([])
  const [people, setPeople] = useState([])
  const [koksi, setKoksi] = useState([])
  const [sukhoi, setSukhoi] = useState([])
  const [oini, setOini] = useState([])
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
    Promise.all([
      fetchPlayers(),
      supabase.rpc('player_stats', { p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      supabase.rpc('pair_stats', { p_from: period.fromIso, p_to: period.toIso }).then(unwrap),
      recentMatches('koksi', period.fromIso, period.toIso),
      recentMatches('sukhoi', period.fromIso, period.toIso),
      recentMatches('regular', period.fromIso, period.toIso),
    ])
      .then(([peopleRows, playerRows, pairRows, koksiRows, sukhoiRows, oiniRows]) => {
        if (!alive) return
        setPeople(peopleRows)
        setPlayers(playerRows)
        setPairs(pairRows)
        setKoksi(koksiRows)
        setSukhoi(sukhoiRows)
        setOini(oiniRows)
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
  }, [period.fromIso, period.toIso, period.customIncomplete, tick])

  const byId = useMemo(() => indexPlayers(people), [people])
  const playerName = (row) => row.name || '—'
  const pairName = (row) => `${row.p1_name || '—'} · ${row.p2_name || '—'}`
  const search = location.search
  const playerHref = (row) => ({ pathname: `/player/${row.player_id}`, search })
  const pairHref = (row) => ({ pathname: `/pairs/${row.p1}/${row.p2}`, search })

  return (
    <>
      <PageHead title={`${WIN_LABEL.regular}, ${WIN_LABEL.sukhoi} და ${WIN_LABEL.koksi}`}>
        <Link className="back" to="/more">მეტზე დაბრუნება</Link>
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
      {!loading && !error && isSupabaseConfigured && !period.customIncomplete ? (
        <>
          {leaderBlocks(players, playerName, false).map((block) => (
            <LeaderBlock
              key={block.id}
              title={block.title}
              rows={block.rows}
              hrefOf={playerHref}
              renderName={(row) => (
                <PlayerName id={row.player_id} byId={byId} player={{ name: row.name, nickname: null }} compact />
              )}
            />
          ))}
          {leaderBlocks(pairs, pairName, true).map((block) => (
            <LeaderBlock
              key={block.id}
              title={block.title}
              rows={block.rows}
              hrefOf={pairHref}
              renderName={(row) => (
                <PairName a={row.p1} b={row.p2} byId={byId} names={[row.p1_name, row.p2_name]} compact />
              )}
            />
          ))}
          <RecentList title={`ბოლო 10 ${WIN_LABEL.koksi}`} matches={koksi} byId={byId} />
          <RecentList title={`ბოლო 10 ${WIN_LABEL.sukhoi}`} matches={sukhoi} byId={byId} />
          <RecentList title={`ბოლო 10 ${WIN_LABEL.regular}`} matches={oini} byId={byId} />
        </>
      ) : null}
    </>
  )
}
