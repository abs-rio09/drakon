import { useState, type FormEvent } from 'react'
import { AdminPanel, FormMessage } from '../../../components/admin/adminUi'
import { Field, textareaClass } from '../../../components/ui/Field'
import { button, ghostButton } from '../../../components/ui/styles'
import { archiveProduct, reactivateProduct } from '../../../features/admin/adminApi'
import type { AdminProduct, ProductEvent, ProductStatus } from '../../../features/admin/types'
import { useAction } from '../../../features/admin/useAction'
import { formatDateTime } from '../../../lib/dates'
import { formatTaka } from '../../../lib/money'

type Props = { product: AdminProduct; onChange: (p: AdminProduct) => void }

const steps: { status: ProductStatus; label: string; note: string }[] = [
  { status: 'DRAFT', label: 'Draft', note: 'Hidden; the price can change' },
  { status: 'ACTIVE', label: 'Active', note: 'On sale; the price is locked' },
  { status: 'SOLD_OUT', label: 'Sold out', note: 'Back to Active if stock returns' },
  { status: 'ARCHIVED', label: 'Archived', note: 'In the Sold Out archive' },
]

export function LifecyclePanel({ product, onChange }: Props) {
  return (
    <AdminPanel id="life-h" title="Lifecycle">
      <ol aria-label="Product lifecycle" className="flex flex-col gap-3">
        {steps.map((s) => {
          const now = s.status === product.status
          return (
            <li key={s.status} aria-current={now ? 'step' : undefined} className="flex items-start gap-3">
              <span aria-hidden="true" className={'mt-1.5 size-2.5 shrink-0 rounded-full border ' + (now ? 'border-ink-strong bg-ink-strong' : 'border-line-strong')} />
              <span className="flex flex-col">
                <span className={'text-label ' + (now ? 'text-ink-strong' : 'text-ink-muted')}>
                  {s.label}
                  {now ? ' · now' : ''}
                </span>
                <span className="text-caption text-ink-subtle">{s.note}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-caption text-ink-subtle">
        A sold-out run moves to Archived by itself after the days set in Settings. Bringing an archived product back needs the
        Owner and a reason. Products are never deleted.
      </p>
      {product.status === 'SOLD_OUT' && <ArchiveNow product={product} onChange={onChange} />}
      {product.status === 'ARCHIVED' && <BringBack product={product} onChange={onChange} />}
    </AdminPanel>
  )
}

function ArchiveNow({ product, onChange }: Props) {
  const [asking, setAsking] = useState(false)
  const { run, busy, error } = useAction()
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={button('secondary') + ' self-start'}>
        Archive now
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-label font-normal text-ink">Move {product.name} to the Sold Out archive now?</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const p = await run(() => archiveProduct(product.id, ''))
            if (p) onChange(p)
          }}
          className={button('secondary')}
        >
          {busy ? 'Archiving…' : 'Yes, archive'}
        </button>
        <button type="button" onClick={() => setAsking(false)} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
          Not now
        </button>
      </div>
      {error && <FormMessage error>{error.message}</FormMessage>}
    </div>
  )
}

// ARCHIVED -> ACTIVE: the Owner's exception, with a warning and a reason.
function BringBack({ product, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { run, busy, error } = useAction()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const p = await run(() => reactivateProduct(product.id, reason))
    if (p) onChange(p)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ghostButton + ' min-h-11 min-w-11 self-start'}>
        Bring back on sale (Owner)…
      </button>
    )
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-xl border border-line-strong bg-surface p-4">
      <p className="text-label text-ink-strong">Bring {product.name} back on sale?</p>
      <FormMessage>
        {product.isLimited
          ? 'This is a limited run. Buyers were promised it would not come back. Once it is Active again, it can even be restocked. Do this only for a real exception.'
          : 'It goes back on sale in the shop and leaves the Sold Out archive.'}{' '}
        Your reason is saved in the record.
      </FormMessage>
      <Field id="r-reason" label="Reason" required error={error?.fields.reason} hint="At least 10 characters.">
        <textarea id="r-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || reason.trim().length < 10} className={button('secondary')}>
          {busy ? 'Saving…' : 'Yes, bring it back'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(error.fields).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}

const eventNames: Record<ProductEvent['type'], string> = {
  PUBLISH: 'Published',
  SOLD_OUT: 'Sold out',
  ARCHIVE: 'Archived',
  REACTIVATE: 'Brought back',
  PRICE_FIX: 'Price fixed',
}

function eventText(e: ProductEvent) {
  if (e.type === 'PRICE_FIX' && e.oldValue && e.newValue) {
    return `${formatTaka(Number(e.oldValue))} → ${formatTaka(Number(e.newValue))} · ${e.reason}`
  }
  if (e.type === 'PRICE_FIX' && e.newValue) {
    return `New price ${formatTaka(Number(e.newValue))} · ${e.reason}` // a new variant on a live product
  }
  return e.reason
}

export function HistoryPanel({ product }: { product: AdminProduct }) {
  return (
    <AdminPanel id="phist-h" title="Record">
      {product.events.length === 0 ? (
        <p className="text-label font-normal text-ink-subtle">Nothing yet. Publishing, price fixes and archiving are saved here.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {product.events.map((e, i) => (
            <li key={i} className="flex flex-col">
              <span className="text-label text-ink">{eventNames[e.type]}</span>
              <span className="text-caption break-words text-ink-muted">{eventText(e)}</span>
              <span className="text-caption text-ink-subtle">
                {formatDateTime(e.at)} · {e.adminEmail ?? (e.actor === 'SYSTEM' ? 'automatic' : e.actor.toLowerCase())}
              </span>
            </li>
          ))}
        </ol>
      )}
    </AdminPanel>
  )
}

const movementNames = { ORDER: 'Order', CANCEL: 'Cancelled order', RETURN: 'Return', RESTOCK: 'New stock', ADJUST: 'Correction' }

export function StockBookPanel({ product }: { product: AdminProduct }) {
  return (
    <AdminPanel id="book-h" title="Stock book" aside="The last 30 changes">
      {product.movements.length === 0 ? (
        <p className="text-label font-normal text-ink-subtle">No stock changes yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {product.movements.map((m, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-label font-normal text-ink">
                  {movementNames[m.reason]} · {m.sku}
                </span>
                <span className="text-caption break-words text-ink-subtle">
                  {m.orderNumber ?? m.note} · {formatDateTime(m.at)}
                </span>
              </span>
              <span className={'text-label tabular-nums ' + (m.change > 0 ? 'text-ink-strong' : 'text-ink-muted')}>
                {m.change > 0 ? `+${m.change}` : m.change}
              </span>
            </li>
          ))}
        </ol>
      )}
    </AdminPanel>
  )
}
