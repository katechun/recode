package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"account/backend/database"
	"account/backend/models"

	"github.com/gorilla/mux"
)

// AccountHandler 处理账务相关请求
type AccountHandler struct{}

// 添加账务记录请求结构
type CreateAccountRequest struct {
	StoreID         int64   `json:"store_id"`
	TypeID          int64   `json:"type_id"`
	Amount          float64 `json:"amount"`
	Remark          string  `json:"remark"`
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
		log.Printf("解析请求体失败: %v", err)
		SendResponse(w, http.StatusBadRequest, 400, "请求参数错误", nil)
		return
	}

	// 参数验证
	if req.StoreID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "店铺ID无效", nil)
		return
	}

	if req.TypeID <= 0 {
		SendResponse(w, http.StatusBadRequest, 400, "账务类型ID无效", nil)
		return
	}

	// 转换用户ID
	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "用户ID格式错误", nil)
		return
	}

	// 处理日期格式转换
	layout := "2006-01-02 15:04"
	layoutWithSeconds := "2006-01-02 15:04:05"

	var formattedTime string

	// 尝试解析完整格式（带秒）
	_, err = time.Parse(layoutWithSeconds, req.TransactionTime)
	if err == nil {
		// 如果是完整格式，直接使用
		formattedTime = req.TransactionTime
	} else {
		// 尝试解析不带秒的格式
		t, err := time.Parse(layout, req.TransactionTime)
		if err == nil {
			// 转换为标准格式（带秒）
			formattedTime = t.Format(layoutWithSeconds)
		} else {
			// 尝试解析仅日期格式
			layoutDate := "2006-01-02"
			t, err = time.Parse(layoutDate, req.TransactionTime)
			if err == nil {
				// 添加默认时间 00:00:00
				formattedTime = t.Format(layoutWithSeconds)
			} else {
				// 格式无效
				SendResponse(w, http.StatusBadRequest, 400, "交易日期格式错误", nil)
				return
			}
		}
	}

	// 使用格式化后的日期时间
	account := &models.Account{
		StoreID:         req.StoreID,
		UserID:          userID,
		TypeID:          req.TypeID,
		Amount:          req.Amount,
		Remark:          req.Remark,
		TransactionTime: formattedTime,
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

func (h *AccountHandler) Test(w http.ResponseWriter, r *http.Request) {
	SendResponse(w, http.StatusOK, 200, "测试成功", "")
}

// 获取账务记录列表
func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
		return
	}

	// 获取查询参数
	storeID := r.URL.Query().Get("store_id")
	typeID := r.URL.Query().Get("type_id")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	limit := r.URL.Query().Get("limit")
	page := r.URL.Query().Get("page")
	minAmount := r.URL.Query().Get("min_amount")
	maxAmount := r.URL.Query().Get("max_amount")
	keyword := r.URL.Query().Get("keyword")

	// 从URL参数或Header中获取用户ID
	userIDStr := r.URL.Query().Get("userId")
	if userIDStr == "" {
		userIDStr = r.Header.Get("X-User-ID")
	}

	if userIDStr == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未经授权的请求", nil)
		return
	}

	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	// 增强店铺ID处理
	if storeID != "" {
		log.Printf("【API筛选调试】原始店铺ID: '%s', 类型: %T", storeID, storeID)

		// 尝试进一步清理店铺ID
		storeID = strings.TrimSpace(storeID)

		if storeID == "undefined" || storeID == "null" || storeID == "0" {
			log.Printf("【API筛选调试】店铺ID是特殊值(%s)，设为空", storeID)
			storeID = ""
		} else {
			// 验证是否是有效数字
			storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
			if err != nil {
				// 尝试浮点数解析
				floatVal, err := strconv.ParseFloat(storeID, 64)
				if err == nil {
					// 是浮点数，转为整数字符串
					if floatVal > 0 {
						storeID = strconv.FormatInt(int64(floatVal), 10)
						log.Printf("【API筛选调试】店铺ID是浮点数，转换为整数: %s", storeID)
					} else {
						log.Printf("【API筛选调试】店铺ID是非正浮点数(%s)，设为空", storeID)
						storeID = ""
					}
				} else {
					log.Printf("【API筛选调试】店铺ID不是有效数字(%s)，设为空", storeID)
					storeID = ""
				}
			} else if storeIDInt <= 0 {
				log.Printf("【API筛选调试】店铺ID是非正整数(%d)，设为空", storeIDInt)
				storeID = ""
			} else {
				// 确保是整数字符串格式
				storeID = strconv.FormatInt(storeIDInt, 10)
				log.Printf("【API筛选调试】店铺ID是有效整数，标准化为: %s", storeID)

				// 增加调试代码，测试数据库中是否有对应ID的店铺
				var storeName string
				storeErr := database.DB.QueryRow("SELECT name FROM stores WHERE id = ?", storeIDInt).Scan(&storeName)
				if storeErr != nil {
					log.Printf("【API筛选调试】查询store_id=%d的店铺失败: %v", storeIDInt, storeErr)
				} else {
					log.Printf("【API筛选调试】store_id=%d对应店铺名: %s", storeIDInt, storeName)
				}

				// 测试该店铺的账目数量
				var accountCount int
				countErr := database.DB.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = ?", storeIDInt).Scan(&accountCount)
				if countErr != nil {
					log.Printf("【API筛选调试】查询store_id=%d的账目数量失败: %v", storeIDInt, countErr)
				} else {
					log.Printf("【API筛选调试】store_id=%d的账目数量: %d", storeIDInt, accountCount)
				}
			}
		}

		log.Printf("【API筛选调试】处理后的店铺ID: '%s'", storeID)
	} else {
		log.Printf("【API筛选调试】店铺ID为空")
	}

	// 记录请求参数
	log.Printf("账务查询请求 - 用户ID: %d, 店铺ID: %s, 类型ID: %s, 开始日期: %s, 结束日期: %s, 关键词: %s, 最小金额: %s, 最大金额: %s",
		userID, storeID, typeID, startDate, endDate, keyword, minAmount, maxAmount)

	// 调用修改后的GetAccounts函数，传入所有参数
	accounts, limitInt, err := database.GetAccounts(
		fmt.Sprintf("%d", userID), // 转换为字符串
		storeID,
		typeID,
		keyword,
		startDate,
		endDate,
		minAmount,
		maxAmount,
		page,
		limit)
	if err != nil {
		log.Printf("获取账务记录失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取账务记录失败", nil)
		return
	}

	// 封装响应，包括总数信息
	response := map[string]interface{}{
		"data":  accounts,
		"total": len(accounts),
		"limit": limitInt,
	}

	SendResponse(w, http.StatusOK, 200, "获取账务记录成功", response)
}

