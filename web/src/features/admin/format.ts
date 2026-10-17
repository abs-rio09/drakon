import type { OrderStatus } from './types'

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
