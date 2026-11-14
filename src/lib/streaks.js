import { isWon, percentNumber } from './format'

export function analyzeResults(rows) {
  const sorted = [...rows]
    .filter((row) => row.played_at)
    .sort((a, b) => {
      const delta = new Date(a.played_at) - new Date(b.played_at)
      if (delta) return delta
      return String(a.match_id || '').localeCompare(String(b.match_id || ''))
    })
    .map((row) => ({ ...row, won: isWon(row.won) }))

  let longestWin = 0
  let longestLoss = 0
  let run = 0
  let runWin = null
  for (const row of sorted) {
    if (runWin === row.won) run += 1
    else {
      runWin = row.won
      run = 1
    }
    if (row.won) longestWin = Math.max(longestWin, run)
    else longestLoss = Math.max(longestLoss, run)
  }

  let current = 0
  let currentWin = null
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (currentWin == null) {
      currentWin = sorted[i].won
      current = 1
    } else if (sorted[i].won === currentWin) current += 1
    else break
  }

  return { sorted, last: sorted.slice(-10), current, currentWin, longestWin, longestLoss }
}

export function pickPartners(rows) {
  const enough = rows.filter((row) => Number(row.games) >= 3)
  const byRate = (a, b, direction) => {
    const left = percentNumber(a) ?? (direction > 0 ? 101 : -1)
    const right = percentNumber(b) ?? (direction > 0 ? 101 : -1)
    if (left !== right) return (left - right) * direction
    return ((Number(a.net_points) || 0) - (Number(b.net_points) || 0)) * direction
  }
  const best = [...enough].sort((a, b) => byRate(a, b, -1))[0] || null
  const worstCandidate = [...enough].sort((a, b) => byRate(a, b, 1))[0] || null
  const worst = worstCandidate && worstCandidate.id !== best?.id ? worstCandidate : null
  return { best, worst }
}

export function pickOpponents(rows) {
  const withGames = rows.filter((row) => Number(row.games) > 0)
  const beaten = [...withGames].sort(
    (a, b) => (Number(b.wins) || 0) - (Number(a.wins) || 0) || (Number(b.games) || 0) - (Number(a.games) || 0),
  )[0]
  const lostTo = [...withGames].sort(
    (a, b) => (Number(b.losses) || 0) - (Number(a.losses) || 0) || (Number(b.games) || 0) - (Number(a.games) || 0),
  )[0]
  return {
    beaten: beaten && Number(beaten.wins) > 0 ? beaten : null,
    lostTo: lostTo && Number(lostTo.losses) > 0 ? lostTo : null,
  }
}
