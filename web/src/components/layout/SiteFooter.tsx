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
            <a href="/" className="inline-flex items-center gap-2 self-start">
              <LogoContent />
            </a>
            <p className="max-w-75 text-label font-normal text-ink-subtle">
              Limited playcards, toys, tech and clothes. Made once, never restocked. Cash on Delivery across Bangladesh.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title} className="flex flex-col gap-3">
              <h2 className="text-label text-ink-strong">{group.title}</h2>
              <ul className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-label font-normal text-ink-muted transition-colors duration-150 ease-out hover:text-ink-strong"
                    >
                      {link.label}
                    </a>
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
