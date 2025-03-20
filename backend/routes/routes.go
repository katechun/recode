package routes

import (
	"github.com/gorilla/mux"
	"github.com/your-project/apihandlers"
	"github.com/your-project/handlers"
)

// 注册API路由
func RegisterAPIRoutes(router *mux.Router, api *apihandlers.API) {
	// 产品管理API
	router.HandleFunc("/api/products/list", handlers.GetProductList).Methods("GET")
	router.HandleFunc("/api/products/add", handlers.AddProduct).Methods("POST")
	router.HandleFunc("/api/products/delete", handlers.DeleteProduct).Methods("POST")
	router.HandleFunc("/api/customer/products", handlers.GetCustomerProducts).Methods("GET")
}
