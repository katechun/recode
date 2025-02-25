package database

import (
	"account/backend/models"
	"golang.org/x/crypto/bcrypt"
)

// GetAllUsers 获取所有用户
func GetAllUsers() ([]models.User, error) {
	rows, err := DB.Query("SELECT id, username, nickname, role FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var user models.User
		err := rows.Scan(&user.ID, &user.Username, &user.Nickname, &user.Role)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

// CheckUserExists 检查用户名是否已存在
func CheckUserExists(username string) (bool, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CreateUser 创建新用户
func CreateUser(user models.User) (int64, error) {
	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return 0, err
	}

	result, err := DB.Exec(
		"INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)",
		user.Username, string(hashedPassword), user.Nickname, user.Role,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateUser 更新用户信息（不更新密码）
func UpdateUser(user models.User) error {
	_, err := DB.Exec(
		"UPDATE users SET nickname = ?, role = ? WHERE id = ?",
		user.Nickname, user.Role, user.ID,
	)
	return err
}

// DeleteUser 删除用户
func DeleteUser(userID int64) error {
	// 先删除用户的店铺权限
	_, err := DB.Exec("DELETE FROM user_store_permissions WHERE user_id = ?", userID)
	if err != nil {
		return err
	}

	// 删除用户
	_, err = DB.Exec("DELETE FROM users WHERE id = ?", userID)
	return err
}

// ResetUserPassword 重置用户密码
func ResetUserPassword(userID int64, newPassword string) error {
	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = DB.Exec("UPDATE users SET password = ? WHERE id = ?", string(hashedPassword), userID)
	return err
}

// GetUserStorePermissions 获取用户的店铺权限
func GetUserStorePermissions(userID int64) ([]models.StorePermission, error) {
	rows, err := DB.Query(`
		SELECT s.id, s.name, 
		CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END as has_permission
		FROM stores s
		LEFT JOIN user_store_permissions p ON s.id = p.store_id AND p.user_id = ?
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissions := []models.StorePermission{}
	for rows.Next() {
		var permission models.StorePermission
		err := rows.Scan(&permission.StoreID, &permission.StoreName, &permission.HasPermission)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}

	return permissions, nil
}

// UpdateUserStorePermissions 更新用户的店铺权限
func UpdateUserStorePermissions(userID int64, storeIDs []int64) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
			return
		}
		err = tx.Commit()
	}()

	// 清除之前的权限
	_, err = tx.Exec("DELETE FROM user_store_permissions WHERE user_id = ?", userID)
	if err != nil {
		return err
	}

	// 添加新权限
	for _, storeID := range storeIDs {
		_, err = tx.Exec("INSERT INTO user_store_permissions (user_id, store_id) VALUES (?, ?)", userID, storeID)
		if err != nil {
			return err
		}
	}

	return nil
} 