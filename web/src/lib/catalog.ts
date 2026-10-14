// Reads the product catalogue and turns it into the words the UI shows.
// Today it reads the mock data; later these functions will call the Go API,
// and the pages that use them will not need to change.
import { categories, featuredSlugs, products, type Product, type Variant } from '../mocks/catalog'
import { settings } from '../mocks/settings'
import { formatTaka } from './money'

// ---------- Queries ----------

// Products on sale (the shop). Sold out limited runs live in the archive.
export function getShopProducts(categorySlug?: string): Product[] {
  return products.filter(
    (p) => p.status === 'ACTIVE' && (categorySlug === undefined || p.categorySlug === categorySlug),
  )
}

export function getFeaturedProducts(): Product[] {
  return featuredSlugs.map((slug) => getProduct(slug)).filter((p): p is Product => p !== undefined)
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug && p.status !== 'DRAFT')
}

export function getCategories() {
  return categories
}

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug)
}

// Sold out and archived limited runs, the most recent first.
export function getArchive(): Product[] {
  return products
    .filter((p) => p.status === 'SOLD_OUT' || p.status === 'ARCHIVED')
    .sort((a, b) => (b.soldOutAt ?? '').localeCompare(a.soldOutAt ?? ''))
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return products.filter(
    (p) => p.status !== 'DRAFT' && (p.name.toLowerCase().includes(q) || p.kind.toLowerCase().includes(q)),
  )
}

// Finds a variant (and its product) from the id stored in the cart.
export function findVariant(variantId: string): { product: Product; variant: Variant } | undefined {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId)
    if (variant) return { product, variant }
  }
  return undefined
}

// Related products for the product page: same collection first, then others.
export function getRelated(product: Product, count = 4): Product[] {
  const others = getShopProducts().filter((p) => p.id !== product.id)
  const same = others.filter((p) => p.categorySlug === product.categorySlug)
  const rest = others.filter((p) => p.categorySlug !== product.categorySlug)
  return [...same, ...rest].slice(0, count)
}

// ---------- Facts shown in gallery labels ----------

export function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0)
}

export function isArchived(product: Product): boolean {
  return product.status === 'SOLD_OUT' || product.status === 'ARCHIVED'
}

export function purchaseLimit(product: Product): number {
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
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatTaka(min) : `From ${formatTaka(min)}`
}

// One stock fact, true to the data: "38 of 100 left", "Only 3 left", "Sold out".
export function stockFact(product: Product): string {
  const left = totalStock(product)
  if (left === 0) return product.isLimited ? 'Sold out' : 'Out of stock'
  if (left <= settings.lowStockThreshold) return `Only ${left} left`
  if (product.editionSize) return `${left} of ${product.editionSize} left`
  if (!product.isLimited) return 'In stock'
  return `${left} left`
}

// The same fact for one variant: "Only 3 left", "9 left", "Sold out".
export function variantStockFact(product: Product, variant: Variant): string {
  if (variant.stock === 0) return product.isLimited ? 'Sold out' : 'Out of stock'
  if (variant.stock <= settings.lowStockThreshold) return `Only ${variant.stock} left`
  if (!product.isLimited) return 'In stock'
  return `${variant.stock} left`
}

// How many of one variant a buyer may have in the cart: the purchase limit
// or the stock, whichever is lower. The server checks this again at checkout.
export function maxQuantity(product: Product, variant: Variant): number {
  return Math.min(purchaseLimit(product), variant.stock)
}

// How a variant is named in the cart and summaries: "Size M", "Metal", "Standard".
export function variantName(product: Product, variant: Variant): string {
  if (product.variantKind === 'Size') return `Size ${variant.label}`
  return variant.label
}
