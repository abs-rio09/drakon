import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { describedBy } from '../components/ui/describedBy'
import { Field, inputClass } from '../components/ui/Field'
import { PageIntro } from '../components/ui/PageIntro'
import { container, inlineLink, panel, secondaryButton } from '../components/ui/styles'
import { isBdMobile } from '../features/checkout/validation'

// /track — look up an order with its number and the phone it was placed with.
// UI only: there is no backend yet, so we never show a made-up result.
// Later this form calls POST /api/orders/track and shows the real timeline.

// Order numbers look like DRK-7K3Q9P (blueprint, part 5).
function isOrderNumber(input: string): boolean {
  return /^DRK-[A-Z0-9]{4,10}$/.test(input.trim().toUpperCase())
}

type Errors = { order?: string; phone?: string }

function validate(order: string, phone: string): Errors {
  const errors: Errors = {}
  if (order.trim() === '') errors.order = 'Enter your order number from the confirmation page.'
  else if (!isOrderNumber(order)) errors.order = 'Order numbers look like DRK-7K3Q9P. Check the number and try again.'
  if (phone.trim() === '') errors.phone = 'Enter the phone number you ordered with.'
  else if (!isBdMobile(phone)) errors.phone = 'Enter an 11-digit mobile number that starts with 01, like 01712345678.'
  return errors
}

export default function Track() {
  const [order, setOrder] = useState('')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState({ order: false, phone: false })
  const [submitted, setSubmitted] = useState(false)
  const [lookedUp, setLookedUp] = useState(false)

  const errors = validate(order, phone)
  const orderError = submitted || touched.order ? errors.order : undefined
  const phoneError = submitted || touched.phone ? errors.phone : undefined

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    if (errors.order) {
      document.getElementById('t-order')?.focus()
      setLookedUp(false)
    } else if (errors.phone) {
      document.getElementById('t-phone')?.focus()
      setLookedUp(false)
    } else {
      setLookedUp(true)
    }
  }

  return (
    <div className={container + ' flex flex-col gap-10 py-16 sm:py-20'}>
      <title>Track your order: Drakon</title>
      <PageIntro title="Track your order">
        <p>Enter the order number from your confirmation and the phone number you ordered with.</p>
      </PageIntro>

      <form
        noValidate
        onSubmit={onSubmit}
        aria-label="Order lookup"
        className="grid max-w-form items-start gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <Field id="t-order" label="Order number" error={orderError}>
          <input
            id="t-order"
            type="text"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value)
              setLookedUp(false)
            }}
            onBlur={() => setTouched((t) => ({ ...t, order: true }))}
            aria-invalid={orderError ? true : undefined}
            aria-describedby={describedBy('t-order', false, orderError)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="DRK-7K3Q9P"
            className={inputClass + ' uppercase tabular-nums placeholder:normal-case'}
          />
        </Field>
        <Field id="t-phone" label="Phone number" error={phoneError}>
          <input
            id="t-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setLookedUp(false)
            }}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={describedBy('t-phone', false, phoneError)}
            placeholder="01XXXXXXXXX"
            className={inputClass + ' tabular-nums'}
          />
        </Field>
        {/* The label row keeps the button level with the inputs on wide screens */}
        <div className="flex flex-col gap-2">
          <span aria-hidden="true" className="hidden text-label sm:block">
            &nbsp;
          </span>
          <button type="submit" className={secondaryButton + ' min-h-12'}>
            Track
          </button>
        </div>
      </form>

      <div role="status" aria-live="polite">
        {lookedUp && (
          <section aria-label="Tracking" className={panel + ' flex max-w-form flex-col gap-3 p-6 sm:p-8'}>
            <h2 className="text-heading-3 text-ink-strong">Tracking opens with ordering</h2>
            <p className="text-body text-ink-muted">
              Online ordering has not opened yet, so there are no orders to look up. When it opens, this page shows
              each step of your order: placed, confirmed by phone, shipped and delivered.
            </p>
            <p className="text-body text-ink-muted">
              Questions? <Link to="/contact" className={inlineLink}>Contact us</Link>.
            </p>
          </section>
        )}
      </div>

      <div className="flex max-w-form flex-col gap-2 border-t border-line pt-8 text-caption text-ink-subtle">
        <p>Your order number is on the confirmation page after you order.</p>
        <p>You will be able to cancel an order here until it ships.</p>
      </div>
    </div>
  )
}
