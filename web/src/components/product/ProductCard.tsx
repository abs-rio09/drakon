import { Link } from 'react-router'
import { useSite } from '../../features/site/SiteContext'
import { getProduct } from '../../lib/api'
import { isArchived, metaLine, priceLabel, stockFact } from '../../lib/catalog'
import type { Product } from '../../lib/types'
import { prefetchApi } from '../../lib/useApi'
import { SoldOutBadge } from './Badge'
import { GalleryLabel } from './GalleryLabel'
import { productPhotoName } from './photoName'
import { ProductPhoto } from './ProductPhoto'
import { QuickAdd } from './QuickAdd'

// What a card hands to the product page through the link (router state):
// the photo it shows, so the page can put it in place at once and the
// photo flies from the card into the page (ProductPhoto shareName).
export type ProductLinkState = { photo?: { src: string; thumb?: string } }

// The product tile in every grid. No box: the photo, then a flat gallery label.
// See docs/design/components/ProductCard/README.md
export function ProductCard({ product }: { product: Product }) {
  const { settings } = useSite()
  const href = `/product/${product.slug}`
  const soldOut = isArchived(product)
  const cover = product.images[0]
  const linkState: ProductLinkState = { photo: cover ? { src: cover.src, thumb: cover.thumb } : undefined }
  // Pointer over or pressing the card: start loading the product page.
  const warm = () => prefetchApi(`product:${product.slug}`, () => getProduct(product.slug))

  return (
    // relative: the name link's invisible box covers the whole card (below);
    // the photo part sits above it (z-10), so Quick add stays its own button.
    <article className="group relative flex flex-col gap-4">
      <div className="relative z-10">
        {/* The photo repeats the title link, so screen readers and the Tab key skip it */}
        <Link to={href} state={linkState} tabIndex={-1} aria-hidden="true" onPointerEnter={warm} onPointerDown={warm}>
          <ProductPhoto
            src={cover?.src ?? ''}
            thumb={cover?.thumb}
            alt=""
            soldOut={soldOut}
            shareName={productPhotoName(product.slug)}
          />
        </Link>
        {soldOut ? <SoldOutBadge /> : <QuickAdd product={product} />}
      </div>
      <GalleryLabel
        name={
          <Link
            to={href}
            state={linkState}
            onPointerEnter={warm}
            onPointerDown={warm}
            onFocus={warm}
            className="transition-colors duration-fast ease-out-drakon after:absolute after:inset-0 after:content-[''] hover:text-ink">
            {product.name}
          </Link>
        }
        meta={metaLine(product)}
        price={priceLabel(product)}
        fact={stockFact(product, settings)}
        soldOut={soldOut}
      />
    </article>
  )
}

// Grid for product cards: 2 columns on phones, 3 from 640px, 4 from 1024px.
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  )
}
