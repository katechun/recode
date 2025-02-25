package database

import (
	"account/backend/models"
)

// GetAllAccountTypes 获取所有账务类型
func GetAllAccountTypes() ([]models.AccountType, error) {
	rows, err := DB.Query("SELECT id, name, is_expense FROM account_types")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accountTypes []models.AccountType
	for rows.Next() {
		var accountType models.AccountType
		err := rows.Scan(&accountType.ID, &accountType.Name, &accountType.IsExpense)
		if err != nil {
			return nil, err
		}
		accountTypes = append(accountTypes, accountType)
	}

	return accountTypes, nil
}

// CreateAccountType 创建新账务类型
func CreateAccountType(accountType models.AccountType) (int64, error) {
	result, err := DB.Exec(
		"INSERT INTO account_types (name, is_expense) VALUES (?, ?)",
		accountType.Name, accountType.IsExpense,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateAccountType 更新账务类型信息
func UpdateAccountType(accountType models.AccountType) error {
	_, err := DB.Exec(
		"UPDATE account_types SET name = ?, is_expense = ? WHERE id = ?",
		accountType.Name, accountType.IsExpense, accountType.ID,
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