import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, postQuote } from '../../lib/api'
import type { Quote, QuoteItem } from '../../lib/types'
import type { CartLine } from './cartStorage'
import { useCart } from './useCart'

export type CartQuoteState = (
  | { status: 'empty' }
  | { status: 'loading'; quote?: Quote }
  | { status: 'error'; error: Error; retry: () => void; quote?: Quote }
  | { status: 'ready'; quote: Quote }
) & {
  // Ask the server again (for example after an order was refused).
  refresh: () => void
}

// Prices the cart on the server (POST /api/checkout/quote) every time the
// cart or the delivery area changes. The browser never decides a price.
// Lines the server does not know (old or removed variants) are dropped quietly.
export function useCartQuote(deliveryAreaId?: number): CartQuoteState {
  const cart = useCart()
  const lines = cart.lines
  const { removeMany, setQty } = cart
  // A stable text key, so the effect runs only when the cart really changes.
  const key = JSON.stringify([lines, deliveryAreaId ?? null])
  const [result, setResult] = useState<{ key: string; quote?: Quote; error?: Error }>({ key: '' })
  const [attempt, setAttempt] = useState(0)
  // The latest values, read inside the effect. The effect itself re-runs
  // only when `key` (the cart and area) changes, not on every render.
  const latest = useRef({ lines, deliveryAreaId, removeMany, setQty })
  useEffect(() => {
    latest.current = { lines, deliveryAreaId, removeMany, setQty }
  })

  useEffect(() => {
    const { lines, deliveryAreaId, removeMany, setQty } = latest.current
    if (lines.length === 0) return
    const controller = new AbortController()
    postQuote({ items: lines, deliveryAreaId }, controller.signal).then(
      (quote) => {
        const unknown = quote.problems.filter((p) => p.code === 'UNKNOWN_VARIANT').map((p) => p.variantId)
        if (unknown.length > 0) removeMany(unknown)
        // More in the cart than one buyer may have (stock or limit went down): lower it.
        for (const item of quote.items) {
          if (item.maxQty > 0 && item.qty > item.maxQty) setQty(item.variantId, item.maxQty)
        }
        setResult({ key, quote })
      },
      (error: Error) => {
        if (controller.signal.aborted) return
        // A cart with only unknown ids can't be priced; empty it quietly.
        if (error instanceof ApiError && error.code === 'BAD_CART') removeMany(lines.map((l) => l.variantId))
        setResult((prev) => ({ key, error, quote: prev.quote }))
      },
    )
    return () => controller.abort()
  }, [key, attempt])

  return useMemo<CartQuoteState>(() => {
    const refresh = () => {
      setResult((prev) => ({ key: '', quote: prev.quote }))
      setAttempt((n) => n + 1)
    }
    if (lines.length === 0) return { status: 'empty', refresh }
    if (result.key === key && result.quote && !result.error) return { status: 'ready', quote: result.quote, refresh }
    if (result.key === key && result.error) {
      return { status: 'error', error: result.error, retry: refresh, quote: result.quote, refresh }
    }
    // Still loading: keep showing the previous quote (if any) so the page does not jump.
    return { status: 'loading', quote: result.quote, refresh }
  }, [lines.length, key, result])
}

// Items that can be ordered (shown as cart rows) and the ones that cannot
// (sold out runs, out of stock), from a quote.
export function splitItems(quote: Quote): { items: QuoteItem[]; unavailable: QuoteItem[] } {
  const items: QuoteItem[] = []
  const unavailable: QuoteItem[] = []
  for (const item of quote.items) {
    const code = item.problem?.code
    if (code === 'UNAVAILABLE' || code === 'OUT_OF_STOCK') unavailable.push(item)
    else items.push(item)
  }
  return { items, unavailable }
}

export function lineCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0)
}
