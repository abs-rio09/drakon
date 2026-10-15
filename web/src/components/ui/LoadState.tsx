import type { ReactNode } from 'react'
import type { ApiState } from '../../lib/useApi'
import { button } from './styles'

// What a page shows while its data loads, and when loading failed.
// Quiet on purpose: a short line of text, no spinner competing with the page.

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center py-24">
      <span className="text-body text-ink-subtle motion-safe:animate-pulse">{label}…</span>
    </div>
  )
}

export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="max-w-text text-body-lg text-ink-muted">{error.message}</p>
      <button type="button" onClick={onRetry} className={button('secondary', 'md')}>
        Try again
      </button>
    </div>
  )
}

// Grey tiles in the product grid's shape, while products load.
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading products">
      <ul
        aria-hidden="true"
        className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16"
      >
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex flex-col gap-4">
            <span className="block aspect-square rounded-2xl bg-field motion-safe:animate-pulse" />
            <span className="block h-4 w-3/4 rounded bg-field motion-safe:animate-pulse" />
            <span className="block h-4 w-1/2 rounded bg-field motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  )
}

// Renders children(data) when ready; otherwise the loading or error state.
export function Loaded<T>({
  state,
  loading,
  children,
}: {
  state: ApiState<T>
  loading?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (state.status === 'ready') return <>{children(state.data)}</>
  if (state.status === 'error') return <LoadError error={state.error} onRetry={state.reload} />
  return <>{loading ?? <Loading />}</>
}
