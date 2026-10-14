import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CashIcon, LockIcon, ReturnIcon, TruckIcon } from '../components/icons'
import { LimitedBadge, SoldOutBadge } from '../components/product/Badge'
import { ProductGrid } from '../components/product/ProductCard'
import { ProductPhoto } from '../components/product/ProductPhoto'
import { VariantPicker } from '../components/product/VariantPicker'
import { QuantityStepper } from '../components/ui/QuantityStepper'
import { container, primaryButtonLarge, textLink } from '../components/ui/styles'
import {
  getCategory,
  getProduct,
  getRelated,
  isArchived,
  metaLine,
  priceLabel,
  purchaseLimit,
  stockFact,
  totalStock,
} from '../lib/catalog'
import { getZone } from '../lib/delivery'
import { formatTaka } from '../lib/money'
import type { Product as ProductType, Variant } from '../mocks/catalog'
import { settings } from '../mocks/settings'
import NotFound from './NotFound'

// /product/:slug — laid out from Product.dc.html (sizes) and
// ProductCard.dc.html (materials with their own price).
export default function Product() {
  const { slug = '' } = useParams()
  const product = getProduct(slug)
  if (!product) return <NotFound />

  // `key` makes React start fresh (new state) when we move to another product.
  return <ProductView key={product.id} product={product} />
}

