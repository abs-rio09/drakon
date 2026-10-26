import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { CashIcon, CheckIcon, LockIcon, ReturnIcon, TruckIcon } from '../components/icons'
import { LimitedBadge, SoldOutBadge } from '../components/product/Badge'
import { ProductGrid, type ProductLinkState } from '../components/product/ProductCard'
import { productPhotoName } from '../components/product/photoName'
import { ProductPhoto } from '../components/product/ProductPhoto'
import { VariantPicker } from '../components/product/VariantPicker'
import { Loaded } from '../components/ui/LoadState'
import { PageMeta } from '../components/ui/PageMeta'
import { QuantityStepper } from '../components/ui/QuantityStepper'
import { button, container, tapArea, textLink } from '../components/ui/styles'
import { useCart } from '../features/cart/useCart'
import { useSite } from '../features/site/SiteContext'
import { ApiError, getCategories, getProduct } from '../lib/api'
import {
  isArchived,
  metaLine,
  priceLabel,
  purchaseLimit,
  stockFact,
  totalStock,
  variantName,
} from '../lib/catalog'
import { zoneCharge } from '../lib/delivery'
import { formatTaka } from '../lib/money'
import { shortDescription } from '../lib/text'
import type { Product as ProductType, PublicSettings, Variant } from '../lib/types'
import { useApi } from '../lib/useApi'
import NotFound from './NotFound'

// /product/:slug — laid out from Product.dc.html (sizes) and
// ProductCard.dc.html (materials with their own price).
export default function Product() {
  const { slug = '' } = useParams()
  const page = useApi(`product:${slug}`, () => getProduct(slug))
  // The photo of the card that was tapped, if we came from one.
  const from = useLocation().state as ProductLinkState | null

  // Unknown slug, or a DRAFT product (the API hides those).
  if (page.status === 'error' && page.error instanceof ApiError && page.error.status === 404) return <NotFound />

  return (
    <Loaded state={page} loading={<ProductSkeleton slug={slug} photo={from?.photo} />}>
      {/* `key` makes React start fresh (new state) when we move to another product. */}
      {({ product, related }) =>
        // A product needs at least one variant (price) to be shown.
        product.variants.length === 0 ? <NotFound /> : <ProductView key={product.id} product={product} related={related} />
      }
    </Loaded>
  )
}

// The product page's shape while it loads: the same grid, with the card's
// photo already in place (it flies in from the card) and quiet blocks for
// the text. Nothing moves when the real page replaces it.
function ProductSkeleton({ slug, photo }: { slug: string; photo?: { src: string; thumb?: string } }) {
  const block = 'block rounded-lg bg-field'
  return (
    <div role="status" aria-label="Loading the product">
      <div aria-hidden="true">
        <div className={container + ' pt-8 pb-6'}>
          <span className={block + ' h-4.5 w-40'} />
        </div>
        <section className={container + ' grid items-start gap-10 pb-20 sm:pb-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20'}>
          {photo ? (
            <ProductPhoto src={photo.src} alt="" zoomOnHover={false} priority shareName={productPhotoName(slug)} />
          ) : (
            <span className="block aspect-square rounded-2xl bg-field" />
          )}
          <div className="flex flex-col gap-4 lg:pt-2">
            <span className={block + ' h-12 w-4/5'} />
            <span className={block + ' h-6 w-1/2'} />
            <span className={block + ' mt-4 h-8 w-1/3'} />
            <span className={block + ' mt-4 h-24 w-full'} />
            <span className={block + ' mt-4 h-14 w-full rounded-xl'} />
          </div>
        </section>
      </div>
    </div>
  )
}

