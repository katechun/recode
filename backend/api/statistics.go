package api

import (
    "net/http"
    "strconv"
    "time"

    "account/backend/database"
)

// 添加报表接口 - 使用标准http处理函数而非Gin
func GetReport(w http.ResponseWriter, r *http.Request) {
    // 获取查询参数
    timeRange := r.URL.Query().Get("timeRange")
    storeIdStr := r.URL.Query().Get("storeId")
    userIDStr := r.URL.Query().Get("userId")

    // 转换店铺ID
    var storeId int64
    if storeIdStr != "" {
        var err error
        storeId, err = strconv.ParseInt(storeIdStr, 10, 64)
        if err != nil {
            SendResponse(w, http.StatusBadRequest, 400, "无效的店铺ID", nil)
            return
        }
    }

    // 转换用户ID
    var userID int64
    if userIDStr != "" {
        var err error
        userID, err = strconv.ParseInt(userIDStr, 10, 64)
        if err != nil {
            SendResponse(w, http.StatusBadRequest, 400, "无效的用户ID", nil)
            return
        }
    }

    // 计算时间范围
    startDate, endDate := calculateTimeRange(timeRange)

    // 获取报表数据
    reportData, err := database.GetReportData(startDate, endDate, storeId, userID)
    if err != nil {
        SendResponse(w, http.StatusInternalServerError, 500, "获取报表数据失败", nil)
        return
    }

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