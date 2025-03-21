package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"account/backend/database"
	"account/backend/models"

	"github.com/gorilla/mux"
)

// GetCustomers 获取客户列表接口
func GetCustomers(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少user_id参数", nil)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的user_id参数", nil)
		return
	}

	// 获取分页参数
	page := 1
	pageSize := 20

	pageStr := r.URL.Query().Get("page")
	if pageStr != "" {
		page, err = strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}
	}

	pageSizeStr := r.URL.Query().Get("page_size")
	if pageSizeStr != "" {
		pageSize, err = strconv.Atoi(pageSizeStr)
		if err != nil || pageSize < 1 {
			pageSize = 20
		}
		if pageSize > 100 {
			pageSize = 100 // 限制最大页面大小
		}
	}

	// 获取过滤参数
	storeID := r.URL.Query().Get("store_id")
	name := r.URL.Query().Get("name")
	phone := r.URL.Query().Get("phone")

	// 调用数据库函数获取客户列表
	customers, totalCount, err := database.GetCustomers(userID, storeID, name, phone, page, pageSize)
	if err != nil {
		log.Printf("获取客户列表失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取客户列表失败", nil)
		return
	}

	// 返回响应
	result := map[string]interface{}{
		"total": totalCount,
		"list":  customers,
		"page":  page,
		"limit": pageSize,
		"pages": (totalCount + pageSize - 1) / pageSize,
	}
	SendResponse(w, http.StatusOK, 200, "获取客户列表成功", result)
}

