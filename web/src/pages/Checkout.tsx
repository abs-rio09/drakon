import { startTransition, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { CashIcon } from '../components/icons'
import { Combobox } from '../components/ui/Combobox'
import { describedBy } from '../components/ui/describedBy'
import { Field, FieldError, inputClass, textareaClass } from '../components/ui/Field'
import { LoadError, Loading } from '../components/ui/LoadState'
import { PageMeta } from '../components/ui/PageMeta'
import { container, panel, primaryButton } from '../components/ui/styles'
import { splitItems, useCartQuote } from '../features/cart/cartItems'
import { useCart } from '../features/cart/useCart'
import {
  areaAfterDistrictChange,
  areaSuggestions,
  emptyCheckoutForm,
  findDistrict,
  isBdMobile,
  needsAreaChoice,
  normalizePhone,
  selectedArea,
  validateCheckout,
  type CheckoutForm,
  type FieldName,
} from '../features/checkout/validation'
import { districtAliases } from '../features/checkout/districtAliases'
import { rememberOrder } from '../features/orders/recentOrders'
import { useSite } from '../features/site/SiteContext'
import { ApiError, placeOrder } from '../lib/api'
import { getZone } from '../lib/delivery'
import { formatTaka } from '../lib/money'
import type { OrderView, Quote, QuoteItem } from '../lib/types'
import { clearApiCache } from '../lib/useApi'
import { ChoiceCard, DeliveryStatus, FORM_ID, FormSection, OrderSummary, PlaceOrderButton } from './checkout/CheckoutParts'

// /checkout — the form and the order summary, from Checkout.dc.html.
// "Place order" sends the form to POST /api/orders. The server checks
// everything again and decides every price; this page only shows them.

// What the confirmation page may show right after ordering. Kept only in
// memory (router state), never saved in the browser.
export type JustPlacedState = {
  justPlaced: true
  order: OrderView
  deliverTo: { name: string; phone: string; address: string }
}

// Field order on the page, used to move focus to the first problem.
const FIELD_ORDER: FieldName[] = [
  'name',
  'phone',
  'email',
  'district',
  'districtArea',
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
  const [form, setForm] = useState<CheckoutForm>(emptyCheckoutForm)
  const { delivery } = useSite()
  const area = selectedArea(delivery, form)
  // The server prices the cart and the delivery for the chosen area.
  const priced = useCartQuote(area?.id)
  const quote = priced.status === 'empty' ? undefined : priced.quote

  if (priced.status === 'error' && !quote) {
    return (
      <div className={container}>
        <PageMeta title="Checkout: Drakon" noindex />
        <LoadError error={priced.error} onRetry={priced.retry} />
      </div>
    )
  }
  if (priced.status === 'loading' && !quote) {
    return (
      <div className={container}>
        <PageMeta title="Checkout: Drakon" noindex />
        <Loading label="Checking prices and stock" />
      </div>
    )
  }

  const items = quote ? splitItems(quote).items : []
  if (!quote || items.length === 0) {
    return (
      <div className={container + ' flex flex-col items-center gap-6 py-24 text-center'}>
        <PageMeta title="Checkout: Drakon" noindex />
        <h1 className="text-heading-2 text-ink-strong">Your cart is empty</h1>
        <p className="max-w-text text-body text-ink-muted">Add something to your cart first, then come back here.</p>
        <Link to="/shop" className={primaryButton}>
          Browse products
        </Link>
      </div>
    )
  }

  // The shown quote may be for the previous area while the new one loads.
  const quoteIsCurrent = priced.status === 'ready' && (quote.delivery?.areaId ?? undefined) === area?.id
  return (
    <CheckoutView
      form={form}
      setForm={setForm}
      quote={quote}
      items={items}
      quoteIsCurrent={quoteIsCurrent}
      refreshQuote={priced.refresh}
    />
  )
}

type CheckoutViewProps = {
  form: CheckoutForm
  setForm: React.Dispatch<React.SetStateAction<CheckoutForm>>
  quote: Quote
  items: QuoteItem[]
  quoteIsCurrent: boolean
  refreshQuote: () => void
}

function CheckoutView({ form, setForm, quote, items, quoteIsCurrent, refreshQuote }: CheckoutViewProps) {
  const { settings, delivery } = useSite()
  const cart = useCart()
  const navigate = useNavigate()
  const [placing, setPlacing] = useState(false)
  // Problems the server found that the browser could not know about
  // (sold out a moment ago, purchase limit with earlier orders, blocked phone).
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverFields, setServerFields] = useState<Partial<Record<FieldName, string>>>({})
  // Fields the buyer has left at least once. We only show errors for these,
  // so nobody sees red messages before they have even started typing.
  const [touched, setTouched] = useState<Set<FieldName>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const errors = validateCheckout(form, delivery, settings)
  const errorFor = (name: FieldName) =>
    (submitted || touched.has(name) ? errors[name] : undefined) ?? serverFields[name]

  // Every amount comes from the server's quote.
  const subtotal = quote.subtotalPaisa
  const quoteDelivery = quoteIsCurrent ? quote.delivery : null
  const zoneName = quoteDelivery ? (getZone(delivery, quoteDelivery.zoneCode)?.name ?? quoteDelivery.zoneCode) : undefined
  const total = quoteDelivery && quote.totalPaisa !== null ? quote.totalPaisa : subtotal
  const count = items.reduce((sum, i) => sum + i.qty, 0)
  const problems = quote.problems.filter((p) => p.code !== 'UNKNOWN_VARIANT')

  // One function updates any field: update('name', 'Nusrat')
  function update<K extends FieldName>(name: K, value: CheckoutForm[K]) {
    setForm((prev) => ({ ...prev, [name]: value }))
    // The buyer is fixing it: drop the server's old message for this field.
    setServerFields((prev) => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function touch(name: FieldName) {
    setTouched((prev) => new Set(prev).add(name))
  }

  // On leaving a phone field, show a valid number in its clean form:
  // autofill's "(171) 234-5678" becomes "01712345678". A wrong number is
  // left as typed so the buyer can fix it.
  function cleanPhone(name: 'phone' | 'giftPhone') {
    setForm((prev) => {
      const clean = normalizePhone(prev[name])
      return isBdMobile(clean) && clean !== prev[name] ? { ...prev, [name]: clean } : prev
    })
  }

  // Props every text input needs: value, change, leave (blur) and the a11y links.
  function textProps(name: TextFieldName, hint?: unknown) {
    const error = errorFor(name)
    return {
      id: fieldId(name),
      name,
      value: form[name],
      onChange: (e: { target: { value: string } }) => update(name, e.target.value),
      onBlur: () => {
        touch(name)
        if (name === 'phone' || name === 'giftPhone') cleanPhone(name)
      },
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy(fieldId(name), hint, error),
    }
  }

  const area = selectedArea(delivery, form)
  const canOrder = problems.length === 0 && quoteIsCurrent && !placing

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (placing) return // a second tap while the first order is being sent
    setSubmitted(true)
    setServerError(null)
    const first = FIELD_ORDER.find((name) => errors[name])
    if (!first && area && canOrder) {
      setPlacing(true)
      try {
        const placed = await placeOrder({
          items: cart.lines,
          deliveryAreaId: area.id,
          name: form.name,
          phone: form.phone,
          email: form.email,
          area: form.area,
          address: form.address,
          courierNote: form.courierNote,
          isGift: form.isGift,
          giftName: form.giftName,
          giftPhone: form.giftPhone,
          giftNote: form.giftNote,
          hidePrices: form.hidePrices,
        })
        rememberOrder({ orderNumber: placed.orderNumber, token: placed.trackToken, placedAt: placed.order.placedAt })
        clearApiCache() // stock changed; pages load fresh numbers
        const state: JustPlacedState = {
          justPlaced: true,
          order: placed.order,
          deliverTo: {
            name: form.isGift ? form.giftName : form.name,
            phone: form.phone,
            address: [form.address, form.area, form.district].filter(Boolean).join(', '),
          },
        }
        // One transition for both: the router changes pages in a transition,
        // so emptying the cart on its own would first show "Your cart is
        // empty" here for a moment.
        startTransition(() => {
          cart.clear()
          navigate(`/order/${placed.orderNumber}`, { state, replace: true })
        })
      } catch (err) {
        setPlacing(false)
        if (err instanceof ApiError && err.code === 'VALIDATION') {
          setServerFields(err.fields as Partial<Record<FieldName, string>>)
          setServerError('Some details need fixing.')
        } else if (err instanceof ApiError) {
          setServerError(err.message)
          // Stock or limits changed: show the fresh state of the cart.
          if (err.status === 409) refreshQuote()
        } else {
          setServerError('Something went wrong. Please try again.')
        }
      }
      return
    }
    if (first) {
      // For the district area choice, focus the first radio button.
      const el =
        first === 'districtArea'
          ? document.querySelector<HTMLInputElement>('input[name="districtArea"]')
          : document.getElementById(fieldId(first))
      el?.focus()
    }
  }

  const district = findDistrict(delivery, form.district)
  const hasChoice = needsAreaChoice(district)
  const districtOptions = delivery.districts.map((d) => ({ value: d.name, label: d.name, aliases: districtAliases[d.name] }))
  const choiceAreas = hasChoice && district ? district.areas : []

  return (
    <div className={container + ' flex flex-col gap-10 pt-14 pb-0 lg:pb-32'}>
      <PageMeta title="Checkout: Drakon" noindex />
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
            {items.slice(0, 2).map((item, i) => (
              <img
                key={item.variantId}
                src={item.thumb}
                alt=""
                width={240}
                height={240}
                decoding="async"
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
        <form
          id={FORM_ID}
          noValidate
          onSubmit={onSubmit}
          aria-label="Checkout details"
          aria-busy={placing}
          className={panel + ' px-6 py-2 sm:px-10'}
        >
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
                  autoComplete="tel-national"
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
              hint={
                <DeliveryStatus
                  district={form.district}
                  hasChoice={hasChoice}
                  chargePaisa={quoteDelivery?.chargePaisa}
                  zoneName={zoneName}
                  free={quoteDelivery?.freeDelivery ?? false}
                />
              }
              error={errorFor('district')}
            >
              <Combobox
                id={fieldId('district')}
                name="district"
                listLabel="Districts"
                value={form.district}
                options={districtOptions}
                // Keep the Dhaka choice: if the buyer switches away and back,
                // their answer and the charge come back instead of a blank.
                onChange={(name) => {
                  update('area', areaAfterDistrictChange(delivery, form, name))
                  update('district', name)
                }}
                onBlur={() => touch('district')}
                placeholder="Search your district"
                noMatchText="No district matches"
                required
                aria-invalid={errorFor('district') ? true : undefined}
                aria-describedby={describedBy(fieldId('district'), true, errorFor('district'))}
              />
            </Field>

            {/* Always in the page, so it can slide open instead of popping in.
                While closed it is inert: no focus, hidden from screen readers.
                The 4px padding (p-1, cancelled by -mx-1 / -my-1) keeps the
                focus ring from being cut off by overflow-hidden. */}
            <div
              className={
                '-mx-1 grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ' +
                (hasChoice ? '-my-1 grid-rows-[1fr] opacity-100' : '-mt-6 mb-0 grid-rows-[0fr] opacity-0')
              }
              inert={!hasChoice}
            >
              <div className="min-h-0 overflow-hidden">
                <fieldset
                  className="flex flex-col gap-3 p-1"
                  aria-describedby={errorFor('districtArea') ? `${fieldId('districtArea')}-error` : undefined}
                >
                  <legend className="mb-3 text-label text-ink-muted">
                    Where in {district?.name ?? 'the'} district?
                    <span aria-hidden="true" className="ml-1 text-accent-text">
                      *
                    </span>
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {choiceAreas.map((a) => {
                      const z = getZone(delivery, a.zoneCode)
                      const id = String(a.id)
                      return (
                        <ChoiceCard key={a.id} checked={form.districtArea === id}>
                          <input
                            type="radio"
                            name="districtArea"
                            value={id}
                            checked={form.districtArea === id}
                            onChange={() => {
                              update('districtArea', id)
                              touch('districtArea')
                            }}
                            className="mt-0.5 size-4.5 shrink-0 accent-ink-strong"
                          />
                          <span className="flex flex-col">
                            <span className="text-body font-medium text-ink-strong">{a.label}</span>
                            <span className="text-caption text-ink-subtle tabular-nums">
                              {[a.hint, z ? formatTaka(z.chargePaisa) : ''].filter(Boolean).join(', ')}
                            </span>
                          </span>
                        </ChoiceCard>
                      )
                    })}
                  </div>
                  {errorFor('districtArea') && (
                    <FieldError id={`${fieldId('districtArea')}-error`}>{errorFor('districtArea')}</FieldError>
                  )}
                </fieldset>
              </div>
            </div>

            <Field
              id={fieldId('area')}
              label="Area / Thana"
              required
              hint={district ? undefined : 'Choose your district first'}
              error={errorFor('area')}
            >
              {/* Free text; the list only suggests the chosen district's thanas. */}
              <Combobox
                id={fieldId('area')}
                name="area"
                listLabel={`Areas in ${district?.name ?? 'your district'}`}
                value={form.area}
                options={areaSuggestions(delivery, form).map((n) => ({ value: n, label: n }))}
                onChange={(text) => update('area', text)}
                onBlur={() => touch('area')}
                freeText
                disabled={!district}
                placeholder="e.g. Mirpur 10"
                required
                aria-invalid={errorFor('area') ? true : undefined}
                aria-describedby={describedBy(fieldId('area'), !district, errorFor('area'))}
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
                maxLength={settings.courierNoteMaxChars}
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
                        {[...form.giftNote].length} of {settings.giftNoteMaxChars} characters. We print it on a card inside the box.
                      </span>
                    }
                    error={errorFor('giftNote')}
                  >
                    <textarea
                      {...textProps('giftNote', true)}
                      rows={3}
                      maxLength={settings.giftNoteMaxChars}
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

          {/* Messages after "Place order" */}
          <div role="status" aria-live="polite" className="empty:hidden border-t border-line py-6">
            {serverError ? (
              <p className="text-label font-normal text-danger-text">{serverError}</p>
            ) : (
              submitted &&
              FIELD_ORDER.some((name) => errors[name]) && (
                <p className="text-label font-normal text-danger-text">
                  Some details need fixing. The first one is selected for you.
                </p>
              )
            )}
          </div>
        </form>

        <OrderSummary
          items={items}
          problems={problems}
          subtotal={subtotal}
          total={total}
          zoneLabel={zoneName ?? (hasChoice ? `Choose where in ${form.district}` : 'Choose your district')}
          deliveryPaisa={quoteDelivery?.chargePaisa}
          isGift={form.isGift}
          codConfirmHours={settings.codConfirmHours}
          canOrder={canOrder}
          placing={placing}
        />
      </div>

      {/* Phones and tablets: the total and the one action stay in reach */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface-raised px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-caption text-ink-muted">{quoteDelivery ? 'Pay on delivery' : 'Delivery not added yet'}</span>
            <span className="text-price text-ink-strong tabular-nums">{formatTaka(total)}</span>
          </span>
          <PlaceOrderButton disabled={!canOrder} placing={placing} />
        </div>
      </div>
    </div>
  )
}
