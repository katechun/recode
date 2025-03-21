package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"account/backend/database"
	"account/backend/utils"
)

// 获取产品列表
func GetProductList(w http.ResponseWriter, r *http.Request) {
	// 解析请求参数
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "Missing user_id parameter")
		return
	}

	// 获取用户ID
	userIDInt, err := strconv.Atoi(userID)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "Invalid user_id parameter")
		return
	}

	// 检查用户是否是管理员
	isAdmin, err := database.IsUserAdmin(int64(userIDInt))
	if err != nil {
		log.Printf("Error checking user admin status: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to check user permissions")
		return
	}

	var products []map[string]interface{}

	if isAdmin {
		// 管理员可以看到所有产品
		products, err = database.GetAllProducts()
		if err != nil {
			log.Printf("Error getting all products: %v\n", err)
			utils.RespondWithError(w, http.StatusInternalServerError, "Failed to get products")
			return
		}
	} else {
		// 获取用户有权限的店铺ID列表
		storeIDs, err := database.GetStoreIDsForUser(userIDInt)
		if err != nil {
			log.Printf("Error getting user store permissions: %v\n", err)
			utils.RespondWithError(w, http.StatusInternalServerError, "Failed to get user store permissions")
			return
		}

		// 如果没有店铺权限，返回空列表
		if len(storeIDs) == 0 {
			utils.RespondWithJSON(w, http.StatusOK, 200, "Success", []interface{}{})
			return
		}

		// 构建店铺ID列表字符串
		storeIDsStr := make([]string, len(storeIDs))
		for i, id := range storeIDs {
			storeIDsStr[i] = strconv.Itoa(id.(int))
		}

		// 查询数据库获取产品列表
		products, err = database.GetProducts(strings.Join(storeIDsStr, ","))
		if err != nil {
			log.Printf("Error getting products: %v\n", err)
			utils.RespondWithError(w, http.StatusInternalServerError, "Failed to get products")
			return
		}
	}

	// 返回产品列表
	utils.RespondWithJSON(w, http.StatusOK, 200, "Success", products)
}

// 添加产品
func AddProduct(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var productReq struct {
		UserID      interface{} `json:"user_id"`
		Name        string      `json:"name"`
		Description string      `json:"description"`
		Price       float64     `json:"price"`
		Stock       int         `json:"stock"`
		StoreID     int         `json:"store_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&productReq)
	if err != nil {
		log.Printf("解析JSON错误: %v\n", err)
		utils.RespondWithError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	// 验证必填字段
	if productReq.UserID == nil || productReq.Name == "" || productReq.Price <= 0 {
		utils.RespondWithError(w, http.StatusBadRequest, "缺少必要的字段")
		return
	}

	// 获取用户ID
	var userID int
	switch v := productReq.UserID.(type) {
	case float64:
		userID = int(v)
	case int:
		userID = v
	case string:
		var err error
		userID, err = strconv.Atoi(v)
		if err != nil {
			utils.RespondWithError(w, http.StatusBadRequest, "无效的用户ID")
			return
		}
	default:
		utils.RespondWithError(w, http.StatusBadRequest, "无效的用户ID类型")
		return
	}

	// 检查用户权限
	if productReq.StoreID > 0 {
		hasPermission, err := database.UserHasStorePermission(userID, productReq.StoreID)
		if err != nil {
			log.Printf("Error checking user permission: %v\n", err)
			utils.RespondWithError(w, http.StatusInternalServerError, "Failed to check user permission")
			return
		}

		if !hasPermission {
			utils.RespondWithError(w, http.StatusForbidden, "No permission to add product to this store")
			return
		}
	}

	// 创建产品对象
	product := struct {
		Name        string
		Description string
		Price       float64
		Stock       int
		StoreID     int
	}{
		Name:        productReq.Name,
		Description: productReq.Description,
		Price:       productReq.Price,
		Stock:       productReq.Stock,
		StoreID:     productReq.StoreID,
	}

	// 保存到数据库
	productID, err := database.AddProduct(product)
	if err != nil {
		log.Printf("Error adding product: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to add product")
		return
	}

	// 返回成功信息
	utils.RespondWithJSON(w, http.StatusOK, 200, "Product added successfully", map[string]interface{}{
		"id": productID,
	})
}

// 删除产品
func DeleteProduct(w http.ResponseWriter, r *http.Request) {
	// 解析请求体
	var deleteReq struct {
		UserID    string `json:"user_id"`
		ProductID int    `json:"product_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&deleteReq)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// 验证必填字段
	if deleteReq.UserID == "" || deleteReq.ProductID <= 0 {
		utils.RespondWithError(w, http.StatusBadRequest, "Missing required fields")
		return
	}

	// 检查产品是否存在
	exists, err := database.ProductExists(deleteReq.ProductID)
	if err != nil {
		log.Printf("Error checking product existence: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to check product")
		return
	}

	if !exists {
		utils.RespondWithError(w, http.StatusNotFound, "Product not found")
		return
	}

	// 检查产品是否已被使用
	inUse, err := database.ProductInUse(deleteReq.ProductID)
	if err != nil {
		log.Printf("Error checking if product is in use: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to check product usage")
		return
	}

	if inUse {
		utils.RespondWithError(w, http.StatusBadRequest, "Cannot delete product that is in use")
		return
	}

	// 从数据库删除产品
	err = database.DeleteProduct(deleteReq.ProductID)
	if err != nil {
		log.Printf("Error deleting product: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to delete product")
		return
	}

	// 返回成功信息
	utils.RespondWithJSON(w, http.StatusOK, 200, "Product deleted successfully", nil)
}

// 获取客户的产品列表
func GetCustomerProducts(w http.ResponseWriter, r *http.Request) {
	// 解析请求参数
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "Missing user_id parameter")
		return
	}

	// 获取用户ID
	userIDInt, err := strconv.Atoi(userID)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "Invalid user_id parameter")
		return
	}

	// 获取用户有权限的店铺ID列表
	storeIDs, err := database.GetStoreIDsForUser(userIDInt)
	if err != nil {
		log.Printf("Error getting user store permissions: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to get user store permissions")
		return
	}

	// 如果没有店铺权限，返回空列表
	if len(storeIDs) == 0 {
		utils.RespondWithJSON(w, http.StatusOK, 200, "Success", []interface{}{})
		return
	}

	// 构建店铺ID列表字符串
	storeIDsStr := make([]string, len(storeIDs))
	for i, id := range storeIDs {
		storeIDsStr[i] = strconv.Itoa(id.(int))
	}

	// 查询数据库获取产品列表
	products, err := database.GetProducts(strings.Join(storeIDsStr, ","))
	if err != nil {
		log.Printf("Error getting products: %v\n", err)
		utils.RespondWithError(w, http.StatusInternalServerError, "Failed to get products")
		return
	}

	// 返回产品列表
	utils.RespondWithJSON(w, http.StatusOK, 200, "Success", products)
}
