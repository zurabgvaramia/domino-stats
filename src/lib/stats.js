import { diffCount, percentNumber } from './format'

export const STAT_COLUMNS = [
  { key: 'name', label: 'სახელი', title: 'სახელი' },
  { key: 'games', label: 'თ', title: 'თამაში' },
  { key: 'wins', label: 'მ', title: 'მოგება' },
  { key: 'losses', label: 'წ', title: 'წაგება' },
  { key: 'pct', label: '%', title: 'მოგების პროცენტი' },
  { key: 'points', label: 'ქულები', title: 'ქულები' },
  { key: 'koksi', label: 'კოქსი', title: 'კოქსი' },
  { key: 'sukhoi', label: 'სუხოი', title: 'სუხოი' },
]

export function metric(row, sort, nameOf) {
  switch (sort) {
    case 'name':
      return nameOf(row)
    case 'games':
      return Number(row.games) || 0
    case 'wins':
      return Number(row.wins) || 0
    case 'losses':
      return Number(row.losses) || 0
    case 'pct':
      return percentNumber(row) ?? -1
    case 'points':
      return Number(row.net_points) || 0
    case 'koksi':
      return diffCount(row, 'koksi_made', 'koksi_taken')
    case 'sukhoi':
      return diffCount(row, 'sukhoi_made', 'sukhoi_taken')
    default:
      return 0
  }
}

export function sortRows(rows, sort, dir, nameOf) {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = metric(a, sort, nameOf)
    const right = metric(b, sort, nameOf)
    const cmp = typeof left === 'string' ? left.localeCompare(right, 'ka') : left - right
    if (cmp !== 0) return cmp * mul
    return nameOf(a).localeCompare(nameOf(b), 'ka')
  })
}

export function splitByMin(rows, min) {
  const qualified = []
  const bench = []
  for (const row of rows) {
    if ((Number(row.games) || 0) >= min) qualified.push(row)
    else bench.push(row)
  }
  return { qualified, bench }
}
