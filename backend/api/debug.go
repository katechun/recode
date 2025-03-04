package api

import (
	"log"
	"net/http"
	
	"account/backend/database"
	"account/backend/models"
)

// CreateTestUsers 创建测试用户的调试接口
func CreateTestUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}
	
	log.Println("开始创建测试用户...")
	
	// 创建测试用户
	users := []models.User{
		{
			Username: "admin",
			Password: "admin123",
			Nickname: "管理员",
			Role:     1, // 管理员角色
		},
		{
			Username: "staff1",
			Password: "staff123",
			Nickname: "店员1",
			Role:     2, // 普通用户角色
		},
		{
			Username: "staff2",
			Password: "staff123",
			Nickname: "店员2",
			Role:     2, // 普通用户角色
		},
	}
	
	createdUsers := make([]string, 0)
	
	for _, user := range users {
		exists, _ := database.CheckUserExists(user.Username)
		if !exists {
			_, err := database.CreateUser(user)
			if err != nil {
				log.Printf("创建用户 %s 失败: %v", user.Username, err)
				continue
			}
			createdUsers = append(createdUsers, user.Username)
			log.Printf("已创建用户: %s", user.Username)
		} else {
			log.Printf("用户 %s 已存在", user.Username)
		}
	}
	
	SendResponse(w, http.StatusOK, 200, "创建测试用户操作完成", map[string]interface{}{
		"created": createdUsers,
	})
} 