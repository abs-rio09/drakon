import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { OrderSummaryList, OrderTimeline } from '../components/order/OrderDetails'
import { describedBy } from '../components/ui/describedBy'
import { Field, inputClass } from '../components/ui/Field'
import { PageIntro } from '../components/ui/PageIntro'
import { PageMeta } from '../components/ui/PageMeta'
import { button, ghostButton, inlineLink, panel } from '../components/ui/styles'
import { isBdMobile } from '../features/checkout/validation'
import { findRecentOrder, loadRecentOrders } from '../features/orders/recentOrders'
import { ApiError, cancelOrder, trackOrder, type OrderLookup } from '../lib/api'
import { formatDateTime } from '../lib/dates'
import { statusLabel } from '../lib/orderStatus'
import type { OrderView } from '../lib/types'
import { clearApiCache } from '../lib/useApi'

// /track — look up an order with its number and the phone it was placed
// with (POST /api/orders/track), see its timeline, and cancel it while it
// has not shipped. Orders placed in this browser can be opened in one tap.

// Order numbers look like DRK-7K3Q9P (blueprint, part 5).
function isOrderNumber(input: string): boolean {
  return /^DRK-[A-Z0-9]{6}$/.test(input.trim().toUpperCase())
}

type Errors = { order?: string; phone?: string }

function validate(order: string, phone: string): Errors {
  const errors: Errors = {}
  if (order.trim() === '') errors.order = 'Enter your order number from the confirmation page.'
  else if (!isOrderNumber(order)) errors.order = 'Order numbers look like DRK-7K3Q9P. Check the number and try again.'
  if (phone.trim() === '') errors.phone = 'Enter the phone number you ordered with.'
  else if (!isBdMobile(phone)) errors.phone = 'Enter an 11-digit mobile number that starts with 01, like 01712345678.'
  return errors
}

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'found'; order: OrderView; lookup: OrderLookup }

