package models

import "time"

// Account 账务记录模型
type Account struct {
	ID             int64     `json:"id" db:"id"`
	StoreID        int64     `json:"store_id" db:"store_id"`
	UserID         int64     `json:"user_id" db:"user_id"`
	TypeID         int64     `json:"type_id" db:"type_id"`
	Amount         float64   `json:"amount" db:"amount"`
	Remark         string    `json:"remark" db:"remark"`
	TransactionTime string    `json:"transaction_time" db:"transaction_time"`
	CreateTime     time.Time `json:"create_time" db:"create_time"`
	UpdateTime     time.Time `json:"update_time" db:"update_time"`
} 