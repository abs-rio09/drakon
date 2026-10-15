import { formatDateTime } from '../../lib/dates'
import { formatTaka } from '../../lib/money'
import { statusLabel } from '../../lib/orderStatus'
import type { OrderView } from '../../lib/types'

const zoneLabel: Record<string, string> = {
  INSIDE_DHAKA: 'inside Dhaka',
  OUTSIDE_DHAKA: 'outside Dhaka',
}

// Items, delivery and the amount to pay: the copies saved with the order,
// so they never change even if prices change later.
export function OrderSummaryList({ order }: { order: OrderView }) {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col">
              <span className="text-body text-ink-strong">{item.productName}</span>
              <span className="text-caption text-ink-muted tabular-nums">
                {item.variantName}, qty {item.qty}
              </span>
            </span>
            <span className="text-body font-medium text-ink-strong tabular-nums">{formatTaka(item.lineTotalPaisa)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex justify-between gap-4">
          <dt className="text-body text-ink-muted">Subtotal</dt>
          <dd className="text-body text-ink-strong tabular-nums">{formatTaka(order.subtotalPaisa)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-body text-ink-muted">Delivery{zoneLabel[order.zoneCode] ? `, ${zoneLabel[order.zoneCode]}` : ''}</dt>
          <dd className="text-body text-ink-strong tabular-nums">
            {order.deliveryPaisa === 0 ? 'Free' : formatTaka(order.deliveryPaisa)}
          </dd>
        </div>
      </dl>
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-5">
        <span className="text-body font-medium text-ink-strong">
          {order.status === 'CANCELLED' ? 'Order total' : 'Pay on delivery'}
        </span>
        <span className="text-price-lg text-ink-strong tabular-nums">{formatTaka(order.totalPaisa)}</span>
      </div>
    </div>
  )
}

// Every status change, oldest first, as a hairline list.
export function OrderTimeline({ order }: { order: OrderView }) {
  return (
    <ol className="flex flex-col border-t border-line">
      {order.timeline.map((step, i) => {
        const last = i === order.timeline.length - 1
        return (
          <li key={i} className="flex gap-4 border-b border-line py-4">
            <span
              aria-hidden="true"
              className={
                'mt-1.5 size-2.5 shrink-0 rounded-full ' +
                (last ? (step.status === 'CANCELLED' ? 'bg-ink-muted' : 'bg-ink-strong') : 'bg-line-strong')
              }
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={'text-body ' + (last ? 'font-medium text-ink-strong' : 'text-ink')}>
                {statusLabel[step.status]}
              </span>
              {step.note && <span className="text-caption text-ink-muted">{step.note}</span>}
            </span>
            <time dateTime={step.at} className="shrink-0 text-caption text-ink-subtle tabular-nums">
              {formatDateTime(step.at)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
