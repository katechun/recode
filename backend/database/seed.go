package database

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

// 创建测试数据
func CreateTestData() error {
	// 确保用户表中有管理员账号
	adminExists, err := checkUserExists("admin")
	if err != nil {
		return fmt.Errorf("检查管理员是否存在失败: %w", err)
	}

	if !adminExists {
		// 创建管理员账号
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("加密管理员密码失败: %w", err)
		}

		_, err = DB.Exec(`
			INSERT INTO users (username, nickname, password, role, avatar)
			VALUES (?, ?, ?, ?, ?)
		`, "admin", "系统管理员", string(hashedPassword), 1, "")

		if err != nil {
			return fmt.Errorf("创建管理员账号失败: %w", err)
		}
		log.Println("创建默认管理员账号成功")
	}

	// 创建测试店员账号
	clerkExists, err := checkUserExists("clerk")
	if err != nil {
		return fmt.Errorf("检查店员是否存在失败: %w", err)
	}

	if !clerkExists {
		// 创建店员账号
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("clerk123"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("加密店员密码失败: %w", err)
		}

		_, err = DB.Exec(`
			INSERT INTO users (username, nickname, password, role, avatar)
			VALUES (?, ?, ?, ?, ?)
		`, "clerk", "测试店员", string(hashedPassword), 0, "")

		if err != nil {
			return fmt.Errorf("创建店员账号失败: %w", err)
		}
		log.Println("创建默认店员账号成功")
	}

	// 添加测试店铺数据
	storesData := []struct {
		name    string
		address string
		phone   string // 删除contact字段，匹配stores表结构
	}{
		{"总店", "北京市朝阳区", "13800138000"},
		{"分店1", "上海市浦东新区", "13900139000"},
		{"分店2", "广州市天河区", "13700137000"},
	}

	for _, store := range storesData {
		_, err := DB.Exec(`
			INSERT INTO stores (name, address, phone)
			VALUES (?, ?, ?)
		`, store.name, store.address, store.phone)

		if err != nil {
			log.Printf("插入店铺数据失败: %v", err)
		}
	}

	// 添加测试账务类型
	accountTypesData := []struct {
		name      string
		isExpense bool
		icon      string
		sortOrder int
	}{
		{"销售收入", false, "sale", 1},
		{"其他收入", false, "other", 2},
		{"进货支出", true, "purchase", 1},
		{"水电费", true, "utility", 2},
		{"工资", true, "salary", 3},
	}

	for _, accountType := range accountTypesData {
		// 在account_types表中，category字段值为1表示收入，2表示支出
		categoryValue := 1
		if accountType.isExpense {
			categoryValue = 2
		}

		// 添加更多调试信息
		log.Printf("插入账务类型: %s, 分类: %d, 是否支出: %v",
			accountType.name, categoryValue, accountType.isExpense)

		// 使用category字段替代type，确保非空
		_, err := DB.Exec(`
			INSERT INTO account_types (name, category, icon, sort_order, is_expense)
			VALUES (?, ?, ?, ?, ?)
		`, accountType.name, categoryValue, accountType.icon, accountType.sortOrder, accountType.isExpense)

		if err != nil {
			log.Printf("插入账务类型失败: %v", err)
		}
	}

	log.Println("测试数据插入完成")
	return nil
}

// FixForeignKeyReferences 添加必要的关联数据修复函数
func FixForeignKeyReferences() error {
	// 确保用户和店铺的关联存在
	var adminID, clerkID, storeID int64

	// 获取管理员ID
	err := DB.QueryRow("SELECT id FROM users WHERE username = ?", "admin").Scan(&adminID)
	if err != nil {
		return fmt.Errorf("获取管理员ID失败: %w", err)
	}

	// 获取店员ID
	err = DB.QueryRow("SELECT id FROM users WHERE username = ?", "clerk").Scan(&clerkID)
	if err != nil {
		return fmt.Errorf("获取店员ID失败: %w", err)
	}

	// 获取店铺ID
	err = DB.QueryRow("SELECT id FROM stores WHERE name = ?", "总店").Scan(&storeID)
	if err != nil {
		return fmt.Errorf("获取店铺ID失败: %w", err)
	}

	// 创建用户-店铺关联
	_, err = DB.Exec(`
		INSERT OR IGNORE INTO user_store (user_id, store_id, permission)
		VALUES (?, ?, ?)
	`, adminID, storeID, 3)

	if err != nil {
		return fmt.Errorf("添加管理员店铺权限失败: %w", err)
	}

	_, err = DB.Exec(`
		INSERT OR IGNORE INTO user_store (user_id, store_id, permission)
		VALUES (?, ?, ?)
	`, clerkID, storeID, 2)

	if err != nil {
		return fmt.Errorf("添加店员店铺权限失败: %w", err)
	}

	return nil
}

// 检查用户是否存在
func checkUserExists(username string) (bool, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// 添加账户数据的外键检查
func InsertTestAccount() error {
	// 首先确保类型存在
	var expenseTypeID, incomeTypeID int64

	// 获取收入类型ID
	err := DB.QueryRow("SELECT id FROM account_types WHERE name = ? LIMIT 1",
		"销售收入").Scan(&incomeTypeID)
	if err != nil {
		log.Printf("获取收入类型ID失败: %v, 尝试插入默认收入类型", err)
		// 插入默认收入类型
		result, err := DB.Exec(
			"INSERT INTO account_types (name, category, icon, sort_order, is_expense) VALUES (?, ?, ?, ?, ?)",
			"销售收入", 1, "sale", 1, false)
		if err != nil {
			return fmt.Errorf("插入默认收入类型失败: %w", err)
		}
		incomeTypeID, _ = result.LastInsertId()
	}

	// 获取支出类型ID
	err = DB.QueryRow("SELECT id FROM account_types WHERE name = ? LIMIT 1",
		"进货支出").Scan(&expenseTypeID)
	if err != nil {
		log.Printf("获取支出类型ID失败: %v, 尝试插入默认支出类型", err)
		// 插入默认支出类型
		result, err := DB.Exec(
			"INSERT INTO account_types (name, category, icon, sort_order, is_expense) VALUES (?, ?, ?, ?, ?)",
			"进货支出", 2, "purchase", 1, true)
		if err != nil {
			return fmt.Errorf("插入默认支出类型失败: %w", err)
		}
		expenseTypeID, _ = result.LastInsertId()
	}

	return nil
}

// 查找并修复这个函数
func InsertTestData() {
	// 修复账务类型插入
	_, err := DB.Exec(`
		INSERT OR IGNORE INTO account_types (name, category, icon, sort_order, is_expense)
		VALUES 
		('销售收入', 1, 'sale', 1, 0),
		('其他收入', 1, 'other', 2, 0),
		('进货支出', 2, 'purchase', 1, 1),
		('水电费', 2, 'utility', 2, 1),
		('工资', 2, 'salary', 3, 1)
	`)
	
	if err != nil {
		log.Printf("插入账务类型测试数据失败: %v", err)
		return
	}
	
	log.Println("账务类型测试数据已插入")
	
	// 其他测试数据插入...
}
