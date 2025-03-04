package models

// Store 店铺模型
type Store struct {
	ID      int64  `json:"id" db:"id"`
	Name    string `json:"name" db:"name"`
	Address string `json:"address" db:"address"`
	Phone   string `json:"phone" db:"phone"`
}

// StorePermission 用户的店铺权限
type StorePermission struct {
	StoreID      int64  `json:"store_id"`
	StoreName    string `json:"store_name"`
	HasPermission int    `json:"has_permission"` // 0-无权限, 1-有权限
} 