// Saves the cart in this browser's localStorage.
// Only the variant id and the quantity are stored (docs/blueprint.md, part 7):
// names, prices and stock always come fresh from the API (checkout quote).

export type CartLine = {
  variantId: number // product_variants.id in the database
  qty: number
}

const STORAGE_KEY = 'drakon.cart.v1'

// localStorage only holds text, so we turn the array into JSON and back.
// Anything broken or unexpected is thrown away instead of crashing the page.
// (Carts saved before the API existed used text ids like "v-df-paper"; those
// lines fail the check below and are dropped quietly.)
export function loadCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(isCartLine)
  } catch {
    return []
  }
}

export function saveCart(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    // Private mode or full storage: the cart still works until the tab closes.
  }
}

export function isCartStorageKey(key: string | null): boolean {
  return key === STORAGE_KEY
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const line = value as Record<string, unknown>
  return (
    typeof line.variantId === 'number' &&
    Number.isInteger(line.variantId) &&
    line.variantId > 0 &&
    typeof line.qty === 'number' &&
    Number.isInteger(line.qty) &&
    line.qty > 0
  )
}
