package database

import (
	"log"
	"strings"
	// 移除未使用的导入
	// "strconv"
	// "time"
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
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- 商店表
	CREATE TABLE IF NOT EXISTS stores (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		address TEXT,
		contact TEXT,
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
		type INTEGER NOT NULL, -- 1收入，2支出
		icon TEXT,
		sort_order INTEGER DEFAULT 0,
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

	return nil
}

// 其余函数保持不变
