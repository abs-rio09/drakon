import { LockIcon } from '../icons'

// Small glass pill on a photo, top-left. One badge per photo at most.
// `position` moves it: 12px in grids, 16px on the big product photo.
export function SoldOutBadge({ position = 'top-3 left-3' }: { position?: string }) {
  return (
    <span className={`absolute ${position} inline-flex items-center gap-1 rounded-full border border-line bg-surface-glass px-3 py-1 text-micro text-ink-muted backdrop-blur-xl`}>
      <LockIcon size={12} />
      Sold out
    </span>
  )
}

export function LimitedBadge({
  children = 'Limited run',
  position = 'top-3 left-3',
}: {
  children?: string
  position?: string
}) {
  return (
    <span className={`absolute ${position} inline-flex items-center gap-2 rounded-full border border-line bg-surface-glass px-3 py-1 text-micro text-ink-strong backdrop-blur-xl`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-strong" />
      {children}
    </span>
  )
}
