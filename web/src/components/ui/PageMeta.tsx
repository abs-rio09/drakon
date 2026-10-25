import { useEffect } from 'react'

// The default description in index.html (also what crawlers without
// JavaScript read). Pages replace it while they are open.
const fallback = 'Limited playcards, sports toys, tech toys and clothes. Each run is made once and never restocked. Cash on Delivery across Bangladesh.'

// Title, description and (for private pages like the cart) noindex for one
// page. React 19 puts <title> and <meta> into <head> by itself. The
// description is changed on the one tag from index.html, so there is never
// a second description tag.
export function PageMeta({ title, description, noindex = false }: { title: string; description?: string; noindex?: boolean }) {
  useEffect(() => {
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) return
    tag.content = description ?? fallback
    return () => {
      tag.content = fallback
    }
  }, [description])
  return (
    <>
      <title>{title}</title>
      {noindex && <meta name="robots" content="noindex" />}
    </>
  )
}
