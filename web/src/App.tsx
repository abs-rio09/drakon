import { lazy, Suspense } from 'react'
import { Outlet, Route, Routes } from 'react-router'
import { CheckoutLayout } from './components/layout/CheckoutLayout'
import { RootLayout } from './components/layout/RootLayout'
import { Loading } from './components/ui/LoadState'
import { CartProvider } from './features/cart/CartProvider'
import { SiteProvider } from './features/site/SiteProvider'
import About from './pages/About'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Contact from './pages/Contact'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import OrderConfirmation from './pages/OrderConfirmation'
import { PrivacyPolicy, ReturnsPolicy, TermsPolicy } from './pages/Policy'
import Product from './pages/Product'
import Search from './pages/Search'
import Shop from './pages/Shop'
import SoldOut from './pages/SoldOut'
import Track from './pages/Track'

// The admin is a separate download: shoppers never load its code.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

// The shop needs the settings, delivery charges and the cart; the admin does not.
function ShopProviders() {
  return (
    <SiteProvider>
      <CartProvider>
        <Outlet />
      </CartProvider>
    </SiteProvider>
  )
}

// Every URL, from docs/blueprint.md (part 6, sitemap).
// Routes inside <RootLayout> get the site header and footer.
function App() {
  return (
    <Routes>
      {/* Admin: never linked from the shop (blueprint rule 8) */}
      <Route
        path="admin/*"
        element={
          <Suspense fallback={<Loading label="Opening the admin" />}>
            <AdminApp />
          </Suspense>
        }
      />

      <Route element={<ShopProviders />}>
        <Route element={<RootLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="shop/:category" element={<Shop />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="search" element={<Search />} />
          <Route path="sold-out" element={<SoldOut />} />
          <Route path="cart" element={<Cart />} />
          <Route path="order/:number" element={<OrderConfirmation />} />
          <Route path="track" element={<Track />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="policies/returns" element={<ReturnsPolicy />} />
          <Route path="policies/terms" element={<TermsPolicy />} />
          <Route path="policies/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Checkout has its own quiet header */}
        <Route element={<CheckoutLayout />}>
          <Route path="checkout" element={<Checkout />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
