// Shared Tailwind class strings, so every button and link looks the same.
// Button rules: docs/design/components/Button/README.md

// Buttons are built from three parts: base + variant + size. Each element
// gets exactly ONE size class set. (Adding a second min-h-* or px-* on top
// does not work reliably: when two Tailwind classes set the same property,
// the order in the generated CSS wins, not the order in the string.)
const buttonBase =
  'inline-flex items-center gap-2 rounded-xl transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40'

const buttonVariants = {
  // One primary button per screen: the thing the page is for.
  primary: 'bg-accent font-semibold text-on-accent hover:bg-accent-hover disabled:hover:bg-accent',
  // The second choice on a screen.
  secondary:
    'border border-line-strong font-medium text-ink-strong hover:border-ink-subtle hover:bg-field disabled:hover:border-line-strong disabled:hover:bg-transparent',
}

const buttonSizes = {
  sm: 'min-h-11 px-5 text-label', // 44px, the default
  md: 'min-h-12 px-6 text-body', // 48px, empty states and forms
  lg: 'min-h-13 px-6 text-body', // 52px, panels (Go to checkout)
  hero: 'min-h-13 px-8 text-body', // 52px, the home hero
  xl: 'min-h-14 px-6 text-body', // 56px, Add to cart on the product page
}

type ButtonOptions = {
  // Label on the left, price on the right (Add to cart, ৳2,450).
  spread?: boolean
}

export function button(
  variant: keyof typeof buttonVariants,
  size: keyof typeof buttonSizes = 'sm',
  { spread = false }: ButtonOptions = {},
) {
  return [buttonBase, buttonVariants[variant], buttonSizes[size], spread ? 'justify-between' : 'justify-center'].join(' ')
}

export const primaryButton = button('primary')
export const secondaryButton = button('secondary')

// Text-only action (Cancel, Back, Remove).
export const ghostButton =
  'text-label text-ink-muted underline-offset-4 transition-colors duration-150 ease-out hover:text-ink-strong hover:underline'

// Underlined text link with a steel underline, for links next to content.
export const textLink =
  'underline decoration-line-strong underline-offset-[5px] transition-colors duration-150 ease-out hover:text-ink-strong hover:decoration-ink-strong'

// Orange link, only for links inside a sentence.
export const inlineLink = 'text-accent-text underline underline-offset-4 hover:text-ink-strong'

// Page gutters and max width: 16px on phones, 24px to 1023px, 32px above.
export const container = 'mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8'

// Task panels (summary, checkout steps).
export const panel = 'rounded-3xl border border-line bg-surface-raised shadow-raised'
