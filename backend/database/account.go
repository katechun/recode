package database

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"account/backend/models"
)

// CreateAccount 创建账务记录
func CreateAccount(account *models.Account) (int64, error) {
	// 准备SQL语句
	query := `
		INSERT INTO accounts (store_id, user_id, type_id, amount, remark, transaction_time, create_time, update_time)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	// 确保有一个有效的交易日期时间
	var transactionTimeStr string

	// 检查并处理日期时间格式
	if account.TransactionTime == "" {
		// 如果未提供日期时间，使用当前时间的完整格式
		transactionTimeStr = time.Now().Format("2006-01-02 15:04:05")
	} else {
		// 尝试解析各种可能的日期时间格式
		formats := []string{
			"2006-01-02T15:04:05", // ISO格式
			"2006-01-02 15:04:05", // 标准格式
			"2006-01-02 15:04",    // 没有秒的格式
			"2006-01-02",          // 仅日期
			"2006/01/02 15:04:05", // 斜杠分隔的日期时间
			"2006/01/02",          // 斜杠分隔的日期
		}

		var t time.Time
		var err error

		// 尝试所有格式
		for _, format := range formats {
			t, err = time.Parse(format, account.TransactionTime)
			if err == nil {
				// 转换为标准格式
				transactionTimeStr = t.Format("2006-01-02 15:04:05")
				break
			}
		}

		// 如果所有格式都解析失败，使用当前时间
		if err != nil {
			log.Printf("无法解析交易时间 '%s', 使用当前时间", account.TransactionTime)
			transactionTimeStr = time.Now().Format("2006-01-02 15:04:05")
		}
	}

	// 执行查询
	result, err := DB.Exec(query,
		account.StoreID,
		account.UserID,
		account.TypeID,
		account.Amount,
		account.Remark,
		transactionTimeStr, // 使用格式化后的日期时间
		account.CreateTime,
		account.UpdateTime)

	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return id, nil
}

// GetAccountsEnhanced 增强版获取账目列表，提供更详细的错误处理和调试信息
func GetAccounts(userID, storeID, typeID, keyword, startDate, endDate, minAmount, maxAmount, page, limit string) ([]map[string]interface{}, int, error) {
	// 调试日志
	log.Printf("【调试】GetAccounts 输入参数: storeID=%s, typeID=%s, userID=%s", storeID, typeID, userID)

	// 查询语句基础部分
	query := `
		SELECT
			a.id, a.store_id, s.name as store_name, a.user_id, u.username,
			a.type_id, t.name as type_name, a.amount, a.remark, a.transaction_time,
			a.create_time, a.update_time
		FROM accounts a
		LEFT JOIN stores s ON a.store_id = s.id
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN account_types t ON a.type_id = t.id
		WHERE 1=1
	`

	// 基础查询参数
	args := []interface{}{}

	// 记录所有筛选条件
	conditions := []string{}

	// 用户权限过滤，确保只看到自己有权限的店铺数据
	userIDInt, _ := strconv.ParseInt(userID, 10, 64)
	if userIDInt <= 0 {
		log.Printf("无效的用户ID: %s", userID)
		return nil, 0, fmt.Errorf("无效的用户ID")
	}

	if userIDInt != 1 { // 1号用户(admin)可以看所有店铺
		// 检查用户是管理员还是普通职员
		var userRole int
		if err := DB.QueryRow("SELECT role FROM users WHERE id = ?", userIDInt).Scan(&userRole); err != nil {
			log.Printf("查询用户角色失败: %v", err)
			return nil, 0, fmt.Errorf("查询用户权限失败")
		}

		if userRole != 1 { // 不是管理员角色，需要过滤店铺权限
			query += `
				AND a.store_id IN (
					SELECT store_id FROM user_store_permissions
					WHERE user_id = ?
				)
			`
			args = append(args, userIDInt)
			conditions = append(conditions, fmt.Sprintf("用户ID=%d有权限的店铺", userIDInt))
		}
	}

	// 处理店铺筛选
	if storeID != "" && storeID != "0" {
		storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
		if err != nil {
			log.Printf("【店铺筛选调试】店铺ID不是有效数字: %v", err)
			// 尝试浮点数转换
			storeIDFloat, floatErr := strconv.ParseFloat(storeID, 64)
			if floatErr == nil {
				storeIDInt = int64(storeIDFloat)
				log.Printf("【店铺筛选调试】浮点数转换成功: %f -> %d", storeIDFloat, storeIDInt)
			}
		}

		if storeIDInt > 0 {
			log.Printf("【店铺筛选调试】店铺ID是有效数字: %d, 类型: %T", storeIDInt, storeIDInt)

			// 验证店铺是否存在
			var storeName string
			err := DB.QueryRow("SELECT name FROM stores WHERE id = ?", storeIDInt).Scan(&storeName)
			if err != nil {
				if err == sql.ErrNoRows {
					log.Printf("【店铺筛选调试】店铺ID=%d不存在", storeIDInt)
					return nil, 0, fmt.Errorf("店铺不存在")
				}
				log.Printf("【店铺筛选调试】查询店铺失败: %v", err)
			} else {
				log.Printf("【店铺筛选调试】店铺ID=%d对应店铺名称: %s", storeIDInt, storeName)

				// 检查是否有该店铺的账目
				var accountCount int
				err := DB.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = ?", storeIDInt).Scan(&accountCount)
				if err != nil {
					log.Printf("【店铺筛选调试】查询店铺账目数量失败: %v", err)
				} else {
					log.Printf("【店铺筛选调试】店铺ID=%d的账目数量: %d", storeIDInt, accountCount)
				}
			}

			// 直接在SQL中使用具体数值，避免参数化问题
			query += fmt.Sprintf(" AND a.store_id = %d", storeIDInt)

			// 不再使用参数化查询，以避免可能的类型转换问题
			// query += " AND a.store_id = ?"
			// args = append(args, storeIDInt)

			log.Printf("【店铺筛选调试】添加店铺筛选条件，SQL片段: 'AND a.store_id = %d'", storeIDInt)
			conditions = append(conditions, fmt.Sprintf("店铺ID=%d", storeIDInt))
		} else {
			log.Printf("【店铺筛选调试】店铺ID是0或负数或转换失败，将视为无效ID")
			storeID = "" // 无效ID按空处理
		}
	} else {
		log.Printf("【店铺筛选调试】未提供店铺ID筛选或ID为0，将返回所有店铺数据")
	}

	if typeID != "" && typeID != "0" {
		query += " AND a.type_id = ?"
		typeIDInt, err := strconv.ParseInt(typeID, 10, 64)
		if err != nil {
			log.Printf("无效的类型ID: %s, 错误: %v", typeID, err)
		} else {
			args = append(args, typeIDInt)
		}
	}

	if startDate != "" {
		query += " AND a.transaction_time >= ?"
		args = append(args, startDate+" 00:00:00")
	}

	if endDate != "" {
		query += " AND a.transaction_time <= ?"
		args = append(args, endDate+" 23:59:59")
	}

	// 处理金额范围筛选 - 使用绝对值比较
	if minAmount != "" {
		minAmountFloat, err := strconv.ParseFloat(minAmount, 64)
		if err == nil {
			query += " AND ABS(a.amount) >= ?"
			args = append(args, minAmountFloat)
		} else {
			log.Printf("无效的最小金额: %s, 错误: %v", minAmount, err)
		}
	}

	if maxAmount != "" {
		maxAmountFloat, err := strconv.ParseFloat(maxAmount, 64)
		if err == nil {
			query += " AND ABS(a.amount) <= ?"
			args = append(args, maxAmountFloat)
		} else {
			log.Printf("无效的最大金额: %s, 错误: %v", maxAmount, err)
		}
	}

	// 优化关键词搜索逻辑，尤其是金额搜索
	if keyword != "" {
		// 尝试将关键词转换为数字，用于精确匹配金额
		numericValue, err := strconv.ParseFloat(keyword, 64)

		if err == nil {
			// 如果是数字，添加金额精确匹配条件
			query += ` AND (
				a.remark LIKE ? OR 
				s.name LIKE ? OR 
				t.name LIKE ? OR 
				u.username LIKE ? OR
				ABS(a.amount) = ? OR  
				CAST(a.amount AS CHAR) LIKE ?
			)`
			searchTerm := "%" + keyword + "%"
			args = append(args, searchTerm, searchTerm, searchTerm, searchTerm, numericValue, searchTerm)
		} else {
			// 如果不是数字，使用常规搜索
			query += ` AND (
				a.remark LIKE ? OR 
				s.name LIKE ? OR 
				t.name LIKE ? OR 
				u.username LIKE ?
			)`
			searchTerm := "%" + keyword + "%"
			args = append(args, searchTerm, searchTerm, searchTerm, searchTerm)
		}
	}

	// 计算偏移量
	var offset int

	// 默认分页
	limitInt := 50 // 默认每页50条
	if limit != "" {
		parsedLimit, err := strconv.Atoi(limit)
		if err == nil && parsedLimit > 0 {
			limitInt = parsedLimit
		}
	}

	if page != "" {
		pageInt, err := strconv.Atoi(page)
		if err == nil && pageInt > 0 {
			offset = (pageInt - 1) * limitInt
		}
	}

	// 排序
	query += " ORDER BY a.transaction_time DESC"

	// 应用分页
	if limitInt > 0 {
		query += fmt.Sprintf(" LIMIT %d", limitInt)
		if offset > 0 {
			query += fmt.Sprintf(" OFFSET %d", offset)
		}
	}

	// 打印完整SQL语句用于调试
	logSql := query
	for _, arg := range args {
		logSql = strings.Replace(logSql, "?", fmt.Sprintf("'%v'", arg), 1)
	}
	log.Printf("执行SQL: %s", logSql)

	// 执行查询
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	accounts := []map[string]interface{}{}
	for rows.Next() {
		var id, storeID, typeID, userID int64
		var storeName, username, typeName, remark string
		var amount float64
		var transactionTime time.Time
		var createTime, updateTime time.Time

		err := rows.Scan(&id, &storeID, &storeName, &userID, &username, &typeID, &typeName, &amount, &remark, &transactionTime, &createTime, &updateTime)
		if err != nil {
			log.Printf("扫描账务记录失败: %v", err)
			continue
		}

		account := map[string]interface{}{
			"id":               id,
			"store_id":         storeID,
			"store_name":       storeName,
			"user_id":          userID,
			"username":         username,
			"type_id":          typeID,
			"type_name":        typeName,
			"amount":           amount,
			"remark":           remark,
			"transaction_time": transactionTime.Format("2006-01-02 15:04:05"),
			"create_time":      createTime.Format("2006-01-02 15:04:05"),
			"update_time":      updateTime.Format("2006-01-02 15:04:05"),
		}
		accounts = append(accounts, account)
	}

	// 打印查询结果中的店铺信息，用于调试
	if storeID != "" && storeID != "0" {
		log.Printf("【店铺筛选调试】筛选结果数量: %d", len(accounts))
		for i, account := range accounts {
			storeIDInResult := account["store_id"]
			storeNameInResult := account["store_name"]
			log.Printf("【店铺筛选调试】结果[%d]: 店铺ID=%v (类型: %T), 店铺名=%v",
				i, storeIDInResult, storeIDInResult, storeNameInResult)
		}
	}

	return accounts, limitInt, nil
}

// GetAccountStatistics 获取账务统计
func GetAccountStatistics(storeID, typeID, startDate, endDate, minAmount, maxAmount string, userID int64) (map[string]interface{}, error) {
	// 将userID转换为string，保持接口一致性
	userIDStr := fmt.Sprintf("%d", userID)

	// 调试日志
	log.Printf("统计请求参数: storeID=%s, typeID=%s, startDate=%s, endDate=%s, minAmount=%s, maxAmount=%s",
		storeID, typeID, startDate, endDate, minAmount, maxAmount)

	// 检查用户权限
	userIDInt, _ := strconv.ParseInt(userIDStr, 10, 64)
	// 检查用户是否是管理员
	var userRole int
	err := DB.QueryRow("SELECT role FROM users WHERE id = ?", userIDInt).Scan(&userRole)
	if err != nil {
		log.Printf("查询用户角色失败: %v", err)
		return nil, fmt.Errorf("查询用户权限失败")
	}

	isAdmin := (userRole == 1)

	query := `
		SELECT 
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
			COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expense,
			COALESCE(SUM(amount), 0) as net_amount
		FROM accounts
		WHERE 1=1
	`
	var args []interface{}

	// 普通店员需要添加权限过滤
	if !isAdmin {
		query += `
			AND (
				store_id IN (
					SELECT store_id FROM user_store_permissions 
					WHERE user_id = ?
				)
			)
		`
		args = append(args, userIDInt)
	}

	// 添加原有的筛选条件
	if storeID != "" && storeID != "0" {
		// 记录原始storeID值和类型
		log.Printf("统计查询 - 筛选店铺ID: '%s', 类型: %T", storeID, storeID)

		// 尝试转换为数字，验证是否为有效ID
		storeIDInt, err := strconv.ParseInt(storeID, 10, 64)
		if err != nil {
			log.Printf("统计查询 - 店铺ID不是有效数字: %v", err)
			// 尝试浮点数转换（前端可能传递浮点数形式）
			storeIDFloat, floatErr := strconv.ParseFloat(storeID, 64)
			if floatErr == nil {
				storeIDInt = int64(storeIDFloat)
				log.Printf("统计查询 - 浮点数转换成功: %f -> %d", storeIDFloat, storeIDInt)
			}
		}

		if storeIDInt > 0 {
			log.Printf("统计查询 - 店铺ID是有效数字: %d", storeIDInt)

			// 直接在SQL中使用具体数值，避免参数化问题
			query += fmt.Sprintf(" AND store_id = %d", storeIDInt)

			// 不再使用参数化查询，以避免可能的类型转换问题
			// query += " AND store_id = ?"
			// args = append(args, storeIDInt)

			log.Printf("统计查询 - 添加店铺筛选条件，SQL片段: 'AND store_id = %d'", storeIDInt)
		} else {
			log.Printf("统计查询 - 店铺ID是0或负数或转换失败，将视为无效ID")
			storeID = "" // 无效ID按空处理
		}
	}

	// 添加账务类型筛选
	if typeID != "" && typeID != "0" {
		// 记录原始typeID值
		log.Printf("统计查询 - 筛选类型ID: '%s'", typeID)

		// 直接使用字符串比较，保持与店铺ID筛选一致
		query += " AND type_id = ?"
		args = append(args, typeID)
		log.Printf("统计查询 - 使用字符串比较类型ID: %s", typeID)
	}

	if startDate != "" {
		query += " AND transaction_time >= ?"
		args = append(args, startDate+" 00:00:00")
	}

	if endDate != "" {
		query += " AND transaction_time <= ?"
		args = append(args, endDate+" 23:59:59")
	}

	// 添加金额范围筛选 - 使用绝对值比较
	if minAmount != "" {
		minAmountFloat, err := strconv.ParseFloat(minAmount, 64)
		if err == nil {
			query += " AND ABS(amount) >= ?"
			args = append(args, minAmountFloat)
		} else {
			log.Printf("统计查询 - 无效的最小金额: %s, 错误: %v", minAmount, err)
		}
	}

	if maxAmount != "" {
		maxAmountFloat, err := strconv.ParseFloat(maxAmount, 64)
		if err == nil {
			query += " AND ABS(amount) <= ?"
			args = append(args, maxAmountFloat)
		} else {
			log.Printf("统计查询 - 无效的最大金额: %s, 错误: %v", maxAmount, err)
		}
	}

	// 执行查询
	var totalIncome, totalExpense, netAmount float64
	logSql := query
	for _, arg := range args {
		logSql = strings.Replace(logSql, "?", fmt.Sprintf("'%v'", arg), 1)
	}
	log.Printf("执行统计SQL: %s", logSql)

	err = DB.QueryRow(query, args...).Scan(&totalIncome, &totalExpense, &netAmount)
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"total_income":  totalIncome,
		"total_expense": totalExpense,
		"net_amount":    netAmount,
	}

	return stats, nil
}

// DeleteAccount 从数据库中删除指定ID的账目
func DeleteAccount(id int) error {
	// 构建SQL语句
	query := "DELETE FROM accounts WHERE id = ?"

	// 执行删除操作
	result, err := DB.Exec(query, id)
	if err != nil {
		return err
	}

	// 检查是否有行被删除
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	// 如果没有行被删除，说明记录不存在
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}
