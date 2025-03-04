package main

import (
	"account/backend/middleware"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"

	"account/backend/api"
	"account/backend/database"
)

func init() {
	// 设置日志格式（只保留时间）
	log.SetFlags(0)
	// 输出到控制台
	log.SetOutput(os.Stdout)
}

func main() {
	router := mux.NewRouter()

	// 应用日志中间件
	router.Use(middleware.LoggerMiddleware)

	// 初始化数据库
	database.InitDB()

	// 检查并迁移表结构
	if err := database.CheckAndMigrateTables(); err != nil {
		log.Printf("检查表结构时出错: %v", err)
	}

	// 先重置数据库，创建正确的表结构
	if err := database.ResetDatabase(); err != nil {
		log.Printf("重置数据库失败: %v", err)
	}

	// 创建测试数据 - 只需调用一次CreateTestData
	err := database.InitializeTestData()
	if err != nil {
		log.Printf("创建测试数据时出错: %v", err)
	}

	// 修复外键引用关系
	err = database.FixForeignKeyReferences()
	if err != nil {
		log.Printf("修复外键关系时出错: %v", err)
	}

	// 添加测试账户数据
	err = database.InsertTestAccount()
	if err != nil {
		log.Printf("插入测试账户数据时出错: %v", err)
	}

	// 注释掉重复的初始化函数调用
	// database.InitUsers()
	// database.InsertTestData()

	// 实例化处理器
	userHandler := &api.UserHandler{}
	accountHandler := &api.AccountHandler{}
	storeHandler := &api.StoreHandler{}
	accountTypeHandler := &api.AccountTypeHandler{}
	settingsHandler := &api.SettingsHandler{}

	// 注册路由 - 使用CORS中间件
	router.HandleFunc("/api/login", api.CORSMiddleware(userHandler.Login)).Methods("POST", "OPTIONS")

	// 添加查询用户的调试接口
	router.HandleFunc("/api/debug/users", api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
		// 简单的调试API，列出所有用户
		users, err := database.GetAllUsersDebug()
		if err != nil {
			api.SendResponse(w, http.StatusInternalServerError, 500, err.Error(), nil)
			return
		}
		api.SendResponse(w, http.StatusOK, 200, "成功", users)
	}))

	router.HandleFunc("/test", accountHandler.Test)
	// 账务相关API
	router.HandleFunc("/api/accounts", api.CORSMiddleware(accountHandler.List))
	router.HandleFunc("/api/accounts/create", api.CORSMiddleware(accountHandler.Create))
	router.HandleFunc("/api/accounts/statistics", api.CORSMiddleware(accountHandler.Statistics))

	// 店铺相关API
	router.HandleFunc("/api/stores", api.CORSMiddleware(storeHandler.GetUserStores))
	router.HandleFunc("/api/stores/create", api.CORSMiddleware(storeHandler.CreateStore))
	router.HandleFunc("/api/stores/update", api.CORSMiddleware(storeHandler.UpdateStore))
	router.HandleFunc("/api/stores/delete", api.CORSMiddleware(storeHandler.DeleteStore)).Methods("POST", "OPTIONS")

	// 账务类型相关API
	router.HandleFunc("/api/account-types", api.CORSMiddleware(accountTypeHandler.GetAll))
	router.HandleFunc("/api/account-types/create", api.CORSMiddleware(accountTypeHandler.CreateAccountType))
	router.HandleFunc("/api/account-types/update", api.CORSMiddleware(accountTypeHandler.UpdateAccountType))
	router.HandleFunc("/api/account-types/delete", api.CORSMiddleware(accountTypeHandler.DeleteAccountType))

	// 用户管理相关API
	router.HandleFunc("/api/users", api.CORSMiddleware(userHandler.GetAllUsers))
	router.HandleFunc("/api/users/create", api.CORSMiddleware(userHandler.CreateUser))
	router.HandleFunc("/api/users/update", api.CORSMiddleware(userHandler.UpdateUser))
	router.HandleFunc("/api/users/delete", api.CORSMiddleware(userHandler.DeleteUser))
	router.HandleFunc("/api/users/reset-password", api.CORSMiddleware(userHandler.ResetPassword))
	// 用户权限API - 使用Methods指定允许的HTTP方法
	router.HandleFunc("/api/users/permissions", api.CORSMiddleware(userHandler.GetUserStorePermissions)).Methods("GET")
	router.HandleFunc("/api/users/permissions", api.CORSMiddleware(userHandler.UpdateUserStorePermissions)).Methods("POST")

	// 默认设置相关路由
	router.HandleFunc("/api/settings/default", api.CORSMiddleware(settingsHandler.SaveDefaultSettings)).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/settings/default", api.CORSMiddleware(settingsHandler.GetDefaultSettings)).Methods("GET", "OPTIONS")

	// 删除账目接口 - RESTful风格
	router.HandleFunc("/api/accounts/{id}", api.CORSMiddleware(api.DeleteAccount)).Methods("DELETE", "OPTIONS")

	// 也可以添加查询参数风格的接口做兼容
	router.HandleFunc("/api/account", api.CORSMiddleware(api.DeleteAccountByQuery)).Methods("DELETE", "OPTIONS")

	// 在路由部分添加统计报表接口
	// 统计相关接口
	router.HandleFunc("/api/statistics/report", api.CORSMiddleware(api.GetReport)).Methods("GET", "OPTIONS")

	// 添加调试API
	router.HandleFunc("/api/debug/create-test-users", api.CORSMiddleware(api.CreateTestUsers)).Methods("POST", "OPTIONS")

	log.Printf("服务器启动在 :8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}
