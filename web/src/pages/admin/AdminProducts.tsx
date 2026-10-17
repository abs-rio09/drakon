import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { LimitedTag, ProductStatusBadge } from '../../components/admin/adminUi'
import { PlusIcon, SearchIcon } from '../../components/icons'
import { inputClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button } from '../../components/ui/styles'
import { getAdminCategories, getAdminProducts } from '../../features/admin/adminApi'
import type { AdminProductRow, ProductStatus } from '../../features/admin/types'
import { getPublicSettings } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'
import { formatTaka } from '../../lib/money'
import { useApi } from '../../lib/useApi'

const tabs: { status: ProductStatus | ''; label: string }[] = [
  { status: 'ACTIVE', label: 'Active' },
  { status: 'DRAFT', label: 'Draft' },
  { status: 'SOLD_OUT', label: 'Sold out' },
  { status: 'ARCHIVED', label: 'Archived' },
  { status: '', label: 'All' },
]

function priceText(p: AdminProductRow) {
  if (p.minPricePaisa === 0) return '—'
  if (p.minPricePaisa === p.maxPricePaisa) return formatTaka(p.minPricePaisa)
  return `${formatTaka(p.minPricePaisa)}–${formatTaka(p.maxPricePaisa)}`
}

function variantsText(p: AdminProductRow) {
  const n = p.variantCount === 1 ? '1 variant' : `${p.variantCount} variants`
  return p.emptyVariants > 0 && p.status === 'ACTIVE' ? `${n} · ${p.emptyVariants} at 0` : n
}

function statusNote(p: AdminProductRow) {
  switch (p.status) {
    case 'DRAFT':
      return p.minPricePaisa === 0 ? 'Price not set' : 'Not published'
    case 'SOLD_OUT':
      return p.soldOutAt ? `Sold out ${formatDateTime(p.soldOutAt)}` : ''
    case 'ARCHIVED':
      return 'In the Sold Out showcase'
    default:
      return p.featuredOrder ? `In the drop, place ${p.featuredOrder}` : ''
  }
}

// /admin/products (docs/design/screens/AdminProducts.dc.html)
export default function AdminProducts() {
  const [params, setParams] = useSearchParams()
  const status = (params.has('status') ? params.get('status') : 'ACTIVE') as ProductStatus | ''
  const category = params.get('category') ?? ''
  const q = params.get('q') ?? ''
  const [search, setSearch] = useState(q)

  const list = useApi(`admin:products:${status}:${category}:${q}`, () => getAdminProducts({ status, category, q }))
  const categories = useApi('admin:categories', getAdminCategories)
  const settings = useApi('admin:public-settings', getPublicSettings)
  const low = settings.data?.lowStockThreshold

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (k === 'status') p.set(k, v) // "" = All, kept so the default (Active) does not come back
      else if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p)
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    update({ q: search.trim() })
  }

  return (
    <>
      <AdminPageHeader
        title="Products"
        intro="Products are never deleted. Sold-out limited runs move to the archive."
        actions={
          <>
            <form role="search" onSubmit={onSearch} className="relative w-full sm:w-64">
              <label htmlFor="p-search" className="sr-only">
                Search products
              </label>
              <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle" />
              <input
                id="p-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or SKU"
                className={inputClass + ' pl-10'}
              />
            </form>
            <Link to="/admin/products/new" className={button('primary', 'md')}>
              <PlusIcon size={16} />
              New product
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 border-b border-line sm:flex-row sm:items-end sm:justify-between">
        <div role="group" aria-label="Filter by lifecycle" className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const pressed = t.status === status
            const counts = list.data?.counts
            const count = counts ? (t.status === '' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t.status]) : undefined
            return (
              <button
                key={t.label}
                type="button"
                aria-pressed={pressed}
                onClick={() => update({ status: t.status })}
                className={
                  'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-label whitespace-nowrap transition-colors duration-150 ease-out hover:text-ink-strong ' +
                  (pressed ? 'border-ink-strong text-ink-strong' : 'border-transparent text-ink-muted')
                }
              >
                {t.label}
                {count !== undefined && <span className="text-micro text-ink-subtle tabular-nums">{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="pb-3">
          <label htmlFor="p-cat" className="sr-only">
            Category
          </label>
          <select id="p-cat" value={category} onChange={(e) => update({ category: e.target.value })} className={inputClass + ' sm:w-52'}>
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
                {c.isActive ? '' : ' (off)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Loaded state={list}>
        {(data) =>
          data.products.length === 0 ? (
            <p className="py-16 text-center text-body text-ink-muted">No products here.</p>
          ) : (
            <>
              <ul aria-label="Products" className="flex flex-col divide-y divide-line rounded-2xl border border-line">
                {data.products.map((p) => {
                  const lowStock = low !== undefined && p.status === 'ACTIVE' && p.totalStock > 0 && p.totalStock <= low
                  return (
                    <li key={p.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-4 hover:bg-field md:grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                      {p.thumb ? (
                        <img src={p.thumb} alt="" className="size-12 rounded-lg bg-field object-cover" />
                      ) : (
                        <span className="size-12 rounded-lg bg-field" />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <Link to={`/admin/products/${p.id}`} className="relative -my-3 block truncate py-3 text-label text-ink-strong underline-offset-4 hover:underline">
                          {p.name}
                        </Link>
                        <span className="text-caption text-ink-subtle">{variantsText(p)}</span>
                      </span>
                      <span className="md:hidden">
                        <ProductStatusBadge status={p.status} />
                      </span>
                      <span className="col-span-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted md:hidden">
                        <span>{p.categoryName}</span>
                        <span className="tabular-nums">{priceText(p)}</span>
                        <span className={lowStock ? 'text-accent-text' : ''}>{p.totalStock} in stock</span>
                        <LimitedTag limited={p.isLimited} />
                      </span>
                      <span className="hidden text-label font-normal text-ink-muted md:block">{p.categoryName}</span>
                      <span className="hidden text-label text-ink-strong tabular-nums md:block">{priceText(p)}</span>
                      <span className="hidden flex-col md:flex">
                        <span className="text-label text-ink-strong tabular-nums">{p.totalStock}</span>
                        {lowStock && <span className="text-caption text-accent-text">Low stock</span>}
                        {p.status === 'ACTIVE' && p.totalStock === 0 && <span className="text-caption text-ink-subtle">Out of stock</span>}
                      </span>
                      <span className="hidden md:block">
                        <LimitedTag limited={p.isLimited} />
                      </span>
                      <span className="hidden flex-col gap-1 md:flex">
                        <ProductStatusBadge status={p.status} />
                        <span className="text-caption text-ink-subtle">{statusNote(p)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 text-caption text-ink-subtle">
                Showing {data.products.length} {data.products.length === 1 ? 'product' : 'products'}
                {low !== undefined ? ` · Low stock means ${low} or fewer left` : ''}
              </p>
            </>
          )
        }
      </Loaded>
    </>
  )
}
