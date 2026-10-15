import { createContext } from 'react'
import type { CartLine } from './cartStorage'

export type CartContextValue = {
  lines: CartLine[]
  // Total number of items (for the header bubble).
  count: number
  // Quantity of one variant already in the cart.
  qtyOf: (variantId: number) => number
  add: (variantId: number, qty: number) => void
  setQty: (variantId: number, qty: number) => void
  remove: (variantId: number) => void
  // Drop several lines at once, quietly (ids the server no longer knows).
  removeMany: (variantIds: number[]) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)