// 获取账务统计
func (h *AccountHandler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "仅支持GET请求", http.StatusMethodNotAllowed)
		return
	}

	// 获取查询参数
	storeID := r.URL.Query().Get("store_id")
	typeID := r.URL.Query().Get("type_id")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	minAmount := r.URL.Query().Get("min_amount")
	maxAmount := r.URL.Query().Get("max_amount")

	// 从URL参数或Header中获取用户ID
	userIDStr := r.URL.Query().Get("userId")
	if userIDStr == "" {
		userIDStr = r.Header.Get("X-User-ID")
	}

	if userIDStr == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未经授权的请求", nil)
		return
	}

	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	// 增强店铺ID处理
	if storeID != "" {
		log.Printf("【统计API】原始店铺ID: '%s', 类型: %T", storeID, storeID)

		// 清理店铺ID
		storeID = strings.TrimSpace(storeID)

		if storeID == "undefined" || storeID == "null" || storeID == "0" {
			log.Printf("【统计API】店铺ID是特殊值(%s)，设为空", storeID)
			storeID = ""
		} else {
			// 验证是否是有效数字
			storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
			if err != nil {
				// 尝试浮点数解析
				floatVal, err := strconv.ParseFloat(storeID, 64)
				if err == nil {
					// 是浮点数，转为整数字符串
					if floatVal > 0 {
						storeID = strconv.FormatInt(int64(floatVal), 10)
						log.Printf("【统计API】店铺ID是浮点数，转换为整数: %s", storeID)
					} else {
						log.Printf("【统计API】店铺ID是非正浮点数(%s)，设为空", storeID)
						storeID = ""
					}
				} else {
					log.Printf("【统计API】店铺ID不是有效数字(%s)，设为空", storeID)
					storeID = ""
				}
			} else if storeIDInt <= 0 {
				log.Printf("【统计API】店铺ID是非正整数(%d)，设为空", storeIDInt)
				storeID = ""
			} else {
				// 确保是整数字符串格式
				storeID = strconv.FormatInt(storeIDInt, 10)
				log.Printf("【统计API】店铺ID是有效整数，标准化为: %s", storeID)
			}
		}

		log.Printf("【统计API】处理后的店铺ID: '%s'", storeID)
	}

	// 记录请求参数
	log.Printf("统计请求参数: storeID=%s, typeID=%s, startDate=%s, endDate=%s, minAmount=%s, maxAmount=%s",
		storeID, typeID, startDate, endDate, minAmount, maxAmount)

	// 调用GetAccountStatistics函数，传入所有筛选参数
	statistics, err := database.GetAccountStatistics(storeID, typeID, startDate, endDate, minAmount, maxAmount, userID)
	if err != nil {
		log.Printf("获取账务统计失败: %v", err)
		SendResponse(w, http.StatusInternalServerError, 500, "获取账务统计失败", nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "获取账务统计成功", statistics)
}

