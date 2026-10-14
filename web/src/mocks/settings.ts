// MOCK DATA — will be replaced by the Go API (GET /api/settings/public and
// the delivery_zones / delivery_areas tables). Business numbers live ONLY in
// this folder. Components read them from here, never write them by hand.

export const settings = {
  // We call within this many hours to confirm a Cash on Delivery order.
  codConfirmHours: 48,
  // Default purchase limit per customer when a product has none of its own.
  defaultPurchaseLimit: 5,
  // Returns are accepted within this many days after delivery.
  returnDays: 3,
  currency: 'BDT',
} as const
