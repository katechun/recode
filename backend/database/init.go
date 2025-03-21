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
	DROP TABLE IF EXISTS product_usages;
	DROP TABLE IF EXISTS weight_records;
	DROP TABLE IF EXISTS products;
	DROP TABLE IF EXISTS customers;
	DROP TABLE IF EXISTS user_default_settings;
	DROP TABLE IF EXISTS accounts;
	DROP TABLE IF EXISTS account_types;
	DROP TABLE IF EXISTS user_store_permissions;
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
		user_id INTEGER DEFAULT 0,  -- 记录人ID，默认为0表示未知用户
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

	// 创建客户表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS customers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		phone TEXT,
		gender INTEGER DEFAULT 1, -- 1男, 2女
		age INTEGER,
		height REAL,
		initial_weight REAL,
		current_weight REAL,
		target_weight REAL,
		store_id INTEGER,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)
	`)

	if err != nil {
		return fmt.Errorf("创建客户表失败: %w", err)
	}

	// 创建体重记录表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS weight_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER NOT NULL,
		weight REAL NOT NULL,
		record_date TEXT NOT NULL,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (customer_id) REFERENCES customers(id)
	)
	`)

	if err != nil {
		return fmt.Errorf("创建体重记录表失败: %w", err)
	}

	// 创建产品表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS products (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		description TEXT,
		price REAL DEFAULT 0,
		stock INTEGER DEFAULT 0,
		store_id INTEGER,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)
	`)

	if err != nil {
		return fmt.Errorf("创建产品表失败: %w", err)
	}

	// 创建产品使用记录表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS product_usages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER NOT NULL,
		product_id INTEGER NOT NULL,
		product_name TEXT,
		usage_date TEXT NOT NULL,
		update_date TEXT,
		quantity REAL NOT NULL,
		purchase_count INTEGER DEFAULT 1,
		notes TEXT,
		created_at TIMESTAMP NOT NULL,
		FOREIGN KEY (customer_id) REFERENCES customers(id),
		FOREIGN KEY (product_id) REFERENCES products(id)
	)
	`)

	if err != nil {
		log.Printf("创建产品使用记录表失败: %v", err)
	}

	// 检查并添加update_date列
	// 首先检查update_date列是否存在
	var updateDateColumnExists bool
	err = DB.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('product_usages') 
		WHERE name = 'update_date'
	`).Scan(&updateDateColumnExists)

	if err != nil {
		log.Printf("检查update_date列是否存在失败: %v", err)
	} else if !updateDateColumnExists {
		// 列不存在时才添加
		_, err = DB.Exec(`
		PRAGMA foreign_keys=off;
		BEGIN TRANSACTION;
			
		-- 添加update_date列
		ALTER TABLE product_usages ADD COLUMN update_date TEXT;
		
		-- 更新现有记录的update_date
		UPDATE product_usages 
		SET update_date = usage_date 
		WHERE update_date IS NULL OR update_date = '';
			
		COMMIT;
		PRAGMA foreign_keys=on;
		`)

		if err != nil {
			log.Printf("添加update_date列失败: %v", err)
		} else {
			log.Println("成功添加update_date列并更新现有数据")
		}
	} else {
		// 列已存在，只更新空值
		_, err = DB.Exec(`
		UPDATE product_usages 
		SET update_date = usage_date 
		WHERE update_date IS NULL OR update_date = ''
		`)

		if err != nil {
			// 数据库锁定错误(SQLITE_BUSY)是常见的，可以忽略
			// 这通常意味着另一个连接正在使用数据库
			if strings.Contains(err.Error(), "database is locked") ||
				strings.Contains(err.Error(), "SQLITE_BUSY") {
				log.Println("数据库锁定，跳过更新空的update_date值，稍后会自动重试")
			} else {
				log.Printf("更新空的update_date值失败: %v", err)
			}
		}
	}

	// 检查product_name列是否存在
	var productNameColumnExists bool
	err = DB.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('product_usages') 
		WHERE name = 'product_name'
	`).Scan(&productNameColumnExists)

	if err != nil {
		log.Printf("检查product_name列是否存在失败: %v", err)
	} else if !productNameColumnExists {
		// 列不存在时才添加
		_, err = DB.Exec(`
		PRAGMA foreign_keys=off;
		BEGIN TRANSACTION;
			
		-- 添加product_name列
		ALTER TABLE product_usages ADD COLUMN product_name TEXT;
		
		-- 尝试从products表获取产品名称更新product_usages表
		UPDATE product_usages 
		SET product_name = (
			SELECT name FROM products 
			WHERE products.id = product_usages.product_id
		)
		WHERE product_name IS NULL;
			
		COMMIT;
		PRAGMA foreign_keys=on;
		`)

		if err != nil {
			log.Printf("添加product_name列失败: %v", err)
		} else {
			log.Println("成功添加product_name列并尝试更新现有数据")
		}
	}

	// 检查purchase_count列是否存在
	var purchaseCountColumnExists bool
	err = DB.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('product_usages') 
		WHERE name = 'purchase_count'
	`).Scan(&purchaseCountColumnExists)

	if err != nil {
		log.Printf("检查purchase_count列是否存在失败: %v", err)
	} else if !purchaseCountColumnExists {
		// 列不存在时才添加
		_, err = DB.Exec(`
		PRAGMA foreign_keys=off;
		BEGIN TRANSACTION;
			
		-- 添加purchase_count列，默认值为1
		ALTER TABLE product_usages ADD COLUMN purchase_count INTEGER DEFAULT 1;
			
		COMMIT;
		PRAGMA foreign_keys=on;
		`)

		if err != nil {
			log.Printf("添加purchase_count列失败: %v", err)
		} else {
			log.Println("成功添加purchase_count列并设置默认值为1")
		}
	}

	// 检查accounts表中是否存在user_id列
	var columnExists bool
	err = DB.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('accounts') 
		WHERE name = 'user_id'
	`).Scan(&columnExists)
	if err != nil {
		return fmt.Errorf("检查user_id列失败: %v", err)
	}

	// 如果账务表中不存在user_id列，添加该列
	if !columnExists {
		log.Println("检测到accounts表缺少user_id列，正在添加...")
		_, err = DB.Exec(`ALTER TABLE accounts ADD COLUMN user_id INTEGER DEFAULT 0`)
		if err != nil {
			return fmt.Errorf("添加user_id列失败: %v", err)
		}
		log.Println("已成功添加user_id列到accounts表")
	}

	// 创建用户店铺权限表
	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS user_store_permissions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		store_id INTEGER NOT NULL,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (store_id) REFERENCES stores(id),
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
		store_id INTEGER,
		income_type_id INTEGER,
		expense_type_id INTEGER,
		create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (store_id) REFERENCES stores(id),
		FOREIGN KEY (income_type_id) REFERENCES account_types(id),
		FOREIGN KEY (expense_type_id) REFERENCES account_types(id)
	)
	`)

	if err != nil {
		return fmt.Errorf("创建用户默认设置表失败: %w", err)
	}

	return nil
}

// EnsureDatabaseTables 确保所有必要的数据库表存在
// func EnsureDatabaseTables() error {
// 	// 首先尝试创建所有基本表结构
// 	if err := CreateTables(); err != nil {
// 		return fmt.Errorf("创建基本表结构失败: %v", err)
// 	}

// 	// 检查accounts表中是否存在user_id列
// 	var columnExists bool
// 	err := DB.QueryRow(`
// 		SELECT COUNT(*) > 0
// 		FROM pragma_table_info('accounts')
// 		WHERE name = 'user_id'
// 	`).Scan(&columnExists)
// 	if err != nil {
// 		return fmt.Errorf("检查user_id列失败: %v", err)
// 	}

