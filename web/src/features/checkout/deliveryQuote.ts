import { getZone } from '../../lib/delivery'
import { dhakaAreas, dhakaDistrict, type DeliveryZone } from '../../mocks/delivery'

// Which delivery zone a district (and Dhaka area) falls into.
// Display only: when ordering opens, the Go server computes the real charge
// from the delivery_areas table and sends back a quote.
export function zoneFor(district: string, dhakaArea: string): DeliveryZone | undefined {
  if (district === '') return undefined
  if (district === dhakaDistrict) {
    const area = dhakaAreas.find((a) => a.id === dhakaArea)
    return area ? getZone(area.zone) : undefined
  }
  return getZone('OUTSIDE_DHAKA')
}
