import { findVariant, isArchived, maxQuantity } from '../../lib/catalog'
import type { Product, Variant } from '../../mocks/catalog'
import type { CartLine } from './cartStorage'

export type CartItem = {
  product: Product
  variant: Variant
  qty: number
  max: number // the most this line may hold
  linePaisa: number
}

// Joins the stored lines (id + qty) with the catalogue (name, price, stock).
// Lines whose product is gone or sold out are returned separately, so the
// cart can say so instead of hiding them. Display only: the server re-prices.
export function resolveCart(lines: CartLine[]): { items: CartItem[]; unavailable: CartLine[] } {
  const items: CartItem[] = []
  const unavailable: CartLine[] = []
  for (const line of lines) {
    const found = findVariant(line.variantId)
    if (!found || isArchived(found.product) || found.variant.stock === 0) {
      unavailable.push(line)
      continue
    }
    const max = maxQuantity(found.product, found.variant)
    const qty = Math.min(line.qty, max)
    items.push({ ...found, qty, max, linePaisa: found.variant.pricePaisa * qty })
  }
  return { items, unavailable }
}

export function subtotalPaisa(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.linePaisa, 0)
}
