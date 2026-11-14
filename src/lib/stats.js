export const STAT_COLUMNS = [
  { key: 'place', label: 'ადგილი', title: 'ადგილი' },
  { key: 'name', label: 'სახელი', title: 'სახელი' },
  { key: 'games', label: 'თამაში', title: 'თამაში' },
  { key: 'points_won', label: 'მოგება', title: 'მოგება (ქულა)' },
  { key: 'points_lost', label: 'წაგება', title: 'წაგება (ქულა)' },
  { key: 'points', label: 'ქულა', title: 'ქულა' },
  { key: 'oini', label: 'ოინი', title: 'ოინი' },
  { key: 'sukhoi', label: 'სუხოი', title: 'სუხოი' },
  { key: 'koksi', label: 'კოქსი', title: 'კოქსი' },
]

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function metric(row, sort, nameOf) {
  switch (sort) {
    case 'name':
      return nameOf(row)
    case 'place': {
      if (row?.place == null || row.place === '') return null
      const n = Number(row.place)
      return Number.isFinite(n) ? n : null
    }
    case 'games':
      return num(row.games)
    case 'points_won':
      return num(row.points_won)
    case 'points_lost':
      return num(row.points_lost)
    case 'points':
      return num(row.net_points)
    case 'oini':
      return num(row.oini_made)
    case 'sukhoi':
      return num(row.sukhoi_made)
    case 'koksi':
      return num(row.koksi_made)
    default:
      return 0
  }
}

export function sortRows(rows, sort, dir, nameOf) {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = metric(a, sort, nameOf)
    const right = metric(b, sort, nameOf)
    if (left == null || right == null) {
      if (left == null && right == null) return nameOf(a).localeCompare(nameOf(b), 'ka')
      return left == null ? 1 : -1
    }
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