// GetCustomerDetail 获取客户详情接口
func GetCustomerDetail(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID和客户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "缺少user_id参数", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "无效的user_id参数", http.StatusBadRequest)
		return
	}

	customerIDStr := r.URL.Query().Get("customer_id")
	if customerIDStr == "" {
		http.Error(w, "缺少customer_id参数", http.StatusBadRequest)
		return
	}

	customerID, err := strconv.Atoi(customerIDStr)
	if err != nil {
		http.Error(w, "无效的customer_id参数", http.StatusBadRequest)
		return
	}

	// 调用数据库函数获取客户详情
	customer, err := database.GetCustomerByID(userID, customerID)
	if err != nil {
		log.Printf("获取客户详情失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户详情失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "获取客户详情成功", customer)
}

// CreateCustomer 创建客户接口
func CreateCustomer(w http.ResponseWriter, r *http.Request) {
	// 解析请求数据
	var requestData struct {
		UserID        int     `json:"user_id"`
		Name          string  `json:"name"`
		Phone         string  `json:"phone"`
		Gender        int     `json:"gender"`
		Age           int     `json:"age"`
		Height        float64 `json:"height"`
		InitialWeight float64 `json:"initial_weight"`
		CurrentWeight float64 `json:"current_weight"`
		TargetWeight  float64 `json:"target_weight"`
		StoreID       int     `json:"store_id"`
		Notes         string  `json:"notes"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 验证必要字段
	if requestData.Name == "" || requestData.Phone == "" || requestData.StoreID == 0 {
		SendResponse(w, http.StatusBadRequest, 400, "名称、电话和店铺ID为必填项", nil)
		return
	}

	// 检查用户是否有权限操作该店铺
	hasPermission, err := database.UserHasStorePermission(requestData.UserID, requestData.StoreID)
	if err != nil {
		log.Printf("检查用户权限失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "检查用户权限失败", nil)
		return
	}

	if !hasPermission {
		SendResponse(w, http.StatusForbidden, 403, "无权操作该店铺", nil)
		return
	}

	// 创建客户
	customer := &models.Customer{
		Name:          requestData.Name,
		Phone:         requestData.Phone,
		Gender:        requestData.Gender,
		Age:           requestData.Age,
		Height:        requestData.Height,
		InitialWeight: requestData.InitialWeight,
		CurrentWeight: requestData.CurrentWeight,
		TargetWeight:  requestData.TargetWeight,
		StoreID:       requestData.StoreID,
		Notes:         requestData.Notes,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	customerID, err := database.CreateCustomer(customer)
	if err != nil {
		log.Printf("创建客户失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("创建客户失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "创建客户成功", map[string]interface{}{
		"customer_id": customerID,
	})
}

// UpdateCustomer 更新客户接口
func UpdateCustomer(w http.ResponseWriter, r *http.Request) {
	// 解析请求数据
	var requestData struct {
		UserID        int     `json:"user_id"`
		CustomerID    int     `json:"customer_id"`
		Name          string  `json:"name"`
		Phone         string  `json:"phone"`
		Gender        int     `json:"gender"`
		Age           int     `json:"age"`
		Height        float64 `json:"height"`
		InitialWeight float64 `json:"initial_weight"`
		CurrentWeight float64 `json:"current_weight"`
		TargetWeight  float64 `json:"target_weight"`
		StoreID       int     `json:"store_id"`
		Notes         string  `json:"notes"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 验证必要字段
	if requestData.CustomerID == 0 || requestData.Name == "" || requestData.Phone == "" || requestData.StoreID == 0 {
		SendResponse(w, http.StatusBadRequest, 400, "客户ID、名称、电话和店铺ID为必填项", nil)
		return
	}

	// 检查客户是否存在
	_, err = database.GetCustomerByID(requestData.UserID, requestData.CustomerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 检查用户是否有权限操作该店铺
	hasPermission, err := database.UserHasStorePermission(requestData.UserID, requestData.StoreID)
	if err != nil {
		log.Printf("检查用户权限失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "检查用户权限失败", nil)
		return
	}

	if !hasPermission {
		SendResponse(w, http.StatusForbidden, 403, "无权操作该店铺", nil)
		return
	}

	// 更新客户信息
	customer := &models.Customer{
		ID:            requestData.CustomerID,
		Name:          requestData.Name,
		Phone:         requestData.Phone,
		Gender:        requestData.Gender,
		Age:           requestData.Age,
		Height:        requestData.Height,
		InitialWeight: requestData.InitialWeight,
		CurrentWeight: requestData.CurrentWeight,
		TargetWeight:  requestData.TargetWeight,
		StoreID:       requestData.StoreID,
		Notes:         requestData.Notes,
		UpdatedAt:     time.Now(),
	}

	err = database.UpdateCustomer(customer)
	if err != nil {
		log.Printf("更新客户失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("更新客户失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "更新客户成功", nil)
}

// DeleteCustomer 删除客户接口
func DeleteCustomer(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID和客户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少user_id参数", nil)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的user_id参数", nil)
		return
	}

	customerIDStr := r.URL.Query().Get("customer_id")
	if customerIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少customer_id参数", nil)
		return
	}

	customerID, err := strconv.Atoi(customerIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的customer_id参数", nil)
		return
	}

	// 检查客户是否存在并获取所属店铺ID
	customer, err := database.GetCustomerByID(userID, customerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 检查用户是否有权限操作该店铺
	hasPermission, err := database.UserHasStorePermission(userID, customer.StoreID)
	if err != nil {
		log.Printf("检查用户权限失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "检查用户权限失败", nil)
		return
	}

	if !hasPermission {
		SendResponse(w, http.StatusForbidden, 403, "无权操作该店铺", nil)
		return
	}

	// 删除客户
	err = database.DeleteCustomer(customerID)
	if err != nil {
		log.Printf("删除客户失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("删除客户失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "删除客户成功", nil)
}

// GetWeightRecords 获取体重记录接口
func GetWeightRecords(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID和客户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少user_id参数", nil)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的user_id参数", nil)
		return
	}

	customerIDStr := r.URL.Query().Get("customer_id")
	if customerIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少customer_id参数", nil)
		return
	}

	customerID, err := strconv.Atoi(customerIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的customer_id参数", nil)
		return
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(userID, customerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 获取体重记录
	records, err := database.GetWeightRecords(customerID)
	if err != nil {
		log.Printf("获取体重记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取体重记录失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "获取体重记录成功", records)
}

// AddWeightRecord 添加体重记录接口
func AddWeightRecord(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var requestData struct {
		UserID     int     `json:"user_id"`
		CustomerID int     `json:"customer_id"`
		Weight     float64 `json:"weight"`
		RecordDate string  `json:"record_date"`
		Notes      string  `json:"notes"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		log.Printf("解析请求体失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 校验数据
	if requestData.UserID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	if requestData.CustomerID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的客户ID", nil)
		return
	}

	if requestData.Weight <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的体重值", nil)
		return
	}

	_, err = time.Parse("2006-01-02", requestData.RecordDate)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的日期格式，应为YYYY-MM-DD", nil)
		return
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(requestData.UserID, requestData.CustomerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 添加体重记录
	record := &models.WeightRecord{
		CustomerID: requestData.CustomerID,
		Weight:     requestData.Weight,
		RecordDate: requestData.RecordDate,
		Notes:      requestData.Notes,
		CreatedAt:  time.Now(),
	}

	recordID, err := database.AddWeightRecord(record)
	if err != nil {
		log.Printf("添加体重记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("添加体重记录失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "添加体重记录成功", map[string]interface{}{
		"record_id": recordID,
	})
}

// GetProductUsage 获取产品使用记录接口
func GetProductUsage(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID和客户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少user_id参数", nil)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的user_id参数", nil)
		return
	}

	customerIDStr := r.URL.Query().Get("customer_id")
	if customerIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少customer_id参数", nil)
		return
	}

	customerID, err := strconv.Atoi(customerIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的customer_id参数", nil)
		return
	}

	// 获取分页参数
	page := 1
	pageSize := 20

	pageStr := r.URL.Query().Get("page")
	if pageStr != "" {
		page, err = strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}
	}

	pageSizeStr := r.URL.Query().Get("page_size")
	if pageSizeStr != "" {
		pageSize, err = strconv.Atoi(pageSizeStr)
		if err != nil || pageSize < 1 {
			pageSize = 20
		}
		if pageSize > 100 {
			pageSize = 100 // 限制最大页面大小
		}
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(userID, customerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 获取产品使用记录
	usages, err := database.GetProductUsages(customerID, page, pageSize)
	if err != nil {
		log.Printf("获取产品使用记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取产品使用记录失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "获取产品使用记录成功", usages)
}

// AddProductUsage 添加产品使用记录接口
func AddProductUsage(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var requestData struct {
		UserID        int     `json:"user_id"`
		CustomerID    int     `json:"customer_id"`
		ProductID     int     `json:"product_id"`
		ProductName   string  `json:"product_name"`
		Quantity      float64 `json:"quantity"`
		UsageDate     string  `json:"usage_date"`
		UpdateDate    string  `json:"update_date"`
		PurchaseCount int     `json:"purchase_count"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		log.Printf("解析请求体失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 校验数据
	if requestData.UserID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	if requestData.CustomerID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的客户ID", nil)
		return
	}

	if requestData.ProductID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的产品ID", nil)
		return
	}

	if requestData.ProductName == "" {
		SendResponse(w, http.StatusBadRequest, 400, "产品名称不能为空", nil)
		return
	}

	if requestData.Quantity < 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的剩余次数", nil)
		return
	}

	if requestData.UsageDate != "" {
		_, err = time.Parse("2006-01-02", requestData.UsageDate)
		if err != nil {
			SendResponse(w, http.StatusBadRequest, 400, "无效的日期格式，应为YYYY-MM-DD", nil)
			return
		}
	} else {
		// 使用当前日期
		now := time.Now()
		requestData.UsageDate = now.Format("2006-01-02")
	}

	// 验证更新日期格式
	if requestData.UpdateDate != "" {
		_, err = time.Parse("2006-01-02", requestData.UpdateDate)
		if err != nil {
			SendResponse(w, http.StatusBadRequest, 400, "无效的更新日期格式，应为YYYY-MM-DD", nil)
			return
		}
	} else {
		// 使用当前日期作为更新日期
		now := time.Now()
		requestData.UpdateDate = now.Format("2006-01-02")
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(requestData.UserID, requestData.CustomerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 添加产品使用记录（添加重试逻辑）
	insertQuery := `INSERT INTO product_usages (customer_id, product_id, product_name, quantity, usage_date, update_date, purchase_count, created_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`

	// 重试次数和延迟设置
	maxRetries := 3
	retryDelay := 100 * time.Millisecond

	var lastErr error
	for i := 0; i < maxRetries; i++ {
		_, err = database.DB.Exec(insertQuery, requestData.CustomerID, requestData.ProductID, requestData.ProductName,
			requestData.Quantity, requestData.UsageDate, requestData.UpdateDate, requestData.PurchaseCount)

		if err == nil {
			// 添加成功
			break
		}

		lastErr = err

		// 检查是否是数据库锁定错误
		if strings.Contains(err.Error(), "database is locked") ||
			strings.Contains(err.Error(), "SQLITE_BUSY") {
			log.Printf("数据库锁定，重试添加产品使用记录 (尝试 %d/%d): %v", i+1, maxRetries, err)

			// 增加随机延迟，避免多个客户端同时重试造成持续冲突
			jitter := time.Duration(rand.Intn(50)) * time.Millisecond
			time.Sleep(retryDelay + jitter)

			// 指数退避
			retryDelay *= 2
			continue
		}

		// 如果不是数据库锁定错误，直接退出重试循环
		break
	}

	if lastErr != nil {
		log.Printf("添加产品使用记录失败: %v", lastErr)
		SendResponse(w, http.StatusInternalServerError, 500, "添加产品使用记录失败，请稍后重试", nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "添加产品使用记录成功", nil)
}

// UpdateProductUsage 更新产品使用记录接口
func UpdateProductUsage(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var requestData struct {
		UserID        int     `json:"user_id"`
		CustomerID    int     `json:"customer_id"`
		ProductID     int     `json:"product_id"`
		UsageID       int     `json:"usage_id"` // 添加记录ID
		Quantity      float64 `json:"quantity"`
		UsageDate     string  `json:"usage_date"`
		UpdateDate    string  `json:"update_date"`
		PurchaseCount int     `json:"purchase_count"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		log.Printf("解析请求体失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 校验数据
	if requestData.UserID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	if requestData.CustomerID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的客户ID", nil)
		return
	}

	// 如果提供了UsageID，则使用它，否则使用客户ID和产品ID的组合
	if requestData.UsageID <= 0 && requestData.ProductID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "必须提供产品ID或使用记录ID", nil)
		return
	}

	if requestData.Quantity < 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的剩余次数", nil)
		return
	}

	if requestData.UsageDate != "" {
		_, err = time.Parse("2006-01-02", requestData.UsageDate)
		if err != nil {
			SendResponse(w, http.StatusBadRequest, 400, "无效的日期格式，应为YYYY-MM-DD", nil)
			return
		}
	} else {
		// 使用当前日期
		now := time.Now()
		requestData.UsageDate = now.Format("2006-01-02")
	}

	// 验证更新日期格式
	if requestData.UpdateDate != "" {
		_, err = time.Parse("2006-01-02", requestData.UpdateDate)
		if err != nil {
			SendResponse(w, http.StatusBadRequest, 400, "无效的更新日期格式，应为YYYY-MM-DD", nil)
			return
		}
	} else {
		// 使用当前日期作为更新日期
		now := time.Now()
		requestData.UpdateDate = now.Format("2006-01-02")
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(requestData.UserID, requestData.CustomerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 构建更新查询
	var updateQuery string
	var queryArgs []interface{}

	if requestData.UsageID > 0 {
		// 使用记录ID更新特定记录
		updateQuery = `UPDATE product_usages SET quantity = ?, usage_date = ?, update_date = ? WHERE id = ? AND customer_id = ?`
		queryArgs = []interface{}{
			requestData.Quantity,
			requestData.UsageDate,
			requestData.UpdateDate,
			requestData.UsageID,
			requestData.CustomerID,
		}
	} else {
		// 使用客户ID和产品ID组合
		// 检查产品使用记录是否存在
		exists := false
		err = database.DB.QueryRow("SELECT COUNT(*) > 0 FROM product_usages WHERE customer_id = ? AND product_id = ?",
			requestData.CustomerID, requestData.ProductID).Scan(&exists)

		if err != nil {
			log.Printf("检查产品使用记录失败: %v", err)
			SendResponse(w, http.StatusInternalServerError, 500, "检查产品使用记录失败", nil)
			return
		}

		if !exists {
			log.Printf("产品使用记录不存在: 客户ID=%d, 产品ID=%d", requestData.CustomerID, requestData.ProductID)
			SendResponse(w, http.StatusBadRequest, 400, "产品使用记录不存在", nil)
			return
		}

		updateQuery = `UPDATE product_usages SET quantity = ?, usage_date = ?, update_date = ? WHERE customer_id = ? AND product_id = ?`
		queryArgs = []interface{}{
			requestData.Quantity,
			requestData.UsageDate,
			requestData.UpdateDate,
			requestData.CustomerID,
			requestData.ProductID,
		}
	}

	// 重试次数和延迟设置
	maxRetries := 3
	retryDelay := 100 * time.Millisecond

	var lastErr error
	for i := 0; i < maxRetries; i++ {
		_, err = database.DB.Exec(updateQuery, queryArgs...)

		if err == nil {
			// 更新成功
			break
		}

		lastErr = err

		// 检查是否是数据库锁定错误
		if strings.Contains(err.Error(), "database is locked") ||
			strings.Contains(err.Error(), "SQLITE_BUSY") {
			log.Printf("数据库锁定，重试更新产品使用记录 (尝试 %d/%d): %v", i+1, maxRetries, err)

			// 增加随机延迟，避免多个客户端同时重试造成持续冲突
			jitter := time.Duration(rand.Intn(50)) * time.Millisecond
			time.Sleep(retryDelay + jitter)

			// 指数退避
			retryDelay *= 2
			continue
		}

		// 如果不是数据库锁定错误，直接退出重试循环
		break
	}

	if lastErr != nil {
		log.Printf("更新产品使用记录失败: %v", lastErr)
		SendResponse(w, http.StatusInternalServerError, 500, "更新产品使用记录失败，请稍后重试", nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "更新产品使用记录成功", nil)
}

// GetProducts 获取产品列表接口
func GetProducts(w http.ResponseWriter, r *http.Request) {
	// 获取店铺ID
	storeID := r.URL.Query().Get("store_id")

	// 获取产品列表
	products, err := database.GetProducts(storeID)
	if err != nil {
		log.Printf("获取产品列表失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取产品列表失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "获取产品列表成功", products)
}

// GetCustomerRecords 获取客户所有记录接口
func GetCustomerRecords(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID和客户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少user_id参数", nil)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的user_id参数", nil)
		return
	}

	customerIDStr := r.URL.Query().Get("customer_id")
	if customerIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少customer_id参数", nil)
		return
	}

	customerID, err := strconv.Atoi(customerIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的customer_id参数", nil)
		return
	}

	// 获取分页参数
	page := 1
	pageSize := 20

	pageStr := r.URL.Query().Get("page")
	if pageStr != "" {
		page, err = strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}
	}

	pageSizeStr := r.URL.Query().Get("page_size")
	if pageSizeStr != "" {
		pageSize, err = strconv.Atoi(pageSizeStr)
		if err != nil || pageSize < 1 {
			pageSize = 20
		}
		if pageSize > 100 {
			pageSize = 100 // 限制最大页面大小
		}
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(userID, customerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 获取所有记录
	records, err := database.GetCustomerRecords(customerID, page, pageSize)
	if err != nil {
		log.Printf("获取客户记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户记录失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "获取客户记录成功", records)
}

// ExportCustomerReport 导出客户报表接口
func ExportCustomerReport(w http.ResponseWriter, r *http.Request) {
	// 获取用户ID和客户ID
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少user_id参数", nil)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的user_id参数", nil)
		return
	}

	customerIDStr := r.URL.Query().Get("customer_id")
	if customerIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少customer_id参数", nil)
		return
	}

	customerID, err := strconv.Atoi(customerIDStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的customer_id参数", nil)
		return
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(userID, customerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 导出报表
	reportURL, err := database.ExportCustomerReport(customerID)
	if err != nil {
		log.Printf("导出客户报表失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("导出客户报表失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "导出客户报表成功", map[string]interface{}{
		"url": reportURL,
	})
}

// DownloadReport 下载报告文件
func DownloadReport(w http.ResponseWriter, r *http.Request) {
	// 从URL中获取文件名
	vars := mux.Vars(r)
	filename := vars["filename"]

	if filename == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少文件名参数", nil)
		return
	}

	// 文件路径
	filePath := fmt.Sprintf("./data/reports/%s", filename)

	// 检查文件是否存在
	_, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		SendResponse(w, http.StatusNotFound, 404, "报告文件不存在", nil)
		return
	}

	// 打开文件
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("打开报告文件失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "打开报告文件失败", nil)
		return
	}
	defer file.Close()

	// 设置响应头，指定内容类型和下载文件名
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// 将文件内容写入响应
	_, err = io.Copy(w, file)
	if err != nil {
		log.Printf("写入响应失败: %v", err)
	}
}

// DeleteWeightRecord 删除体重记录接口
func DeleteWeightRecord(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var requestData struct {
		UserID   int `json:"user_id"`
		RecordID int `json:"record_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		log.Printf("解析请求体失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 校验数据
	if requestData.UserID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	if requestData.RecordID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的记录ID", nil)
		return
	}

	// 获取体重记录信息
	record, err := database.GetWeightRecordByID(requestData.RecordID)
	if err != nil {
		log.Printf("获取体重记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取体重记录失败: %v", err), nil)
		return
	}

	// 检查用户是否有权限删除该记录
	_, err = database.GetCustomerByID(requestData.UserID, record.CustomerID)
	if err != nil {
		log.Printf("权限验证失败: %v", err)
		SendResponse(w, http.StatusForbidden, 403, "无权删除此记录", nil)
		return
	}

	// 删除体重记录
	err = database.DeleteWeightRecord(requestData.RecordID)
	if err != nil {
		log.Printf("删除体重记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("删除体重记录失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "删除体重记录成功", nil)
}

// DeleteProductUsage 删除产品使用记录接口
func DeleteProductUsage(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var requestData struct {
		UserID  int `json:"user_id"`
		UsageID int `json:"usage_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		log.Printf("解析请求体失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 校验数据
	if requestData.UserID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	if requestData.UsageID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的记录ID", nil)
		return
	}

	// 获取产品使用记录
	var customerID int
	err = database.DB.QueryRow("SELECT customer_id FROM product_usages WHERE id = ?", requestData.UsageID).Scan(&customerID)
	if err != nil {
		log.Printf("获取产品使用记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取产品使用记录失败", nil)
		return
	}

	// 检查用户是否有权限访问该客户
	_, err = database.GetCustomerByID(requestData.UserID, customerID)
	if err != nil {
		log.Printf("获取客户信息失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("获取客户信息失败: %v", err), nil)
		return
	}

	// 删除产品使用记录（添加重试逻辑）
	// 重试次数和延迟设置
	maxRetries := 3
	retryDelay := 100 * time.Millisecond

	var lastErr error
	for i := 0; i < maxRetries; i++ {
		_, err = database.DB.Exec("DELETE FROM product_usages WHERE id = ?", requestData.UsageID)

		if err == nil {
			// 删除成功
			break
		}

		lastErr = err

		// 检查是否是数据库锁定错误
		if strings.Contains(err.Error(), "database is locked") ||
			strings.Contains(err.Error(), "SQLITE_BUSY") {
			log.Printf("数据库锁定，重试删除产品使用记录 (尝试 %d/%d): %v", i+1, maxRetries, err)

			// 增加随机延迟，避免多个客户端同时重试造成持续冲突
			jitter := time.Duration(rand.Intn(50)) * time.Millisecond
			time.Sleep(retryDelay + jitter)

			// 指数退避
			retryDelay *= 2
			continue
		}

		// 如果不是数据库锁定错误，直接退出重试循环
		break
	}

	if lastErr != nil {
		log.Printf("删除产品使用记录失败: %v", lastErr)
		SendResponse(w, http.StatusInternalServerError, 500, "删除产品使用记录失败，请稍后重试", nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "删除产品使用记录成功", nil)
}
