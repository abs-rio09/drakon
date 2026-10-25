// A product photo in a rounded frame. The empty frame shows the `field`
// colour until the image loads, then the image fades in once.
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
}: ProductPhotoProps) {
  return (
    <span className={`relative block overflow-hidden bg-field ${rounded} ${aspect} ${className}`}>
      <img
        src={src}
        srcSet={thumb && thumb !== src ? `${thumb} 240w, ${src} 1000w` : undefined}
        sizes={thumb && thumb !== src ? sizes : undefined}
        alt={alt}
        loading={eager || priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={
          'size-full object-cover motion-safe:animate-fade-in ' +
          (zoomOnHover
            ? 'transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-safe:group-hover:scale-[1.03] '
            : '') +
          (soldOut ? 'opacity-60 grayscale' : '')
        }
      />
    </span>
  )
}
