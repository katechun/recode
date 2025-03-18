package database

import (
	"fmt"
	"log"
	"strings"
	// 移除未使用的导入
	// "strconv"
	// "account/backend/models"
	// "golang.org/x/crypto/bcrypt"
)

// 不再重复声明DB变量
// var (
// 	DB *sql.DB
// )

// 不再重复声明InitDB函数

// ResetDatabase 重置数据库（仅开发环境使用）
func ResetDatabase() error {
	// ⚠️ 警告: 此函数会清空所有数据表并重新创建它们！
	// ⚠️ 这会永久删除所有现有数据!
	// ⚠️ 仅在开发或测试环境中使用，生产环境请勿调用!
	log.Println("⚠️ 警告: 即将重置数据库，所有数据将被清空!")

	// 先禁用外键约束
	_, err := DB.Exec("PRAGMA foreign_keys = OFF")
	if err != nil {
		log.Printf("禁用外键约束失败: %v", err)
		return err
	}

	// 删除现有表（按照依赖关系的反向顺序）
	dropTablesSQL := `
	DROP TABLE IF EXISTS user_default_settings;
	DROP TABLE IF EXISTS accounts;
	DROP TABLE IF EXISTS account_types;
	DROP TABLE IF EXISTS user_store;
	DROP TABLE IF EXISTS stores;
	DROP TABLE IF EXISTS users;
	`

	// 分割SQL语句并执行
	for _, stmt := range strings.Split(dropTablesSQL, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		_, err := DB.Exec(stmt)
		if err != nil {
			log.Printf("删除表失败: %s\n错误: %v", stmt, err)
		}
	}

	// 执行创建表的SQL语句
	createTableSQL := `
	-- 用户表
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		nickname TEXT,
		password TEXT NOT NULL,
		role INTEGER DEFAULT 0, -- 0普通用户，1管理员
		avatar TEXT,
		phone TEXT,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- 商店表
	CREATE TABLE IF NOT EXISTS stores (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		address TEXT,
		phone TEXT,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- 用户-商店关联表（权限）
	CREATE TABLE IF NOT EXISTS user_store (
		user_id INTEGER,
		store_id INTEGER,
		permission INTEGER DEFAULT 1, -- 1查看，2编辑，3管理
		PRIMARY KEY (user_id, store_id),
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (store_id) REFERENCES stores(id)
	);

	-- 账目类型表
	CREATE TABLE IF NOT EXISTS account_types (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		category INTEGER NOT NULL, -- 1收入，2支出
		icon TEXT,
		sort_order INTEGER DEFAULT 0,
		is_expense BOOLEAN,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- 账目记录表
	CREATE TABLE IF NOT EXISTS accounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		store_id INTEGER,
		user_id INTEGER,
		type_id INTEGER,
		amount REAL NOT NULL,
		remark TEXT,
		transaction_time TIMESTAMP,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (store_id) REFERENCES stores(id),
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (type_id) REFERENCES account_types(id)
	);

	-- 用户默认设置表
	CREATE TABLE IF NOT EXISTS user_default_settings (
		user_id INTEGER PRIMARY KEY,
		store_id INTEGER,
		income_type_id INTEGER,
		expense_type_id INTEGER,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (store_id) REFERENCES stores(id),
		FOREIGN KEY (income_type_id) REFERENCES account_types(id),
		FOREIGN KEY (expense_type_id) REFERENCES account_types(id)
	);
	`

	// 分割SQL语句并执行
	for _, stmt := range strings.Split(createTableSQL, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		_, err := DB.Exec(stmt)
		if err != nil {
			log.Printf("执行SQL失败: %s\n错误: %v", stmt, err)
			return err
		}
	}

	// 重新启用外键约束
	_, err = DB.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		log.Printf("重新启用外键约束失败: %v", err)
	}

	return nil
}

// CreateTables 创建必要的数据库表
func CreateTables() error {
	// 创建用户表
	_, err := DB.Exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		nickname TEXT,
		role INTEGER NOT NULL DEFAULT 2,
		phone TEXT,
		avatar TEXT,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		last_login TIMESTAMP
	)
	`)

	if err != nil {
		return fmt.Errorf("创建用户表失败: %w", err)
	}

	// 创建店铺表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS stores (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		address TEXT,
		phone TEXT,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)
	`)

	if err != nil {
		return fmt.Errorf("创建店铺表失败: %w", err)
	}

	// 创建账务类型表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS account_types (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		category INTEGER NOT NULL,
		icon TEXT,
		sort_order INTEGER DEFAULT 0,
		is_expense BOOLEAN NOT NULL DEFAULT 0,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)
	`)

	if err != nil {
		return fmt.Errorf("创建账务类型表失败: %w", err)
	}

	// 创建账务记录表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS accounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		store_id INTEGER NOT NULL,
		type_id INTEGER NOT NULL,
		amount REAL NOT NULL,
		remark TEXT,
		transaction_time TIMESTAMP,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (store_id) REFERENCES stores(id),
		FOREIGN KEY (type_id) REFERENCES account_types(id)
	)
	`)

	if err != nil {
		return fmt.Errorf("创建账务记录表失败: %w", err)
	}

	// 创建用户店铺权限表
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
		return fmt.Errorf("创建用户店铺权限表失败: %w", err)
	}

	// 创建用户默认设置表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS user_default_settings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		default_store_id INTEGER,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (default_store_id) REFERENCES stores(id) ON DELETE SET NULL
	)
	`)

	if err != nil {
		return fmt.Errorf("创建用户默认设置表失败: %w", err)
	}

	return nil
}

// 其余函数保持不变
