// The shapes the Go API sends (api/internal/catalog and api/internal/orders).
// Prices are whole paisa (৳1,250 = 125000). Format them only with formatTaka().

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'ARCHIVED'

export type Category = {
  slug: string
  name: string // plural, for menus: "Playcards"
  image: string // material close-up for the collection tile (4:5)
}

export type ProductImage = {
  src: string // full photo, 1:1
  thumb: string // small square crop
  name: string // short name for the thumbnail button: "Back"
  alt: string
}

export type Variant = {
  id: number
  sku: string
  label: string // "M", "Metal", "Standard"
  note: string // one plain line under the label, or ""
  pricePaisa: number
  currency: string
  stock: number
  imageIndex: number | null // which product photo shows this variant
}

export type Product = {
  id: number
  slug: string
  name: string
  categorySlug: string
  kind: string // what it is, singular: "Tech toy", "Collectible card"
  variantKind: string // the name of the choice: "Size", "Material"
  isLimited: boolean
  editionSize: number | null // only when a run has a known size: 100
  status: ProductStatus
  purchaseLimit: number | null // null = settings.defaultPurchaseLimit
  summary: string
  story: string[]
  details: { term: string; text: string }[]
  images: ProductImage[]
  variants: Variant[]
  soldOutAt: string | null // ISO date-time
  successorSlug: string | null // a newer edition that is on sale now
}

// GET /api/settings/public
export type PublicSettings = {
  codConfirmHours: number
  defaultPurchaseLimit: number
  returnDays: number
  lowStockThreshold: number
  giftNoteMaxChars: number
  courierNoteMaxChars: number
  currency: string
}

// GET /api/delivery/areas
export type DeliveryZone = {
  code: string // INSIDE_DHAKA, OUTSIDE_DHAKA
  name: string
  chargePaisa: number
  freeOverPaisa: number | null
  currency: string
}

export type DeliveryArea = {
  id: number
  label: string // "Dhaka city", or the district name
  hint: string
  zoneCode: string
}

export type District = {
  name: string
  // One area = no question. More than one (Dhaka) = the buyer chooses.
  areas: DeliveryArea[]
}

export type DeliveryInfo = {
  zones: DeliveryZone[]
  districts: District[]
  freeDeliveryEnabled: boolean
}

// POST /api/checkout/quote
export type ProblemCode = 'UNKNOWN_VARIANT' | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK' | 'OVER_LIMIT'

export type Problem = {
  variantId: number
  code: ProblemCode
  message: string
}

export type QuoteItem = {
  variantId: number
  productId: number
  productSlug: string
  productName: string
  variantName: string // "Size M", "Metal"
  thumb: string
  unitPricePaisa: number
  qty: number
  lineTotalPaisa: number
  stock: number
  maxQty: number
  problem: Problem | null
  currency: string
}

export type QuoteDelivery = {
  areaId: number
  district: string
  areaLabel: string
  zoneCode: string
  chargePaisa: number
  freeDelivery: boolean
}

export type Quote = {
  items: QuoteItem[]
  problems: Problem[]
  subtotalPaisa: number
  delivery: QuoteDelivery | null
  totalPaisa: number | null
  currency: string
}

// POST /api/orders and POST /api/orders/track. No name, phone or address:
// the track answer only describes the order itself.
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export type OrderView = {
  orderNumber: string
  status: OrderStatus
  placedAt: string
  items: { productName: string; variantName: string; qty: number; unitPricePaisa: number; lineTotalPaisa: number }[]
  subtotalPaisa: number
  deliveryPaisa: number
  totalPaisa: number
  currency: string
  paymentMethod: 'COD'
  zoneCode: string
  isGift: boolean
  timeline: { status: OrderStatus; at: string; by: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'; note: string }[]
  canCancel: boolean
  cancelReason: string | null
  codConfirmHours: number
  confirmBy: string | null
}

export type PlacedOrder = {
  orderNumber: string
  trackToken: string // secret, shown once; this browser keeps it to find the order again
  order: OrderView
}
