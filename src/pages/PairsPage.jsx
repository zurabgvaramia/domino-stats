import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { PairName } from '../components/PlayerName'
import StatsBoard from '../components/StatsBoard'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { georgianError } from '../lib/errors'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useTableQuery } from '../lib/usePeriod'

export default function PairsPage() {
  const query = useTableQuery(3)
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!supabase || query.customIncomplete) {
      setLoading(false)
      setRows([])
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      fetchPlayers(),
      supabase.rpc('pair_stats', { p_from: query.fromIso, p_to: query.toIso }),
    ]).then(([list, stats]) => {
      if (!alive) return
      if (stats.error) {
        console.error(stats.error)
        setError(georgianError(stats.error))
        setRows([])
      } else {
        setPeople(list)
        setRows(stats.data ?? [])
      }
      setLoading(false)
    }).catch((err) => {
      console.error(err)
      if (!alive) return
      setError(georgianError(err))
      setRows([])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [query.fromIso, query.toIso, query.customIncomplete, tick])

  const byId = useMemo(() => indexPlayers(people), [people])

  return (
    <>
      <PageHead title="წყვილები" />
      <PeriodPicker
        period={query.period}
        from={query.from}
        to={query.to}
        onPeriod={query.setPeriod}
        onDate={query.setCustomDate}
      />
      {!isSupabaseConfigured ? <EmptyNote>ბაზა ჯერ არ არის მიბმული.</EmptyNote> : null}
      {query.customIncomplete ? <EmptyNote>აირჩიე თარიღიდან და თარიღამდე.</EmptyNote> : null}
      {loading && isSupabaseConfigured ? <Skeleton rows={6} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {!loading && !error && isSupabaseConfigured && !query.customIncomplete ? (
        <StatsBoard
          rows={rows}
          min={query.min}
          onMin={query.setMin}
          sort={query.sort}
          dir={query.dir}
          onSort={query.toggleSort}
          nameOf={(row) => `${row.p1_name || '—'} · ${row.p2_name || '—'}`}
          renderName={(row) => (
            <PairName
              a={row.p1}
              b={row.p2}
              byId={byId}
              names={[row.p1_name, row.p2_name]}
              compact
            />
          )}
          hrefOf={(row) => ({ pathname: `/pairs/${row.p1}/${row.p2}`, search: location.search })}
          rowId={(row) => `${row.p1}-${row.p2}`}
          empty="ამ პერიოდში წყვილები არ არის."
          noun="წყვილები"
        />
      ) : null}
    </>
  )
}
