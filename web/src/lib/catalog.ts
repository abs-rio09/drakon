// Turns product data from the API into the words the UI shows.
// Pure functions: the data and the settings come in as arguments.
import { formatTaka } from './money'
import type { Product, PublicSettings, Variant } from './types'

// ---------- Facts shown in gallery labels ----------

export function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0)
}

export function isArchived(product: Product): boolean {
  return product.status === 'SOLD_OUT' || product.status === 'ARCHIVED'
}

export function purchaseLimit(product: Product, settings: PublicSettings): number {
  return product.purchaseLimit ?? settings.defaultPurchaseLimit
}

// "Collectible card, limited run of 100" / "Sports toy, restocks"
export function metaLine(product: Product): string {
  if (!product.isLimited) return `${product.kind}, restocks`
  if (product.editionSize) return `${product.kind}, limited run of ${product.editionSize}`
  return `${product.kind}, limited run`
}

// "৳2,450", or "From ৳450" when variants have different prices.
export function priceLabel(product: Product): string {
  const prices = product.variants.map((v) => v.pricePaisa)
  if (prices.length === 0) return ''
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatTaka(min) : `From ${formatTaka(min)}`
}

// One stock fact, true to the data: "38 of 100 left", "Only 3 left", "Sold out".
export function stockFact(product: Product, settings: PublicSettings): string {
  const left = totalStock(product)
  if (left === 0) return product.isLimited ? 'Sold out' : 'Out of stock'
  if (left <= settings.lowStockThreshold) return `Only ${left} left`
  if (product.editionSize) return `${left} of ${product.editionSize} left`
  if (!product.isLimited) return 'In stock'
  return `${left} left`
}

// The same fact for one variant: "Only 3 left", "9 left", "Sold out".
export function variantStockFact(product: Product, variant: Variant, settings: PublicSettings): string {
  if (variant.stock === 0) return product.isLimited ? 'Sold out' : 'Out of stock'
  if (variant.stock <= settings.lowStockThreshold) return `Only ${variant.stock} left`
  if (!product.isLimited) return 'In stock'
  return `${variant.stock} left`
}

// How many of one variant a buyer may have in the cart: the purchase limit
// or the stock, whichever is lower. The server checks this again at checkout.
export function maxQuantity(product: Product, variant: Variant, settings: PublicSettings): number {
  return Math.min(purchaseLimit(product, settings), variant.stock)
}

// How a variant is named in the cart and summaries: "Size M", "Metal", "Standard".
// The Go server uses the same rule (orders.VariantName) for order snapshots.
export function variantName(product: Product, variant: Variant): string {
  if (product.variantKind === 'Size') return `Size ${variant.label}`
  return variant.label
}
