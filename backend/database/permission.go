package database

import (
	"fmt"
)

// UserHasAllStoresAccess 检查用户是否有访问所有店铺的权限
func UserHasAllStoresAccess(userID int) (bool, error) {
	// 检查用户角色
	var role int
	err := DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&role)
	if err != nil {
		return false, fmt.Errorf("查询用户角色失败: %v", err)
	}

	// 角色为1表示管理员，有权访问所有店铺
	return role == 1, nil
}

// GetStoreIDsForUser 获取用户有权限访问的店铺ID列表
func GetStoreIDsForUser(userID int) ([]interface{}, error) {
	rows, err := DB.Query(`
		SELECT store_id FROM user_store_permissions 
		WHERE user_id = ?
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("查询用户店铺权限失败: %v", err)
	}
	defer rows.Close()

	var storeIDs []interface{}
	for rows.Next() {
		var storeID int
		if err := rows.Scan(&storeID); err != nil {
			return nil, err
		}
		storeIDs = append(storeIDs, storeID)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return storeIDs, nil
}

// UserHasStorePermission 检查用户是否有访问特定店铺的权限
func UserHasStorePermission(userID, storeID int) (bool, error) {
	// 先检查用户是否有访问所有店铺的权限
	hasAllAccess, err := UserHasAllStoresAccess(userID)
	if err != nil {
		return false, err
	}

	if hasAllAccess {
		return true, nil
	}

	// 检查用户是否有访问该店铺的权限
	var count int
	err = DB.QueryRow(`
		SELECT COUNT(*) FROM user_store_permissions 
		WHERE user_id = ? AND store_id = ?
	`, userID, storeID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("查询用户店铺权限失败: %v", err)
	}

	return count > 0, nil
}
