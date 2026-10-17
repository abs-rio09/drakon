import { useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { AdminPanel, FormMessage } from '../../components/admin/adminUi'
import { PlusIcon } from '../../components/icons'
import { Field, inputClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button, ghostButton } from '../../components/ui/styles'
import { createCategory, getAdminCategories, reorderCategories, updateCategory } from '../../features/admin/adminApi'
import type { AdminCategory } from '../../features/admin/types'
import { useAction } from '../../features/admin/useAction'
import { clearApiCache, useApi } from '../../lib/useApi'

// /admin/categories: create, rename, reorder, turn on/off. Never deleted.
export default function AdminCategories() {
  const loaded = useApi('admin:categories', getAdminCategories)
  const [fresh, setFresh] = useState<AdminCategory[] | null>(null)
  const changed = (c: AdminCategory[]) => {
    clearApiCache()
    setFresh(c)
  }
  return (
    <>
      <AdminPageHeader
        title="Categories"
        intro="The shop's menu and collection tiles, in this order. A category is never deleted: turn it off and it leaves the menu (its products stay)."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <Loaded state={loaded}>{(data) => <CategoryList categories={fresh ?? data} onChange={changed} />}</Loaded>
        <NewCategory onChange={changed} />
      </div>
    </>
  )
}

function CategoryList({ categories, onChange }: { categories: AdminCategory[]; onChange: (c: AdminCategory[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null)
  const { run, busy, error } = useAction()

  async function move(i: number, by: -1 | 1) {
    const ids = categories.map((c) => c.id)
    ;[ids[i], ids[i + by]] = [ids[i + by], ids[i]]
    const c = await run(() => reorderCategories(ids))
    if (c) onChange(c)
  }

  return (
    <AdminPanel id="cats-h" title={`${categories.length} categories`}>
      <ol className="flex flex-col divide-y divide-line">
        {categories.map((c, i) => (
          <li key={c.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-4">
              {c.image ? <img src={c.image} alt="" className="h-14 w-11 shrink-0 rounded-lg bg-field object-cover" /> : <span className="h-14 w-11 shrink-0 rounded-lg bg-field" />}
              <span className="flex min-w-0 grow flex-col">
                <span className={'text-label ' + (c.isActive ? 'text-ink-strong' : 'text-ink-subtle')}>
                  {c.name}
                  {!c.isActive && <span className="ml-2 text-caption">(turned off)</span>}
                </span>
                <span className="text-caption text-ink-subtle">
                  /shop/{c.slug} · {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0 || busy} onClick={() => move(i, -1)} className={ghostButton + ' grid min-h-11 min-w-11 place-items-center disabled:opacity-30'}>
                  ↑
                </button>
                <button type="button" aria-label={`Move ${c.name} down`} disabled={i === categories.length - 1 || busy} onClick={() => move(i, 1)} className={ghostButton + ' grid min-h-11 min-w-11 place-items-center disabled:opacity-30'}>
                  ↓
                </button>
              </span>
            </div>
            {editing === c.id ? (
              <EditCategory
                category={c}
                onDone={(list) => {
                  onChange(list)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <button type="button" onClick={() => setEditing(c.id)} className={ghostButton + ' min-h-9 self-start'}>
                Edit
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && <FormMessage error>{error.message}</FormMessage>}
    </AdminPanel>
  )
}

function EditCategory({ category, onDone, onCancel }: { category: AdminCategory; onDone: (c: AdminCategory[]) => void; onCancel: () => void }) {
  const [name, setName] = useState(category.name)
  const [image, setImage] = useState(category.image)
  const [active, setActive] = useState(category.isActive)
  const { run, busy, error } = useAction()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const c = await run(() => updateCategory(category.id, { name, image, isActive: active }))
    if (c) onDone(c)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`c-name-${category.id}`} label="Name (plural, for the menu)" required error={error?.fields.name}>
          <input id={`c-name-${category.id}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`c-img-${category.id}`} label="Tile photo" optional error={error?.fields.image} hint="A 4:5 photo, like /img/cat-tech.webp">
          <input id={`c-img-${category.id}`} value={image} onChange={(e) => setImage(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-label font-normal text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-0.5 size-5 accent-ink" />
        <span>
          Shown in the shop
          {!active && category.productCount > 0 && (
            <span className="block text-caption text-ink-subtle">
              Turned off, it leaves the menu and the collection tiles. Its {category.productCount} products stay as they are.
            </span>
          )}
        </span>
      </label>
      <p className="text-caption text-ink-subtle">The address /shop/{category.slug} does not change, so shared links keep working.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={button('secondary')}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}

function NewCategory({ onChange }: { onChange: (c: AdminCategory[]) => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [image, setImage] = useState('')
  const { run, busy, error } = useAction()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const c = await run(() => createCategory({ name, slug, image, isActive: true }))
    if (c) {
      onChange(c)
      setName('')
      setSlug('')
      setImage('')
    }
  }

  return (
    <AdminPanel id="newcat-h" title="New category">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field id="nc-name" label="Name (plural)" required error={error?.fields.name}>
          <input id="nc-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Board games" className={inputClass} />
        </Field>
        <Field id="nc-slug" label="Web address" optional error={error?.fields.slug} hint="Empty = made from the name. It cannot change later.">
          <input id="nc-slug" value={slug} maxLength={60} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="board-games" className={inputClass} />
        </Field>
        <Field id="nc-img" label="Tile photo" optional error={error?.fields.image}>
          <input id="nc-img" value={image} onChange={(e) => setImage(e.target.value)} placeholder="/img/cat-board-games.webp" className={inputClass} />
        </Field>
        <button type="submit" disabled={busy || name.trim().length < 2} className={button('secondary', 'md')}>
          <PlusIcon size={16} />
          {busy ? 'Adding…' : 'Add category'}
        </button>
        {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
      </form>
    </AdminPanel>
  )
}
