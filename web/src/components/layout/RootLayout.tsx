import { Outlet } from 'react-router'
import { ScrollManager } from './ScrollManager'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

// The frame around every customer page: header on top, footer at the bottom.
// <Outlet /> is where react-router puts the page that matches the URL.
export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-surface-raised px-4 py-3 text-label text-ink-strong focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
