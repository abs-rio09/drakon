// Shared Tailwind class strings, so every button and link looks the same.
// Button rules: docs/design/components/Button/README.md

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl text-label transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40'

// One primary button per screen: the thing the page is for.
export const primaryButton =
  buttonBase + ' min-h-11 bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover disabled:hover:bg-accent'

// Large version for the hero and the product page (52px tall, 16px label).
export const primaryButtonLarge =
  buttonBase + ' min-h-13 bg-accent px-8 text-body font-semibold text-on-accent hover:bg-accent-hover disabled:hover:bg-accent'

// The second choice on a screen.
export const secondaryButton =
  buttonBase +
  ' min-h-11 border border-line-strong px-5 text-ink-strong hover:border-ink-subtle hover:bg-field disabled:hover:border-line-strong disabled:hover:bg-transparent'

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
