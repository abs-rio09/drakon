import { Link } from 'react-router'
import { CashIcon, TruckIcon } from '../components/icons'
import { LoadError, Loading } from '../components/ui/LoadState'
import { QuantityStepper } from '../components/ui/QuantityStepper'
import { button, container, ghostButton, panel, textLink } from '../components/ui/styles'
import { splitItems, useCartQuote } from '../features/cart/cartItems'
import { useCart } from '../features/cart/useCart'
import { useSite } from '../features/site/SiteContext'
import { zoneCharge } from '../lib/delivery'
import { formatTaka } from '../lib/money'
import type { QuoteItem } from '../lib/types'

// /cart — laid out from docs/design/screens/Cart.dc.html
export default function Cart() {
  const cart = useCart()
  const { settings, delivery } = useSite()
  const priced = useCartQuote()
  const quote = priced.status === 'empty' ? undefined : priced.quote
  const { items, unavailable } = quote ? splitItems(quote) : { items: [], unavailable: [] }
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const countLabel = count === 1 ? '1 item' : `${count} items`
  // The server's subtotal (prices from the database), never added up here.
  const subtotal = quote?.subtotalPaisa ?? 0
  const inside = zoneCharge(delivery, 'INSIDE_DHAKA')
  const outside = zoneCharge(delivery, 'OUTSIDE_DHAKA')

  return (
    <div className={container + ' flex flex-col gap-10 pt-14 pb-32'}>
      <title>Your cart: Drakon</title>
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">Your cart</h1>
        {items.length > 0 && <span className="text-body text-ink-subtle tabular-nums">{countLabel}</span>}
      </div>

      {unavailable.length > 0 && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3">
          <p className="text-label font-normal text-ink">
            {unavailable.length === 1 ? 'One piece' : `${unavailable.length} pieces`} in your cart sold out and can no
            longer be ordered:
          </p>
          <ul className="flex flex-col gap-1 text-caption text-ink-muted">
            {unavailable.map((item) => (
              <li key={item.variantId} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {item.productName}, {item.variantName}
                </span>
                <button type="button" className={ghostButton} onClick={() => cart.remove(item.variantId)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {priced.status === 'error' && !quote ? (
        <LoadError error={priced.error} onRetry={priced.retry} />
      ) : cart.lines.length > 0 && !quote ? (
        <Loading label="Checking prices and stock" />
      ) : items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
          <section aria-label="Items in your cart" className="flex flex-col">
            <ul className="flex flex-col border-t border-line">
              {items.map((item) => (
                <CartRow key={item.variantId} item={item} />
              ))}
            </ul>
            <Link to="/shop" className={textLink + ' mt-8 self-start text-label font-normal text-ink-muted'}>
              Continue shopping
            </Link>
          </section>

          <aside aria-label="Order summary" className={panel + ' flex flex-col gap-5 p-6 sm:p-8 lg:sticky lg:top-24'}>
            <h2 className="text-heading-3 text-ink-strong">Summary</h2>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between gap-4">
                <dt className="text-body text-ink-muted tabular-nums">Subtotal ({countLabel})</dt>
                <dd className="text-body font-medium text-ink-strong tabular-nums">{formatTaka(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex flex-col">
                  <span className="text-body text-ink-muted">Delivery</span>
                  {inside !== undefined && outside !== undefined && (
                    <span className="text-caption text-ink-subtle tabular-nums">
                      {formatTaka(inside)} inside Dhaka, {formatTaka(outside)} outside
                    </span>
                  )}
                </dt>
                <dd className="text-body whitespace-nowrap text-ink-muted">Set at checkout</dd>
              </div>
            </dl>
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-5">
              <span className="text-body text-ink">Total before delivery</span>
              <span className="text-price-lg text-ink-strong tabular-nums">{formatTaka(subtotal)}</span>
            </div>
            <Link to="/checkout" className={button('primary', 'lg') + ' w-full'}>
              Go to checkout
            </Link>
            <ul className="flex flex-col gap-2 pt-1 text-label font-normal text-ink-muted">
              <li className="flex items-start gap-3">
                <CashIcon size={16} className="mt-0.5 shrink-0" />
                Cash on Delivery. Pay the courier when it arrives.
              </li>
              <li className="flex items-start gap-3">
                <TruckIcon size={16} className="mt-0.5 shrink-0" />
                We call you within {settings.codConfirmHours} hours to confirm before we ship.
              </li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  )
}

function CartRow({ item }: { item: QuoteItem }) {
  const cart = useCart()
  const { qty } = item
  const max = Math.max(1, item.maxQty)
  const href = `/product/${item.productSlug}`

  return (
    <li className="flex gap-5 border-b border-line py-6">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <img src={item.thumb} alt="" className="size-21 rounded-lg bg-field object-cover sm:size-28" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              to={href}
              className="text-title text-ink-strong transition-colors duration-150 ease-out hover:text-ink"
            >
              {item.productName}
            </Link>
            <span className="text-caption text-ink-subtle tabular-nums">
              {item.variantName}, {formatTaka(item.unitPricePaisa)} each
            </span>
          </div>
          <span className="shrink-0 text-price text-ink-strong tabular-nums">{formatTaka(item.lineTotalPaisa)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <QuantityStepper
              size="sm"
              label={`Quantity for ${item.productName}`}
              value={Math.min(qty, max)}
              max={max}
              onChange={(n) => cart.setQty(item.variantId, n)}
            />
            {item.problem ? (
              <span role="alert" className="text-caption text-ink tabular-nums">
                {item.problem.message}
              </span>
            ) : (
              qty >= max && (
                <span className="text-caption text-ink-subtle tabular-nums">
                  {max < item.stock ? `Limit ${max} per customer` : `Only ${item.stock} left`}
                </span>
              )
            )}
          </div>
          <button
            type="button"
            className={ghostButton + ' min-h-11 min-w-11 px-1'}
            aria-label={`Remove ${item.productName}`}
            onClick={() => cart.remove(item.variantId)}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}

function EmptyCart() {
  return (
    <section className="flex flex-col items-center gap-4 border-y border-line px-6 py-24 text-center">
      <h2 className="text-heading-3 text-ink-strong">Your cart is empty</h2>
      <p className="max-w-105 text-body text-ink-muted">
        Limited drops sell out. Have a look before they move to the archive.
      </p>
      <Link to="/shop" className={button('primary', 'md') + ' mt-3'}>
        Browse products
      </Link>
    </section>
  )
}
