import { toId } from './format'
import { supabase } from './supabase'

export function isActive(player) {
  return player?.is_active !== false
}

export async function fetchPlayers() {
  const { data, error } = await supabase.from('players').select('id, name, nickname, is_active')
  if (error) throw error
  return [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ka'))
}

export function indexPlayers(list) {
  const byId = {}
  for (const player of list || []) {
    const id = toId(player.id)
    if (id == null) continue
    byId[id] = player.id === id ? player : { ...player, id }
  }
  return byId
}
