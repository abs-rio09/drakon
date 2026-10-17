import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { StatusBadge, tapArea } from '../../components/admin/adminUi'
import { ClockIcon, PhoneIcon, SearchIcon } from '../../components/icons'
import { inputClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button, ghostButton } from '../../components/ui/styles'
import { getCallList, getDashboard, getOrders } from '../../features/admin/adminApi'
import { formatPhone, timeLeft, zoneName } from '../../features/admin/format'
import type { AdminOrderRow, OrderStatus } from '../../features/admin/types'
import { formatDateTime } from '../../lib/dates'
import { formatTaka } from '../../lib/money'
import { useApi } from '../../lib/useApi'

const pageSize = 50

const tabs: { status: OrderStatus | ''; label: string }[] = [
  { status: '', label: 'All' },
  { status: 'PENDING', label: 'Pending call' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
  { status: 'CANCELLED', label: 'Cancelled' },
]

const items = (n: number) => (n === 1 ? '1 item' : `${n} items`)

// The short line under "Placed": what happened last, or the time left to call.
function rowNote(o: AdminOrderRow): { text: string; urgent?: boolean } {
  switch (o.status) {
    case 'PENDING':
      return o.cancelsAt ? timeLeft(o.cancelsAt) : { text: '' }
    case 'CONFIRMED':
      return { text: o.confirmedAt ? `Confirmed ${formatDateTime(o.confirmedAt)}` : 'Confirmed' }
    case 'SHIPPED':
      return { text: o.courierName ?? 'Shipped' }
    case 'DELIVERED':
      return { text: 'Cash collected' }
    case 'CANCELLED':
      return { text: o.cancelReason ?? 'Cancelled' }
  }
}

// /admin/orders (docs/design/screens/AdminOrders.dc.html)
export default function AdminOrders() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as OrderStatus | ''
  const q = params.get('q') ?? ''
  const offset = Number(params.get('offset') ?? 0) || 0
  const [search, setSearch] = useState(q)

  const list = useApi(`admin:orders:${status}:${q}:${offset}`, () => getOrders({ status, q, limit: pageSize, offset }))
  const dashboard = useApi('admin:dashboard', getDashboard)
  const calls = useApi('admin:call-list', getCallList)

  function update(next: { status?: string; q?: string; offset?: number }) {
    const p = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === '' || value === 0 || value === undefined) p.delete(key)
      else p.set(key, String(value))
    }
    if (next.offset === undefined) p.delete('offset') // a new filter starts at page 1
    setParams(p)
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    update({ q: search.trim() })
  }

  const hours = calls.data?.codConfirmHours
  return (
    <>
      <AdminPageHeader
        title="Orders"
        intro={`Call every new order to confirm it.${hours ? ` Unconfirmed orders cancel after ${hours} hours.` : ''}`}
        actions={
          <form role="search" onSubmit={onSearch} className="relative w-full sm:w-80">
            <label htmlFor="o-search" className="sr-only">
              Search orders
            </label>
            <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="o-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order number, name or phone"
              className={inputClass + ' pl-10'}
            />
          </form>
        }
      />

      {/* Attention banner: the oldest order waiting for a call */}
      {calls.data && calls.data.orders.length > 0 && (
        <CallBanner count={calls.data.orders.length} oldest={calls.data.orders[0]} />
      )}

      <div role="group" aria-label="Filter by status" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const pressed = t.status === status
          const count = dashboard.data
            ? t.status === ''
              ? Object.values(dashboard.data.counts).reduce((a, b) => a + b, 0)
              : dashboard.data.counts[t.status]
            : undefined
          return (
            <button
              key={t.label}
              type="button"
              aria-pressed={pressed}
              onClick={() => update({ status: t.status })}
              className={
                'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-label whitespace-nowrap transition-colors duration-150 ease-out hover:text-ink-strong ' +
                (pressed ? 'border-ink-strong text-ink-strong' : 'border-transparent text-ink-muted')
              }
            >
              {t.label}
              {count !== undefined && <span className="text-micro text-ink-subtle tabular-nums">{count}</span>}
            </button>
          )
        })}
      </div>

      {q && (
        <p className="mb-4 flex flex-wrap items-center gap-3 text-label font-normal text-ink-muted">
          Results for “{q}”
          <button
            type="button"
            className={ghostButton}
            onClick={() => {
              setSearch('')
              update({ q: '' })
            }}
          >
            Clear search
          </button>
        </p>
      )}

      <Loaded state={list}>
        {(page) =>
          page.orders.length === 0 ? (
            <p className="py-16 text-center text-body text-ink-muted">No orders here.</p>
          ) : (
            <>
              <OrdersTable orders={page.orders} />
              <OrdersList orders={page.orders} />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-caption text-ink-subtle">
                  Showing {page.offset + 1}–{page.offset + page.orders.length} of {page.total} orders
                </p>
                <div className="flex gap-3">
                  {page.offset > 0 && (
                    <button type="button" className={button('secondary')} onClick={() => update({ offset: Math.max(0, page.offset - pageSize) })}>
                      Newer
                    </button>
                  )}
                  {page.offset + page.orders.length < page.total && (
                    <button type="button" className={button('secondary')} onClick={() => update({ offset: page.offset + pageSize })}>
                      Older
                    </button>
                  )}
                </div>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  )
}

