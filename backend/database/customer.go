package database

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"account/backend/models"
)

// GetCustomers 获取客户列表
func GetCustomers(userID int, storeID string, name string, phone string, page int, pageSize int) ([]models.Customer, int, error) {
	// 查询参数
	var args []interface{}

	// 构建权限过滤SQL
	var permissionFilter string
	hasAllAccess, err := UserHasAllStoresAccess(userID)
	if err != nil {
		return nil, 0, fmt.Errorf("检查用户权限失败: %v", err)
	}

	if !hasAllAccess {
		// 普通用户只能看到自己有权限的店铺的客户
		storeIDs, err := GetStoreIDsForUser(userID)
		if err != nil {
			return nil, 0, fmt.Errorf("获取用户店铺权限失败: %v", err)
		}

		if len(storeIDs) == 0 {
			// 用户没有任何店铺权限，直接返回空结果
			return []models.Customer{}, 0, nil
		}

		// 构建IN子句
		placeholders := make([]string, len(storeIDs))
		for i := range storeIDs {
			placeholders[i] = "?"
		}
		permissionFilter = fmt.Sprintf(" AND store_id IN (%s)", strings.Join(placeholders, ","))
		args = append(args, storeIDs...)
	}

	// 构建查询条件
	whereClause := " WHERE 1=1" + permissionFilter

	// 处理店铺ID过滤
	if storeID != "" {
		whereClause += " AND store_id = ?"
		args = append(args, storeID)
	}

	// 处理姓名过滤
	if name != "" {
		whereClause += " AND name LIKE ?"
		args = append(args, "%"+name+"%")
	}

	// 处理电话过滤
	if phone != "" {
		whereClause += " AND phone LIKE ?"
		args = append(args, "%"+phone+"%")
	}

	// 获取总数
	var totalCount int
	countQuery := "SELECT COUNT(*) FROM customers" + whereClause
	err = DB.QueryRow(countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("获取客户总数失败: %v", err)
	}

	// 如果总数为0，直接返回
	if totalCount == 0 {
		return []models.Customer{}, 0, nil
	}

	// 计算偏移量
	offset := (page - 1) * pageSize

	// 构建最终查询
	query := "SELECT id, name, phone, gender, age, height, initial_weight, current_weight, target_weight, store_id, notes, created_at, updated_at FROM customers" + whereClause + " ORDER BY created_at DESC LIMIT ? OFFSET ?"

	// 添加分页参数
	args = append(args, pageSize, offset)

	// 执行查询
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("查询客户列表失败: %v", err)
	}
	defer rows.Close()

	var customers []models.Customer
	for rows.Next() {
		var customer models.Customer
		var createdAt, updatedAt time.Time
		err := rows.Scan(
			&customer.ID,
			&customer.Name,
			&customer.Phone,
			&customer.Gender,
			&customer.Age,
			&customer.Height,
			&customer.InitialWeight,
			&customer.CurrentWeight,
			&customer.TargetWeight,
			&customer.StoreID,
			&customer.Notes,
			&createdAt,
			&updatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("扫描客户数据失败: %v", err)
		}

		// 格式化时间
		customer.CreatedAt = createdAt
		customer.UpdatedAt = updatedAt

		// 获取店铺名称
		var storeName string
		err = DB.QueryRow("SELECT name FROM stores WHERE id = ?", customer.StoreID).Scan(&storeName)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("获取店铺名称失败: %v", err)
		}
		customer.StoreName = storeName

		customers = append(customers, customer)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("遍历客户结果集失败: %v", err)
	}

	return customers, totalCount, nil
}

