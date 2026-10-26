import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DeliveryInfo, PublicSettings } from '../../lib/types.ts'
import { emptyCheckoutForm, isBdMobile, normalizePhone, selectedArea, validateCheckout, type CheckoutForm } from './validation.ts'

test('normalizePhone: the ways people type a Bangladesh mobile number', () => {
  for (const typed of ['01712345678', '+880 1712-345678', '+8801712345678', '8801712345678', '880 1712 345678', '0171 234 5678', ' 01712-345678 ', '01712\u00a0345678', '01712345678\n']) {
    assert.equal(normalizePhone(typed), '01712345678', typed)
    assert.equal(isBdMobile(typed), true, typed)
  }
})

// The same table is in api/internal/orders/orders_test.go (TestNormalizePhone):
// the server must clean phone numbers exactly like the browser.
test('normalizePhone: Chrome autofill formats (brackets, missing leading 0)', () => {
  for (const typed of ['(182) 967-9208', '1829679208', '+880 1829-679208', '8801829679208', '01829679208', '018 2967 9208', '01829.679.208']) {
    assert.equal(normalizePhone(typed), '01829679208', typed)
    assert.equal(isBdMobile(typed), true, typed)
  }
  for (const bad of ['12345', '02829679208', '01229679208', '+1 (182) 967-9208 1', '']) {
    assert.equal(isBdMobile(bad), false, bad)
  }
})

test('isBdMobile refuses numbers that are not BD mobiles', () => {
  for (const bad of ['', '0171234567', '017123456789', '01212345678', '02712345678', '+881712345678', '০১৭১২৩৪৫৬৭৮', '0171234567a', '+880 01712345678']) {
    assert.equal(isBdMobile(bad), false, bad)
  }
})

const delivery: DeliveryInfo = {
  zones: [],
  freeDeliveryEnabled: false,
  districts: [
    {
      name: 'Dhaka',
      areas: [
        { id: 1, label: 'Dhaka city', hint: '', zoneCode: 'INSIDE_DHAKA' },
        { id: 2, label: 'Outside Dhaka city', hint: '', zoneCode: 'OUTSIDE_DHAKA' },
      ],
    },
    { name: 'Sylhet', areas: [{ id: 3, label: 'Sylhet', hint: '', zoneCode: 'OUTSIDE_DHAKA' }] },
  ],
}
const settings: PublicSettings = {
  codConfirmHours: 48,
  defaultPurchaseLimit: 5,
  returnDays: 3,
  lowStockThreshold: 5,
  giftNoteMaxChars: 10,
  courierNoteMaxChars: 10,
  currency: 'BDT',
}
const good: CheckoutForm = {
  ...emptyCheckoutForm,
  name: 'Rahim Uddin',
  phone: '+880 1712-345678',
  district: 'Sylhet',
  area: 'Zindabazar',
  address: 'House 1, Road 2, Block C',
}

test('a complete form has no errors', () => {
  assert.deepEqual(validateCheckout(good, delivery, settings), {})
  assert.deepEqual(validateCheckout({ ...good, email: 'you@example.com' }, delivery, settings), {})
})

test('an empty form names every required field', () => {
  const errors = validateCheckout(emptyCheckoutForm, delivery, settings)
  assert.deepEqual(Object.keys(errors).sort(), ['address', 'area', 'district', 'name', 'phone'])
})

test('field errors', () => {
  const errors = validateCheckout({ ...good, phone: '1234', email: 'not-an-email', courierNote: 'x'.repeat(11) }, delivery, settings)
  assert.match(errors.phone ?? '', /11-digit/)
  assert.match(errors.email ?? '', /Check the email/)
  assert.match(errors.courierNote ?? '', /under 10 characters/)
})

test('limits count letters, not bytes: Bangla text of exactly the limit is fine', () => {
  assert.equal(validateCheckout({ ...good, courierNote: 'অ'.repeat(10) }, delivery, settings).courierNote, undefined)
  assert.ok(validateCheckout({ ...good, courierNote: 'অ'.repeat(11) }, delivery, settings).courierNote)
})

test('Dhaka asks city or outside; a one-area district does not', () => {
  const dhaka = { ...good, district: 'Dhaka' }
  assert.match(validateCheckout(dhaka, delivery, settings).districtArea ?? '', /Dhaka city or Outside Dhaka city/)
  assert.equal(selectedArea(delivery, { ...dhaka, districtArea: '2' })?.zoneCode, 'OUTSIDE_DHAKA')
  assert.equal(selectedArea(delivery, good)?.id, 3)
})

test('a gift needs the receiver, with a real phone number', () => {
  const gift = { ...good, isGift: true }
  assert.deepEqual(Object.keys(validateCheckout(gift, delivery, settings)).sort(), ['giftName', 'giftPhone'])
  const ok = { ...gift, giftName: 'Karim', giftPhone: '8801812345678' }
  assert.deepEqual(validateCheckout(ok, delivery, settings), {})
  assert.ok(validateCheckout({ ...ok, giftNote: 'x'.repeat(11) }, delivery, settings).giftNote)
})
