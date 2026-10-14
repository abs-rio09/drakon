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
  rounded = 'rounded-2xl',
  className = '',
}: ProductPhotoProps) {
  return (
    <span className={`relative block overflow-hidden bg-field ${rounded} ${aspect} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
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
