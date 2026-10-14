import type { ReactNode } from 'react'
import { Link } from 'react-router'

// 36px tall pills in caption size (SoldOut.dc.html). Selected: bone edge, field fill.
const base =
  'inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-caption font-medium transition-colors duration-150 ease-out hover:text-ink-strong'
const on = ' border-ink-strong bg-field text-ink-strong'
const off = ' border-line text-ink-muted hover:border-ink-subtle'

// A filter chip that is a link (for example a collection in the shop).
export function ChipLink({ to, current, children }: { to: string; current: boolean; children: ReactNode }) {
  return (
    <Link to={to} aria-current={current ? 'page' : undefined} className={base + (current ? on : off)}>
      {children}
    </Link>
  )
}

// A filter chip that is a toggle button (for example a filter in the archive).
export function ChipButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={base + (pressed ? on : off)}>
      {children}
    </button>
  )
}
