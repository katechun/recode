package database

import (
	"account/backend/models"
	"fmt"
	"log"
)

// CreateTestUsers 创建测试用户数据
func CreateTestUsers() error {
	log.Println("开始创建测试用户数据...")

	// 创建测试用户
	adminExists, err := CheckUserExists("admin")
	if err != nil {
		return fmt.Errorf("检查admin用户失败: %w", err)
	}

	if !adminExists {
		log.Println("创建admin用户...")
		_, err = CreateUser(models.User{
			Username: "admin",
			Password: "admin123",
			Nickname: "管理员",
			Role:     1, // 管理员角色
		})
		if err != nil {
			return fmt.Errorf("创建admin用户失败: %w", err)
		}
	}

	// 创建staff1测试用户
	staff1Exists, err := CheckUserExists("staff1")
	if err != nil {
		return fmt.Errorf("检查staff1用户失败: %w", err)
	}

	if !staff1Exists {
		log.Println("创建staff1用户...")
		_, err = CreateUser(models.User{
			Username: "staff1",
			Password: "staff123",
			Nickname: "店员1",
			Role:     2, // 普通用户角色
		})
		if err != nil {
			return fmt.Errorf("创建staff1用户失败: %w", err)
		}
	}

	// 创建staff2测试用户
	staff2Exists, err := CheckUserExists("staff2")
	if err != nil {
		return fmt.Errorf("检查staff2用户失败: %w", err)
	}

	if !staff2Exists {
		log.Println("创建staff2用户...")
		_, err = CreateUser(models.User{
			Username: "staff2",
			Password: "staff123",
			Nickname: "店员2",
			Role:     2, // 普通用户角色
		})
		if err != nil {
			return fmt.Errorf("创建staff2用户失败: %w", err)
		}
	}

	// 其他测试数据创建...

	log.Println("测试用户数据创建完成")
	return nil
}