function CallBanner({ count, oldest }: { count: number; oldest: { orderNumber: string; cancelsAt: string } }) {
  const left = timeLeft(oldest.cancelsAt)
  return (
    <div
      role="status"
      className="mb-8 flex flex-col gap-4 rounded-2xl border border-line-strong bg-surface-raised p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-3 text-body text-ink">
        <ClockIcon size={20} className="mt-0.5 shrink-0 text-accent-text" />
        <span>
          <strong className="font-semibold text-ink-strong">
            {count === 1 ? '1 order needs a call.' : `${count} orders need a call.`}
          </strong>{' '}
          The oldest, {oldest.orderNumber}, {left.urgent ? `cancels automatically in ${left.span}` : `has ${left.span} left`}.
        </span>
      </span>
      <Link to={`/admin/orders/${oldest.orderNumber}`} className={button('primary') + ' shrink-0'}>
        Call {oldest.orderNumber}
      </Link>
    </div>
  )
}

function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const th = 'px-4 py-3 text-left text-micro font-medium text-ink-subtle'
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
      <table className="w-full border-collapse text-label font-normal">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={th}>Order</th>
            <th scope="col" className={th}>Customer</th>
            <th scope="col" className={th}>Delivery</th>
            <th scope="col" className={th + ' text-right'}>Total</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Placed</th>
            <th scope="col" className={th}>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const note = rowNote(o)
            return (
              <tr key={o.orderNumber} className="border-b border-line last:border-b-0 hover:bg-field">
                <td className="px-4 py-4 align-top">
                  <Link to={`/admin/orders/${o.orderNumber}`} className={tapArea + ' font-medium text-ink-strong underline-offset-4 hover:underline'}>
                    {o.orderNumber}
                  </Link>
                  <div className="text-caption text-ink-subtle">{items(o.itemCount)}</div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="text-ink">{o.name}</div>
                  <div className="text-caption text-ink-subtle tabular-nums">{formatPhone(o.phone)}</div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="text-ink">{o.district}</div>
                  <div className="text-caption text-ink-subtle">{zoneName[o.zoneCode] ?? o.zoneCode}</div>
                </td>
                <td className="px-4 py-4 text-right align-top text-ink-strong tabular-nums">{formatTaka(o.totalPaisa)}</td>
                <td className="px-4 py-4 align-top">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="text-ink">{formatDateTime(o.placedAt)}</div>
                  <div className={'max-w-48 truncate text-caption ' + (note.urgent ? 'text-accent-text' : 'text-ink-subtle')}>{note.text}</div>
                </td>
                <td className="px-4 py-4 text-right align-top">
                  {o.status === 'PENDING' ? (
                    <Link to={`/admin/orders/${o.orderNumber}`} className={button('secondary') + ' whitespace-nowrap'}>
                      <PhoneIcon size={14} />
                      Call and confirm
                    </Link>
                  ) : (
                    <Link to={`/admin/orders/${o.orderNumber}`} className="text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink-strong">
                      View
                    </Link>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Phone: the same orders as a stacked list.
function OrdersList({ orders }: { orders: AdminOrderRow[] }) {
  return (
    <ul aria-label="Orders" className="flex flex-col gap-3 sm:hidden">
      {orders.map((o) => {
        const note = rowNote(o)
        return (
          <li key={o.orderNumber} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-4">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/admin/orders/${o.orderNumber}`} className={tapArea + ' text-body font-medium text-ink-strong underline-offset-4 hover:underline'}>
                {o.orderNumber}
              </Link>
              <StatusBadge status={o.status} />
            </div>
            <div className="flex justify-between gap-3 text-label font-normal">
              <span className="min-w-0 truncate text-ink">
                {o.name} · {o.district}
              </span>
              <span className="text-ink-strong tabular-nums">{formatTaka(o.totalPaisa)}</span>
            </div>
            <div className="flex justify-between gap-3 text-caption">
              <span className="text-ink-subtle">
                {formatDateTime(o.placedAt)} · {items(o.itemCount)}
              </span>
              <span className={'truncate ' + (note.urgent ? 'text-accent-text' : 'text-ink-subtle')}>{note.text}</span>
            </div>
            {o.status === 'PENDING' && (
              <Link to={`/admin/orders/${o.orderNumber}`} className={button('secondary') + ' mt-1'}>
                <PhoneIcon size={14} />
                Call and confirm
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
