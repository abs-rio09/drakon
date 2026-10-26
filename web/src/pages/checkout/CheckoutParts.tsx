import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { button, inlineLink, panel } from '../../components/ui/styles'
import { formatTaka } from '../../lib/money'
import type { Problem, QuoteItem } from '../../lib/types'

// Parts of the checkout page (Checkout.tsx), moved here unchanged to keep
// that file shorter: the delivery line, form sections, choice cards, the
// Place order button and the order summary card.

// The form's id: the Place order button can sit outside the form (in the
// summary and the phone bar), so form={FORM_ID} connects it to the form.
export const FORM_ID = 'checkout-form'

// The delivery charge, shown right under the district so the buyer sees it
// change as they choose. Screen readers hear the new charge too (aria-live).
type DeliveryStatusProps = {
  district: string
  hasChoice: boolean
  chargePaisa: number | undefined
  zoneName: string | undefined
  free: boolean
}

export function DeliveryStatus({ district, hasChoice, chargePaisa, zoneName, free }: DeliveryStatusProps) {
  // Keep every message to one line on a 375px phone, so the form below
  // does not jump when the message changes.
  let text = 'Pick a district to see the delivery charge.'
  if (chargePaisa !== undefined) text = free ? `Free delivery, ${zoneName}.` : `Delivery charge: ${formatTaka(chargePaisa)}, ${zoneName}.`
  else if (district !== '' && hasChoice) text = `Pick where in ${district} to see the charge.`
  else if (district !== '') text = 'Checking the delivery charge…'
  return (
    <span aria-live="polite" className="tabular-nums">
      {text}
    </span>
  )
}

export function FormSection({ number, title, id, children }: { number: number; title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-line py-8 not-first:border-t">
      <h2 id={id} className="flex items-center gap-4 text-heading-3 text-ink-strong">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full border border-line-strong text-caption font-medium text-ink"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// A bordered card around a radio button. Selected: bone edge and field fill.
export function ChoiceCard({ checked, children }: { checked: boolean; children: ReactNode }) {
  return (
    <label
      className={
        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-fast ease-out-drakon has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ' +
        (checked ? 'border-ink-strong bg-field' : 'border-line-strong hover:border-ink-muted')
      }
    >
      {children}
    </label>
  )
}

// The one main action of the page. It sits outside the <form> (in the
// summary and the phone bar), so form={FORM_ID} connects it to the form.
export function PlaceOrderButton({ block = false, disabled, placing }: { block?: boolean; disabled: boolean; placing: boolean }) {
  return (
    <button
      type="submit"
      form={FORM_ID}
      disabled={disabled}
      className={button('primary', 'lg') + (block ? ' w-full' : '')}
    >
      {placing ? 'Placing your order…' : 'Place order (Cash on Delivery)'}
    </button>
  )
}

type OrderSummaryProps = {
  items: QuoteItem[]
  problems: Problem[]
  subtotal: number
  total: number
  zoneLabel: string
  deliveryPaisa?: number
  isGift: boolean
  codConfirmHours: number
  canOrder: boolean
  placing: boolean
}

export function OrderSummary(props: OrderSummaryProps) {
  const { items, problems, subtotal, total, zoneLabel, deliveryPaisa, isGift, codConfirmHours, canOrder, placing } = props
  return (
    <aside
      id="summary"
      aria-label="Order summary"
      className={panel + ' flex scroll-mt-24 flex-col gap-5 p-6 sm:p-8 lg:sticky lg:top-8'}
    >
      <h2 className="text-heading-3 text-ink-strong">Your order</h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-4">
            <img src={item.thumb} alt="" width={240} height={240} loading="lazy" decoding="async" className="size-16 shrink-0 rounded-lg bg-field object-cover" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink-strong">{item.productName}</span>
              <span className="text-caption text-ink-muted tabular-nums">
                {item.variantName}, qty {item.qty}
              </span>
              {item.problem && <span className="text-caption text-danger-text">{item.problem.message}</span>}
            </span>
            <span className="text-body font-medium text-ink-strong tabular-nums">{formatTaka(item.lineTotalPaisa)}</span>
          </li>
        ))}
      </ul>
      {problems.length > 0 && (
        <p role="alert" className="text-label font-normal text-danger-text">
          Some items need a change before you can order.{' '}
          <Link to="/cart" className={inlineLink}>
            Fix them in your cart
          </Link>
          .
        </p>
      )}

      <dl className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex justify-between gap-4">
          <dt className="text-body text-ink-muted">Subtotal</dt>
          <dd className="text-body font-medium text-ink-strong tabular-nums">{formatTaka(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="flex flex-col">
            <span className="text-body text-ink-muted">Delivery</span>
            <span className="text-caption text-ink-subtle">{zoneLabel}</span>
          </dt>
          <dd className="text-body text-ink-strong tabular-nums">
            {deliveryPaisa !== undefined ? formatTaka(deliveryPaisa) : <span aria-label="not set yet">—</span>}
          </dd>
        </div>
      </dl>

      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-6">
        <span className="flex flex-col">
          <span className="text-body font-medium text-ink-strong">Pay on delivery</span>
          {deliveryPaisa === undefined && <span className="text-caption text-ink-subtle">Delivery not added yet</span>}
        </span>
        <span className="text-price-lg text-ink-strong tabular-nums">{formatTaka(total)}</span>
      </div>

      {isGift && (
        <p className="text-caption text-ink-muted">
          This is a gift. The receiver pays the courier in cash when it arrives.
        </p>
      )}

      <div className="hidden flex-col gap-3 lg:flex">
        <PlaceOrderButton block disabled={!canOrder} placing={placing} />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-6 text-caption text-ink-subtle">
        <p>
          We call you within {codConfirmHours} hours to confirm. Orders we cannot confirm are cancelled
          automatically.
        </p>
        <p>
          The final total is checked by our server when you order. By ordering you agree to our{' '}
          <Link to="/policies/terms" className={inlineLink}>
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/policies/returns" className={inlineLink}>
            Return policy
          </Link>
          .
        </p>
      </div>
    </aside>
  )
}
