import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getZone, zoneCharge } from './delivery.ts'
import type { DeliveryInfo } from './types.ts'

const delivery: DeliveryInfo = {
  zones: [
    { code: 'INSIDE_DHAKA', name: 'Inside Dhaka', chargePaisa: 6000, freeOverPaisa: null, currency: 'BDT' },
    { code: 'OUTSIDE_DHAKA', name: 'Outside Dhaka', chargePaisa: 10000, freeOverPaisa: 500000, currency: 'BDT' },
  ],
  districts: [],
  freeDeliveryEnabled: false,
}

test('zoneCharge comes from the API data, never from code', () => {
  assert.equal(zoneCharge(delivery, 'INSIDE_DHAKA'), 6000)
  assert.equal(zoneCharge(delivery, 'OUTSIDE_DHAKA'), 10000)
  assert.equal(getZone(delivery, 'OUTSIDE_DHAKA')?.freeOverPaisa, 500000)
})

test('an unknown or missing zone gives undefined, so the page hides the line', () => {
  assert.equal(zoneCharge(delivery, 'MARS'), undefined)
  assert.equal(zoneCharge({ ...delivery, zones: [] }, 'INSIDE_DHAKA'), undefined)
})
