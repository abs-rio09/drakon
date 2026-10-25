import type { OrderStatus, ProductStatus } from './types'

// Text helpers for the admin pages.

export const statusNames: Record<OrderStatus, string> = {
  PENDING: 'Pending call',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

// "01712345678" -> "01712-345678", easier to read out on the phone.
export function formatPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 5)}-${phone.slice(5)}` : phone
}

// tel: link that works from any phone: +880 and the number without its 0.
export function telHref(phone: string) {
  return 'tel:+880' + phone.replace(/^0/, '')
}

export const zoneName: Record<string, string> = {
  INSIDE_DHAKA: 'Inside Dhaka',
  OUTSIDE_DHAKA: 'Outside Dhaka',
}

// Under this many minutes left, a PENDING order is urgent.
const urgentMinutes = 6 * 60

// Time before a PENDING order cancels itself.
// text: "46h left to call" / "Cancels in 2h" / "Cancels in 25 min"; span: "2h".
export function timeLeft(cancelsAt: string, now = Date.now()): { text: string; span: string; urgent: boolean } {
  const minutes = Math.max(0, Math.floor((new Date(cancelsAt).getTime() - now) / 60000))
  const span = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes} min`
  if (minutes < urgentMinutes) return { text: `Cancels in ${span}`, span, urgent: true }
  return { text: `${span} left to call`, span, urgent: false }
}

// What the admin types as a price ("1,600" or "৳ 599.50") -> whole paisa
// (160000, 59950), or null when it is not a price. Done with text, not
// floating-point maths, so 0.1 + 0.2 problems can never change a price.
export function parseTaka(input: string): number | null {
  const s = input.replace(/[৳,\s]/g, '')
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return null
  const paisa = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return paisa > 0 ? paisa : null
}

// 160000 -> "1600", 59950 -> "599.50" (for an input box, without ৳ or commas).
export function takaInput(paisa: number): string {
  const whole = Math.floor(paisa / 100)
  const rest = paisa % 100
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`
}

export const productStatusNames: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SOLD_OUT: 'Sold out',
  ARCHIVED: 'Archived',
}

// An option name must not start with the product's variant kind: "Size M"
// for a Size product would show as "Size Size M" in the shop. The same rule
// as labelRepeatsKind in Go (api/internal/products/variants.go), which
// decides; this only gives the hint while typing. "" = fine.
export function labelRepeatsKind(label: string, kind: string): string {
  const k = kind.trim()
  const text = label.trim()
  const space = text.indexOf(' ')
  if (k === '' || space < 0) return ''
  const first = text.slice(0, space).replace(/[:-]+$/, '')
  const rest = text.slice(space + 1).trim()
  if (rest === '' || first.toLowerCase() !== k.toLowerCase()) return ''
  return `Leave out the word “${k}”: type ${rest}. The shop already shows the kind (${k}) with it.`
}
