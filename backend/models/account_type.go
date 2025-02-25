package models

// AccountType 账务类型模型
type AccountType struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	IsExpense bool   `json:"is_expense"` // 是否为支出类型，true表示支出，false表示收入
} 