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
      <header className="border-b border-line">
        <div className={container + ' flex min-h-18 items-center justify-between gap-4'}>
          <Link to="/" className="inline-flex items-center gap-2">
            <LogoContent />
          </Link>
          <Link to="/cart" className={textLink + ' inline-flex items-center gap-2 text-label text-ink-muted'}>
            <ArrowLeftIcon size={16} />
            Back to cart
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
