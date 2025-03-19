package database

import (
	"fmt"
	"log"
)

// CheckDatabaseTables 检查所有必要的数据库表是否存在
func CheckDatabaseTables() error {
	log.Println("全面检查数据库表结构...")

	// 需要检查的所有表
	requiredTables := []string{
		"users",
		"stores",
		"account_types",
		"accounts",
		"user_store_permissions",
		"user_default_settings",
	}

	missingTables := []string{}

	// 检查每个表是否存在
	for _, table := range requiredTables {
		var count int
		err := DB.QueryRow(`
			SELECT COUNT(*) FROM sqlite_master 
			WHERE type='table' AND name=?
		`, table).Scan(&count)

		if err != nil {
			return fmt.Errorf("检查表 %s 失败: %w", table, err)
		}

		if count == 0 {
			log.Printf("表 %s 不存在", table)
			missingTables = append(missingTables, table)
		}
	}

	// 如果有缺失的表，返回错误
	if len(missingTables) > 0 {
		return fmt.Errorf("数据库缺少以下表: %v", missingTables)
	}

	log.Println("所有必要的数据库表均已存在")
	return nil
}

// EnsureDatabaseTables 确保所有必要的数据库表存在，不存在则创建
func EnsureDatabaseTables() error {
	// 先尝试检查表是否存在
	err := CheckDatabaseTables()
	if err == nil {
		// 所有表都存在，无需创建
		return nil
	}

	log.Printf("需要创建数据库表: %v", err)

	// 尝试创建所有表
	if err := CreateTables(); err != nil {
		log.Printf("使用CreateTables创建表失败: %v", err)

		// 如果正常创建表失败，尝试重置数据库
		if err := ResetDatabase(); err != nil {
			return fmt.Errorf("重置数据库失败: %w", err)
		}
	}

	// 检查默认管理员用户
	if err := ensureDefaultAdmin(); err != nil {
		return fmt.Errorf("创建默认管理员账号失败: %w", err)
	}

	return nil
}

// ensureDefaultAdmin 确保系统中存在默认管理员用户
func ensureDefaultAdmin() error {
	// 检查是否存在管理员用户
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = 'admin'").Scan(&count)
	if err != nil {
		return fmt.Errorf("检查admin用户失败: %w", err)
	}

	// 如果不存在管理员，创建默认管理员
	if count == 0 {
		log.Println("创建默认管理员账号...")
		if err := CreateTestData(); err != nil {
			return fmt.Errorf("创建默认管理员失败: %w", err)
		}
		log.Println("默认管理员账号创建成功")
	}

	return nil
}
