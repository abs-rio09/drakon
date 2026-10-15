import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CartContext, type CartContextValue } from './CartContext'
import { isCartStorageKey, loadCart, saveCart, type CartLine } from './cartStorage'

// Holds the cart for the whole app. Any component inside <CartProvider>
// can read or change the cart with the useCart() hook.
export function CartProvider({ children }: { children: ReactNode }) {
  // The function form runs once, on the first render only.
  const [lines, setLines] = useState<CartLine[]>(() => loadCart())

  // Save after every change.
  useEffect(() => {
    saveCart(lines)
  }, [lines])

  // If the cart changes in another tab, follow it here too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (isCartStorageKey(e.key)) setLines(loadCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<CartContextValue>(() => {
    const qtyOf = (variantId: number) => lines.find((l) => l.variantId === variantId)?.qty ?? 0

    return {
      lines,
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      qtyOf,
      add(variantId, qty) {
        setLines((prev) => {
          const existing = prev.find((l) => l.variantId === variantId)
          if (existing) {
            return prev.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + qty } : l))
          }
          return [...prev, { variantId, qty }]
        })
      },
      setQty(variantId, qty) {
        setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l)))
      },
      remove(variantId) {
        setLines((prev) => prev.filter((l) => l.variantId !== variantId))
      },
      removeMany(variantIds) {
        setLines((prev) => prev.filter((l) => !variantIds.includes(l.variantId)))
      },
      clear() {
        setLines([])
      },
    }
  }, [lines])

  return <CartContext value={value}>{children}</CartContext>
}
