import { Link } from 'react-router'
import { container, primaryButton, textLink } from '../components/ui/styles'

// /order/:number — after an order is placed, this page will show the order
// number with a Copy button and the next steps (Confirmation.dc.html).
// Ordering is not open yet, so no order can exist: we say so honestly
// instead of showing a made-up confirmation.
export default function OrderConfirmation() {
  return (
    <div className={container + ' flex flex-col items-center gap-6 py-24 text-center sm:py-32'}>
      <title>Order: Drakon</title>
      <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">No order to show</h1>
      <p className="max-w-text text-body-lg text-ink-muted">
        Online ordering opens soon. When you place an order, its number and next steps appear here.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Link to="/shop" className={primaryButton}>
          Browse products
        </Link>
        <Link to="/track" className={textLink + ' text-label text-ink-muted'}>
          Track an order
        </Link>
      </div>
    </div>
  )
}
