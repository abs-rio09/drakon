import { Link } from 'react-router'
import { CashIcon, TruckIcon } from '../components/icons'
import { QuantityStepper } from '../components/ui/QuantityStepper'
import { container, ghostButton, panel, primaryButton, textLink } from '../components/ui/styles'
import { resolveCart, subtotalPaisa, type CartItem } from '../features/cart/cartItems'
import { useCart } from '../features/cart/useCart'
import { findVariant, variantName } from '../lib/catalog'
import { getZone } from '../lib/delivery'
import { formatTaka } from '../lib/money'
import { settings } from '../mocks/settings'

// /cart — laid out from docs/design/screens/Cart.dc.html
export default function Cart() {
  const cart = useCart()
  const { items, unavailable } = resolveCart(cart.lines)
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const countLabel = count === 1 ? '1 item' : `${count} items`
  const subtotal = subtotalPaisa(items)

  return (
    <div className={container + ' flex flex-col gap-10 py-16 sm:py-20'}>
      <title>Your cart: Drakon</title>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">Your cart</h1>
        {items.length > 0 && <span className="text-body text-ink-muted tabular-nums">{countLabel}</span>}
      </div>

      {unavailable.length > 0 && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3">
          <p className="text-label font-normal text-ink">
            {unavailable.length === 1 ? 'One piece' : `${unavailable.length} pieces`} in your cart sold out and can no
            longer be ordered:
          </p>
          <ul className="flex flex-col gap-1 text-caption text-ink-muted">
            {unavailable.map((line) => {
              const found = findVariant(line.variantId)
              return (
                <li key={line.variantId} className="flex flex-wrap items-center justify-between gap-3">
                  <span>{found ? `${found.product.name}, ${variantName(found.product, found.variant)}` : 'A removed product'}</span>
                  <button type="button" className={ghostButton} onClick={() => cart.remove(line.variantId)}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
          <section aria-label="Items in your cart" className="flex flex-col">
            <ul className="flex flex-col border-t border-line">
              {items.map((item) => (
                <CartRow key={item.variant.id} item={item} />
              ))}
            </ul>
            <Link to="/shop" className={textLink + ' mt-6 self-start text-label text-ink-muted'}>
              Continue shopping
            </Link>
          </section>

          <aside aria-label="Order summary" className={panel + ' flex flex-col gap-6 p-6 sm:p-8 lg:sticky lg:top-24'}>
            <h2 className="text-heading-3 text-ink-strong">Summary</h2>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between gap-4">
                <dt className="text-body text-ink-muted tabular-nums">Subtotal ({countLabel})</dt>
                <dd className="text-body text-ink-strong tabular-nums">{formatTaka(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex flex-col">
                  <span className="text-body text-ink-muted">Delivery</span>
                  <span className="text-caption text-ink-subtle tabular-nums">
                    {formatTaka(getZone('INSIDE_DHAKA').chargePaisa)} inside Dhaka,{' '}
                    {formatTaka(getZone('OUTSIDE_DHAKA').chargePaisa)} outside
                  </span>
                </dt>
                <dd className="text-body whitespace-nowrap text-ink-muted">Set at checkout</dd>
              </div>
            </dl>
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-6">
              <span className="text-body font-medium text-ink-strong">Total before delivery</span>
              <span className="text-price-lg text-ink-strong tabular-nums">{formatTaka(subtotal)}</span>
            </div>
            <Link to="/checkout" className={primaryButton + ' min-h-13 w-full text-body'}>
              Go to checkout
            </Link>
            <ul className="flex flex-col gap-3 text-caption text-ink-subtle">
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

function CartRow({ item }: { item: CartItem }) {
  const cart = useCart()
  const { product, variant, qty, max } = item
  const href = `/product/${product.slug}`
  const thumb = product.images[variant.imageIndex ?? 0]?.thumb ?? product.images[0].thumb

  return (
    <li className="flex gap-4 border-b border-line py-6 sm:gap-6">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <img src={thumb} alt="" className="size-20 rounded-lg bg-field object-cover sm:size-24" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              to={href}
              className="text-body font-medium text-ink-strong transition-colors duration-150 ease-out hover:text-ink sm:text-title"
            >
              {product.name}
            </Link>
            <span className="text-caption text-ink-muted tabular-nums">
              {variantName(product, variant)}, {formatTaka(variant.pricePaisa)} each
            </span>
          </div>
          <span className="text-price text-ink-strong tabular-nums">{formatTaka(item.linePaisa)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper
              label={`Quantity for ${product.name}`}
              value={qty}
              max={max}
              onChange={(n) => cart.setQty(variant.id, n)}
            />
            {qty >= max && (
              <span className="text-caption text-ink-subtle tabular-nums">
                {max < variant.stock || variant.stock === 0 ? `Limit ${max} per customer` : `Only ${variant.stock} left`}
              </span>
            )}
          </div>
          <button
            type="button"
            className={ghostButton}
            aria-label={`Remove ${product.name}`}
            onClick={() => cart.remove(variant.id)}
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
    <section className="flex flex-col items-center gap-6 py-16 text-center">
      <h2 className="text-heading-3 text-ink-strong">Your cart is empty</h2>
      <p className="max-w-text text-body text-ink-muted">
        Limited drops sell out. Have a look before they move to the archive.
      </p>
      <Link to="/shop" className={primaryButton}>
        Browse products
      </Link>
    </section>
  )
}
