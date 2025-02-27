package database

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// 确保 DB 变量是正确定义的
var DB *sql.DB

// ResetDatabase 重置数据库
func ResetDatabase() error {
	// 先执行表检查和创建
	if err := createTables(); err != nil {
		log.Printf("创建基础表结构失败: %v", err)
		return err
	}

	// 先删除旧表
	_, err := DB.Exec("DROP TABLE IF EXISTS user_default_settings")
	if err != nil {
		return err
	}
	
	// 创建默认设置表 (在创建其他表后)
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS user_default_settings (
            user_id BIGINT PRIMARY KEY,
            store_id BIGINT NOT NULL,
            income_type_id BIGINT NOT NULL,
            expense_type_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (store_id) REFERENCES stores(id),
            FOREIGN KEY (income_type_id) REFERENCES account_types(id),
            FOREIGN KEY (expense_type_id) REFERENCES account_types(id)
        )
    `)
	if err != nil {
		log.Printf("创建默认设置表失败: %v", err)
		return err
	}

	// 添加触发器，自动更新 updated_at 字段
	_, err = DB.Exec(`
        CREATE TRIGGER IF NOT EXISTS update_user_default_settings_trigger
        AFTER UPDATE ON user_default_settings
        FOR EACH ROW
        BEGIN
            UPDATE user_default_settings SET updated_at = CURRENT_TIMESTAMP
            WHERE user_id = OLD.user_id;
        END;
    `)
	if err != nil {
		log.Printf("创建更新触发器失败: %v", err)
		return err
	}

	return nil
}

// InitDB 初始化数据库连接
func InitDB() {
	// 确保数据目录存在
	dbDir := "./data"
	if _, err := os.Stat(dbDir); os.IsNotExist(err) {
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			log.Fatalf("无法创建数据目录: %v", err)
		}
	}

	// 连接数据库
	dbPath := filepath.Join(dbDir, "account.db")
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("无法连接数据库: %v", err)
	}
	
	// 设置连接池参数
	DB.SetMaxOpenConns(10)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(time.Hour)

	// 验证连接
	if err = DB.Ping(); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	
	log.Printf("成功连接到数据库: %s", dbPath)

	// 创建数据库表
	if err := createTables(); err != nil {
		log.Fatalf("创建数据库表失败: %v", err)
	}
} 