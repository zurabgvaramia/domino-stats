import { isWon } from './format'

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

function pointsOf(row, key) {
  const n = Number(row?.[key])
  return Number.isFinite(n) ? n : 0
}

function comparePartners(a, b) {
  const byNet = pointsOf(b, 'net_points') - pointsOf(a, 'net_points')
  if (byNet) return byNet
  return pointsOf(b, 'points_won') - pointsOf(a, 'points_won')
}

export function pickPartners(rows) {
  const ranked = rows.filter((row) => Number(row.games) >= 3).sort(comparePartners)
  const best = ranked[0] || null
  const last = ranked.length > 1 ? ranked[ranked.length - 1] : null
  const worst = last && best && comparePartners(best, last) !== 0 ? last : null
  return { best, worst }
}

export function pickOpponents(rows) {
  const withGames = rows.filter((row) => Number(row.games) > 0)
  const beaten = [...withGames].sort(
    (a, b) => pointsOf(b, 'points_won') - pointsOf(a, 'points_won') || pointsOf(b, 'games') - pointsOf(a, 'games'),
  )[0]
  const lostTo = [...withGames].sort(
    (a, b) => pointsOf(b, 'points_lost') - pointsOf(a, 'points_lost') || pointsOf(b, 'games') - pointsOf(a, 'games'),
  )[0]
  return {
    beaten: beaten && pointsOf(beaten, 'points_won') > 0 ? beaten : null,
    lostTo: lostTo && pointsOf(lostTo, 'points_lost') > 0 ? lostTo : null,
  }
}
