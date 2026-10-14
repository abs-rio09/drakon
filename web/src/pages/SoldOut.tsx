import { useState } from 'react'
import { Link } from 'react-router'
import { ArchiveCard } from '../components/product/ArchiveCard'
import { SoldOutBadge } from '../components/product/Badge'
import { ProductPhoto } from '../components/product/ProductPhoto'
import { ChipButton } from '../components/ui/Chip'
import { PageIntro } from '../components/ui/PageIntro'
import { container, primaryButton, textLink } from '../components/ui/styles'
import { getArchive, getCategories, getProduct, metaLine, priceLabel } from '../lib/catalog'

// /sold-out — the archive of every limited run that sold out (SoldOut.dc.html).
// Sold-out products are never deleted or hidden; they live here for good.
export default function SoldOut() {
  const archive = getArchive()
  const [filter, setFilter] = useState('all')
  const latest = archive[0]
  const shown = archive.filter((p) => filter === 'all' || p.categorySlug === filter)

  return (
    <div className="flex flex-col">
      <title>The archive: Drakon</title>
      <section className={container + ' pt-16 pb-12 sm:pt-20'}>
        <PageIntro title="The archive">
          <p>
            Every DRAKON run that sold out. Limited pieces are never made again, so this is the only place you will see
            them.
          </p>
        </PageIntro>
      </section>

      {latest && <LatestSoldOut slug={latest.slug} />}

      <section aria-labelledby="all-title" className={container + ' flex flex-col gap-10 py-20 lg:py-32'}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="all-title" className="text-heading-3 text-ink-strong sm:text-heading-2">
            Every sold-out run
          </h2>
          <div role="group" aria-label="Filter by collection" className="flex flex-wrap gap-2">
            <ChipButton pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </ChipButton>
            {getCategories().map((c) => (
              <ChipButton key={c.slug} pressed={filter === c.slug} onClick={() => setFilter(c.slug)}>
                {c.name}
              </ChipButton>
            ))}
          </div>
        </div>

        {shown.length > 0 ? (
          <ul className="grid border-t border-line md:grid-cols-3 md:gap-6 md:border-0 lg:gap-10" aria-live="polite">
            {shown.map((p) => (
              <li key={p.id}>
                <ArchiveCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-12 text-center text-body text-ink-muted" aria-live="polite">
            Nothing in this collection has sold out yet.
          </p>
        )}

        <div className="flex flex-col items-start gap-4 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-lg text-ink-muted">Some pieces are still in their run.</p>
          <Link to="/shop" className={primaryButton}>
            Shop the current drop
          </Link>
        </div>
      </section>
    </div>
  )
}

// The most recent run to sell out, shown large.
function LatestSoldOut({ slug }: { slug: string }) {
  const product = getProduct(slug)
  if (!product) return null
  const cover = product.images[0]
  const successor = product.successorSlug ? getProduct(product.successorSlug) : undefined

  return (
    <section aria-labelledby="latest-title" className={container}>
      <div className="grid items-center gap-8 border-t border-line pt-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
        <div className="relative">
          <ProductPhoto src={cover.src} alt={cover.alt} aspect="aspect-[4/3]" soldOut zoomOnHover={false} eager />
          <SoldOutBadge />
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 id="latest-title" className="text-heading-3 text-ink-muted sm:text-heading-2">
                {product.name}
              </h2>
              <span className="text-body text-ink-subtle">{metaLine(product)}. The latest to sell out.</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
              <span className="text-price-lg text-ink-subtle tabular-nums line-through">
                <span className="sr-only">Was </span>
                {priceLabel(product)}
              </span>
              <span className="text-figure text-ink-muted">Sold out, never restocked</span>
            </div>
          </div>
          <p className="text-body-lg text-ink-muted">{product.summary}</p>
          {successor && (
            <Link to={`/product/${successor.slug}`} className={textLink + ' self-start text-label text-ink-strong'}>
              See {successor.name}, on sale now
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
