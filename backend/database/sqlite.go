package database

import (
	"log"
	"time"

	"account/backend/utils"
)

// 创建必要的数据库表
// 移动到合适的位置，比如单独放在 tables.go 中

// 插入默认管理员账户
func InsertDefaultAdmin() {
	// 检查是否已有管理员
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 1").Scan(&count)
	if err != nil {
		log.Fatalf("查询管理员失败: %v", err)
	}

	// 已有管理员则不创建
	if count > 0 {
		return
	}

	// 创建默认管理员
	_, err = DB.Exec(`
		INSERT INTO users (username, password, nickname, role)
		VALUES (?, ?, ?, ?)
	`, "admin", "123456", "系统管理员", 1)

	if err != nil {
		log.Fatalf("创建默认管理员失败: %v", err)
	}

	log.Println("默认管理员创建成功")
}

// InsertTestDataLegacy 插入测试数据
func InsertTestDataLegacy() {
	// 插入店铺
	stores := []struct {
		name    string
		address string
		phone   string
	}{
		{"总店", "北京市朝阳区建国路88号", "010-12345678"},
		{"分店1", "上海市静安区南京西路100号", "021-87654321"},
		{"分店2", "广州市天河区天河路200号", "020-55556666"},
	}

	for _, store := range stores {
		// 检查店铺是否已存在
		var count int
		DB.QueryRow("SELECT COUNT(*) FROM stores WHERE name = ?", store.name).Scan(&count)
		if count > 0 {
			continue
		}

		_, err := DB.Exec(`
			INSERT INTO stores (name, address, phone)
			VALUES (?, ?, ?)
		`, store.name, store.address, store.phone)

		if err != nil {
			log.Printf("插入店铺数据失败: %v", err)
		}
	}

	// 插入测试店员
	staffs := []struct {
		username string
		password string
		nickname string
		phone    string
	}{
		{"staff1", "123456", "店员一", "13800138001"},
		{"staff2", "123456", "店员二", "13800138002"},
	}

	for _, staff := range staffs {
		// 检查用户是否已存在
		var count int
		DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", staff.username).Scan(&count)
		if count > 0 {
			continue
		}

		_, err := DB.Exec(`
			INSERT INTO users (username, password, nickname, role, phone)
			VALUES (?, ?, ?, ?, ?)
		`, staff.username, staff.password, staff.nickname, RoleStaff, staff.phone)

		if err != nil {
			log.Printf("插入店员数据失败: %v", err)
		}
	}

	// 插入账务类型
	accountTypes := []struct {
		name      string
		isExpense bool
	}{
		{"销售收入", false},
		{"工资支出", true},
		{"水电费", true},
		{"其他收入", false},
		{"其他支出", true},
	}

	for _, t := range accountTypes {
		// 检查是否已存在
		var count int
		DB.QueryRow("SELECT COUNT(*) FROM account_types WHERE name = ?", t.name).Scan(&count)
		if count == 0 {
			_, err := DB.Exec("INSERT INTO account_types (name, is_expense) VALUES (?, ?)",
				t.name, t.isExpense)
			if err != nil {
				log.Printf("插入账务类型失败: %v", err)
			}
		}
	}

	// 为店员设置店铺权限
	// 获取店员1的ID
	var staff1ID int64
	err := DB.QueryRow("SELECT id FROM users WHERE username = ?", "staff1").Scan(&staff1ID)
	if err != nil {
		log.Printf("获取店员ID失败: %v", err)
	} else {
		// 获取总店和分店1的ID
		var store1ID, store2ID int64
		DB.QueryRow("SELECT id FROM stores WHERE name = ?", "总店").Scan(&store1ID)
		DB.QueryRow("SELECT id FROM stores WHERE name = ?", "分店1").Scan(&store2ID)

		// 设置店员1可以管理总店和分店1
		for _, storeID := range []int64{store1ID, store2ID} {
			if storeID > 0 {
				// 检查权限是否已存在
				var count int
				DB.QueryRow("SELECT COUNT(*) FROM user_store_permissions WHERE user_id = ? AND store_id = ?",
					staff1ID, storeID).Scan(&count)
				if count == 0 {
					_, err = DB.Exec(`
						INSERT INTO user_store_permissions (user_id, store_id)
						VALUES (?, ?)
					`, staff1ID, storeID)
					if err != nil {
						log.Printf("设置店员权限失败: %v", err)
					}
				}
			}
		}
	}

	// 获取店员2的ID
	var staff2ID int64
	err = DB.QueryRow("SELECT id FROM users WHERE username = ?", "staff2").Scan(&staff2ID)
	if err != nil {
		log.Printf("获取店员ID失败: %v", err)
	} else {
		// 获取分店2的ID
		var store3ID int64
		DB.QueryRow("SELECT id FROM stores WHERE name = ?", "分店2").Scan(&store3ID)

		// 设置店员2只能管理分店2
		if store3ID > 0 {
			// 检查权限是否已存在
			var count int
			DB.QueryRow("SELECT COUNT(*) FROM user_store_permissions WHERE user_id = ? AND store_id = ?",
				staff2ID, store3ID).Scan(&count)
			if count == 0 {
				_, err = DB.Exec(`
					INSERT INTO user_store_permissions (user_id, store_id)
					VALUES (?, ?)
				`, staff2ID, store3ID)
				if err != nil {
					log.Printf("设置店员权限失败: %v", err)
				}
			}
		}
	}

	// 插入示例账务记录
	// 获取管理员ID
	var adminID int64
	err = DB.QueryRow("SELECT id FROM users WHERE username = ?", "admin").Scan(&adminID)
	if err != nil {
		log.Printf("获取管理员ID失败: %v", err)
		return
	}

	// 获取账务类型ID
	var salesIncomeID, salaryExpenseID, utilityExpenseID int64
	DB.QueryRow("SELECT id FROM account_types WHERE name = ?", "销售收入").Scan(&salesIncomeID)
	DB.QueryRow("SELECT id FROM account_types WHERE name = ?", "工资支出").Scan(&salaryExpenseID)
	DB.QueryRow("SELECT id FROM account_types WHERE name = ?", "水电费").Scan(&utilityExpenseID)

	// 获取店铺ID
	var store1ID, store2ID, store3ID int64
	DB.QueryRow("SELECT id FROM stores WHERE name = ?", "总店").Scan(&store1ID)
	DB.QueryRow("SELECT id FROM stores WHERE name = ?", "分店1").Scan(&store2ID)
	DB.QueryRow("SELECT id FROM stores WHERE name = ?", "分店2").Scan(&store3ID)

	// 检查是否已有账务记录
	var accountCount int
	DB.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&accountCount)
	if accountCount > 0 {
		return // 已有账务记录，不再插入
	}

	// 示例交易时间
	currentTime := time.Now()
	yesterday := currentTime.AddDate(0, 0, -1)
	twoDaysAgo := currentTime.AddDate(0, 0, -2)

	// 插入账务记录
	accounts := []struct {
		storeID         int64
		userID          int64
		typeID          int64
		amount          float64
		remark          string
		transactionTime time.Time
	}{
		{store1ID, adminID, salesIncomeID, 1200, "日常销售", currentTime},
		{store2ID, staff1ID, utilityExpenseID, -300, "水电费支出", currentTime},
		{store3ID, staff2ID, salaryExpenseID, -5000, "员工工资", yesterday},
		{store1ID, adminID, salesIncomeID, 2000, "周末促销", yesterday},
		{store2ID, staff1ID, salesIncomeID, 1500, "节日活动", twoDaysAgo},
	}

	for _, account := range accounts {
		_, err := DB.Exec(`
			INSERT INTO accounts (store_id, user_id, type_id, amount, remark, transaction_time)
			VALUES (?, ?, ?, ?, ?, ?)
		`, account.storeID, account.userID, account.typeID, account.amount, account.remark, account.transactionTime)

		if err != nil {
			log.Printf("插入账务记录失败: %v", err)
		}
	}

	log.Println("测试数据插入完成")
	log.Println("账务类型测试数据已插入")
}