function ProductView({ product, related }: { product: ProductType; related: ProductType[] }) {
  const { settings } = useSite()
  const cats = useApi('categories', getCategories)
  const archived = isArchived(product)
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0]

  const [variantId, setVariantId] = useState(firstInStock.id)
  const [qty, setQty] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  // What was just added, for the "Added to your cart" message.
  const [added, setAdded] = useState<{ qty: number; name: string } | null>(null)
  const cart = useCart()

  const variant = product.variants.find((v) => v.id === variantId) ?? firstInStock
  const limit = purchaseLimit(product, settings)
  const inCart = cart.qtyOf(variant.id)
  // How many more of this variant may still go in the cart.
  // The purchase limit counts every variant of this product together (the
  // server checks it the same way); stock counts only this variant.
  const inCartForProduct = product.variants.reduce((sum, v) => sum + cart.qtyOf(v.id), 0)
  const remaining = Math.max(0, Math.min(limit - inCartForProduct, variant.stock - inCart))
  const canBuy = !archived && variant.stock > 0
  const canAdd = canBuy && remaining > 0
  const category = cats.data?.find((c) => c.slug === product.categorySlug)
  const image = product.images[imageIndex] ?? product.images[0]

  function selectVariant(v: Variant) {
    setVariantId(v.id)
    setQty(1)
    setAdded(null)
    if (v.imageIndex !== null) setImageIndex(v.imageIndex)
  }

  return (
    <>
      <PageMeta title={`${product.name}: Drakon`} description={shortDescription(product.summary)} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className={container + ' pt-8 pb-6'}>
        <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-subtle">
          <li>
            <Link
              to="/shop"
              className={tapArea + ' text-ink-muted transition-colors duration-fast ease-out-drakon hover:text-ink-strong hover:underline'}
            >
              Shop
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link to={`/shop/${category.slug}`} className={tapArea + ' text-ink-muted transition-colors duration-fast ease-out-drakon hover:text-ink-strong hover:underline'}>
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

      <section className={container + ' grid items-start gap-10 pb-20 sm:pb-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20'}>
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <ProductPhoto
              key={image.src}
              src={image.src}
              alt={image.alt}
              soldOut={archived}
              zoomOnHover={false}
              priority
              shareName={productPhotoName(product.slug)}
            />
            {archived ? (
              <SoldOutBadge position="top-4 left-4" />
            ) : (
              product.isLimited && (
                <LimitedBadge position="top-4 left-4">{product.editionSize ? `Edition of ${product.editionSize}` : 'Limited run'}</LimitedBadge>
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
                    'aspect-square overflow-hidden rounded-xl border bg-field transition-[border-color,opacity] duration-fast ease-out-drakon hover:opacity-100 ' +
                    (i === imageIndex ? 'border-ink-strong opacity-100' : 'border-line opacity-60')
                  }
                >
                  <img src={img.thumb} alt="" width={240} height={240} decoding="async" className={'size-full object-cover ' + (archived ? 'grayscale' : '')} />
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
                {archived ? 'Sold out, never restocked' : totalStockLabel(product, settings)}
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
                  <VariantPicker
                    product={product}
                    selectedId={variant.id}
                    onSelect={selectVariant}
                    aside={
                      product.variantKind === 'Size' && (
                        <a href="#details" className={textLink + ' text-label font-normal text-ink-muted'}>
                          Size guide
                        </a>
                      )
                    }
                  />
                  {!product.variants.some((v) => v.note) && (
                    <span className="text-caption text-ink-muted tabular-nums">{variantNote(product, variant, settings)}</span>
                  )}
                </div>
              )}

              {canAdd && (
                <div className="flex flex-wrap items-center gap-4">
                  <QuantityStepper
                    label="Quantity"
                    value={Math.min(qty, Math.max(1, remaining))}
                    max={Math.max(1, remaining)}
                    onChange={(n) => {
                      setQty(n)
                      setAdded(null)
                    }}
                  />
                  <span className="text-caption text-ink-subtle tabular-nums">Limit {limit} per customer</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={() => {
                    const n = Math.min(qty, remaining)
                    cart.add(variant.id, n)
                    setAdded({ qty: n, name: variantName(product, variant) })
                    setQty(1)
                  }}
                  className={button('primary', 'xl', { spread: true }) + ' w-full'}
                >
                  <span>{!canBuy ? 'Out of stock' : canAdd ? 'Add to cart' : 'Limit reached in your cart'}</span>
                  {canAdd && (
                    <span className="tabular-nums">{formatTaka(variant.pricePaisa * Math.min(qty, remaining))}</span>
                  )}
                </button>
                <div role="status">
                  {added ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-label font-normal text-ink">
                        <CheckIcon size={16} className="text-ink-strong" />
                        Added {added.qty} × {added.name} to your cart
                      </span>
                      <Link to="/cart" className={textLink + ' text-label text-ink-strong'}>
                        View cart
                      </Link>
                    </div>
                  ) : (
                    inCart > 0 && (
                      <span className="text-caption text-ink-subtle tabular-nums">
                        You have {inCart} in your cart.
                      </span>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          <Promises product={product} settings={settings} />
        </div>
      </section>

      {(product.story.length > 0 || product.details.length > 0) && (
        <section id="details" aria-labelledby="details-title" className="scroll-mt-18 border-t border-line">
          <div className={container + ' grid gap-10 py-20 sm:py-24 lg:grid-cols-2 lg:gap-20'}>
            <div className="flex max-w-130 flex-col gap-4">
              <h2 id="details-title" className="mb-2 text-heading-3 text-ink-strong sm:text-heading-2">
                About this piece
              </h2>
              {product.story.map((para) => (
                <p key={para} className="text-body text-ink-muted">
                  {para}
                </p>
              ))}
            </div>
            {product.details.length > 0 && (
              <dl className="grid content-start grid-cols-[minmax(96px,auto)_minmax(0,1fr)] gap-x-6 border-t border-line">
                {product.details.map((d) => (
                  <div key={d.term} className="col-span-2 grid grid-cols-subgrid border-b border-line py-4">
                    <dt className="text-label font-normal text-ink-subtle">{d.term}</dt>
                    <dd className="text-label font-normal text-ink">{d.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-t border-line">
          <div className={container + ' flex flex-col gap-14 pt-20 pb-24 sm:pt-24 sm:pb-32'}>
            <h2 id="related-title" className="text-heading-3 text-ink-strong sm:text-heading-2">
              Pairs well with
            </h2>
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </>
  )
}

function totalStockLabel(product: ProductType, settings: PublicSettings): string {
  // For a run of known size the fact counts the whole run; otherwise all variants.
  if (product.editionSize || product.variants.length === 1) return stockFact(product, settings)
  const left = totalStock(product)
  if (left === 0) return stockFact(product, settings)
  return `${left} left in all ${product.variantKind.toLowerCase()}s`
}

function variantNote(product: ProductType, variant: Variant, settings: PublicSettings): string {
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
function Promises({ product, settings }: { product: ProductType; settings: PublicSettings }) {
  const { delivery } = useSite()
  const inside = zoneCharge(delivery, 'INSIDE_DHAKA')
  const outside = zoneCharge(delivery, 'OUTSIDE_DHAKA')
  const deliveryTitle =
    inside !== undefined && outside !== undefined
      ? `Delivery ${formatTaka(inside)} inside Dhaka, ${formatTaka(outside)} outside`
      : 'Delivery across Bangladesh'
  const items = [
    {
      icon: <CashIcon size={18} />,
      title: 'Cash on Delivery',
      text: <>Pay when it arrives. We call you to confirm before we ship.</>,
    },
    {
      icon: <TruckIcon size={18} />,
      title: deliveryTitle,
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