// 	// 如果accounts表中不存在user_id列，添加该列
// 	if !columnExists {
// 		log.Println("检测到accounts表缺少user_id列，正在添加...")
// 		_, err = DB.Exec(`ALTER TABLE accounts ADD COLUMN user_id INTEGER DEFAULT 0`)
// 		if err != nil {
// 			return fmt.Errorf("添加user_id列失败: %v", err)
// 		}
// 		log.Println("已成功添加user_id列到accounts表")
// 	}

// 	return nil
// }

// 添加初始化products表的函数
func initProducts() error {
	// 检查是否已有产品数据
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	if err != nil {
		return fmt.Errorf("检查产品数据失败: %v", err)
	}

	// 如果已有数据，则跳过
	if count > 0 {
		return nil
	}

	// 插入默认产品数据
	_, err = DB.Exec(`
		INSERT INTO products (id, name, description, price, stock) VALUES 
		(1, '减脂套餐A', '标准减脂套餐', 199.00, 100),
		(2, '减脂套餐B', '高级减脂套餐', 299.00, 100),
		(3, '全身按摩', '舒缓减压全身按摩', 159.00, 100),
		(4, '排毒养颜', '排毒养颜护理', 259.00, 100),
		(5, '塑形护理', '专业塑形护理', 359.00, 100)
	`)
	if err != nil {
		return fmt.Errorf("初始化产品数据失败: %v", err)
	}

	log.Println("产品数据初始化成功")
	return nil
}

// 添加初始化客户数据的函数
func initCustomers() error {
	// 检查是否已有客户数据
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM customers").Scan(&count)
	if err != nil {
		return fmt.Errorf("检查客户数据失败: %v", err)
	}

	// 如果已有数据，则跳过
	if count > 0 {
		return nil
	}

	// 插入测试客户数据
	_, err = DB.Exec(`
		INSERT INTO customers (id, name, phone, gender, age, height, initial_weight, current_weight, target_weight) VALUES 
		(1, '张三', '13800138001', 1, 30, 175, 80, 75, 65),
		(2, '李四', '13800138002', 1, 28, 170, 75, 72, 65),
		(3, '王五', '13800138003', 1, 35, 180, 90, 85, 75),
		(4, '赵六', '13800138004', 1, 40, 178, 85, 80, 70),
		(5, '钱七', '13800138005', 1, 25, 172, 70, 68, 60),
		(6, '孙八', '13800138006', 1, 32, 176, 82, 80, 72)
	`)
	if err != nil {
		return fmt.Errorf("初始化客户数据失败: %v", err)
	}

	log.Println("客户数据初始化成功")
	return nil
}

// InitDB 初始化数据库
// 注意：此函数与db.go中的InitDB重复，需要保留db.go中的函数，移除此处的函数
/*
func InitDB() error {
	// 创建必要的数据表
	err := CreateTables()
	if err != nil {
		return fmt.Errorf("创建数据表失败: %v", err)
	}

	// 初始化产品数据
	err = initProducts()
	if err != nil {
		log.Printf("初始化产品数据失败: %v", err)
		// 继续执行，不要因为这个错误而终止整个程序
	}

	// 初始化客户数据
	err = initCustomers()
	if err != nil {
		log.Printf("初始化客户数据失败: %v", err)
		// 继续执行，不要因为这个错误而终止整个程序
	}

	return nil
}
*/

// 其余函数保持不变
