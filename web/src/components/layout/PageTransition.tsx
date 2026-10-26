import { ViewTransition, type ReactNode } from 'react'
import { useLocation } from 'react-router'

// The soft page change: the old page fades out, the new one fades in with
// an 8px rise (index.css, "Page change"). BrowserRouter runs every
// navigation inside startTransition, which is what lets React's
// <ViewTransition> animate it. The key makes each URL path a new page, so
// React plays exit on the old one and enter on the new one. Other updates
// inside a page (default="none") never animate the whole page.
// Browsers without the View Transitions API just change the page.
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  )
}
