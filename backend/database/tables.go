package database

import (
	"fmt"
	"log"
)

// 创建必要的数据库表
func createTables() error {
	// 用户表
	createUserTable := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password TEXT NOT NULL,
		nickname TEXT,
		role INTEGER NOT NULL,
		phone TEXT,
		email TEXT,
		avatar TEXT,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		last_login TIMESTAMP
	);`

	// 店铺表
	createStoreTable := `
	CREATE TABLE IF NOT EXISTS stores (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		address TEXT,
		phone TEXT,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	// 账务类型表
	createAccountTypeTable := `
	CREATE TABLE IF NOT EXISTS account_types (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		is_expense BOOLEAN NOT NULL DEFAULT 0,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	// 账务记录表
	createAccountTable := `
	CREATE TABLE IF NOT EXISTS accounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		store_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		type_id INTEGER NOT NULL,
		amount REAL NOT NULL,
		remark TEXT,
		transaction_time TIMESTAMP NOT NULL,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (store_id) REFERENCES stores(id),
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (type_id) REFERENCES account_types(id)
	);`

	// 用户店铺权限表
	createUserStorePermission := `
	CREATE TABLE IF NOT EXISTS user_store_permissions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		store_id INTEGER NOT NULL,
		account_type_id INTEGER,  -- NULL表示所有类型
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (store_id) REFERENCES stores(id),
		FOREIGN KEY (account_type_id) REFERENCES account_types(id)
	);`

	// 执行创建表操作
	tables := []string{
		createUserTable,
		createStoreTable,
		createAccountTypeTable,
		createAccountTable,
		createUserStorePermission,
	}

	for _, table := range tables {
		_, err := DB.Exec(table)
		if err != nil {
			return fmt.Errorf("创建表失败: %v", err)
		}
	}

	log.Println("数据库表初始化完成")
	return nil
} 