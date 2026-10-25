import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FormMessage, LimitedTag, ProductStatusBadge } from '../../components/admin/adminUi'
import { Loaded } from '../../components/ui/LoadState'
import { button, ghostButton, tapArea } from '../../components/ui/styles'
import { createProduct, getAdminCategories, getAdminProduct, publishProduct, updateProduct } from '../../features/admin/adminApi'
import type { AdminCategory, AdminProduct, ProductInput } from '../../features/admin/types'
import { useAction } from '../../features/admin/useAction'
import { getPublicSettings } from '../../lib/api'
import { formatTaka } from '../../lib/money'
import { clearApiCache, useApi } from '../../lib/useApi'
import { HistoryPanel, LifecyclePanel, StockBookPanel } from './product/LifecyclePanel'
import { PhotosPanel } from './product/PhotosPanel'
import { BasicsPanel, DetailsPanel, HomePanel, RulesPanel } from './product/ProductForm'
import { VariantsPanel } from './product/VariantsPanel'

const emptyForm: ProductInput = {
  name: '', slug: '', categorySlug: '', kind: '', variantKind: 'Edition', isLimited: true,
  editionSize: null, purchaseLimit: null, summary: '', story: [], details: [], successorSlug: null, featuredOrder: null,
}

function formOf(p: AdminProduct): ProductInput {
  return {
    name: p.name, slug: p.slug, categorySlug: p.categorySlug, kind: p.kind, variantKind: p.variantKind,
    isLimited: p.isLimited, editionSize: p.editionSize, purchaseLimit: p.purchaseLimit, summary: p.summary,
    story: p.story, details: p.details, successorSlug: p.successorSlug, featuredOrder: p.featuredOrder,
  }
}

// What the server keeps (empty story paragraphs and empty detail rows go).
function cleanForm(f: ProductInput): ProductInput {
  return {
    ...f,
    story: f.story.map((s) => s.trim()).filter(Boolean),
    details: f.details.filter((d) => d.term.trim() || d.text.trim()),
  }
}

// /admin/products/new and /admin/products/:id (AdminProductEdit.dc.html)
export default function AdminProductEdit() {
  const { id } = useParams()
  const categories = useApi('admin:categories', getAdminCategories)
  const settings = useApi('admin:public-settings', getPublicSettings)
  const defaultLimit = settings.data?.defaultPurchaseLimit ?? 5

  return (
    <Loaded state={categories}>
      {(cats) =>
        id === undefined || id === 'new' ? (
          <NewProduct categories={cats} defaultLimit={defaultLimit} />
        ) : (
          <EditLoader key={id} id={Number(id)} categories={cats} defaultLimit={defaultLimit} />
        )
      }
    </Loaded>
  )
}

function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap gap-2 text-label font-normal text-ink-subtle">
        <li>
          <Link to="/admin/products" className={tapArea + ' text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink-strong'}>
            Products
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{name}</li>
      </ol>
    </nav>
  )
}

// A new product: only the form. It is saved as a DRAFT; photos, variants
// and stock come next on the edit page.
function NewProduct({ categories, defaultLimit }: { categories: AdminCategory[]; defaultLimit: number }) {
  const [form, setForm] = useState<ProductInput>({ ...emptyForm, categorySlug: categories.find((c) => c.isActive)?.slug ?? '' })
  const { run, busy, error } = useAction()
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const p = await run(() => createProduct(cleanForm(form)))
    if (p) {
      clearApiCache()
      navigate(`/admin/products/${p.id}`, { replace: true })
    }
  }

  const props = { form, setForm, categories, errors: error?.fields ?? {}, locked: false, defaultLimit }
  return (
    <form onSubmit={onSubmit} noValidate>
      <title>New product · DRAKON Admin</title>
      <Breadcrumb name="New product" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-heading-3 text-ink-strong sm:text-heading-2">New product</h1>
          <p className="text-body text-ink-muted">It starts as a draft, hidden from the shop. Add photos, variants and stock next.</p>
        </div>
        <button type="submit" disabled={busy} className={button('primary', 'md')}>
          {busy ? 'Saving…' : 'Save draft'}
        </button>
      </div>
      {error && <div className="mb-6"><FormMessage error>{error.message}</FormMessage></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <BasicsPanel {...props} />
          <DetailsPanel {...props} />
        </div>
        <div className="flex flex-col gap-6">
          <RulesPanel {...props} />
          <HomePanel {...props} />
        </div>
      </div>
    </form>
  )
}

function EditLoader({ id, categories, defaultLimit }: { id: number; categories: AdminCategory[]; defaultLimit: number }) {
  const loaded = useApi(`admin:product:${id}`, () => getAdminProduct(id))
  return (
    <Loaded state={loaded}>{(p) => <EditProduct initial={p} categories={categories} defaultLimit={defaultLimit} />}</Loaded>
  )
}

