package models

// Store 店铺模型
type Store struct {
	ID      int64  `json:"id" db:"id"`
	Name    string `json:"name" db:"name"`
	Address string `json:"address" db:"address"`
	Phone   string `json:"phone" db:"phone"`
} 