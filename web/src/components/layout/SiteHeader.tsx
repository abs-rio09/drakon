import { useEffect, useId, useState } from 'react'
import { LogoContent } from '../Logo'
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from '../icons'

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
  // Which link is the current page, so it gets the underline.
  current?: string
}

const iconButton =
  'relative grid size-11 place-items-center rounded-full text-ink-muted transition-colors duration-150 ease-out hover:bg-field hover:text-ink-strong'

export function SiteHeader({ cartCount = 0, current }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

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
    <header className="sticky top-0 z-30 border-b border-line bg-surface-glass backdrop-blur-xl">
      <div className="relative mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <nav aria-label="Main" className="flex min-h-18 items-center justify-between gap-4">
          <a href="/" className="inline-flex items-center gap-2">
            <LogoContent />
          </a>

          {/* Desktop links: hidden below 768px */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const isCurrent = current === link.href
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={
                    'py-2 text-label transition-colors duration-150 ease-out hover:text-ink-strong ' +
                    (isCurrent ? 'text-ink-strong shadow-[inset_0_-2px_0_var(--color-ink-strong)]' : 'text-ink-muted')
                  }
                >
                  {link.label}
                </a>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <a href="/search" aria-label="Search" className={iconButton + ' hidden md:grid'}>
              <SearchIcon />
            </a>
            <a href="/cart" aria-label={cartLabel} className={iconButton}>
              <BagIcon />
              {cartCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-ink-strong px-1 text-micro font-semibold text-on-accent tabular-nums"
                >
                  {cartCount}
                </span>
              )}
            </a>
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
                    <a
                      href={link.href}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={
                        'block rounded-xl px-4 py-3 text-body transition-colors duration-150 ease-out hover:bg-field hover:text-ink-strong ' +
                        (isCurrent ? 'bg-field text-ink-strong' : 'text-ink')
                      }
                    >
                      {link.label}
                    </a>
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