// DeleteAccount 删除指定ID的账目记录
func DeleteAccount(w http.ResponseWriter, r *http.Request) {
	// 检查是否是OPTIONS请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 获取URL参数中的ID
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的账目ID", nil)
		return
	}

	// 调用数据库函数删除账目
	err = database.DeleteAccount(id)
	if err != nil {
		// 如果是记录不存在
		if err == sql.ErrNoRows {
			SendResponse(w, http.StatusNotFound, 404, "账目不存在", nil)
			return
		}

		// 其他数据库错误
		SendResponse(w, http.StatusInternalServerError, 500, "删除账目失败: "+err.Error(), nil)
		return
	}

	// 删除成功
	SendResponse(w, http.StatusOK, 200, "账目删除成功", nil)
}

// DeleteAccountByQuery 通过查询参数删除账目
func DeleteAccountByQuery(w http.ResponseWriter, r *http.Request) {
	// 检查是否是OPTIONS请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 从查询参数获取ID
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "缺少账目ID参数", nil)
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的账目ID", nil)
		return
	}

	// 复用删除逻辑
	err = database.DeleteAccount(id)
	if err != nil {
		if err == sql.ErrNoRows {
			SendResponse(w, http.StatusNotFound, 404, "账目不存在", nil)
			return
		}

		SendResponse(w, http.StatusInternalServerError, 500, "删除账目失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "账目删除成功", nil)
}

// Statistics 获取账务统计数据
func (h *AccountHandler) Statistics(w http.ResponseWriter, r *http.Request) {
	// 检查是否是OPTIONS请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 获取查询参数
	storeID := r.URL.Query().Get("store_id")
	typeID := r.URL.Query().Get("type_id")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	minAmount := r.URL.Query().Get("min_amount")
	maxAmount := r.URL.Query().Get("max_amount")

	// 记录请求参数以便调试
	log.Printf("统计请求参数: storeID=%s, typeID=%s, startDate=%s, endDate=%s, minAmount=%s, maxAmount=%s",
		storeID, typeID, startDate, endDate, minAmount, maxAmount)

	// 增强店铺ID处理 - 与List函数保持一致
	if storeID != "" {
		log.Printf("【统计API调试】原始店铺ID: '%s', 类型: %T", storeID, storeID)

		// 尝试进一步清理店铺ID
		storeID = strings.TrimSpace(storeID)

		if storeID == "undefined" || storeID == "null" || storeID == "0" {
			log.Printf("【统计API调试】店铺ID是特殊值(%s)，设为空", storeID)
			storeID = ""
		} else {
			// 验证是否是有效数字
			storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
			if err != nil {
				// 尝试浮点数解析
				floatVal, err := strconv.ParseFloat(storeID, 64)
				if err == nil {
					// 是浮点数，转为整数字符串
					if floatVal > 0 {
						storeID = strconv.FormatInt(int64(floatVal), 10)
						log.Printf("【统计API调试】店铺ID是浮点数，转换为整数: %s", storeID)
					} else {
						log.Printf("【统计API调试】店铺ID是非正浮点数(%s)，设为空", storeID)
						storeID = ""
					}
				} else {
					log.Printf("【统计API调试】店铺ID不是有效数字(%s)，设为空", storeID)
					storeID = ""
				}
			} else if storeIDInt <= 0 {
				log.Printf("【统计API调试】店铺ID是非正整数(%d)，设为空", storeIDInt)
				storeID = ""
			} else {
				// 确保是整数字符串格式
				storeID = strconv.FormatInt(storeIDInt, 10)
				log.Printf("【统计API调试】店铺ID是有效整数，标准化为: %s", storeID)

				// 增加调试代码，测试数据库中是否有对应ID的店铺
				var storeName string
				storeErr := database.DB.QueryRow("SELECT name FROM stores WHERE id = ?", storeIDInt).Scan(&storeName)
				if storeErr != nil {
					log.Printf("【API筛选调试】查询store_id=%d的店铺失败: %v", storeIDInt, storeErr)
				} else {
					log.Printf("【API筛选调试】store_id=%d对应店铺名: %s", storeIDInt, storeName)
				}

				// 测试该店铺的账目数量
				var accountCount int
				countErr := database.DB.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = ?", storeIDInt).Scan(&accountCount)
				if countErr != nil {
					log.Printf("【API筛选调试】查询store_id=%d的账目数量失败: %v", storeIDInt, countErr)
				} else {
					log.Printf("【API筛选调试】store_id=%d的账目数量: %d", storeIDInt, accountCount)
				}
			}
		}

		log.Printf("【统计API调试】处理后的店铺ID: '%s'", storeID)
	} else {
		log.Printf("【统计API调试】店铺ID为空")
	}

	// 从URL参数或Header中获取用户ID
	userIDStr := r.URL.Query().Get("userId")
	if userIDStr == "" {
		userIDStr = r.Header.Get("X-User-ID")
	}

	if userIDStr == "" {
		SendResponse(w, http.StatusUnauthorized, 401, "未经授权的请求", nil)
		return
	}

	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
		return
	}

	// 调用数据库函数获取统计数据
	stats, err := database.GetAccountStatistics(storeID, typeID, startDate, endDate, minAmount, maxAmount, userID)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "获取统计数据失败: "+err.Error(), nil)
		return
	}

	SendResponse(w, http.StatusOK, 200, "成功", stats)
}
