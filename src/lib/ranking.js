function rankValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function compareRank(a, b) {
  const byPoints = rankValue(b.net_points) - rankValue(a.net_points)
  if (byPoints) return byPoints
  const byKoksi = rankValue(b.koksi_made) - rankValue(a.koksi_made)
  if (byKoksi) return byKoksi
  return rankValue(b.sukhoi_made) - rankValue(a.sukhoi_made)
}

export function assignPlaces(rows) {
  let place = 1
  return rows.map((row, index) => {
    if (index > 0 && compareRank(rows[index - 1], row) !== 0) place = index + 1
    return { ...row, place }
  })
}
