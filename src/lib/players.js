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
  for (const player of list) byId[player.id] = player
  return byId
}
