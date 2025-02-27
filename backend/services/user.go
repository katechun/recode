package services

import (
	"database/sql"
	"errors"
	"log"
	"time"

	"account/backend/database"
	"account/backend/models"
	"account/backend/utils"
)

// UserService 用户相关服务
type UserService struct{}

// 登录认证
func (s *UserService) Login(username, password string) (*models.User, error) {
	var user models.User
	var hashedPassword string
	var userID int64
	var role int
	var nickname, phone, email, avatar sql.NullString
	var createTime, updateTime, lastLogin sql.NullTime

	// 修改查询语句，确保不区分大小写以及去除空格
	query := `SELECT id, username, password, role, nickname, phone, email, avatar, 
              create_time, update_time, last_login FROM users 
              WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))`
	err := database.DB.QueryRow(query, username).Scan(
		&userID, &user.Username, &hashedPassword, &role,
		&nickname, &phone, &email, &avatar,
		&createTime, &updateTime, &lastLogin,
	)

	if err != nil {
		log.Printf("用户验证失败: %v", err)
		return nil, err
	}

	// 验证密码
	err = utils.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	if err != nil {
		log.Printf("密码验证失败: %v", err)
		return nil, errors.New("密码不正确")
	}

	// 设置用户信息
	user.ID = userID
	user.Role = models.UserRole(role)

	// 处理可空字段
	if nickname.Valid {
		user.Nickname = nickname.String
	}
	if phone.Valid {
		user.Phone = phone.String
	}
	if email.Valid {
		user.Email = email.String
	}
	if avatar.Valid {
		user.Avatar = avatar.String
	}
	if lastLogin.Valid {
		user.LastLogin = lastLogin.Time
	}
	if createTime.Valid {
		user.CreateTime = createTime.Time
	}
	if updateTime.Valid {
		user.UpdateTime = updateTime.Time
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

// ValidateUser 验证用户登录
func ValidateUser(username, password string) (*models.User, error) {
	var user models.User
	var hashedPassword string
	var userID int64
	var role int
	var nickname, phone, email, avatar sql.NullString
	var createTime, updateTime, lastLogin sql.NullTime

	// 修改查询语句，确保不区分大小写以及去除空格
	query := `SELECT id, username, password, role, nickname, phone, email, avatar, 
              create_time, update_time, last_login FROM users 
              WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))`
	err := database.DB.QueryRow(query, username).Scan(
		&userID, &user.Username, &hashedPassword, &role,
		&nickname, &phone, &email, &avatar,
		&createTime, &updateTime, &lastLogin,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("用户名或密码错误")
		}
		return nil, err
	}

	// 验证密码
	if err = utils.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
		log.Printf("密码验证失败: %v", err)
		return nil, errors.New("用户名或密码错误")
	}

	// 设置用户信息
	user.ID = userID
	user.Role = models.UserRole(role)

	// 处理可空字段
	if nickname.Valid {
		user.Nickname = nickname.String
	}
	if phone.Valid {
		user.Phone = phone.String
	}
	if email.Valid {
		user.Email = email.String
	}
	if avatar.Valid {
		user.Avatar = avatar.String
	}
	if lastLogin.Valid {
		user.LastLogin = lastLogin.Time
	}
	if createTime.Valid {
		user.CreateTime = createTime.Time
	}
	if updateTime.Valid {
		user.UpdateTime = updateTime.Time
	}

	return &user, nil
}
