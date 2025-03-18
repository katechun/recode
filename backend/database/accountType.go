package database

import (
	"account/backend/models"
	"database/sql"
	"strconv"
)

// GetAllAccountTypes 获取所有账务类型
func GetAllAccountTypes() ([]models.AccountType, error) {
	rows, err := DB.Query("SELECT id, name, category, icon, sort_order, is_expense FROM account_types")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accountTypes []models.AccountType
	for rows.Next() {
		var accountType models.AccountType
		var icon, sortOrder sql.NullString
		err := rows.Scan(
			&accountType.ID,
			&accountType.Name,
			&accountType.Type,
			&icon,
			&sortOrder,
			&accountType.IsExpense,
		)
		if err != nil {
			return nil, err
		}
		if icon.Valid {
			accountType.Icon = icon.String
		}
		if sortOrder.Valid {
			accountType.Order, _ = strconv.Atoi(sortOrder.String)
		}
		accountTypes = append(accountTypes, accountType)
	}

	return accountTypes, nil
}

// CreateAccountType 创建新账务类型
func CreateAccountType(accountType models.AccountType) (int64, error) {
	// 确保category值有效
	if accountType.Type <= 0 {
		// 根据是否为支出设置默认值
		if accountType.IsExpense {
			accountType.Type = 2 // 支出
		} else {
			accountType.Type = 1 // 收入
		}
	}

	result, err := DB.Exec(
		"INSERT INTO account_types (name, category, icon, sort_order, is_expense) VALUES (?, ?, ?, ?, ?)",
		accountType.Name, accountType.Type, accountType.Icon, accountType.Order, accountType.IsExpense,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateAccountType 更新账务类型信息
func UpdateAccountType(accountType models.AccountType) error {
	// 确保category值有效
	if accountType.Type <= 0 {
		// 根据是否为支出设置默认值
		if accountType.IsExpense {
			accountType.Type = 2 // 支出
		} else {
			accountType.Type = 1 // 收入
		}
	}

	_, err := DB.Exec(
		"UPDATE account_types SET name = ?, category = ?, icon = ?, sort_order = ?, is_expense = ? WHERE id = ?",
		accountType.Name, accountType.Type, accountType.Icon, accountType.Order, accountType.IsExpense, accountType.ID,
	)
	return err
}

// DeleteAccountType 删除账务类型
func DeleteAccountType(typeID int64) error {
	_, err := DB.Exec("DELETE FROM account_types WHERE id = ?", typeID)
	return err
}

// HasAccountTypeRecords 检查账务类型是否有关联记录
func HasAccountTypeRecords(typeID int64) (bool, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM accounts WHERE type_id = ?", typeID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
