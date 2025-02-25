package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"account/backend/database"
	"account/backend/models"
)

// AccountHandler 处理账务相关请求
type AccountHandler struct{}

// 添加账务记录请求结构
type CreateAccountRequest struct {
	StoreID        int64   `json:"store_id"`
	TypeID         int64   `json:"type_id"`
	Amount         float64 `json:"amount"`
	Remark         string  `json:"remark"`
	TransactionTime string  `json:"transaction_time,omitempty"` // 可选，默认为当前时间
}

// 添加账务记录
func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	// 从请求中解析用户ID
	userIDStr := r.Header.Get("X-User-ID")
	if userIDStr == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未经授权的请求", nil)
		return
	}

	// 解析请求体
	var req CreateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "请求参数错误", nil)
		return
	}

	// 参数验证
	if req.StoreID <= 0 || req.TypeID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "店铺ID和账务类型ID不能为空", nil)
		return
	}

	// 处理交易时间
	var transactionTime time.Time
	if req.TransactionTime != "" {
		var err error
		transactionTime, err = time.Parse("2006-01-02 15:04:05", req.TransactionTime)
		if err != nil {
			SendResponse(w, http.StatusBadRequest, 400, "交易时间格式错误", nil)
			return
		}
	} else {
		transactionTime = time.Now()
	}

	// 创建账务记录
	account := &models.Account{
		StoreID:         req.StoreID,
		UserID:          userIDStr,
		TypeID:          req.TypeID,
		Amount:          req.Amount,
		Remark:          req.Remark,
		TransactionTime: transactionTime,
		CreateTime:      time.Now(),
		UpdateTime:      time.Now(),
	}

	// 保存到数据库
	id, err := database.CreateAccount(account)
	if err != nil {
		log.Printf("创建账务记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "创建账务记录失败", nil)
		return
	}

	account.ID = id
	SendResponse(w, http.StatusOK, 200, "创建账务记录成功", account)
}

// 获取账务记录列表
func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
		return
	}

	// 参数解析
	storeID := r.URL.Query().Get("store_id")
	typeID := r.URL.Query().Get("type_id")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	limit := r.URL.Query().Get("limit")

	// 调用数据库获取账务记录
	accounts, err := database.GetAccounts(storeID, typeID, startDate, endDate, limit)
	if err != nil {
		log.Printf("获取账务记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取账务记录失败", nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "获取账务记录成功", accounts)
}

// 获取账务统计
func (h *AccountHandler) Statistics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
		return
	}

	// 参数解析
	storeID := r.URL.Query().Get("store_id")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	// 调用数据库获取统计数据
	stats, err := database.GetAccountStatistics(storeID, startDate, endDate)
	if err != nil {
		log.Printf("获取账务统计失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取账务统计失败", nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "获取账务统计成功", stats)
} 