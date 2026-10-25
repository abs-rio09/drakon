import { useState, type FormEvent } from 'react'
import { AdminPanel, FormMessage } from '../../components/admin/adminUi'
import { Field, inputClass, textareaClass } from '../../components/ui/Field'
import { button, ghostButton } from '../../components/ui/styles'
import { recordReturn, type AdminOrderAnswer } from '../../features/admin/adminApi'
import { parseTaka, takaInput } from '../../features/admin/format'
import type { OrderReturn, RefundMethod } from '../../features/admin/types'
import { useAction } from '../../features/admin/useAction'
import { formatDateTime } from '../../lib/dates'
import { formatTaka } from '../../lib/money'

const methodNames: Record<RefundMethod, string> = { BKASH: 'bKash', NAGAD: 'Nagad', CASH: 'Cash in hand' }

// Returns of a delivered order (blueprint rule 3): what came back, who paid
// the delivery, and the refund. Shown only for DELIVERED orders.
export default function OrderReturns({ answer, onChange }: { answer: AdminOrderAnswer; onChange: (a: AdminOrderAnswer) => void }) {
  const [open, setOpen] = useState(false)
  const [now] = useState(Date.now) // the clock, read once when the page opens
  const o = answer.order
  if (o.status !== 'DELIVERED') return null
  const windowOpen = o.returnUntil !== null && new Date(o.returnUntil).getTime() > now
  const piecesLeft = o.items.reduce((n, it) => n + it.qty - it.returnedQty, 0)

  return (
    <AdminPanel
      id="ret-h"
      title="Returns"
      aside={o.returnUntil ? (windowOpen ? `Open until ${formatDateTime(o.returnUntil)}` : `Closed on ${formatDateTime(o.returnUntil)}`) : undefined}
    >
      {answer.returns.length === 0 && <p className="text-label font-normal text-ink-subtle">No return recorded.</p>}
      {answer.returns.map((r) => (
        <ReturnCard key={r.id} r={r} />
      ))}
      {o.refundedPaisa > 0 && (
        <p className="text-label font-normal text-ink-muted tabular-nums">
          Refunded so far: {formatTaka(o.refundedPaisa)} of {formatTaka(o.totalPaisa)}
        </p>
      )}
      {open ? (
        <ReturnForm
          answer={answer}
          onDone={(a) => {
            onChange(a)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      ) : windowOpen && piecesLeft > 0 ? (
        <button type="button" onClick={() => setOpen(true)} className={button('secondary') + ' self-start'}>
          Record a return
        </button>
      ) : (
        <p className="text-caption text-ink-subtle">{piecesLeft === 0 ? 'Every piece of this order has come back.' : 'The return window is over (Settings → return days).'}</p>
      )}
    </AdminPanel>
  )
}

function ReturnCard({ r }: { r: OrderReturn }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-label text-ink-strong">{r.reasonType === 'COMPANY_FAULT' ? 'Our mistake' : 'Other reason'}</span>
        <span className="text-caption text-ink-subtle">
          {formatDateTime(r.at)} · {r.adminEmail}
        </span>
      </div>
      <p className="text-label font-normal text-ink">{r.note}</p>
      <ul className="text-caption text-ink-muted">
        {r.items.map((it) => (
          <li key={it.orderItemId}>
            {it.qty} × {it.productName} ({it.variantLabel}) · {it.resellable ? 'back in stock' : 'not sellable'}
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-muted">
        Delivery paid by {r.deliveryPaidBy === 'COMPANY' ? 'us' : 'the customer'} ·{' '}
        {r.refundPaisa > 0 ? `Refunded ${formatTaka(r.refundPaisa)} by ${r.refundMethod ? methodNames[r.refundMethod] : ''}${r.refundRef ? ` (${r.refundRef})` : ''}` : 'No refund'}
      </p>
    </div>
  )
}

function ReturnForm({ answer, onDone, onCancel }: { answer: AdminOrderAnswer; onDone: (a: AdminOrderAnswer) => void; onCancel: () => void }) {
  const o = answer.order
  const [reason, setReason] = useState<'COMPANY_FAULT' | 'OTHER'>('COMPANY_FAULT')
  const [payer, setPayer] = useState<'COMPANY' | 'CUSTOMER'>('COMPANY')
  const [condition, setCondition] = useState(false)
  const [note, setNote] = useState('')
  const [qty, setQty] = useState<Record<number, number>>({})
  const [resellable, setResellable] = useState<Record<number, boolean>>({})
  const [refund, setRefund] = useState('')
  const [method, setMethod] = useState<RefundMethod>('BKASH')
  const [ref, setRef] = useState('')
  const { run, busy, error } = useAction()

  const chosen = o.items.filter((it) => (qty[it.id] ?? 0) > 0)
  const itemsValue = chosen.reduce((sum, it) => sum + it.unitPricePaisa * (qty[it.id] ?? 0), 0)
  const maxRefund = o.totalPaisa - o.refundedPaisa
  const refundPaisa = refund.trim() === '' || refund.trim() === '0' ? 0 : parseTaka(refund)
  const valid = chosen.length > 0 && refundPaisa !== null && refundPaisa <= maxRefund && note.trim().length >= 5 && (reason === 'COMPANY_FAULT' || condition)

  function pickReason(r: 'COMPANY_FAULT' | 'OTHER') {
    setReason(r)
    setPayer(r === 'COMPANY_FAULT' ? 'COMPANY' : 'CUSTOMER') // the return policy
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || refundPaisa === null) return
    const a = await run(() =>
      recordReturn(o.orderNumber, {
        reasonType: reason,
        note,
        deliveryPaidBy: payer,
        conditionChecked: condition,
        refundPaisa,
        refundMethod: refundPaisa > 0 ? method : '',
        refundRef: refundPaisa > 0 ? ref : '',
        items: chosen.map((it) => ({ orderItemId: it.id, qty: qty[it.id], resellable: resellable[it.id] ?? reason === 'OTHER' })),
      }),
    )
    if (a) onDone(a)
  }

  const f = error?.fields ?? {}
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-xl border border-line-strong bg-surface p-4">
      <p className="text-label text-ink-strong">Record a return</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-ink-muted">Why did it come back?</legend>
        {(
          [
            ['COMPANY_FAULT', 'Our mistake', 'Broken, wrong product or wrong size. We pay the delivery.'],
            ['OTHER', 'Other reason', 'The customer pays the delivery. Only unused, with tags, seal not opened.'],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-3 text-label font-normal text-ink">
            <input type="radio" name="ret-reason" checked={reason === value} onChange={() => pickReason(value)} className="mt-0.5 size-5 accent-ink" />
            <span>
              {label}
              <span className="block text-caption text-ink-subtle">{hint}</span>
            </span>
          </label>
        ))}
        {f.reasonType && <span className="text-caption text-danger-text">{f.reasonType}</span>}
      </fieldset>

      {reason === 'OTHER' && (
        <>
          <label className="flex items-start gap-3 text-label font-normal text-ink">
            <input type="checkbox" checked={condition} onChange={(e) => setCondition(e.target.checked)} className="mt-0.5 size-5 accent-ink" />
            I checked: unused, tags still on, seal not opened.
          </label>
          {f.conditionChecked && <span className="text-caption text-danger-text">{f.conditionChecked}</span>}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label text-ink-muted">Who pays the delivery?</legend>
            {(['CUSTOMER', 'COMPANY'] as const).map((p) => (
              <label key={p} className="flex items-center gap-3 text-label font-normal text-ink">
                <input type="radio" name="ret-payer" checked={payer === p} onChange={() => setPayer(p)} className="size-5 accent-ink" />
                {p === 'CUSTOMER' ? 'The customer (the policy)' : 'We do (a goodwill exception)'}
              </label>
            ))}
          </fieldset>
        </>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label text-ink-muted">Which pieces came back?</legend>
        {o.items.map((it) => {
          const left = it.qty - it.returnedQty
          return (
            <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3">
              <label htmlFor={`rq-${it.id}`} className="text-label font-normal text-ink">
                {it.productName} ({it.variantLabel})
                <span className="block text-caption text-ink-subtle">
                  {left} of {it.qty} can come back · {formatTaka(it.unitPricePaisa)} each
                </span>
              </label>
              <input
                id={`rq-${it.id}`}
                type="number"
                min={0}
                max={left}
                disabled={left === 0}
                value={qty[it.id] ?? 0}
                onChange={(e) => setQty({ ...qty, [it.id]: Math.max(0, Math.min(left, Number(e.target.value) || 0)) })}
                className={inputClass + ' tabular-nums disabled:opacity-40'}
              />
              {(qty[it.id] ?? 0) > 0 && (
                <label className="col-span-2 flex items-center gap-3 text-caption text-ink">
                  <input
                    type="checkbox"
                    checked={resellable[it.id] ?? reason === 'OTHER'}
                    onChange={(e) => setResellable({ ...resellable, [it.id]: e.target.checked })}
                    className="size-5 accent-ink"
                  />
                  Can be sold again (goes back into stock)
                </label>
              )}
            </div>
          )
        })}
        {f.items && <span className="text-caption text-danger-text">{f.items}</span>}
      </fieldset>

      <Field id="ret-note" label="What happened" required error={f.note}>
        <textarea id="ret-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The hoodie came in size L, the customer ordered M" className={textareaClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="ret-refund"
          label="Refund in Taka"
          error={f.refundPaisa ?? (refundPaisa !== null && refundPaisa > maxRefund ? `At most ${formatTaka(maxRefund)}.` : undefined)}
          hint={`Pieces: ${formatTaka(itemsValue)}. At most ${formatTaka(maxRefund)}. 0 = no refund.`}
        >
          <input id="ret-refund" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder={itemsValue ? takaInput(itemsValue) : '0'} className={inputClass + ' tabular-nums'} />
        </Field>
        {refundPaisa !== null && refundPaisa > 0 && (
          <>
            <Field id="ret-method" label="Refunded by" required error={f.refundMethod}>
              <select id="ret-method" value={method} onChange={(e) => setMethod(e.target.value as RefundMethod)} className={inputClass}>
                {(Object.keys(methodNames) as RefundMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {methodNames[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ret-ref" label="Transaction id" required={method !== 'CASH'} optional={method === 'CASH'} error={f.refundRef}>
              <input id="ret-ref" value={ref} maxLength={60} onChange={(e) => setRef(e.target.value)} placeholder="e.g. BK8XQ2P1" className={inputClass} />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !valid} className={button('secondary', 'md')}>
          {busy ? 'Saving…' : 'Save the return'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 min-w-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(f).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}
