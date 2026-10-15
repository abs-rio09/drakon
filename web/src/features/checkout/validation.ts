// Checks the checkout form in the browser so the buyer gets quick, friendly
// messages. The Go server checks everything again with the same rules
// (api/internal/orders/validate.go): the browser can be changed by anyone,
// so it is never trusted on its own.
import type { DeliveryArea, DeliveryInfo, District, PublicSettings } from '../../lib/types'

export type CheckoutForm = {
  name: string
  phone: string
  email: string
  district: string
  // The area id (as text) when the district has a choice, like Dhaka city /
  // outside Dhaka city. '' = not chosen. Districts with one area skip it.
  districtArea: string
  area: string
  address: string
  courierNote: string
  isGift: boolean
  giftName: string
  giftPhone: string
  giftNote: string
  hidePrices: boolean
}

export type FieldName = keyof CheckoutForm
export type CheckoutErrors = Partial<Record<FieldName, string>>

export const emptyCheckoutForm: CheckoutForm = {
  name: '',
  phone: '',
  email: '',
  district: '',
  districtArea: '',
  area: '',
  address: '',
  courierNote: '',
  isGift: false,
  giftName: '',
  giftPhone: '',
  giftNote: '',
  hidePrices: true,
}

// Bangladesh mobile numbers: 11 digits, 01 then 3–9, e.g. 01712345678.
// People also type spaces, dashes or the +880 country code, so we clean
// those first: "+880 1712-345678" becomes "01712345678".
export function normalizePhone(input: string): string {
  let digits = input.replace(/[\s-]/g, '')
  if (digits.startsWith('+880')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('880')) digits = '0' + digits.slice(3)
  return digits
}

export function isBdMobile(input: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizePhone(input))
}

function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

export function findDistrict(delivery: DeliveryInfo, name: string): District | undefined {
  return delivery.districts.find((d) => d.name === name)
}

// Does this district ask "where in the district?" (Dhaka: city or outside).
export function needsAreaChoice(district: District | undefined): boolean {
  return (district?.areas.length ?? 0) > 1
}

// The delivery area the form points to, or undefined if not chosen yet.
export function selectedArea(delivery: DeliveryInfo, form: CheckoutForm): DeliveryArea | undefined {
  const district = findDistrict(delivery, form.district)
  if (!district) return undefined
  if (!needsAreaChoice(district)) return district.areas[0]
  return district.areas.find((a) => String(a.id) === form.districtArea)
}

// Returns one message per field that has a problem. No message = field is fine.
export function validateCheckout(form: CheckoutForm, delivery: DeliveryInfo, settings: PublicSettings): CheckoutErrors {
  const errors: CheckoutErrors = {}
  const giftMax = settings.giftNoteMaxChars
  const courierMax = settings.courierNoteMaxChars

  if (form.name.trim().length < 2) errors.name = 'Enter your full name.'

  if (form.phone.trim() === '') errors.phone = 'Enter your phone number. We call it to confirm the order.'
  else if (!isBdMobile(form.phone)) errors.phone = 'Enter an 11-digit mobile number that starts with 01, like 01712345678.'

  if (form.email.trim() !== '' && !isEmail(form.email.trim()))
    errors.email = 'Check the email, for example you@example.com. Or leave it empty.'

  const district = findDistrict(delivery, form.district)
  if (!district) errors.district = 'Choose your district.'
  else if (!selectedArea(delivery, form))
    errors.districtArea = `Choose ${district.areas.map((a) => a.label).join(' or ')}. The delivery charge depends on it.`

  if (form.area.trim() === '') errors.area = 'Enter your area or thana, like Mirpur 10.'

  if (form.address.trim().length < 10) errors.address = 'Enter your full address: house, road, block and a landmark.'

  if ([...form.courierNote].length > courierMax) errors.courierNote = `Keep the note under ${courierMax} characters.`

  if (form.isGift) {
    if (form.giftName.trim().length < 2) errors.giftName = "Enter the receiver's name."
    if (form.giftPhone.trim() === '') errors.giftPhone = "Enter the receiver's phone number. The courier calls it."
    else if (!isBdMobile(form.giftPhone))
      errors.giftPhone = 'Enter an 11-digit mobile number that starts with 01, like 01712345678.'
    if ([...form.giftNote].length > giftMax) errors.giftNote = `Keep the gift note under ${giftMax} characters.`
  }

  return errors
}
