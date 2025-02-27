package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"account/backend/database"
	"account/backend/models"
	"account/backend/services"
)

// UserHandler 处理用户相关请求
type UserHandler struct {
	userService services.UserService
}

// 登录请求结构
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// 响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// SendResponse 发送响应
func SendResponse(w http.ResponseWriter, httpStatus, code int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	resp := Response{
		Code:    code,
		Message: message,
		Data:    data,
	}

	json.NewEncoder(w).Encode(resp)
}

// Login 处理用户登录请求
func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	// 添加详细的请求日志
	log.Printf("收到登录请求: Method=%s, RemoteAddr=%s, ContentType=%s, ContentLength=%d", 
		r.Method, r.RemoteAddr, r.Header.Get("Content-Type"), r.ContentLength)
	
	// 设置CORS头
	w.Header().Set("Access-Control-Allow-Origin", "*") 
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
	
	// 处理OPTIONS预检请求
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	// 打印请求体内容以便调试
	body, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewBuffer(body)) // 重新设置请求体，因为读取后需要重置
	log.Printf("登录请求体: %s", string(body))

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("解析登录请求失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "请求参数错误: "+err.Error(), nil)
		return
	}

	// 打印登录尝试信息
	log.Printf("登录尝试: 用户名=%s, 密码长度=%d", req.Username, len(req.Password))

	// 参数验证
	if req.Username == "" || req.Password == "" {
		SendResponse(w, http.StatusBadRequest, 400, "用户名和密码不能为空", nil)
		return
	}

	// 调用服务层进行登录验证
	user, err := h.userService.Login(req.Username, req.Password)
	if err != nil {
		SendResponse(w, http.StatusUnauthorized, 401, err.Error(), nil)
		return
	}

	// 更新最后登录时间
	_, err = database.DB.Exec("UPDATE users SET last_login = ? WHERE id = ?", time.Now(), user.ID)
	if err != nil {
		log.Printf("更新登录时间失败: %v", err)
		// 继续处理，不要因为这个错误中断登录流程
	}

	// 登录成功，返回用户信息
	SendResponse(w, http.StatusOK, 200, "登录成功", user)
}

// GetAllUsers 获取所有用户
func (h *UserHandler) GetAllUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
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

	// 获取所有用户
	users, err := database.GetAllUsers()
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "获取用户列表失败: "+err.Error(), nil)
		return
	}

	// 屏蔽密码字段
	for i := range users {
		users[i].Password = ""
	}

	SendResponse(w, http.StatusOK, 200, "获取用户列表成功", users)
}

// CreateUser 创建新用户
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
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
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if user.Username == "" {
		SendResponse(w, http.StatusBadRequest, 400, "用户名不能为空", nil)
		return
	}
	if user.Password == "" {
		SendResponse(w, http.StatusBadRequest, 400, "密码不能为空", nil)
		return
	}
	if user.Role < 1 || user.Role > 2 {
		SendResponse(w, http.StatusBadRequest, 400, "用户角色无效", nil)
		return
	}

	// 检查用户名是否已存在
	exists, err := database.CheckUserExists(user.Username)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "检查用户名失败: "+err.Error(), nil)
		return
	}
	if exists {
		SendResponse(w, http.StatusBadRequest, 400, "用户名已存在", nil)
		return
	}

	// 创建用户
	id, err := database.CreateUser(user)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "创建用户失败: "+err.Error(), nil)
		return
	}

	// 隐藏密码
	user.ID = id
	user.Password = ""

	SendResponse(w, http.StatusOK, 200, "创建用户成功", user)
}

// UpdateUser 更新用户信息
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
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
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if user.ID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID无效", nil)
		return
	}
	if user.Username == "" {
		SendResponse(w, http.StatusBadRequest, 400, "用户名不能为空", nil)
		return
	}

	// 更新用户
	err = database.UpdateUser(user)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "更新用户失败: "+err.Error(), nil)
		return
	}

	user.Password = "" // 不返回密码
	SendResponse(w, http.StatusOK, 200, "更新用户成功", user)
}

// DeleteUser 删除用户
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
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

	// 获取要删除的用户ID
	targetUserID := r.URL.Query().Get("id")
	if targetUserID == "" {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID不能为空", nil)
		return
	}

	targetUserIDInt, err := strconv.ParseInt(targetUserID, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID格式错误", nil)
		return
	}

	// 不能删除自己
	if targetUserIDInt == userIDInt {
		SendResponse(w, http.StatusBadRequest, 400, "不能删除当前登录的用户", nil)
		return
	}

	// 删除用户
	err = database.DeleteUser(targetUserIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "删除用户失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "删除用户成功", nil)
}

// ResetPassword 重置用户密码
func (h *UserHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
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
	var req struct {
		UserID      int64  `json:"user_id"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求数据格式错误", nil)
		return
	}

	// 验证数据
	if req.UserID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID无效", nil)
		return
	}
	if req.NewPassword == "" {
		SendResponse(w, http.StatusBadRequest, 400, "新密码不能为空", nil)
		return
	}

	// 重置密码
	err = database.ResetUserPassword(req.UserID, req.NewPassword)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "重置密码失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "重置密码成功", nil)
}

// GetUserStorePermissions 获取用户的店铺权限
func (h *UserHandler) GetUserStorePermissions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
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

	// 获取目标用户ID
	targetUserID := r.URL.Query().Get("user_id")
	if targetUserID == "" {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID不能为空", nil)
		return
	}

	targetUserIDInt, err := strconv.ParseInt(targetUserID, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID格式错误", nil)
		return
	}

	// 获取用户权限
	permissions, err := database.GetUserStorePermissions(targetUserIDInt)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "获取用户权限失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "获取用户权限成功", permissions)
}

// UpdateUserStorePermissions 更新用户的店铺权限
func (h *UserHandler) UpdateUserStorePermissions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	// 解析请求体
	var req struct {
		UserId    int64   `json:"user_id"`
		StoreIds  []int64 `json:"store_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
		return
	}

	// 更新权限
	err := database.UpdateUserStorePermissions(req.UserId, req.StoreIds)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "更新权限失败: "+err.Error(), nil)
		return
	}

	// 成功时返回
	SendResponse(w, http.StatusOK, 200, "权限更新成功", nil)
}
