import { Link, useParams } from 'react-router'
import { ProductGrid } from '../components/product/ProductCard'
import { ChipLink } from '../components/ui/Chip'
import { PageIntro } from '../components/ui/PageIntro'
import { container, textLink } from '../components/ui/styles'
import { getCategories, getCategory, getShopProducts } from '../lib/catalog'
import NotFound from './NotFound'

// /shop shows everything on sale; /shop/:category shows one collection.
export default function Shop() {
  const { category: categorySlug } = useParams()
  const category = categorySlug ? getCategory(categorySlug) : undefined

  // A collection name in the URL that does not exist
  if (categorySlug && !category) return <NotFound />

  const products = getShopProducts(category?.slug)
  const title = category ? category.name : 'All products'

  return (
    <div className={container + ' flex flex-col gap-10 py-16 sm:py-20'}>
      <title>{`${title}: Drakon`}</title>
      <PageIntro title={title}>
        <p>
          {category
            ? `Every piece in ${category.name} that is on sale now.`
            : 'Everything on sale now. Limited runs never come back once they sell out.'}
        </p>
      </PageIntro>

      {/* py-1 leaves room for the focus outline inside the scrolling row */}
      <nav aria-label="Collections" className="-mx-4 -my-1 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-1">
        <ul className="flex gap-2">
          <li>
            <ChipLink to="/shop" current={!category}>
              All
            </ChipLink>
          </li>
          {getCategories().map((c) => (
            <li key={c.slug}>
              <ChipLink to={`/shop/${c.slug}`} current={c.slug === category?.slug}>
                {c.name}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-caption text-ink-subtle tabular-nums" aria-live="polite">
        {products.length === 1 ? '1 piece' : `${products.length} pieces`}
      </p>

      <h2 className="sr-only">Products</h2>
      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-body-lg text-ink-muted">Nothing in this collection is on sale right now.</p>
          <Link to="/sold-out" className={textLink + ' text-label text-ink-muted'}>
            See what sold out
          </Link>
        </div>
      )}
    </div>
  )
}
