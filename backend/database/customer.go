package database

import (
	"database/sql"
	"fmt"
	"log"
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
	// 计算偏移量
	offset := (page - 1) * pageSize

	// 获取总数
	var totalCount int
	err := DB.QueryRow(`
		SELECT COUNT(*) 
		FROM product_usages 
		WHERE customer_id = ?
	`, customerID).Scan(&totalCount)

	if err != nil {
		return nil, fmt.Errorf("获取产品使用记录总数失败: %v", err)
	}

	// 查询产品使用记录
	rows, err := DB.Query(`
		SELECT pu.id, pu.customer_id, pu.product_id, p.name as product_name, 
		pu.usage_date, pu.quantity, pu.notes, pu.created_at
		FROM product_usages pu
		LEFT JOIN products p ON pu.product_id = p.id
		WHERE pu.customer_id = ?
		ORDER BY pu.usage_date DESC, pu.created_at DESC
		LIMIT ? OFFSET ?
	`, customerID, pageSize, offset)

	if err != nil {
		return nil, fmt.Errorf("查询产品使用记录失败: %v", err)
	}
	defer rows.Close()

	var usages []map[string]interface{}
	for rows.Next() {
		var id, customerId, productId int
		var productName, usageDate, notes string
		var quantity float64
		var createdAt time.Time

		err := rows.Scan(
			&id,
			&customerId,
			&productId,
			&productName,
			&usageDate,
			&quantity,
			&notes,
			&createdAt,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描产品使用记录失败: %v", err)
		}

		usage := map[string]interface{}{
			"id":           id,
			"customer_id":  customerId,
			"product_id":   productId,
			"product_name": productName,
			"usage_date":   usageDate,
			"quantity":     quantity,
			"notes":        notes,
			"created_at":   createdAt.Format("2006-01-02 15:04:05"),
		}

		usages = append(usages, usage)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("遍历产品使用记录结果集失败: %v", err)
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
		INSERT INTO product_usages (customer_id, product_id, usage_date, quantity, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`,
		usage.CustomerID,
		usage.ProductID,
		usage.UsageDate,
		usage.Quantity,
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
func GetProducts(storeID string) ([]map[string]interface{}, error) {
	var query string
	var args []interface{}

	if storeID != "" {
		query = `
			SELECT id, name, description, price, stock 
			FROM products 
			WHERE store_id = ?
			ORDER BY name
		`
		args = append(args, storeID)
	} else {
		query = `
			SELECT id, name, description, price, stock 
			FROM products 
			ORDER BY name
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
		var name, description string
		var price, stock float64

		err := rows.Scan(&id, &name, &description, &price, &stock)
		if err != nil {
			return nil, fmt.Errorf("扫描产品数据失败: %v", err)
		}

		product := map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"price":       price,
			"stock":       stock,
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
	var exists int
	err := DB.QueryRow("SELECT 1 FROM customers WHERE id = ?", customerID).Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("客户不存在")
		}
		return "", fmt.Errorf("检查客户是否存在失败: %v", err)
	}

	// 这里应该实现导出报表的逻辑，可能涉及生成PDF、Excel等文件
	// 为了演示，这里简单返回一个假URL
	reportURL := fmt.Sprintf("/api/reports/customer_%d_%s.pdf", customerID, time.Now().Format("20060102_150405"))

	return reportURL, nil
}
