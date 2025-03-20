// pages/customerDetail/customerDetail.js
import request from '../../utils/request';
import config from '../../config/config';
import WxCharts from '../../utils/wxCharts';

Page({
    data: {
        userInfo: null,
        customer: null,
        recordList: [],
        productUsageList: [],
        isLoading: false,
        customerId: '',
        activeTab: 'info',
        weightRecords: [],
        pageNum: 1,
        pageSize: 10,
        hasMore: true,
        isExporting: false,
        weightChart: null,
        reportType: 'pdf', // 默认导出PDF格式
        dateRange: '30', // 默认导出近30天的数据
        isFormatterLoaded: false,
        showBmi: true, // 默认显示BMI曲线
        bmiCategories: [
            { min: 0, max: 18.5, label: '偏瘦', color: '#909399' },
            { min: 18.5, max: 24, label: '正常', color: '#67c23a' },
            { min: 24, max: 28, label: '超重', color: '#e6a23c' },
            { min: 28, max: 32, label: '肥胖', color: '#f56c6c' },
            { min: 32, max: 100, label: '重度肥胖', color: '#c03639' }
        ]
    },

    onLoad: function (options) {
        // 检查用户是否已登录
        const userInfo = wx.getStorageSync('userInfo');
        if (!userInfo) {
            wx.reLaunch({
                url: '/pages/login/login',
            });
            return;
        }

        const customerId = options.id;
        if (!customerId) {
            wx.showToast({
                title: '客户ID不能为空',
                icon: 'none'
            });
            wx.navigateBack();
            return;
        }

        this.setData({
            userInfo,
            customerId
        });

        // 加载客户详情
        this.loadCustomerDetail();
        // 加载减肥记录
        this.loadWeightRecords();
        // 加载产品使用记录
        this.loadProductUsage();
    },

    onShow: function () {
        // 检查是否需要刷新
        if (wx.getStorageSync('customerDetailNeedRefresh')) {
            // 重新加载数据
            this.loadCustomerDetail();
            this.loadWeightRecords();
            this.loadProductUsage();
            wx.removeStorageSync('customerDetailNeedRefresh');
        }
    },

    onPullDownRefresh: function () {
        // 下拉刷新，重新加载数据
        this.loadCustomerDetail();
        this.loadWeightRecords();
        this.loadProductUsage();
    },

    onReachBottom: function () {
        // 如果正在查看记录，并且有更多数据，就加载更多
        if (this.data.activeTab === 'record' && this.data.hasMore && !this.data.isLoading) {
            this.loadMoreRecords();
        }
    },

    // 加载客户详情
    loadCustomerDetail: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        // 使用Promise方式发送请求
        request.get(config.apis.customer.detail, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            }
        })
            .then(res => {
                this.setData({ isLoading: false });
                wx.stopPullDownRefresh();

                if (res && res.code === 200) {
                    const customerDetail = res.data || {};

                    // 计算减重进度
                    if (customerDetail.initial_weight && customerDetail.target_weight && customerDetail.current_weight) {
                        const totalNeedLoss = customerDetail.initial_weight - customerDetail.target_weight;
                        const currentLoss = customerDetail.initial_weight - customerDetail.current_weight;
                        const progress = totalNeedLoss <= 0 ? 0 : Math.min(100, Math.round((currentLoss / totalNeedLoss) * 100));

                        customerDetail.progress = progress;

                        // 计算已减体重
                        customerDetail.lost_weight = (customerDetail.initial_weight - customerDetail.current_weight).toFixed(1);

                        // 计算还需减重
                        if (customerDetail.current_weight > customerDetail.target_weight) {
                            customerDetail.needs_to_lose = (customerDetail.current_weight - customerDetail.target_weight).toFixed(1);
                        } else {
                            customerDetail.needs_to_lose = '0';
                        }
                    } else {
                        customerDetail.progress = 0;
                        customerDetail.lost_weight = 0;
                        customerDetail.needs_to_lose = 0;
                    }

                    this.setData({
                        customer: customerDetail
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '加载客户详情失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('加载客户详情失败:', err);
                this.setData({ isLoading: false });
                wx.stopPullDownRefresh();

                wx.showToast({
                    title: '加载客户详情失败',
                    icon: 'none'
                });
            });
    },

    // 加载减肥记录
    loadWeightRecords: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        // 使用Promise方式发送请求
        request.get(config.apis.customer.weightRecords, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            }
        })
            .then(res => {
                this.setData({ isLoading: false });

                if (res && res.code === 200) {
                    let records = res.data || [];

                    // 如果记录为空，添加一条初始记录
                    if (records.length === 0 && this.data.customer) {
                        const { initial_weight, current_weight } = this.data.customer;
                        if (initial_weight) {
                            // 为了图表显示，增加两个点：初始体重和当前体重
                            const initialDate = new Date();
                            initialDate.setMonth(initialDate.getMonth() - 1);

                            records = [
                                {
                                    id: 'initial',
                                    weight: initial_weight,
                                    record_date: this.formatDate(initialDate),
                                    notes: '初始体重'
                                }
                            ];

                            if (current_weight && current_weight !== initial_weight) {
                                records.push({
                                    id: 'current',
                                    weight: current_weight,
                                    record_date: this.formatDate(new Date()),
                                    notes: '当前体重'
                                });
                            }
                        }
                    }

                    // 计算体重变化
                    if (records.length > 0) {
                        records = this.calculateWeightChanges(records);
                    }

                    // 按日期排序，最新的在前面
                    records.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));

                    this.setData({
                        weightRecords: records
                    });

                    // 创建减肥趋势图数据
                    this.createWeightTrendData(records);
                } else {
                    wx.showToast({
                        title: res?.message || '加载减肥记录失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('加载减肥记录失败:', err);
                this.setData({ isLoading: false });

                wx.showToast({
                    title: '加载减肥记录失败',
                    icon: 'none'
                });
            });
    },

    // 格式化日期为 YYYY-MM-DD
    formatDate: function (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 计算体重变化
    calculateWeightChanges: function (records) {
        // 按日期排序，旧的在前面
        const sortedRecords = [...records].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

        // 计算每条记录相对于前一次记录的变化
        return sortedRecords.map((record, index) => {
            if (index === 0) {
                // 第一次记录，获取客户初始体重作为参考
                const initialWeight = this.data.customer?.initial_weight;
                if (initialWeight) {
                    record.change = (record.weight - initialWeight).toFixed(1);
                } else {
                    record.change = 0;
                }
            } else {
                // 后续记录，计算与前一次的差值
                record.change = (record.weight - sortedRecords[index - 1].weight).toFixed(1);
            }

            // 计算减重百分比
            const initialWeight = this.data.customer?.initial_weight;
            if (initialWeight && initialWeight > 0) {
                const totalLoss = initialWeight - record.weight;
                record.lossPercentage = ((totalLoss / initialWeight) * 100).toFixed(1);
            } else {
                record.lossPercentage = '0.0';
            }

            return record;
        });
    },

    // 加载产品使用记录
    loadProductUsage: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        // 使用Promise方式发送请求
        request.get(config.apis.customer.productUsage, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId,
                page: 1,
                page_size: 999 // 一次性加载所有
            }
        })
            .then(res => {
                this.setData({ isLoading: false });

                if (res && res.code === 200) {
                    const productUsage = res.data || [];

                    this.setData({
                        productUsageList: productUsage
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '加载产品使用记录失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('加载产品使用记录失败:', err);
                this.setData({ isLoading: false });

                wx.showToast({
                    title: '加载产品使用记录失败',
                    icon: 'none'
                });
            });
    },

    // 加载更多记录
    loadMoreRecords: function () {
        if (this.data.isLoading) return;

        this.setData({ isLoading: true });

        const { userInfo, customerId, pageNum, pageSize } = this.data;

        // 使用Promise方式发送请求
        request.get(config.apis.customer.records, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId,
                page: pageNum,
                page_size: pageSize
            }
        })
            .then(res => {
                this.setData({ isLoading: false });

                if (res && res.code === 200) {
                    const newRecords = res.data || [];

                    // 判断是否有更多数据
                    const hasMore = newRecords.length === pageSize;

                    this.setData({
                        recordList: [...this.data.recordList, ...newRecords],
                        pageNum: pageNum + 1,
                        hasMore
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '加载更多记录失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('加载更多记录失败:', err);
                this.setData({ isLoading: false });

                wx.showToast({
                    title: '加载更多记录失败',
                    icon: 'none'
                });
            });
    },

    // 创建减肥趋势图数据
    createWeightTrendData: function (records) {
        if (!records || records.length === 0) return;

        // 按日期升序排序，以便正确显示趋势
        const sortedRecords = [...records].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

        // 用于图表的数据
        const dates = sortedRecords.map(record => {
            const dateObj = new Date(record.record_date);
            return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`; // 显示为 月/日
        });
        const weights = sortedRecords.map(record => record.weight);

        // 创建BMI变化数据（如果有身高数据）
        let bmiData = null;
        if (this.data.customer && this.data.customer.height && this.data.customer.height > 0) {
            const height = this.data.customer.height / 100; // 转换为米
            bmiData = sortedRecords.map(record => {
                const bmi = (record.weight / (height * height)).toFixed(1);
                return parseFloat(bmi);
            });

            // 计算当前BMI值和分类
            if (sortedRecords.length > 0) {
                const latestRecord = sortedRecords[sortedRecords.length - 1];
                const currentBmi = (latestRecord.weight / (height * height)).toFixed(1);
                const bmiCategory = this.getBmiCategory(currentBmi);

                this.setData({
                    currentBmi: currentBmi,
                    bmiCategory: bmiCategory
                });
            }
        }

        // 在页面中设置图表数据
        this.setData({
            chartData: {
                categories: dates,
                series: [
                    {
                        name: '体重',
                        data: weights,
                        format: (val) => val + 'kg'
                    },
                    bmiData ? {
                        name: 'BMI',
                        data: bmiData,
                        format: (val) => val
                    } : null
                ].filter(Boolean) // 移除空值
            }
        });

        // 使用WxCharts绘制图表
        this.drawWeightChart(dates, weights, bmiData);
    },

    // 绘制体重趋势图
    drawWeightChart: function (dates, weights, bmiData) {
        if (!dates || !weights || dates.length === 0 || weights.length === 0) {
            console.error('绘制图表数据无效');
            return;
        }

        // 如果没有启用BMI显示，则强制设为null
        if (!this.data.showBmi) {
            bmiData = null;
        }

        // 获取系统信息
        const systemInfo = wx.getSystemInfoSync();
        const screenWidth = systemInfo.windowWidth;

        // 在小程序中，延迟一下绘制图表，确保Canvas已经准备好
        setTimeout(() => {
            try {
                // 找出权重范围，给图表设定合适的区间
                const minWeight = Math.min(...weights);
                const maxWeight = Math.max(...weights);
                const weightRange = maxWeight - minWeight;

                // 体重图表配置
                const chartConfig = {
                    canvasId: 'weightChart',
                    type: 'line',
                    categories: dates,
                    series: [{
                        name: '体重(kg)',
                        data: weights,
                        format: (val) => val + 'kg',
                        color: '#1aad19'
                    }],
                    yAxis: {
                        title: '体重(kg)',
                        format: (val) => val,
                        // 设置合适的最小值和最大值，保证曲线显示更平滑
                        min: weightRange < 2 ? (minWeight - 1) : Math.floor(minWeight * 0.95),
                        max: weightRange < 2 ? (maxWeight + 1) : Math.ceil(maxWeight * 1.05)
                    },
                    width: screenWidth - 40, // 左右留出一些边距
                    height: 220,
                    dataLabel: false, // 不显示数据点的值，减少拥挤
                    dataPointShape: true,
                    extra: {
                        lineStyle: 'curve' // 曲线方式
                    }
                };

                // 如果有BMI数据，添加第二个系列
                if (bmiData && bmiData.length > 0) {
                    chartConfig.series.push({
                        name: 'BMI',
                        data: bmiData,
                        format: (val) => val,
                        color: '#f56c6c'
                    });
                }

                // 清理之前的图表实例
                if (this.data.weightChart) {
                    // 如果存在刷新方法，则使用刷新
                    if (typeof this.data.weightChart.updateData === 'function') {
                        this.data.weightChart.updateData({
                            categories: dates,
                            series: chartConfig.series
                        });
                        return;
                    }
                }

                // 创建新的图表实例
                const weightChart = new WxCharts(chartConfig);
                this.setData({ weightChart });
            } catch (error) {
                console.error('绘制图表失败:', error);
            }
        }, 300);
    },

    // 切换Tab
    switchTab: function (e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({
            activeTab: tab
        });

        // 如果切换到体重记录标签，重新绘制图表
        if (tab === 'record' && this.data.chartData) {
            setTimeout(() => {
                this.drawWeightChart(
                    this.data.chartData.categories,
                    this.data.chartData.series[0].data,
                    this.data.showBmi ? this.data.chartData.series[1]?.data : null
                );
            }, 300);
        }
    },

    // 添加减肥记录
    addWeightRecord: function () {
        wx.navigateTo({
            url: `/pages/addWeightRecord/addWeightRecord?customer_id=${this.data.customerId}`
        });
    },

    // 删除体重记录
    deleteWeightRecord: function (e) {
        const recordId = e.currentTarget.dataset.id;

        wx.showModal({
            title: '确认删除',
            content: '确定要删除此条体重记录吗？',
            success: (res) => {
                if (res.confirm) {
                    this.performDeleteRecord(recordId);
                }
            }
        });
    },

    // 执行删除记录操作
    performDeleteRecord: function (recordId) {
        this.setData({ isLoading: true });

        const { userInfo } = this.data;

        request.post(config.apis.customer.deleteWeightRecord, {
            user_id: userInfo.id,
            record_id: recordId
        })
            .then(res => {
                this.setData({ isLoading: false });

                if (res && res.code === 200) {
                    wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });

                    // 更新记录列表，移除已删除的记录
                    const updatedRecords = this.data.weightRecords.filter(record => record.id !== recordId);
                    this.setData({
                        weightRecords: updatedRecords
                    });

                    // 重新计算体重变化
                    if (updatedRecords.length > 0) {
                        const recalculatedRecords = this.calculateWeightChanges(updatedRecords);
                        this.setData({
                            weightRecords: recalculatedRecords
                        });
                    }

                    // 重新绘制图表
                    this.createWeightTrendData(updatedRecords);

                    // 可能需要更新客户当前体重
                    this.loadCustomerDetail();
                } else {
                    wx.showToast({
                        title: res?.message || '删除失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('删除记录失败:', err);
                this.setData({ isLoading: false });

                wx.showToast({
                    title: '删除失败',
                    icon: 'none'
                });
            });
    },

    // 添加产品使用记录
    addProductUsage: function () {
        wx.navigateTo({
            url: `/pages/addProductUsage/addProductUsage?customer_id=${this.data.customerId}`
        });
    },

    // 编辑客户信息
    editCustomer: function () {
        wx.navigateTo({
            url: `/pages/addCustomer/addCustomer?id=${this.data.customerId}`
        });
    },

    // 选择报表类型
    selectReportType: function (e) {
        this.setData({
            reportType: e.currentTarget.dataset.type
        });
    },

    // 选择日期范围
    selectDateRange: function (e) {
        this.setData({
            dateRange: e.currentTarget.dataset.range
        });
    },

    // 显示导出报表选项
    showExportOptions: function () {
        this.setData({
            showExportOptions: true
        });
    },

    // 隐藏导出报表选项
    hideExportOptions: function () {
        this.setData({
            showExportOptions: false
        });
    },

    // 导出减肥报表
    exportWeightReport: function () {
        // 隐藏选项框
        this.hideExportOptions();

        // 设置导出中状态
        this.setData({ isExporting: true });

        wx.showLoading({
            title: '生成报表中...',
            mask: true
        });

        const { userInfo, customerId, reportType, dateRange } = this.data;

        // 设置超时处理，确保状态不会无限持续
        const timeout = setTimeout(() => {
            wx.hideLoading();
            this.setData({ isExporting: false });
            wx.showToast({
                title: '生成报表超时，请重试',
                icon: 'none'
            });
        }, 25000); // 25秒超时

        // 使用Promise方式发送请求
        request.get(config.apis.customer.exportReport, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId,
                report_type: reportType,
                date_range: dateRange
            }
        })
            .then(res => {
                clearTimeout(timeout); // 清除超时定时器
                wx.hideLoading();
                this.setData({ isExporting: false });

                console.log('导出报表响应:', res);

                if (res && res.code === 200) {
                    const reportUrl = res.data.url;

                    if (reportUrl) {
                        // 完整的报表URL
                        const fullUrl = reportUrl.startsWith('http') ? reportUrl : config.baseUrl + reportUrl;

                        // 根据报表类型处理不同的查看方式
                        wx.showModal({
                            title: '报表已生成',
                            content: '可以通过以下方式查看报表：\n1. 预览报表\n2. 复制报表链接',
                            cancelText: '预览',
                            confirmText: '复制链接',
                            success: (result) => {
                                if (result.confirm) {
                                    // 复制链接
                                    wx.setClipboardData({
                                        data: fullUrl,
                                        success: () => {
                                            wx.showToast({
                                                title: '链接已复制',
                                                icon: 'success'
                                            });
                                        }
                                    });
                                } else if (result.cancel) {
                                    // 预览文件
                                    wx.downloadFile({
                                        url: fullUrl,
                                        success: (res) => {
                                            if (res.statusCode === 200) {
                                                const filePath = res.tempFilePath;
                                                wx.openDocument({
                                                    filePath: filePath,
                                                    showMenu: true,
                                                    fileType: reportType,
                                                    success: () => {
                                                        console.log('打开文档成功');
                                                    },
                                                    fail: (error) => {
                                                        console.error('打开文档失败', error);
                                                        wx.showToast({
                                                            title: '打开文档失败',
                                                            icon: 'none'
                                                        });
                                                    }
                                                });
                                            }
                                        },
                                        fail: (err) => {
                                            console.error('下载文件失败:', err);
                                            wx.showToast({
                                                title: '下载文件失败',
                                                icon: 'none'
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    } else {
                        wx.showToast({
                            title: '报表生成失败',
                            icon: 'none'
                        });
                    }
                } else {
                    wx.showToast({
                        title: res?.message || '报表生成失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                clearTimeout(timeout); // 清除超时定时器
                wx.hideLoading();
                this.setData({ isExporting: false });

                console.error('导出报表失败:', err);

                wx.showToast({
                    title: '导出报表失败',
                    icon: 'none'
                });
            });
    },

    // 获取BMI分类
    getBmiCategory: function (bmi) {
        const bmiValue = parseFloat(bmi);
        const category = this.data.bmiCategories.find(
            category => bmiValue >= category.min && bmiValue < category.max
        );
        return category || this.data.bmiCategories[0];
    },

    // 切换BMI显示
    toggleBmi: function () {
        const showBmi = !this.data.showBmi;
        this.setData({ showBmi });

        // 重新绘制图表
        if (this.data.chartData) {
            setTimeout(() => {
                this.drawWeightChart(
                    this.data.chartData.categories,
                    this.data.chartData.series[0].data,
                    showBmi ? this.data.chartData.series[1]?.data : null
                );
            }, 100);
        }
    },

    // 阻止事件冒泡
    stopPropagation: function () {
        // 阻止点击穿透
    }
}); 