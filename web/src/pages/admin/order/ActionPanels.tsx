import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertIcon, ClockIcon, PhoneIcon } from '../../../components/icons'
import { FieldError, inputClass, textareaClass } from '../../../components/ui/Field'
import { button, ghostButton } from '../../../components/ui/styles'
import { moveOrder, type AdminOrderAnswer, type MoveRequest } from '../../../features/admin/adminApi'
import { formatPhone, telHref, timeLeft, zoneName } from '../../../features/admin/format'
import type { AdminOrder as Order } from '../../../features/admin/types'
import { ApiError } from '../../../lib/api'
import { formatDateTime } from '../../../lib/dates'
import { formatTaka } from '../../../lib/money'

// The action panels of the admin order page (AdminOrder.tsx), moved here
// unchanged to keep that file shorter: confirm, ship, deliver, cancel.

export type ChangeHandler = (answer: AdminOrderAnswer) => void

// ---------- The next action, by status ----------

function useMove(number: string, onChange: ChangeHandler) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  async function send(body: MoveRequest) {
    setSending(true)
    setError(null)
    try {
      onChange(await moveOrder(number, body))
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', 'Something went wrong. Please try again.'))
      return false
    } finally {
      setSending(false)
    }
  }
  return { send, sending, error }
}

function ActionPanel({ id, title, text, aside, children }: { id: string; title: string; text: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-2xl border border-line-strong bg-surface-raised p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-heading-3 text-ink-strong">
            {title}
          </h2>
          <span className="text-body text-ink-muted">{text}</span>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function ErrorLine({ error }: { error: ApiError | null }) {
  if (!error) return null
  return (
    <p role="alert" className="flex items-start gap-2 text-label font-normal text-danger-text">
      <AlertIcon size={16} className="mt-0.5 shrink-0" />
      {error.message}
    </p>
  )
}

export function NextStep({ order, onChange }: { order: Order; onChange: ChangeHandler }) {
  const { send, sending, error } = useMove(order.orderNumber, onChange)
  const [cancelling, setCancelling] = useState(false)
  const canCancel = order.nextMoves.includes('CANCELLED')

  if (cancelling && canCancel) {
    return <CancelForm order={order} send={send} sending={sending} error={error} onBack={() => setCancelling(false)} />
  }
  const cancelButton = canCancel && (
    <button type="button" onClick={() => setCancelling(true)} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
      Cancel order
    </button>
  )

  switch (order.status) {
    case 'PENDING': {
      const left = order.cancelsAt ? timeLeft(order.cancelsAt) : null
      return (
        <ActionPanel
          id="act-h"
          title="Call to confirm this order"
          text={`Check the name, address and total of ${formatTaka(order.totalPaisa)} with the customer.`}
          aside={
            left && order.cancelsAt && (
              <span className={'inline-flex items-center gap-2 text-label font-normal ' + (left.urgent ? 'text-accent-text' : 'text-ink-muted')}>
                <ClockIcon size={16} />
                Cancels automatically {left.urgent ? `in ${left.span}` : ''} · {formatDateTime(order.cancelsAt)}
              </span>
            )
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <a href={telHref(order.customer.phone)} className={button('secondary', 'md') + ' tabular-nums'}>
              <PhoneIcon size={18} className="text-accent-text" />
              {formatPhone(order.customer.phone)}
            </a>
            <button type="button" disabled={sending} onClick={() => send({ to: 'CONFIRMED' })} className={button('primary', 'md')}>
              {sending ? 'Saving…' : 'Mark as confirmed'}
            </button>
            {cancelButton}
          </div>
          <ErrorLine error={error} />
        </ActionPanel>
      )
    }
    case 'CONFIRMED':
      return <ShipForm order={order} send={send} sending={sending} error={error} cancelButton={cancelButton} />
    case 'SHIPPED':
      return <DeliverStep order={order} send={send} sending={sending} error={error} cancelButton={cancelButton} />
    case 'DELIVERED':
      return (
        <ActionPanel
          id="act-h"
          title="Delivered and paid"
          text={`${formatTaka(order.totalPaisa)} collected in cash${order.deliveredAt ? ` on ${formatDateTime(order.deliveredAt)}` : ''}. A return can be recorded below.`}
        >
          {null}
        </ActionPanel>
      )
    case 'CANCELLED':
      return (
        <ActionPanel id="act-h" title="Order cancelled" text={order.cancelReason ?? 'The items went back into stock.'}>
          <p className="text-label font-normal text-ink-subtle">The items went back into stock. The customer sees this on the tracking page.</p>
        </ActionPanel>
      )
  }
}

type SendProps = {
  order: Order
  send: (body: MoveRequest) => Promise<boolean>
  sending: boolean
  error: ApiError | null
}

const couriers = ['Steadfast', 'Pathao', 'RedX', 'Other']

function ShipForm({ order, send, sending, error, cancelButton }: SendProps & { cancelButton: ReactNode }) {
  const [courier, setCourier] = useState(couriers[0])
  const [otherCourier, setOtherCourier] = useState('')
  const [tracking, setTracking] = useState('')
  const courierName = courier === 'Other' ? otherCourier.trim() : courier
  const ready = courierName !== '' && tracking.trim() !== ''

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (ready) send({ to: 'SHIPPED', courierName, trackingCode: tracking.trim() })
  }

  return (
    <ActionPanel id="act-h" title="Ready to ship" text="Pack the items, book the courier, then add the tracking code.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="s-courier" className="text-label text-ink-muted">
              Courier
            </label>
            <select id="s-courier" value={courier} onChange={(e) => setCourier(e.target.value)} className={inputClass}>
              {couriers.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {courier === 'Other' && (
            <div className="flex flex-col gap-2">
              <label htmlFor="s-other" className="text-label text-ink-muted">
                Courier name
              </label>
              <input id="s-other" value={otherCourier} onChange={(e) => setOtherCourier(e.target.value)} maxLength={60} className={inputClass} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="s-track" className="text-label text-ink-muted">
              Tracking code
            </label>
            <input
              id="s-track"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. SF-4471029"
              maxLength={100}
              aria-invalid={error?.fields.trackingCode ? true : undefined}
              className={inputClass}
            />
            {error?.fields.trackingCode && <FieldError id="s-track-error">{error.fields.trackingCode}</FieldError>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!ready || sending} className={button('primary', 'md')}>
            {sending ? 'Saving…' : 'Mark as shipped'}
          </button>
          {cancelButton}
        </div>
        <ErrorLine error={error} />
      </form>
      <p className="text-caption text-ink-subtle">Deliver to {order.delivery.district}, {zoneName[order.delivery.zoneCode] ?? order.delivery.zoneCode}.</p>
    </ActionPanel>
  )
}

// "Delivered" asks once more: did the cash really arrive?
function DeliverStep({ order, send, sending, error, cancelButton }: SendProps & { cancelButton: ReactNode }) {
  const [asking, setAsking] = useState(false)
  return (
    <ActionPanel
      id="act-h"
      title="On the way"
      text={`${order.courier.name ?? 'Courier'} · ${order.courier.tracking ?? ''}. The customer sees this on the tracking page.`}
    >
      {asking ? (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
          <p className="text-body text-ink-strong">
            Did you receive {formatTaka(order.totalPaisa)} in cash for this order? This marks the payment as collected.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={sending} onClick={() => send({ to: 'DELIVERED' })} className={button('primary', 'md')}>
              {sending ? 'Saving…' : 'Yes, delivered and paid'}
            </button>
            <button type="button" onClick={() => setAsking(false)} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setAsking(true)} className={button('primary', 'md')}>
            Delivered, cash collected
          </button>
          {cancelButton}
        </div>
      )}
      <ErrorLine error={error} />
    </ActionPanel>
  )
}

function CancelForm({ order, send, sending, error, onBack }: SendProps & { onBack: () => void }) {
  const [reason, setReason] = useState('')
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await send({ to: 'CANCELLED', reason: reason.trim() })) onBack()
  }
  const pieces = order.items.reduce((n, it) => n + it.qty, 0)
  return (
    <ActionPanel
      id="act-h"
      title={`Cancel ${order.orderNumber}?`}
      text={`${pieces === 1 ? 'The piece goes' : `All ${pieces} pieces go`} back into stock. The customer sees the reason on the tracking page. This cannot be undone.`}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="c-reason" className="text-label text-ink-muted">
            Reason (required)
          </label>
          <textarea
            id="c-reason"
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer did not answer three calls"
            aria-invalid={error?.fields.reason ? true : undefined}
            className={textareaClass}
          />
          {error?.fields.reason && <FieldError id="c-reason-error">{error.fields.reason}</FieldError>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={sending || reason.trim() === ''} className={button('primary', 'md')}>
            {sending ? 'Cancelling…' : 'Yes, cancel the order'}
          </button>
          <button type="button" onClick={onBack} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
            Keep the order
          </button>
        </div>
        <ErrorLine error={error && !error.fields.reason ? error : null} />
      </form>
    </ActionPanel>
  )
}
