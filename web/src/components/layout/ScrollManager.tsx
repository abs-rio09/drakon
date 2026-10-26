import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router'

// When the page changes, start at the top (like a normal website).
// If the link has a #hash (for example /#collections), scroll to that section.
// A layout effect, so it runs before the browser takes the "new page"
// picture for the page transition (else the new page would fly in from
// the old scroll position).
export function ScrollManager() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
