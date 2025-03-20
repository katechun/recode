package utils

import (
	"encoding/json"
	"log"
	"net/http"
)

// Response 表示标准API响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// RespondWithJSON 发送JSON格式的成功响应
func RespondWithJSON(w http.ResponseWriter, httpStatus int, code int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	response := Response{
		Code:    code,
		Message: message,
		Data:    data,
	}

	// 将响应序列化为JSON
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

// RespondWithError 发送JSON格式的错误响应
func RespondWithError(w http.ResponseWriter, httpStatus int, message string) {
	RespondWithJSON(w, httpStatus, httpStatus, message, nil)
}
