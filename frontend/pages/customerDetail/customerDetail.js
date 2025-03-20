// pages/customerDetail/customerDetail.js
import request from '../../utils/request';
import config from '../../config/config';
import * as echarts from '../../components/ec-canvas/echarts';

let chartOption = {
    color: ['#1890ff'],
    grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '13%',
        containLabel: true
    },
    tooltip: {
        trigger: 'axis'
    },
    xAxis: {
        type: 'category',
        boundaryGap: false,
        data: []
    },
    yAxis: {
        type: 'value',
        name: '体重(kg)'
    },
    series: [{
        name: '体重',
        type: 'line',
        smooth: true,
        data: []
    }]
};

function initChart(canvas, width, height, dpr) {
    const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
    });
    canvas.setChart(chart);
    chart.setOption(chartOption);
    return chart;
}

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
        ec: {
            onInit: initChart
        },
        showBmi: false, // 是否显示BMI曲线
        reportType: 'pdf', // 默认导出PDF格式
        dateRange: '30', // 默认导出近30天的数据
        isFormatterLoaded: false,
        bmiCategories: [
            { min: 0, max: 18.5, label: '偏瘦', color: '#909399' },
            { min: 18.5, max: 24, label: '正常', color: '#67c23a' },
            { min: 24, max: 28, label: '超重', color: '#e6a23c' },
            { min: 28, max: 32, label: '肥胖', color: '#f56c6c' },
            { min: 32, max: 100, label: '重度肥胖', color: '#c03639' }
        ],
        // 减重数据分析相关数据
        weightAnalysis: null,
        showWeightAnalysisModal: false,
        // 添加体脂率相关数据
        bodyFatPercentage: null,
        bodyFatCategory: null,
        showWeightModal: false,
        weightTimeType: 'morning', // 早称或晚称
        weightDate: '',
        weightValue: '',
        weightDropValue: null, // 掉秤量
        metabolismValue: null, // 代谢量
        previousMorningWeight: null,
        previousEveningWeight: null,
        showProductModal: false,
        productDate: '',
        productName: '',
        remainingCount: '',
        productList: []
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

                    // 如果有身高数据，计算当前BMI
                    if (customerDetail.height && customerDetail.current_weight) {
                        const currentBmi = this.calculateBmi(customerDetail.current_weight, customerDetail.height);
                        const bmiCategory = this.getBmiCategory(currentBmi);

                        // 计算体脂率（估算）
                        const bodyFatPercentage = this.calculateBodyFat(currentBmi, customerDetail.age, customerDetail.gender);
                        const bodyFatCategory = this.getBodyFatCategory(bodyFatPercentage, customerDetail.gender);

                        this.setData({
                            currentBmi: currentBmi,
                            bmiCategory: bmiCategory,
                            bodyFatPercentage: bodyFatPercentage,
                            bodyFatCategory: bodyFatCategory
                        });
                    }
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

                    // 生成减肥数据分析
                    if (records.length >= 2) {
                        this.generateWeightAnalysis(records);
                    }
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

        // 使用echarts绘制图表
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

        try {
            // 更新图表配置
            chartOption.xAxis.data = dates;
            chartOption.series[0].data = weights;

            // 处理BMI数据
            if (bmiData && this.data.showBmi) {
                // 如果已有BMI系列，则更新数据
                if (chartOption.series.length > 1) {
                    chartOption.series[1].data = bmiData;
                } else {
                    // 否则添加BMI系列
                    chartOption.series.push({
                        name: 'BMI',
                        type: 'line',
                        smooth: true,
                        data: bmiData,
                        yAxisIndex: 1,
                        itemStyle: {
                            color: '#f56c6c'
                        }
                    });

                    // 添加BMI的Y轴
                    chartOption.yAxis = [
                        {
                            type: 'value',
                            name: '体重(kg)',
                            position: 'left'
                        },
                        {
                            type: 'value',
                            name: 'BMI',
                            position: 'right'
                        }
                    ];
                }
            } else {
                // 如果不显示BMI，则移除BMI系列
                if (chartOption.series.length > 1) {
                    chartOption.series.splice(1, 1);
                    chartOption.yAxis = {
                        type: 'value',
                        name: '体重(kg)'
                    };
                }
            }

            // 获取图表组件实例
            const ecComponent = this.selectComponent('#weightChart');
            if (ecComponent) {
                ecComponent.init((canvas, width, height, dpr) => {
                    const chart = echarts.init(canvas, null, {
                        width: width,
                        height: height,
                        devicePixelRatio: dpr
                    });
                    chart.setOption(chartOption);
                    // 将图表实例保存到data中，方便后续刷新
                    this.chart = chart;
                    return chart;
                });
            }
        } catch (error) {
            console.error('绘制图表失败:', error);
        }
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

    // 添加体重记录按钮点击事件
    addWeightRecord: function () {
        // 设置当前日期为默认值
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // 查找前一天的体重记录
        this.getPreviousDayWeights();

        this.setData({
            showWeightModal: true,
            weightDate: dateString,
            weightValue: '',
            weightTimeType: 'morning',
            weightDropValue: null,
            metabolismValue: null
        });
    },

    // 关闭体重记录弹窗
    closeWeightModal: function () {
        this.setData({
            showWeightModal: false
        });
    },

    // 切换早称/晚称
    changeWeightTimeType: function (e) {
        const type = e.currentTarget.dataset.type;
        this.setData({
            weightTimeType: type
        });
        this.calculateValues();
    },

    // 日期选择变化
    onWeightDateChange: function (e) {
        this.setData({
            weightDate: e.detail.value
        });
        // 更新前一天的体重数据
        this.getPreviousDayWeights();
    },

    // 体重输入值变化
    onWeightValueInput: function (e) {
        this.setData({
            weightValue: e.detail.value
        });
        this.calculateValues();
    },

    // 获取前一天的体重记录
    getPreviousDayWeights: function () {
        const selectedDate = new Date(this.data.weightDate);
        const previousDay = new Date(selectedDate);
        previousDay.setDate(selectedDate.getDate() - 1);

        const year = previousDay.getFullYear();
        const month = (previousDay.getMonth() + 1).toString().padStart(2, '0');
        const day = previousDay.getDate().toString().padStart(2, '0');
        const previousDateString = `${year}-${month}-${day}`;

        // 在现有数据中查找前一天的早晚称记录
        let morningWeight = null;
        let eveningWeight = null;

        // 遍历权重记录查找前一天的数据
        if (this.data.weightRecords && this.data.weightRecords.length > 0) {
            for (const record of this.data.weightRecords) {
                if (record.record_date === previousDateString) {
                    if (record.time_type === 'morning') {
                        morningWeight = record.weight;
                    } else if (record.time_type === 'evening') {
                        eveningWeight = record.weight;
                    }
                }
            }
        }

        this.setData({
            previousMorningWeight: morningWeight,
            previousEveningWeight: eveningWeight
        });

        // 计算掉秤量和代谢量
        this.calculateValues();
    },

    // 计算掉秤量和代谢量
    calculateValues: function () {
        if (!this.data.weightValue || this.data.weightValue === '') {
            this.setData({
                weightDropValue: null,
                metabolismValue: null
            });
            return;
        }

        const currentWeight = parseFloat(this.data.weightValue);
        let dropValue = null;
        let metaValue = null;

        if (this.data.weightTimeType === 'morning' && this.data.previousMorningWeight !== null) {
            // 掉秤量 = 头天早上体重 - 当天早上体重
            dropValue = (this.data.previousMorningWeight - currentWeight).toFixed(1);
        }

        if (this.data.weightTimeType === 'evening' && this.data.previousEveningWeight !== null) {
            // 代谢量 = 头天晚上体重 - 当天晚上体重
            metaValue = (this.data.previousEveningWeight - currentWeight).toFixed(1);
        }

        this.setData({
            weightDropValue: dropValue,
            metabolismValue: metaValue
        });
    },

    // 保存体重记录
    saveWeightRecord: function () {
        if (!this.data.weightValue || parseFloat(this.data.weightValue) <= 0) {
            wx.showToast({
                title: '请输入有效的体重值',
                icon: 'none'
            });
            return;
        }

        const weight = parseFloat(this.data.weightValue);
        const timeType = this.data.weightTimeType; // 早称或晚称

        wx.showLoading({
            title: '保存中...',
        });

        // 获取当前客户ID
        const customerId = this.data.customer.id;

        // 调用API保存体重记录
        wx.request({
            url: `${app.globalData.apiBaseUrl}/customer/weight`,
            method: 'POST',
            header: {
                'content-type': 'application/json',
                'X-Token': app.globalData.token
            },
            data: {
                customer_id: customerId,
                weight: weight,
                record_date: this.data.weightDate,
                time_type: timeType
            },
            success: (res) => {
                if (res.data.code === 0) {
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });

                    // 关闭弹窗并刷新数据
                    this.closeWeightModal();
                    this.loadWeightRecords(customerId);

                    // 如果是早称且是当天的记录，更新当前体重
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = (today.getMonth() + 1).toString().padStart(2, '0');
                    const day = today.getDate().toString().padStart(2, '0');
                    const todayString = `${year}-${month}-${day}`;

                    if (timeType === 'morning' && this.data.weightDate === todayString) {
                        // 更新当前体重和客户信息
                        wx.request({
                            url: `${app.globalData.apiBaseUrl}/customer/update_current_weight`,
                            method: 'POST',
                            header: {
                                'content-type': 'application/json',
                                'X-Token': app.globalData.token
                            },
                            data: {
                                customer_id: customerId,
                                current_weight: weight
                            },
                            success: (res) => {
                                if (res.data.code === 0) {
                                    // 重新加载客户信息
                                    this.loadCustomerDetail(customerId);
                                }
                            }
                        });
                    }
                } else {
                    wx.showToast({
                        title: res.data.message || '添加失败',
                        icon: 'none'
                    });
                }
            },
            fail: () => {
                wx.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            },
            complete: () => {
                wx.hideLoading();
            }
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

    // 添加产品使用记录按钮点击事件
    addProductUsage: function () {
        // 设置当前日期为默认值
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // 加载产品列表
        this.loadProductList();

        this.setData({
            showProductModal: true,
            productDate: dateString,
            productName: '',
            remainingCount: ''
        });
    },

    // 加载产品列表
    loadProductList: function () {
        wx.request({
            url: `${app.globalData.apiBaseUrl}/products`,
            method: 'GET',
            header: {
                'content-type': 'application/json',
                'X-Token': app.globalData.token
            },
            success: (res) => {
                if (res.data.code === 0 && res.data.data) {
                    this.setData({
                        productList: res.data.data
                    });
                } else {
                    // 如果接口未提供数据，使用测试数据
                    this.setData({
                        productList: [
                            { id: 1, name: '减脂套餐A' },
                            { id: 2, name: '减脂套餐B' },
                            { id: 3, name: '全身按摩' },
                            { id: 4, name: '排毒养颜' },
                            { id: 5, name: '塑形护理' }
                        ]
                    });
                }
            },
            fail: () => {
                // 网络错误时使用测试数据
                this.setData({
                    productList: [
                        { id: 1, name: '减脂套餐A' },
                        { id: 2, name: '减脂套餐B' },
                        { id: 3, name: '全身按摩' },
                        { id: 4, name: '排毒养颜' },
                        { id: 5, name: '塑形护理' }
                    ]
                });
            }
        });
    },

    // 关闭产品记录弹窗
    closeProductModal: function () {
        this.setData({
            showProductModal: false
        });
    },

    // 日期选择变化
    onProductDateChange: function (e) {
        this.setData({
            productDate: e.detail.value
        });
    },

    // 产品选择变化
    onProductSelect: function (e) {
        const index = e.detail.value;
        const selectedProduct = this.data.productList[index];
        this.setData({
            productName: selectedProduct.name
        });
    },

    // 剩余次数输入值变化
    onRemainingCountInput: function (e) {
        this.setData({
            remainingCount: e.detail.value
        });
    },

    // 保存产品使用记录
    saveProductUsage: function () {
        if (!this.data.productName) {
            wx.showToast({
                title: '请选择产品',
                icon: 'none'
            });
            return;
        }

        if (!this.data.remainingCount || parseInt(this.data.remainingCount) < 0) {
            wx.showToast({
                title: '请输入有效的剩余次数',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({
            title: '保存中...',
        });

        // 获取当前客户ID
        const customerId = this.data.customer.id;

        // 调用API保存产品使用记录
        wx.request({
            url: `${app.globalData.apiBaseUrl}/customer/product_usage`,
            method: 'POST',
            header: {
                'content-type': 'application/json',
                'X-Token': app.globalData.token
            },
            data: {
                customer_id: customerId,
                product_name: this.data.productName,
                usage_date: this.data.productDate,
                remaining_count: parseInt(this.data.remainingCount)
            },
            success: (res) => {
                if (res.data.code === 0) {
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });

                    // 关闭弹窗并刷新数据
                    this.closeProductModal();
                    this.loadProductUsage(customerId);
                } else {
                    wx.showToast({
                        title: res.data.message || '添加失败',
                        icon: 'none'
                    });
                }
            },
            fail: () => {
                wx.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            },
            complete: () => {
                wx.hideLoading();
            }
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
        const { reportType, dateRange, userInfo, customer } = this.data;

        if (!customer || !userInfo) {
            wx.showToast({
                title: '缺少客户数据',
                icon: 'none'
            });
            return;
        }

        this.setData({ isExporting: true });

        // 获取需要导出的体重记录
        let targetRecords = [];

        if (dateRange === 'all') {
            targetRecords = this.data.weightRecords;
        } else {
            const days = parseInt(dateRange);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            targetRecords = this.data.weightRecords.filter(record => {
                const recordDate = new Date(record.record_date);
                return recordDate >= cutoffDate;
            });
        }

        if (targetRecords.length === 0) {
            this.setData({ isExporting: false });
            wx.showToast({
                title: '所选时间范围内无记录',
                icon: 'none'
            });
            return;
        }

        // 计算减重统计数据
        const firstRecord = [...targetRecords].sort((a, b) => new Date(a.record_date) - new Date(b.record_date))[0];
        const lastRecord = [...targetRecords].sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0];
        const weightLoss = firstRecord.weight - lastRecord.weight;
        const lossPercentage = ((weightLoss / firstRecord.weight) * 100).toFixed(1);

        // 添加BMI变化数据
        let bmiData = null;
        if (customer.height) {
            const initialBmi = this.calculateBmi(firstRecord.weight, customer.height);
            const currentBmi = this.calculateBmi(lastRecord.weight, customer.height);
            bmiData = {
                initial: initialBmi,
                current: currentBmi,
                change: (currentBmi - initialBmi).toFixed(1)
            };
        }

        // 添加体脂率估算数据
        let bodyFatData = null;
        if (customer.height && customer.age && customer.gender) {
            const initialBmi = this.calculateBmi(firstRecord.weight, customer.height);
            const currentBmi = this.calculateBmi(lastRecord.weight, customer.height);

            const initialBodyFat = this.calculateBodyFat(initialBmi, customer.age, customer.gender);
            const currentBodyFat = this.calculateBodyFat(currentBmi, customer.age, customer.gender);

            bodyFatData = {
                initial: initialBodyFat,
                current: currentBodyFat,
                change: (currentBodyFat - initialBodyFat).toFixed(1)
            };
        }

        // 整理数据
        const reportData = {
            customer: customer,
            records: targetRecords,
            statistics: {
                totalRecords: targetRecords.length,
                startDate: firstRecord.record_date,
                endDate: lastRecord.record_date,
                startWeight: firstRecord.weight,
                endWeight: lastRecord.weight,
                weightLoss: weightLoss.toFixed(1),
                lossPercentage: lossPercentage
            },
            bmiData: bmiData,
            bodyFatData: bodyFatData,
            reportType: reportType
        };

        // 发送到服务器生成报表
        request.post(config.apis.report.generate, {
            data: reportData
        })
            .then(res => {
                this.setData({ isExporting: false, showExportOptions: false });

                if (res && res.code === 200) {
                    // 下载报表
                    wx.showLoading({
                        title: '正在下载报表',
                    });

                    const reportUrl = res.data.url;

                    wx.downloadFile({
                        url: reportUrl,
                        success: (downloadRes) => {
                            wx.hideLoading();

                            if (downloadRes.statusCode === 200) {
                                // 打开文件
                                wx.openDocument({
                                    filePath: downloadRes.tempFilePath,
                                    success: () => {
                                        console.log('打开报表成功');
                                    },
                                    fail: (err) => {
                                        console.error('打开报表失败', err);
                                        wx.showToast({
                                            title: '打开报表失败',
                                            icon: 'none'
                                        });
                                    }
                                });
                            } else {
                                wx.showToast({
                                    title: '下载报表失败',
                                    icon: 'none'
                                });
                            }
                        },
                        fail: (err) => {
                            wx.hideLoading();
                            console.error('下载报表失败', err);
                            wx.showToast({
                                title: '下载报表失败',
                                icon: 'none'
                            });
                        }
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '生成报表失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('生成报表失败', err);
                this.setData({ isExporting: false, showExportOptions: false });

                wx.showToast({
                    title: '生成报表失败',
                    icon: 'none'
                });
            });
    },

    // 获取BMI分类
    getBmiCategory: function (bmi) {
        const categories = this.data.bmiCategories;

        for (const category of categories) {
            if (bmi >= category.min && bmi < category.max) {
                return {
                    label: category.label,
                    color: category.color
                };
            }
        }

        return { label: '未知', color: '#999' };
    },

    // 切换BMI曲线显示
    toggleBmi: function () {
        const showBmi = !this.data.showBmi;
        this.setData({ showBmi });

        // 获取当前的体重记录数据
        const { weightRecords } = this.data;
        if (weightRecords && weightRecords.length > 0) {
            // 重新创建趋势数据并绘制图表
            this.createWeightTrendData(weightRecords);
        }
    },

    // 防止事件冒泡
    stopPropagation: function (e) {
        return;
    },

    // 显示减重数据分析
    showWeightAnalysis: function () {
        // 如果尚未生成分析，则先生成
        if (!this.data.weightAnalysis && this.data.weightRecords.length >= 2) {
            this.generateWeightAnalysis(this.data.weightRecords);
        }

        if (this.data.weightAnalysis) {
            this.setData({
                showWeightAnalysisModal: true
            });
        } else {
            wx.showToast({
                title: '记录不足，无法分析',
                icon: 'none'
            });
        }
    },

    // 隐藏减重数据分析
    hideWeightAnalysis: function () {
        this.setData({
            showWeightAnalysisModal: false
        });
    },

    // 生成减重数据分析
    generateWeightAnalysis: function (records) {
        if (!records || records.length < 2 || !this.data.customer) return;

        const customer = this.data.customer;
        // 按日期排序，旧的在前面
        const sortedRecords = [...records].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

        // 1. 计算平均每周减重
        const firstRecord = sortedRecords[0];
        const lastRecord = sortedRecords[sortedRecords.length - 1];
        const totalWeightLoss = firstRecord.weight - lastRecord.weight;

        const firstDate = new Date(firstRecord.record_date);
        const lastDate = new Date(lastRecord.record_date);
        const daysDiff = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
        const weeksDiff = daysDiff / 7;

        const weeklyAvgLoss = weeksDiff > 0 ? (totalWeightLoss / weeksDiff).toFixed(2) : 0;

        // 2. 找出减重最显著的时期
        let bestPeriod = null;
        let bestLossRate = 0;

        if (sortedRecords.length >= 3) {
            for (let i = 0; i < sortedRecords.length - 1; i++) {
                const currentRecord = sortedRecords[i];
                const nextRecord = sortedRecords[i + 1];

                const weightDiff = currentRecord.weight - nextRecord.weight;
                if (weightDiff <= 0) continue; // 没有减重，跳过

                const periodStart = new Date(currentRecord.record_date);
                const periodEnd = new Date(nextRecord.record_date);
                const periodDays = Math.max(1, Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)));

                const dailyLossRate = weightDiff / periodDays;

                if (dailyLossRate > bestLossRate) {
                    bestLossRate = dailyLossRate;
                    bestPeriod = {
                        startDate: this.formatDate(periodStart),
                        endDate: this.formatDate(periodEnd),
                        days: periodDays,
                        loss: weightDiff.toFixed(1),
                        dailyRate: dailyLossRate.toFixed(2)
                    };
                }
            }
        }

        // 3. 计算预计达到目标时间
        let targetReachEstimate = null;

        if (weeklyAvgLoss > 0 && customer.current_weight > customer.target_weight) {
            const remainingWeight = customer.current_weight - customer.target_weight;
            const weeksNeeded = remainingWeight / parseFloat(weeklyAvgLoss);
            const daysNeeded = Math.ceil(weeksNeeded * 7);

            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + daysNeeded);

            targetReachEstimate = {
                date: this.formatDate(targetDate),
                days: daysNeeded,
                weeks: Math.ceil(weeksNeeded)
            };
        }

        // 4. 计算月度减重情况
        const monthlyData = this.calculateMonthlyProgress(sortedRecords);

        // 5. 计算BMI变化趋势
        const bmiTrend = this.calculateBmiTrend(sortedRecords);

        // 创建完整分析结果
        const analysis = {
            totalLoss: totalWeightLoss.toFixed(1),
            totalDays: daysDiff,
            weeklyAvgLoss: weeklyAvgLoss,
            bestPeriod: bestPeriod,
            targetReachEstimate: targetReachEstimate,
            monthlyData: monthlyData,
            bmiTrend: bmiTrend
        };

        this.setData({
            weightAnalysis: analysis
        });
    },

    // 计算月度减重进度
    calculateMonthlyProgress: function (records) {
        if (!records || records.length < 2) return [];

        const result = [];
        const recordsByMonth = {};

        // 按月份分组
        records.forEach(record => {
            const date = new Date(record.record_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!recordsByMonth[monthKey]) {
                recordsByMonth[monthKey] = [];
            }

            recordsByMonth[monthKey].push(record);
        });

        // 计算每月的首尾记录差值
        for (const monthKey in recordsByMonth) {
            const monthRecords = recordsByMonth[monthKey];

            if (monthRecords.length >= 2) {
                // 按日期排序，确保最早的在前面
                monthRecords.sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

                const firstRecord = monthRecords[0];
                const lastRecord = monthRecords[monthRecords.length - 1];
                const loss = firstRecord.weight - lastRecord.weight;

                // 月份显示格式：2023年5月
                const date = new Date(monthKey + '-01');
                const month = `${date.getFullYear()}年${date.getMonth() + 1}月`;

                result.push({
                    month: month,
                    loss: loss.toFixed(1)
                });
            }
        }

        return result;
    },

    // 计算BMI变化趋势
    calculateBmiTrend: function (records) {
        if (!records || records.length < 2 || !this.data.customer || !this.data.customer.height) return null;

        const height = this.data.customer.height;
        const firstRecord = records[0];
        const lastRecord = records[records.length - 1];

        const initialBmi = this.calculateBmi(firstRecord.weight, height);
        const currentBmi = this.calculateBmi(lastRecord.weight, height);
        const bmiChange = (currentBmi - initialBmi).toFixed(1);

        const initialCategory = this.getBmiCategory(initialBmi);
        const currentCategory = this.getBmiCategory(currentBmi);

        return {
            initial: initialBmi,
            current: currentBmi,
            change: bmiChange,
            initialCategory: initialCategory.label,
            currentCategory: currentCategory.label,
            improved: parseFloat(bmiChange) < 0
                && ((initialBmi > 24 && currentBmi < initialBmi) || (initialBmi < 18.5 && currentBmi > initialBmi))
        };
    },

    // 计算BMI
    calculateBmi: function (weight, height) {
        if (!weight || !height) return 0;
        const heightInMeters = height / 100;
        return (weight / (heightInMeters * heightInMeters)).toFixed(1);
    },

    // 计算体脂率（估算）
    calculateBodyFat: function (bmi, age, gender) {
        // 使用BMI估算体脂率的公式（仅为估算值）
        if (!bmi || !age) return null;

        // 男性和女性的系数不同
        if (gender === 1) { // 男性
            return ((1.20 * bmi) + (0.23 * age) - 16.2).toFixed(1);
        } else if (gender === 2) { // 女性
            return ((1.20 * bmi) + (0.23 * age) - 5.4).toFixed(1);
        }

        return null;
    },

    // 获取体脂率分类
    getBodyFatCategory: function (bodyFat, gender) {
        if (!bodyFat) return null;

        const bodyFatNum = parseFloat(bodyFat);

        if (gender === 1) { // 男性
            if (bodyFatNum < 10) return { label: '偏低', color: '#909399' };
            if (bodyFatNum >= 10 && bodyFatNum < 20) return { label: '健康', color: '#67c23a' };
            if (bodyFatNum >= 20 && bodyFatNum < 25) return { label: '超标', color: '#e6a23c' };
            if (bodyFatNum >= 25) return { label: '肥胖', color: '#f56c6c' };
        } else if (gender === 2) { // 女性
            if (bodyFatNum < 15) return { label: '偏低', color: '#909399' };
            if (bodyFatNum >= 15 && bodyFatNum < 25) return { label: '健康', color: '#67c23a' };
            if (bodyFatNum >= 25 && bodyFatNum < 30) return { label: '超标', color: '#e6a23c' };
            if (bodyFatNum >= 30) return { label: '肥胖', color: '#f56c6c' };
        }

        return { label: '未知', color: '#999' };
    },
}); 