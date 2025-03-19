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
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", dbPath)
	var err error
	DB, err = sql.Open("sqlite", dsn) // 注意驱动名称从 sqlite3 改为 sqlite
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 验证连接
	if err := DB.Ping(); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	log.Println("数据库连接成功")

	// 设置数据库连接池参数
	DB.SetMaxOpenConns(10)
	DB.SetMaxIdleConns(5)
}

// GetDB 返回数据库连接实例
func GetDB() *sql.DB {
	return DB
}

// GetDBPath 返回数据库文件路径
func GetDBPath() string {
	return dbPath
}
