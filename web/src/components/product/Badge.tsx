import { LockIcon } from '../icons'

// Small glass pill on a photo, top-left. One badge per photo at most.
export function SoldOutBadge() {
  return (
    <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full border border-line bg-surface-glass px-3 py-1 text-micro text-ink-muted backdrop-blur-xl">
      <LockIcon size={12} />
      Sold out
    </span>
  )
}

export function LimitedBadge({ children = 'Limited run' }: { children?: string }) {
  return (
    <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-glass px-3 py-1 text-micro text-ink-strong backdrop-blur-xl">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-strong" />
      {children}
    </span>
  )
}
