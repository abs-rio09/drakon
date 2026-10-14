import { Link } from 'react-router'
import { isArchived, metaLine, priceLabel, stockFact } from '../../lib/catalog'
import type { Product } from '../../mocks/catalog'
import { SoldOutBadge } from './Badge'
import { GalleryLabel } from './GalleryLabel'
import { ProductPhoto } from './ProductPhoto'

// The product tile in every grid. No box: the photo, then a flat gallery label.
// See docs/design/components/ProductCard/README.md
export function ProductCard({ product }: { product: Product }) {
  const href = `/product/${product.slug}`
  const soldOut = isArchived(product)
  const cover = product.images[0]

  return (
    <article className="group flex flex-col gap-4">
      <div className="relative">
        {/* The photo repeats the title link, so screen readers and the Tab key skip it */}
        <Link to={href} tabIndex={-1} aria-hidden="true">
          <ProductPhoto src={cover.src} alt="" soldOut={soldOut} />
        </Link>
        {soldOut && <SoldOutBadge />}
      </div>
      <GalleryLabel
        name={
          <Link to={href} className="transition-colors duration-150 ease-out hover:text-ink">
            {product.name}
          </Link>
        }
        meta={metaLine(product)}
        price={priceLabel(product)}
        fact={stockFact(product)}
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
