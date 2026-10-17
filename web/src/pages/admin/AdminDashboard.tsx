import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { useAdmin } from '../../features/admin/AdminContext'

// /admin. The order numbers and today's call list come in the next step.
export default function AdminDashboard() {
  const { admin } = useAdmin()
  return <AdminPageHeader title="Dashboard" intro={`Logged in as ${admin?.email}.`} />
}
