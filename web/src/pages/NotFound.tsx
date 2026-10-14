import { Link } from 'react-router'
import { container, primaryButton } from '../components/ui/styles'

export default function NotFound() {
  return (
    <div className={container + ' flex flex-col items-center gap-6 py-32 text-center'}>
      <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">Page not found</h1>
      <p className="max-w-text text-body-lg text-ink-muted">This page does not exist, or it has moved.</p>
      <Link to="/" className={primaryButton}>
        Back to the shop
      </Link>
    </div>
  )
}
