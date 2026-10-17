// Calls to the admin API (/api/admin/...). The browser sends the session
// cookie by itself (it is HttpOnly: this code can never read it), and it
// adds the Origin header to every change, which the server checks.
import { ApiError, apiFetch, type ApiInit } from '../../lib/api'
import type {
  Admin,
  AdminCategory,
  AdminOrder,
  AdminProduct,
  AdminProductRow,
  ImageInput,
  ProductInput,
  ProductStatus,
  VariantInput,
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

// ---------- Products ----------

type ProductAnswer = { product: AdminProduct }
const product = (p: Promise<ProductAnswer>) => p.then((d) => d.product)

export function getAdminProducts(params: { status?: string; category?: string; q?: string }) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.category) query.set('category', params.category)
  if (params.q) query.set('q', params.q)
  const qs = query.toString()
  return adminFetch<{ products: AdminProductRow[]; counts: Record<ProductStatus, number> }>('/products' + (qs ? `?${qs}` : ''))
}

export const getAdminProduct = (id: number) => product(adminFetch(`/products/${id}`))
export const createProduct = (body: ProductInput) => product(adminPost('/products', body))
export const updateProduct = (id: number, body: ProductInput) => product(adminFetch(`/products/${id}`, { method: 'PUT', body }))

export const publishProduct = (id: number, prices: { variantId: number; pricePaisa: number }[]) =>
  product(adminPost(`/products/${id}/publish`, { prices }))
export const archiveProduct = (id: number, reason: string) => product(adminPost(`/products/${id}/archive`, { reason }))
export const reactivateProduct = (id: number, reason: string) => product(adminPost(`/products/${id}/reactivate`, { reason }))

export const addVariant = (productId: number, body: VariantInput) => product(adminPost(`/products/${productId}/variants`, body))
export const updateVariant = (id: number, body: VariantInput) => product(adminFetch(`/variants/${id}`, { method: 'PUT', body }))
export const changeStock = (id: number, body: { change: number; reason: 'RESTOCK' | 'ADJUST'; note: string }) =>
  product(adminPost(`/variants/${id}/stock`, body))
export const priceFix = (id: number, body: { pricePaisa: number; reason: string }) => product(adminPost(`/variants/${id}/price-fix`, body))

export const addImage = (productId: number, body: ImageInput) => product(adminPost(`/products/${productId}/images`, body))
export const updateImage = (id: number, body: ImageInput) => product(adminFetch(`/images/${id}`, { method: 'PUT', body }))
export const reorderImages = (productId: number, ids: number[]) =>
  product(adminFetch(`/products/${productId}/images/order`, { method: 'PUT', body: { ids } }))
export const removeImage = (id: number) => product(adminFetch(`/images/${id}`, { method: 'DELETE' }))

// ---------- Categories ----------

export const getAdminCategories = () => adminFetch<{ categories: AdminCategory[] }>('/categories').then((d) => d.categories)
