import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MatchLine from '../components/MatchLine'
import PageHead from '../components/PageHead'
import PeriodPicker from '../components/PeriodPicker'
import { PairName } from '../components/PlayerName'
import Sheet from '../components/Sheet'
import { EmptyNote, ErrorNote, Skeleton } from '../components/States'
import { useAuth } from '../context/AuthContext'
import { auditLines, auditTitle, auditWhen } from '../lib/audit'
import { formatDateTime, groupByDay } from '../lib/dates'
import { georgianError } from '../lib/errors'
import { toId, WIN_HINT, WIN_TYPES } from '../lib/format'
import { fetchPlayers, indexPlayers } from '../lib/players'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePeriod } from '../lib/usePeriod'

const PAGE = 30

function draftFrom(match) {
  return {
    a1: toId(match.a1),
    a2: toId(match.a2),
    b1: toId(match.b1),
    b2: toId(match.b2),
    winner: match.winner,
    win_type: match.win_type || 'regular',
    note: match.note || '',
  }
}

function PlayerSelect({ label, value, onChange, players, taken }) {
  const current = toId(value)
  return (
    <label className="field">
      <span>{label}</span>
      <select value={current ?? ''} onChange={(event) => onChange(toId(event.target.value))}>
        <option value="">აირჩიე</option>
        {players.map((player) => {
          const id = toId(player.id)
          return (
            <option key={player.id} value={id ?? ''} disabled={id != null && taken.has(id) && id !== current}>
              {player.name}{player.is_active === false ? ' (არააქტიური)' : ''}
            </option>
          )
        })}
      </select>
    </label>
  )
}

