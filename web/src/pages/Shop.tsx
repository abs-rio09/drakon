import { Link, useParams } from 'react-router'
import { ProductGrid } from '../components/product/ProductCard'
import { ChipLink } from '../components/ui/Chip'
import { Loaded, ProductGridSkeleton } from '../components/ui/LoadState'
import { useStagger } from '../components/ui/stagger'
import { PageIntro } from '../components/ui/PageIntro'
import { PageMeta } from '../components/ui/PageMeta'
import { container, textLink } from '../components/ui/styles'
import { getCategories, getProducts } from '../lib/api'
import { useApi } from '../lib/useApi'
import NotFound from './NotFound'

// The shop shows at most this many pieces per page. Far more than we sell
// today; paging buttons come when the catalogue grows past it.
const PAGE_SIZE = 100

// /shop shows everything on sale; /shop/:category shows one collection.
export default function Shop() {
  const { category: categorySlug } = useParams()
  const cats = useApi('categories', getCategories)
  const products = useApi(`shop:${categorySlug ?? 'all'}`, () =>
    getProducts({ category: categorySlug, limit: PAGE_SIZE }),
  )

  const item = useStagger(products.status)
  const categories = cats.data ?? []
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined

  // A collection name in the URL that does not exist
  if (categorySlug && cats.status === 'ready' && !category) return <NotFound />

  const title = category ? category.name : categorySlug ? '' : 'All products'

  return (
    <div className={container + ' flex flex-col gap-10 py-16 sm:py-20'}>
      <PageMeta
        title={title ? `${title}: Drakon` : 'Drakon'}
        description={
          category
            ? `${category.name} from DRAKON: limited runs, made once and never restocked. Cash on Delivery across Bangladesh.`
            : 'Every DRAKON piece on sale now: limited playcards, sports toys, tech toys and clothes. Cash on Delivery across Bangladesh.'
        }
      />
      <PageIntro title={title || 'Collection'}>
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
            <ChipLink to="/shop" current={!categorySlug}>
              All
            </ChipLink>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <ChipLink to={`/shop/${c.slug}`} current={c.slug === categorySlug}>
                {c.name}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>

      <Loaded
        state={products}
        loading={
          // The "N pieces" line's place too, so the grid does not move down
          // when the products arrive.
          <>
            <span aria-hidden="true" className="flex h-4.5 items-center">
              <span className="block h-3 w-16 rounded bg-field" />
            </span>
            <ProductGridSkeleton count={8} />
          </>
        }
      >
        {({ products: items, total }) => (
          <>
            <p className="text-caption text-ink-subtle tabular-nums" aria-live="polite">
              {total === 1 ? '1 piece' : `${total} pieces`}
            </p>

            <h2 className="sr-only">Products</h2>
            {items.length > 0 ? (
              <ProductGrid products={items} item={item} />
            ) : (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <p className="text-body-lg text-ink-muted">Nothing in this collection is on sale right now.</p>
                <Link to="/sold-out" className={textLink + ' text-label text-ink-muted'}>
                  See what sold out
                </Link>
              </div>
            )}
          </>
        )}
      </Loaded>
    </div>
  )
}
