package models

import "time"

// Customer 客户信息模型
type Customer struct {
	ID            int       `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Phone         string    `json:"phone" db:"phone"`
	Gender        int       `json:"gender" db:"gender"`                 // 性别：1男，2女
	Age           int       `json:"age" db:"age"`                       // 年龄
	Height        float64   `json:"height" db:"height"`                 // 身高(cm)
	InitialWeight float64   `json:"initial_weight" db:"initial_weight"` // 初始体重(kg)
	CurrentWeight float64   `json:"current_weight" db:"current_weight"` // 当前体重(kg)
	TargetWeight  float64   `json:"target_weight" db:"target_weight"`   // 目标体重(kg)
	StoreID       int       `json:"store_id" db:"store_id"`             // 所属店铺ID
	StoreName     string    `json:"store_name" db:"store_name"`         // 所属店铺名称
	Notes         string    `json:"notes" db:"notes"`                   // 备注信息
	CreatedAt     time.Time `json:"created_at" db:"created_at"`         // 创建时间
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`         // 更新时间
}

// WeightRecord 体重记录模型
type WeightRecord struct {
	ID         int       `json:"id" db:"id"`
	CustomerID int       `json:"customer_id" db:"customer_id"` // 客户ID
	Weight     float64   `json:"weight" db:"weight"`           // 体重(kg)
	RecordDate string    `json:"record_date" db:"record_date"` // 记录日期
	Notes      string    `json:"notes" db:"notes"`             // 备注信息
	CreatedAt  time.Time `json:"created_at" db:"created_at"`   // 创建时间
}

// ProductUsage 产品使用记录
type ProductUsage struct {
	ID          int       `json:"id" db:"id"`
	CustomerID  int       `json:"customer_id" db:"customer_id"`   // 客户ID
	ProductID   int       `json:"product_id" db:"product_id"`     // 产品ID
	ProductName string    `json:"product_name" db:"product_name"` // 产品名称
	UsageDate   string    `json:"usage_date" db:"usage_date"`     // 使用日期
	Quantity    float64   `json:"quantity" db:"quantity"`         // 使用数量
	Notes       string    `json:"notes" db:"notes"`               // 备注信息
	CreatedAt   time.Time `json:"created_at" db:"created_at"`     // 创建时间
}

// Product 产品模型
type Product struct {
	ID        int       `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`             // 产品名称
	StoreID   int       `json:"store_id" db:"store_id"`     // 所属店铺ID
	StoreName string    `json:"store_name" db:"store_name"` // 所属店铺名称
	Price     float64   `json:"price" db:"price"`           // 价格
	Stock     int       `json:"stock" db:"stock"`           // 库存
	Notes     string    `json:"notes" db:"notes"`           // 备注信息
	CreatedAt time.Time `json:"created_at" db:"created_at"` // 创建时间
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"` // 更新时间
}
