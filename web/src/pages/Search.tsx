import { useSearchParams } from 'react-router'
import { SearchIcon } from '../components/icons'
import { ProductGrid } from '../components/product/ProductCard'
import { Loaded, ProductGridSkeleton } from '../components/ui/LoadState'
import { PageIntro } from '../components/ui/PageIntro'
import { PageMeta } from '../components/ui/PageMeta'
import { container } from '../components/ui/styles'
import { getProducts } from '../lib/api'
import type { ProductPage } from '../lib/api'
import { searchPageSize, searchSummary } from '../lib/search'
import { useApi } from '../lib/useApi'

const noResults: Promise<ProductPage> = Promise.resolve({ products: [], total: 0, limit: 0, offset: 0 })

// /search?q=hoodie — search by product name. The words live in the URL,
// so a search can be shared or reloaded.
export default function Search() {
  const [params, setParams] = useSearchParams()
  const query = (params.get('q') ?? '').trim().slice(0, 100)
  const search = useApi(`search:${query}`, () => (query === '' ? noResults : getProducts({ q: query, limit: searchPageSize })))

  function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')
    setParams(typeof q === 'string' && q.trim() !== '' ? { q: q.trim() } : {})
  }

  return (
    <div className={container + ' flex flex-col gap-10 py-16 sm:py-20'}>
      <PageMeta title={query ? `Search: ${query}: Drakon` : 'Search: Drakon'} description="Search the DRAKON shop by product name." noindex />
      <PageIntro title="Search" />

      <form role="search" onSubmit={onSubmit} className="flex max-w-form gap-2">
        <label htmlFor="search-q" className="sr-only">
          Search products
        </label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle" />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={query}
            key={query}
            placeholder="Search by name, for example hoodie"
            className="h-12 w-full rounded-xl border border-line-strong bg-field pr-4 pl-12 text-body text-ink placeholder:text-ink-subtle hover:border-ink-subtle"
          />
        </div>
        <button
          type="submit"
          className="min-h-12 rounded-xl border border-line-strong px-5 text-label text-ink-strong transition-colors duration-fast ease-out-drakon hover:bg-field"
        >
          Search
        </button>
      </form>

      {query !== '' && (
        <Loaded state={search} loading={<ProductGridSkeleton />}>
          {({ products: results, total }) => (
            <>
              <p className="text-body text-ink-muted" aria-live="polite">
                {searchSummary(query, results.length, total)}
              </p>
              {results.length > 0 && (
                <section aria-labelledby="results-title">
                  <h2 id="results-title" className="sr-only">
                    Results
                  </h2>
                  <ProductGrid products={results} />
                </section>
              )}
            </>
          )}
        </Loaded>
      )}
    </div>
  )
}
