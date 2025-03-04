package models

// AccountType 结构体
type AccountType struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Type      int    `json:"type"`
	Icon      string `json:"icon"`
	Order     int    `json:"order"`
	IsExpense bool   `json:"is_expense"`
} 