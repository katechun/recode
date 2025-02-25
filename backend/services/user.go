package services

import (
	"database/sql"
	"errors"
	"log"
	"time"

	"account/backend/database"
	"account/backend/models"
)

// UserService 用户相关服务
type UserService struct{}

// 登录认证
func (s *UserService) Login(username, password string) (*models.User, error) {
	var user models.User

	// 用于处理可能为NULL的字段
	var nullablePhone, nullableEmail, nullableAvatar, nullableNickname sql.NullString
	var nullableLastLogin sql.NullTime

	log.Printf("尝试登录，用户名: %s", username)

	// 先查询用户是否存在
	var exists bool
	err := database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)", username).Scan(&exists)
	if err != nil {
		log.Printf("查询用户是否存在失败: %v", err)
		return nil, errors.New("登录过程发生错误")
	}

	if !exists {
		log.Printf("用户不存在: %s", username)
		return nil, errors.New("用户名或密码错误")
	}

	// 查询用户
	err = database.DB.QueryRow(`
		SELECT id, username, nickname, role, phone, email, avatar, create_time, update_time, last_login
		FROM users
		WHERE username = ? AND password = ?
	`, username, password).Scan(
		&user.ID, &user.Username, &nullableNickname, &user.Role,
		&nullablePhone, &nullableEmail, &nullableAvatar, &user.CreateTime,
		&user.UpdateTime, &nullableLastLogin,
	)

	if err != nil {
		log.Printf("用户验证失败: %v", err)
		return nil, errors.New("用户名或密码错误")
	}

	// 将可能为NULL的字段转换为字符串
	if nullableNickname.Valid {
		user.Nickname = nullableNickname.String
	}
	if nullablePhone.Valid {
		user.Phone = nullablePhone.String
	}
	if nullableEmail.Valid {
		user.Email = nullableEmail.String
	}
	if nullableAvatar.Valid {
		user.Avatar = nullableAvatar.String
	}
	if nullableLastLogin.Valid {
		user.LastLogin = nullableLastLogin.Time
	}

	log.Printf("用户 %s 登录成功，角色: %d", username, user.Role)

	// 更新最后登录时间
	_, err = database.DB.Exec(`
		UPDATE users SET last_login = ? WHERE id = ?
	`, time.Now(), user.ID)

	if err != nil {
		log.Printf("更新最后登录时间失败: %v", err)
	}

	return &user, nil
}

// 获取用户详情
func (s *UserService) GetUserByID(id int64) (*models.User, error) {
	var user models.User

	// 用于处理可能为NULL的字段
	var nullablePhone, nullableEmail, nullableAvatar, nullableNickname sql.NullString
	var nullableLastLogin sql.NullTime

	err := database.DB.QueryRow(`
		SELECT id, username, nickname, role, phone, email, avatar, create_time, update_time, last_login
		FROM users
		WHERE id = ?
	`, id).Scan(
		&user.ID, &user.Username, &nullableNickname, &user.Role,
		&nullablePhone, &nullableEmail, &nullableAvatar, &user.CreateTime,
		&user.UpdateTime, &nullableLastLogin,
	)

	if err != nil {
		return nil, errors.New("用户不存在")
	}

	// 将可能为NULL的字段转换为字符串
	if nullableNickname.Valid {
		user.Nickname = nullableNickname.String
	}
	if nullablePhone.Valid {
		user.Phone = nullablePhone.String
	}
	if nullableEmail.Valid {
		user.Email = nullableEmail.String
	}
	if nullableAvatar.Valid {
		user.Avatar = nullableAvatar.String
	}
	if nullableLastLogin.Valid {
		user.LastLogin = nullableLastLogin.Time
	}

	return &user, nil
}
