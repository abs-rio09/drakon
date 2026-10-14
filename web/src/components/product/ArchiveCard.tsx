import { metaLine, priceLabel } from '../../lib/catalog'
import type { Product } from '../../mocks/catalog'
import { GalleryLabel } from './GalleryLabel'
import { ProductPhoto } from './ProductPhoto'

// A sold-out run in the archive: grayscale 4:3 photo, price struck through.
// layout 'list' (home page): on phones a compact row with a small square photo.
// layout 'grid' (archive page): always the photo on top.
export function ArchiveCard({ product, layout = 'list' }: { product: Product; layout?: 'list' | 'grid' }) {
  const cover = product.images[0]
  if (layout === 'grid') {
    return (
      <article className="flex flex-col gap-4">
        <ProductPhoto src={cover.src} alt={cover.alt} soldOut zoomOnHover={false} aspect="aspect-[4/3]" />
        <GalleryLabel name={product.name} meta={metaLine(product)} price={priceLabel(product)} fact="Sold out" soldOut />
      </article>
    )
  }
  return (
    <article className="flex items-center gap-4 border-b border-line py-4 md:flex-col md:items-stretch md:border-0 md:py-0">
      <ProductPhoto
        src={cover.src}
        alt={cover.alt}
        soldOut
        zoomOnHover={false}
        aspect="aspect-square md:aspect-[4/3]"
        rounded="rounded-lg md:rounded-2xl"
        className="w-28 shrink-0 md:w-full"
      />
      <div className="min-w-0 flex-1">
        <GalleryLabel name={product.name} meta={metaLine(product)} price={priceLabel(product)} fact="Sold out" soldOut />
      </div>
    </article>
  )
}
