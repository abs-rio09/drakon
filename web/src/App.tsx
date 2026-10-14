import { SiteFooter } from './components/layout/SiteFooter'
import { SiteHeader } from './components/layout/SiteHeader'

// Step 1c test page: shows the header and footer around an empty main area.
function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader cartCount={2} current="/shop" />
      <main className="mx-auto w-full max-w-page flex-1 px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">Header and footer test</h1>
        <p className="mt-4 max-w-text text-body-lg text-ink-muted">
          Make the window narrower than 768px to see the phone menu button.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
