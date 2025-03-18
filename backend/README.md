# 小店记账系统 - 后端

## 数据库管理

### 正常启动（保留数据）

默认情况下，系统启动时会保留所有现有数据，只进行必要的表结构检查和迁移（如添加新列）：

```bash
# 正常启动，保留现有数据
go run main.go
```

### 初始化测试数据（仅开发和测试环境）

如果需要重置数据库并填充测试数据（**警告：这会删除所有现有数据**），请设置环境变量 `INIT_TEST_DATA=true`：

```bash
# Windows PowerShell
$env:INIT_TEST_DATA="true"
go run main.go

# Windows CMD
set INIT_TEST_DATA=true
go run main.go

# Linux/Mac
INIT_TEST_DATA=true go run main.go
```

**重要提醒**：设置 `INIT_TEST_DATA=true` 会导致：
1. 删除所有现有数据表
2. 重新创建表结构
3. 插入测试数据

只有在以下情况下使用：
- 首次安装系统
- 开发或测试环境
- 明确需要重置所有数据时

### 系统维护

- 系统使用SQLite数据库，数据存储在 `data/account.db` 文件中
- 建议定期备份此文件以防数据丢失
- 当系统版本更新时，启动程序会自动进行必要的表结构迁移，无需手动操作

## API文档

[API文档链接]

## 开发指南

[开发指南链接] 