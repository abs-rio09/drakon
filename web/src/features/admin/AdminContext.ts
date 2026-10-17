import { createContext, useContext } from 'react'
import type { Admin } from './types'

export type AdminContextValue = {
  // undefined = still asking the server; null = not logged in
  admin: Admin | null | undefined
  loggedIn: (admin: Admin) => void
  logOut: () => Promise<void>
}

export const AdminContext = createContext<AdminContextValue | null>(null)

// Who is logged in, from any admin page: const { admin, logOut } = useAdmin()
export function useAdmin() {
  const value = useContext(AdminContext)
  if (!value) throw new Error('useAdmin must be used inside <AdminProvider>')
  return value
}
