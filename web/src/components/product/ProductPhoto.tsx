import { useState, ViewTransition } from 'react'

// A product photo in a rounded frame. The empty frame shows the `field`
// colour until the image loads, then the image fades in once. A photo the
// browser already showed (same file) appears at once, without a new fade:
// that keeps the photo still when it moves from a card to its page.
const shownPhotos = new Set<string>() // absolute URLs (img.currentSrc)
const absolute = (src: string) => new URL(src, window.location.href).href

type ProductPhotoProps = {
  src: string
  alt: string
  // Tailwind aspect class: square for products, 4:3 for the archive.
  aspect?: string
  soldOut?: boolean
  zoomOnHover?: boolean
  eager?: boolean
  // The main photo of the page (its biggest image): load it before anything else.
  priority?: boolean
  // The small square crop (t-*.webp, 240px). With it the browser may pick
  // the small file for small cards; on sharp phone screens it takes src.
  thumb?: string
  // How wide the photo shows, for the browser's choice (the sizes attribute).
  sizes?: string
  // Tailwind radius class; photos use 2xl, small thumbnails lg.
  rounded?: string
  className?: string
  // productPhotoName(slug) (photoName.ts): this photo flies between the card and the page.
  shareName?: string
}

export function ProductPhoto({
  src,
  alt,
  aspect = 'aspect-square',
  soldOut = false,
  zoomOnHover = true,
  eager = false,
  priority = false,
  thumb,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  rounded = 'rounded-2xl',
  className = '',
  shareName,
}: ProductPhotoProps) {
  const [loaded, setLoaded] = useState(() => src !== '' && shownPhotos.has(absolute(src)))
  const photo = (
    <span className={`relative block overflow-hidden bg-field ${rounded} ${aspect} ${className}`}>
      <img
        src={src}
        srcSet={thumb && thumb !== src ? `${thumb} 240w, ${src} 1000w` : undefined}
        sizes={thumb && thumb !== src ? sizes : undefined}
        alt={alt}
        loading={eager || priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onLoad={(e) => {
          shownPhotos.add(e.currentTarget.currentSrc)
          setLoaded(true)
        }}
        className={
          'size-full object-cover transition-[opacity,scale] duration-slow ease-out-drakon motion-reduce:duration-fast ' +
          (zoomOnHover ? 'motion-safe:group-hover:scale-[1.03] ' : '') +
          (soldOut ? 'grayscale ' : '') +
          (!loaded ? 'opacity-0' : soldOut ? 'opacity-60' : '')
        }
      />
    </span>
  )
  if (!shareName) return photo
  return (
    <ViewTransition name={shareName} share="photo-fly" default="none">
      {photo}
    </ViewTransition>
  )
}
