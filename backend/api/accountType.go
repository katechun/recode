package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"account/backend/database"
	"account/backend/models"
)

// AccountTypeHandler 处理账务类型相关请求
type AccountTypeHandler struct{}

// GetAll 获取所有账务类型
func (h *AccountTypeHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
		return
	}

	accountTypes, err := database.GetAllAccountTypes()
	if err != nil {
		log.Printf("获取账务类型失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取账务类型失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "获取账务类型成功", accountTypes)
}

// CreateAccountType 创建新账务类型
func (h *AccountTypeHandler) CreateAccountType(w http.ResponseWriter, r *http.Request) {
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
	var accountType models.AccountType
	if err := json.NewDecoder(r.Body).Decode(&accountType); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if accountType.Name == "" {
		SendResponse(w, http.StatusBadRequest, 400, "类型名称不能为空", nil)
		return
	}
	
	// 创建账务类型
	id, err := database.CreateAccountType(accountType)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "创建账务类型失败: "+err.Error(), nil)
		return
	}

	accountType.ID = id
	SendResponse(w, http.StatusOK, 200, "创建账务类型成功", accountType)
}

// UpdateAccountType 更新账务类型
func (h *AccountTypeHandler) UpdateAccountType(w http.ResponseWriter, r *http.Request) {
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
	var accountType models.AccountType
	if err := json.NewDecoder(r.Body).Decode(&accountType); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if accountType.ID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "账务类型ID无效", nil)
		return
	}
	if accountType.Name == "" {
		SendResponse(w, http.StatusBadRequest, 400, "类型名称不能为空", nil)
		return
	}

	// 更新账务类型
	err = database.UpdateAccountType(accountType)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "更新账务类型失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "更新账务类型成功", accountType)
}

// DeleteAccountType 删除账务类型
func (h *AccountTypeHandler) DeleteAccountType(w http.ResponseWriter, r *http.Request) {
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

	// 获取账务类型ID
	typeID := r.URL.Query().Get("id")
	if typeID == "" {
		SendResponse(w, http.StatusBadRequest, 400, "账务类型ID不能为空", nil)
		return
	}

	typeIDInt, err := strconv.ParseInt(typeID, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "账务类型ID格式错误", nil)
		return
	}

	// 检查是否有关联的账务记录
	hasAccounts, err := database.HasAccountTypeRecords(typeIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "检查账务类型记录失败: "+err.Error(), nil)
		return
	}

	if hasAccounts {
		SendResponse(w, http.StatusBadRequest, 400, "该账务类型已被使用，无法删除", nil)
		return
	}

	// 删除账务类型
	err = database.DeleteAccountType(typeIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "删除账务类型失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "删除账务类型成功", nil)
} 