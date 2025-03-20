package utils

import (
	"log"
	"os"
	"strconv"
)

// GetEnvWithDefault 获取环境变量，如果不存在则返回默认值
func GetEnvWithDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// GetIntEnvWithDefault 获取整型环境变量，如果不存在或解析失败则返回默认值
func GetIntEnvWithDefault(key string, defaultValue int) int {
	strValue := os.Getenv(key)
	if strValue == "" {
		return defaultValue
	}

	intValue, err := strconv.Atoi(strValue)
	if err != nil {
		log.Printf("警告: 环境变量 %s 的值 %s 不是有效的整数，使用默认值 %d", key, strValue, defaultValue)
		return defaultValue
	}

	return intValue
}

// ShouldInitTestData 检查是否应该初始化测试数据
func ShouldInitTestData() bool {
	initTestData := os.Getenv("INIT_TEST_DATA")
	return initTestData == "true"
}
