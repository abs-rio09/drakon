// Checks the checkout form in the browser so the buyer gets quick, friendly
// messages. The Go server will check everything again: the browser can be
// changed by anyone, so it is never trusted on its own.
import { dhakaDistrict, districts } from '../../mocks/delivery'

export type CheckoutForm = {
  name: string
  phone: string
  email: string
  district: string
  dhakaArea: string // 'city' | 'outer' | '' (only asked for Dhaka)
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
  dhakaArea: '',
  area: '',
  address: '',
  courierNote: '',
  isGift: false,
  giftName: '',
  giftPhone: '',
  giftNote: '',
  hidePrices: true,
}

export const GIFT_NOTE_MAX = 150
export const COURIER_NOTE_MAX = 200

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

// Returns one message per field that has a problem. No message = field is fine.
export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {}

  if (form.name.trim().length < 2) errors.name = 'Enter your full name.'

  if (form.phone.trim() === '') errors.phone = 'Enter your phone number. We call it to confirm the order.'
  else if (!isBdMobile(form.phone)) errors.phone = 'Enter an 11-digit mobile number that starts with 01, like 01712345678.'

  if (form.email.trim() !== '' && !isEmail(form.email.trim()))
    errors.email = 'Check the email, for example you@example.com. Or leave it empty.'

  if (!districts.includes(form.district)) errors.district = 'Choose your district.'
  else if (form.district === dhakaDistrict && form.dhakaArea === '')
    errors.dhakaArea = 'Choose Dhaka city or outside Dhaka city. The delivery charge depends on it.'

  if (form.area.trim() === '') errors.area = 'Enter your area or thana, like Mirpur 10.'

  if (form.address.trim().length < 10) errors.address = 'Enter your full address: house, road, block and a landmark.'

  if (form.courierNote.length > COURIER_NOTE_MAX)
    errors.courierNote = `Keep the note under ${COURIER_NOTE_MAX} characters.`

  if (form.isGift) {
    if (form.giftName.trim().length < 2) errors.giftName = "Enter the receiver's name."
    if (form.giftPhone.trim() === '') errors.giftPhone = "Enter the receiver's phone number. The courier calls it."
    else if (!isBdMobile(form.giftPhone))
      errors.giftPhone = 'Enter an 11-digit mobile number that starts with 01, like 01712345678.'
    if (form.giftNote.length > GIFT_NOTE_MAX) errors.giftNote = `Keep the gift note under ${GIFT_NOTE_MAX} characters.`
  }

  return errors
}
