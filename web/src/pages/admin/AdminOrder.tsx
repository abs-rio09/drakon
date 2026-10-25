import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { AdminPanel, StatusBadge } from '../../components/admin/adminUi'
import { BanIcon } from '../../components/icons'
import { inputClass, textareaClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button, ghostButton, inlineLink, tapArea } from '../../components/ui/styles'
import { blockPhone, getAdminOrder, saveOrderNote, type AdminOrderAnswer } from '../../features/admin/adminApi'
import { formatPhone, statusNames, telHref, zoneName } from '../../features/admin/format'
import type { AdminOrder as Order, AdminStep } from '../../features/admin/types'
import { ApiError } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'
import { formatTaka } from '../../lib/money'
import { clearApiCache, useApi } from '../../lib/useApi'
import { ErrorLine, NextStep, type ChangeHandler } from './order/ActionPanels'
import OrderReturns from './OrderReturns'

// /admin/orders/:number (docs/design/screens/AdminOrder.dc.html)
export default function AdminOrderPage() {
  const { number = '' } = useParams()
  // key: a different order starts with fresh state.
  return <OrderLoader key={number} number={number.toUpperCase()} />
}

function OrderLoader({ number }: { number: string }) {
  const loaded = useApi(`admin:order:${number}`, () => getAdminOrder(number))
  const [fresh, setFresh] = useState<AdminOrderAnswer | null>(null)

  // After every change: show the server's new answer, and forget cached
  // lists so they load again with the new status.
  function changed(answer: AdminOrderAnswer) {
    clearApiCache()
    setFresh(answer)
  }

  return (
    <>
      <title>{`${number} · DRAKON Admin`}</title>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex gap-2 text-label font-normal text-ink-subtle">
          <li>
            <Link to="/admin/orders" className={tapArea + ' text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink-strong'}>
              Orders
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{number}</li>
        </ol>
      </nav>
      <Loaded state={loaded}>{(data) => <OrderView answer={fresh ?? data} onChange={changed} />}</Loaded>
    </>
  )
}

