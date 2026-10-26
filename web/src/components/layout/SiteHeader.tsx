import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { LogoContent } from '../Logo'
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from '../icons'
import { pressable } from '../ui/styles'

// The four main links. Keep it to four (NavBar README).
const NAV_LINKS = [
  { label: 'Shop', href: '/shop' },
  { label: 'Collections', href: '/#collections' },
  { label: 'Sold out', href: '/sold-out' },
  { label: 'Track order', href: '/track' },
]

type SiteHeaderProps = {
  // Total quantity in the cart. The bubble only shows when it is above 0.
  cartCount?: number
  // On the home hero the bar starts transparent over the photo (NavBar
  // README); elsewhere it starts solid midnight. Both turn glass on scroll.
  overPhoto?: boolean
}

// Which nav link belongs to the page we are on, so it gets the underline.
function currentLink(pathname: string, hash: string): string | undefined {
  if (pathname === '/' && hash === '#collections') return '/#collections'
  if (pathname.startsWith('/shop') || pathname.startsWith('/product')) return '/shop'
  if (pathname.startsWith('/sold-out')) return '/sold-out'
  if (pathname.startsWith('/track')) return '/track'
  if (pathname.startsWith('/search')) return '/search'
  return undefined
}

const iconButton =
  'relative grid size-11 place-items-center rounded-full text-ink-muted hover:bg-field hover:text-ink-strong ' + pressable

export function SiteHeader({ cartCount = 0, overPhoto = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname, hash } = useLocation()
  const current = currentLink(pathname, hash)
  const menuId = useId()
  // The count pops once each time it grows (not on page load, not when it
  // goes down): a new key replays the animation.
  const [pops, setPops] = useState(0)
  const [lastCount, setLastCount] = useState(cartCount)
  if (cartCount !== lastCount) {
    setLastCount(cartCount)
    if (cartCount > lastCount) setPops((n) => n + 1)
  }

  // Remember whether the page has scrolled, so the bar can turn glass.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the phone menu with the Escape key.
  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const cartLabel = cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : 'Cart, empty'

  return (
    // Glass = semi-transparent midnight + blur. The blur is always set (0px
    // at the top) so it can fade in; the border is always there
    // (transparent at the top), so the bar never changes height.
    <header
      className={
        'sticky top-0 z-30 border-b transition-[background-color,border-color,backdrop-filter] duration-base ease-out-drakon motion-reduce:duration-fast ' +
        (scrolled || menuOpen
          ? 'border-line bg-surface-glass backdrop-blur-xl'
          : overPhoto
            ? 'border-transparent bg-transparent backdrop-blur-[0px]'
            : 'border-transparent bg-surface backdrop-blur-[0px]')
      }
    >
      <div className="relative mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <nav aria-label="Main" className="flex min-h-18 items-center justify-between gap-4">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2">
            <LogoContent />
          </Link>

          {/* Desktop links: hidden below 768px */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const isCurrent = current === link.href
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={
                    'py-2 text-label transition-colors duration-fast ease-out-drakon hover:text-ink-strong ' +
                    (isCurrent ? 'text-ink-strong shadow-[inset_0_-2px_0_var(--color-ink-strong)]' : 'text-ink-muted')
                  }
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <Link
              to="/search"
              aria-label="Search"
              aria-current={current === '/search' ? 'page' : undefined}
              className={iconButton + ' hidden md:grid'}
            >
              <SearchIcon />
            </Link>
            <Link
              to="/cart"
              aria-label={cartLabel}
              aria-current={pathname === '/cart' ? 'page' : undefined}
              className={iconButton}
            >
              <BagIcon />
              {cartCount > 0 && (
                <span
                  key={pops}
                  aria-hidden="true"
                  className={
                    'absolute top-1 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-ink-strong px-1 text-micro font-semibold text-on-accent tabular-nums ' +
                    (pops > 0 ? 'motion-safe:animate-pop' : '')
                  }
                >
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Menu'}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
              className={iconButton + ' md:hidden'}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </nav>

        {/* Phone menu sheet */}
        {menuOpen && (
          <div
            id={menuId}
            className="absolute inset-x-4 top-full mt-2 rounded-2xl border border-line bg-surface-raised p-2 shadow-overlay sm:inset-x-6 md:hidden"
          >
            <ul className="flex flex-col">
              {[...NAV_LINKS, { label: 'Search', href: '/search' }].map((link) => {
                const isCurrent = current === link.href
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={
                        'block rounded-xl px-4 py-3 text-body transition-colors duration-fast ease-out-drakon hover:bg-field hover:text-ink-strong ' +
                        (isCurrent ? 'bg-field text-ink-strong' : 'text-ink')
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </header>
  )
}
