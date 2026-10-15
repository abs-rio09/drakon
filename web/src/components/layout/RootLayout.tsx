import { Outlet, useLocation } from 'react-router'
import { useCart } from '../../features/cart/useCart'
import { ScrollManager } from './ScrollManager'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

// The frame around every customer page: header on top, footer at the bottom.
// <Outlet /> is where react-router puts the page that matches the URL.
export function RootLayout() {
  const { count } = useCart()
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <a
        href="#main"
        className="fixed top-4 left-4 z-50 -translate-y-24 rounded-xl border border-line-strong bg-surface-raised px-4 py-3 text-label text-ink-strong focus:translate-y-0"
      >
        Skip to content
      </a>
      <SiteHeader cartCount={count} overPhoto={pathname === '/'} />
      {/* tabIndex -1 lets the skip link move keyboard focus here */}
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
