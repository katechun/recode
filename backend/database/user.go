package database

import (
	"account/backend/models"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"log"
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
	log.Printf("开始查询用户%d的权限", userID)
	
	// 首先检查表是否存在，不存在则创建
	var tableExists int
	err := DB.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master 
		WHERE type='table' AND name='user_store_permissions'
	`).Scan(&tableExists)
	
	if err != nil {
		return nil, fmt.Errorf("检查权限表失败: %w", err)
	}
	
	// 如果表不存在，创建表并返回空结果
	if tableExists == 0 {
		log.Println("紧急创建user_store_permissions表...")
		_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS user_store_permissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			store_id INTEGER NOT NULL,
			create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
			UNIQUE(user_id, store_id)
		)
		`)
		
		if err != nil {
			return nil, fmt.Errorf("创建权限表失败: %w", err)
		}
		
		// 返回空结果
		return []models.StorePermission{}, nil
	}
	
	// 调试查看是否存在商店数据
	var storeCount int
	err = DB.QueryRow("SELECT COUNT(*) FROM stores").Scan(&storeCount)
	if err != nil {
		log.Printf("查询商店数量失败: %v", err)
	} else {
		log.Printf("系统中共有%d个商店", storeCount)
		
		// 如果没有商店，创建一个默认商店
		if storeCount == 0 {
			log.Println("创建默认商店...")
			_, err = DB.Exec(`
				INSERT INTO stores (name, address, phone) 
				VALUES ('总店', '默认地址', '12345678')
			`)
			if err != nil {
				log.Printf("创建默认商店失败: %v", err)
			} else {
				log.Println("已创建默认商店")
			}
		}
	}

	// 获取所有店铺
	query := `
		SELECT s.id, s.name,
		CASE WHEN usp.id IS NULL THEN 0 ELSE 1 END as has_permission
		FROM stores s
		LEFT JOIN user_store_permissions usp ON s.id = usp.store_id AND usp.user_id = ?
		ORDER BY s.name
	`
	
	log.Printf("执行查询: %s [参数: %d]", query, userID)
	rows, err := DB.Query(query, userID)
	
	if err != nil {
		return nil, fmt.Errorf("查询用户权限失败: %w", err)
	}
	defer rows.Close()
	
	var permissions []models.StorePermission
	for rows.Next() {
		var perm models.StorePermission
		err := rows.Scan(&perm.StoreID, &perm.StoreName, &perm.HasPermission)
		if err != nil {
			log.Printf("扫描权限数据失败: %v", err)
			continue
		}
		permissions = append(permissions, perm)
	}
	
	if err := rows.Err(); err != nil {
		log.Printf("遍历权限结果集时出错: %v", err)
		return nil, err
	}
	
	log.Printf("成功获取用户%d的权限，共%d条记录", userID, len(permissions))
	return permissions, nil
}

// UpdateUserStorePermissions 更新用户的店铺权限
func UpdateUserStorePermissions(userID int64, storeIDs []int64) error {
	// 首先检查表是否存在，不存在则创建
	var tableExists int
	err := DB.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master 
		WHERE type='table' AND name='user_store_permissions'
	`).Scan(&tableExists)
	
	if err != nil {
		return fmt.Errorf("检查权限表失败: %w", err)
	}
	
	// 如果表不存在，创建表
	if tableExists == 0 {
		log.Println("紧急创建user_store_permissions表...")
		_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS user_store_permissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			store_id INTEGER NOT NULL,
			create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
			UNIQUE(user_id, store_id)
		)
		`)
		
		if err != nil {
			return fmt.Errorf("创建权限表失败: %w", err)
		}
	}

	// 开始事务
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	// 删除该用户的所有权限
	_, err = tx.Exec("DELETE FROM user_store_permissions WHERE user_id = ?", userID)
	if err != nil {
		return err
	}
	
	// 添加新的权限
	stmt, err := tx.Prepare("INSERT INTO user_store_permissions (user_id, store_id) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()
	
	for _, storeID := range storeIDs {
		_, err = stmt.Exec(userID, storeID)
		if err != nil {
			return err
		}
	}
	
	// 提交事务
	return tx.Commit()
}

// InitUsers 修改 InitUsers 函数，避免重复创建已存在的用户
func InitUsers() {
	// 检查默认用户是否存在
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE username IN ('admin', 'clerk')").Scan(&count)
	if err != nil {
		log.Printf("检查默认用户失败: %v", err)
		return
	}

	log.Println("检查默认用户...")
	
	// 如果已经存在默认用户，则跳过创建
	if count >= 2 {
		log.Println("默认用户已存在，跳过创建")
		return
	}
	
	// 原有的用户创建代码...
} 