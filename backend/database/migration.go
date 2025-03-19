package database

import (
	"fmt"
	"log"
)

// CheckAndMigrateTables 检查并迁移缺少的表和列
func CheckAndMigrateTables() error {
	log.Println("检查数据库表结构...")

	// 先检查基本表是否存在
	tables := []string{"users", "stores", "account_types", "accounts", "user_store_permissions"}

	for _, table := range tables {
		var count int
		err := DB.QueryRow(`
			SELECT COUNT(*) FROM sqlite_master 
			WHERE type='table' AND name=?
		`, table).Scan(&count)

		if err != nil {
			log.Printf("检查表 %s 失败: %v", table, err)
			continue
		}

		if count == 0 {
			log.Printf("表 %s 不存在，需要先运行ResetDatabase", table)
			// 跳过进一步的检查，因为基本表不存在
			return fmt.Errorf("基本表 %s 不存在", table)
		}
	}

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

	// 检查是否存在user_default_settings表
	err = DB.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master 
		WHERE type='table' AND name='user_default_settings'
	`).Scan(&count)

	if err != nil {
		return err
	}

	// 如果不存在user_default_settings表，则创建
	if count == 0 {
		log.Println("创建user_default_settings表...")
		_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS user_default_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			store_id INTEGER,
			income_type_id INTEGER,
			expense_type_id INTEGER,
			create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
			FOREIGN KEY (income_type_id) REFERENCES account_types(id) ON DELETE SET NULL,
			FOREIGN KEY (expense_type_id) REFERENCES account_types(id) ON DELETE SET NULL
		)
		`)

		if err != nil {
			return err
		}

		log.Println("user_default_settings表创建成功")
	} else {
		// 检查user_default_settings表的结构
		log.Println("检查user_default_settings表结构...")

		// 检查是否有store_id列
		var hasStoreID int
		err = DB.QueryRow(`
			SELECT COUNT(*) FROM pragma_table_info('user_default_settings') 
			WHERE name = 'store_id'
		`).Scan(&hasStoreID)

		if err != nil {
			return err
		}

		// 如果没有store_id列但有default_store_id列，则重命名
		if hasStoreID == 0 {
			// 检查是否有default_store_id列
			var hasDefaultStoreID int
			err = DB.QueryRow(`
				SELECT COUNT(*) FROM pragma_table_info('user_default_settings') 
				WHERE name = 'default_store_id'
			`).Scan(&hasDefaultStoreID)

			if err != nil {
				return err
			}

			if hasDefaultStoreID > 0 {
				log.Println("重命名user_default_settings表的default_store_id列为store_id...")

				// SQLite不支持直接重命名列，需要重建表
				_, err = DB.Exec(`
					BEGIN TRANSACTION;
					
					-- 创建临时表
					CREATE TABLE user_default_settings_temp (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER NOT NULL,
						store_id INTEGER,
						income_type_id INTEGER,
						expense_type_id INTEGER,
						create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
						update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
						FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
						FOREIGN KEY (income_type_id) REFERENCES account_types(id) ON DELETE SET NULL,
						FOREIGN KEY (expense_type_id) REFERENCES account_types(id) ON DELETE SET NULL
					);
					
					-- 复制数据，将default_store_id映射到store_id
					INSERT INTO user_default_settings_temp (id, user_id, store_id, income_type_id, expense_type_id, create_time, update_time)
					SELECT id, user_id, default_store_id, income_type_id, expense_type_id, create_time, update_time
					FROM user_default_settings;
					
					-- 删除旧表
					DROP TABLE user_default_settings;
					
					-- 重命名新表
					ALTER TABLE user_default_settings_temp RENAME TO user_default_settings;
					
					COMMIT;
				`)

				if err != nil {
					log.Printf("重命名列失败: %v", err)
					return err
				}

				log.Println("成功重命名user_default_settings表的列")
			} else {
				// 如果两个列都不存在，则添加store_id列
				log.Println("在user_default_settings表中添加store_id列...")
				_, err = DB.Exec(`ALTER TABLE user_default_settings ADD COLUMN store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL`)

				if err != nil {
					return err
				}
			}
		}

		// 检查是否有income_type_id和expense_type_id列
		var hasIncomeTypeID, hasExpenseTypeID int
		err = DB.QueryRow(`
			SELECT COUNT(*) FROM pragma_table_info('user_default_settings') 
			WHERE name = 'income_type_id'
		`).Scan(&hasIncomeTypeID)

		if err != nil {
			return err
		}

		if hasIncomeTypeID == 0 {
			log.Println("在user_default_settings表中添加income_type_id列...")
			_, err = DB.Exec(`ALTER TABLE user_default_settings ADD COLUMN income_type_id INTEGER REFERENCES account_types(id) ON DELETE SET NULL`)

			if err != nil {
				return err
			}
		}

		err = DB.QueryRow(`
			SELECT COUNT(*) FROM pragma_table_info('user_default_settings') 
			WHERE name = 'expense_type_id'
		`).Scan(&hasExpenseTypeID)

		if err != nil {
			return err
		}

		if hasExpenseTypeID == 0 {
			log.Println("在user_default_settings表中添加expense_type_id列...")
			_, err = DB.Exec(`ALTER TABLE user_default_settings ADD COLUMN expense_type_id INTEGER REFERENCES account_types(id) ON DELETE SET NULL`)

			if err != nil {
				return err
			}
		}
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

	// 检查accounts表中是否有user_id列
	var hasUserID int
	err = DB.QueryRow(`
		SELECT COUNT(*) FROM pragma_table_info('accounts') 
		WHERE name = 'user_id'
	`).Scan(&hasUserID)

	if err != nil {
		return err
	}

	// 如果accounts表中没有user_id列，则添加
	if hasUserID == 0 {
		log.Println("向accounts表添加user_id列...")
		_, err = DB.Exec(`
			ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)
		`)

		if err != nil {
			log.Printf("添加user_id列失败: %v", err)
			return err
		}

		log.Println("user_id列添加成功")
	}

	log.Println("数据库迁移完成")
	return nil
}