function EditProduct({ initial, categories, defaultLimit }: { initial: AdminProduct; categories: AdminCategory[]; defaultLimit: number }) {
  const [product, setProduct] = useState(initial)
  const [form, setForm] = useState<ProductInput>(formOf(initial))
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const save = useAction()
  const pub = useAction()

  const dirty = JSON.stringify(cleanForm(form)) !== JSON.stringify(formOf(product))
  const isDraft = product.status === 'DRAFT'

  // Variants, photos and stock save at once; the form keeps its own edits.
  function changed(p: AdminProduct) {
    clearApiCache()
    setProduct(p)
    setSaved(false)
    setJustPublished(false) // the notice is about the last action only
  }

  async function onSave() {
    const p = await save.run(() => updateProduct(product.id, cleanForm(form)))
    if (p) {
      changed(p)
      setForm(formOf(p))
      setSaved(true)
    }
  }

  async function onPublish() {
    const prices = product.variants.filter((v) => v.isActive).map((v) => ({ variantId: v.id, pricePaisa: v.pricePaisa }))
    const p = await pub.run(() => publishProduct(product.id, prices))
    if (p) {
      changed(p)
      setConfirming(false)
      setJustPublished(true)
    }
  }

  const props = { form, setForm, categories, errors: save.error?.fields ?? {}, locked: !isDraft, defaultLimit }
  const active = product.variants.filter((v) => v.isActive)
  // No <form> around the page: the photo, variant and stock panels have
  // their own small forms, and forms must not sit inside each other.
  return (
    <div>
      <title>{`${product.name} · DRAKON Admin`}</title>
      <Breadcrumb name={product.name} />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-heading-3 text-ink-strong sm:text-heading-2">{product.name}</h1>
          <ProductStatusBadge status={product.status} />
          <LimitedTag limited={product.isLimited} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {product.status !== 'DRAFT' && (
            <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className={button('secondary', 'md')}>
              View in shop
            </a>
          )}
          <button type="button" onClick={onSave} disabled={save.busy || !dirty} className={button(isDraft ? 'secondary' : 'primary', 'md')}>
            {save.busy ? 'Saving…' : isDraft ? 'Save draft' : 'Save changes'}
          </button>
          {isDraft && (
            <button type="button" disabled={dirty} onClick={() => setConfirming(true)} className={button('primary', 'md')}>
              Publish
            </button>
          )}
        </div>
      </div>
      {save.error && Object.keys(save.error.fields).length === 0 && <div className="mb-6"><FormMessage error>{save.error.message}</FormMessage></div>}
      {save.error && Object.keys(save.error.fields).length > 0 && <div className="mb-6"><FormMessage error>{save.error.message} Look at the marked fields.</FormMessage></div>}
      {saved && !dirty && <div className="mb-6"><FormMessage>Saved.</FormMessage></div>}
      {isDraft && dirty && <div className="mb-6"><FormMessage>Save your changes first, then publish.</FormMessage></div>}

      {/* "Check the prices" before going live */}
      {confirming && isDraft && (
        <section role="alertdialog" aria-labelledby="pub-h" className="mb-8 flex flex-col gap-5 rounded-2xl border border-line-strong bg-surface-raised p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 id="pub-h" className="text-heading-3 text-ink-strong">
              Check the prices, then publish
            </h2>
            <p className="text-body text-ink-muted">
              The prices lock once the product is live. After that only the Owner can correct one, with a written reason that is
              saved in the record.
            </p>
          </div>
          {product.publishProblems.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-label font-normal text-danger-text">
              {product.publishProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
                {active.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-label font-normal text-ink">
                      {v.label} <span className="text-caption text-ink-subtle">· {v.stock} in stock</span>
                    </span>
                    <span className="text-price text-ink-strong tabular-nums">{formatTaka(v.pricePaisa)}</span>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1 text-label font-normal text-ink-muted">
                <li>Limited edition: {product.isLimited ? 'yes, never restocked once sold out' : 'no, restockable'}</li>
                <li>Purchase limit: {product.purchaseLimit ?? `${defaultLimit} (the default)`} per customer</li>
              </ul>
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={pub.busy || product.publishProblems.length > 0} onClick={onPublish} className={button('primary', 'md')}>
              {pub.busy ? 'Publishing…' : 'Yes, publish at these prices'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
              Go back
            </button>
          </div>
          {pub.error && <FormMessage error>{pub.error.message}</FormMessage>}
        </section>
      )}
      {justPublished && !isDraft && (
        <div className="mb-8">
          <FormMessage>Published. It is live in the shop now.</FormMessage>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <BasicsPanel {...props} />
          <PhotosPanel product={product} onChange={changed} />
          <VariantsPanel product={product} onChange={changed} />
          <DetailsPanel {...props} />
        </div>
        <div className="flex flex-col gap-6">
          <RulesPanel {...props} />
          <LifecyclePanel product={product} onChange={changed} />
          <HomePanel {...props} />
          <HistoryPanel product={product} />
          <StockBookPanel product={product} />
        </div>
      </div>
    </div>
  )
}
