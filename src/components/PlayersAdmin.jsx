import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { georgianError } from '../lib/errors'
import { fetchPlayers, isActive } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { EmptyNote, ErrorNote, Skeleton } from './States'

function sortPlayers(list) {
  return [...list].sort((a, b) => {
    const active = Number(isActive(b)) - Number(isActive(a))
    if (active) return active
    return a.name.localeCompare(b.name, 'ka')
  })
}

export default function PlayersAdmin() {
  const { isAdmin, ready } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [editing, setEditing] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftNick, setDraftNick] = useState('')
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    fetchPlayers()
      .then((list) => {
        if (alive) setPlayers(sortPlayers(list))
      })
      .catch((err) => {
        console.error(err)
        if (alive) setError(georgianError(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tick])

  async function addPlayer(event) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName || !supabase) return
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('players').insert({
      name: nextName,
      nickname: nickname.trim() || null,
    })
    setBusy(false)
    if (insertError) {
      console.error(insertError)
      setError(georgianError(insertError))
      return
    }
    setName('')
    setNickname('')
    setTick((value) => value + 1)
  }

  function startEdit(player) {
    setEditing(player.id)
    setDraftName(player.name)
    setDraftNick(player.nickname || '')
  }

  async function saveEdit(player) {
    const nextName = draftName.trim()
    if (!nextName || !supabase) return
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('players')
      .update({ name: nextName, nickname: draftNick.trim() || null })
      .eq('id', player.id)
    setBusy(false)
    if (updateError) {
      console.error(updateError)
      setError(georgianError(updateError))
      return
    }
    setEditing(null)
    setTick((value) => value + 1)
  }

  async function toggleActive(player) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('players')
      .update({ is_active: !isActive(player) })
      .eq('id', player.id)
    setBusy(false)
    if (updateError) {
      console.error(updateError)
      setError(georgianError(updateError))
      return
    }
    setTick((value) => value + 1)
  }

  return (
    <section className="block">
      <h2>მოთამაშეები</h2>
      {!ready || loading ? <Skeleton rows={3} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {isAdmin ? (
        <form className="stack" onSubmit={addPlayer}>
          <label className="field">
            <span>სახელი</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
          </label>
          <label className="field">
            <span>მეტსახელი</span>
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={80} />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !name.trim()}>დამატება</button>
        </form>
      ) : null}
      {!loading && players.length === 0 ? (
        <EmptyNote>{isSupabaseConfigured ? 'მოთამაშე ჯერ არ არის.' : 'ბაზა ჯერ არ არის მიბმული.'}</EmptyNote>
      ) : null}
      <div className="player-list">
        {players.map((player) => (
          <article key={player.id} className={isActive(player) ? 'player-card' : 'player-card inactive'}>
            {editing === player.id ? (
              <div className="stack">
                <label className="field">
                  <span>სახელი</span>
                  <input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={80} />
                </label>
                <label className="field">
                  <span>მეტსახელი</span>
                  <input value={draftNick} onChange={(event) => setDraftNick(event.target.value)} maxLength={80} />
                </label>
                <div className="btn-row">
                  <button type="button" className="btn primary" disabled={busy || !draftName.trim()} onClick={() => saveEdit(player)}>შენახვა</button>
                  <button type="button" className="btn ghost" onClick={() => setEditing(null)}>გაუქმება</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <strong>{player.name}</strong>
                  {player.nickname ? <small>{player.nickname}</small> : null}
                  {!isActive(player) ? <em>არააქტიური</em> : null}
                </div>
                {isAdmin ? (
                  <div className="btn-row">
                    <button type="button" className="btn ghost" onClick={() => startEdit(player)}>სახელის შეცვლა</button>
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => toggleActive(player)}>
                      {isActive(player) ? 'გათიშვა' : 'გააქტიურება'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
