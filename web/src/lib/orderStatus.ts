import type { OrderStatus } from './types'

// How each order status reads for the buyer.
export const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'Placed, waiting for our call',
  CONFIRMED: 'Confirmed by phone',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}
