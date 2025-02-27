package middleware

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "strings"
    "time"
)

type responseWriter struct {
    http.ResponseWriter
    status    int
    size      int64
    body      *bytes.Buffer
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
    size, err := rw.ResponseWriter.Write(b)
    rw.size += int64(size)
    rw.body.Write(b)
    return size, err
}

func NewResponseWriter(w http.ResponseWriter) *responseWriter {
    return &responseWriter{
        ResponseWriter: w,
        status:        http.StatusOK,
        body:         &bytes.Buffer{},
    }
}

func LoggerMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()

        // 读取请求体
        var requestBody string
        if r.Body != nil && strings.Contains(r.Header.Get("Content-Type"), "application/json") {
            bodyBytes, _ := io.ReadAll(r.Body)
            r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes)) // 重新设置请求体
            if len(bodyBytes) > 0 {
                var prettyJSON bytes.Buffer
                if err := json.Indent(&prettyJSON, bodyBytes, "", "  "); err == nil {
                    requestBody = prettyJSON.String()
                } else {
                    requestBody = string(bodyBytes)
                }
            }
        }

        // 包装 ResponseWriter 以获取响应信息
        wrapped := NewResponseWriter(w)
        
        // 处理请求
        next.ServeHTTP(wrapped, r)
        
        // 获取响应体
        var responseBody string
        if strings.Contains(r.Header.Get("Accept"), "application/json") {
            var prettyJSON bytes.Buffer
            if err := json.Indent(&prettyJSON, wrapped.body.Bytes(), "", "  "); err == nil {
                responseBody = prettyJSON.String()
            } else {
                responseBody = wrapped.body.String()
            }
        }

        // 计算处理时间
        duration := time.Since(start)
        
        // 构建日志信息
        logMsg := fmt.Sprintf(`
=== 请求信息 ===
时间: %s
状态: %d
耗时: %v
方法: %s
路径: %s%s
来源: %s
请求头: %v
请求体: %s

=== 响应信息 ===
大小: %d bytes
响应体: %s
================`,
            start.Format("2006-01-02 15:04:05.9999"),
            wrapped.status,
            duration,
            r.Method,
            r.URL.Path,
            func() string {
                if r.URL.RawQuery != "" {
                    return "?" + r.URL.RawQuery
                }
                return ""
            }(),
            r.RemoteAddr,
            r.Header,
            requestBody,
            wrapped.size,
            responseBody,
        )

        // 输出日志
        log.Println(logMsg)

        // 简短的单行日志
        log.Printf("%s %d %v %s %s %s%s\n",
            start.Format("2006-01-02 15:04:05.9999"),
            wrapped.status,
            duration,
            r.RemoteAddr,
            r.Method,
            r.URL.Path,
            func() string {
                if r.URL.RawQuery != "" {
                    return "?" + r.URL.RawQuery
                }
                return ""
            }(),
        )
    })
} 