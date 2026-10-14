// Step 1b test page: checks that the design tokens and fonts load.
function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-page flex-col items-start justify-center gap-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-heading-1 text-ink-strong">DRAKON</h1>
      <p className="max-w-text text-body-lg text-ink-muted">
        Design tokens test page. If this page is dark and the price shows the
        Taka sign, Tailwind and the fonts are working.
      </p>
      <p className="text-price-lg text-ink-strong tabular-nums">৳1,250</p>
      <button
        type="button"
        className="rounded-xl bg-accent px-5 py-3 text-label text-on-accent transition-colors duration-150 ease-out hover:bg-accent-hover"
      >
        Add to cart
      </button>
    </main>
  )
}

export default App
