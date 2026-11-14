const OFFSET = 4 * 60 * 60 * 1000

export const PERIODS = [
  { id: 'today', label: 'დღეს' },
  { id: 'week', label: 'ეს კვირა' },
  { id: 'month', label: 'ეს თვე' },
  { id: 'year', label: 'წელი' },
  { id: 'all', label: 'მთელი დრო' },
  { id: 'custom', label: 'სხვა პერიოდი' },
]

const MONTHS = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
]

export function tbilisiParts(date) {
  const shifted = new Date(date.getTime() + OFFSET)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  }
}

export function zonedDate(y, m, d, h = 0, min = 0, s = 0, ms = 0) {
  return new Date(Date.UTC(y, m, d, h, min, s, ms) - OFFSET)
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export function todayInputValue(now = new Date()) {
  const { y, m, d } = tbilisiParts(now)
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

export function monthStartInputValue(now = new Date()) {
  const { y, m } = tbilisiParts(now)
  return `${y}-${pad(m + 1)}-01`
}

export function startOfToday(now = new Date()) {
  const { y, m, d } = tbilisiParts(now)
  return zonedDate(y, m, d)
}

export function startOfTomorrow(now = new Date()) {
  const { y, m, d } = tbilisiParts(now)
  return zonedDate(y, m, d + 1)
}

function parseInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m: m - 1, d }
}

export function periodBounds(period, fromStr, toStr, now = new Date()) {
  const { y, m, d, weekday } = tbilisiParts(now)
  if (period === 'today') return { from: zonedDate(y, m, d), to: zonedDate(y, m, d + 1) }
  if (period === 'week') {
    const sinceMonday = (weekday + 6) % 7
    return { from: zonedDate(y, m, d - sinceMonday), to: zonedDate(y, m, d + 1) }
  }
  if (period === 'month') return { from: zonedDate(y, m, 1), to: zonedDate(y, m, d + 1) }
  if (period === 'year') return { from: zonedDate(y, 0, 1), to: zonedDate(y, m, d + 1) }
  if (period === 'custom') {
    const from = parseInput(fromStr)
    const to = parseInput(toStr)
    if (!from || !to) return { from: null, to: null }
    let start = zonedDate(from.y, from.m, from.d)
    let end = zonedDate(to.y, to.m, to.d + 1)
    if (start > end) {
      start = zonedDate(to.y, to.m, to.d)
      end = zonedDate(from.y, from.m, from.d + 1)
    }
    return { from: start, to: end }
  }
  return { from: null, to: null }
}

export function dayKey(iso) {
  const { y, m, d } = tbilisiParts(new Date(iso))
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

export function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const y = Number(match[1])
  const month = Number(match[2])
  const d = Number(match[3])
  if (month < 1 || month > 12 || d < 1 || d > 31) return null
  const probe = zonedDate(y, month - 1, d, 12)
  const parts = tbilisiParts(probe)
  if (parts.y !== y || parts.m !== month - 1 || parts.d !== d) return null
  return { y, m: month - 1, d, key: `${y}-${pad(month)}-${pad(d)}` }
}

export function dayBounds(value) {
  const day = parseDay(value)
  if (!day) return null
  const from = zonedDate(day.y, day.m, day.d)
  const to = zonedDate(day.y, day.m, day.d + 1)
  return { ...day, from, to, fromIso: from.toISOString(), toIso: to.toISOString() }
}

export function labelForDay(value, now = new Date()) {
  const day = parseDay(value)
  if (!day) return ''
  return formatDayLabel(zonedDate(day.y, day.m, day.d, 12).toISOString(), now)
}

export function asDayKey(value) {
  if (value == null || value === '') return null
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseDay(text)?.key || null
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return dayKey(parsed.toISOString())
}

export function formatDayLabel(iso, now = new Date()) {
  const parts = tbilisiParts(new Date(iso))
  const today = tbilisiParts(now)
  if (parts.y === today.y && parts.m === today.m && parts.d === today.d) return 'დღეს'
  const yesterday = tbilisiParts(zonedDate(today.y, today.m, today.d - 1, 12))
  if (parts.y === yesterday.y && parts.m === yesterday.m && parts.d === yesterday.d) return 'გუშინ'
  const label = `${parts.d} ${MONTHS[parts.m]}`
  return parts.y === today.y ? label : `${label} ${parts.y}`
}

export function formatTime(iso) {
  const shifted = new Date(new Date(iso).getTime() + OFFSET)
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return `${formatDayLabel(iso)} ${formatTime(iso)}`
}

export function groupByDay(rows) {
  const groups = []
  for (const row of rows) {
    const key = dayKey(row.played_at)
    let group = groups.find((item) => item.key === key)
    if (!group) {
      group = { key, label: formatDayLabel(row.played_at), items: [] }
      groups.push(group)
    }
    group.items.push(row)
  }
  return groups
}
