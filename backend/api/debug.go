package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"account/backend/database"
	"account/backend/models"
)

// CreateTestUsers 创建测试用户的调试接口
func CreateTestUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	log.Println("开始创建测试用户...")

	// 创建测试用户
	users := []models.User{
		{
			Username: "admin",
			Password: "admin123",
			Nickname: "管理员",
			Role:     1, // 管理员角色
		},
		{
			Username: "staff1",
			Password: "staff123",
			Nickname: "店员1",
			Role:     2, // 普通用户角色
		},
		{
			Username: "staff2",
			Password: "staff123",
			Nickname: "店员2",
			Role:     2, // 普通用户角色
		},
	}

	createdUsers := make([]string, 0)

	for _, user := range users {
		exists, _ := database.CheckUserExists(user.Username)
		if !exists {
			_, err := database.CreateUser(user)
			if err != nil {
				log.Printf("创建用户 %s 失败: %v", user.Username, err)
				continue
			}
			createdUsers = append(createdUsers, user.Username)
			log.Printf("已创建用户: %s", user.Username)
		} else {
			log.Printf("用户 %s 已存在", user.Username)
		}
	}

	SendResponse(w, http.StatusOK, 200, "创建测试用户操作完成", map[string]interface{}{
		"created": createdUsers,
	})
}

func DebugHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 获取数据库连接
	db := database.GetDB()

	// 查询所有账目
	rows, err := db.Query(`
		SELECT a.id, a.store_id, s.name as store_name, a.type_id, t.name as type_name, a.amount, a.remark 
		FROM accounts a
		JOIN stores s ON a.store_id = s.id
		JOIN account_types t ON a.type_id = t.id
		ORDER BY a.id ASC
	`)
	if err != nil {
		http.Error(w, "查询账目失败:"+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// 准备响应数据
	accounts := []map[string]interface{}{}
	for rows.Next() {
		var id, storeID, typeID int64
		var storeName, typeName, remark string
		var amount float64

		if err := rows.Scan(&id, &storeID, &storeName, &typeID, &typeName, &amount, &remark); err != nil {
			continue
		}

		accounts = append(accounts, map[string]interface{}{
			"id":         id,
			"store_id":   storeID,
			"store_name": storeName,
			"type_id":    typeID,
			"type_name":  typeName,
			"amount":     amount,
			"remark":     remark,
		})
	}

	// 查询所有店铺
	storeRows, err := db.Query("SELECT id, name FROM stores ORDER BY id ASC")
	if err != nil {
		http.Error(w, "查询店铺失败:"+err.Error(), http.StatusInternalServerError)
		return
	}
	defer storeRows.Close()

	stores := []map[string]interface{}{}
	for storeRows.Next() {
		var id int64
		var name string

		if err := storeRows.Scan(&id, &name); err != nil {
			continue
		}

		stores = append(stores, map[string]interface{}{
			"id":   id,
			"name": name,
		})
	}

	// 查询账目总数
	var totalAccounts int
	if err := db.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&totalAccounts); err != nil {
		log.Printf("查询账目总数失败: %v", err)
	}

	// 查询每个店铺的账目数量
	storeAccountsRows, err := db.Query(`
		SELECT s.id, s.name, COUNT(a.id) as count 
		FROM stores s
		LEFT JOIN accounts a ON s.id = a.store_id
		GROUP BY s.id
		ORDER BY s.id
	`)
	if err != nil {
		log.Printf("查询店铺账目数量失败: %v", err)
	} else {
		storeAccountsCounts := []map[string]interface{}{}
		for storeAccountsRows.Next() {
			var id int64
			var name string
			var count int

			if err := storeAccountsRows.Scan(&id, &name, &count); err != nil {
				continue
			}

			storeAccountsCounts = append(storeAccountsCounts, map[string]interface{}{
				"store_id":   id,
				"store_name": name,
				"count":      count,
			})
		}
		storeAccountsRows.Close()

		// 测试特别查询店铺ID=2的记录
		var storeId2Count int
		err := db.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = 2").Scan(&storeId2Count)
		if err != nil {
			log.Printf("查询店铺ID=2的账目失败: %v", err)
		}

		// 组合响应
		response := map[string]interface{}{
			"accounts":           accounts,
			"stores":             stores,
			"total_accounts":     totalAccounts,
			"store_accounts":     storeAccountsCounts,
			"store_id_2_count":   storeId2Count,
			"database_file_path": database.GetDBPath(),
		}

		// 设置响应头
		w.Header().Set("Content-Type", "application/json")

		// 格式化输出
		jsonData, err := json.MarshalIndent(response, "", "  ")
		if err != nil {
			http.Error(w, "格式化输出失败:"+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Write(jsonData)
	}
}

// ExecuteDebugQuery 执行调试查询
func ExecuteDebugQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		SendResponse(w, http.StatusMethodNotAllowed, 405, "仅支持POST和GET请求", nil)
		return
	}

	// 获取SQL查询语句，支持GET和POST
	var sql string
	var storeID string

	if r.Method == http.MethodPost {
		// 从POST请求体获取
		var requestData map[string]string
		if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
			SendResponse(w, http.StatusBadRequest, 400, "无法解析请求体:"+err.Error(), nil)
			return
		}
		sql = requestData["sql"]
		storeID = requestData["store_id"]
	} else {
		// 从GET参数获取
		sql = r.URL.Query().Get("sql")
		storeID = r.URL.Query().Get("store_id")
	}

	// 验证是否有SQL
	if sql == "" {
		// 如果没有SQL，但有店铺ID，执行默认查询
		if storeID != "" {
			storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
			if err != nil {
				SendResponse(w, http.StatusBadRequest, 400, "无效的店铺ID:"+err.Error(), nil)
				return
			}

			// 构建默认查询
			sql = `
				SELECT a.id, a.store_id, s.name as store_name, a.user_id, u.username, 
				       a.type_id, t.name as type_name, a.amount, a.remark, a.transaction_time
				FROM accounts a
				JOIN stores s ON a.store_id = s.id
				JOIN users u ON a.user_id = u.id
				JOIN account_types t ON a.type_id = t.id
				WHERE a.store_id = ?
				ORDER BY a.id ASC
			`

			// 执行参数化查询
			rows, err := database.DB.Query(sql, storeIDInt)
			if err != nil {
				SendResponse(w, http.StatusInternalServerError, 500, "执行查询失败:"+err.Error(), nil)
				return
			}
			defer rows.Close()

			// 获取列名
			columns, err := rows.Columns()
			if err != nil {
				SendResponse(w, http.StatusInternalServerError, 500, "获取列信息失败:"+err.Error(), nil)
				return
			}

			// 准备结果集
			results := []map[string]interface{}{}

			// 处理每一行
			for rows.Next() {
				// 创建用于存储扫描结果的值切片
				values := make([]interface{}, len(columns))
				valuePtrs := make([]interface{}, len(columns))

				for i := range columns {
					valuePtrs[i] = &values[i]
				}

				if err := rows.Scan(valuePtrs...); err != nil {
					SendResponse(w, http.StatusInternalServerError, 500, "扫描结果失败:"+err.Error(), nil)
					return
				}

				// 将结果转为map
				row := make(map[string]interface{})
				for i, colName := range columns {
					val := values[i]

					switch v := val.(type) {
					case []byte:
						row[colName] = string(v)
					default:
						row[colName] = v
					}
				}

				results = append(results, row)
			}

			// 返回结果
			SendResponse(w, http.StatusOK, 200, "查询成功", map[string]interface{}{
				"query":   "店铺ID=" + storeID + "的账目记录",
				"results": results,
				"count":   len(results),
			})
			return
		}

		SendResponse(w, http.StatusBadRequest, 400, "未提供SQL查询语句", nil)
		return
	}

	// 执行查询
	rows, err := database.DB.Query(sql)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "执行查询失败:"+err.Error(), nil)
		return
	}
	defer rows.Close()

	// 获取列名
	columns, err := rows.Columns()
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "获取列信息失败:"+err.Error(), nil)
		return
	}

	// 准备结果集
	results := []map[string]interface{}{}

	// 处理每一行
	for rows.Next() {
		// 创建用于存储扫描结果的值切片
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))

		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			SendResponse(w, http.StatusInternalServerError, 500, "扫描结果失败:"+err.Error(), nil)
			return
		}

		// 将结果转为map
		row := make(map[string]interface{})
		for i, colName := range columns {
			val := values[i]

			switch v := val.(type) {
			case []byte:
				row[colName] = string(v)
			default:
				row[colName] = v
			}
		}

		results = append(results, row)
	}

	// 返回结果
	SendResponse(w, http.StatusOK, 200, "查询成功", map[string]interface{}{
		"sql":     sql,
		"results": results,
		"count":   len(results),
	})
}

