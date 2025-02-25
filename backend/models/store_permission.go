package models

// StorePermission 用户对店铺的权限
type StorePermission struct {
	StoreID       int64  `json:"store_id"`
	StoreName     string `json:"store_name"`
	HasPermission int    `json:"has_permission"` // 0表示没有权限，1表示有权限
} 