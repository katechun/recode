package database

import (
	"log"

	"account/backend/models"
)

// GetAllAccountTypes 获取所有账务类型
func GetAllAccountTypes() ([]models.AccountType, error) {
	rows, err := DB.Query(`
		SELECT id, name, category, icon, sort_order, is_expense,
			create_time, update_time
		FROM account_types
		ORDER BY sort_order, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accountTypes []models.AccountType
	for rows.Next() {
		var accountType models.AccountType
		var createTime, updateTime string
		err := rows.Scan(
			&accountType.ID,
			&accountType.Name,
			&accountType.Type,
			&accountType.Icon,
			&accountType.Order,
			&accountType.IsExpense,
			&createTime,
			&updateTime,
		)
		if err != nil {
			log.Printf("扫描账务类型数据失败: %v", err)
			continue
		}
		accountTypes = append(accountTypes, accountType)
	}

	if err := rows.Err(); err != nil {
		log.Printf("遍历账务类型数据时出错: %v", err)
		return nil, err
	}

	return accountTypes, nil
}
