import { useState, type FormEvent } from 'react'
import { AdminPanel, FormMessage } from '../../../components/admin/adminUi'
import { PlusIcon } from '../../../components/icons'
import { Field, inputClass } from '../../../components/ui/Field'
import { button, ghostButton } from '../../../components/ui/styles'
import { addVariant, changeStock, priceFix, updateVariant } from '../../../features/admin/adminApi'
import { parseTaka, takaInput } from '../../../features/admin/format'
import type { AdminProduct, AdminVariant } from '../../../features/admin/types'
import { useAction } from '../../../features/admin/useAction'
import { formatTaka } from '../../../lib/money'

type Props = { product: AdminProduct; onChange: (p: AdminProduct) => void }

// Variants and stock (AdminProductEdit.dc.html). Each variant has its own
// price. A variant is never deleted: it is turned off instead.
export function VariantsPanel({ product, onChange }: Props) {
  const [open, setOpen] = useState<{ id: number; what: 'edit' | 'stock' | 'price' } | 'add' | null>(null)
  const isDraft = product.status === 'DRAFT'
  const noRestock = product.isLimited && (product.status === 'SOLD_OUT' || product.status === 'ARCHIVED')
  const done = (p: AdminProduct) => {
    onChange(p)
    setOpen(null)
  }

  return (
    <AdminPanel id="var-h" title="Variants and stock" aside="A variant at 0 shows as unavailable; all at 0 means sold out">
      {noRestock && (
        <FormMessage>
          This limited run has sold out, so it can never get new pieces: that is what “limited” promises the buyers. You can
          still take pieces away (for example a broken one).
        </FormMessage>
      )}
      {product.variants.length === 0 ? (
        <p className="text-label font-normal text-ink-subtle">No variants yet. Add one with its price.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {product.variants.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 py-4 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className={'text-label ' + (v.isActive ? 'text-ink-strong' : 'text-ink-subtle line-through')}>
                    {v.label}
                    {!v.isActive && <span className="ml-2 text-caption no-underline">(turned off)</span>}
                  </span>
                  <span className="text-caption text-ink-subtle">
                    SKU {v.sku}
                    {v.note ? ` · ${v.note}` : ''}
                  </span>
                </span>
                <span className="flex items-baseline gap-4 tabular-nums">
                  <span className="text-label text-ink-strong">{formatTaka(v.pricePaisa)}</span>
                  <span className={'text-label ' + (v.stock === 0 ? 'text-ink-subtle' : 'text-ink')}>{v.stock} in stock</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <button type="button" className={ghostButton + ' min-h-11'} onClick={() => setOpen({ id: v.id, what: 'stock' })}>
                  Change stock
                </button>
                <button type="button" className={ghostButton + ' min-h-11'} onClick={() => setOpen({ id: v.id, what: 'edit' })}>
                  Edit
                </button>
                {product.status === 'ACTIVE' && (
                  <button type="button" className={ghostButton + ' min-h-11'} onClick={() => setOpen({ id: v.id, what: 'price' })}>
                    Owner price fix…
                  </button>
                )}
              </div>
              {open !== null && open !== 'add' && open.id === v.id && (
                <div className="rounded-xl border border-line bg-surface p-4">
                  {open.what === 'stock' && <StockForm variant={v} noRestock={noRestock} onDone={done} onCancel={() => setOpen(null)} />}
                  {open.what === 'edit' && <VariantForm product={product} variant={v} onDone={done} onCancel={() => setOpen(null)} />}
                  {open.what === 'price' && <PriceFixForm variant={v} onDone={done} onCancel={() => setOpen(null)} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {open === 'add' ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <VariantForm product={product} onDone={done} onCancel={() => setOpen(null)} />
        </div>
      ) : (
        product.status !== 'ARCHIVED' && (
          <button type="button" onClick={() => setOpen('add')} className={button('secondary') + ' self-start'}>
            <PlusIcon size={16} />
            Add variant
          </button>
        )
      )}
      {!isDraft && <p className="text-caption text-ink-subtle">Prices and SKUs are locked because the product is live.</p>}
    </AdminPanel>
  )
}

// Add a new variant, or edit one (label, note, photo, order, on/off; the
// price and SKU too while the product is a draft).
function VariantForm({ product, variant, onDone, onCancel }: { product: AdminProduct; variant?: AdminVariant; onDone: (p: AdminProduct) => void; onCancel: () => void }) {
  const isDraft = product.status === 'DRAFT'
  const priceLocked = !!variant && !isDraft
  const [sku, setSku] = useState(variant?.sku ?? '')
  const [label, setLabel] = useState(variant?.label ?? '')
  const [note, setNote] = useState(variant?.note ?? '')
  const [price, setPrice] = useState(variant ? takaInput(variant.pricePaisa) : '')
  const [image, setImage] = useState(variant?.imageIndex ?? -1)
  const [sortOrder, setSortOrder] = useState(variant?.sortOrder ?? product.variants.length)
  const [active, setActive] = useState(variant?.isActive ?? true)
  const [reason, setReason] = useState('')
  const { run, busy, error } = useAction()
  const pricePaisa = parseTaka(price)
  // A new option on a live product sets a new price: it needs a reason (saved in the record).
  const needsReason = !variant && !isDraft
  const reasonOk = !needsReason || reason.trim().length >= 5

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pricePaisa === null || !reasonOk) return
    const body = { sku, label, note, pricePaisa, imageIndex: image < 0 ? null : image, sortOrder, isActive: active, ...(needsReason ? { reason } : {}) }
    const p = await run(() => (variant ? updateVariant(variant.id, body) : addVariant(product.id, body)))
    if (p) onDone(p)
  }

  const f = error?.fields ?? {}
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-label text-ink-strong">{variant ? `Edit ${variant.label}` : 'New variant'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`v-label-${variant?.id ?? 'new'}`} label="Option name" required error={f.label} hint="M, Metal, Standard…">
          <input id={`v-label-${variant?.id ?? 'new'}`} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`v-sku-${variant?.id ?? 'new'}`} label="SKU" required error={f.sku} hint={priceLocked ? 'Locked because the product is live.' : 'Capital letters, numbers, dashes: HD03-M.'}>
          <input id={`v-sku-${variant?.id ?? 'new'}`} value={sku} maxLength={40} disabled={priceLocked} onChange={(e) => setSku(e.target.value.toUpperCase())} className={inputClass + ' disabled:opacity-60'} />
        </Field>
        <Field
          id={`v-price-${variant?.id ?? 'new'}`}
          label="Price in Taka"
          required
          error={f.pricePaisa ?? (price !== '' && pricePaisa === null ? 'Enter a price like 1600 or 599.50.' : undefined)}
          hint={priceLocked ? 'Locked because the product is live. Use “Owner price fix”.' : 'You can change it until you publish. It locks after that.'}
        >
          <input id={`v-price-${variant?.id ?? 'new'}`} inputMode="decimal" value={price} disabled={priceLocked} onChange={(e) => setPrice(e.target.value)} placeholder="1600" className={inputClass + ' tabular-nums disabled:opacity-60'} />
        </Field>
        <Field id={`v-note-${variant?.id ?? 'new'}`} label="Note" optional error={f.note} hint="One short line under the option.">
          <input id={`v-note-${variant?.id ?? 'new'}`} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`v-img-${variant?.id ?? 'new'}`} label="Photo that shows it" optional error={f.imageIndex}>
          <select id={`v-img-${variant?.id ?? 'new'}`} value={image} onChange={(e) => setImage(Number(e.target.value))} className={inputClass}>
            <option value={-1}>No special photo</option>
            {product.images.map((img, i) => (
              <option key={img.id} value={i}>
                {i + 1}. {img.shortName || img.alt}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`v-order-${variant?.id ?? 'new'}`} label="Position" hint="Smaller numbers come first.">
          <input id={`v-order-${variant?.id ?? 'new'}`} type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} className={inputClass} />
        </Field>
      </div>
      {needsReason && (
        <Field
          id="v-reason-new"
          label="Reason"
          required
          error={f.reason}
          hint="The product is live, so this new price is not checked by Publish. Your reason and the price are saved in the record."
        >
          <input id="v-reason-new" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. A smaller box for new players" className={inputClass} />
        </Field>
      )}
      {variant && (
        <label className="flex items-center gap-3 text-label font-normal text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-ink" />
          On sale (turn off to hide it from the shop; it is never deleted)
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || pricePaisa === null || !reasonOk} className={button('secondary')}>
          {busy ? 'Saving…' : variant ? 'Save variant' : 'Add variant'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
      {!variant && <p className="text-caption text-ink-subtle">A new variant starts with 0 in stock. Add the pieces with “Change stock”.</p>}
    </form>
  )
}

function StockForm({ variant, noRestock, onDone, onCancel }: { variant: AdminVariant; noRestock: boolean; onDone: (p: AdminProduct) => void; onCancel: () => void }) {
  const [direction, setDirection] = useState<'add' | 'remove'>(noRestock ? 'remove' : 'add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<'RESTOCK' | 'ADJUST'>(noRestock ? 'ADJUST' : 'RESTOCK')
  const [note, setNote] = useState('')
  const { run, busy, error } = useAction()
  const n = Number(amount)
  const valid = Number.isInteger(n) && n > 0
  const change = direction === 'add' ? n : -n
  const after = variant.stock + (valid ? change : 0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const p = await run(() => changeStock(variant.id, { change, reason: direction === 'remove' ? 'ADJUST' : reason, note }))
    if (p) onDone(p)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-label text-ink-strong">
        Stock of {variant.label}: {variant.stock} now
      </p>
      <div role="group" aria-label="Add or take away" className="flex flex-wrap gap-2">
        {(['add', 'remove'] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={direction === d}
            disabled={d === 'add' && noRestock}
            onClick={() => setDirection(d)}
            className={
              'min-h-11 rounded-xl border px-4 text-label disabled:opacity-40 ' +
              (direction === d ? 'border-ink-strong bg-field text-ink-strong' : 'border-line-strong text-ink-muted')
            }
          >
            {d === 'add' ? 'Add pieces' : 'Take pieces away'}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`s-amount-${variant.id}`} label="How many" required error={error?.fields.change}>
          <input id={`s-amount-${variant.id}`} type="number" min={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </Field>
        {direction === 'add' && (
          <Field id={`s-reason-${variant.id}`} label="Kind of change" error={error?.fields.reason}>
            <select id={`s-reason-${variant.id}`} value={reason} onChange={(e) => setReason(e.target.value as 'RESTOCK' | 'ADJUST')} className={inputClass}>
              <option value="RESTOCK">New stock arrived</option>
              <option value="ADJUST">Correction (counted wrong)</option>
            </select>
          </Field>
        )}
      </div>
      <Field id={`s-note-${variant.id}`} label="Why" required error={error?.fields.note} hint="Saved in the stock book, like “20 more from the printer” or “2 arrived broken”.">
        <input id={`s-note-${variant.id}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>
      {valid && <p className="text-label font-normal text-ink-muted tabular-nums">After this: {after < 0 ? 'not possible (below 0)' : `${after} in stock`}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !valid || after < 0 || note.trim().length < 5} className={button('secondary')}>
          {busy ? 'Saving…' : 'Save stock change'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}

// The Owner's emergency price correction on a live product: a warning,
// a written reason, and a record (PRICE_FIX) with the old and new price.
function PriceFixForm({ variant, onDone, onCancel }: { variant: AdminVariant; onDone: (p: AdminProduct) => void; onCancel: () => void }) {
  const [price, setPrice] = useState(takaInput(variant.pricePaisa))
  const [reason, setReason] = useState('')
  const [sure, setSure] = useState(false)
  const { run, busy, error } = useAction()
  const pricePaisa = parseTaka(price)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pricePaisa === null) return
    const p = await run(() => priceFix(variant.id, { pricePaisa, reason }))
    if (p) onDone(p)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-label text-ink-strong">Owner price fix: {variant.label}</p>
      <FormMessage>
        Prices are locked once a product is live. Change it only to correct a real mistake. The old and new price and your
        reason are saved in the record. Orders already placed keep the price they were placed at.
      </FormMessage>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`pf-price-${variant.id}`} label={`New price (now ${formatTaka(variant.pricePaisa)})`} required error={error?.fields.pricePaisa}>
          <input id={`pf-price-${variant.id}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass + ' tabular-nums'} />
        </Field>
        <Field id={`pf-reason-${variant.id}`} label="Reason" required error={error?.fields.reason}>
          <input id={`pf-reason-${variant.id}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Typed 1,060 instead of 1,600" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-label font-normal text-ink">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 size-5 accent-ink" />
        I checked: the new price is {pricePaisa === null ? '…' : formatTaka(pricePaisa)}.
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !sure || pricePaisa === null || reason.trim().length < 5} className={button('secondary')}>
          {busy ? 'Saving…' : 'Fix the price'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}
