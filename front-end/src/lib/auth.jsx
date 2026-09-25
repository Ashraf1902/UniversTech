import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LOGIN_PATHS, LOGOUT_PATHS, clearSession, getSession, refreshCsrf, request, setSession } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession())

  useEffect(() => {
    const onUnauthorized = () => setSessionState(null)
    window.addEventListener('ut:unauthorized', onUnauthorized)
    return () => window.removeEventListener('ut:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (role, email, password) => {
    const data = await request(LOGIN_PATHS[role], {
      method: 'POST',
      data: { email, password },
    })
    const next = {
      role,
      user: data.user || {},
    }
    setSession(next)
    setSessionState(next)
    await refreshCsrf()
    return next
  }, [])

  const logout = useCallback(async () => {
    const current = getSession()
    if (current) {
      try {
        await request(LOGOUT_PATHS[current.role], { method: current.role === 'student' ? 'GET' : 'POST' })
      } catch {
        /* still clear locally */
      }
    }
    clearSession()
    setSessionState(null)
    await refreshCsrf()
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      role: session?.role || null,
      isAuthed: Boolean(session?.role),
      login,
      logout,
      setProfile: (extra) => {
        const updated = { ...session, user: { ...(session?.user || {}), ...extra } }
        setSession(updated)
        setSessionState(updated)
      },
    }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}