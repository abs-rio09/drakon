import { Route, Routes } from 'react-router'
import { CheckoutLayout } from './components/layout/CheckoutLayout'
import { RootLayout } from './components/layout/RootLayout'
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

// Every customer URL, from docs/blueprint.md (part 6, sitemap).
// Routes inside <RootLayout> get the site header and footer.
function App() {
  return (
    <Routes>
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
    </Routes>
  )
}

export default App
