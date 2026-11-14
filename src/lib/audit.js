import { formatDateTime } from './dates'
import { WIN_LABEL, personName } from './format'

const SKIP = new Set(['id', 'points', 'created_at', 'updated_at', 'created_by', 'updated_by'])

const LABELS = {
  a1: 'გუნდი A · 1',
  a2: 'გუნდი A · 2',
  b1: 'გუნდი B · 1',
  b2: 'გუნდი B · 2',
  winner: 'გამარჯვებული',
  win_type: 'ტიპი',
  note: 'შენიშვნა',
  is_void: 'გაუქმებული',
  played_at: 'დრო',
}

const ORDER = ['a1', 'a2', 'b1', 'b2', 'winner', 'win_type', 'is_void', 'note', 'played_at']

function asRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true
  if (left == null && right == null) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

function changedKeys(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  return [...keys].filter((key) => !SKIP.has(key) && !sameValue(before?.[key], after?.[key]))
}

function isVoid(value) {
  return value === true || value === 'true' || value === 't'
}

function show(key, value, byId) {
  if (value == null || value === '') return '—'
  if (key === 'winner') {
    if (value === 'A') return 'გუნდი A'
    if (value === 'B') return 'გუნდი B'
  }
  if (key === 'win_type') return WIN_LABEL[value] || String(value)
  if (key === 'is_void') return isVoid(value) ? 'კი' : 'არა'
  if (key === 'a1' || key === 'a2' || key === 'b1' || key === 'b2') return personName(byId, value)
  if (key === 'played_at') return formatDateTime(value)
  if (typeof value === 'object') return '—'
  return String(value)
}

export function auditWhen(row) {
  return row.changed_at
}

export function auditTitle(row) {
  const action = String(row?.action || '').toUpperCase()
  if (action === 'INSERT') return 'შეიქმნა'
  if (action === 'DELETE') return 'წაიშალა'
  if (action === 'UPDATE') {
    const before = asRow(row.old_row)
    const after = asRow(row.new_row)
    if (before && after) {
      const keys = changedKeys(before, after)
      if (keys.length === 1 && keys[0] === 'is_void') {
        const was = isVoid(before.is_void)
        const now = isVoid(after.is_void)
        if (!was && now) return 'გაუქმდა'
        if (was && !now) return 'აღდგა'
      }
    }
    return 'შეიცვალა'
  }
  return 'ცვლილება'
}

export function auditLines(row, byId) {
  const action = String(row?.action || '').toUpperCase()
  if (action === 'INSERT') return []
  if (action !== 'UPDATE' && action !== 'DELETE') return []
  const before = asRow(row.old_row) || {}
  const after = asRow(row.new_row) || {}
  const keys = changedKeys(before, after)
  keys.sort((left, right) => {
    const leftAt = ORDER.indexOf(left)
    const rightAt = ORDER.indexOf(right)
    return (leftAt === -1 ? ORDER.length : leftAt) - (rightAt === -1 ? ORDER.length : rightAt)
  })
  return keys.map((key) => `${LABELS[key] || key}: ${show(key, before[key], byId)} → ${show(key, after[key], byId)}`)
}
