import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CashIcon, CheckIcon, ChevronDownIcon, LockIcon } from '../components/icons'
import { describedBy } from '../components/ui/describedBy'
import { Field, FieldError, inputClass, textareaClass } from '../components/ui/Field'
import { button, container, inlineLink, panel, primaryButton, secondaryButton } from '../components/ui/styles'
import { resolveCart, subtotalPaisa, type CartItem } from '../features/cart/cartItems'
import { useCart } from '../features/cart/useCart'
import { zoneFor } from '../features/checkout/deliveryQuote'
import {
  COURIER_NOTE_MAX,
  emptyCheckoutForm,
  GIFT_NOTE_MAX,
  validateCheckout,
  type CheckoutForm,
  type FieldName,
} from '../features/checkout/validation'
import { variantName } from '../lib/catalog'
import { formatTaka } from '../lib/money'
import { dhakaAreas, dhakaDistrict, districts, type DeliveryZone } from '../mocks/delivery'
import { settings } from '../mocks/settings'

// /checkout — the form and the order summary, from Checkout.dc.html.
// IMPORTANT: there is no backend yet, so this page never places an order.
// "Place order" stays disabled until the Go API (POST /api/orders) exists.

// Field order on the page, used to move focus to the first problem.
const FIELD_ORDER: FieldName[] = [
  'name',
  'phone',
  'email',
  'district',
  'dhakaArea',
  'area',
  'address',
  'courierNote',
  'giftName',
  'giftPhone',
  'giftNote',
]

const fieldId = (name: FieldName) => `co-${name}`

// The fields that hold text (not the true/false checkboxes).
type TextFieldName = { [K in FieldName]: CheckoutForm[K] extends string ? K : never }[FieldName]

export default function Checkout() {
  const cart = useCart()
  const { items } = resolveCart(cart.lines)

  if (items.length === 0) {
    return (
      <div className={container + ' flex flex-col items-center gap-6 py-24 text-center'}>
        <title>Checkout: Drakon</title>
        <h1 className="text-heading-2 text-ink-strong">Your cart is empty</h1>
        <p className="max-w-text text-body text-ink-muted">Add something to your cart first, then come back here.</p>
        <Link to="/shop" className={primaryButton}>
          Browse products
        </Link>
      </div>
    )
  }

  return <CheckoutView items={items} />
}

