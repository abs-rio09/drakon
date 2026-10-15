// Small typed helpers for calling the Go API. Every call goes to /api/...
// on the same site (Vite forwards it to Go in dev, the Worker in production).
import type { Category, DeliveryInfo, Product, PublicSettings, Quote } from './types'

// The API's error shape: {"error":{"code":"UPPER_SNAKE","message":"...","fields":{...}}}
export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string> } }

// Sends one request and returns the JSON answer. Throws ApiError for an
// error answer, and for network problems (code NETWORK).
export async function apiFetch<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK', 'We could not reach the shop. Check your internet connection and try again.')
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Not JSON: for example the Go server is down and the proxy answered.
  }
  if (!res.ok) {
    const e = (data as ErrorBody | null)?.error
    if (e?.code && e.message) throw new ApiError(res.status, e.code, e.message, e.fields ?? {})
    throw new ApiError(res.status, 'UNAVAILABLE', 'The shop is not answering right now. Please try again in a moment.')
  }
  return data as T
}

// ---------- Catalog ----------

export const getCategories = () => apiFetch<{ categories: Category[] }>('/api/categories').then((d) => d.categories)

export type ProductPage = { products: Product[]; total: number; limit: number; offset: number }

export function getProducts(params: { category?: string; q?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.q) query.set('q', params.q)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  const qs = query.toString()
  return apiFetch<ProductPage>('/api/products' + (qs ? `?${qs}` : ''))
}

export const getFeatured = () => apiFetch<{ products: Product[]; hero: Product | null }>('/api/products/featured')

export const getProduct = (slug: string) =>
  apiFetch<{ product: Product; related: Product[] }>(`/api/products/${encodeURIComponent(slug)}`)

export const getSoldOut = () => apiFetch<{ products: Product[] }>('/api/sold-out').then((d) => d.products)

// ---------- Delivery, settings, checkout ----------

export const getDeliveryInfo = () => apiFetch<DeliveryInfo>('/api/delivery/areas')

export const getPublicSettings = () => apiFetch<PublicSettings>('/api/settings/public')

export type QuoteRequest = {
  items: { variantId: number; qty: number }[]
  deliveryAreaId?: number
}

export const postQuote = (body: QuoteRequest, signal?: AbortSignal) =>
  apiFetch<Quote>('/api/checkout/quote', { method: 'POST', body, signal })
