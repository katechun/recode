package models

import (
	"time"
)

// UserRole 用户角色类型
type UserRole int

const (
	RoleAdmin UserRole = iota + 1 // 管理员
	RoleStaff                     // 店员
)

// User 用户模型
type User struct {
	ID         int64     `json:"id" db:"id"`
	Username   string    `json:"username" db:"username"`
	Password   string    `json:"-" db:"password"` // 不在JSON响应中返回密码
	Nickname   string    `json:"nickname" db:"nickname"`
	Role       UserRole  `json:"role" db:"role"`
	Phone      string    `json:"phone" db:"phone"`
	Email      string    `json:"email" db:"email"`
	Avatar     string    `json:"avatar" db:"avatar"`
	CreateTime time.Time `json:"create_time" db:"create_time"`
	UpdateTime time.Time `json:"update_time" db:"update_time"`
	LastLogin  time.Time `json:"last_login" db:"last_login"`
} 