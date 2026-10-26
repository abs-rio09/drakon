import { useCallback, useEffect, useRef, useState } from 'react'

// Answers we already have, by key. Coming back to a page shows the last
// answer at once, and a fresh one replaces it when it arrives.
const cache = new Map<string, unknown>()

// Forget every remembered answer (after an order, stock has changed).
export function clearApiCache() {
  cache.clear()
}

// Starts loading an answer before the page asks for it (a product card
// under the pointer), so the next page can often open with its data.
// Errors are ignored: the page loads again itself and shows them.
const pending = new Set<string>()
export function prefetchApi<T>(key: string, load: () => Promise<T>) {
  if (cache.has(key) || pending.has(key)) return
  pending.add(key)
  load()
    .then((data) => cache.set(key, data))
    .catch(() => {})
    .finally(() => pending.delete(key))
}

export type ApiState<T> =
  | { status: 'loading'; data: undefined; error: undefined; reload: () => void }
  | { status: 'error'; data: undefined; error: Error; reload: () => void }
  | { status: 'ready'; data: T; error: undefined; reload: () => void }

// Loads data for a component: const products = useApi('featured', getFeatured)
// `key` names the request; when it changes (another slug), it loads again.
export function useApi<T>(key: string, load: () => Promise<T>): ApiState<T> {
  const [result, setResult] = useState<{ key: string; data?: T; error?: Error }>(() => ({
    key,
    data: cache.get(key) as T | undefined,
  }))
  const [attempt, setAttempt] = useState(0)
  // `load` is a new function on every render; keep the latest one in a ref
  // so the effect below runs only when the key (what to load) changes.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let active = true
    loadRef.current().then(
      (data) => {
        cache.set(key, data)
        if (active) setResult({ key, data })
      },
      (error: Error) => {
        if (active) setResult((prev) => (prev.key === key && prev.data !== undefined ? prev : { key, error }))
      },
    )
    return () => {
      active = false
    }
  }, [key, attempt])

  const reload = useCallback(() => {
    setResult({ key })
    setAttempt((n) => n + 1)
  }, [key])

  // While the key is changing, show the remembered answer for the new key, if any.
  const data = result.key === key ? result.data : (cache.get(key) as T | undefined)
  const error = result.key === key ? result.error : undefined
  if (data !== undefined) return { status: 'ready', data, error: undefined, reload }
  if (error) return { status: 'error', data: undefined, error, reload }
  return { status: 'loading', data: undefined, error: undefined, reload }
}
