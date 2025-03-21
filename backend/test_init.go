package main

import (
	"account/backend/database"
	"log"
	"os"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("开始测试初始化...")

	// 初始化数据库
	database.InitDB()

	// 创建必要的数据库表
	if err := database.CreateTables(); err != nil {
		log.Printf("数据库表结构初始化失败: %v", err)
		os.Exit(1)
	}
	log.Println("数据库表结构初始化成功")

	// 创建客户管理相关数据库表
	if err := database.CreateCustomerTables(); err != nil {
		log.Printf("客户管理数据库表结构初始化失败: %v", err)
		os.Exit(1)
	}
	log.Println("客户管理数据库表结构初始化成功")

	// 等待一秒钟确保所有日志输出
	time.Sleep(time.Second)
	log.Println("测试初始化完成，程序正常退出")
}
