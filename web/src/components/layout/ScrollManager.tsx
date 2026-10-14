import { useEffect } from 'react'
import { useLocation } from 'react-router'

// When the page changes, start at the top (like a normal website).
// If the link has a #hash (for example /#collections), scroll to that section.
export function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
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
