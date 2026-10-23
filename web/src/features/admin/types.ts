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
  id: number // the order line (returns point to it)
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
  returnedQty: number
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
  returnUntil: string | null // DELIVERED only: the last moment for a return
  refundedPaisa: number
}

export type BlockedPhone = { phone: string; reason: string; blockedAt: string; blockedBy: string | null }

export type RefundMethod = 'BKASH' | 'NAGAD' | 'CASH'

// A return recorded on a delivered order (blueprint rule 3).
export type OrderReturn = {
  id: number
  reasonType: 'COMPANY_FAULT' | 'OTHER'
  note: string
  deliveryPaidBy: 'COMPANY' | 'CUSTOMER'
  refundPaisa: number
  currency: string
  refundMethod: RefundMethod | null
  refundRef: string
  status: 'COMPLETED'
  at: string
  adminEmail: string
  items: { orderItemId: number; productName: string; variantLabel: string; qty: number; resellable: boolean }[]
}

export type ReturnInput = {
  reasonType: 'COMPANY_FAULT' | 'OTHER'
  note: string
  deliveryPaidBy: 'COMPANY' | 'CUSTOMER'
  conditionChecked: boolean
  refundPaisa: number
  refundMethod: RefundMethod | ''
  refundRef: string
  items: { orderItemId: number; qty: number; resellable: boolean }[]
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'ARCHIVED'

// One row of GET /api/admin/products
export type AdminProductRow = {
  id: number
  slug: string
  name: string
  status: ProductStatus
  isLimited: boolean
  categorySlug: string
  categoryName: string
  thumb: string
  variantCount: number
  emptyVariants: number
  totalStock: number
  minPricePaisa: number
  maxPricePaisa: number
  featuredOrder: number | null
  soldOutAt: string | null
  archivedAt: string | null
}

export type AdminImage = { id: number; url: string; thumbUrl: string; shortName: string; alt: string; sortOrder: number }

export type AdminVariant = {
  id: number
  sku: string
  label: string
  note: string
  pricePaisa: number
  currency: string
  stock: number
  imageIndex: number | null
  sortOrder: number
  isActive: boolean
}

export type ProductEvent = {
  type: 'PUBLISH' | 'SOLD_OUT' | 'ARCHIVE' | 'REACTIVATE' | 'PRICE_FIX'
  actor: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
  reason: string
  oldValue: string | null
  newValue: string | null
  adminEmail: string | null
  at: string
}

export type StockMovement = {
  variantId: number
  sku: string
  change: number
  reason: 'ORDER' | 'CANCEL' | 'RETURN' | 'RESTOCK' | 'ADJUST'
  note: string
  orderNumber: string | null
  adminEmail: string | null
  at: string
}

// The form part of a product (POST / PUT /api/admin/products).
export type ProductInput = {
  name: string
  slug: string
  categorySlug: string
  kind: string
  variantKind: string
  isLimited: boolean
  editionSize: number | null
  purchaseLimit: number | null
  summary: string
  story: string[]
  details: { term: string; text: string }[]
  successorSlug: string | null
  featuredOrder: number | null
}

// GET /api/admin/products/{id}
export type AdminProduct = ProductInput & {
  id: number
  categoryName: string
  status: ProductStatus
  soldOutAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  images: AdminImage[]
  variants: AdminVariant[]
  totalStock: number
  events: ProductEvent[]
  movements: StockMovement[]
  publishProblems: string[]
}

export type AdminCategory = {
  id: number
  slug: string
  name: string
  image: string
  sortOrder: number
  isActive: boolean
  productCount: number
}

export type VariantInput = {
  sku: string
  label: string
  note: string
  pricePaisa: number
  imageIndex: number | null
  sortOrder: number
  isActive?: boolean
  reason?: string // a new variant on a live product (saved in the record)
}

export type ImageInput = { url: string; thumbUrl: string; shortName: string; alt: string }

// GET /api/admin/settings
export type SettingRow = {
  key: string
  label: string
  kind: 'int' | 'bool' | 'text'
  min?: number
  max?: number
  unit?: string
  value: number | boolean | string
  description: string
  updatedAt: string
}

export type AdminZone = {
  id: number
  code: string
  name: string
  chargePaisa: number
  freeOverPaisa: number | null
  currency: string
  isActive: boolean
  activeAreas: number
}

export type AdminArea = {
  id: number
  district: string
  label: string
  hint: string
  zoneId: number
  sortOrder: number
  isActive: boolean
}

export type AdminDelivery = { zones: AdminZone[]; areas: AdminArea[]; freeDeliveryEnabled: boolean }
