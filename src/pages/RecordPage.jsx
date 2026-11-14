import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applyPendingUpdate, setRecordDirty, subscribeUpdate } from '../lib/appUpdate'
import { groupByDay, startOfToday, startOfTomorrow, todayInputValue } from '../lib/dates'
import { georgianError } from '../lib/errors'
import { lineupKey, pairKey, WIN_HINT, WIN_TYPES } from '../lib/format'
import { fetchPlayers, indexPlayers, isActive } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import MatchLine from '../components/MatchLine'
import PageHead from '../components/PageHead'
import { PairName, PlayerName } from '../components/PlayerName'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'

function TeamBlock({ title, side, slots, players, otherIds, byId, onToggle, onClear }) {
  return (
    <section className={`team team-${side}`}>
      <h2>{title}</h2>
      <div className="slots">
        {slots.map((id, index) => (
          <button
            key={`${side}-${index}`}
            type="button"
            className={id ? 'slot' : 'slot empty'}
            onClick={() => id && onClear(index)}
          >
            {id ? <PlayerName id={id} byId={byId} compact /> : 'ცარიელი'}
          </button>
        ))}
      </div>
      <div className="chips">
        {players.map((player) => {
          const selected = slots.includes(player.id)
          const blocked = otherIds.includes(player.id)
          return (
            <button
              key={player.id}
              type="button"
              className={selected ? 'chip on' : 'chip'}
              aria-pressed={selected}
              disabled={blocked}
              onClick={() => onToggle(player.id)}
            >
              <PlayerName player={player} compact />
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function RecordPage() {
  const { canWrite, ready, user } = useAuth()
  const [players, setPlayers] = useState([])
  const [teamA, setTeamA] = useState([null, null])
  const [teamB, setTeamB] = useState([null, null])
  const [winner, setWinner] = useState(null)
  const [winType, setWinType] = useState('regular')
  const [note, setNote] = useState('')
  const [today, setToday] = useState([])
  const [lastMatch, setLastMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [updateWaiting, setUpdateWaiting] = useState(false)
  const formDirty = teamA.some(Boolean) || teamB.some(Boolean) || winner != null

  const byId = useMemo(() => indexPlayers(players), [players])

  useEffect(() => subscribeUpdate(setUpdateWaiting), [])

  useEffect(() => {
    setRecordDirty(formDirty)
  }, [formDirty])

  useEffect(() => () => setRecordDirty(false), [])

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(''), 2500)
    return () => clearTimeout(timer)
  }, [message])

  async function loadBoard() {
    const [list, recent, todays] = await Promise.all([
      fetchPlayers(),
      supabase
        .from('matches')
        .select('*')
        .eq('is_void', false)
        .order('played_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('matches')
        .select('*')
        .gte('played_at', startOfToday().toISOString())
        .lt('played_at', startOfTomorrow().toISOString())
        .order('played_at', { ascending: false }),
    ])
    if (recent.error) throw recent.error
    if (todays.error) throw todays.error
    setPlayers(list)
    setLastMatch(recent.data)
    setToday(todays.data ?? [])
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !canWrite) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    loadBoard()
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
  }, [canWrite])

  function toggle(side, id) {
    const current = side === 'A' ? teamA : teamB
    const setCurrent = side === 'A' ? setTeamA : setTeamB
    setError('')
    setWinner(null)
    if (current.includes(id)) {
      setCurrent(current.map((slot) => (slot === id ? null : slot)))
      return
    }
    const empty = current.findIndex((slot) => !slot)
    if (empty === -1) return
    const next = [...current]
    next[empty] = id
    setCurrent(next)
  }

  function clearSlot(side, index) {
    const setCurrent = side === 'A' ? setTeamA : setTeamB
    const current = side === 'A' ? teamA : teamB
    const next = [...current]
    next[index] = null
    setCurrent(next)
    setWinner(null)
  }

  const ids = [...teamA, ...teamB]
  const complete = ids.every(Boolean) && new Set(ids).size === 4
  const selected = new Set(ids.filter(Boolean))
  const chipPlayers = players.filter((player) => isActive(player) || selected.has(player.id))

  const score = useMemo(() => {
    if (!complete) return null
    const key = lineupKey(teamA[0], teamA[1], teamB[0], teamB[1])
    const aPair = pairKey(teamA[0], teamA[1])
    let a = 0
    let b = 0
    for (const match of today) {
      if (match.is_void) continue
      if (lineupKey(match.a1, match.a2, match.b1, match.b2) !== key) continue
      const winnerPair = match.winner === 'A' ? pairKey(match.a1, match.a2) : pairKey(match.b1, match.b2)
      const stake = Number(match.points)
      const gained = Number.isFinite(stake) ? stake : 0
      if (winnerPair === aPair) a += gained
      else b += gained
    }
    return { a, b }
  }, [complete, teamA, teamB, today])

  function repeatLast() {
    if (!lastMatch) return
    setTeamA([lastMatch.a1, lastMatch.a2])
    setTeamB([lastMatch.b1, lastMatch.b2])
    setWinner(null)
    setWinType('regular')
    setNote('')
    setError('')
  }

  function swapTeams() {
    setTeamA(teamB)
    setTeamB(teamA)
    setWinner((current) => (current === 'A' ? 'B' : current === 'B' ? 'A' : null))
  }

  async function save() {
    if (!complete || !winner) return
    if (!navigator.onLine) {
      setError('ინტერნეტი არ არის. პარტია არ შეინახა.')
      setMessage('')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    const { error: insertError } = await supabase.from('matches').insert({
      a1: teamA[0],
      a2: teamA[1],
      b1: teamB[0],
      b2: teamB[1],
      winner,
      win_type: winType,
      note: note.trim() || null,
    })
    setSaving(false)
    if (insertError) {
      console.error(insertError)
      setError(georgianError(insertError, { save: true }))
      return
    }
    setWinner(null)
    setWinType('regular')
    setNote('')
    setMessage('შეინახა')
    try {
      await loadBoard()
    } catch (err) {
      console.error(err)
    }
    applyPendingUpdate()
  }

  if (!ready) {
    return (
      <>
        <PageHead title="ჩაწერა" />
        <Skeleton rows={5} />
      </>
    )
  }

  if (!canWrite) {
    return (
      <>
        <PageHead title="ჩაწერა" kicker="მხოლოდ რედაქტორს და ადმინს" />
        <div className="gate">
          {user ? (
            <p>შესული ხარ, მაგრამ ჩაწერის უფლება არ გაქვს. ადმინს სთხოვე რედაქტორის როლი.</p>
          ) : (
            <p>პარტიის ჩასაწერად შედი ანგარიშით.</p>
          )}
          {!user ? <Link className="btn primary" to="/login">შესვლა</Link> : null}
          <Link className="btn ghost" to="/table">ცხრილის ნახვა</Link>
        </div>
      </>
    )
  }

  const groups = groupByDay(today)

  return (
    <div className="record-page">
      {updateWaiting ? (
        <p className="update-banner" role="status">ახალი ვერსიაა — შენახვის შემდეგ განახლდება</p>
      ) : null}
      <PageHead title="ჩაწერა" />
      {loading ? <Skeleton rows={3} /> : null}
      {error && !complete ? <ErrorNote message={error} /> : null}
      <div className="row-actions">
        <button type="button" className="btn ghost" onClick={repeatLast} disabled={!lastMatch}>
          ბოლო შემადგენლობის გამეორება
        </button>
        <button type="button" className="btn ghost" onClick={swapTeams} disabled={!teamA.some(Boolean) && !teamB.some(Boolean)}>
          გუნდების გადაცვლა
        </button>
      </div>

      {!loading && chipPlayers.length === 0 ? (
        <EmptyNote>აქტიური მოთამაშე არ არის. ადმინმა „მეტი“ გვერდიდან დაამატოს.</EmptyNote>
      ) : null}

      <TeamBlock
        title="გუნდი A"
        side="a"
        slots={teamA}
        players={chipPlayers}
        otherIds={teamB}
        byId={byId}
        onToggle={(id) => toggle('A', id)}
        onClear={(index) => clearSlot('A', index)}
      />
      <TeamBlock
        title="გუნდი B"
        side="b"
        slots={teamB}
        players={chipPlayers}
        otherIds={teamA}
        byId={byId}
        onToggle={(id) => toggle('B', id)}
        onClear={(index) => clearSlot('B', index)}
      />

      {score ? (
        <div className="scoreboard" aria-live="polite">
          <div>
            <PairName a={teamA[0]} b={teamA[1]} byId={byId} />
            <span>გუნდი A</span>
          </div>
          <div className="score-num">A {score.a} : {score.b} B</div>
          <div>
            <PairName a={teamB[0]} b={teamB[1]} byId={byId} />
            <span>გუნდი B</span>
          </div>
        </div>
      ) : null}

      <section className="block">
        <h2>ვინ მოიგო?</h2>
        <div className="winner-grid">
          {['A', 'B'].map((side) => {
            const slots = side === 'A' ? teamA : teamB
            const ready = slots.every(Boolean)
            return (
              <button
                key={side}
                type="button"
                className={winner === side ? `winner on side-${side}` : `winner side-${side}`}
                aria-pressed={winner === side}
                disabled={!complete}
                onClick={() => { setWinner(side); setError('') }}
              >
                {ready ? <PairName a={slots[0]} b={slots[1]} byId={byId} compact /> : `გუნდი ${side}`}
              </button>
            )
          })}
        </div>
      </section>

      <section className="block">
        <h2>მოგების ტიპი</h2>
        <div className="win-types">
          {WIN_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={winType === type.id ? 'on' : ''}
              aria-pressed={winType === type.id}
              onClick={() => setWinType(type.id)}
            >
              {`${type.label} (${type.points})`}
            </button>
          ))}
        </div>
        <p className="hint">{WIN_HINT}</p>
      </section>

      <label className="field">
        <span>შენიშვნა</span>
        <textarea
          rows="2"
          maxLength="500"
          placeholder="არასავალდებულო"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {message ? <p className="toast" role="status">{message}</p> : null}
      {error && complete ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="save-region">
        <div className="save-bar">
          <button type="button" className="btn primary big" disabled={!complete || !winner || saving} onClick={save}>
            {saving ? 'ინახება…' : 'შენახვა'}
          </button>
        </div>

        <section className="block">
          <div className="section-head">
            <h2>დღეს</h2>
            <Link to={`/days/${todayInputValue()}`}>დღის შეჯამება →</Link>
          </div>
          {groups.length === 0 ? <EmptyNote>დღეს პარტია ჯერ არ ჩაწერილა.</EmptyNote> : null}
          {groups.map((group) => (
            <div key={group.key} className="day-group">
              {group.items.map((match) => (
                <MatchLine key={match.id} match={match} byId={byId} />
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