function CheckoutView({ items }: { items: CartItem[] }) {
  const [form, setForm] = useState<CheckoutForm>(emptyCheckoutForm)
  // Fields the buyer has left at least once. We only show errors for these,
  // so nobody sees red messages before they have even started typing.
  const [touched, setTouched] = useState<Set<FieldName>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const errors = validateCheckout(form)
  const errorFor = (name: FieldName) => (submitted || touched.has(name) ? errors[name] : undefined)
  const isComplete = Object.keys(errors).length === 0

  const subtotal = subtotalPaisa(items)
  const zone = zoneFor(form.district, form.dhakaArea)
  const total = subtotal + (zone?.chargePaisa ?? 0)
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  // One function updates any field: update('name', 'Nusrat')
  function update<K extends FieldName>(name: K, value: CheckoutForm[K]) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function touch(name: FieldName) {
    setTouched((prev) => new Set(prev).add(name))
  }

  // Props every text input needs: value, change, leave (blur) and the a11y links.
  function textProps(name: TextFieldName, hint?: unknown) {
    const error = errorFor(name)
    return {
      id: fieldId(name),
      name,
      value: form[name],
      onChange: (e: { target: { value: string } }) => update(name, e.target.value),
      onBlur: () => touch(name),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy(fieldId(name), hint, error),
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    const first = FIELD_ORDER.find((name) => errors[name])
    if (first) {
      // For the Dhaka choice, focus the first radio button.
      const el =
        first === 'dhakaArea'
          ? document.querySelector<HTMLInputElement>('input[name="dhakaArea"]')
          : document.getElementById(fieldId(first))
      el?.focus()
    }
  }

  const isDhaka = form.district === dhakaDistrict

  return (
    <div className={container + ' flex flex-col gap-10 pt-14 pb-0 lg:pb-32'}>
      <title>Checkout: Drakon</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">Checkout</h1>
        <p className="text-body-lg text-ink-muted">No account needed. Pay in cash when your order arrives.</p>
      </div>

      {/* Phones and tablets: the total first, details at the end */}
      <a
        href="#summary"
        className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-raised px-5 py-4 lg:hidden"
      >
        <span className="flex items-center gap-3">
          <span className="flex" aria-hidden="true">
            {items.slice(0, 2).map(({ product, variant }, i) => (
              <img
                key={variant.id}
                src={product.images[variant.imageIndex ?? 0]?.thumb ?? product.images[0].thumb}
                alt=""
                className={
                  'size-10 rounded-lg border-2 border-surface-raised bg-field object-cover' + (i > 0 ? ' -ml-3' : '')
                }
              />
            ))}
          </span>
          <span className="flex flex-col">
          <span className="text-body font-medium text-ink-strong">Your order</span>
          <span className="text-caption text-ink-muted tabular-nums">
            {count === 1 ? '1 item' : `${count} items`}, see details
          </span>
          </span>
        </span>
        <span className="text-price text-ink-strong tabular-nums">{formatTaka(total)}</span>
      </a>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <form noValidate onSubmit={onSubmit} aria-label="Checkout details" className={panel + ' px-6 py-2 sm:px-10'}>
          {/* 1 Contact */}
          <FormSection number={1} title="Contact" id="s-contact">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field id={fieldId('name')} label="Full name" required error={errorFor('name')}>
                <input
                  {...textProps('name')}
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your full name"
                  className={inputClass}
                />
              </Field>
              <Field
                id={fieldId('phone')}
                label="Phone number"
                required
                hint="We call this number to confirm your order before shipping."
                error={errorFor('phone')}
              >
                <input
                  {...textProps('phone', true)}
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  className={inputClass + ' tabular-nums'}
                />
              </Field>
            </div>
            <Field
              id={fieldId('email')}
              label="Email"
              optional
              hint="Add your email to get order updates."
              error={errorFor('email')}
            >
              <input
                {...textProps('email', true)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>
          </FormSection>

          {/* 2 Delivery: district, then (Dhaka only) city or outside, then area */}
          <FormSection number={2} title="Delivery" id="s-delivery">
            <Field
              id={fieldId('district')}
              label="District"
              required
              hint={<DeliveryStatus district={form.district} zone={zone} />}
              error={errorFor('district')}
            >
              <div className="relative">
                <select
                  {...textProps('district', true)}
                  onChange={(e) => {
                    // Keep the Dhaka choice: if the buyer switches away and back,
                    // their answer and the charge come back instead of a blank.
                    update('district', e.target.value)
                    touch('district')
                  }}
                  required
                  autoComplete="address-level1"
                  className={inputClass + ' appearance-none pr-12'}
                >
                  <option value="">Select your district</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted" />
              </div>
            </Field>

            {/* Always in the page, so it can slide open instead of popping in.
                While closed it is inert: no focus, hidden from screen readers.
                The 4px padding (p-1, cancelled by -mx-1 / -my-1) keeps the
                focus ring from being cut off by overflow-hidden. */}
            <div
              className={
                '-mx-1 grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ' +
                (isDhaka ? '-my-1 grid-rows-[1fr] opacity-100' : '-mt-6 mb-0 grid-rows-[0fr] opacity-0')
              }
              inert={!isDhaka}
            >
              <div className="min-h-0 overflow-hidden">
                <fieldset
                  className="flex flex-col gap-3 p-1"
                  aria-describedby={errorFor('dhakaArea') ? `${fieldId('dhakaArea')}-error` : undefined}
                >
                  <legend className="mb-3 text-label text-ink-muted">
                    Where in Dhaka district?
                    <span aria-hidden="true" className="ml-1 text-accent-text">
                      *
                    </span>
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {dhakaAreas.map((a) => {
                      const z = zoneFor(dhakaDistrict, a.id)
                      return (
                        <ChoiceCard key={a.id} checked={form.dhakaArea === a.id}>
                          <input
                            type="radio"
                            name="dhakaArea"
                            value={a.id}
                            checked={form.dhakaArea === a.id}
                            onChange={() => {
                              update('dhakaArea', a.id)
                              touch('dhakaArea')
                            }}
                            className="mt-0.5 size-4.5 shrink-0 accent-ink-strong"
                          />
                          <span className="flex flex-col">
                            <span className="text-body font-medium text-ink-strong">{a.label}</span>
                            <span className="text-caption text-ink-subtle tabular-nums">
                              {a.hint}, {z ? formatTaka(z.chargePaisa) : ''}
                            </span>
                          </span>
                        </ChoiceCard>
                      )
                    })}
                  </div>
                  {errorFor('dhakaArea') && (
                    <FieldError id={`${fieldId('dhakaArea')}-error`}>{errorFor('dhakaArea')}</FieldError>
                  )}
                </fieldset>
              </div>
            </div>

            <Field id={fieldId('area')} label="Area / Thana" required error={errorFor('area')}>
              <input
                {...textProps('area')}
                type="text"
                required
                autoComplete="address-level2"
                placeholder="e.g. Mirpur 10"
                className={inputClass}
              />
            </Field>

            <Field id={fieldId('address')} label="Full address" required error={errorFor('address')}>
              <textarea
                {...textProps('address')}
                required
                rows={3}
                autoComplete="street-address"
                placeholder="House, road, block, landmark"
                className={textareaClass + ' min-h-26'}
              />
            </Field>

            <Field
              id={fieldId('courierNote')}
              label="Note for the courier"
              optional
              error={errorFor('courierNote')}
            >
              <input
                {...textProps('courierNote')}
                type="text"
                maxLength={COURIER_NOTE_MAX}
                placeholder="e.g. Call before coming"
                className={inputClass}
              />
            </Field>

            {/* Gift */}
            <div className="flex flex-col gap-6 border-t border-line pt-6">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.isGift}
                  onChange={(e) => update('isGift', e.target.checked)}
                  aria-controls="gift-box"
                  aria-expanded={form.isGift}
                  className="mt-0.5 size-5 shrink-0 accent-ink-strong"
                />
                <span className="flex flex-col">
                  <span className="text-body font-medium text-ink-strong">This is a gift</span>
                  <span className="text-caption text-ink-muted">Send it to someone else, with a note in the box.</span>
                </span>
              </label>

              {form.isGift && (
                <div id="gift-box" className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field id={fieldId('giftName')} label="Receiver's name" required error={errorFor('giftName')}>
                      <input
                        {...textProps('giftName')}
                        type="text"
                        required
                        placeholder="Who gets the gift"
                        className={inputClass}
                      />
                    </Field>
                    <Field
                      id={fieldId('giftPhone')}
                      label="Receiver's phone"
                      required
                      hint="The courier calls this number. We still call you to confirm the order."
                      error={errorFor('giftPhone')}
                    >
                      <input
                        {...textProps('giftPhone', true)}
                        type="tel"
                        required
                        inputMode="tel"
                        placeholder="01XXXXXXXXX"
                        className={inputClass + ' tabular-nums'}
                      />
                    </Field>
                  </div>
                  <Field
                    id={fieldId('giftNote')}
                    label="Gift note"
                    optional
                    hint={
                      <span className="tabular-nums">
                        {form.giftNote.length} of {GIFT_NOTE_MAX} characters. We print it on a card inside the box.
                      </span>
                    }
                    error={errorFor('giftNote')}
                  >
                    <textarea
                      {...textProps('giftNote', true)}
                      rows={3}
                      maxLength={GIFT_NOTE_MAX}
                      placeholder="Happy birthday. Stay up late, build great things."
                      className={textareaClass + ' min-h-24'}
                    />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.hidePrices}
                      onChange={(e) => update('hidePrices', e.target.checked)}
                      className="size-4 shrink-0 accent-ink-strong"
                    />
                    <span className="text-label font-normal text-ink">Leave prices off the packing slip</span>
                  </label>
                  <p role="note" className="flex items-start gap-3 border-t border-line pt-4 text-label font-normal text-ink">
                    <CashIcon size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                    <span>
                    Cash on Delivery: the person who receives the parcel pays the courier{' '}
                    <span className="text-ink-strong tabular-nums">{formatTaka(total)}</span>. Let them know before it
                    arrives.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </FormSection>

          {/* 3 Payment */}
          <FormSection number={3} title="Payment" id="s-payment">
            <ChoiceCard checked>
              <input
                type="radio"
                name="payment"
                value="cod"
                checked
                readOnly
                className="mt-0.5 size-4.5 shrink-0 accent-ink-strong"
              />
              <span className="flex flex-col">
                <span className="text-body font-medium text-ink-strong">Cash on Delivery</span>
                <span className="text-caption text-ink-subtle">Pay the courier in cash when your order arrives.</span>
              </span>
            </ChoiceCard>
          </FormSection>

          {/* Lets the buyer check the form while ordering is still closed */}
          <div className="flex flex-col gap-4 border-t border-line py-8">
            <button type="submit" className={secondaryButton + ' self-start'}>
              Check my details
            </button>
            <div role="status" aria-live="polite">
              {submitted &&
                (isComplete ? (
                  <p className="flex items-start gap-2 text-label font-normal text-ink">
                    <CheckIcon size={16} className="mt-0.5 shrink-0 text-ink-strong" />
                    Your details look complete. Ordering opens soon, so nothing has been ordered yet.
                  </p>
                ) : (
                  <p className="text-label font-normal text-danger-text">
                    Some details need fixing. The first one is selected for you.
                  </p>
                ))}
            </div>
          </div>
        </form>

        <OrderSummary
          items={items}
          subtotal={subtotal}
          total={total}
          zoneLabel={zone?.label ?? (isDhaka ? 'Choose Dhaka city or outside' : 'Choose your district')}
          deliveryPaisa={zone?.chargePaisa}
          isGift={form.isGift}
        />
      </div>

      {/* Phones and tablets: the total and the one action stay in reach */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface-raised px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-caption text-ink-muted">{zone ? 'Pay on delivery' : 'Delivery not added yet'}</span>
            <span className="text-price text-ink-strong tabular-nums">{formatTaka(total)}</span>
          </span>
          <PlaceOrderButton />
        </div>
      </div>
    </div>
  )
}

// The delivery charge, shown right under the district so the buyer sees it
// change as they choose. Screen readers hear the new charge too (aria-live).
function DeliveryStatus({ district, zone }: { district: string; zone: DeliveryZone | undefined }) {
  // Keep every message to one line on a 375px phone, so the form below
  // does not jump when the message changes.
  let text = 'Pick a district to see the delivery charge.'
  if (zone) text = `Delivery charge: ${formatTaka(zone.chargePaisa)}, ${zone.label}.`
  else if (district === dhakaDistrict) text = 'Pick Dhaka city or outside to see the charge.'
  return (
    <span aria-live="polite" className="tabular-nums">
      {text}
    </span>
  )
}

function FormSection({ number, title, id, children }: { number: number; title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-line py-8 not-first:border-t">
      <h2 id={id} className="flex items-center gap-4 text-heading-3 text-ink-strong">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full border border-line-strong text-caption font-medium text-ink"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// A bordered card around a radio button. Selected: bone edge and field fill.
function ChoiceCard({ checked, children }: { checked: boolean; children: ReactNode }) {
  return (
    <label
      className={
        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150 ease-out has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ' +
        (checked ? 'border-ink-strong bg-field' : 'border-line-strong hover:border-ink-muted')
      }
    >
      {children}
    </label>
  )
}

// There is no backend yet, so ordering is switched off. No fake orders.
function PlaceOrderButton({ block = false }: { block?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-describedby="ordering-soon"
      className={button('primary', 'lg') + (block ? ' w-full' : '')}
    >
      <LockIcon size={16} />
      Ordering opens soon
    </button>
  )
}

type OrderSummaryProps = {
  items: CartItem[]
  subtotal: number
  total: number
  zoneLabel: string
  deliveryPaisa?: number
  isGift: boolean
}

function OrderSummary({ items, subtotal, total, zoneLabel, deliveryPaisa, isGift }: OrderSummaryProps) {
  return (
    <aside
      id="summary"
      aria-label="Order summary"
      className={panel + ' flex scroll-mt-24 flex-col gap-5 p-6 sm:p-8 lg:sticky lg:top-8'}
    >
      <h2 className="text-heading-3 text-ink-strong">Your order</h2>
      <ul className="flex flex-col gap-4">
        {items.map(({ product, variant, qty, linePaisa }) => (
          <li key={variant.id} className="flex items-center gap-4">
            <img
              src={product.images[variant.imageIndex ?? 0]?.thumb ?? product.images[0].thumb}
              alt=""
              className="size-16 shrink-0 rounded-lg bg-field object-cover"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink-strong">{product.name}</span>
              <span className="text-caption text-ink-muted tabular-nums">
                {variantName(product, variant)}, qty {qty}
              </span>
            </span>
            <span className="text-body font-medium text-ink-strong tabular-nums">{formatTaka(linePaisa)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex justify-between gap-4">
          <dt className="text-body text-ink-muted">Subtotal</dt>
          <dd className="text-body font-medium text-ink-strong tabular-nums">{formatTaka(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="flex flex-col">
            <span className="text-body text-ink-muted">Delivery</span>
            <span className="text-caption text-ink-subtle">{zoneLabel}</span>
          </dt>
          <dd className="text-body text-ink-strong tabular-nums">
            {deliveryPaisa !== undefined ? formatTaka(deliveryPaisa) : <span aria-label="not set yet">—</span>}
          </dd>
        </div>
      </dl>

      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-6">
        <span className="flex flex-col">
          <span className="text-body font-medium text-ink-strong">Pay on delivery</span>
          {deliveryPaisa === undefined && <span className="text-caption text-ink-subtle">Delivery not added yet</span>}
        </span>
        <span className="text-price-lg text-ink-strong tabular-nums">{formatTaka(total)}</span>
      </div>

      {isGift && (
        <p className="text-caption text-ink-muted">
          This is a gift. The receiver pays the courier in cash when it arrives.
        </p>
      )}

      <div className="hidden flex-col gap-3 lg:flex">
        <PlaceOrderButton block />
      </div>
      <p id="ordering-soon" className="text-label font-normal text-ink">
        Ordering opens soon. You can fill in your details now, but no order is placed yet.
      </p>

      <div className="flex flex-col gap-3 border-t border-line pt-6 text-caption text-ink-subtle">
        <p>
          We call you within {settings.codConfirmHours} hours to confirm. Orders we cannot confirm are cancelled
          automatically.
        </p>
        <p>
          The final total is checked by our server when you order. By ordering you agree to our{' '}
          <Link to="/policies/terms" className={inlineLink}>
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/policies/returns" className={inlineLink}>
            Return policy
          </Link>
          .
        </p>
      </div>
    </aside>
  )
}
