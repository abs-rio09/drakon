import type { ReactNode } from 'react'
import { AdminPanel } from '../../../components/admin/adminUi'
import { CloseIcon, PlusIcon } from '../../../components/icons'
import { Field, inputClass, textareaClass } from '../../../components/ui/Field'
import { ghostButton, secondaryButton } from '../../../components/ui/styles'
import type { AdminCategory, ProductInput } from '../../../features/admin/types'

type FormProps = {
  form: ProductInput
  setForm: (f: ProductInput) => void
  categories: AdminCategory[]
  errors: Record<string, string>
  // A published product: the address, "limited" and the edition size are locked.
  locked: boolean
  defaultLimit: number
}

// Empty box = null (the field is not used).
function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function lockHint(locked: boolean, text: string): ReactNode {
  return locked ? 'Locked because the product is published.' : text
}

// The main column: what the product page shows.
export function BasicsPanel({ form, setForm, categories, errors, locked }: FormProps) {
  const set = (patch: Partial<ProductInput>) => setForm({ ...form, ...patch })
  return (
    <AdminPanel id="basics-h" title="Basics">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="e-name" label="Product name" required error={errors.name}>
          <input id="e-name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} aria-invalid={errors.name ? true : undefined} className={inputClass} />
        </Field>
        <Field id="e-cat" label="Category" required error={errors.categorySlug}>
          <select id="e-cat" value={form.categorySlug} onChange={(e) => set({ categorySlug: e.target.value })} aria-invalid={errors.categorySlug ? true : undefined} className={inputClass}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
                {c.isActive ? '' : ' (turned off)'}
              </option>
            ))}
          </select>
        </Field>
        <Field id="e-slug" label="Web address" error={errors.slug} hint={lockHint(locked, `Link: /product/${form.slug || 'made-from-the-name'}. Leave empty to make it from the name.`)}>
          <input id="e-slug" value={form.slug} maxLength={80} disabled={locked} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} aria-invalid={errors.slug ? true : undefined} className={inputClass + ' disabled:opacity-60'} />
        </Field>
        <Field id="e-kind" label="What it is" required error={errors.kind} hint="Singular, like “Collectible card” or “Tech toy”.">
          <input id="e-kind" value={form.kind} maxLength={60} onChange={(e) => set({ kind: e.target.value })} aria-invalid={errors.kind ? true : undefined} className={inputClass} />
        </Field>
        <Field id="e-vkind" label="The choice is called" error={errors.variantKind} hint="Size, Material, Edition… shown above the variant buttons.">
          <input id="e-vkind" value={form.variantKind} maxLength={60} onChange={(e) => set({ variantKind: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field id="e-summary" label="Summary" error={errors.summary} hint="One or two sentences under the name.">
        <textarea id="e-summary" rows={3} maxLength={600} value={form.summary} onChange={(e) => set({ summary: e.target.value })} className={textareaClass} />
      </Field>
      <Field id="e-story" label="Story" error={errors.story} hint="Leave an empty line between paragraphs.">
        <textarea
          id="e-story"
          rows={6}
          value={form.story.join('\n\n')}
          onChange={(e) => set({ story: e.target.value.split(/\n\s*\n/) })}
          placeholder="What makes this drop special, what is in the box, the material and finish"
          className={textareaClass}
        />
      </Field>
    </AdminPanel>
  )
}

export function DetailsPanel({ form, setForm, errors }: FormProps) {
  const rows = form.details
  const setRows = (details: ProductInput['details']) => setForm({ ...form, details })
  return (
    <AdminPanel id="details-h" title="Details" aside="The table on the product page">
      {rows.length === 0 && <p className="text-label font-normal text-ink-subtle">No details yet.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((d, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <input aria-label={`Detail ${i + 1} name`} value={d.term} maxLength={60} placeholder="Size" onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, term: e.target.value } : r)))} className={inputClass} />
            <input aria-label={`Detail ${i + 1} text`} value={d.text} maxLength={500} placeholder="63 × 88 mm" onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, text: e.target.value } : r)))} className={inputClass + ' col-start-1 sm:col-start-auto'} />
            <button type="button" aria-label={`Remove detail ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className={ghostButton + ' row-start-1 grid min-h-11 min-w-11 place-items-center sm:row-start-auto'}>
              <CloseIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
      {errors.details && <p className="text-caption text-danger-text">{errors.details}</p>}
      <button type="button" onClick={() => setRows([...rows, { term: '', text: '' }])} className={secondaryButton + ' self-start'}>
        <PlusIcon size={16} />
        Add a detail
      </button>
    </AdminPanel>
  )
}

// The side column: drop rules and the home page.
export function RulesPanel({ form, setForm, errors, locked, defaultLimit }: FormProps) {
  const set = (patch: Partial<ProductInput>) => setForm({ ...form, ...patch })
  return (
    <AdminPanel id="rules-h" title="Drop rules">
      <div className="flex items-start justify-between gap-4">
        <span className="flex flex-col gap-1">
          <span id="lim-label" className="text-label text-ink-strong">
            Limited edition
          </span>
          <span className="text-caption text-ink-subtle">
            {locked
              ? 'Locked because the product is published.'
              : form.isLimited
                ? 'When stock reaches 0 it becomes Sold out and moves to the archive. It is never restocked.'
                : 'When stock reaches 0 it shows Out of stock. You can restock it later.'}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={form.isLimited}
          aria-labelledby="lim-label"
          disabled={locked}
          onClick={() => set({ isLimited: !form.isLimited })}
          className={
            "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-fast ease-out-drakon after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] disabled:opacity-60 " +
            (form.isLimited ? 'border-ink bg-ink' : 'border-line-strong bg-field')
          }
        >
          <span aria-hidden="true" className={'absolute top-[3px] left-[3px] size-5 rounded-full transition-[translate,background-color] duration-fast ease-out-drakon ' + (form.isLimited ? 'translate-x-5 bg-surface' : 'bg-ink-muted')} />
        </button>
      </div>
      {errors.isLimited && <p className="text-caption text-danger-text">{errors.isLimited}</p>}
      <Field id="e-edition" label="Edition size" optional error={errors.editionSize} hint={lockHint(locked, 'How many pieces the run has, like 100. Empty = not shown.')}>
        <input id="e-edition" type="number" min={1} inputMode="numeric" disabled={locked} value={form.editionSize ?? ''} onChange={(e) => set({ editionSize: numberOrNull(e.target.value) })} className={inputClass + ' disabled:opacity-60'} />
      </Field>
      <Field id="e-limit" label="Purchase limit per customer" optional error={errors.purchaseLimit} hint={`Empty = the default, ${defaultLimit}. Guests are counted by phone number.`}>
        <input id="e-limit" type="number" min={1} max={50} inputMode="numeric" value={form.purchaseLimit ?? ''} onChange={(e) => set({ purchaseLimit: numberOrNull(e.target.value) })} className={inputClass} />
      </Field>
    </AdminPanel>
  )
}

export function HomePanel({ form, setForm, errors }: FormProps) {
  const set = (patch: Partial<ProductInput>) => setForm({ ...form, ...patch })
  return (
    <AdminPanel id="home-h" title="Home page and archive">
      <Field id="e-featured" label="Place in “The current drop”" optional error={errors.featuredOrder} hint="1 = first on the home page. Empty = not shown there.">
        <input id="e-featured" type="number" min={1} max={99} inputMode="numeric" value={form.featuredOrder ?? ''} onChange={(e) => set({ featuredOrder: numberOrNull(e.target.value) })} className={inputClass} />
      </Field>
      <Field id="e-successor" label="Newer edition (web address)" optional error={errors.successorSlug} hint="Shown in the sold-out archive: “The next edition is on sale”.">
        <input id="e-successor" value={form.successorSlug ?? ''} onChange={(e) => set({ successorSlug: e.target.value.trim() === '' ? null : e.target.value })} placeholder="ember-night-hoodie-edition-03" className={inputClass} />
      </Field>
    </AdminPanel>
  )
}