// GetAllUsersDebug 获取所有用户，仅用于调试
func GetAllUsersDebug() ([]map[string]interface{}, error) {
	rows, err := DB.Query(`
		SELECT id, username, nickname, role, phone, email
		FROM users
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var username, nickname, phone, email string
		var role int
		err := rows.Scan(&id, &username, &nickname, &role, &phone, &email)
		if err != nil {
			return nil, err
		}

		user := map[string]interface{}{
			"id":       id,
			"username": username,
			"nickname": nickname,
			"role":     role,
			"phone":    phone,
			"email":    email,
		}
		users = append(users, user)
	}

	return users, nil
}

// UpdateAccountTypeTable 更新账务类型表结构
func UpdateAccountTypeTable() {
	// 检查表是否有is_expense列
	var hasIsExpense bool
	rows, err := DB.Query("PRAGMA table_info(account_types)")
	if err != nil {
		log.Printf("检查账务类型表结构失败: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cid, notnull, pk int
		var name, typ string
		var dflt_value interface{}
		err = rows.Scan(&cid, &name, &typ, &notnull, &dflt_value, &pk)
		if err != nil {
			log.Printf("读取表结构失败: %v", err)
			return
		}
		if name == "is_expense" {
			hasIsExpense = true
			break
		}
	}

	if !hasIsExpense {
		// 创建临时表
		_, err := DB.Exec(`
			CREATE TABLE account_types_temp (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				is_expense BOOLEAN NOT NULL DEFAULT 0,
				create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`)
		if err != nil {
			log.Printf("创建临时表失败: %v", err)
			return
		}

		// 复制数据，根据category字段设置is_expense
		_, err = DB.Exec(`
			INSERT INTO account_types_temp (id, name, is_expense, create_time, update_time)
			SELECT id, name, 
				CASE WHEN category = '支出' THEN 1 ELSE 0 END as is_expense,
				create_time, update_time
			FROM account_types
		`)
		if err != nil {
			log.Printf("复制数据失败: %v", err)
			return
		}

		// 删除旧表
		_, err = DB.Exec("DROP TABLE account_types")
		if err != nil {
			log.Printf("删除旧表失败: %v", err)
			return
		}

		// 重命名新表
		_, err = DB.Exec("ALTER TABLE account_types_temp RENAME TO account_types")
		if err != nil {
			log.Printf("重命名表失败: %v", err)
			return
		}

		log.Println("账务类型表结构已更新")
	}
}

// InitUsersLegacy 初始化基本用户 (重命名以避免冲突)
func InitUsersLegacy() {
	log.Println("检查默认用户...")
	
	// 检查管理员账号
	var adminCount int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 1").Scan(&adminCount)
	if err != nil {
		log.Printf("检查管理员账号失败: %v", err)
		return
	}
	
	// 如果没有管理员账号，创建默认管理员
	if adminCount == 0 {
		// 使用utils包中的函数生成密码哈希
		hashedPassword, err := utils.HashPassword("admin123")
		if err != nil {
			log.Printf("生成密码哈希失败: %v", err)
			return
		}
		
		_, err = DB.Exec(`
			INSERT INTO users (username, password, nickname, role, create_time, update_time) 
			VALUES (?, ?, ?, ?, ?, ?)
		`, "admin", hashedPassword, "系统管理员", 1, time.Now(), time.Now())
		
		if err != nil {
			log.Printf("创建管理员账号失败: %v", err)
		} else {
			log.Println("创建默认管理员账号成功")
		}
	}

	// 检查店员账号
	var staffCount int
	err = DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 2").Scan(&staffCount)
	if err != nil {
		log.Printf("检查店员账号失败: %v", err)
		return
	}

	// 如果没有店员账号，创建默认店员
	if staffCount == 0 {
		// 使用utils包中的函数生成密码哈希
		hashedPassword, err := utils.HashPassword("staff123")
		if err != nil {
			log.Printf("生成密码哈希失败: %v", err)
			return
		}
		
		_, err = DB.Exec(`
			INSERT INTO users (username, password, nickname, role, create_time, update_time) 
			VALUES (?, ?, ?, ?, ?, ?)
		`, "staff1", hashedPassword, "默认店员", 2, time.Now(), time.Now())
		
		if err != nil {
			log.Printf("创建店员账号失败: %v", err)
		} else {
			log.Println("创建默认店员账号成功")
		}
	}
}
