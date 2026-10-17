import { useState } from 'react'
import { ApiError } from '../../lib/api'

// Runs one admin action (a button press) and remembers if it is busy and
// what went wrong, so every form shows "Saving…" and errors the same way.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setBusy(true)
    setError(null)
    try {
      return await action()
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', 'Something went wrong. Please try again.'))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, error, clearError: () => setError(null) }
}
