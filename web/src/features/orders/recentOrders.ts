// Orders placed in this browser (docs/blueprint.md, part 2, rule 7): only
// the order number and the secret track token, never a name, phone or
// address. The track page uses them to find the order without typing.

export type RecentOrder = {
  orderNumber: string
  token: string
  placedAt: string // ISO date
}

const STORAGE_KEY = 'drakon.orders.v1'
const MAX_REMEMBERED = 10

export function loadRecentOrders(): RecentOrder[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(isRecentOrder)
  } catch {
    return []
  }
}

export function rememberOrder(order: RecentOrder): void {
  const others = loadRecentOrders().filter((o) => o.orderNumber !== order.orderNumber)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([order, ...others].slice(0, MAX_REMEMBERED)))
  } catch {
    // Private mode or full storage: the buyer still has the number on screen.
  }
}

export function findRecentOrder(orderNumber: string): RecentOrder | undefined {
  return loadRecentOrders().find((o) => o.orderNumber === orderNumber.toUpperCase())
}

function isRecentOrder(value: unknown): value is RecentOrder {
  if (typeof value !== 'object' || value === null) return false
  const o = value as Record<string, unknown>
  return typeof o.orderNumber === 'string' && typeof o.token === 'string' && typeof o.placedAt === 'string'
}
