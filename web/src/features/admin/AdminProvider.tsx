import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LoadError } from '../../components/ui/LoadState'
import { ApiError } from '../../lib/api'
import { clearApiCache } from '../../lib/useApi'
import { AdminContext, type AdminContextValue } from './AdminContext'
import { getMe, logout, setUnauthorizedHandler } from './adminApi'
import type { Admin } from './types'

// Asks the server once "who is logged in?" (GET /api/admin/me) and keeps
// the answer for every admin page. The browser cannot look at the cookie
// itself (HttpOnly), so the server is the only one who knows.
export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined)
  const [checkError, setCheckError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getMe().then(
      (a) => active && setAdmin(a),
      (err: Error) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 401) setAdmin(null)
        else setCheckError(err)
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  // Any 401 later (session ended while working): back to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearApiCache()
      setAdmin(null)
    })
    return () => setUnauthorizedHandler(() => {})
  }, [])

  const logOut = useCallback(async () => {
    try {
      await logout()
    } catch {
      // Already logged out (401) or offline: forget the admin here anyway.
    }
    clearApiCache() // no admin data stays in this tab's memory
    setAdmin(null)
  }, [])

  const value = useMemo<AdminContextValue>(() => ({ admin, loggedIn: setAdmin, logOut }), [admin, logOut])

  if (checkError && admin === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <LoadError
          error={checkError}
          onRetry={() => {
            setCheckError(null)
            setAttempt((n) => n + 1)
          }}
        />
      </div>
    )
  }
  return <AdminContext value={value}>{children}</AdminContext>
}
