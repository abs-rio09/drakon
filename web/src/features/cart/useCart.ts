import { useContext } from 'react'
import { CartContext } from './CartContext'

// Read and change the cart from any component: const cart = useCart()
export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside <CartProvider>')
  return cart
}
