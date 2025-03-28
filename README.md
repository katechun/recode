# 微信小程序多店记账系统

## 项目简介

这是一个微信小程序多店记账系统，旨在帮助企业或个人管理多个店铺的财务记录。系统支持管理员和店员两种角色，提供差异化的权限管理，实现简单高效的记账功能。

## 主要功能

### 用户功能
- **登录/注册**: 支持管理员和店员两种角色登录
- **角色权限**: 
  - 管理员：可查看所有店铺所有账目，管理店员权限，自定义账务类型
  - 店员：只能查看被授权的账目数据，进行日常记账操作

### 记账功能
- **基础记账**: 收入/支出记录，金额，日期，备注等
- **自定义账务类型**: 可根据业务需求自定义账务分类
- **操作记录**: 自动记录每笔账务的操作人员信息
- **数据查询**: 按店铺、时间、类型等多维度查询

### 管理功能
- **店铺管理**: 添加/编辑/删除店铺信息
- **用户管理**: 添加/编辑/删除店员，设置权限
- **账务类型管理**: 自定义账务类型并分配查看权限

## 项目结构 

## 项目目录结构



## 编译
cd backend
set GOOS=linux
set GOARCH=amd64
set CGO_ENABLED=0
go build -o account.new