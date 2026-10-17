// The shapes the admin API sends (api/internal/httpapi/admin_*.go).
// Money is whole paisa; format it only with formatTaka().

export type Admin = {
  id: number
  email: string
  role: 'OWNER'
}
