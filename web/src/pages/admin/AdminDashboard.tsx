import { Link } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { AdminPanel } from '../../components/admin/adminUi'
import { PhoneIcon } from '../../components/icons'
import { Loaded } from '../../components/ui/LoadState'
import { button, inlineLink } from '../../components/ui/styles'
import { getCallList, getDashboard } from '../../features/admin/adminApi'
import { formatPhone, telHref, timeLeft } from '../../features/admin/format'
import type { CallListRow, Dashboard } from '../../features/admin/types'
import { formatTaka } from '../../lib/money'
import { useApi } from '../../lib/useApi'

// /admin: today's call list first (the daily work), then the numbers.
export default function AdminDashboard() {
  const dashboard = useApi('admin:dashboard', getDashboard)
  const calls = useApi('admin:call-list', getCallList)

  return (
    <>
      <AdminPageHeader title="Dashboard" intro="Today’s calls first. The oldest order waits the longest." />
      <div className="flex flex-col gap-8">
        <Loaded state={calls}>{(data) => <CallList rows={data.orders} hours={data.codConfirmHours} />}</Loaded>
        <Loaded state={dashboard}>{(data) => <Numbers d={data} />}</Loaded>
      </div>
    </>
  )
}

function CallList({ rows, hours }: { rows: CallListRow[]; hours: number }) {
  return (
    <AdminPanel id="calls-h" title="To call today" aside={`Unconfirmed orders cancel after ${hours} hours`}>
      {rows.length === 0 ? (
        <p className="text-body text-ink-muted">Nobody is waiting for a call. Well done.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {rows.map((o) => {
            const left = timeLeft(o.cancelsAt)
            return (
              <li key={o.orderNumber} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <Link to={`/admin/orders/${o.orderNumber}`} className="text-body font-medium text-ink-strong underline-offset-4 hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className={'text-caption ' + (left.urgent ? 'text-accent-text' : 'text-ink-subtle')}>{left.text}</span>
                  </span>
                  <span className="text-label font-normal text-ink-muted">
                    {o.name} · {o.district} · {formatTaka(o.totalPaisa)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a href={telHref(o.phone)} className={button('secondary') + ' tabular-nums'}>
                    <PhoneIcon size={14} />
                    {formatPhone(o.phone)}
                  </a>
                  <Link to={`/admin/orders/${o.orderNumber}`} className={button('secondary')}>
                    Open
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </AdminPanel>
  )
}

function Tile({ label, value, hint, to }: { label: string; value: string; hint?: string; to?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface-raised p-5">
      <span className="text-label text-ink-muted">{label}</span>
      <span className="text-heading-3 text-ink-strong tabular-nums">{value}</span>
      {hint && <span className="text-caption text-ink-subtle">{hint}</span>}
      {to && (
        <Link to={to} className={inlineLink + ' mt-1 text-caption'}>
          See them
        </Link>
      )}
    </div>
  )
}

function Numbers({ d }: { d: Dashboard }) {
  return (
    <>
      <section aria-labelledby="orders-h" className="flex flex-col gap-4">
        <h2 id="orders-h" className="text-title text-ink-strong">
          Orders now
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Pending call" value={String(d.counts.PENDING)} to="/admin/orders?status=PENDING" />
          <Tile label="Confirmed, to ship" value={String(d.counts.CONFIRMED)} to="/admin/orders?status=CONFIRMED" />
          <Tile label="On the way" value={String(d.counts.SHIPPED)} to="/admin/orders?status=SHIPPED" />
          <Tile label="Placed today" value={String(d.placedToday.orders)} hint={formatTaka(d.placedToday.totalPaisa)} />
        </div>
      </section>
      <section aria-labelledby="sales-h" className="flex flex-col gap-4">
        <h2 id="sales-h" className="text-title text-ink-strong">
          Sales (cash collected)
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile
            label="Today"
            value={formatTaka(d.deliveredToday.totalPaisa)}
            hint={`${d.deliveredToday.orders} delivered`}
          />
          <Tile
            label="Last 7 days"
            value={formatTaka(d.deliveredLast7Days.totalPaisa)}
            hint={`${d.deliveredLast7Days.orders} delivered`}
          />
        </div>
      </section>
    </>
  )
}
