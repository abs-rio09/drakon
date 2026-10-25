import { Link, Outlet } from 'react-router'
import { LogoContent } from '../Logo'
import { ArrowLeftIcon } from '../icons'
import { container, textLink } from '../ui/styles'
import { ScrollManager } from './ScrollManager'

// Checkout gets a quiet header: only the logo and a way back to the cart,
// so nothing pulls the buyer away from finishing the order.
export function CheckoutLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <a
        href="#main"
        className="fixed top-4 left-4 z-50 -translate-y-24 rounded-xl border border-line-strong bg-surface-raised px-4 py-3 text-label text-ink-strong focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className={container + ' flex min-h-18 items-center justify-between gap-4'}>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2">
            <LogoContent />
          </Link>
          <Link to="/cart" className={textLink + ' inline-flex items-center gap-2 text-label text-ink-muted'}>
            <ArrowLeftIcon size={16} />
            Back to cart
          </Link>
        </div>
      </header>
      {/* tabIndex -1 lets the skip link move keyboard focus here */}
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
    </div>
  )
}
