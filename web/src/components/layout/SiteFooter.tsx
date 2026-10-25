import { Link } from 'react-router'
import { LogoContent } from '../Logo'

const FOOTER_GROUPS = [
  {
    title: 'Shop',
    links: [
      { label: 'All products', href: '/shop' },
      { label: 'Collections', href: '/#collections' },
      { label: 'Sold out archive', href: '/sold-out' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Track order', href: '/track' },
      { label: 'Returns and refunds', href: '/policies/returns' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Drakon',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Terms', href: '/policies/terms' },
      { label: 'Privacy', href: '/policies/privacy' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-page flex-col gap-14 px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 self-start">
              <LogoContent />
            </Link>
            <p className="max-w-75 text-label font-normal text-ink-subtle">
              Limited playcards, toys, tech and clothes. Made once, never restocked. Cash on Delivery across Bangladesh.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title} className="flex flex-col gap-3">
              <h2 className="text-label text-ink-strong">{group.title}</h2>
              {/* Phones: each link is a 44px row (easy to tap). From md up the rows keep the design's 12px gaps. */}
              <ul className="flex flex-col md:gap-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="flex min-h-11 items-center text-label font-normal text-ink-muted transition-colors duration-150 ease-out hover:text-ink-strong md:inline md:min-h-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-caption text-ink-subtle">
          <span>© 2026 Drakon. All rights reserved.</span>
          <span>Made in Bangladesh, for the night shift.</span>
        </div>
      </div>
    </footer>
  )
}
