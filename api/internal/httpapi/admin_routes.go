package httpapi

// adminRoutes is every admin endpoint that needs a session (all of them
// except POST /api/admin/login). Routes are registered from this table, and
// admin_test.go checks each one answers 401 without a session.
// A new admin route goes here AND into that test.
func (s *Server) adminRoutes() []adminRoute {
	return []adminRoute{
		{"GET", "/api/admin/me", s.handleAdminMe},
		{"POST", "/api/admin/logout", s.handleAdminLogout},
	}
}
