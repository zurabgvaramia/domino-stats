import { isWon, orderedIds, pairKey, stakeOf } from './format'

export function summarizePair(rows) {
  const signed = rows.some((row) => Number(row.points) < 0)
  const groups = new Map()
  const matches = []

  for (const row of rows) {
    const won = isWon(row.won)
    const points = Number(row.points)
    const net = signed && Number.isFinite(points) ? points : (won ? 1 : -1) * stakeOf(row)
    const next = { ...row, won, net }
    matches.push(next)
    const [o1, o2] = orderedIds(row.o1, row.o2)
    const key = pairKey(o1, o2)
    const rec = groups.get(key) || { key, o1, o2, games: 0, pointsFor: 0, pointsAgainst: 0, net: 0 }
    const stake = stakeOf(row)
    rec.games += 1
    if (won) rec.pointsFor += stake
    else rec.pointsAgainst += stake
    rec.net += net
    groups.set(key, rec)
  }

  matches.sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
  const head = [...groups.values()].sort((a, b) => b.games - a.games || b.net - a.net)
  return { matches, head }
}
