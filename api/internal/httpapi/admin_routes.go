package httpapi

// adminRoutes is every admin endpoint that needs a session (all of them
// except POST /api/admin/login). Routes are registered from this table, and
// admin_test.go checks each one answers 401 without a session.
// A new admin route goes here AND into that test.
func (s *Server) adminRoutes() []adminRoute {
	return []adminRoute{
		{"GET", "/api/admin/me", s.handleAdminMe},
		{"POST", "/api/admin/logout", s.handleAdminLogout},

		// Orders (admin_orders.go)
		{"GET", "/api/admin/dashboard", s.handleAdminDashboard},
		{"GET", "/api/admin/orders", s.handleAdminOrders},
		{"GET", "/api/admin/orders/call-list", s.handleAdminCallList},
		{"GET", "/api/admin/orders/{number}", s.handleAdminOrder},
		{"POST", "/api/admin/orders/{number}/status", s.handleAdminOrderStatus},
		{"PUT", "/api/admin/orders/{number}/note", s.handleAdminOrderNote},
		{"GET", "/api/admin/blocked-phones", s.handleBlockedPhones},
		{"POST", "/api/admin/blocked-phones", s.handleBlockPhone},
		{"POST", "/api/admin/blocked-phones/unblock", s.handleUnblockPhone},
	}
}
