package database

import (
	"fmt"
	"log"
	"math/rand"
	"time"

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

// InitializeCustomerTestData 初始化客户管理相关测试数据
func InitializeCustomerTestData() error {
	log.Println("开始初始化客户管理测试数据...")

	// 检查是否已有客户数据
	var customerCount int
	err := DB.QueryRow("SELECT COUNT(*) FROM customers").Scan(&customerCount)
	if err != nil {
		return fmt.Errorf("检查客户数据失败: %w", err)
	}

	// 如果已有客户数据，则跳过
	if customerCount > 0 {
		log.Println("已存在客户数据，跳过初始化")
		return nil
	}

	// 获取店铺列表用于关联
	var storeIDs []int
	rows, err := DB.Query("SELECT id FROM stores ORDER BY id")
	if err != nil {
		return fmt.Errorf("获取店铺列表失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("读取店铺ID失败: %w", err)
		}
		storeIDs = append(storeIDs, id)
	}

	if len(storeIDs) == 0 {
		// 如果没有店铺，创建一个默认店铺
		result, err := DB.Exec("INSERT INTO stores (name, address, phone) VALUES ('总店', '默认地址', '12345678')")
		if err != nil {
			return fmt.Errorf("创建默认店铺失败: %w", err)
		}
		id, err := result.LastInsertId()
		if err != nil {
			return fmt.Errorf("获取新店铺ID失败: %w", err)
		}
		storeIDs = append(storeIDs, int(id))
	}

	// 创建示例客户数据
	customers := []struct {
		name          string
		phone         string
		gender        int
		age           int
		height        float64
		initialWeight float64
		currentWeight float64
		targetWeight  float64
		storeID       int
		notes         string
	}{
		{
			name:          "张三",
			phone:         "13800138001",
			gender:        1, // 1-男，2-女
			age:           30,
			height:        175.0,
			initialWeight: 85.0,
			currentWeight: 82.5,
			targetWeight:  75.0,
			storeID:       storeIDs[0],
			notes:         "每周三定期复诊",
		},
		{
			name:          "李四",
			phone:         "13800138002",
			gender:        1,
			age:           28,
			height:        180.0,
			initialWeight: 90.0,
			currentWeight: 85.0,
			targetWeight:  80.0,
			storeID:       storeIDs[0],
			notes:         "对某些成分过敏",
		},
		{
			name:          "王五",
			phone:         "13800138003",
			gender:        1,
			age:           35,
			height:        172.0,
			initialWeight: 78.0,
			currentWeight: 75.0,
			targetWeight:  70.0,
			storeID:       storeIDs[0],
			notes:         "有高血压病史",
		},
		{
			name:          "赵六",
			phone:         "13800138004",
			gender:        2,
			age:           26,
			height:        165.0,
			initialWeight: 65.0,
			currentWeight: 62.0,
			targetWeight:  55.0,
			storeID:       storeIDs[0],
			notes:         "产后减肥",
		},
		{
			name:          "钱七",
			phone:         "13800138005",
			gender:        2,
			age:           32,
			height:        160.0,
			initialWeight: 58.0,
			currentWeight: 56.0,
			targetWeight:  50.0,
			storeID:       storeIDs[0],
			notes:         "关注腰部赘肉",
		},
	}

	// 插入客户数据
	now := time.Now()
	for _, c := range customers {
		_, err = DB.Exec(`
			INSERT INTO customers (
				name, phone, gender, age, height, initial_weight, 
				current_weight, target_weight, store_id, notes, 
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			c.name, c.phone, c.gender, c.age, c.height, c.initialWeight,
			c.currentWeight, c.targetWeight, c.storeID, c.notes,
			now, now,
		)
		if err != nil {
			return fmt.Errorf("创建客户数据失败: %w", err)
		}
	}

	// 创建产品数据
	products := []struct {
		name    string
		storeID int
		price   float64
		stock   int
		notes   string
	}{
		{
			name:    "减肥茶",
			storeID: storeIDs[0],
			price:   198.0,
			stock:   100,
			notes:   "每日两次，早晚饭后服用",
		},
		{
			name:    "代餐粉",
			storeID: storeIDs[0],
			price:   258.0,
			stock:   80,
			notes:   "替代早餐或晚餐",
		},
		{
			name:    "纤体霜",
			storeID: storeIDs[0],
			price:   328.0,
			stock:   50,
			notes:   "每日涂抹两次",
		},
	}

	// 插入产品数据
	for _, p := range products {
		_, err = DB.Exec(`
			INSERT INTO products (
				name, store_id, price, stock, notes, 
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
			p.name, p.storeID, p.price, p.stock, p.notes,
			now, now,
		)
		if err != nil {
			return fmt.Errorf("创建产品数据失败: %w", err)
		}
	}

	// 获取创建的客户ID
	var customerIDs []int
	rows, err = DB.Query("SELECT id FROM customers ORDER BY id")
	if err != nil {
		return fmt.Errorf("获取客户列表失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("读取客户ID失败: %w", err)
		}
		customerIDs = append(customerIDs, id)
	}

	// 获取创建的产品ID
	var productIDs []int
	rows, err = DB.Query("SELECT id FROM products ORDER BY id")
	if err != nil {
		return fmt.Errorf("获取产品列表失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("读取产品ID失败: %w", err)
		}
		productIDs = append(productIDs, id)
	}

	// 创建体重记录
	for _, customerID := range customerIDs[:3] { // 只为前三个客户创建记录
		// 每个客户创建3条体重记录
		for i := 0; i < 3; i++ {
			recordDate := now.AddDate(0, 0, -i*7) // 每7天一条记录
			weight := 80.0 - float64(i)*2.5       // 体重逐渐减少

			_, err = DB.Exec(`
				INSERT INTO weight_records (
					customer_id, weight, record_date, notes, created_at
				) VALUES (?, ?, ?, ?, ?)
			`,
				customerID, weight, recordDate.Format("2006-01-02"),
				fmt.Sprintf("第%d次测量", i+1), recordDate,
			)
			if err != nil {
				return fmt.Errorf("创建体重记录失败: %w", err)
			}
		}
	}

	// 创建产品使用记录
	for _, customerID := range customerIDs {
		// 每个客户使用1-2个产品
		for i := 0; i < rand.Intn(2)+1; i++ {
			productID := productIDs[rand.Intn(len(productIDs))]
			usageDate := now.AddDate(0, 0, -rand.Intn(30)) // 过去30天内的随机一天

			_, err = DB.Exec(`
				INSERT INTO product_usages (
					customer_id, product_id, usage_date, quantity, notes, created_at
				) VALUES (?, ?, ?, ?, ?, ?)
			`,
				customerID, productID, usageDate.Format("2006-01-02"),
				1.0, "正常使用", usageDate,
			)
			if err != nil {
				return fmt.Errorf("创建产品使用记录失败: %w", err)
			}
		}
	}

	log.Println("客户管理测试数据初始化完成")
	return nil
}

// InitializeTestData 初始化测试数据
func InitializeTestData() error {
	// 创建基础测试数据
	if err := CreateTestData(); err != nil {
		return fmt.Errorf("创建基础测试数据失败: %w", err)
	}

	// 添加店铺权限关联数据
	if err := FixForeignKeyReferences(); err != nil {
		return fmt.Errorf("设置用户店铺权限关联失败: %w", err)
	}

	// 初始化客户管理相关测试数据
	err := InitializeCustomerTestData()
	if err != nil {
		log.Printf("初始化客户管理测试数据失败: %v", err)
		return err
	}

	return nil
}