function ProductView({ product }: { product: ProductType }) {
  const archived = isArchived(product)
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0]

  const [variantId, setVariantId] = useState(firstInStock.id)
  const [qty, setQty] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)

  const variant = product.variants.find((v) => v.id === variantId) ?? firstInStock
  const limit = purchaseLimit(product)
  const maxQty = Math.max(1, Math.min(limit, variant.stock))
  const canBuy = !archived && variant.stock > 0
  const category = getCategory(product.categorySlug)
  const image = product.images[imageIndex] ?? product.images[0]

  function selectVariant(v: Variant) {
    setVariantId(v.id)
    setQty(1)
    if (v.imageIndex !== undefined) setImageIndex(v.imageIndex)
  }

  return (
    <>
      <title>{`${product.name}: Drakon`}</title>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className={container + ' pt-8 pb-6 sm:pt-10'}>
        <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-subtle">
          <li>
            <Link to="/shop" className={textLink + ' text-ink-muted'}>
              Shop
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link to={`/shop/${category.slug}`} className={textLink + ' text-ink-muted'}>
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <section className={container + ' grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20'}>
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <ProductPhoto key={image.src} src={image.src} alt={image.alt} soldOut={archived} zoomOnHover={false} eager />
            {archived ? (
              <SoldOutBadge />
            ) : (
              product.isLimited && (
                <LimitedBadge>{product.editionSize ? `Edition of ${product.editionSize}` : 'Limited run'}</LimitedBadge>
              )
            )}
          </div>
          {product.images.length > 1 && (
            <div
              role="group"
              aria-label="Product photos"
              className={
                'grid gap-2 sm:gap-3 ' + (product.images.length > 4 ? 'grid-cols-5' : 'grid-cols-4')
              }
            >
              {product.images.map((img, i) => (
                <button
                  key={img.src}
                  type="button"
                  aria-label={`Show photo: ${img.name}`}
                  aria-pressed={i === imageIndex}
                  onClick={() => setImageIndex(i)}
                  className={
                    'aspect-square overflow-hidden rounded-xl border bg-field transition-[border-color,opacity] duration-150 ease-out hover:opacity-100 ' +
                    (i === imageIndex ? 'border-ink-strong opacity-100' : 'border-line opacity-60')
                  }
                >
                  <img src={img.thumb} alt="" className={'size-full object-cover ' + (archived ? 'grayscale' : '')} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="flex flex-col gap-8 lg:pt-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">{product.name}</h1>
              <span className="text-body text-ink-muted">{metaLine(product)}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
              <span
                className={
                  'text-price-lg tabular-nums ' + (archived ? 'text-ink-subtle line-through' : 'text-ink-strong')
                }
              >
                {archived && <span className="sr-only">Was </span>}
                {archived ? priceLabel(product) : formatTaka(variant.pricePaisa)}
              </span>
              <span className="text-figure text-ink-muted tabular-nums">
                {archived ? 'Sold out, never restocked' : totalStockLabel(product)}
              </span>
            </div>
          </div>

          <p className="max-w-130 text-body-lg text-ink-muted">{product.summary}</p>

          {archived ? (
            <ArchivedNote />
          ) : (
            <>
              {product.variants.length > 1 && (
                <div className="flex flex-col gap-3">
                  <VariantPicker product={product} selectedId={variant.id} onSelect={selectVariant} />
                  {product.variantKind === 'Size' && (
                    <a href="#details" className={textLink + ' self-start text-label text-ink-muted'}>
                      Size guide
                    </a>
                  )}
                  {!product.variants.some((v) => v.note) && (
                    <span className="text-caption text-ink-muted tabular-nums">{variantNote(product, variant)}</span>
                  )}
                </div>
              )}

              {canBuy && (
                <div className="flex flex-wrap items-center gap-4">
                  <QuantityStepper label="Quantity" value={qty} max={maxQty} onChange={setQty} />
                  <span className="text-caption text-ink-subtle tabular-nums">Limit {limit} per customer</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled
                  aria-describedby="cart-soon"
                  className={primaryButtonLarge + ' w-full justify-between'}
                >
                  <span>{canBuy ? 'Add to cart' : 'Out of stock'}</span>
                  {canBuy && <span className="tabular-nums">{formatTaka(variant.pricePaisa * qty)}</span>}
                </button>
                <span id="cart-soon" className="text-caption text-ink-subtle">
                  The cart opens in the next build step.
                </span>
              </div>
            </>
          )}

          <Promises product={product} />
        </div>
      </section>

      {(product.story.length > 0 || product.details.length > 0) && (
        <section id="details" aria-labelledby="details-title" className="scroll-mt-18">
          <div className={container + ' grid gap-10 py-20 lg:grid-cols-2 lg:gap-20 lg:py-32'}>
            <div className="flex flex-col gap-4">
              <h2 id="details-title" className="text-heading-3 text-ink-strong sm:text-heading-2">
                About this piece
              </h2>
              {product.story.map((para) => (
                <p key={para} className="text-body-lg text-ink-muted">
                  {para}
                </p>
              ))}
            </div>
            {product.details.length > 0 && (
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] border-t border-line">
                {product.details.map((d) => (
                  <div key={d.term} className="col-span-2 grid grid-cols-subgrid border-b border-line py-4">
                    <dt className="text-label text-ink-muted">{d.term}</dt>
                    <dd className="text-body text-ink">{d.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="related-title" className="border-t border-line">
        <div className={container + ' flex flex-col gap-14 py-20 lg:py-32'}>
          <h2 id="related-title" className="text-heading-3 text-ink-strong sm:text-heading-2">
            Pairs well with
          </h2>
          <ProductGrid products={getRelated(product)} />
        </div>
      </section>
    </>
  )
}

function totalStockLabel(product: ProductType): string {
  // For a run of known size the fact counts the whole run; otherwise all variants.
  if (product.editionSize || product.variants.length === 1) return stockFact(product)
  const left = totalStock(product)
  if (left === 0) return stockFact(product)
  return `${left} left in all ${product.variantKind.toLowerCase()}s`
}

function variantNote(product: ProductType, variant: Variant): string {
  const name = `${product.variantKind.toLowerCase()} ${variant.label}`
  if (variant.stock === 0) return `Sold out in ${name}`
  if (variant.stock <= settings.lowStockThreshold) return `Only ${variant.stock} left in ${name}`
  return 'In stock'
}

function ArchivedNote() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3">
      <p className="text-label font-normal text-ink">
        This run sold out and is kept in the archive. Limited pieces are never made again.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/sold-out" className={textLink + ' text-label text-ink-strong'}>
          See the archive
        </Link>
        <Link to="/shop" className={textLink + ' text-label text-ink-strong'}>
          Shop what is on sale
        </Link>
      </div>
    </div>
  )
}

// The promises under the buy box: facts, as a hairline list without a box.
function Promises({ product }: { product: ProductType }) {
  const inside = formatTaka(getZone('INSIDE_DHAKA').chargePaisa)
  const outside = formatTaka(getZone('OUTSIDE_DHAKA').chargePaisa)
  const items = [
    {
      icon: <CashIcon size={18} />,
      title: 'Cash on Delivery',
      text: <>Pay when it arrives. We call you to confirm before we ship.</>,
    },
    {
      icon: <TruckIcon size={18} />,
      title: `Delivery ${inside} inside Dhaka, ${outside} outside`,
      text: <>Set at checkout from your district.</>,
    },
    {
      icon: <ReturnIcon size={18} />,
      title: `Returns within ${settings.returnDays} days`,
      text: (
        <>
          Unused, in its original packaging.{' '}
          <Link to="/policies/returns" className={textLink + ' text-ink-muted'}>
            Return policy
          </Link>
        </>
      ),
    },
    product.isLimited
      ? { icon: <LockIcon size={18} />, title: 'One run only', text: <>Once it sells out it is never restocked.</> }
      : { icon: <LockIcon size={18} />, title: 'Restocks', text: <>When it runs out, more are made.</> },
  ]

  return (
    <ul className="flex flex-col border-t border-line">
      {items.map((item) => (
        <li key={item.title} className="flex gap-4 border-b border-line py-4">
          <span className="mt-0.5 shrink-0 text-ink-muted">{item.icon}</span>
          <div>
            <div className="text-body font-medium text-ink-strong tabular-nums">{item.title}</div>
            <div className="text-caption text-ink-subtle">{item.text}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
