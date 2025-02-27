package api

import (
    "encoding/json"
    "net/http"
    "strconv"
    "log"
    "account/backend/database"
)

// DefaultSettings 结构体使用数据库包中定义的
type SettingsHandler struct {}

// SaveDefaultSettings 保存默认设置
func (h *SettingsHandler) SaveDefaultSettings(w http.ResponseWriter, r *http.Request) {
    // 添加CORS头
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    
    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }
    
    if r.Method != http.MethodPost {
        http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
        return
    }

    // 获取用户ID
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

    // 解析请求体
    var settings database.DefaultSettings
    if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
        SendResponse(w, http.StatusBadRequest, 400, "无效的请求数据", nil)
        return
    }

    log.Printf("接收到默认设置保存请求: 用户ID=%d, 店铺ID=%d, 收入类型ID=%d, 支出类型ID=%d", 
        userIDInt, settings.StoreId, settings.IncomeTypeId, settings.ExpenseTypeId)

    // 保存到数据库
    err = database.SaveDefaultSettings(userIDInt, settings.StoreId, settings.IncomeTypeId, settings.ExpenseTypeId)
    if err != nil {
        log.Printf("保存默认设置失败: %v", err)
        SendResponse(w, http.StatusInternalServerError, 500, "保存设置失败: "+err.Error(), nil)
        return
    }

    log.Printf("成功保存用户 %d 的默认设置", userIDInt)
    SendResponse(w, http.StatusOK, 200, "保存成功", nil)
}

// GetDefaultSettings 获取默认设置
func (h *SettingsHandler) GetDefaultSettings(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
        return
    }

    // 获取用户ID
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

    // 从数据库获取设置
    settings, err := database.GetDefaultSettings(userIDInt)
    if err != nil {
        log.Printf("获取默认设置失败: %v", err)
        SendResponse(w, http.StatusInternalServerError, 500, "获取设置失败", nil)
        return
    }

    SendResponse(w, http.StatusOK, 200, "获取成功", settings)
} 