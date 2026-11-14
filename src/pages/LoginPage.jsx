import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead'
import { useAuth } from '../context/AuthContext'
import { georgianError } from '../lib/errors'
import { isSupabaseConfigured, siteUrl, supabase } from '../lib/supabase'

export default function LoginPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(() => {
    const stored = sessionStorage.getItem('auth-error')
    if (!stored) return ''
    sessionStorage.removeItem('auth-error')
    return 'შესვლა ვერ მოხერხდა. სცადე თავიდან.'
  })
  const [sending, setSending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    if (!supabase) return
    if (!navigator.onLine) {
      setError('ინტერნეტი არ არის. ბმული ვერ გაიგზავნა.')
      return
    }
    setSending(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: siteUrl() },
    })
    setSending(false)
    if (authError) {
      console.error(authError)
      setError(georgianError(authError))
      return
    }
    setSent(true)
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
          <button className="btn primary big" type="submit" disabled={sending || !isSupabaseConfigured}>
            {sending ? 'იგზავნება…' : 'ბმულის გაგზავნა'}
          </button>
          {sent ? <p className="toast" role="status">შეამოწმე ელფოსტა — შესვლის ბმული იქ გამოგზავნილია.</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
      )}
    </>
  )
}
