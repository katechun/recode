package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	// 将 mattn/go-sqlite3 替换为纯 Go 实现
	// _ "github.com/mattn/go-sqlite3"
	_ "modernc.org/sqlite" // 使用纯 Go 实现的 SQLite 驱动
)

var (
	// DB 全局数据库连接
	DB *sql.DB
	// dbPath 全局数据库路径
	dbPath string
)

// CloseAndReset 关闭数据库连接并删除数据库文件
func CloseAndReset() error {
	// 先关闭数据库连接
	if DB != nil {
		err := DB.Close()
		if err != nil {
			return fmt.Errorf("关闭数据库连接失败: %v", err)
		}
		DB = nil
	}

	// 删除数据库文件
	if dbPath != "" {
		err := os.Remove(dbPath)
		if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("删除数据库文件失败: %v", err)
		}
	}

	log.Println("数据库连接已关闭，数据库文件已删除")
	return nil
}

// InitDB 初始化数据库连接
func InitDB() {
	// 确保data目录存在
	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("创建数据目录失败: %v", err)
	}

	dbPath = filepath.Join("./data", "account.db")
	log.Printf("数据库路径: %s", dbPath)

	// 使用纯 Go 实现的 SQLite 驱动
	// 连接字符串格式略有不同，但基本兼容
	// 增加 busy_timeout 参数，设置为5000毫秒(5秒)，解决数据库锁定问题
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_txlock=immediate", dbPath)
	var err error
	DB, err = sql.Open("sqlite", dsn) // 注意驱动名称从 sqlite3 改为 sqlite
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 验证连接
	if err := DB.Ping(); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	// 显式启用外键约束和设置忙等待超时
	_, err = DB.Exec(`
		PRAGMA foreign_keys = ON;
		PRAGMA busy_timeout = 5000;
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
	`)
	if err != nil {
		log.Printf("设置SQLite PRAGMA参数失败: %v", err)
	}

	log.Println("数据库连接成功，外键约束已启用")

	// 设置数据库连接池参数
	DB.SetMaxOpenConns(10)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(0) // 连接不过期
	DB.SetConnMaxIdleTime(0) // 空闲连接不过期

	// 检查并确保数据库表结构正确
	if err := EnsureDatabaseTables(); err != nil {
		log.Printf("数据库表结构检查失败: %v", err)
	}
}

// GetDB 返回数据库连接实例
func GetDB() *sql.DB {
	return DB
}

// GetDBPath 返回数据库文件路径
func GetDBPath() string {
	return dbPath
}
