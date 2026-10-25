import { Link, useLocation, useParams } from 'react-router'
import { CopyButton } from '../components/order/CopyButton'
import { OrderSummaryList, OrderTimeline } from '../components/order/OrderDetails'
import { Loaded } from '../components/ui/LoadState'
import { PageMeta } from '../components/ui/PageMeta'
import { button, container, inlineLink, panel, textLink } from '../components/ui/styles'
import { findRecentOrder } from '../features/orders/recentOrders'
import { trackOrder } from '../lib/api'
import { formatTaka } from '../lib/money'
import { statusLabel } from '../lib/orderStatus'
import type { OrderView } from '../lib/types'
import { useApi } from '../lib/useApi'
import type { JustPlacedState } from './Checkout'

// /order/:number — the confirmation after ordering (Confirmation.dc.html).
// Right after checkout the order comes with the navigation. Later visits
// (reload, back button) find it again with the secret token this browser
// saved, so no personal data is ever stored in the browser.
export default function OrderConfirmation() {
  const { number = '' } = useParams()
  const orderNumber = number.toUpperCase()
  const location = useLocation()
  const state = location.state as JustPlacedState | null
  const fresh = state?.justPlaced && state.order.orderNumber === orderNumber ? state : null
  const recent = findRecentOrder(orderNumber)

  if (fresh) return <Confirmation order={fresh.order} deliverTo={fresh.deliverTo} justPlaced />
  if (!recent) return <NotOnThisDevice orderNumber={orderNumber} />
  return <SavedOrder orderNumber={orderNumber} token={recent.token} />
}

function SavedOrder({ orderNumber, token }: { orderNumber: string; token: string }) {
  const state = useApi(`order:${orderNumber}`, () => trackOrder({ orderNumber, token }))
  return (
    <div className={container}>
      <Loaded state={state}>{(order) => <Confirmation order={order} />}</Loaded>
    </div>
  )
}

function NotOnThisDevice({ orderNumber }: { orderNumber: string }) {
  return (
    <div className={container + ' flex flex-col items-center gap-6 py-24 text-center sm:py-32'}>
      <PageMeta title="Order: Drakon" noindex />
      <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">Find your order on the Track page</h1>
      <p className="max-w-text text-body-lg text-ink-muted">
        This browser has no saved order {orderNumber ? <span className="tabular-nums">{orderNumber}</span> : ''}. Enter the
        order number and the phone number you ordered with on the Track page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Link to="/track" className={button('primary', 'md')}>
          Track an order
        </Link>
        <Link to="/shop" className={textLink + ' text-label text-ink-muted'}>
          Browse products
        </Link>
      </div>
    </div>
  )
}

type ConfirmationProps = {
  order: OrderView
  deliverTo?: JustPlacedState['deliverTo']
  justPlaced?: boolean
}

function Confirmation({ order, deliverTo, justPlaced = false }: ConfirmationProps) {
  const cancelled = order.status === 'CANCELLED'
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-12 px-4 pt-16 pb-32 sm:px-8 sm:pt-20">
      <PageMeta title={`Order ${order.orderNumber}: Drakon`} noindex />

      <header className="flex flex-col gap-3">
        <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">
          {justPlaced ? 'Thank you. Your order is placed.' : `Order ${order.orderNumber}`}
        </h1>
        <p className="text-body-lg text-ink-muted">
          {justPlaced
            ? 'We will call you to confirm it before anything ships.'
            : statusLabel[order.status] + (cancelled && order.cancelReason ? `. ${order.cancelReason}` : '.')}
        </p>
      </header>

      <section aria-labelledby="number-title" className={panel + ' flex flex-col gap-4 p-6 sm:p-8'}>
        <h2 id="number-title" className="text-label text-ink-muted">
          Your order number
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-heading-2 font-semibold tracking-wide text-ink-strong tabular-nums select-all">
            {order.orderNumber}
          </span>
          <CopyButton text={order.orderNumber} />
        </div>
        <p className="text-caption text-ink-subtle">
          Keep this number. You need it with your phone number to track the order. This browser also remembers it for
          you.
        </p>
      </section>

      {!cancelled && (
        <section aria-labelledby="next-title" className="flex flex-col gap-6">
          <h2 id="next-title" className="text-heading-3 text-ink-strong">
            What happens next
          </h2>
          <ol className="flex flex-col border-t border-line">
            <NextStep n={1} title="We call to confirm" done={order.status !== 'PENDING'}>
              Within {order.codConfirmHours} hours{deliverTo ? `, on ${deliverTo.phone}` : ''}. If we cannot reach you, the
              order is cancelled automatically.
            </NextStep>
            <NextStep n={2} title="We pack and ship it" done={order.status === 'SHIPPED' || order.status === 'DELIVERED'}>
              You can always check this order on the{' '}
              <Link to="/track" className={inlineLink}>
                tracking page
              </Link>
              .
            </NextStep>
            <NextStep n={3} title={`Pay ${formatTaka(order.totalPaisa)} in cash`} done={order.status === 'DELIVERED'}>
              {order.isGift
                ? 'The person who receives the parcel pays the courier.'
                : 'Hand it to the courier when your order arrives.'}
            </NextStep>
          </ol>
        </section>
      )}

      {!justPlaced && (
        <section aria-labelledby="timeline-title" className="flex flex-col gap-6">
          <h2 id="timeline-title" className="text-heading-3 text-ink-strong">
            Order history
          </h2>
          <OrderTimeline order={order} />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Link to="/track" state={{ orderNumber: order.orderNumber }} className={button('primary', 'md')}>
          {order.canCancel ? 'Track or cancel' : 'Track order'}
        </Link>
        <Link to="/shop" className={textLink + ' text-label text-ink-muted'}>
          Continue shopping
        </Link>
      </div>

      <section aria-labelledby="summary-title" className={panel + ' flex flex-col gap-6 p-6 sm:p-8'}>
        <h2 id="summary-title" className="text-heading-3 text-ink-strong">
          Order summary
        </h2>
        <OrderSummaryList order={order} />
        <dl className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          {deliverTo && (
            <div className="flex flex-col gap-1">
              <dt className="text-label text-ink-muted">Deliver to</dt>
              <dd className="text-body text-ink">
                {deliverTo.name}
                <br />
                {deliverTo.address}
              </dd>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <dt className="text-label text-ink-muted">Payment</dt>
            <dd className="text-body text-ink">Cash on Delivery</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function NextStep({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-line py-5">
      <span
        aria-hidden="true"
        className={
          'grid size-7 shrink-0 place-items-center rounded-full border text-caption font-medium ' +
          (done ? 'border-ink-strong bg-ink-strong text-surface' : 'border-line-strong text-ink')
        }
      >
        {n}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-body font-medium text-ink-strong">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </span>
        <span className="text-caption text-ink-muted">{children}</span>
      </span>
    </li>
  )
}
