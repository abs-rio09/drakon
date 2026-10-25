import type { ReactNode } from 'react'
import { useSite } from '../../features/site/SiteContext'
import { variantStockFact } from '../../lib/catalog'
import { formatTaka } from '../../lib/money'
import type { Product, Variant } from '../../lib/types'

type VariantPickerProps = {
  product: Product
  selectedId: number
  onSelect: (variant: Variant) => void
  // Shown on the right of the legend row, for example a "Size guide" link.
  aside?: ReactNode
}

// Choose a size, material or other variant. Built from real radio buttons
// (hidden, but still there), so arrow keys and screen readers work for free.
// Sold out variants stay visible but cannot be picked.
export function VariantPicker({ product, selectedId, onSelect, aside }: VariantPickerProps) {
  const { settings } = useSite()
  const selected = product.variants.find((v) => v.id === selectedId)
  // Rich rows (photo, note, price) when variants differ; small chips for sizes.
  const rich = product.variants.some((v) => v.note)
  const groupName = `variant-${product.id}`

  // The legend floats left and the aside floats right, so both share one row.
  return (
    <fieldset className="min-w-0">
      <legend className="float-left mb-4 text-label text-ink-muted">
        {product.variantKind} <span className="text-ink-strong">{selected?.label}</span>
      </legend>
      {aside && <div className="float-right">{aside}</div>}

      <div className={'clear-both ' + (rich ? 'flex flex-col gap-2' : 'flex flex-wrap gap-3')}>
        {product.variants.map((v) => {
          const soldOut = v.stock === 0
          const checked = v.id === selectedId
          const thumb = v.imageIndex !== null ? product.images[v.imageIndex]?.thumb : undefined
          return (
            <label
              key={v.id}
              className={
                'relative flex items-center rounded-xl border transition-colors duration-150 ease-out has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ' +
                (rich ? 'min-h-16 w-full gap-4 px-4 py-2 ' : 'h-12 min-w-15 justify-center px-4 ') +
                (soldOut
                  ? 'cursor-not-allowed border-dashed border-line text-ink-subtle'
                  : checked
                    ? 'cursor-pointer border-ink-strong bg-field text-ink-strong'
                    : 'cursor-pointer border-line-strong text-ink hover:border-ink-muted')
              }
            >
              <input
                type="radio"
                name={groupName}
                value={v.id}
                checked={checked}
                disabled={soldOut}
                onChange={() => onSelect(v)}
                aria-label={soldOut ? `${v.label}, sold out` : undefined}
                className="sr-only"
              />
              {/* Thin diagonal line through a sold-out size (not a struck letter) */}
              {soldOut && !rich && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-xl bg-strike opacity-50"
                />
              )}

              {rich ? (
                <>
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      width={240}
                      height={240}
                      decoding="async"
                      className={'size-11 shrink-0 rounded-lg object-cover ' + (soldOut ? 'opacity-60 grayscale' : '')}
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={'text-body font-medium ' + (soldOut ? 'text-ink-subtle' : 'text-ink-strong')}>
                      {v.label}
                    </span>
                    <span className="text-caption text-ink-subtle">{v.note}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span
                      className={
                        'text-body font-medium tabular-nums ' + (soldOut ? 'text-ink-subtle line-through' : 'text-ink-strong')
                      }
                    >
                      {formatTaka(v.pricePaisa)}
                    </span>
                    <span className="text-caption text-ink-muted tabular-nums">{variantStockFact(product, v, settings)}</span>
                  </span>
                </>
              ) : (
                <span className="text-body font-medium">{v.label}</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