// GetCustomerByID 根据ID获取客户
func GetCustomerByID(userID int, customerID int) (*models.Customer, error) {
	// 检查用户权限
	var customer models.Customer

	// 查询客户信息
	query := `
		SELECT c.id, c.name, c.phone, c.gender, c.age, c.height, c.initial_weight, 
		c.current_weight, c.target_weight, c.store_id, c.notes, c.created_at, c.updated_at,
		s.name as store_name
		FROM customers c
		LEFT JOIN stores s ON c.store_id = s.id
		WHERE c.id = ?
	`
	var createdAt, updatedAt time.Time
	err := DB.QueryRow(query, customerID).Scan(
		&customer.ID,
		&customer.Name,
		&customer.Phone,
		&customer.Gender,
		&customer.Age,
		&customer.Height,
		&customer.InitialWeight,
		&customer.CurrentWeight,
		&customer.TargetWeight,
		&customer.StoreID,
		&customer.Notes,
		&createdAt,
		&updatedAt,
		&customer.StoreName,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("客户不存在")
		}
		return nil, fmt.Errorf("查询客户信息失败: %v", err)
	}

	// 格式化时间
	customer.CreatedAt = createdAt
	customer.UpdatedAt = updatedAt

	// 检查用户是否有权限访问该客户所属的店铺
	hasPermission, err := UserHasStorePermission(userID, customer.StoreID)
	if err != nil {
		return nil, fmt.Errorf("检查用户权限失败: %v", err)
	}

	if !hasPermission {
		return nil, fmt.Errorf("无权访问该客户")
	}

	return &customer, nil
}

