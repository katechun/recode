package api

import (
	"encoding/json"
	"log"
	"net/http"
)

// RespondJSON 统一的响应函数
func RespondJSON(w http.ResponseWriter, httpStatus int, code int, message string, data interface{}) {
	// 设置响应头
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	// 构建响应结构
	response := map[string]interface{}{
		"code":    code,
		"message": message,
	}
	if data != nil {
		response["data"] = data
	}

	// 将响应序列化为JSON并发送
	jsonResponse, err := json.Marshal(response)
	if err != nil {
		log.Printf("JSON序列化失败: %v", err)
		http.Error(w, "服务器内部错误", http.StatusInternalServerError)
		return
	}

	// 写入响应
	_, err = w.Write(jsonResponse)
	if err != nil {
		log.Printf("写入响应失败: %v", err)
	}
}
