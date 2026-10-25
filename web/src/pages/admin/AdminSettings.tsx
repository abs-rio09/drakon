import { useState } from 'react'
import { Link } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { AdminPanel, FormMessage, tapArea } from '../../components/admin/adminUi'
import { Field, inputClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button, inlineLink } from '../../components/ui/styles'
import { getAdminProducts, getAdminSettings, saveSettings } from '../../features/admin/adminApi'
import type { AdminProductRow, SettingRow } from '../../features/admin/types'
import { useAction } from '../../features/admin/useAction'
import { formatDateTime } from '../../lib/dates'
import { clearApiCache, useApi } from '../../lib/useApi'

type Value = number | boolean | string

// The page groups the settings; every key appears once.
const groups: { title: string; keys: string[]; note?: string }[] = [
  { title: 'Orders', keys: ['cod_confirm_hours', 'default_purchase_limit', 'return_days', 'archive_after_days', 'low_stock_threshold'] },
  { title: 'Checkout notes', keys: ['gift_note_max_chars', 'courier_note_max_chars'] },
  { title: 'Delivery', keys: ['free_delivery_enabled'], note: 'delivery' },
  { title: 'Home page', keys: ['home_hero_product_slug'] },
  { title: 'Admin login', keys: ['login_max_failures', 'login_lockout_minutes'] },
  {
    title: 'Too many tries (per IP address)',
    keys: [
      'rate_login_tries',
      'rate_login_minutes',
      'rate_order_tries',
      'rate_order_minutes',
      'rate_track_tries',
      'rate_track_minutes',
      'rate_cancel_tries',
      'rate_cancel_minutes',
    ],
  },
]

// /admin/settings: every business number, with sane limits. The shop
// uses a new value on its next page load (no code change, no rebuild).
export default function AdminSettings() {
  const loaded = useApi('admin:settings', getAdminSettings)
  const products = useApi('admin:products::', () => getAdminProducts({}))
  return (
    <>
      <AdminPageHeader title="Settings" intro="The numbers the shop works with. Changes show on the website at once." />
      <Loaded state={loaded}>{(rows) => <SettingsForm initial={rows} products={products.data?.products ?? []} />}</Loaded>
    </>
  )
}

function SettingsForm({ initial, products }: { initial: SettingRow[]; products: AdminProductRow[] }) {
  const [rows, setRows] = useState(initial)
  const [values, setValues] = useState<Record<string, Value>>(() => Object.fromEntries(initial.map((r) => [r.key, r.value])))
  const [saved, setSaved] = useState(false)
  const { run, busy, error } = useAction()
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
  const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => byKey[k] && v !== byKey[k].value))
  const dirty = Object.keys(changed).length > 0

  function set(key: string, value: Value) {
    setValues((v) => ({ ...v, [key]: value }))
    setSaved(false)
  }

  async function onSave() {
    const r = await run(() => saveSettings(changed))
    if (r) {
      clearApiCache()
      setRows(r)
      setValues(Object.fromEntries(r.map((x) => [x.key, x.value])))
      setSaved(true)
    }
  }

  const heroChoices = products.filter((p) => p.status !== 'DRAFT')
  const f = error?.fields ?? {}
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {groups.map((g) => (
          <AdminPanel key={g.title} id={`set-${g.title}`} title={g.title}>
            {g.keys.map((key) => {
              const row = byKey[key]
              if (!row) return null
              const id = `s-${key}`
              const hint = (
                <>
                  {row.description}
                  {row.kind === 'int' && ` (${row.min ?? 0}–${row.max} ${row.unit ?? ''})`}
                  <span className="block">Changed {formatDateTime(row.updatedAt)}</span>
                </>
              )
              if (row.kind === 'bool') {
                return (
                  <label key={key} className="flex items-start gap-3 text-label font-normal text-ink">
                    <input type="checkbox" checked={values[key] === true} onChange={(e) => set(key, e.target.checked)} className="mt-0.5 size-5 accent-ink" />
                    <span>
                      {row.label}
                      <span className="block text-caption text-ink-subtle">
                        The amount for each zone is on the{' '}
                        <Link to="/admin/delivery" className={inlineLink + ' ' + tapArea}>
                          Delivery
                        </Link>{' '}
                        page.
                      </span>
                      {f[key] && <span className="block text-caption text-danger-text">{f[key]}</span>}
                    </span>
                  </label>
                )
              }
              if (key === 'home_hero_product_slug') {
                return (
                  <Field key={key} id={id} label={row.label} error={f[key]} hint={hint}>
                    <select id={id} value={String(values[key])} onChange={(e) => set(key, e.target.value)} className={inputClass}>
                      <option value="">None</option>
                      {heroChoices.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                      {values[key] !== '' && !heroChoices.some((p) => p.slug === values[key]) && <option value={String(values[key])}>{String(values[key])}</option>}
                    </select>
                  </Field>
                )
              }
              return (
                <Field key={key} id={id} label={row.label} error={f[key]} hint={hint}>
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={row.min ?? 0}
                    max={row.max}
                    value={String(values[key])}
                    onChange={(e) => set(key, e.target.value === '' ? '' : Number(e.target.value))}
                    aria-invalid={f[key] ? true : undefined}
                    className={inputClass + ' sm:w-40'}
                  />
                </Field>
              )
            })}
          </AdminPanel>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-line bg-surface px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button type="button" disabled={!dirty || busy} onClick={onSave} className={button('primary', 'md')}>
          {busy ? 'Saving…' : dirty ? `Save ${Object.keys(changed).length} ${Object.keys(changed).length === 1 ? 'change' : 'changes'}` : 'Save'}
        </button>
        {saved && !dirty && <FormMessage>Saved. The shop uses the new values now.</FormMessage>}
        {error && <FormMessage error>{Object.keys(f).length > 0 ? 'Nothing was saved. Fix the marked values.' : error.message}</FormMessage>}
      </div>
    </div>
  )
}
