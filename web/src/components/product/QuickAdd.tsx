import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useCart } from '../../features/cart/useCart'
import { useSite } from '../../features/site/SiteContext'
import { maxQuantity } from '../../lib/catalog'
import type { Product } from '../../lib/types'
import { CheckIcon, PlusIcon } from '../icons'
import { pressable } from '../ui/styles'

const roundButton =
  'absolute right-3 bottom-3 grid size-11 place-items-center rounded-full border border-line bg-surface-glass text-ink-strong backdrop-blur-xl ' +
  pressable

// The round "+" on a product photo. A product with one variant goes straight
// into the cart; a product with sizes or materials opens its page to choose.
export function QuickAdd({ product }: { product: Product }) {
  const cart = useCart()
  const { settings } = useSite()
  const [justAdded, setJustAdded] = useState(false)

  // Turn the check mark back into a plus after a moment.
  useEffect(() => {
    if (!justAdded) return
    const timer = window.setTimeout(() => setJustAdded(false), 1600)
    return () => window.clearTimeout(timer)
  }, [justAdded])

  const inStock = product.variants.filter((v) => v.stock > 0)
  if (inStock.length === 0) return null

  if (product.variants.length > 1) {
    return (
      <Link
        to={`/product/${product.slug}`}
        aria-label={`Choose a ${product.variantKind.toLowerCase()} for ${product.name}`}
        className={roundButton + ' hover:border-line-strong hover:bg-field'}
      >
        <PlusIcon size={18} />
      </Link>
    )
  }

  const variant = inStock[0]
  const full = cart.qtyOf(variant.id) >= maxQuantity(product, variant, settings)

  return (
    <>
      <button
        type="button"
        disabled={full}
        aria-label={full ? `${product.name}, limit reached in your cart` : `Add ${product.name} to cart`}
        onClick={() => {
          cart.add(variant.id, 1)
          setJustAdded(true)
        }}
        className={
          roundButton +
          ' enabled:hover:border-accent enabled:hover:bg-accent enabled:hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-40'
        }
      >
        {justAdded ? <CheckIcon size={18} className="motion-safe:animate-check-in" /> : <PlusIcon size={18} />}
      </button>
      <span role="status" className="sr-only">
        {justAdded ? `${product.name} added to your cart` : ''}
      </span>
    </>
  )
}
