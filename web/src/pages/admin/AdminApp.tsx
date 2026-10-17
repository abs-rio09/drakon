import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AdminLayout } from '../../components/admin/AdminLayout'
import { Loading } from '../../components/ui/LoadState'
import { useAdmin } from '../../features/admin/AdminContext'
import { AdminProvider } from '../../features/admin/AdminProvider'
import AdminBlockedPhones from './AdminBlockedPhones'
import AdminCategories from './AdminCategories'
import AdminDashboard from './AdminDashboard'
import AdminDelivery from './AdminDelivery'
import AdminLogin from './AdminLogin'
import AdminOrder from './AdminOrder'
import AdminOrders from './AdminOrders'
import AdminProductEdit from './AdminProductEdit'
import AdminProducts from './AdminProducts'
import AdminSettings from './AdminSettings'

// Everything under /admin. Loaded only when someone opens /admin (a separate
// file in the build), and never linked from the shop.
export default function AdminApp() {
  return (
    <AdminProvider>
      {/* Search engines must never list admin pages */}
      <meta name="robots" content="noindex, nofollow" />
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:number" element={<AdminOrder />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductEdit />} />
            <Route path="products/:id" element={<AdminProductEdit />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="delivery" element={<AdminDelivery />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="blocked-phones" element={<AdminBlockedPhones />} />
            <Route path="*" element={<AdminNotFound />} />
          </Route>
        </Route>
      </Routes>
    </AdminProvider>
  )
}

// The auth guard: not logged in -> the login page, which comes back here after.
function RequireAdmin() {
  const { admin } = useAdmin()
  const location = useLocation()
  if (admin === undefined) return <Loading label="Checking your login" />
  if (admin === null) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

function AdminNotFound() {
  return <p className="py-24 text-center text-body-lg text-ink-muted">There is no admin page at this address.</p>
}
