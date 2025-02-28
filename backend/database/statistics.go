package database

import (
	"fmt"
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
func GetReportData(startDate, endDate time.Time, storeId int64) (ReportData, error) {
	var reportData ReportData

	// 获取总计数据
	var err error
	reportData.TotalIncome, reportData.TotalExpense, err = getTotalAmounts(startDate, endDate, storeId)
	if err != nil {
		return reportData, err
	}
	reportData.NetIncome = reportData.TotalIncome + reportData.TotalExpense

	// 获取趋势数据
	reportData.Trend, err = getTrendData(startDate, endDate, storeId)
	if err != nil {
		return reportData, err
	}

	// 获取分类对比数据
	reportData.Compare, err = getCompareData(startDate, endDate, storeId)
	if err != nil {
		return reportData, err
	}

	// 获取收入分类数据
	reportData.IncomeCategories, err = getCategoryData(startDate, endDate, storeId, true)
	if err != nil {
		return reportData, err
	}

	// 获取支出分类数据
	reportData.ExpenseCategories, err = getCategoryData(startDate, endDate, storeId, false)
	if err != nil {
		return reportData, err
	}

	return reportData, nil
}

// 获取总收入和总支出
func getTotalAmounts(startDate, endDate time.Time, storeId int64) (float64, float64, error) {
	var totalIncome, totalExpense float64

	// SQL查询条件
	storeCondition := ""
	args := []interface{}{startDate, endDate}

	if storeId > 0 {
		storeCondition = " AND store_id = ?"
		args = append(args, storeId)
	}

	// 查询总收入
	incomeQuery := `
		SELECT COALESCE(SUM(amount), 0) 
		FROM accounts 
		WHERE amount >= 0 
		AND transaction_time BETWEEN ? AND ?` + storeCondition

	err := DB.QueryRow(incomeQuery, args...).Scan(&totalIncome)
	if err != nil {
		return 0, 0, fmt.Errorf("查询总收入失败: %w", err)
	}

	// 查询总支出
	expenseQuery := `
		SELECT COALESCE(SUM(amount), 0) 
		FROM accounts 
		WHERE amount < 0 
		AND transaction_time BETWEEN ? AND ?` + storeCondition

	err = DB.QueryRow(expenseQuery, args...).Scan(&totalExpense)
	if err != nil {
		return 0, 0, fmt.Errorf("查询总支出失败: %w", err)
	}

	return totalIncome, totalExpense, nil
}

// 获取趋势数据
func getTrendData(startDate, endDate time.Time, storeId int64) ([]TrendData, error) {
	var trendData []TrendData

	// 计算趋势图的时间分组
	timeFormat := "%Y-%m-%d" // 默认按天分组
	duration := endDate.Sub(startDate)

	if duration.Hours() <= 24 {
		timeFormat = "%Y-%m-%d %H" // 小于一天，按小时分组
	} else if duration.Hours() <= 24*7 {
		timeFormat = "%Y-%m-%d" // 一周内，按天分组
	} else if duration.Hours() <= 24*31*3 {
		timeFormat = "%Y-%m-%d" // 三个月内，按天分组
	} else {
		timeFormat = "%Y-%m" // 超过三个月，按月分组
	}

	// SQL查询条件
	storeCondition := ""
	args := []interface{}{startDate, endDate}

	if storeId > 0 {
		storeCondition = " AND store_id = ?"
		args = append(args, storeId)
	}

	// 查询趋势数据
	query := `
		SELECT 
			strftime('` + timeFormat + `', transaction_time) as date,
			SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) as income,
			SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense,
			SUM(amount) as net
		FROM accounts
		WHERE transaction_time BETWEEN ? AND ?` + storeCondition + `
		GROUP BY date
		ORDER BY date`

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("查询趋势数据失败: %w", err)
	}
	defer rows.Close()

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

	// SQL查询条件
	storeCondition := ""
	args := []interface{}{startDate, endDate}

	if storeId > 0 {
		storeCondition = " AND a.store_id = ?"
		args = append(args, storeId)
	}

	// 查询分类对比数据
	query := `
		SELECT 
			COALESCE(t.name, '未分类') as category,
			SUM(CASE WHEN a.amount >= 0 THEN a.amount ELSE 0 END) as income,
			SUM(CASE WHEN a.amount < 0 THEN a.amount ELSE 0 END) as expense,
			SUM(a.amount) as net
		FROM accounts a
		LEFT JOIN account_types t ON a.type_id = t.id
		WHERE a.transaction_time BETWEEN ? AND ?` + storeCondition + `
		GROUP BY t.id
		ORDER BY ABS(net) DESC
		LIMIT 10`

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

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("处理分类对比数据失败: %w", err)
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