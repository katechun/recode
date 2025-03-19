package database

import (
	"fmt"
	"log"
)

// CreateCustomerTables 创建客户管理相关的数据库表
func CreateCustomerTables() error {
	// 客户信息表
	createCustomerTable := `
	CREATE TABLE IF NOT EXISTS customers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		phone TEXT NOT NULL,
		gender INTEGER NOT NULL DEFAULT 1,
		age INTEGER,
		height REAL,
		initial_weight REAL,
		current_weight REAL,
		target_weight REAL,
		store_id INTEGER NOT NULL,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (store_id) REFERENCES stores(id)
	);`

	// 体重记录表
	createWeightRecordTable := `
	CREATE TABLE IF NOT EXISTS weight_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER NOT NULL,
		weight REAL NOT NULL,
		record_date TEXT NOT NULL,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (customer_id) REFERENCES customers(id)
	);`

	// 产品表
	createProductTable := `
	CREATE TABLE IF NOT EXISTS products (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		store_id INTEGER NOT NULL,
		price REAL NOT NULL DEFAULT 0,
		stock INTEGER NOT NULL DEFAULT 0,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (store_id) REFERENCES stores(id)
	);`

	// 产品使用记录表
	createProductUsageTable := `
	CREATE TABLE IF NOT EXISTS product_usages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER NOT NULL,
		product_id INTEGER NOT NULL,
		usage_date TEXT NOT NULL,
		quantity REAL NOT NULL DEFAULT 1,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (customer_id) REFERENCES customers(id),
		FOREIGN KEY (product_id) REFERENCES products(id)
	);`

	// 执行创建表操作
	tables := []string{
		createCustomerTable,
		createWeightRecordTable,
		createProductTable,
		createProductUsageTable,
	}

	for _, table := range tables {
		_, err := DB.Exec(table)
		if err != nil {
			return fmt.Errorf("创建客户相关表失败: %v", err)
		}
	}

	log.Println("客户管理相关数据库表初始化完成")
	return nil
}
