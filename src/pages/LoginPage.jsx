import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHead from '../components/PageHead'
import { useAuth } from '../context/AuthContext'
import { georgianError } from '../lib/errors'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function loginError(error) {
  const message = String(error?.message || error || '')
  if (message.includes('Invalid login credentials')) return 'ელფოსტა ან პაროლი არასწორია.'
  return georgianError(error)
}

export default function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        console.error(authError)
        setError(loginError(authError))
        return
      }
      navigate('/')
    } catch (err) {
      console.error(err)
      setError(loginError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead title="შესვლა">
        <Link className="back" to="/more">უკან</Link>
      </PageHead>
      {user ? (
        <div className="gate">
          <p>უკვე შესული ხარ როგორც {user.email}.</p>
          <Link className="btn primary" to="/more">ანგარიში</Link>
        </div>
      ) : (
        <>
          <form className="stack" onSubmit={onSubmit}>
            {!isSupabaseConfigured ? <p className="form-error">ბაზა ჯერ არ არის მიბმული.</p> : null}
            <label className="field">
              <span>ელფოსტა</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@email.com"
              />
            </label>
            <label className="field">
              <span>პაროლი</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setShowPassword((open) => !open)}
            >
              {showPassword ? 'დამალვა' : 'ჩვენება'}
            </button>
            <button className="btn primary big" type="submit" disabled={busy || !isSupabaseConfigured}>
              {busy ? 'შესვლა…' : 'შესვლა'}
            </button>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </form>
          <p className="hint">ანგარიშს ადმინი ქმნის. პაროლი თუ დაგავიწყდა, ადმინს მიმართე.</p>
        </>
      )}
    </>
  )
}
