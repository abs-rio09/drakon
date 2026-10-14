import type { ReactNode } from 'react'

// The museum-style label: name, a plain line on what it is, a hairline,
// then the price and the stock fact. DRAKON's one memorable element.
// See docs/design/components/GalleryLabel/README.md

type GalleryLabelProps = {
  // Usually the product name inside a link to the product page.
  name: ReactNode
  meta: string
  price: string
  fact: string
  soldOut?: boolean
  // Heading level for the name, so the page outline stays correct.
  as?: 'h2' | 'h3' | 'span'
}

export function GalleryLabel({ name, meta, price, fact, soldOut = false, as: Name = 'h3' }: GalleryLabelProps) {
  return (
    <div className="flex flex-col gap-1">
      <Name
        className={
          'line-clamp-2 min-h-13 text-body font-medium sm:line-clamp-1 sm:min-h-0 sm:text-title ' +
          (soldOut ? 'text-ink-muted' : 'text-ink-strong')
        }
      >
        {name}
      </Name>
      <span className={'text-caption ' + (soldOut ? 'text-ink-subtle' : 'text-ink-muted')}>{meta}</span>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line pt-2">
        <span
          className={
            'text-title whitespace-nowrap tabular-nums sm:text-price ' + (soldOut ? 'text-ink-subtle line-through' : 'text-ink-strong')
          }
        >
          {soldOut && <span className="sr-only">Was </span>}
          {price}
        </span>
        <span className="text-caption whitespace-nowrap text-ink-muted tabular-nums sm:text-figure">{fact}</span>
      </div>
    </div>
  )
}
