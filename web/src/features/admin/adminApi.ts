// Calls to the admin API (/api/admin/...). The browser sends the session
// cookie by itself (it is HttpOnly: this code can never read it), and it
// adds the Origin header to every change, which the server checks.
import { ApiError, apiFetch, type ApiInit } from '../../lib/api'
import type { Admin } from './types'

// Called when any admin request answers 401 (session ended), so the app
// can go back to the login page. AdminProvider sets it.
let onUnauthorized: () => void = () => {}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export async function adminFetch<T>(path: string, init?: ApiInit): Promise<T> {
  try {
    return await apiFetch<T>('/api/admin' + path, init)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && path !== '/login') onUnauthorized()
    throw err
  }
}

export const adminPost = <T>(path: string, body: unknown = {}) => adminFetch<T>(path, { method: 'POST', body })

// ---------- Login ----------

export const getMe = () => adminFetch<{ admin: Admin }>('/me').then((d) => d.admin)

export const login = (email: string, password: string) =>
  adminPost<{ admin: Admin }>('/login', { email, password }).then((d) => d.admin)

export const logout = () => adminPost<{ ok: boolean }>('/logout')
