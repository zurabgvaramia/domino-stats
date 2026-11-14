export const WIN_LABEL = {
  regular: 'ჩვეულებრივი',
  sukhoi: 'სუხოი',
  koksi: 'კოქსი',
}

export const WIN_POINTS = {
  regular: 1,
  sukhoi: 2,
  koksi: 3,
}

export function isWon(value) {
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1'
}

export function percentNumber(row) {
  const games = Number(row?.games) || 0
  if (games <= 0) return null
  return (100 * (Number(row.wins) || 0)) / games
}

export function formatPct(row) {
  const value = percentNumber(row)
  if (value == null) return '—'
  return `${Math.round(value)}%`
}

export function formatSigned(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n > 0) return `+${n}`
  return String(n)
}

export function diffCount(row, madeKey, takenKey) {
  return (Number(row?.[madeKey]) || 0) - (Number(row?.[takenKey]) || 0)
}

export function orderedIds(a, b) {
  return String(a) < String(b) ? [a, b] : [b, a]
}

export function pairKey(a, b) {
  const [x, y] = orderedIds(a, b)
  return `${x}|${y}`
}

export function lineupKey(a1, a2, b1, b2) {
  return [pairKey(a1, a2), pairKey(b1, b2)].sort().join('~')
}

export function personName(byId, id) {
  if (!id) return '—'
  return byId?.[id]?.name || 'უცნობი'
}

export function roleLabel(role) {
  if (role === 'admin') return 'ადმინი'
  if (role === 'editor') return 'რედაქტორი'
  return 'ჩაწერის უფლება არ აქვს'
}

export function stakeOf(row) {
  const n = Number(row?.points)
  if (Number.isFinite(n) && n !== 0) return Math.abs(n)
  return WIN_POINTS[row?.win_type] || 1
}
