import { useState } from 'react'
import { Link } from 'react-router'
import { ArchiveCard } from '../components/product/ArchiveCard'
import { SoldOutBadge } from '../components/product/Badge'
import { ProductPhoto } from '../components/product/ProductPhoto'
import { ChipButton } from '../components/ui/Chip'
import { Loaded } from '../components/ui/LoadState'
import { button, container, textLink } from '../components/ui/styles'
import { getCategories, getProducts, getSoldOut } from '../lib/api'
import { metaLine, priceLabel } from '../lib/catalog'
import type { Product } from '../lib/types'
import { useApi } from '../lib/useApi'

const loadShop = () => getProducts({ limit: 100 })

// /sold-out — the archive of every limited run that sold out (SoldOut.dc.html).
// Sold-out products are never deleted or hidden; they live here for good.
export default function SoldOut() {
  const state = useApi('sold-out', getSoldOut)
  const cats = useApi('categories', getCategories)
  const [filter, setFilter] = useState('all')
  const archive = state.data ?? []
  const latest = archive[0]
  const shown = archive.filter((p) => filter === 'all' || p.categorySlug === filter)

  return (
    <div className="flex flex-col">
      <title>The archive: Drakon</title>
      <section className={container + ' flex flex-col gap-5 pt-16 pb-16 sm:pt-24'}>
        <h1 className="text-heading-1 text-ink-strong sm:text-display-md">The archive</h1>
        <p className="max-w-text text-body-lg text-ink-muted">
          Every DRAKON run that sold out. Limited pieces are never made again, so this is the only place you will see
          them.
        </p>
      </section>

      {state.status !== 'ready' && (
        <div className={container}>
          <Loaded state={state}>{() => null}</Loaded>
        </div>
      )}
      {latest && <LatestSoldOut product={latest} />}

      <section aria-labelledby="all-title" className={container + ' flex flex-col gap-8 pb-20 sm:pb-32'}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-10">
          <h2 id="all-title" className="text-heading-3 text-ink-strong">
            Every sold-out run
          </h2>
          <div
            role="group"
            aria-label="Filter by collection"
            className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            <ChipButton pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </ChipButton>
            {(cats.data ?? []).map((c) => (
              <ChipButton key={c.slug} pressed={filter === c.slug} onClick={() => setFilter(c.slug)}>
                {c.name}
              </ChipButton>
            ))}
          </div>
        </div>

        <p role="status" className="sr-only">
          {shown.length === 1 ? '1 sold-out run shown' : `${shown.length} sold-out runs shown`}
        </p>
        {state.status !== 'ready' ? null : shown.length > 0 ? (
          <ul className="grid gap-y-10 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3 lg:gap-x-10">
            {shown.map((p) => (
              <li key={p.id}>
                <ArchiveCard product={p} layout="grid" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-12 text-center text-body text-ink-muted">
            Nothing in this collection has sold out yet.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-10">
          <p className="text-body text-ink-muted">Some pieces are still in their run.</p>
          <Link to="/shop" className={button('primary', 'md')}>
            Shop the current drop
          </Link>
        </div>
      </section>
    </div>
  )
}

// The most recent run to sell out, shown large.
function LatestSoldOut({ product }: { product: Product }) {
  const cover = product.images[0]
  // The newer edition is linked only while it is on sale.
  const shop = useApi('shop:all', loadShop)
  const successor = product.successorSlug
    ? shop.data?.products.find((p) => p.slug === product.successorSlug)
    : undefined

  return (
    <section aria-labelledby="latest-title" className={container + ' pb-24'}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 border-t border-line pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="relative">
          <ProductPhoto src={cover?.src ?? ''} alt={cover?.alt ?? product.name} aspect="aspect-[4/3]" soldOut zoomOnHover={false} eager />
          <SoldOutBadge />
        </div>
        <div className="flex max-w-110 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 id="latest-title" className="text-heading-3 text-ink-strong sm:text-heading-2">
                {product.name}
              </h2>
              <span className="text-body text-ink-muted">{metaLine(product)}. The latest to sell out.</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
              <span className="text-price-lg text-ink-subtle tabular-nums line-through">
                <span className="sr-only">Was </span>
                {priceLabel(product)}
              </span>
              <span className="text-figure text-ink-muted">Sold out, never restocked</span>
            </div>
          </div>
          <p className="text-body text-ink-muted">{product.summary}</p>
          {successor && (
            <Link to={`/product/${successor.slug}`} className={textLink + ' self-start text-body font-medium text-ink-strong'}>
              See {successor.name}, on sale now
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
