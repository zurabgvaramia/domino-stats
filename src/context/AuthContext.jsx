import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function readRole(userId) {
  if (!supabase || !userId) return { role: null, error: null }
  const { data, error } = await supabase
    .from('app_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { role: null, error }
  return { role: data?.role ?? null, error: null }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [roleError, setRoleError] = useState(null)
  const [ready, setReady] = useState(!supabase)

  const loadRole = useCallback(async (userId) => {
    const result = await readRole(userId)
    if (result.error) console.error(result.error)
    setRole(result.role)
    setRoleError((prev) => {
      if (!result.error) return prev ? null : prev
      if (prev?.code === result.error.code && prev?.message === result.error.message) return prev
      return result.error
    })
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      const next = data.session ?? null
      setSession(next)
      setUser(next?.user ?? null)
      loadRole(next?.user?.id).finally(() => {
        if (alive) setReady(true)
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      setTimeout(() => {
        loadRole(next?.user?.id).finally(() => setReady(true))
      }, 0)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadRole])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(() => ({
    session,
    user,
    role,
    roleError,
    ready,
    isAdmin: role === 'admin',
    canWrite: role === 'admin' || role === 'editor',
    signOut,
    reloadRole: () => loadRole(user?.id),
  }), [session, user, role, roleError, ready, signOut, loadRole])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
