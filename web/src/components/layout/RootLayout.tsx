import { Outlet } from 'react-router'
import { resolveCart } from '../../features/cart/cartItems'
import { useCart } from '../../features/cart/useCart'
import { ScrollManager } from './ScrollManager'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

// The frame around every customer page: header on top, footer at the bottom.
// <Outlet /> is where react-router puts the page that matches the URL.
export function RootLayout() {
  const { lines } = useCart()
  // Count only what can still be ordered (sold-out lines are left out).
  const count = resolveCart(lines).items.reduce((sum, item) => sum + item.qty, 0)
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-surface-raised px-4 py-3 text-label text-ink-strong focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <SiteHeader cartCount={count} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
