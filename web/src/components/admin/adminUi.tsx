import type { ReactNode } from 'react'
import { statusNames } from '../../features/admin/format'
import type { OrderStatus } from '../../features/admin/types'

// Small pieces shared by the admin order pages
// (docs/design/screens/AdminOrders.dc.html and AdminOrder.dc.html).

const statusLook: Record<OrderStatus, string> = {
  PENDING: 'border-accent bg-surface text-accent-text',
  CONFIRMED: 'border-line-strong text-ink',
  SHIPPED: 'border-line-strong bg-field text-ink-strong',
  DELIVERED: 'border-line text-ink-muted',
  CANCELLED: 'border-line text-ink-subtle',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={'inline-flex min-h-6 items-center rounded-full border px-3 text-micro whitespace-nowrap ' + statusLook[status]}>
      {statusNames[status]}
    </span>
  )
}

// A raised box with a heading, like the panels on the order page.
export function AdminPanel({
  title,
  id,
  aside,
  children,
}: {
  title: string
  id: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-title text-ink-strong">
          {title}
        </h2>
        {aside && <span className="text-caption text-ink-subtle">{aside}</span>}
      </div>
      {children}
    </section>
  )
}
