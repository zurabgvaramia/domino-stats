import { asDayKey, dayBounds } from './dates'
import { toId } from './format'

export function normalizeDay(row) {
  const key = asDayKey(row?.day)
  if (!key) return null
  const games = Number(row?.games)
  return { key, games: Number.isFinite(games) ? games : 0 }
}

export function firstPlace(rows) {
  return (rows || []).filter((row) => Number(row?.place) === 1)
}

export function pairSlug(a, b) {
  const x = toId(a)
  const y = toId(b)
  if (x == null || y == null || x === y) return ''
  return x < y ? `${x}-${y}` : `${y}-${x}`
}

export function compareSearch(row, day) {
  const a = pairSlug(row?.a1, row?.a2)
  const b = pairSlug(row?.b1, row?.b2)
  if (!a || !b || !dayBounds(day)) return ''
  return `a=${a}&b=${b}&period=custom&from=${day}&to=${day}`
}

export function neighborDays(keys, current) {
  const list = (keys || []).filter(Boolean)
  const index = list.indexOf(current)
  if (index >= 0) {
    return { newer: list[index - 1] || null, older: list[index + 1] || null }
  }
  let newer = null
  let older = null
  for (const key of list) {
    if (key > current && (newer == null || key < newer)) newer = key
    if (key < current && (older == null || key > older)) older = key
  }
  return { newer, older }
}
