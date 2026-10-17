// Calls to the admin API (/api/admin/...). The browser sends the session
// cookie by itself (it is HttpOnly: this code can never read it), and it
// adds the Origin header to every change, which the server checks.
import { ApiError, apiFetch, type ApiInit } from '../../lib/api'
import type {
  Admin,
  AdminOrder,
  BlockedPhone,
  CallListRow,
  Dashboard,
  OrderPage,
  OrderReturn,
  OrderStatus,
} from './types'

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

// ---------- Orders ----------

export const getDashboard = () => adminFetch<Dashboard>('/dashboard')

export function getOrders(params: { status?: string; q?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.q) query.set('q', params.q)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  const qs = query.toString()
  return adminFetch<OrderPage>('/orders' + (qs ? `?${qs}` : ''))
}

export const getCallList = () =>
  adminFetch<{ orders: CallListRow[]; codConfirmHours: number }>('/orders/call-list')

export type AdminOrderAnswer = { order: AdminOrder; returns: OrderReturn[] }

export const getAdminOrder = (number: string) => adminFetch<AdminOrderAnswer>(`/orders/${encodeURIComponent(number)}`)

export type MoveRequest = { to: OrderStatus; reason?: string; courierName?: string; trackingCode?: string }

export const moveOrder = (number: string, body: MoveRequest) =>
  adminPost<AdminOrderAnswer>(`/orders/${encodeURIComponent(number)}/status`, body)

export const saveOrderNote = (number: string, note: string) =>
  adminFetch<AdminOrderAnswer>(`/orders/${encodeURIComponent(number)}/note`, { method: 'PUT', body: { note } })

// ---------- Blocked phones ----------

export const getBlockedPhones = () => adminFetch<{ phones: BlockedPhone[] }>('/blocked-phones').then((d) => d.phones)

export const blockPhone = (phone: string, reason: string) =>
  adminPost<{ phones: BlockedPhone[] }>('/blocked-phones', { phone, reason }).then((d) => d.phones)

export const unblockPhone = (phone: string) =>
  adminPost<{ phones: BlockedPhone[] }>('/blocked-phones/unblock', { phone }).then((d) => d.phones)
