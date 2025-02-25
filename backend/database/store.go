package database

import (
	"database/sql"
	"log"
	"account/backend/models"
)

// GetUserStores 获取用户有权限的店铺列表
func GetUserStores(userID int64) ([]models.Store, error) {
	// 检查用户角色
	var role int
	err := DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&role)
	if err != nil {
		return nil, err
	}

	// 如果是管理员，返回所有店铺
	var rows *sql.Rows
	if role == 1 { // 管理员角色
		rows, err = DB.Query("SELECT id, name, address, phone FROM stores")
	} else {
		// 非管理员只返回有权限的店铺
		rows, err = DB.Query(`
			SELECT s.id, s.name, s.address, s.phone
			FROM stores s
			JOIN user_store_permissions p ON s.id = p.store_id
			WHERE p.user_id = ?
		`, userID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stores := []models.Store{}
	for rows.Next() {
		var store models.Store
		err := rows.Scan(&store.ID, &store.Name, &store.Address, &store.Phone)
		if err != nil {
			log.Printf("扫描店铺数据失败: %v", err)
			continue
		}
		stores = append(stores, store)
	}

	return stores, nil
}

// IsUserAdmin 检查用户是否为管理员
func IsUserAdmin(userID int64) (bool, error) {
	var role int
	err := DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&role)
	if err != nil {
		return false, err
	}
	return role == 1, nil
}

// CreateStore 创建新店铺
func CreateStore(store models.Store) (int64, error) {
	result, err := DB.Exec(
		"INSERT INTO stores (name, address, phone) VALUES (?, ?, ?)",
		store.Name, store.Address, store.Phone,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateStore 更新店铺信息
func UpdateStore(store models.Store) error {
	_, err := DB.Exec(
		"UPDATE stores SET name = ?, address = ?, phone = ? WHERE id = ?",
		store.Name, store.Address, store.Phone, store.ID,
	)
	return err
}

// DeleteStore 删除店铺
func DeleteStore(storeID int64) error {
	// 先删除相关的用户店铺权限
	_, err := DB.Exec("DELETE FROM user_store_permissions WHERE store_id = ?", storeID)
	if err != nil {
		return err
	}

	// 删除店铺
	_, err = DB.Exec("DELETE FROM stores WHERE id = ?", storeID)
	return err
}

// HasStoreAccounts 检查店铺是否有账务记录
func HasStoreAccounts(storeID int64) (bool, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = ?", storeID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
} 