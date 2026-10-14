// Saves the cart in this browser's localStorage.
// Only the variant id and the quantity are stored (docs/blueprint.md, part 7):
// names, prices and stock always come fresh from the catalogue (later the API).

export type CartLine = {
  variantId: string
  qty: number
}

const STORAGE_KEY = 'drakon.cart.v1'

// localStorage only holds text, so we turn the array into JSON and back.
// Anything broken or unexpected is thrown away instead of crashing the page.
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
    typeof line.variantId === 'string' &&
    typeof line.qty === 'number' &&
    Number.isInteger(line.qty) &&
    line.qty > 0
  )
}
