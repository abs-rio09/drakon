// The shapes the admin API sends (api/internal/httpapi/admin_*.go).
// Money is whole paisa; format it only with formatTaka().

export type Admin = {
  id: number
  email: string
  role: 'OWNER'
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export type MoneyCount = { orders: number; totalPaisa: number }

// GET /api/admin/dashboard
export type Dashboard = {
  counts: Record<OrderStatus, number>
  placedToday: MoneyCount
  deliveredToday: MoneyCount
  deliveredLast7Days: MoneyCount
  currency: string
}

// One row of GET /api/admin/orders
export type AdminOrderRow = {
  orderNumber: string
  status: OrderStatus
  name: string
  phone: string
  district: string
  districtArea: string | null
  zoneCode: string
  itemCount: number
  totalPaisa: number
  currency: string
  placedAt: string
  confirmedAt?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  cancelReason?: string
  courierName?: string
  cancelsAt?: string // PENDING only
}

export type OrderPage = { orders: AdminOrderRow[]; total: number; limit: number; offset: number }

// One row of GET /api/admin/orders/call-list
export type CallListRow = {
  orderNumber: string
  name: string
  phone: string
  district: string
  districtArea: string | null
  zoneCode: string
  itemCount: number
  totalPaisa: number
  currency: string
  placedAt: string
  cancelsAt: string
  minutesLeft: number
}

export type AdminOrderItem = {
  variantId: number
  productId: number
  productSlug: string
  productName: string
  variantLabel: string
  sku: string
  thumb: string
  qty: number
  unitPricePaisa: number
  lineTotalPaisa: number
}

export type AdminStep = {
  from: OrderStatus | null
  to: OrderStatus
  at: string
  by: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
  adminEmail: string | null
  note: string
}

// GET /api/admin/orders/{number}: everything, including personal data.
export type AdminOrder = {
  orderNumber: string
  status: OrderStatus
  placedAt: string
  confirmedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  cancelsAt: string | null
  nextMoves: OrderStatus[]
  customer: { name: string; phone: string; email: string | null }
  delivery: {
    district: string
    districtArea: string | null
    area: string
    address: string
    courierNote: string
    zoneCode: string
  }
  gift: { isGift: boolean; receiverName: string | null; receiverPhone: string | null; note: string; hidePrices: boolean }
  courier: { name: string | null; tracking: string | null }
  items: AdminOrderItem[]
  subtotalPaisa: number
  deliveryPaisa: number
  totalPaisa: number
  currency: string
  paymentMethod: string
  payments: {
    method: string
    amountPaisa: number
    currency: string
    status: 'PENDING' | 'COLLECTED' | 'REFUNDED'
    collectedAt: string | null
    ref: string | null
  }[]
  timeline: AdminStep[]
  adminNote: string
  phoneHistory: Partial<Record<OrderStatus, number>>
  phoneBlocked: boolean
}

export type BlockedPhone = { phone: string; reason: string; blockedAt: string; blockedBy: string | null }

// A return recorded on a delivered order (Phase 6).
export type OrderReturn = { id: number }
