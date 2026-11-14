import { toId } from '../lib/format'

function lookup(byId, id) {
  const key = toId(id)
  if (key == null || !byId) return null
  return byId[key] || null
}

function nickOf(player) {
  const nick = String(player?.nickname || '').trim()
  return nick
}

export function PlayerName({ player, id, byId, compact = false }) {
  const found = lookup(byId, id ?? player?.id)
  const resolved = found || player || { name: '—' }
  const name = resolved.name || '—'
  const nick = nickOf(found || resolved)
  return (
    <span className={compact ? 'player-name compact' : 'player-name'}>
      <span className="player-name-text">{name}</span>
      {nick ? <span className="nick">{nick}</span> : null}
    </span>
  )
}

export function PairName({ a, b, byId, names, compact = false }) {
  const left = lookup(byId, a)
  const right = lookup(byId, b)
  const leftName = left?.name || names?.[0] || '—'
  const rightName = right?.name || names?.[1] || '—'
  const nicks = [nickOf(left), nickOf(right)].filter(Boolean)
  return (
    <span className={compact ? 'player-name compact' : 'player-name'}>
      <span className="player-name-text">{leftName} · {rightName}</span>
      {nicks.length > 0 ? <span className="nick">{nicks.join(' · ')}</span> : null}
    </span>
  )
}
