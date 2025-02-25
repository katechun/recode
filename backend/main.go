package main

import (
	"log"
	"net/http"

	"account/backend/api"
	"account/backend/database"
)

func main() {
	// 初始化数据库
	database.InitDB()
	defer database.DB.Close()

	// 插入默认管理员
	database.InsertDefaultAdmin()

	// 插入测试数据
	database.InsertTestData()

	// 实例化处理器
	userHandler := &api.UserHandler{}
	accountHandler := &api.AccountHandler{}
	storeHandler := &api.StoreHandler{}
	accountTypeHandler := &api.AccountTypeHandler{}

	// 注册路由 - 使用CORS中间件
	http.HandleFunc("/api/login", api.CORSMiddleware(userHandler.Login))

	// 添加查询用户的调试接口
	http.HandleFunc("/api/debug/users", api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
		// 简单的调试API，列出所有用户
		users, err := database.GetAllUsersDebug()
		if err != nil {
			api.SendResponse(w, http.StatusInternalServerError, 500, err.Error(), nil)
			return
		}
		api.SendResponse(w, http.StatusOK, 200, "成功", users)
	}))

	// 账务相关API
	http.HandleFunc("/api/accounts", api.CORSMiddleware(accountHandler.List))
	http.HandleFunc("/api/accounts/create", api.CORSMiddleware(accountHandler.Create))
	http.HandleFunc("/api/accounts/statistics", api.CORSMiddleware(accountHandler.Statistics))

	// 店铺相关API
	http.HandleFunc("/api/stores", api.CORSMiddleware(storeHandler.GetUserStores))
	http.HandleFunc("/api/stores/create", api.CORSMiddleware(storeHandler.CreateStore))
	http.HandleFunc("/api/stores/update", api.CORSMiddleware(storeHandler.UpdateStore))
	http.HandleFunc("/api/stores/delete", api.CORSMiddleware(storeHandler.DeleteStore))

	// 账务类型相关API
	http.HandleFunc("/api/account-types", api.CORSMiddleware(accountTypeHandler.GetAll))
	http.HandleFunc("/api/account-types/create", api.CORSMiddleware(accountTypeHandler.CreateAccountType))
	http.HandleFunc("/api/account-types/update", api.CORSMiddleware(accountTypeHandler.UpdateAccountType))
	http.HandleFunc("/api/account-types/delete", api.CORSMiddleware(accountTypeHandler.DeleteAccountType))

	// 用户管理相关API
	http.HandleFunc("/api/users", api.CORSMiddleware(userHandler.GetAllUsers))
	http.HandleFunc("/api/users/create", api.CORSMiddleware(userHandler.CreateUser))
	http.HandleFunc("/api/users/update", api.CORSMiddleware(userHandler.UpdateUser))
	http.HandleFunc("/api/users/delete", api.CORSMiddleware(userHandler.DeleteUser))
	http.HandleFunc("/api/users/reset-password", api.CORSMiddleware(userHandler.ResetPassword))
	http.HandleFunc("/api/users/permissions", api.CORSMiddleware(userHandler.GetUserStorePermissions))
	http.HandleFunc("/api/users/update-permissions", api.CORSMiddleware(userHandler.UpdateUserStorePermissions))

	// 启动服务器
	log.Println("服务器启动在 http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
