import type { DeliveryInfo, DeliveryZone } from './types'

// Delivery zone helpers. The server decides the real charge at checkout
// (POST /api/checkout/quote); these only help the UI show the published charges.
export function getZone(delivery: DeliveryInfo, code: string): DeliveryZone | undefined {
  return delivery.zones.find((z) => z.code === code)
}

// "৳60 inside Dhaka, ৳100 outside" needs both zones; pages hide the line if one is missing.
export function zoneCharge(delivery: DeliveryInfo, code: string): number | undefined {
  return getZone(delivery, code)?.chargePaisa
}
