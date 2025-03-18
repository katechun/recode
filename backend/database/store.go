package database

import (
	"database/sql"
	"account/backend/models"
)

// GetUserStores 获取用户可访问的店铺列表
func GetUserStores(userID int64) ([]map[string]interface{}, error) {
	// 检查用户是否是管理员
	var isAdmin bool
	err := DB.QueryRow("SELECT role = 1 FROM users WHERE id = ?", userID).Scan(&isAdmin)
	if err != nil {
		return nil, err
	}

	var query string
	var args []interface{}

	if isAdmin {
		// 管理员可以看到所有店铺
		query = `
			SELECT id, name, address, phone
			FROM stores
			ORDER BY name
		`
	} else {
		// 普通店员只能看到有权限的店铺
		query = `
			SELECT s.id, s.name, s.address, s.phone
			FROM stores s
			INNER JOIN user_store_permissions usp ON s.id = usp.store_id
			WHERE usp.user_id = ?
			ORDER BY s.name
		`
		args = append(args, userID)
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stores []map[string]interface{}
	for rows.Next() {
		var id int64
		var name, address, phone string
		err := rows.Scan(&id, &name, &address, &phone)
		if err != nil {
			return nil, err
		}

		store := map[string]interface{}{
			"id":      id,
			"name":    name,
			"address": address,
			"phone":   phone,
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

// CheckStoreExists 检查店铺是否存在
func CheckStoreExists(storeID int64) (bool, error) {
	var exists int
	err := DB.QueryRow("SELECT 1 FROM stores WHERE id = ?", storeID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// CheckStoreHasAccounts 检查店铺是否有关联的账务记录
func CheckStoreHasAccounts(storeID int64) (bool, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM accounts WHERE store_id = ?", storeID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// DeleteStore 从数据库中删除店铺
func DeleteStore(storeID int64) error {
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

	// 首先删除店铺权限记录
	_, err = tx.Exec("DELETE FROM user_store_permissions WHERE store_id = ?", storeID)
	if err != nil {
		tx.Rollback()
		return err
	}
	
	// 然后删除店铺
	_, err = tx.Exec("DELETE FROM stores WHERE id = ?", storeID)
	if err != nil {
		tx.Rollback()
		return err
	}

	// 如果有用户默认设置使用该店铺，更新为其他店铺或设置为NULL
	_, err = tx.Exec(`
		UPDATE user_default_settings 
		SET store_id = (
			SELECT id FROM stores WHERE id != ? LIMIT 1
		)
		WHERE store_id = ?`, storeID, storeID)
	if err != nil {
		tx.Rollback()
		return err
	}

	// 如果没有找到其他店铺，则设置为NULL
	_, err = tx.Exec(`
		UPDATE user_default_settings 
		SET store_id = NULL 
		WHERE store_id = ?`, storeID)
	if err != nil {
		tx.Rollback()
		return err
	}

	// 提交事务
	return tx.Commit()
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