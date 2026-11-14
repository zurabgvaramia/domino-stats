import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MatchLine from '../components/MatchLine'
import { PairName, PlayerName } from '../components/PlayerName'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { formatDayLabel } from '../lib/dates'
import { georgianError } from '../lib/errors'
import { formatSigned, isWon, toId } from '../lib/format'
import { fetchPlayers, indexPlayers, isActive } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

function parsePair(value) {
  const parts = String(value || '').split('-')
  if (parts.length !== 2) return [null, null]
  const x = toId(parts[0])
  const y = toId(parts[1])
  if (x == null || y == null || x === y) return [null, null]
  return x < y ? [x, y] : [y, x]
}

function pairParam(slots) {
  const x = toId(slots?.[0])
  const y = toId(slots?.[1])
  if (x == null || y == null || x === y) return ''
  return x < y ? `${x}-${y}` : `${y}-${x}`
}

function orderedPair(slots) {
  const value = pairParam(slots)
  if (!value) return null
  const [x, y] = value.split('-').map((part) => toId(part))
  return [x, y]
}

function hasId(slots, id) {
  const target = toId(id)
  if (target == null) return false
  return slots.some((slot) => toId(slot) === target)
}

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pairKey(x, y) {
  const a = toId(x)
  const b = toId(y)
  if (a == null || b == null) return ''
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function balanceLabel(netValue) {
  const net = Number(netValue)
  if (!Number.isFinite(net) || net === 0) return 'თანაბარი'
  if (net > 0) return `წყვილი 1 ${formatSigned(net)}`
  return `წყვილი 2 ${formatSigned(Math.abs(net))}`
}

function mark(side, left, right) {
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return ''
  if (side === 'a') return a > b ? 'pos' : ''
  return b > a ? 'pos' : ''
}

function meetingSpan(row) {
  const bits = []
  if (row?.first_played) bits.push(`პირველი ${formatDayLabel(row.first_played)}`)
  if (row?.last_played) bits.push(`ბოლო ${formatDayLabel(row.last_played)}`)
  return bits.join(' · ')
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null
  if (data && typeof data === 'object') return data
  return null
}

function pairIdsFromKey(key) {
  const [aPart = '', bPart = ''] = String(key || '').split('|')
  const [pA1, pA2] = aPart.split('-').map((item) => toId(item))
  const [pB1, pB2] = bPart.split('-').map((item) => toId(item))
  if ([pA1, pA2, pB1, pB2].some((id) => id == null)) return null
  return [pA1, pA2, pB1, pB2]
}

function keepMeetings(rows, pair1, pair2) {
  const byId = new Map()
  for (const row of rows || []) {
    const left = pairKey(row.p1, row.p2)
    const right = pairKey(row.o1, row.o2)
    const direct = left === pair1 && right === pair2
    const swapped = left === pair2 && right === pair1
    if (!direct && !swapped) continue
    const stamp = [left, right].sort().join('~')
    const id = row.match_id ?? `${row.played_at}|${stamp}`
    const prev = byId.get(id)
    if (!prev || (direct && pairKey(prev.p1, prev.p2) !== pair1)) byId.set(id, row)
  }
  return [...byId.values()].sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
}

function lineForMatch(row) {
  const won = isWon(row.won)
  const winners = won ? [row.p1, row.p2] : [row.o1, row.o2]
  const losers = won ? [row.o1, row.o2] : [row.p1, row.p2]
  return {
    played_at: row.played_at,
    a1: winners[0],
    a2: winners[1],
    b1: losers[0],
    b2: losers[1],
    winner: 'A',
    win_type: row.win_type,
    is_void: false,
    note: row.note || null,
  }
}

function TeamBlock({ title, side, slots, players, otherIds, byId, onToggle, onClear }) {
  return (
    <section className={`team team-${side}`}>
      <h2>{title}</h2>
      <div className="slots">
        {slots.map((id, index) => (
          <button
            key={`${side}-${index}`}
            type="button"
            className={id ? 'slot' : 'slot empty'}
            onClick={() => id && onClear(index)}
          >
            {id ? <PlayerName id={id} byId={byId} compact /> : 'ცარიელი'}
          </button>
        ))}
      </div>
      <div className="chips">
        {players.map((player) => {
          const selected = hasId(slots, player.id)
          const blocked = hasId(otherIds, player.id)
          return (
            <button
              key={player.id}
              type="button"
              className={selected ? 'chip on' : 'chip'}
              aria-pressed={selected}
              disabled={blocked && !selected}
              onClick={() => onToggle(player.id)}
            >
              <PlayerName player={player} compact />
            </button>
          )
        })}
      </div>
    </section>
  )
}

const STAT_ROWS = [
  ['ქულები', 'a_points', 'b_points'],
  ['ოინი', 'a_oini', 'b_oini'],
  ['სუხოი', 'a_sukhoi', 'b_sukhoi'],
  ['კოქსი', 'a_koksi', 'b_koksi'],
]

function Balance({ stats, byId, pairA, pairB }) {
  const dates = meetingSpan(stats)
  return (
    <div className="scoreboard" aria-live="polite">
      <div className="mini-name">
        <div className="score-num">{balanceLabel(stats.a_net)}</div>
        <div className="custom-range">
          <div>
            <PairName a={pairA[0]} b={pairA[1]} byId={byId} />
            <span>წყვილი 1</span>
          </div>
          <span />
          <div>
            <PairName a={pairB[0]} b={pairB[1]} byId={byId} />
            <span>წყვილი 2</span>
          </div>
        </div>
        <div className="custom-range">
          <span />
          <div>
            <span>შეხვედრები</span>
            <b>{count(stats.games)}</b>
          </div>
          <span />
        </div>
        {STAT_ROWS.map(([label, leftKey, rightKey]) => (
          <div className="custom-range" key={label}>
            <b className={mark('a', stats[leftKey], stats[rightKey])}>{count(stats[leftKey])}</b>
            <span>{label}</span>
            <b className={mark('b', stats[leftKey], stats[rightKey])}>{count(stats[rightKey])}</b>
          </div>
        ))}
        {dates ? <p className="hint">{dates}</p> : null}
      </div>
    </div>
  )
}

export default function ComparePage() {
  const period = usePeriod()
  const [params, setParams] = useSearchParams()
  const written = useRef({
    a: params.get('a') || '',
    b: params.get('b') || '',
  })
  const [slotsA, setSlotsA] = useState(() => parsePair(params.get('a')))
  const [slotsB, setSlotsB] = useState(() => parsePair(params.get('b')))
  const [players, setPlayers] = useState([])
  const [playersLoading, setPlayersLoading] = useState(isSupabaseConfigured)
  const [playersError, setPlayersError] = useState(null)
  const [stats, setStats] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const a = params.get('a') || ''
    const b = params.get('b') || ''
    if (a !== written.current.a) {
      written.current.a = a
      setSlotsA(parsePair(a))
    }
    if (b !== written.current.b) {
      written.current.b = b
      setSlotsB(parsePair(b))
    }
  }, [params])

  useEffect(() => {
    if (!supabase) {
      setPlayersLoading(false)
      return undefined
    }
    let alive = true
    setPlayersLoading(true)
    fetchPlayers()
      .then((list) => {
        if (alive) setPlayers(list)
      })
      .catch((err) => {
        console.error(err)
        if (alive) setPlayersError(georgianError(err))
      })
      .finally(() => {
        if (alive) setPlayersLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const pairA = orderedPair(slotsA)
  const pairB = orderedPair(slotsB)
  const distinct = new Set([...(pairA || []), ...(pairB || [])]).size === 4
  const complete = Boolean(pairA && pairB && distinct)
  const requestKey = !complete || period.customIncomplete
    ? ''
    : `${pairA[0]}-${pairA[1]}|${pairB[0]}-${pairB[1]}|${period.fromIso || ''}|${period.toIso || ''}`

  useEffect(() => {
    if (!supabase || !requestKey) {
      setLoading(false)
      setLoadedKey('')
      setStats(null)
      setMatches([])
      setError(null)
      return undefined
    }
    const ids = pairIdsFromKey(requestKey)
    if (!ids) {
      setLoading(false)
      setLoadedKey('')
      setStats(null)
      setMatches([])
      return undefined
    }
    const [pA1, pA2, pB1, pB2] = ids
    let alive = true
    setLoading(true)
    setError(null)
    let meetings = supabase
      .from('v_pair_results')
      .select('*')
      .or(`and(p1.eq.${pA1},p2.eq.${pA2},o1.eq.${pB1},o2.eq.${pB2}),and(p1.eq.${pB1},p2.eq.${pB2},o1.eq.${pA1},o2.eq.${pA2})`)
      .order('played_at', { ascending: false })
      .limit(1000)
    if (period.fromIso) meetings = meetings.gte('played_at', period.fromIso)
    if (period.toIso) meetings = meetings.lt('played_at', period.toIso)

    Promise.all([
      supabase.rpc('pair_h2h', {
        p_a1: pA1,
        p_a2: pA2,
        p_b1: pB1,
        p_b2: pB2,
        p_from: period.fromIso,
        p_to: period.toIso,
      }),
      meetings,
    ])
      .then(([rpc, list]) => {
        if (!alive) return
        if (rpc.error) throw rpc.error
        if (list.error) throw list.error
        setStats(firstRow(rpc.data))
        setMatches(keepMeetings(list.data, pairKey(pA1, pA2), pairKey(pB1, pB2)))
      })
      .catch((err) => {
        console.error(err)
        if (!alive) return
        setError(georgianError(err))
        setStats(null)
        setMatches([])
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
        setLoadedKey(requestKey)
      })
    return () => {
      alive = false
    }
  }, [requestKey, period.fromIso, period.toIso, tick])

  function writePairs(nextA, nextB) {
    const aStr = pairParam(nextA)
    const bStr = pairParam(nextB)
    written.current = { a: aStr, b: bStr }
    if ((params.get('a') || '') === aStr && (params.get('b') || '') === bStr) return
    const next = new URLSearchParams(params)
    if (aStr) next.set('a', aStr)
    else next.delete('a')
    if (bStr) next.set('b', bStr)
    else next.delete('b')
    setParams(next, { replace: true })
  }

  function updateSide(side, next) {
    const nextA = side === 'A' ? next : slotsA
    const nextB = side === 'B' ? next : slotsB
    if (side === 'A') setSlotsA(next)
    else setSlotsB(next)
    writePairs(nextA, nextB)
  }

  function toggle(side, id) {
    const playerId = toId(id)
    if (playerId == null) return
    const current = side === 'A' ? slotsA : slotsB
    const other = side === 'A' ? slotsB : slotsA
    if (hasId(other, playerId) && !hasId(current, playerId)) return
    if (hasId(current, playerId)) {
      updateSide(side, current.map((slot) => (toId(slot) === playerId ? null : slot)))
      return
    }
    const empty = current.findIndex((slot) => toId(slot) == null)
    if (empty === -1) return
    const next = [...current]
    next[empty] = playerId
    updateSide(side, next)
  }

  function clearSlot(side, index) {
    const current = side === 'A' ? slotsA : slotsB
    const next = [...current]
    next[index] = null
    updateSide(side, next)
  }

  function swapPairs() {
    setSlotsA(slotsB)
    setSlotsB(slotsA)
    writePairs(slotsB, slotsA)
  }

  const byId = useMemo(() => indexPlayers(players), [players])
  const picked = [slotsA[0], slotsA[1], slotsB[0], slotsB[1]].map((id) => toId(id)).filter((id) => id != null)
  const chipPlayers = players.filter((player) => isActive(player) || picked.includes(toId(player.id)))
  const canSwap = picked.length > 0
  const pending = Boolean(requestKey) && isSupabaseConfigured && (loading || loadedKey !== requestKey)
  const ready = Boolean(requestKey) && isSupabaseConfigured && !pending && !error && loadedKey === requestKey
  const hasSeries = ready && count(stats?.games) > 0

  return (
    <>
      <PageHead title="წყვილების შედარება" />
      <PeriodPicker
        period={period.period}
        from={period.from}
        to={period.to}
        onPeriod={period.setPeriod}
        onDate={period.setCustomDate}
      />
      {!isSupabaseConfigured ? <EmptyNote>ბაზა ჯერ არ არის მიბმული.</EmptyNote> : null}
      {period.customIncomplete ? <EmptyNote>აირჩიე თარიღიდან და თარიღამდე.</EmptyNote> : null}
      {playersError ? <ErrorNote message={playersError} /> : null}
      {playersLoading ? <Skeleton rows={2} /> : null}

      <div className="row-actions">
        <button type="button" className="btn ghost" onClick={swapPairs} disabled={!canSwap}>
          წყვილების გადაცვლა
        </button>
      </div>

      {!playersLoading && isSupabaseConfigured && chipPlayers.length === 0 ? (
        <EmptyNote>აქტიური მოთამაშე არ არის.</EmptyNote>
      ) : null}

      <TeamBlock
        title="წყვილი 1"
        side="a"
        slots={slotsA}
        players={chipPlayers}
        otherIds={slotsB}
        byId={byId}
        onToggle={(id) => toggle('A', id)}
        onClear={(index) => clearSlot('A', index)}
      />
      <TeamBlock
        title="წყვილი 2"
        side="b"
        slots={slotsB}
        players={chipPlayers}
        otherIds={slotsA}
        byId={byId}
        onToggle={(id) => toggle('B', id)}
        onClear={(index) => clearSlot('B', index)}
      />

      {!complete && isSupabaseConfigured && !playersLoading ? (
        <p className="hint">აირჩიე ორი სრული წყვილი.</p>
      ) : null}

      {pending ? <Skeleton rows={5} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {ready && !hasSeries ? <EmptyNote>ამ წყვილებს ერთმანეთთან ჯერ არ უთამაშიათ.</EmptyNote> : null}
      {hasSeries ? <Balance stats={stats} byId={byId} pairA={pairA} pairB={pairB} /> : null}
      {ready && matches.length > 0 ? (
        <section className="block">
          <h2>პარტიები</h2>
          <div className="match-list">
            {matches.map((row) => (
              <MatchLine
                key={row.match_id ?? `${row.played_at}-${pairKey(row.p1, row.p2)}`}
                match={lineForMatch(row)}
                byId={byId}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
