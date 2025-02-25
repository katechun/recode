package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"account/backend/database"
	"account/backend/models"
)

// StoreHandler 处理店铺相关请求
type StoreHandler struct{}

// 获取用户可访问的店铺
func (h *StoreHandler) GetUserStores(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
		return
	}

	// 从请求中获取用户ID
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = r.Header.Get("X-User-ID")
	}

	if userID == "" {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID不能为空", nil)
		return
	}

	// 转换userID为整数
	userIDInt, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID格式错误", nil)
		return
	}

	// 调用数据库获取用户可访问的店铺
	stores, err := database.GetUserStores(userIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "获取店铺失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "获取店铺成功", stores)
}

// CreateStore 创建新店铺
func (h *StoreHandler) CreateStore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	// 验证权限
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未授权访问", nil)
		return
	}

	userIDInt, _ := strconv.ParseInt(userID, 10, 64)
	isAdmin, err := database.IsUserAdmin(userIDInt)
	if err != nil || !isAdmin {
		SendResponse(w, http.StatusForbidden, 403, "无权限执行此操作", nil)
		return
	}

	// 解析请求数据
	var store models.Store
	if err := json.NewDecoder(r.Body).Decode(&store); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if store.Name == "" {
		SendResponse(w, http.StatusBadRequest, 400, "店铺名称不能为空", nil)
		return
	}

	// 创建店铺
	id, err := database.CreateStore(store)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "创建店铺失败: "+err.Error(), nil)
		return
	}

	store.ID = id
	SendResponse(w, http.StatusOK, 200, "创建店铺成功", store)
}

// UpdateStore 更新店铺信息
func (h *StoreHandler) UpdateStore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "仅支持PUT请求", http.StatusMethodNotAllowed)
		return
	}

	// 验证权限
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未授权访问", nil)
		return
	}

	userIDInt, _ := strconv.ParseInt(userID, 10, 64)
	isAdmin, err := database.IsUserAdmin(userIDInt)
	if err != nil || !isAdmin {
		SendResponse(w, http.StatusForbidden, 403, "无权限执行此操作", nil)
		return
	}

	// 解析请求数据
	var store models.Store
	if err := json.NewDecoder(r.Body).Decode(&store); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if store.ID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "店铺ID无效", nil)
		return
	}
	if store.Name == "" {
		SendResponse(w, http.StatusBadRequest, 400, "店铺名称不能为空", nil)
		return
	}

	// 更新店铺
	err = database.UpdateStore(store)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "更新店铺失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "更新店铺成功", store)
}

// DeleteStore 删除店铺
func (h *StoreHandler) DeleteStore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "仅支持DELETE请求", http.StatusMethodNotAllowed)
		return
	}

	// 验证权限
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未授权访问", nil)
		return
	}

	userIDInt, _ := strconv.ParseInt(userID, 10, 64)
	isAdmin, err := database.IsUserAdmin(userIDInt)
	if err != nil || !isAdmin {
		SendResponse(w, http.StatusForbidden, 403, "无权限执行此操作", nil)
		return
	}

	// 获取店铺ID
	storeID := r.URL.Query().Get("id")
	if storeID == "" {
		SendResponse(w, http.StatusBadRequest, 400, "店铺ID不能为空", nil)
		return
	}

	storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "店铺ID格式错误", nil)
		return
	}

	// 检查是否有关联的账务记录
	hasAccounts, err := database.HasStoreAccounts(storeIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "检查店铺账务记录失败: "+err.Error(), nil)
		return
	}

	if hasAccounts {
		SendResponse(w, http.StatusBadRequest, 400, "该店铺存在账务记录，无法删除", nil)
		return
	}

	// 删除店铺
	err = database.DeleteStore(storeIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "删除店铺失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "删除店铺成功", nil)
} 