import { useSearchParams } from 'react-router'
import { SearchIcon } from '../components/icons'
import { ProductGrid } from '../components/product/ProductCard'
import { PageIntro } from '../components/ui/PageIntro'
import { container } from '../components/ui/styles'
import { searchProducts } from '../lib/catalog'

// /search?q=hoodie — search by product name. The words live in the URL,
// so a search can be shared or reloaded.
export default function Search() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const results = searchProducts(query)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')
    setParams(typeof q === 'string' && q.trim() !== '' ? { q: q.trim() } : {})
  }

  return (
    <div className={container + ' flex flex-col gap-10 py-16 sm:py-20'}>
      <title>Search: Drakon</title>
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
          className="min-h-12 rounded-xl border border-line-strong px-5 text-label text-ink-strong transition-colors duration-150 ease-out hover:bg-field"
        >
          Search
        </button>
      </form>

      {query !== '' && (
        <p className="text-body text-ink-muted" aria-live="polite">
          {results.length === 0
            ? `Nothing found for "${query}".`
            : `${results.length} ${results.length === 1 ? 'result' : 'results'} for "${query}"`}
        </p>
      )}
      {results.length > 0 && <ProductGrid products={results} />}
    </div>
  )
}
