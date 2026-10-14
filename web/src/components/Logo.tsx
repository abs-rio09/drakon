// The DRAKON logo: an ember square with a "D", then the wordmark.
// Use it once in the header and once in the footer, nowhere else.
export function LogoContent() {
  return (
    <>
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-accent text-title font-bold text-on-accent"
      >
        D
      </span>
      <span className="text-price font-semibold tracking-[-0.02em] text-ink-strong">Drakon</span>
    </>
  )
}
