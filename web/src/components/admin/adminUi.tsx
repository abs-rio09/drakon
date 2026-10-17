import type { ReactNode } from 'react'
import { productStatusNames, statusNames } from '../../features/admin/format'
import type { OrderStatus, ProductStatus } from '../../features/admin/types'

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

const productLook: Record<ProductStatus, string> = {
  DRAFT: 'border-line bg-field text-ink-muted',
  ACTIVE: 'border-line-strong text-ink-strong',
  SOLD_OUT: 'border-line text-ink-muted',
  ARCHIVED: 'border-line text-ink-subtle',
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={'inline-flex min-h-6 items-center rounded-full border px-3 text-micro whitespace-nowrap ' + productLook[status]}>
      {productStatusNames[status]}
    </span>
  )
}

// "Limited" with a dot, or "Restockable" (AdminProducts.dc.html).
export function LimitedTag({ limited }: { limited: boolean }) {
  return limited ? (
    <span className="inline-flex items-center gap-2 text-caption text-ink-strong">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-strong" />
      Limited
    </span>
  ) : (
    <span className="text-caption text-ink-muted">Restockable</span>
  )
}

// A small text message under a form: role=alert for errors.
export function FormMessage({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p role={error ? 'alert' : 'status'} className={'text-label font-normal ' + (error ? 'text-danger-text' : 'text-ink-muted')}>
      {children}
    </p>
  )
}

// Makes a small inline link (an order number, a breadcrumb) easy to tap
// on a phone: an invisible box around it, 44px tall, adds to the tap area
// without moving anything on the page.
export const tapArea = "relative after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"
