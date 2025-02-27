package database

import (
	"database/sql"
)

// DefaultSettings 用户默认设置
type DefaultSettings struct {
	StoreId      int64 `json:"store_id"`
	IncomeTypeId int64 `json:"income_type_id"`
	ExpenseTypeId int64 `json:"expense_type_id"`
}

// SaveDefaultSettings 保存用户的默认设置
func SaveDefaultSettings(userID, storeID, incomeTypeID, expenseTypeID int64) error {
	// 先检查是否已存在设置
	var exists bool
	err := DB.QueryRow("SELECT EXISTS(SELECT 1 FROM user_default_settings WHERE user_id = ?)", userID).Scan(&exists)
	if err != nil {
		return err
	}

	if exists {
		// 更新现有设置
		_, err = DB.Exec(`
            UPDATE user_default_settings 
            SET store_id = ?, income_type_id = ?, expense_type_id = ?
            WHERE user_id = ?
        `, storeID, incomeTypeID, expenseTypeID, userID)
	} else {
		// 插入新设置
		_, err = DB.Exec(`
            INSERT INTO user_default_settings (user_id, store_id, income_type_id, expense_type_id)
            VALUES (?, ?, ?, ?)
        `, userID, storeID, incomeTypeID, expenseTypeID)
	}

	return err
}

// GetDefaultSettings 获取用户的默认设置
func GetDefaultSettings(userID int64) (*DefaultSettings, error) {
	settings := &DefaultSettings{}
	err := DB.QueryRow(`
        SELECT store_id, income_type_id, expense_type_id
        FROM user_default_settings
        WHERE user_id = ?
    `, userID).Scan(&settings.StoreId, &settings.IncomeTypeId, &settings.ExpenseTypeId)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return settings, nil
} 