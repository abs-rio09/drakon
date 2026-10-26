// The view-transition name that lets a product's photo fly from its card
// into its page and back (ProductPhoto shareName). A name may be on the
// page only once.
export function productPhotoName(slug: string): string {
  return `photo-${slug}`
}
