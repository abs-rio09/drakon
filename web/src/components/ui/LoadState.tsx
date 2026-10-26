import type { ReactNode } from 'react'
import type { ApiState } from '../../lib/useApi'
import { button } from './styles'

// What a page shows while its data loads, and when loading failed.
// Quiet on purpose: a short line of text or still shapes in the real
// layout. No spinner, no pulsing (nothing loops: drakon-motion skill).

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center py-24">
      <span className="text-body text-ink-subtle">{label}…</span>
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

// Still tiles in the product grid's exact shape while products load: the
// photo square, then rows as tall as the gallery label's lines (name 52px
// on phones / 26px from sm, meta 18px, hairline + price row), so the cards
// take the same place when they arrive.
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  const bar = 'block rounded bg-field'
  return (
    <div role="status" aria-label="Loading products">
      <ul
        aria-hidden="true"
        className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16"
      >
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex flex-col gap-4">
            <span className="block aspect-square rounded-2xl bg-field" />
            <div className="flex flex-col gap-1">
              <span className="flex h-13 flex-col gap-2 pt-1 sm:h-6.5">
                <span className={bar + ' h-4 w-4/5'} />
                <span className={bar + ' h-4 w-1/2 sm:hidden'} />
              </span>
              <span className="flex h-4.5 items-center">
                <span className={bar + ' h-3 w-1/2'} />
              </span>
              <span className="mt-2 flex h-8.75 items-center justify-between border-t border-line pt-2 sm:h-9.25">
                <span className={bar + ' h-4 w-1/4'} />
                <span className={bar + ' h-3 w-1/5'} />
              </span>
            </div>
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
