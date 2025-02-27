package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
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

// DeleteStore 处理删除店铺请求
func (h *StoreHandler) DeleteStore(w http.ResponseWriter, r *http.Request) {
	// 添加CORS头
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	
	// 处理OPTIONS请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	// 权限验证
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未授权访问", nil)
		return
	}

	userIDInt, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	// 验证是否为管理员
	isAdmin, err := database.IsUserAdmin(userIDInt)
	if err != nil {
		log.Printf("验证管理员权限失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "服务器错误", nil)
		return
	}

	if !isAdmin {
		SendResponse(w, http.StatusForbidden, 403, "您没有权限删除店铺", nil)
		return
	}

	// 解析请求体
	var req struct {
		StoreID int64 `json:"store_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("解析删除店铺请求失败: %v", err)
		
		// 打印请求体内容以便调试
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewBuffer(body)) // 重新设置请求体
		log.Printf("原始请求体: %s", string(body))
		
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 输出更多的调试信息
	log.Printf("收到店铺删除请求，StoreID: %d", req.StoreID)

	if req.StoreID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "无效的店铺ID", nil)
		return
	}

	// 打印删除日志
	log.Printf("用户 %d 尝试删除店铺 %d", userIDInt, req.StoreID)

	// 验证店铺是否存在
	exists, err := database.CheckStoreExists(req.StoreID)
	if err != nil {
		log.Printf("检查店铺存在性失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "服务器错误", nil)
		return
	}

	if !exists {
		SendResponse(w, http.StatusNotFound, 404, "店铺不存在", nil)
		return
	}

	// 检查是否有关联账务记录
	hasAccounts, err := database.CheckStoreHasAccounts(req.StoreID)
	if err != nil {
		log.Printf("检查店铺关联账务记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "服务器错误", nil)
		return
	}

	if hasAccounts {
		SendResponse(w, http.StatusBadRequest, 400, "该店铺有关联的账务记录，无法删除", nil)
		return
	}

	// 执行删除操作
	if err := database.DeleteStore(req.StoreID); err != nil {
		log.Printf("删除店铺失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "删除店铺失败: "+err.Error(), nil)
		return
	}

	// 删除成功
	log.Printf("店铺 %d 已被用户 %d 成功删除", req.StoreID, userIDInt)
	SendResponse(w, http.StatusOK, 200, "删除成功", nil)
} 