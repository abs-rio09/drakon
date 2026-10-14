import { createContext } from 'react'
import type { CartLine } from './cartStorage'

export type CartContextValue = {
  lines: CartLine[]
  // Total number of items (for the header bubble).
  count: number
  // Quantity of one variant already in the cart.
  qtyOf: (variantId: string) => number
  add: (variantId: string, qty: number) => void
  setQty: (variantId: string, qty: number) => void
  remove: (variantId: string) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)
