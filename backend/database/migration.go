package database

import (
	"log"
)

// CheckAndMigrateTables 检查并迁移缺少的表和列
func CheckAndMigrateTables() error {
	log.Println("检查数据库表结构...")
	
	// 检查是否存在user_store_permissions表
	var count int
	err := DB.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master 
		WHERE type='table' AND name='user_store_permissions'
	`).Scan(&count)
	
	if err != nil {
		return err
	}
	
	// 如果不存在user_store_permissions表，则创建
	if count == 0 {
		log.Println("创建user_store_permissions表...")
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
			return err
		}
		
		log.Println("user_store_permissions表创建成功")
	}
	
	// 检查users表中是否有last_login列
	var hasLastLogin int
	err = DB.QueryRow(`
		SELECT COUNT(*) FROM pragma_table_info('users') 
		WHERE name = 'last_login'
	`).Scan(&hasLastLogin)
	
	if err != nil {
		return err
	}
	
	// 如果users表中没有last_login列，则添加
	if hasLastLogin == 0 {
		log.Println("向users表添加last_login列...")
		_, err = DB.Exec(`
			ALTER TABLE users ADD COLUMN last_login TIMESTAMP
		`)
		
		if err != nil {
			log.Printf("添加last_login列失败: %v", err)
			return err
		}
		
		log.Println("last_login列添加成功")
	}
	
	return nil
} 