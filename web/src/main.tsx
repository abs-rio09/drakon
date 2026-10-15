import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './features/cart/CartProvider'
import { SiteProvider } from './features/site/SiteProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </SiteProvider>
    </BrowserRouter>
  </StrictMode>,
)
