import { useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAdmin } from '../../features/admin/AdminContext'
import { getDashboard } from '../../features/admin/adminApi'
import { useApi } from '../../lib/useApi'
import { BanIcon, ClipboardIcon, CloseIcon, DashboardIcon, LayersIcon, LogOutIcon, MenuIcon, SlidersIcon, TagIcon, TruckIcon } from '../icons'
import { ScrollManager } from '../layout/ScrollManager'

// One row per admin page, in menu order (docs/design/screens/AdminNav.dc.html).
type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
  end?: boolean // only active on exactly this URL (the dashboard)
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardIcon },
  { to: '/admin/products', label: 'Products', icon: TagIcon },
  { to: '/admin/categories', label: 'Categories', icon: LayersIcon },
  { to: '/admin/delivery', label: 'Delivery', icon: TruckIcon },
  { to: '/admin/settings', label: 'Settings', icon: SlidersIcon },
  { to: '/admin/blocked-phones', label: 'Blocked phones', icon: BanIcon },
]

// The orange bubble on Orders: how many wait for the confirmation call.
function PendingBubble({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span
      aria-label={`${count} ${count === 1 ? 'order' : 'orders'} waiting for phone confirmation`}
      className="grid h-5.5 min-w-5.5 place-items-center rounded-full bg-accent px-2 text-micro font-semibold text-on-accent tabular-nums"
    >
      {count}
    </span>
  )
}

// The small admin logo: ember "D" + "Drakon Admin".
function AdminLogo() {
  return (
    <Link to="/admin" className="inline-flex min-h-11 items-center gap-2 px-2 text-title font-semibold tracking-[-0.02em] text-ink-strong">
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-xl bg-accent text-body font-bold text-on-accent">
        D
      </span>
      Drakon <span className="font-normal text-ink-subtle">Admin</span>
    </Link>
  )
}

function NavLinks({ badges, onNavigate }: { badges: Record<string, ReactNode>; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {navItems.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-label transition-colors duration-150 ease-out ' +
              (isActive ? 'bg-field text-ink-strong' : 'text-ink-muted hover:bg-field hover:text-ink-strong')
            }
          >
            <item.icon size={20} />
            <span className="grow">{item.label}</span>
            {badges[item.to]}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function AccountBox() {
  const { admin, logOut } = useAdmin()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-3 border-t border-line px-2 pt-4">
      <div className="flex flex-col gap-1">
        <span className="text-label font-semibold text-ink-strong">Owner</span>
        <span className="text-micro font-normal break-all text-ink-subtle">{admin?.email}</span>
      </div>
      <button
        type="button"
        onClick={async () => {
          await logOut()
          navigate('/admin/login', { replace: true })
        }}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-label text-ink-muted transition-colors duration-150 ease-out hover:text-ink-strong"
      >
        <LogOutIcon size={16} />
        Log out
      </button>
    </div>
  )
}

// The frame around every admin page. Desktop: a menu on the left.
// Phone: a bar on top with a Menu button (you confirm orders from your phone).
export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  // Counted again on every page change, so the bubble follows your work.
  const counts = useApi(`admin:nav:${pathname}`, getDashboard)
  const pending = counts.data?.counts.PENDING ?? 0
  const badges: Record<string, ReactNode> = { '/admin/orders': <PendingBubble count={pending} /> }
  // Close the phone menu whenever the page changes.
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <ScrollManager />

      {/* Desktop menu */}
      <nav
        aria-label="Admin"
        className="sticky top-0 hidden h-screen flex-col gap-8 border-r border-line bg-surface-raised px-4 py-6 lg:flex"
      >
        <AdminLogo />
        <NavLinks badges={badges} />
        <div className="mt-auto">
          <AccountBox />
        </div>
      </nav>

      {/* Phone bar */}
      <div className="sticky top-0 z-30 border-b border-line bg-surface-raised lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 px-2 sm:px-4">
          <AdminLogo />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-label text-ink-strong hover:bg-field"
          >
            {menuOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            Menu
            {!menuOpen && badges['/admin/orders']}
          </button>
        </div>
        {menuOpen && (
          <nav id="admin-menu" aria-label="Admin" className="flex flex-col gap-6 border-t border-line px-2 pt-4 pb-6 sm:px-4">
            <NavLinks badges={badges} onNavigate={() => setMenuOpen(false)} />
            <AccountBox />
          </nav>
        )}
      </div>

      <main id="main" className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}

// The top of every admin page: title, optional intro and buttons.
export function AdminPageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <title>{`${title} · DRAKON Admin`}</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-3 text-ink-strong sm:text-heading-2">{title}</h1>
        {intro && <div className="max-w-text text-body text-ink-muted">{intro}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}