export default function MatchesPage() {
  const period = usePeriod()
  const { canWrite } = useAuth()
  const [params, setParams] = useSearchParams()
  const playerId = toId(params.get('player'))
  const [players, setPlayers] = useState([])
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editing, setEditing] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [audit, setAudit] = useState({ loading: false, error: false, rows: [] })

  const byId = useMemo(() => indexPlayers(players), [players])

  const setPlayer = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('player', id)
    else next.delete('player')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!supabase) return undefined
    let alive = true
    fetchPlayers()
      .then((list) => {
        if (alive) setPlayers(list)
      })
      .catch((err) => console.error(err))
    return () => {
      alive = false
    }
  }, [])

  const loadPage = useCallback((offset) => {
    let query = supabase.from('matches').select('*', { count: 'exact' }).order('played_at', { ascending: false })
    if (period.fromIso) query = query.gte('played_at', period.fromIso)
    if (period.toIso) query = query.lt('played_at', period.toIso)
    if (playerId) query = query.or(`a1.eq.${playerId},a2.eq.${playerId},b1.eq.${playerId},b2.eq.${playerId}`)
    return query.range(offset, offset + PAGE - 1).then(({ data, error: queryError, count }) => {
      if (queryError) throw queryError
      return { data: data ?? [], count: count ?? 0 }
    })
  }, [period.fromIso, period.toIso, playerId])

  useEffect(() => {
    if (!supabase || period.customIncomplete) {
      setLoading(false)
      setRows([])
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    setRows([])
    loadPage(0)
      .then(({ data, count }) => {
        if (!alive) return
        setRows(data)
        setTotal(count)
      })
      .catch((err) => {
        console.error(err)
        if (!alive) return
        setError(georgianError(err))
        setRows([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [loadPage, period.customIncomplete, tick])

  const selectedId = toId(selected?.id)
  useEffect(() => {
    if (!selectedId || !canWrite || !supabase) return undefined
    let alive = true
    setAudit({ loading: true, error: false, rows: [] })
    supabase
      .rpc('match_history', { p_match: selectedId })
      .then(({ data, error: auditError }) => {
        if (!alive) return
        if (auditError) {
          console.error(auditError)
          setAudit({ loading: false, error: true, rows: [] })
          return
        }
        setAudit({ loading: false, error: false, rows: data ?? [] })
      })
    return () => {
      alive = false
    }
  }, [selectedId, canWrite, saving])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const { data, count } = await loadPage(rows.length)
      setRows((current) => [...current, ...data])
      setTotal(count)
    } catch (err) {
      console.error(err)
      setError(georgianError(err))
    } finally {
      setLoadingMore(false)
    }
  }

  function openMatch(match) {
    setSelected(match)
    setDraft(draftFrom(match))
    setEditing(false)
    setConfirmVoid(false)
    setSheetError('')
  }

  const closeSheet = useCallback(() => {
    setSelected(null)
    setEditing(false)
    setConfirmVoid(false)
    setSheetError('')
  }, [])

  function patchMatch(id, patch) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setSelected((row) => (row && row.id === id ? { ...row, ...patch } : row))
  }

  async function saveEdit() {
    if (!draft || !selected) return
    const matchId = toId(selected.id)
    const ids = [draft.a1, draft.a2, draft.b1, draft.b2].map((id) => toId(id))
    if (!matchId || ids.some((id) => !id) || new Set(ids).size !== 4 || !draft.winner) {
      setSheetError('აირჩიე 4 სხვადასხვა მოთამაშე და გამარჯვებული.')
      return
    }
    if (!navigator.onLine) {
      setSheetError('ინტერნეტი არ არის. პარტია არ შეინახა.')
      return
    }
    setSaving(true)
    setSheetError('')
    const patch = {
      a1: ids[0],
      a2: ids[1],
      b1: ids[2],
      b2: ids[3],
      winner: draft.winner,
      win_type: draft.win_type,
      note: draft.note.trim() || null,
    }
    const { error: updateError } = await supabase.from('matches').update(patch).eq('id', matchId)
    setSaving(false)
    if (updateError) {
      console.error(updateError)
      setSheetError(georgianError(updateError, { save: true }))
      return
    }
    patchMatch(matchId, patch)
    setEditing(false)
  }

  async function setVoid(isVoid) {
    const matchId = toId(selected?.id)
    if (!matchId) return
    if (!navigator.onLine) {
      setSheetError('ინტერნეტი არ არის. ცვლილება არ შეინახა.')
      return
    }
    setSaving(true)
    setSheetError('')
    const { error: updateError } = await supabase.from('matches').update({ is_void: isVoid }).eq('id', matchId)
    setSaving(false)
    if (updateError) {
      console.error(updateError)
      setSheetError(georgianError(updateError))
      return
    }
    patchMatch(matchId, { is_void: isVoid })
    setConfirmVoid(false)
  }

  const groups = groupByDay(rows)
  const taken = new Set([draft?.a1, draft?.a2, draft?.b1, draft?.b2].map((id) => toId(id)).filter(Boolean))

  return (
    <>
      <PageHead title="პარტიები" />
      <PeriodPicker
        period={period.period}
        from={period.from}
        to={period.to}
        onPeriod={period.setPeriod}
        onDate={period.setCustomDate}
      />
      <label className="field">
        <span>მოთამაშე</span>
        <select value={playerId ?? ''} onChange={(event) => setPlayer(event.target.value)}>
          <option value="">ყველა</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>{player.name}</option>
          ))}
        </select>
      </label>
      {!isSupabaseConfigured ? <EmptyNote>ბაზა ჯერ არ არის მიბმული.</EmptyNote> : null}
      {period.customIncomplete ? <EmptyNote>აირჩიე თარიღიდან და თარიღამდე.</EmptyNote> : null}
      {loading && isSupabaseConfigured ? <Skeleton rows={5} /> : null}
      {error ? <ErrorNote message={error} onRetry={() => setTick((value) => value + 1)} /> : null}
      {!loading && !error && isSupabaseConfigured && !period.customIncomplete && rows.length === 0 ? (
        <EmptyNote>პარტიები ვერ მოიძებნა.</EmptyNote>
      ) : null}
      {!loading && !error ? groups.map((group) => (
        <section key={group.key} className="day-group">
          <h2 className="day-label"><Link to={`/days/${group.key}`}>{group.label}</Link></h2>
          <div className="match-list">
            {group.items.map((match) => (
              <MatchLine key={match.id} match={match} byId={byId} onClick={() => openMatch(match)} />
            ))}
          </div>
        </section>
      )) : null}
      {!loading && rows.length < total ? (
        <button type="button" className="btn ghost block" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'იტვირთება…' : 'მეტის ჩატვირთვა'}
        </button>
      ) : null}

      {selected && draft ? (
        <Sheet title="პარტია" onClose={closeSheet}>
          <p className="hint">{formatDateTime(selected.played_at)}</p>
          {!editing ? <MatchLine match={selected} byId={byId} /> : null}
          {editing ? (
            <div className="stack">
              <PlayerSelect label="გუნდი A · 1" value={draft.a1} players={players} taken={taken} onChange={(a1) => setDraft({ ...draft, a1 })} />
              <PlayerSelect label="გუნდი A · 2" value={draft.a2} players={players} taken={taken} onChange={(a2) => setDraft({ ...draft, a2 })} />
              <PlayerSelect label="გუნდი B · 1" value={draft.b1} players={players} taken={taken} onChange={(b1) => setDraft({ ...draft, b1 })} />
              <PlayerSelect label="გუნდი B · 2" value={draft.b2} players={players} taken={taken} onChange={(b2) => setDraft({ ...draft, b2 })} />
              <div className="winner-grid">
                {['A', 'B'].map((side) => {
                  const slots = side === 'A' ? [draft.a1, draft.a2] : [draft.b1, draft.b2]
                  const ready = slots.every((id) => toId(id))
                  return (
                    <button
                      key={side}
                      type="button"
                      className={draft.winner === side ? 'winner on' : 'winner'}
                      onClick={() => setDraft({ ...draft, winner: side })}
                    >
                      {ready ? <PairName a={slots[0]} b={slots[1]} byId={byId} compact /> : `გუნდი ${side}`}
                    </button>
                  )
                })}
              </div>
              <div className="win-types">
                {WIN_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={draft.win_type === type.id ? 'on' : ''}
                    onClick={() => setDraft({ ...draft, win_type: type.id })}
                  >
                    {`${type.label} (${type.points})`}
                  </button>
                ))}
              </div>
              <p className="hint">{WIN_HINT}</p>
              <label className="field">
                <span>შენიშვნა</span>
                <textarea rows="2" maxLength="500" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
              </label>
              <button type="button" className="btn primary" disabled={saving} onClick={saveEdit}>შენახვა</button>
            </div>
          ) : null}
          {sheetError ? <p className="form-error" role="alert">{sheetError}</p> : null}
          {canWrite ? (
            <div className="btn-row">
              {!editing ? <button type="button" className="btn ghost" onClick={() => setEditing(true)}>შეცვლა</button> : null}
              {selected.is_void ? (
                <button type="button" className="btn ghost" disabled={saving} onClick={() => setVoid(false)}>აღდგენა</button>
              ) : confirmVoid ? (
                <button type="button" className="btn danger" disabled={saving} onClick={() => setVoid(true)}>დიახ, გაუქმდეს</button>
              ) : (
                <button type="button" className="btn danger" onClick={() => setConfirmVoid(true)}>გაუქმება</button>
              )}
            </div>
          ) : null}
          {canWrite ? (
            <section className="block">
              <h2>ცვლილებები</h2>
              {audit.loading ? <Skeleton rows={2} /> : null}
              {audit.error ? <p className="empty">ისტორია ვერ ჩაიტვირთა.</p> : null}
              {!audit.loading && !audit.error && audit.rows.length === 0 ? <p className="empty">ისტორია ჯერ არ არის.</p> : null}
              <ul className="audit-list">
                {audit.rows.map((row, index) => (
                  <li key={row.id || index}>
                    <strong>{auditTitle(row)}</strong>
                    <span>{row.changed_by_name || '—'}</span>
                    <span>{formatDateTime(auditWhen(row))}</span>
                    {auditLines(row, byId).map((line, lineIndex) => <small key={`${row.id}-${lineIndex}`}>{line}</small>)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Sheet>
      ) : null}
    </>
  )
}