function OrderView({ answer, onChange }: { answer: AdminOrderAnswer; onChange: ChangeHandler }) {
  const o = answer.order
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-heading-3 text-ink-strong tabular-nums sm:text-heading-2">{o.orderNumber}</h1>
        <StatusBadge status={o.status} />
        <span className="w-full text-label font-normal text-ink-subtle sm:w-auto">
          Placed {formatDateTime(o.placedAt)} · {o.paymentMethod === 'COD' ? 'Cash on Delivery' : o.paymentMethod}
        </span>
      </div>

      <NextStep order={o} onChange={onChange} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <ItemsPanel order={o} />
          <CustomerPanel order={o} onChange={onChange} />
          <OrderReturns answer={answer} onChange={onChange} />
        </div>
        <div className="flex flex-col gap-6">
          <HistoryPanel steps={o.timeline} cancelsAt={o.status === 'PENDING' ? o.cancelsAt : null} />
          <NotePanel order={o} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

// ---------- Details ----------

function ItemsPanel({ order }: { order: Order }) {
  const payment = order.payments[0]
  return (
    <AdminPanel id="items-h" title="Items" aside="Names and prices saved at the time of order">
      <ul className="flex flex-col gap-4">
        {order.items.map((it) => (
          <li key={it.variantId} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
            {it.thumb ? (
              <img src={it.thumb} alt="" className="row-span-2 size-12 rounded-lg bg-field object-cover" />
            ) : (
              <span className="row-span-2 size-12 rounded-lg bg-field" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-label text-ink-strong">{it.productName}</span>
              <span className="text-caption text-ink-subtle">
                {it.variantLabel} · SKU {it.sku}
              </span>
            </span>
            <span className="row-span-2 text-right text-label text-ink-strong tabular-nums">{formatTaka(it.lineTotalPaisa)}</span>
            <span className="text-caption text-ink-muted tabular-nums">
              {it.qty} × {formatTaka(it.unitPricePaisa)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t border-line pt-4 text-label font-normal">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="text-ink tabular-nums">{formatTaka(order.subtotalPaisa)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Delivery · {zoneName[order.delivery.zoneCode] ?? order.delivery.zoneCode}</dt>
          <dd className="text-ink tabular-nums">{order.deliveryPaisa === 0 ? 'Free' : formatTaka(order.deliveryPaisa)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-3">
          <dt className="font-medium text-ink-strong">
            {order.status === 'DELIVERED' ? 'Collected in cash' : order.status === 'CANCELLED' ? 'Order total' : 'Collect in cash'}
          </dt>
          <dd className="text-price text-ink-strong tabular-nums">{formatTaka(order.totalPaisa)}</dd>
        </div>
        {payment && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-subtle">Payment</dt>
            <dd className="text-ink-subtle">
              {payment.status === 'COLLECTED'
                ? `Collected${payment.collectedAt ? ` ${formatDateTime(payment.collectedAt)}` : ''}`
                : payment.status === 'REFUNDED'
                  ? 'Refunded'
                  : payment.status === 'VOID'
                    ? 'Cancelled, nothing to collect'
                    : 'Not collected yet'}
            </dd>
          </div>
        )}
      </dl>
    </AdminPanel>
  )
}

function phoneHistoryText(order: Order) {
  const h = order.phoneHistory
  const parts = (['DELIVERED', 'PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED'] as const)
    .filter((s) => h[s])
    .map((s) => `${h[s]} ${statusNames[s].toLowerCase()}`)
  if (parts.length === 0) return 'First order from this phone'
  const total = Object.values(h).reduce((a, b) => a + (b ?? 0), 0)
  return `${total} other ${total === 1 ? 'order' : 'orders'}: ${parts.join(', ')}`
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-label text-ink-subtle">{term}</dt>
      <dd className="text-body break-words text-ink">{children}</dd>
    </div>
  )
}

function CustomerPanel({ order, onChange }: { order: Order; onChange: ChangeHandler }) {
  const d = order.delivery
  return (
    <AdminPanel id="cust-h" title="Customer and delivery">
      <dl className="flex flex-col gap-4">
        <Row term="Name">{order.customer.name} · guest</Row>
        <Row term="Phone">
          <a href={telHref(order.customer.phone)} className={inlineLink + ' ' + tapArea + ' tabular-nums'}>
            {formatPhone(order.customer.phone)}
          </a>
          <span className="block text-caption text-ink-subtle">{phoneHistoryText(order)}</span>
        </Row>
        <Row term="Email">{order.customer.email ?? <span className="text-ink-subtle">Not given · updates show on the tracking page</span>}</Row>
        <Row term="District">
          {d.district}
          {d.districtArea ? ` (${d.districtArea})` : ''} · {zoneName[d.zoneCode] ?? d.zoneCode} zone
        </Row>
        <Row term="Area">{d.area}</Row>
        <Row term="Address">{d.address}</Row>
        {d.courierNote && <Row term="Courier note">{d.courierNote}</Row>}
        {order.gift.isGift && (
          <Row term="Gift">
            For {order.gift.receiverName}
            {order.gift.receiverPhone && (
              <>
                {' · '}
                <a href={telHref(order.gift.receiverPhone)} className={inlineLink + ' tabular-nums'}>
                  {formatPhone(order.gift.receiverPhone)}
                </a>
              </>
            )}
            {order.gift.note && <span className="block text-ink-muted">“{order.gift.note}”</span>}
            {order.gift.hidePrices && <span className="block text-caption text-ink-subtle">Hide the prices in the parcel</span>}
          </Row>
        )}
      </dl>
      <BlockPhone order={order} onChange={onChange} />
    </AdminPanel>
  )
}

function BlockPhone({ order, onChange }: { order: Order; onChange: ChangeHandler }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  if (order.phoneBlocked) {
    return (
      <p className="flex items-center gap-2 border-t border-line pt-4 text-label font-normal text-ink-muted">
        <BanIcon size={16} />
        This phone number is blocked.{' '}
        <Link to="/admin/blocked-phones" className={inlineLink}>
          Blocked phones
        </Link>
      </p>
    )
  }
  if (!open) {
    return (
      <div className="border-t border-line pt-4">
        <button type="button" onClick={() => setOpen(true)} className={ghostButton + ' inline-flex min-h-11 items-center gap-2'}>
          <BanIcon size={16} />
          Block this phone number
        </button>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await blockPhone(order.customer.phone, reason.trim())
      onChange(await getAdminOrder(order.orderNumber))
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', 'Something went wrong. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-body text-ink-strong">
        Block {formatPhone(order.customer.phone)}? New orders from this phone will be refused. This order stays as it is.
      </p>
      <label htmlFor="b-reason" className="text-label text-ink-muted">
        Reason (required)
      </label>
      <input id="b-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Refused 3 deliveries" className={inputClass} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={sending || reason.trim() === ''} className={button('secondary')}>
          {sending ? 'Blocking…' : 'Yes, block this phone'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
          Never mind
        </button>
      </div>
      <ErrorLine error={error} />
    </form>
  )
}

function stepText(step: AdminStep) {
  if (step.from === null) return 'Placed by the customer on the website'
  const who = step.by === 'ADMIN' ? 'Owner' : step.by === 'SYSTEM' ? 'Automatic' : 'Customer'
  return `${step.note || statusNames[step.to]} · ${who}`
}

function HistoryPanel({ steps, cancelsAt }: { steps: AdminStep[]; cancelsAt: string | null }) {
  return (
    <AdminPanel id="hist-h" title="History">
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden="true"
              className={'mt-2 size-2 shrink-0 rounded-full ' + (s.to === 'CANCELLED' ? 'bg-ink-subtle' : 'bg-ink')}
            />
            <span className="flex flex-col">
              <span className="text-label font-normal text-ink">{stepText(s)}</span>
              <span className="text-caption text-ink-subtle">
                {formatDateTime(s.at)}
                {s.adminEmail ? ` · ${s.adminEmail}` : ''}
              </span>
            </span>
          </li>
        ))}
        {cancelsAt && (
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full border border-line-strong" />
            <span className="flex flex-col">
              <span className="text-label font-normal text-ink-muted">Waiting for a confirmation call</span>
              <span className="text-caption text-ink-subtle">Auto-cancels {formatDateTime(cancelsAt)}</span>
            </span>
          </li>
        )}
      </ol>
    </AdminPanel>
  )
}

function NotePanel({ order, onChange }: { order: Order; onChange: ChangeHandler }) {
  const [note, setNote] = useState(order.adminNote)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const dirty = note.trim() !== order.adminNote

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const answer = await saveOrderNote(order.orderNumber, note)
      onChange(answer)
      setNote(answer.order.adminNote)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', 'Something went wrong. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminPanel id="note-h" title="Internal note">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="n-note" className="sr-only">
          Internal note
        </label>
        <textarea
          id="n-note"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setSaved(false)
          }}
          placeholder="Only admins see this"
          className={textareaClass}
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={sending || !dirty} className={button('secondary')}>
            {sending ? 'Saving…' : 'Save note'}
          </button>
          {saved && !dirty && (
            <span role="status" className="text-caption text-ink-subtle">
              Saved
            </span>
          )}
        </div>
        <ErrorLine error={error} />
      </form>
    </AdminPanel>
  )
}