// CreateCustomer 创建客户
func CreateCustomer(customer *models.Customer) (int, error) {
	result, err := DB.Exec(`
		INSERT INTO customers (name, phone, gender, age, height, initial_weight, current_weight, target_weight, store_id, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		customer.Name,
		customer.Phone,
		customer.Gender,
		customer.Age,
		customer.Height,
		customer.InitialWeight,
		customer.CurrentWeight,
		customer.TargetWeight,
		customer.StoreID,
		customer.Notes,
		customer.CreatedAt,
		customer.UpdatedAt,
	)

	if err != nil {
		return 0, fmt.Errorf("插入客户记录失败: %v", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("获取新客户ID失败: %v", err)
	}

	return int(id), nil
}

// UpdateCustomer 更新客户信息
func UpdateCustomer(customer *models.Customer) error {
	_, err := DB.Exec(`
		UPDATE customers
		SET name = ?, phone = ?, gender = ?, age = ?, height = ?, 
		initial_weight = ?, current_weight = ?, target_weight = ?, 
		store_id = ?, notes = ?, updated_at = ?
		WHERE id = ?
	`,
		customer.Name,
		customer.Phone,
		customer.Gender,
		customer.Age,
		customer.Height,
		customer.InitialWeight,
		customer.CurrentWeight,
		customer.TargetWeight,
		customer.StoreID,
		customer.Notes,
		customer.UpdatedAt,
		customer.ID,
	)

	if err != nil {
		return fmt.Errorf("更新客户记录失败: %v", err)
	}

	return nil
}

// DeleteCustomer 删除客户
func DeleteCustomer(customerID int) error {
	// 开始事务
	tx, err := DB.Begin()
	if err != nil {
		return err
	}

	// 确保事务最终被提交或回滚
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p) // 重新抛出panic
		}
	}()

	// 删除客户的体重记录
	_, err = tx.Exec("DELETE FROM weight_records WHERE customer_id = ?", customerID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除体重记录失败: %v", err)
	}

	// 删除客户的产品使用记录
	_, err = tx.Exec("DELETE FROM product_usages WHERE customer_id = ?", customerID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除产品使用记录失败: %v", err)
	}

	// 删除客户
	_, err = tx.Exec("DELETE FROM customers WHERE id = ?", customerID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除客户失败: %v", err)
	}

	// 提交事务
	return tx.Commit()
}

// GetWeightRecords 获取客户的体重记录
func GetWeightRecords(customerID int) ([]models.WeightRecord, error) {
	rows, err := DB.Query(`
		SELECT id, customer_id, weight, record_date, notes, created_at
		FROM weight_records
		WHERE customer_id = ?
		ORDER BY record_date DESC
	`, customerID)

	if err != nil {
		return nil, fmt.Errorf("查询体重记录失败: %v", err)
	}
	defer rows.Close()

	var records []models.WeightRecord
	for rows.Next() {
		var record models.WeightRecord
		var createdAt time.Time
		err := rows.Scan(
			&record.ID,
			&record.CustomerID,
			&record.Weight,
			&record.RecordDate,
			&record.Notes,
			&createdAt,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描体重记录失败: %v", err)
		}

		record.CreatedAt = createdAt
		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("遍历体重记录结果集失败: %v", err)
	}

	return records, nil
}

// AddWeightRecord 添加体重记录
func AddWeightRecord(record *models.WeightRecord) (int, error) {
	result, err := DB.Exec(`
		INSERT INTO weight_records (customer_id, weight, record_date, notes, created_at)
		VALUES (?, ?, ?, ?, ?)
	`,
		record.CustomerID,
		record.Weight,
		record.RecordDate,
		record.Notes,
		record.CreatedAt,
	)

	if err != nil {
		return 0, fmt.Errorf("插入体重记录失败: %v", err)
	}

	// 更新客户当前体重
	_, err = DB.Exec(`
		UPDATE customers 
		SET current_weight = ?, updated_at = ?
		WHERE id = ?
	`, record.Weight, time.Now(), record.CustomerID)

	if err != nil {
		log.Printf("更新客户当前体重失败: %v", err)
		// 继续执行，不要因为这个错误而终止整个流程
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("获取新记录ID失败: %v", err)
	}

	return int(id), nil
}

// GetProductUsages 获取客户的产品使用记录
func GetProductUsages(customerID int, page int, pageSize int) (map[string]interface{}, error) {
	// 查询所有产品使用记录，不再按产品ID分组
	rows, err := DB.Query(`
		SELECT pu.id, p.id as product_id, COALESCE(pu.product_name, p.name) as product_name, 
		pu.usage_date, 
		pu.update_date,
		pu.quantity,
		COALESCE(pu.purchase_count, 1) as purchase_count
		FROM product_usages pu
		LEFT JOIN products p ON pu.product_id = p.id
		WHERE pu.customer_id = ?
		ORDER BY pu.usage_date DESC, pu.id DESC
		LIMIT ? OFFSET ?
	`, customerID, pageSize, (page-1)*pageSize)

	if err != nil {
		return nil, fmt.Errorf("查询产品使用记录失败: %v", err)
	}
	defer rows.Close()

	var usages []map[string]interface{}
	for rows.Next() {
		var id, productId, purchaseCount int
		var productName, usageDate, updateDate string
		var quantity float64

		err := rows.Scan(
			&id,
			&productId,
			&productName,
			&usageDate,
			&updateDate,
			&quantity,
			&purchaseCount,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描产品使用记录失败: %v", err)
		}

		usage := map[string]interface{}{
			"id":             id,
			"product_id":     productId,
			"product_name":   productName,
			"usage_date":     usageDate,
			"update_date":    updateDate,
			"quantity":       quantity,
			"purchase_count": purchaseCount,
		}

		usages = append(usages, usage)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("遍历产品使用记录结果集失败: %v", err)
	}

	// 获取总数
	var totalCount int
	err = DB.QueryRow(`
		SELECT COUNT(*) 
		FROM product_usages 
		WHERE customer_id = ?
	`, customerID).Scan(&totalCount)

	if err != nil {
		return nil, fmt.Errorf("获取产品使用记录总数失败: %v", err)
	}

	// 构建返回结果
	result := map[string]interface{}{
		"total": totalCount,
		"list":  usages,
		"page":  page,
		"limit": pageSize,
		"pages": (totalCount + pageSize - 1) / pageSize,
	}

	return result, nil
}

// AddProductUsage 添加产品使用记录
func AddProductUsage(usage *models.ProductUsage) (int, error) {
	result, err := DB.Exec(`
		INSERT INTO product_usages (customer_id, product_id, product_name, usage_date, update_date, quantity, purchase_count, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		usage.CustomerID,
		usage.ProductID,
		usage.ProductName,
		usage.UsageDate,
		usage.UpdateDate,
		usage.Quantity,
		usage.PurchaseCount,
		usage.Notes,
		usage.CreatedAt,
	)

	if err != nil {
		return 0, fmt.Errorf("插入产品使用记录失败: %v", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("获取新记录ID失败: %v", err)
	}

	return int(id), nil
}

// GetProducts 获取产品列表
func GetProducts(storeIDs string) ([]map[string]interface{}, error) {
	var query string
	var args []interface{}

	if storeIDs != "" {
		// 将店铺ID字符串转换为切片
		storeIDList := strings.Split(storeIDs, ",")
		placeholders := make([]string, len(storeIDList))
		for i := range storeIDList {
			placeholders[i] = "?"
			args = append(args, storeIDList[i])
		}

		query = fmt.Sprintf(`
			SELECT p.id, p.name, p.notes as description, p.price, p.stock, s.name as store_name
			FROM products p
			LEFT JOIN stores s ON p.store_id = s.id
			WHERE p.store_id IN (%s)
			ORDER BY p.name
		`, strings.Join(placeholders, ","))
	} else {
		query = `
			SELECT p.id, p.name, p.notes as description, p.price, p.stock, s.name as store_name
			FROM products p
			LEFT JOIN stores s ON p.store_id = s.id
			ORDER BY p.name
		`
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("查询产品列表失败: %v", err)
	}
	defer rows.Close()

	var products []map[string]interface{}
	for rows.Next() {
		var id int
		var name, description, storeName string
		var price, stock float64

		err := rows.Scan(&id, &name, &description, &price, &stock, &storeName)
		if err != nil {
			return nil, fmt.Errorf("扫描产品数据失败: %v", err)
		}

		product := map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"price":       price,
			"stock":       stock,
			"store_name":  storeName,
		}

		products = append(products, product)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("遍历产品结果集失败: %v", err)
	}

	return products, nil
}

// GetCustomerRecords 获取客户综合记录(体重+产品使用)
func GetCustomerRecords(customerID int, page int, pageSize int) (map[string]interface{}, error) {
	// 计算偏移量
	offset := (page - 1) * pageSize

	// 获取总记录数
	var weightCount, usageCount int
	err := DB.QueryRow("SELECT COUNT(*) FROM weight_records WHERE customer_id = ?", customerID).Scan(&weightCount)
	if err != nil {
		return nil, fmt.Errorf("获取体重记录数量失败: %v", err)
	}

	err = DB.QueryRow("SELECT COUNT(*) FROM product_usages WHERE customer_id = ?", customerID).Scan(&usageCount)
	if err != nil {
		return nil, fmt.Errorf("获取产品使用记录数量失败: %v", err)
	}

	totalCount := weightCount + usageCount

	// 综合查询体重记录和产品使用记录
	query := `
		SELECT 
			'weight' as record_type,
			id,
			record_date as date,
			weight as value,
			notes,
			created_at
		FROM weight_records
		WHERE customer_id = ?
		
		UNION ALL
		
		SELECT 
			'product' as record_type,
			pu.id,
			pu.usage_date as date,
			pu.quantity as value,
			pu.notes,
			pu.created_at
		FROM product_usages pu
		LEFT JOIN products p ON pu.product_id = p.id
		WHERE pu.customer_id = ?
		
		ORDER BY date DESC, created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := DB.Query(query, customerID, customerID, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("查询客户记录失败: %v", err)
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var recordType, date, notes string
		var id int
		var value float64
		var createdAt time.Time

		err := rows.Scan(&recordType, &id, &date, &value, &notes, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("扫描客户记录失败: %v", err)
		}

		record := map[string]interface{}{
			"record_type": recordType,
			"id":          id,
			"date":        date,
			"value":       value,
			"notes":       notes,
			"created_at":  createdAt.Format("2006-01-02 15:04:05"),
		}

		if recordType == "weight" {
			record["display_name"] = "体重记录"
			record["unit"] = "kg"
		} else {
			// 获取产品名称
			var productID int
			var productName string
			err = DB.QueryRow("SELECT product_id FROM product_usages WHERE id = ?", id).Scan(&productID)
			if err == nil {
				err = DB.QueryRow("SELECT name FROM products WHERE id = ?", productID).Scan(&productName)
				if err == nil {
					record["display_name"] = productName
					record["product_id"] = productID
				}
			}
			record["unit"] = "次"
		}

		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("遍历客户记录结果集失败: %v", err)
	}

	// 构建返回结果
	result := map[string]interface{}{
		"total": totalCount,
		"list":  records,
		"page":  page,
		"limit": pageSize,
		"pages": (totalCount + pageSize - 1) / pageSize,
	}

	return result, nil
}

// ExportCustomerReport 导出客户报表，返回报表URL
func ExportCustomerReport(customerID int) (string, error) {
	// 检查客户是否存在
	var customer models.Customer
	err := DB.QueryRow(`
		SELECT id, name, phone, gender, age, height, initial_weight, 
		current_weight, target_weight, store_id, notes, created_at
		FROM customers WHERE id = ?`, customerID).Scan(
		&customer.ID, &customer.Name, &customer.Phone, &customer.Gender,
		&customer.Age, &customer.Height, &customer.InitialWeight,
		&customer.CurrentWeight, &customer.TargetWeight, &customer.StoreID,
		&customer.Notes, &customer.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("客户不存在")
		}
		return "", fmt.Errorf("获取客户信息失败: %v", err)
	}

	// 获取店铺名称
	err = DB.QueryRow("SELECT name FROM stores WHERE id = ?", customer.StoreID).Scan(&customer.StoreName)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("获取店铺名称失败: %v", err)
	}

	// 获取减肥记录
	weightRecords, err := GetWeightRecords(customerID)
	if err != nil {
		return "", fmt.Errorf("获取减肥记录失败: %v", err)
	}

	// 获取产品使用记录
	productUsages, err := GetProductUsages(customerID, 1, 999)
	if err != nil {
		return "", fmt.Errorf("获取产品使用记录失败: %v", err)
	}

	// 生成报告文件名
	filename := fmt.Sprintf("customer_%d_%s.pdf", customerID, time.Now().Format("20060102_150405"))
	filePath := fmt.Sprintf("./data/reports/%s", filename)

	// 确保报告目录存在
	err = os.MkdirAll("./data/reports", 0755)
	if err != nil {
		return "", fmt.Errorf("创建报告目录失败: %v", err)
	}

	// 生成PDF报告
	err = generatePDFReport(filePath, customer, weightRecords, productUsages["list"].([]models.ProductUsage))
	if err != nil {
		return "", fmt.Errorf("生成PDF报告失败: %v", err)
	}

	// 返回可访问的URL
	reportURL := fmt.Sprintf("/api/download/reports/%s", filename)

	return reportURL, nil
}

// generatePDFReport 生成PDF报告
func generatePDFReport(filePath string, customer models.Customer, weightRecords []models.WeightRecord, productUsages []models.ProductUsage) error {
	// 这里实现PDF生成逻辑
	// 此处使用简单的文本文件作为示例，实际项目中应该使用PDF库
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 写入客户基本信息
	fmt.Fprintf(file, "客户减肥报告\n")
	fmt.Fprintf(file, "==========================================\n")
	fmt.Fprintf(file, "客户信息\n")
	fmt.Fprintf(file, "姓名: %s\n", customer.Name)
	fmt.Fprintf(file, "电话: %s\n", customer.Phone)

	// 修复三元运算符的语法错误
	gender := "男"
	if customer.Gender == 2 {
		gender = "女"
	}
	fmt.Fprintf(file, "性别: %s\n", gender)

	fmt.Fprintf(file, "年龄: %d岁\n", customer.Age)
	fmt.Fprintf(file, "身高: %.1fcm\n", customer.Height)
	fmt.Fprintf(file, "初始体重: %.1fkg\n", customer.InitialWeight)
	fmt.Fprintf(file, "当前体重: %.1fkg\n", customer.CurrentWeight)
	fmt.Fprintf(file, "目标体重: %.1fkg\n", customer.TargetWeight)
	fmt.Fprintf(file, "减重进度: %.1f%%\n", calculateProgress(customer))
	fmt.Fprintf(file, "记录开始日期: %s\n", customer.CreatedAt.Format("2006-01-02"))
	fmt.Fprintf(file, "已记录天数: %d天\n", int(time.Since(customer.CreatedAt).Hours()/24))

	// 写入体重记录
	fmt.Fprintf(file, "\n体重记录\n")
	fmt.Fprintf(file, "------------------------------------------\n")
	fmt.Fprintf(file, "日期\t\t体重(kg)\t变化(kg)\n")

	var totalWeightLoss float64
	var prevWeight float64

	// 按日期排序
	sort.Slice(weightRecords, func(i, j int) bool {
		return weightRecords[i].RecordDate < weightRecords[j].RecordDate
	})

	for i, record := range weightRecords {
		var change float64
		if i == 0 {
			change = record.Weight - customer.InitialWeight
			prevWeight = record.Weight
		} else {
			change = record.Weight - prevWeight
			prevWeight = record.Weight
		}

		totalWeightLoss = customer.InitialWeight - record.Weight

		fmt.Fprintf(file, "%s\t%.1f\t\t%+.1f\n", record.RecordDate, record.Weight, change)
	}

	fmt.Fprintf(file, "------------------------------------------\n")
	fmt.Fprintf(file, "总减重: %.1fkg\n", totalWeightLoss)

	// 写入产品使用记录
	fmt.Fprintf(file, "\n产品使用记录\n")
	fmt.Fprintf(file, "------------------------------------------\n")
	fmt.Fprintf(file, "日期\t\t产品名称\t\t使用次数\t剩余次数\n")

	for _, usage := range productUsages {
		fmt.Fprintf(file, "%s\t%s\t\t%.1f\t\t%d\n", usage.UsageDate, usage.ProductName, usage.Quantity, 0)
	}

	return nil
}

// calculateProgress 计算减重进度百分比
func calculateProgress(customer models.Customer) float64 {
	if customer.InitialWeight == 0 || customer.TargetWeight == 0 || customer.CurrentWeight == 0 {
		return 0
	}

	totalNeedLoss := customer.InitialWeight - customer.TargetWeight
	if totalNeedLoss <= 0 {
		return 0
	}

	currentLoss := customer.InitialWeight - customer.CurrentWeight
	progress := math.Min(100, (currentLoss/totalNeedLoss)*100)

	return progress
}

// GetWeightRecordByID 根据ID获取体重记录
func GetWeightRecordByID(recordID int) (*models.WeightRecord, error) {
	var record models.WeightRecord
	err := DB.QueryRow(`
		SELECT id, customer_id, weight, record_date, notes, created_at
		FROM weight_records
		WHERE id = ?
	`, recordID).Scan(
		&record.ID,
		&record.CustomerID,
		&record.Weight,
		&record.RecordDate,
		&record.Notes,
		&record.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("查询体重记录失败: %v", err)
	}

	return &record, nil
}

// DeleteWeightRecord 删除体重记录
func DeleteWeightRecord(recordID int) error {
	// 获取记录信息（用于更新客户当前体重）
	record, err := GetWeightRecordByID(recordID)
	if err != nil {
		return fmt.Errorf("获取体重记录失败: %v", err)
	}

	// 删除记录
	_, err = DB.Exec(`DELETE FROM weight_records WHERE id = ?`, recordID)
	if err != nil {
		return fmt.Errorf("删除体重记录失败: %v", err)
	}

	// 查询该客户最新的体重记录
	var latestWeight float64
	var hasLatestRecord bool

	err = DB.QueryRow(`
		SELECT weight FROM weight_records 
		WHERE customer_id = ? 
		ORDER BY record_date DESC LIMIT 1
	`, record.CustomerID).Scan(&latestWeight)

	if err == nil {
		hasLatestRecord = true
	}

	// 如果有最新记录，更新客户当前体重
	if hasLatestRecord {
		_, err = DB.Exec(`
			UPDATE customers 
			SET current_weight = ?, updated_at = ?
			WHERE id = ?
		`, latestWeight, time.Now(), record.CustomerID)

		if err != nil {
			log.Printf("更新客户当前体重失败: %v", err)
			// 继续执行，不要因为这个错误而终止整个流程
		}
	}

	return nil
}