export default function Track() {
  const location = useLocation()
  const fromConfirmation = (location.state as { orderNumber?: string } | null)?.orderNumber
  const [order, setOrder] = useState(fromConfirmation ?? '')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState({ order: false, phone: false })
  const [submitted, setSubmitted] = useState(false)
  // Coming from the confirmation page with an order saved in this browser:
  // open it straight away.
  const [opening] = useState(() => (fromConfirmation ? findRecentOrder(fromConfirmation) : undefined))
  const [result, setResult] = useState<Result>(opening ? { status: 'loading' } : { status: 'idle' })
  const recent = loadRecentOrders()
  const resultRef = useRef<HTMLDivElement>(null)

  const errors = validate(order, phone)
  const orderError = submitted || touched.order ? errors.order : undefined
  const phoneError = submitted || touched.phone ? errors.phone : undefined

  async function fetchOrder(lookup: OrderLookup) {
    try {
      const found = await trackOrder(lookup)
      setResult({ status: 'found', order: found, lookup })
    } catch (err) {
      setResult({ status: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' })
    }
  }

  function lookUp(lookup: OrderLookup) {
    setResult({ status: 'loading' })
    void fetchOrder(lookup)
  }

  useEffect(() => {
    if (!opening) return
    const lookup = { orderNumber: opening.orderNumber, token: opening.token }
    trackOrder(lookup).then(
      (found) => setResult({ status: 'found', order: found, lookup }),
      (err: Error) => setResult({ status: 'error', message: err.message }),
    )
  }, [opening])

  // Move the screen to the answer when it arrives.
  useEffect(() => {
    if (result.status === 'found' || result.status === 'error') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [result.status])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    if (errors.order) document.getElementById('t-order')?.focus()
    else if (errors.phone) document.getElementById('t-phone')?.focus()
    else lookUp({ orderNumber: order.trim().toUpperCase(), phone })
  }

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-10 px-4 pt-16 pb-32 sm:px-8 sm:pt-20">
      <PageMeta title="Track your order: Drakon" description="Track a DRAKON order with your order number and phone number." noindex />
      <PageIntro title="Track your order">
        <p>Enter the order number from your confirmation and the phone number you ordered with.</p>
      </PageIntro>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className="flex flex-col gap-3">
          <h2 id="recent-title" className="text-label text-ink-muted">
            Recent on this device
          </h2>
          <ul className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <li key={r.orderNumber}>
                <button
                  type="button"
                  onClick={() => {
                    setOrder(r.orderNumber)
                    lookUp({ orderNumber: r.orderNumber, token: r.token })
                  }}
                  className="relative inline-flex min-h-9 items-center gap-2 rounded-full after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] border border-line-strong px-4 text-caption text-ink transition-colors duration-fast ease-out-drakon hover:border-ink-subtle hover:bg-field"
                >
                  <span className="font-medium text-ink-strong tabular-nums">{r.orderNumber}</span>
                  <span className="text-ink-subtle">{formatDateTime(r.placedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        noValidate
        onSubmit={onSubmit}
        aria-label="Order lookup"
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <Field id="t-order" label="Order number" error={orderError}>
          <input
            id="t-order"
            type="text"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, order: true }))}
            aria-invalid={orderError ? true : undefined}
            aria-describedby={describedBy('t-order', false, orderError)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="DRK-7K3Q9P"
            className={inputClass + ' uppercase tabular-nums placeholder:normal-case'}
          />
        </Field>
        <Field id="t-phone" label="Phone number" error={phoneError}>
          <input
            id="t-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={describedBy('t-phone', false, phoneError)}
            placeholder="01XXXXXXXXX"
            className={inputClass + ' tabular-nums'}
          />
        </Field>
        {/* The label row keeps the button level with the inputs on wide screens */}
        <div className="flex flex-col gap-2">
          <span aria-hidden="true" className="hidden text-label md:block">
            &nbsp;
          </span>
          <button type="submit" disabled={result.status === 'loading'} className={button('secondary', 'md')}>
            {result.status === 'loading' ? 'Looking…' : 'Track'}
          </button>
        </div>
      </form>

      <div ref={resultRef} role="status" aria-live="polite" className="scroll-mt-24">
        {result.status === 'error' && (
          <div className={panel + ' flex flex-col gap-3 p-6 sm:p-8'}>
            <p className="text-body text-ink">{result.message}</p>
            <p className="text-caption text-ink-muted">
              Still stuck? <Link to="/contact" className={inlineLink}>Contact us</Link>.
            </p>
          </div>
        )}
        {result.status === 'found' && (
          <OrderResult
            key={result.order.orderNumber}
            order={result.order}
            lookup={result.lookup}
            onChange={(updated) => setResult({ status: 'found', order: updated, lookup: result.lookup })}
          />
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-8 text-caption text-ink-subtle">
        <p>Your order number is on the confirmation page after you order.</p>
        <p>You can cancel an order here until it ships.</p>
      </div>
    </div>
  )
}

function OrderResult({
  order,
  lookup,
  onChange,
}: {
  order: OrderView
  lookup: OrderLookup
  onChange: (order: OrderView) => void
}) {
  return (
    <section aria-labelledby="result-title" className={panel + ' flex flex-col gap-8 p-6 sm:p-10'}>
      <div className="flex flex-col gap-2">
        <h2 id="result-title" className="text-heading-3 text-ink-strong tabular-nums">
          {order.orderNumber}
        </h2>
        <p className="text-body-lg text-ink">{statusLabel[order.status]}</p>
        {order.status === 'PENDING' && order.confirmBy && (
          <p className="text-caption text-ink-muted">
            We call you to confirm before {formatDateTime(order.confirmBy)}. If we cannot reach you by then, the order
            is cancelled automatically.
          </p>
        )}
        {order.status === 'CANCELLED' && order.cancelReason && (
          <p className="text-caption text-ink-muted">{order.cancelReason}</p>
        )}
      </div>

      <OrderTimeline order={order} />
      <OrderSummaryList order={order} />
      {order.canCancel && <CancelOrder lookup={lookup} onCancelled={onChange} />}
    </section>
  )
}

// Two steps, so nobody cancels by accident: "Cancel this order" opens a
// short confirmation with an optional reason. No browser pop-up dialogs.
function CancelOrder({ lookup, onCancelled }: { lookup: OrderLookup; onCancelled: (order: OrderView) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setSending(true)
    setError(null)
    try {
      const updated = await cancelOrder({ ...lookup, reason })
      clearApiCache() // the stock came back; pages load fresh numbers
      onCancelled(updated)
    } catch (err) {
      setSending(false)
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (!open) {
    return (
      <div className="border-t border-line pt-6">
        <button type="button" onClick={() => setOpen(true)} className={button('secondary', 'sm')}>
          Cancel this order
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-6">
      <p className="text-body text-ink-strong">Cancel this order? The pieces go back on sale.</p>
      <Field id="t-reason" label="Reason" optional>
        <input
          id="t-reason"
          type="text"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Ordered the wrong size"
          className={inputClass}
        />
      </Field>
      {error && (
        <p role="alert" className="text-label font-normal text-danger-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" disabled={sending} onClick={confirm} className={button('secondary', 'sm')}>
          {sending ? 'Cancelling…' : 'Yes, cancel the order'}
        </button>
        <button type="button" disabled={sending} onClick={() => setOpen(false)} className={ghostButton}>
          Keep the order
        </button>
      </div>
    </div>
  )
}
