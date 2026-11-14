import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { PairName } from '../components/PlayerName'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { dayBounds, labelForDay } from '../lib/dates'
import { firstPlace, normalizeDay } from '../lib/days'
import { georgianError } from '../lib/errors'
import { formatSigned } from '../lib/format'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

const PAGE = 20

function periodKeyOf(period) {
  return `${period.fromIso ?? ''}|${period.toIso ?? ''}|${period.customIncomplete ? 1 : 0}`
}

export default function DaysPage() {
  const period = usePeriod()
  const periodKey = periodKeyOf(period)
  const winnersRef = useRef({})
  const [queryKey, setQueryKey] = useState(periodKey)
  const [days, setDays] = useState([])
  const [people, setPeople] = useState([])
  const [winners, setWinners] = useState({})
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  if (queryKey !== periodKey) {
    setQueryKey(periodKey)
    setDays([])
    setWinners({})
    setLimit(PAGE)
    setError(null)
    setLoading(!period.customIncomplete && Boolean(supabase))
  }

  useEffect(() => {
    if (!supabase || period.customIncomplete) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    winnersRef.current = {}
    setWinners({})
    Promise.all([
      fetchPlayers(),
      supabase.rpc('played_days', { p_from: period.fromIso, p_to: period.toIso }),
    ]).then(([list, stats]) => {
      if (!alive) return
      if (stats.error) {
        console.error(stats.error)
        setError(georgianError(stats.error))
        setDays([])
      } else {
        setPeople(list)
        setDays((stats.data ?? []).map(normalizeDay).filter(Boolean))
      }
      setLoading(false)
    }).catch((err) => {
      console.error(err)
      if (!alive) return
      setError(georgianError(err))
      setDays([])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [period.fromIso, period.toIso, period.customIncomplete, tick])

  const visible = days.slice(0, limit)
  const visibleKey = visible.map((day) => day.key).join('|')

  useEffect(() => {
    if (!supabase || !visibleKey) return undefined
    const keys = visibleKey.split('|')
    const missing = keys.filter((key) => winnersRef.current[key] === undefined)
    if (missing.length === 0) return undefined
    let alive = true
    for (const key of missing) winnersRef.current[key] = null
    setWinners((current) => ({
      ...current,
      ...Object.fromEntries(missing.map((key) => [key, null])),
    }))

    const queue = [...missing]
    const worker = async () => {
      while (alive) {
        const key = queue.shift()
        if (!key) return
        const bounds = dayBounds(key)
        if (!bounds) {
          winnersRef.current[key] = []
          if (alive) setWinners((current) => ({ ...current, [key]: [] }))
          continue
        }
        try {
          const { data, error: rpcError } = await supabase.rpc('pair_stats', {
            p_from: bounds.fromIso,
            p_to: bounds.toIso,
          })
          if (!alive) return
          if (rpcError) throw rpcError
          const champs = firstPlace(data)
          winnersRef.current[key] = champs
          setWinners((current) => ({ ...current, [key]: champs }))
        } catch (err) {
          console.error(err)
          if (!alive) return
          winnersRef.current[key] = 'error'
          setWinners((current) => ({ ...current, [key]: 'error' }))
        }
      }
    }
    const count = Math.min(4, queue.length)
    for (let index = 0; index < count; index += 1) worker()

    return () => {
      alive = false
      for (const key of missing) {
        if (winnersRef.current[key] == null) delete winnersRef.current[key]
      }
    }
  }, [visibleKey, tick])

  const byId = useMemo(() => indexPlayers(people), [people])

  return (
    <>
      <PageHead title="დღეები" />
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
      {!loading && !error && isSupabaseConfigured && !period.customIncomplete && days.length === 0 ? (
        <EmptyNote>ამ პერიოდში სათამაშო დღე არ არის.</EmptyNote>
      ) : null}
      {!loading && !error ? visible.map((day) => (
        <DayCard key={day.key} day={day} champs={winners[day.key]} byId={byId} />
      )) : null}
      {!loading && !error && days.length > limit ? (
        <button type="button" className="btn ghost block" onClick={() => setLimit((value) => value + PAGE)}>
          მეტის ჩატვირთვა
        </button>
      ) : null}
    </>
  )
}

function DayCard({ day, champs, byId }) {
  const tied = Array.isArray(champs) && champs.length > 1
  return (
    <Link className="day-card" to={`/days/${day.key}`}>
      <span className="day-card-top">
        <strong>{labelForDay(day.key)}</strong>
        <span>{day.games} პარტია</span>
      </span>
      {champs == null ? <span className="day-card-wait">იტვირთება…</span> : null}
      {champs === 'error' ? <span className="day-card-wait">გამარჯვებული ვერ ჩაიტვირთა</span> : null}
      {tied ? <span className="day-card-wait">გაიყვეს</span> : null}
      {Array.isArray(champs) ? champs.map((row) => (
        <span className="day-champ" key={`${row.p1}-${row.p2}`}>
          <span aria-hidden="true">🏆</span>
          <PairName a={row.p1} b={row.p2} byId={byId} names={[row.p1_name, row.p2_name]} compact />
          <b>{formatSigned(row.net_points)}</b>
        </span>
      )) : null}
    </Link>
  )
}
