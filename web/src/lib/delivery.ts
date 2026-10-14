import { deliveryZones, type DeliveryZone } from '../mocks/delivery'

// Delivery zone helpers. The server decides the real charge at checkout;
// these only help the UI show the published charges.
export function getZone(code: DeliveryZone['code']): DeliveryZone {
  const zone = deliveryZones.find((z) => z.code === code)
  if (!zone) throw new Error(`Unknown delivery zone ${code}`)
  return zone
}
