package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// 报表数据结构
type ReportData struct {
	TotalIncome       float64        `json:"totalIncome"`
	TotalExpense      float64        `json:"totalExpense"`
	NetIncome         float64        `json:"netIncome"`
	Trend             []TrendData    `json:"trend"`
	Compare           []CompareData  `json:"compare"`
	IncomeCategories  []CategoryData `json:"incomeCategories"`
	ExpenseCategories []CategoryData `json:"expenseCategories"`
}

// 趋势数据结构
type TrendData struct {
	Date    string  `json:"date"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

// 对比数据结构
type CompareData struct {
	Category string  `json:"category"`
	Income   float64 `json:"income"`
	Expense  float64 `json:"expense"`
	Net      float64 `json:"net"`
}

// 分类数据结构
type CategoryData struct {
	ID     int64   `json:"id"`
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
}

// 获取报表数据
func GetReportData(startDate, endDate time.Time, storeId int64, userID int64) (ReportData, error) {
	var reportData ReportData

	// 检查用户是否是管理员
	var isAdmin bool
	err := DB.QueryRow("SELECT role = 1 FROM users WHERE id = ?", userID).Scan(&isAdmin)
	if err != nil {
		return reportData, fmt.Errorf("检查用户权限失败: %w", err)
	}

	// 记录查询使用的关键参数
	log.Printf("GetReportData - 用户ID: %d, 店铺ID: %d, 日期: %s 到 %s, 是否管理员: %v",
		userID, storeId, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), isAdmin)

	// 处理店铺权限
	if !isAdmin && storeId <= 0 {
		// 对于非管理员且未指定店铺，尝试获取第一个有权限的店铺
		row := DB.QueryRow(`
			SELECT store_id FROM user_store_permissions 
			WHERE user_id = ? LIMIT 1
		`, userID)

		err := row.Scan(&storeId)
		if err != nil {
			if err == sql.ErrNoRows {
				// 没有权限的店铺，返回空数据
				log.Printf("用户 %d 没有任何店铺权限", userID)
				return ReportData{}, nil
			}
			return reportData, fmt.Errorf("获取用户店铺权限失败: %w", err)
		}

		log.Printf("非管理员用户 %d 未指定店铺，自动选择第一个有权限的店铺ID: %d", userID, storeId)
	} else if !isAdmin && storeId > 0 {
		// 非管理员指定了店铺，检查是否有权限
		var hasPermission bool
		err := DB.QueryRow(`
			SELECT EXISTS (
				SELECT 1 FROM user_store_permissions
				WHERE user_id = ? AND store_id = ?
			)
		`, userID, storeId).Scan(&hasPermission)

		if err != nil {
			return reportData, fmt.Errorf("检查店铺权限失败: %w", err)
		}

		if !hasPermission {
			log.Printf("用户 %d 无权访问店铺 %d", userID, storeId)
			return reportData, fmt.Errorf("用户无权访问此店铺")
		}
	}

	// 如果此时仍然没有有效的店铺ID，返回空数据
	if storeId <= 0 && !isAdmin {
		log.Printf("用户 %d 没有指定有效的店铺ID", userID)
		return ReportData{}, nil
	}

	// 构建查询参数
	var args []interface{}
	var storeFilter string

	if storeId > 0 {
		storeFilter = " AND a.store_id = ?"
		args = append(args, storeId)
	}

	// 获取总计数据
	reportData.TotalIncome, reportData.TotalExpense, reportData.NetIncome, err = getTotalAmounts(startDate, endDate, storeId, storeFilter, args)
	if err != nil {
		return reportData, fmt.Errorf("获取总计数据失败: %w", err)
	}

	// 获取趋势数据
	reportData.Trend, err = getTrendData(startDate, endDate, storeId, storeFilter, args)
	if err != nil {
		return reportData, fmt.Errorf("获取趋势数据失败: %w", err)
	}

	// 获取分类对比数据
	reportData.Compare, err = getCompareData(startDate, endDate, storeId)
	if err != nil {
		return reportData, fmt.Errorf("获取分类对比数据失败: %w", err)
	}

	// 获取收入分类数据
	reportData.IncomeCategories, err = getCategoryData(startDate, endDate, storeId, true)
	if err != nil {
		return reportData, fmt.Errorf("获取收入分类数据失败: %w", err)
	}

	// 获取支出分类数据
	reportData.ExpenseCategories, err = getCategoryData(startDate, endDate, storeId, false)
	if err != nil {
		return reportData, fmt.Errorf("获取支出分类数据失败: %w", err)
	}

	return reportData, nil
}

// 获取总收入和总支出
func getTotalAmounts(startDate, endDate time.Time, storeId int64, storeFilter string, args []interface{}) (float64, float64, float64, error) {
	// 复制args以避免修改原始切片
	queryArgs := make([]interface{}, len(args))
	copy(queryArgs, args)

	// 添加日期参数
	query := `
		SELECT 
			COALESCE(SUM(CASE WHEN a.amount > 0 THEN a.amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN a.amount < 0 THEN ABS(a.amount) ELSE 0 END), 0) as expense,
			COALESCE(SUM(a.amount), 0) as net
		FROM accounts a
		WHERE a.transaction_time BETWEEN ? AND ?
	` + storeFilter

	queryArgs = append([]interface{}{startDate, endDate}, queryArgs...)

	var income, expense, net float64
	err := DB.QueryRow(query, queryArgs...).Scan(&income, &expense, &net)

	return income, expense, net, err
}

// 获取趋势数据
func getTrendData(startDate, endDate time.Time, storeId int64, storeFilter string, args []interface{}) ([]TrendData, error) {
	var trendData []TrendData

	// 复制args以避免修改原始切片
	queryArgs := make([]interface{}, len(args))
	copy(queryArgs, args)

	// 将时间戳参数转换为字符串格式
	startDateStr := startDate.Format("2006-01-02 15:04:05")
	endDateStr := endDate.Format("2006-01-02 15:04:05")

	// 修改SQL查询，先添加日期条件，然后再添加其他条件
	query := `
		SELECT 
			SUBSTR(a.transaction_time, 1, 10) as date,
			SUM(CASE WHEN a.amount >= 0 THEN a.amount ELSE 0 END) as income,
			SUM(CASE WHEN a.amount < 0 THEN a.amount ELSE 0 END) as expense,
			SUM(a.amount) as net
		FROM accounts a
		WHERE a.transaction_time BETWEEN ? AND ?
	`

	// 先准备日期参数
	queryArgs = append([]interface{}{startDateStr, endDateStr}, queryArgs...)

	// 如果有存储过滤条件，则添加
	if storeFilter != "" {
		query += storeFilter
	}

	// 按日期分组
	query += " GROUP BY SUBSTR(a.transaction_time, 1, 10) ORDER BY date"

	// 执行查询
	rows, err := DB.Query(query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("查询趋势数据失败: %w", err)
	}
	defer rows.Close()

	// 处理结果集
	for rows.Next() {
		var item TrendData
		err := rows.Scan(&item.Date, &item.Income, &item.Expense, &item.Net)
		if err != nil {
			return nil, fmt.Errorf("读取趋势数据失败: %w", err)
		}
		trendData = append(trendData, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("处理趋势数据失败: %w", err)
	}

	return trendData, nil
}

// 获取分类对比数据
func getCompareData(startDate, endDate time.Time, storeId int64) ([]CompareData, error) {
	var compareData []CompareData

	// 将时间戳参数转换为字符串格式
	startDateStr := startDate.Format("2006-01-02 15:04:05")
	endDateStr := endDate.Format("2006-01-02 15:04:05")

	// 构建查询字符串
	query := `
		SELECT 
			COALESCE(t.name, '未分类') as category,
			SUM(CASE WHEN a.amount >= 0 THEN a.amount ELSE 0 END) as income,
			SUM(CASE WHEN a.amount < 0 THEN a.amount ELSE 0 END) as expense,
			SUM(a.amount) as net
		FROM accounts a
		LEFT JOIN account_types t ON a.type_id = t.id
		WHERE a.transaction_time BETWEEN ? AND ?
	`

	// 准备参数
	args := []interface{}{startDateStr, endDateStr}

	// 添加店铺过滤条件
	if storeId > 0 {
		query += " AND a.store_id = ?"
		args = append(args, storeId)
	}

	// 按类别分组
	query += " GROUP BY t.name"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("查询分类对比数据失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item CompareData
		err := rows.Scan(&item.Category, &item.Income, &item.Expense, &item.Net)
		if err != nil {
			return nil, fmt.Errorf("读取分类对比数据失败: %w", err)
		}
		compareData = append(compareData, item)
	}

	return compareData, nil
}

// 获取分类数据
func getCategoryData(startDate, endDate time.Time, storeId int64, isIncome bool) ([]CategoryData, error) {
	var categoryData []CategoryData

	// SQL查询条件
	amountCondition := "a.amount < 0"
	if isIncome {
		amountCondition = "a.amount >= 0"
	}

	storeCondition := ""
	args := []interface{}{startDate, endDate}

	if storeId > 0 {
		storeCondition = " AND a.store_id = ?"
		args = append(args, storeId)
	}

	// 查询分类数据
	query := `
		SELECT 
			COALESCE(t.id, 0) as id,
			COALESCE(t.name, '未分类') as name,
			SUM(a.amount) as amount
		FROM accounts a
		LEFT JOIN account_types t ON a.type_id = t.id
		WHERE ` + amountCondition + `
		AND a.transaction_time BETWEEN ? AND ?` + storeCondition + `
		GROUP BY t.id
		ORDER BY ABS(amount) DESC`

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("查询分类数据失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item CategoryData
		err := rows.Scan(&item.ID, &item.Name, &item.Amount)
		if err != nil {
			return nil, fmt.Errorf("读取分类数据失败: %w", err)
		}
		categoryData = append(categoryData, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("处理分类数据失败: %w", err)
	}

	return categoryData, nil
}
