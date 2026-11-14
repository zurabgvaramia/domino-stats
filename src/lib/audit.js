import { formatDateTime } from './dates'
import { WIN_LABEL, personName } from './format'

const ACTIONS = {
  insert: 'შეიქმნა',
  inserted: 'შეიქმნა',
  create: 'შეიქმნა',
  created: 'შეიქმნა',
  update: 'შეიცვალა',
  updated: 'შეიცვალა',
  edit: 'შეიცვალა',
  void: 'გაუქმდა',
  voided: 'გაუქმდა',
  restore: 'აღდგა',
  restored: 'აღდგა',
  delete: 'წაიშალა',
  deleted: 'წაიშალა',
}

const FIELDS = {
  winner: 'გამარჯვებული',
  win_type: 'ტიპი',
  note: 'შენიშვნა',
  is_void: 'გაუქმებული',
  a1: 'გუნდი A',
  a2: 'გუნდი A',
  b1: 'გუნდი B',
  b2: 'გუნდი B',
  played_at: 'დრო',
  points: 'ქულები',
}

export function auditWhen(row) {
  return row.changed_at || row.created_at || row.edited_at || row.inserted_at || row.at || row.ts || null
}

export function auditTitle(row) {
  const raw = row.action || row.operation || row.event || row.op || row.type || ''
  const key = String(raw).toLowerCase()
  return ACTIONS[key] || (raw ? String(raw) : 'ცვლილება')
}

function show(key, value, byId) {
  if (value == null || value === '') return '—'
  if (key === 'winner') {
    if (value === 'A') return 'გუნდი A'
    if (value === 'B') return 'გუნდი B'
  }
  if (key === 'win_type') return WIN_LABEL[value] || String(value)
  if (key === 'is_void') return value === true || value === 'true' ? 'კი' : 'არა'
  if (key === 'a1' || key === 'a2' || key === 'b1' || key === 'b2') return personName(byId, value)
  if (String(key).endsWith('_at')) return formatDateTime(value)
  if (typeof value === 'object') return ''
  const text = String(value)
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

export function auditLines(row, byId) {
  const changes = row.changes || row.diff
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    return Object.entries(changes).flatMap(([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        const text = show(key, value, byId)
        return text ? [`${FIELDS[key] || key}: ${text}`] : []
      }
      const oldValue = value.old ?? value.from ?? value.prev
      const newValue = value.new ?? value.to ?? value.next
      if (oldValue === undefined && newValue === undefined) return []
      return [`${FIELDS[key] || key}: ${show(key, oldValue, byId)} → ${show(key, newValue, byId)}`]
    })
  }

  const before = row.old_data || row.old_row || row.before || row.old
  const after = row.new_data || row.new_row || row.after || row.new
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    return keys.flatMap((key) => {
      if (['id', 'created_at', 'updated_at'].includes(key)) return []
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return []
      return [`${FIELDS[key] || key}: ${show(key, before[key], byId)} → ${show(key, after[key], byId)}`]
    })
  }

  return []
}
