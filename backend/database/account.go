package database

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
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
		// 尝试解析前端提供的日期时间
		layout := "2006-01-02 15:04"
		layoutWithSeconds := "2006-01-02 15:04:05"

		// 先尝试完整格式（带秒）
		_, err := time.Parse(layoutWithSeconds, account.TransactionTime)
		if err == nil {
			// 如果是完整格式，直接使用
			transactionTimeStr = account.TransactionTime
		} else {
			// 尝试不带秒的格式
			t, err := time.Parse(layout, account.TransactionTime)
			if err == nil {
				// 转换为标准格式
				transactionTimeStr = t.Format(layoutWithSeconds)
			} else {
				// 尝试仅日期格式
				layoutDate := "2006-01-02"
				t, err = time.Parse(layoutDate, account.TransactionTime)
				if err == nil {
					// 添加默认时间 00:00:00
					transactionTimeStr = t.Format(layoutWithSeconds)
				} else {
					// 格式无效，使用当前时间
					transactionTimeStr = time.Now().Format(layoutWithSeconds)
				}
			}
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

// GetAccounts 获取账务记录列表
func GetAccounts(storeID, typeID, startDate, endDate, keyword, limitStr string) ([]map[string]interface{}, error) {
	query := `
		SELECT a.id, a.store_id, s.name as store_name, a.user_id, u.username, 
		a.type_id, t.name as type_name, a.amount, a.remark, a.transaction_time
		FROM accounts a
		LEFT JOIN stores s ON a.store_id = s.id
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN account_types t ON a.type_id = t.id
		WHERE 1=1
	`
	var args []interface{}

	// 添加筛选条件
	if storeID != "" {
		query += " AND a.store_id = ?"
		storeIDInt, _ := strconv.ParseInt(storeID, 10, 64)
		args = append(args, storeIDInt)
	}

	if typeID != "" {
		query += " AND a.type_id = ?"
		typeIDInt, _ := strconv.ParseInt(typeID, 10, 64)
		args = append(args, typeIDInt)
	}

	if startDate != "" {
		query += " AND a.transaction_time >= ?"
		args = append(args, startDate+" 00:00:00")
	}

	if endDate != "" {
		query += " AND a.transaction_time <= ?"
		args = append(args, endDate+" 23:59:59")
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

	// 排序
	query += " ORDER BY a.transaction_time DESC"

	// 限制条数
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err == nil && limit > 0 {
			query += fmt.Sprintf(" LIMIT %d", limit)
		}
	}

	// 执行查询
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []map[string]interface{}{}
	for rows.Next() {
		var id, storeID, typeID, userID int64
		var storeName, username, typeName, remark string
		var amount float64
		var transactionTime time.Time

		err := rows.Scan(&id, &storeID, &storeName, &userID, &username, &typeID, &typeName, &amount, &remark, &transactionTime)
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
		}
		accounts = append(accounts, account)
	}

	return accounts, nil
}

// GetAccountStatistics 获取账务统计
func GetAccountStatistics(storeID, startDate, endDate string) (map[string]interface{}, error) {
	query := `
		SELECT 
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
			COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expense,
			COALESCE(SUM(amount), 0) as net_amount
		FROM accounts
		WHERE 1=1
	`
	var args []interface{}

	// 添加筛选条件
	if storeID != "" {
		query += " AND store_id = ?"
		storeIDInt, _ := strconv.ParseInt(storeID, 10, 64)
		args = append(args, storeIDInt)
	}

	if startDate != "" {
		query += " AND transaction_time >= ?"
		args = append(args, startDate+" 00:00:00")
	}

	if endDate != "" {
		query += " AND transaction_time <= ?"
		args = append(args, endDate+" 23:59:59")
	}

	// 执行查询
	var totalIncome, totalExpense, netAmount float64
	log.Printf("执行SQL: %s, 参数: %v", query, args)
	err := DB.QueryRow(query, args...).Scan(&totalIncome, &totalExpense, &netAmount)
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