// TestStoreData 测试特定店铺ID的数据
func TestStoreData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		SendResponse(w, http.StatusMethodNotAllowed, 405, "仅支持GET请求", nil)
		return
	}

	// 从URL参数获取店铺ID
	storeIDStr := r.URL.Query().Get("store_id")
	if storeIDStr == "" {
		SendResponse(w, http.StatusBadRequest, 400, "未提供店铺ID", nil)
		return
	}

	// 尝试将店铺ID转换为整数
	storeID, err := strconv.ParseInt(storeIDStr, 10, 64)
	if err != nil {
		SendResponse(w, http.StatusBadRequest, 400, "无效的店铺ID: "+err.Error(), nil)
		return
	}

	// 获取DB连接
	db := database.GetDB()

	// 1. 检查店铺是否存在
	var storeName string
	err = db.QueryRow("SELECT name FROM stores WHERE id = ?", storeID).Scan(&storeName)
	if err != nil {
		if err == sql.ErrNoRows {
			SendResponse(w, http.StatusNotFound, 404, "店铺不存在", nil)
		} else {
			SendResponse(w, http.StatusInternalServerError, 500, "查询店铺失败: "+err.Error(), nil)
		}
		return
	}

	// 2. 查询该店铺的账目数量
	var accountCount int
	err = db.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = ?", storeID).Scan(&accountCount)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "查询账目数量失败: "+err.Error(), nil)
		return
	}

	// 3. 查询账目列表
	rows, err := db.Query(`
		SELECT a.id, a.store_id, s.name as store_name, a.amount, a.remark, a.transaction_time
		FROM accounts a
		JOIN stores s ON a.store_id = s.id
		WHERE a.store_id = ?
		ORDER BY a.transaction_time DESC
		LIMIT 10
	`, storeID)
	if err != nil {
		SendResponse(w, http.StatusInternalServerError, 500, "查询账目失败: "+err.Error(), nil)
		return
	}
	defer rows.Close()

	accounts := []map[string]interface{}{}
	for rows.Next() {
		var id, acctStoreID int64
		var acctStoreName, remark, transactionTime string
		var amount float64

		err := rows.Scan(&id, &acctStoreID, &acctStoreName, &amount, &remark, &transactionTime)
		if err != nil {
			continue
		}

		accounts = append(accounts, map[string]interface{}{
			"id":               id,
			"store_id":         acctStoreID,
			"store_name":       acctStoreName,
			"amount":           amount,
			"remark":           remark,
			"transaction_time": transactionTime,
		})
	}

	// 4. 构建响应
	response := map[string]interface{}{
		"store_id":      storeID,
		"store_name":    storeName,
		"account_count": accountCount,
		"accounts":      accounts,
	}

	// 5. 执行一次直接的SQL查询测试
	testQuery := fmt.Sprintf("SELECT COUNT(*) FROM accounts WHERE store_id = %d", storeID)
	var testCount int
	testErr := db.QueryRow(testQuery).Scan(&testCount)
	if testErr != nil {
		response["test_query_error"] = testErr.Error()
	} else {
		response["test_query_count"] = testCount
	}

	SendResponse(w, http.StatusOK, 200, "店铺测试数据", response)
}
