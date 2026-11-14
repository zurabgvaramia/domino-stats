import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PlayersAdmin from '../components/PlayersAdmin'
import PageHead from '../components/PageHead'
import { useAuth } from '../context/AuthContext'
import { georgianError } from '../lib/errors'
import { roleLabel } from '../lib/format'
import { periodSearchFrom } from '../lib/usePeriod'
import { Skeleton } from '../components/States'

export default function MorePage() {
  const { user, role, roleError, ready, signOut, reloadRole } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.id) reloadRole()
  }, [user?.id, reloadRole])

  async function leave() {
    setBusy(true)
    setError('')
    try {
      await signOut()
    } catch (err) {
      console.error(err)
      setError(georgianError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead title="მეტი" />
      {!ready ? <Skeleton rows={3} /> : (
        <section className="account">
          {user ? (
            <>
              <p className="kicker">შესული ხარ</p>
              <strong>{user.email}</strong>
              <p>როლი: {roleError ? 'ვერ წაიკითხა' : roleLabel(role)}</p>
              {error ? <p className="form-error">{error}</p> : null}
              <button type="button" className="btn ghost" disabled={busy} onClick={leave}>გამოსვლა</button>
            </>
          ) : (
            <>
              <p>სტუმარი ხარ. ცხრილის ნახვა ყველას შეუძლია, ჩაწერა — რედაქტორს და ადმინს.</p>
              <Link className="btn primary" to="/login">შესვლა</Link>
            </>
          )}
        </section>
      )}

      <Link className="menu-link" to={{ pathname: '/specials', search: periodSearchFrom(location.search) }}>
        <span>სუხოი და კოქსი</span>
        <small>ვინ აკეთებს და ვინ იღებს</small>
      </Link>

      <Link className="menu-link" to={{ pathname: '/compare', search: periodSearchFrom(location.search) }}>
        <span>წყვილების შედარება</span>
        <small>ორი წყვილის ბალანსი</small>
      </Link>

      <PlayersAdmin />
    </>
  )
}
