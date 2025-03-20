package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
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
		UserID     int     `json:"user_id"`
		CustomerID int     `json:"customer_id"`
		ProductID  int     `json:"product_id"`
		UsageDate  string  `json:"usage_date"`
		Quantity   float64 `json:"quantity"`
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

	if requestData.ProductID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的产品ID", nil)
		return
	}

	if requestData.Quantity <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的使用数量", nil)
		return
	}

	_, err = time.Parse("2006-01-02", requestData.UsageDate)
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

	// 添加产品使用记录
	usage := &models.ProductUsage{
		CustomerID: requestData.CustomerID,
		ProductID:  requestData.ProductID,
		UsageDate:  requestData.UsageDate,
		Quantity:   requestData.Quantity,
		Notes:      requestData.Notes,
		CreatedAt:  time.Now(),
	}

	usageID, err := database.AddProductUsage(usage)
	if err != nil {
		log.Printf("添加产品使用记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, fmt.Sprintf("添加产品使用记录失败: %v", err), nil)
		return
	}

	// 返回响应
	SendResponse(w, http.StatusOK, 200, "添加产品使用记录成功", map[string]interface{}{
		"usage_id": usageID,
	})
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
