package database

import (
	"fmt"
)

// GetAllProducts 获取所有产品列表
func GetAllProducts() ([]map[string]interface{}, error) {
	query := `
		SELECT p.id, p.name, p.notes as description, p.price, p.stock, s.name as store_name
		FROM products p
		LEFT JOIN stores s ON p.store_id = s.id
		ORDER BY p.name
	`

	rows, err := DB.Query(query)
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

// ProductExists 检查产品是否存在
func ProductExists(productID int) (bool, error) {
	var exists bool
	err := DB.QueryRow("SELECT COUNT(*) > 0 FROM products WHERE id = ?", productID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("检查产品是否存在失败: %v", err)
	}
	return exists, nil
}

// ProductInUse 检查产品是否被使用
func ProductInUse(productID int) (bool, error) {
	var inUse bool
	err := DB.QueryRow("SELECT COUNT(*) > 0 FROM product_usages WHERE product_id = ?", productID).Scan(&inUse)
	if err != nil {
		return false, fmt.Errorf("检查产品是否被使用失败: %v", err)
	}
	return inUse, nil
}

// DeleteProduct 删除产品
func DeleteProduct(productID int) error {
	_, err := DB.Exec("DELETE FROM products WHERE id = ?", productID)
	if err != nil {
		return fmt.Errorf("删除产品失败: %v", err)
	}
	return nil
}

// AddProduct 添加产品
func AddProduct(product interface{}) (int, error) {
	p, ok := product.(struct {
		Name        string
		Description string
		Price       float64
		Stock       int
		StoreID     int
	})

	if !ok {
		return 0, fmt.Errorf("产品格式不正确")
	}

	storeID := p.StoreID
	if storeID <= 0 {
		storeID = 1
	}

	result, err := DB.Exec(`
		INSERT INTO products (name, notes, price, stock, store_id)
		VALUES (?, ?, ?, ?, ?)
	`, p.Name, p.Description, p.Price, p.Stock, storeID)

	if err != nil {
		return 0, fmt.Errorf("添加产品失败: %v", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("获取新产品ID失败: %v", err)
	}

	return int(id), nil
}
