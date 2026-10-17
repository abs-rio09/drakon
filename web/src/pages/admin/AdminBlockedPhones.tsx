import { useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { AdminPanel } from '../../components/admin/adminUi'
import { AlertIcon } from '../../components/icons'
import { Field, inputClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button, ghostButton } from '../../components/ui/styles'
import { blockPhone, getBlockedPhones, unblockPhone } from '../../features/admin/adminApi'
import { formatPhone } from '../../features/admin/format'
import type { BlockedPhone } from '../../features/admin/types'
import { ApiError } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'
import { useApi } from '../../lib/useApi'

// /admin/blocked-phones: numbers that keep refusing COD orders
// (blueprint rule 4). A blocked phone cannot place new orders.
export default function AdminBlockedPhones() {
  const loaded = useApi('admin:blocked-phones', getBlockedPhones)
  const [fresh, setFresh] = useState<BlockedPhone[] | null>(null)

  return (
    <>
      <AdminPageHeader
        title="Blocked phones"
        intro="These numbers cannot place orders on the website. Their old orders stay as they are."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <Loaded state={loaded}>{(data) => <PhoneList phones={fresh ?? data} onChange={setFresh} />}</Loaded>
        <BlockForm onChange={setFresh} />
      </div>
    </>
  )
}

function PhoneList({ phones, onChange }: { phones: BlockedPhone[]; onChange: (p: BlockedPhone[]) => void }) {
  const [asking, setAsking] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function unblock(phone: string) {
    setError('')
    try {
      onChange(await unblockPhone(phone))
      setAsking(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <AdminPanel id="list-h" title={phones.length === 1 ? '1 blocked number' : `${phones.length} blocked numbers`}>
      {phones.length === 0 ? (
        <p className="text-body text-ink-muted">No phone number is blocked.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {phones.map((p) => (
            <li key={p.phone} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-body font-medium text-ink-strong tabular-nums">{formatPhone(p.phone)}</span>
                <span className="text-caption text-ink-subtle">
                  {formatDateTime(p.blockedAt)}
                  {p.blockedBy ? ` · ${p.blockedBy}` : ''}
                </span>
              </div>
              <p className="text-label font-normal text-ink-muted">{p.reason || 'No reason written'}</p>
              {asking === p.phone ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-label font-normal text-ink">Allow orders from this number again?</span>
                  <button type="button" onClick={() => unblock(p.phone)} className={button('secondary')}>
                    Yes, unblock
                  </button>
                  <button type="button" onClick={() => setAsking(null)} className={ghostButton + ' min-h-11 px-2'}>
                    Keep blocked
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setAsking(p.phone)} className={ghostButton + ' min-h-11 self-start'}>
                  Unblock
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-label font-normal text-danger-text">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </AdminPanel>
  )
}

function BlockForm({ onChange }: { onChange: (p: BlockedPhone[]) => void }) {
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      onChange(await blockPhone(phone, reason))
      setPhone('')
      setReason('')
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', 'Something went wrong. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminPanel id="block-h" title="Block a number">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field id="bp-phone" label="Phone number" error={error?.fields.phone}>
          <input
            id="bp-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            aria-invalid={error?.fields.phone ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field id="bp-reason" label="Reason" error={error?.fields.reason}>
          <input
            id="bp-reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Refused 3 deliveries"
            aria-invalid={error?.fields.reason ? true : undefined}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={sending} className={button('secondary', 'md')}>
          {sending ? 'Blocking…' : 'Block this number'}
        </button>
        {error && Object.keys(error.fields).length === 0 && (
          <p role="alert" className="text-label font-normal text-danger-text">
            {error.message}
          </p>
        )}
      </form>
    </AdminPanel>
  )
}
