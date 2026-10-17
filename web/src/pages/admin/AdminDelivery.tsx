import { useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { AdminPanel, FormMessage } from '../../components/admin/adminUi'
import { PlusIcon, SearchIcon } from '../../components/icons'
import { Field, inputClass } from '../../components/ui/Field'
import { Loaded } from '../../components/ui/LoadState'
import { button, ghostButton } from '../../components/ui/styles'
import { createArea, createZone, getAdminDelivery, saveSettings, updateArea, updateZone } from '../../features/admin/adminApi'
import { parseTaka, takaInput } from '../../features/admin/format'
import type { AdminArea, AdminDelivery as Delivery, AdminZone } from '../../features/admin/types'
import { useAction } from '../../features/admin/useAction'
import { formatTaka } from '../../lib/money'
import { clearApiCache, useApi } from '../../lib/useApi'

type ChangeProps = { data: Delivery; onChange: (d: Delivery) => void }

// /admin/delivery (blueprint rules 5 and 6): zone charges, free delivery,
// and which zone each district (area) belongs to. Checkout uses the new
// numbers at once; orders already placed keep the charge they paid.
export default function AdminDelivery() {
  const loaded = useApi('admin:delivery', getAdminDelivery)
  const [fresh, setFresh] = useState<Delivery | null>(null)
  const changed = (d: Delivery) => {
    clearApiCache()
    setFresh(d)
  }
  return (
    <>
      <AdminPageHeader title="Delivery" intro="Charges per zone, free delivery, and which zone each district belongs to." />
      <Loaded state={loaded}>
        {(data) => {
          const d = fresh ?? data
          return (
            <div className="flex flex-col gap-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                <Zones data={d} onChange={changed} />
                <div className="flex flex-col gap-6">
                  <FreeDelivery data={d} onChange={changed} />
                  <NewZone onChange={changed} />
                </div>
              </div>
              <Areas data={d} onChange={changed} />
            </div>
          )
        }}
      </Loaded>
    </>
  )
}

function Zones({ data, onChange }: ChangeProps) {
  const [editing, setEditing] = useState<number | null>(null)
  return (
    <AdminPanel id="zones-h" title="Zones">
      <ul className="flex flex-col divide-y divide-line">
        {data.zones.map((z) => (
          <li key={z.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="flex flex-col">
                <span className={'text-label ' + (z.isActive ? 'text-ink-strong' : 'text-ink-subtle')}>
                  {z.name}
                  {!z.isActive && <span className="ml-2 text-caption">(turned off)</span>}
                </span>
                <span className="text-caption text-ink-subtle">
                  {z.code} · {z.activeAreas} {z.activeAreas === 1 ? 'area' : 'areas'}
                </span>
              </span>
              <span className="flex flex-col items-end tabular-nums">
                <span className="text-price text-ink-strong">{formatTaka(z.chargePaisa)}</span>
                <span className="text-caption text-ink-subtle">{z.freeOverPaisa === null ? 'Never free' : `Free over ${formatTaka(z.freeOverPaisa)}`}</span>
              </span>
            </div>
            {editing === z.id ? (
              <ZoneForm zone={z} onDone={(d) => {
                onChange(d)
                setEditing(null)
              }} onCancel={() => setEditing(null)} />
            ) : (
              <button type="button" onClick={() => setEditing(z.id)} className={ghostButton + ' min-h-9 self-start'}>
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>
    </AdminPanel>
  )
}

function ZoneForm({ zone, onDone, onCancel }: { zone: AdminZone; onDone: (d: Delivery) => void; onCancel: () => void }) {
  const [name, setName] = useState(zone.name)
  const [charge, setCharge] = useState(takaInput(zone.chargePaisa))
  const [freeOver, setFreeOver] = useState(zone.freeOverPaisa === null ? '' : takaInput(zone.freeOverPaisa))
  const [active, setActive] = useState(zone.isActive)
  const { run, busy, error } = useAction()
  // ৳0 is a valid charge (parseTaka refuses 0, so check it by hand).
  const chargePaisa = charge.trim() === '0' ? 0 : parseTaka(charge)
  const freeOverPaisa = freeOver.trim() === '' ? null : parseTaka(freeOver)
  const valid = chargePaisa !== null && (freeOver.trim() === '' || freeOverPaisa !== null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const d = await run(() => updateZone(zone.id, { name, chargePaisa: chargePaisa ?? 0, freeOverPaisa, isActive: active }))
    if (d) onDone(d)
  }

  const f = error?.fields ?? {}
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`z-name-${zone.id}`} label="Name" required error={f.name}>
          <input id={`z-name-${zone.id}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`z-charge-${zone.id}`} label="Charge in Taka" required error={f.chargePaisa ?? (chargePaisa === null && charge !== '' ? 'Enter an amount like 60.' : undefined)}>
          <input id={`z-charge-${zone.id}`} inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} className={inputClass + ' tabular-nums'} />
        </Field>
        <Field id={`z-free-${zone.id}`} label="Free over (Taka)" optional error={f.freeOverPaisa} hint="Empty = never free here.">
          <input id={`z-free-${zone.id}`} inputMode="decimal" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} placeholder="3000" className={inputClass + ' tabular-nums'} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-label font-normal text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-ink" />
        On (a zone with areas cannot be turned off: move its areas first)
      </label>
      <p className="text-caption text-ink-subtle">Orders already placed keep the charge they were placed with.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !valid} className={button('secondary')}>
          {busy ? 'Saving…' : 'Save zone'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(f).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}

function FreeDelivery({ data, onChange }: ChangeProps) {
  const { run, busy, error } = useAction()
  async function toggle() {
    const ok = await run(() => saveSettings({ free_delivery_enabled: !data.freeDeliveryEnabled }))
    if (ok) {
      const d = await run(getAdminDelivery)
      if (d) onChange(d)
    }
  }
  return (
    <AdminPanel id="free-h" title="Free delivery">
      <p className="text-body text-ink-muted">
        {data.freeDeliveryEnabled
          ? 'On: an order is delivered free when its items reach the zone’s “free over” amount.'
          : 'Off: every order pays the zone’s charge.'}
      </p>
      <button type="button" disabled={busy} onClick={toggle} className={button('secondary') + ' self-start'}>
        {busy ? 'Saving…' : data.freeDeliveryEnabled ? 'Turn free delivery off' : 'Turn free delivery on'}
      </button>
      {error && <FormMessage error>{error.message}</FormMessage>}
    </AdminPanel>
  )
}

function NewZone({ onChange }: { onChange: (d: Delivery) => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [charge, setCharge] = useState('')
  const { run, busy, error } = useAction()
  const chargePaisa = charge.trim() === '0' ? 0 : parseTaka(charge)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (chargePaisa === null) return
    const d = await run(() => createZone({ code, name, chargePaisa, freeOverPaisa: null }))
    if (d) {
      onChange(d)
      setCode('')
      setName('')
      setCharge('')
    }
  }

  const f = error?.fields ?? {}
  return (
    <AdminPanel id="newzone-h" title="New zone">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field id="nz-name" label="Name" required error={f.name}>
          <input id="nz-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Chattogram city" className={inputClass} />
        </Field>
        <Field id="nz-code" label="Code" required error={f.code} hint="Capital letters and _. Saved on every order; it cannot change.">
          <input id="nz-code" value={code} maxLength={30} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CHATTOGRAM_CITY" className={inputClass} />
        </Field>
        <Field id="nz-charge" label="Charge in Taka" required error={f.chargePaisa}>
          <input id="nz-charge" inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="80" className={inputClass} />
        </Field>
        <button type="submit" disabled={busy || chargePaisa === null} className={button('secondary')}>
          <PlusIcon size={16} />
          {busy ? 'Adding…' : 'Add zone'}
        </button>
        {error && Object.keys(f).length === 0 && <FormMessage error>{error.message}</FormMessage>}
      </form>
    </AdminPanel>
  )
}

function Areas({ data, onChange }: ChangeProps) {
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const zoneById = Object.fromEntries(data.zones.map((z) => [z.id, z]))
  const districts = [...new Set(data.areas.map((a) => a.district))]
  const shown = districts.filter((d) => d.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <AdminPanel id="areas-h" title="Districts and their zones" aside="A district with two or more areas asks the buyer to choose (Dhaka city / Outside Dhaka city)">
      <div className="relative sm:w-72">
        <label htmlFor="a-filter" className="sr-only">
          Find a district
        </label>
        <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle" />
        <input id="a-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a district" className={inputClass + ' pl-10'} />
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((district) => {
          const areas = data.areas.filter((a) => a.district === district)
          return (
            <li key={district} className="flex flex-col gap-2 py-3">
              <span className="text-label text-ink-strong">{district}</span>
              <ul className="flex flex-col gap-2">
                {areas.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className={'text-label font-normal ' + (a.isActive ? 'text-ink' : 'text-ink-subtle line-through')}>
                        {a.label}
                        {a.hint && <span className="ml-2 text-caption text-ink-subtle no-underline">{a.hint}</span>}
                      </span>
                      <span className="flex items-baseline gap-3">
                        <span className="text-caption text-ink-muted">
                          {zoneById[a.zoneId]?.name} · {zoneById[a.zoneId] ? formatTaka(zoneById[a.zoneId].chargePaisa) : ''}
                        </span>
                        <button type="button" onClick={() => setEditing(a.id)} className={ghostButton + ' min-h-9'}>
                          Edit
                        </button>
                      </span>
                    </div>
                    {editing === a.id && (
                      <AreaForm area={a} zones={data.zones} onDone={(d) => {
                onChange(d)
                setEditing(null)
              }} onCancel={() => setEditing(null)} />
                    )}
                  </li>
                ))}
              </ul>
              {adding === district ? (
                <AreaForm district={district} defaultZoneId={areas[0]?.zoneId} zones={data.zones} onDone={(d) => {
                onChange(d)
                setAdding(null)
              }} onCancel={() => setAdding(null)} />
              ) : (
                <button type="button" onClick={() => setAdding(district)} className={ghostButton + ' min-h-9 self-start text-caption'}>
                  Split {district}: add an area
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {shown.length === 0 && <p className="text-label font-normal text-ink-subtle">No district matches.</p>}
    </AdminPanel>
  )
}

// Edit an area (label, hint, zone, on/off) or add one to a district.
function AreaForm({
  area,
  district,
  defaultZoneId,
  zones,
  onDone,
  onCancel,
}: {
  area?: AdminArea
  district?: string
  defaultZoneId?: number // a new area starts in the zone of the district's other area
  zones: AdminZone[]
  onDone: (d: Delivery) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(area?.label ?? '')
  const [hint, setHint] = useState(area?.hint ?? '')
  const [zoneId, setZoneId] = useState(area?.zoneId ?? defaultZoneId ?? zones.find((z) => z.isActive)?.id ?? 0)
  const [active, setActive] = useState(area?.isActive ?? true)
  const { run, busy, error } = useAction()
  const key = area?.id ?? `new-${district}`

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const d = await run(() =>
      area ? updateArea(area.id, { label, hint, zoneId, isActive: active }) : createArea({ district: district ?? '', label, hint, zoneId }),
    )
    if (d) onDone(d)
  }

  const f = error?.fields ?? {}
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`ar-label-${key}`} label="Area name" required error={f.label}>
          <input id={`ar-label-${key}`} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder={`${district ?? area?.district} city`} className={inputClass} />
        </Field>
        <Field id={`ar-hint-${key}`} label="Hint" optional error={f.hint} hint="Shown under the choice.">
          <input id={`ar-hint-${key}`} value={hint} maxLength={100} onChange={(e) => setHint(e.target.value)} className={inputClass} />
        </Field>
        <Field id={`ar-zone-${key}`} label="Zone" required error={f.zoneId}>
          <select id={`ar-zone-${key}`} value={zoneId} onChange={(e) => setZoneId(Number(e.target.value))} className={inputClass}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · {formatTaka(z.chargePaisa)}
                {z.isActive ? '' : ' (off)'}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {area && (
        <label className="flex items-center gap-3 text-label font-normal text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-ink" />
          We deliver here
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={button('secondary')}>
          {busy ? 'Saving…' : area ? 'Save area' : 'Add area'}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton + ' min-h-11 px-2'}>
          Cancel
        </button>
      </div>
      {error && Object.keys(f).length === 0 && <FormMessage error>{error.message}</FormMessage>}
    </form>
  )
}
