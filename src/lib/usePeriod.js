import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PERIODS, monthStartInputValue, periodBounds, todayInputValue } from './dates'

export const PERIOD_KEY = 'domino-period'
const SORTS = new Set([
  'place',
  'name',
  'games',
  'points_won',
  'points_lost',
  'points',
  'oini',
  'sukhoi',
  'koksi',
])

function knownPeriod(value) {
  return PERIODS.some((item) => item.id === value) ? value : 'all'
}

function initialDir(sort, dirParam) {
  if (sort === 'place') return 'asc'
  if (dirParam === 'asc' || dirParam === 'desc') return dirParam
  return sort === 'name' ? 'asc' : 'desc'
}

export function periodSearchFrom(search) {
  const raw = search.startsWith('?') ? search.slice(1) : search
  const current = new URLSearchParams(raw)
  const period = knownPeriod(current.get('period') || sessionStorage.getItem(PERIOD_KEY) || 'all')
  const next = new URLSearchParams()
  next.set('period', period)
  if (period === 'custom') {
    if (current.get('from')) next.set('from', current.get('from'))
    if (current.get('to')) next.set('to', current.get('to'))
  }
  return next.toString()
}

export function usePeriod() {
  const [params, setParams] = useSearchParams()
  const period = knownPeriod(params.get('period') || 'all')
  const from = params.get('from') || ''
  const to = params.get('to') || ''

  useEffect(() => {
    const current = params.get('period')
    if (current && PERIODS.some((item) => item.id === current)) {
      sessionStorage.setItem(PERIOD_KEY, current)
      return
    }
    const stored = knownPeriod(sessionStorage.getItem(PERIOD_KEY) || 'all')
    const next = new URLSearchParams(params)
    next.set('period', stored)
    setParams(next, { replace: true })
  }, [params, setParams])

  const setPeriod = useCallback((id) => {
    const nextPeriod = knownPeriod(id)
    sessionStorage.setItem(PERIOD_KEY, nextPeriod)
    const next = new URLSearchParams(params)
    next.set('period', nextPeriod)
    if (nextPeriod === 'custom') {
      if (!next.get('from')) next.set('from', monthStartInputValue())
      if (!next.get('to')) next.set('to', todayInputValue())
    } else {
      next.delete('from')
      next.delete('to')
    }
    setParams(next, { replace: true })
  }, [params, setParams])

  const setCustomDate = useCallback((key, value) => {
    const next = new URLSearchParams(params)
    next.set('period', 'custom')
    next.set(key, value)
    sessionStorage.setItem(PERIOD_KEY, 'custom')
    setParams(next, { replace: true })
  }, [params, setParams])

  const customIncomplete = period === 'custom' && (!from || !to)
  const bounds = customIncomplete ? { from: null, to: null } : periodBounds(period, from, to)

  return {
    period,
    from,
    to,
    setPeriod,
    setCustomDate,
    customIncomplete,
    fromIso: bounds.from ? bounds.from.toISOString() : null,
    toIso: bounds.to ? bounds.to.toISOString() : null,
  }
}

export function useTableQuery(defaultMin) {
  const periodApi = usePeriod()
  const [params, setParams] = useSearchParams()
  const minRaw = params.get('min')
  const min = minRaw == null || minRaw === '' ? defaultMin : Math.max(0, Math.floor(Number(minRaw) || 0))
  const sort = SORTS.has(params.get('sort')) ? params.get('sort') : 'place'
  const dir = initialDir(sort, params.get('dir'))

  const setMin = useCallback((value) => {
    const next = new URLSearchParams(params)
    next.set('min', String(Math.max(0, Math.floor(Number(value) || 0))))
    setParams(next, { replace: true })
  }, [params, setParams])

  const toggleSort = useCallback((key) => {
    if (!SORTS.has(key)) return
    const next = new URLSearchParams(params)
    if (key === 'place') {
      next.set('sort', 'place')
      next.set('dir', 'asc')
    } else if (sort === key) {
      next.set('dir', dir === 'desc' ? 'asc' : 'desc')
    } else {
      next.set('sort', key)
      next.set('dir', key === 'name' ? 'asc' : 'desc')
    }
    setParams(next, { replace: true })
  }, [params, setParams, sort, dir])

  return { ...periodApi, min, setMin, sort, dir, toggleSort }
}
