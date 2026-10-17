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

		// Products (admin_products.go). No DELETE for products or variants.
		{"GET", "/api/admin/products", s.handleAdminProducts},
		{"POST", "/api/admin/products", s.handleAdminCreateProduct},
		{"GET", "/api/admin/products/{id}", s.handleAdminProduct},
		{"PUT", "/api/admin/products/{id}", s.handleAdminUpdateProduct},
		{"POST", "/api/admin/products/{id}/publish", s.handleAdminPublish},
		{"POST", "/api/admin/products/{id}/archive", s.handleAdminArchive},
		{"POST", "/api/admin/products/{id}/reactivate", s.handleAdminReactivate},
		{"POST", "/api/admin/products/{id}/variants", s.handleAdminAddVariant},
		{"PUT", "/api/admin/variants/{id}", s.handleAdminUpdateVariant},
		{"POST", "/api/admin/variants/{id}/stock", s.handleAdminStock},
		{"POST", "/api/admin/variants/{id}/price-fix", s.handleAdminPriceFix},
		{"POST", "/api/admin/products/{id}/images", s.handleAdminAddImage},
		{"PUT", "/api/admin/products/{id}/images/order", s.handleAdminImageOrder},
		{"PUT", "/api/admin/images/{id}", s.handleAdminUpdateImage},
		{"DELETE", "/api/admin/images/{id}", s.handleAdminRemoveImage},

		// Categories, settings, delivery (admin_catalog.go)
		{"GET", "/api/admin/categories", s.handleAdminCategories},
		{"POST", "/api/admin/categories", s.handleAdminCreateCategory},
		{"PUT", "/api/admin/categories/order", s.handleAdminCategoryOrder},
		{"PUT", "/api/admin/categories/{id}", s.handleAdminUpdateCategory},
		{"GET", "/api/admin/settings", s.handleAdminSettings},
		{"PUT", "/api/admin/settings", s.handleAdminUpdateSettings},
		{"GET", "/api/admin/delivery", s.handleAdminDelivery},
		{"POST", "/api/admin/delivery/zones", s.handleAdminCreateZone},
		{"PUT", "/api/admin/delivery/zones/{id}", s.handleAdminUpdateZone},
		{"POST", "/api/admin/delivery/areas", s.handleAdminCreateArea},
		{"PUT", "/api/admin/delivery/areas/{id}", s.handleAdminUpdateArea},
	}
}
