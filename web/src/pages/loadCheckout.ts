// The checkout page is a separate download (App.tsx). The cart page calls
// this early, so the code is already there when the buyer taps Checkout.
export const loadCheckout = () => import('./Checkout')
