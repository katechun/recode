package api

import (
    "fmt"
    "log"
    "net/http"
    "strconv"
    "time"

    "account/backend/database"
)

// 添加报表接口 - 使用标准http处理函数而非Gin
func GetReport(w http.ResponseWriter, r *http.Request) {
    // 记录请求信息
    log.Printf("收到报表请求: %s", r.URL.String())
    
    // 获取查询参数
    timeRange := r.URL.Query().Get("timeRange")
    storeIdStr := r.URL.Query().Get("storeId")
    userIDStr := r.URL.Query().Get("userId")
    
    // 记录请求参数
    log.Printf("报表请求参数 - timeRange: %s, storeId: %s, userId: %s", timeRange, storeIdStr, userIDStr)
    
    // 转换店铺ID
    var storeId int64
    if storeIdStr != "" {
        var err error
        storeId, err = strconv.ParseInt(storeIdStr, 10, 64)
        if err != nil {
            errMsg := fmt.Sprintf("无效的店铺ID: %s", storeIdStr)
            log.Printf("报表请求错误: %s", errMsg)
            SendResponse(w, http.StatusBadRequest, 400, errMsg, nil)
            return
        }
    }

    // 转换用户ID
    var userID int64
    if userIDStr != "" {
        var err error
        userID, err = strconv.ParseInt(userIDStr, 10, 64)
        if err != nil {
            errMsg := fmt.Sprintf("无效的用户ID: %s", userIDStr)
            log.Printf("报表请求错误: %s", errMsg)
            SendResponse(w, http.StatusBadRequest, 400, errMsg, nil)
            return
        }
    }
    
    // 验证用户ID是否有效
    if userID <= 0 {
        errMsg := "必须提供有效的用户ID"
        log.Printf("报表请求错误: %s", errMsg)
        SendResponse(w, http.StatusBadRequest, 400, errMsg, nil)
        return
    }

    // 计算时间范围
    startDate, endDate := calculateTimeRange(timeRange)
    log.Printf("计算的时间范围: %s 到 %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

    // 获取报表数据
    reportData, err := database.GetReportData(startDate, endDate, storeId, userID)
    if err != nil {
        errMsg := fmt.Sprintf("获取报表数据失败: %v", err)
        log.Printf("报表请求错误: %s", errMsg)
        SendResponse(w, http.StatusInternalServerError, 500, errMsg, nil)
        return
    }

    log.Printf("报表数据生成成功, 用户ID: %d", userID)
    SendResponse(w, http.StatusOK, 200, "成功", reportData)
}

// 计算时间范围
func calculateTimeRange(timeRange string) (time.Time, time.Time) {
    now := time.Now()
    
    switch timeRange {
    case "day":
        // 今日: 当天00:00到当前时间
        startDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
        return startDate, now
    case "week":
        // 本周: 当周周一00:00到当前时间
        weekday := int(now.Weekday())
        if weekday == 0 {
            weekday = 7 // 将周日作为第7天
        }
        startDate := now.AddDate(0, 0, -weekday+1)
        startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, now.Location())
        return startDate, now
    case "year":
        // 本年: 当年1月1日00:00到当前时间
        startDate := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
        return startDate, now
    case "month":
        fallthrough
    default:
        // 默认本月: 当月1日00:00到当前时间
        startDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
        return startDate, now
    }
} 