// pages/customerDetail/customerDetail.js
import request from '../../utils/request';
import config from '../../config/config';
import * as echarts from '../../components/ec-canvas/echarts';

// 创建一个工具方法，用于将数据保存到本地存储
function saveToLocalStorage(key, data) {
    try {
        wx.setStorageSync(key, data);
        return true;
    } catch (error) {
        console.error('保存到本地存储失败:', error);
        return false;
    }
}

// 创建一个工具方法，用于同步模拟的本地数据更新
function syncToLocal(customerId, recordType, data) {
    if (!customerId) return false;

    // 记录类型到存储键的映射
    const keyMap = {
        'customer': `customer_${customerId}`,
        'weightRecords': `weight_records_${customerId}`,
        'productUsage': `product_usage_${customerId}`
    };

    const storageKey = keyMap[recordType];
    if (!storageKey) return false;

    return saveToLocalStorage(storageKey, data);
}

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
        weeklyWeightData: null,
        showBmi: false,
        showWeightDetail: false,
        showWeightModal: false,
        productUsageList: [],
        showProductUsageModal: false,

        // 导出报表相关数据
        showExportOptions: false,
        isExporting: false,
        reportType: 'image', // 默认导出为图片格式
        dateRange: '30',    // 默认最近30天
        showReportPreview: false,
        reportImageUrl: '',
        pageNum: 1,
        pageSize: 10,
        hasMore: true,
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
        quantity: '',
        productList: [],
        showMemberInfo: false,
        membershipId: '',
        memberStatus: '',
        // 添加周掉秤趋势测试数据
        weeklyWeightTrend: [
            { date: '周一', value: 0.5, height: 50 },
            { date: '周二', value: 0.7, height: 70 },
            { date: '周三', value: 0.4, height: 40 },
            { date: '周四', value: -0.1, height: 10 },
            { date: '周五', value: 0.6, height: 60 },
            { date: '周六', value: 0.8, height: 80 },
            { date: '周日', value: 0.3, height: 30 }
        ]
    },

    onLoad: function (options) {
        if (options.id) {
            const customerId = options.id;

            // 获取用户信息
            const userInfo = wx.getStorageSync('userInfo') || {};

            // 设置初始状态
            this.setData({
                customerId: customerId,
                userInfo: userInfo,
                activeTab: 'info',
                reportType: 'pdf',
                dateRange: '30',
                // 完全移除会员相关数据
                showMemberInfo: false,
                membershipId: '',
                memberStatus: '',
                // 默认掉秤量和代谢量为0
                weightDropValue: '0.0',
                metabolismValue: '0.0',
                // 设置图表配置
                ec: {
                    onInit: initChart,
                    lazyLoad: false  // 设置为非懒加载模式，确保图表立即初始化
                }
            });

            // 初始化BMI分类
            this.initBmiCategories();

            // 加载客户详情
            this.loadCustomerDetail();

            // 计算今日掉秤量和代谢量
            this.calculateTodayWeightMetrics();

            // 主动加载产品使用记录
            this.loadProductUsages();
        } else {
            wx.showToast({
                title: '客户ID不存在',
                icon: 'none'
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        }
    },

    onShow: function () {
        // 检查是否需要刷新
        if (wx.getStorageSync('customerDetailNeedRefresh')) {
            // 重新加载数据
            this.loadCustomerDetail();
            this.loadWeightRecords();
            this.loadProductUsages();
            wx.removeStorageSync('customerDetailNeedRefresh');
        }

        // 计算今日掉秤量和代谢量
        this.calculateTodayWeightMetrics();
    },

    onPullDownRefresh: function () {
        // 下拉刷新，重新加载数据
        this.loadCustomerDetail();
        this.loadWeightRecords();
        this.loadProductUsages();
    },

    onReachBottom: function () {
        // 如果正在查看记录，并且有更多数据，就加载更多
        if (this.data.activeTab === 'record' && this.data.hasMore && !this.data.isLoading) {
            this.loadMoreRecords();
        }
    },

    // 加载客户详情
    loadCustomerDetail: function () {
        const self = this;
        const customerId = this.data.customerId;
        const userInfo = this.data.userInfo || {};

        this.setData({
            isLoading: true
        });

        // 确保会员ID不显示
        this.setData({
            showMemberInfo: false,
            membershipId: '',
            memberStatus: ''
        });

        // 使用request.get而不是直接调用request
        request.get(config.apis.customer.detail, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            }
        })
            .then(res => {
                self.setData({ isLoading: false });
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
                        customerDetail.needs_to_lose = Math.max(0, (customerDetail.current_weight - customerDetail.target_weight)).toFixed(1);
                    }

                    // 设置客户详情
                    this.setData({
                        customer: customerDetail
                    });

                    // 计算BMI
                    if (customerDetail.height && customerDetail.current_weight) {
                        this.calculateBMI(customerDetail.current_weight, customerDetail.height);
                    }

                    // 计算体脂率估算
                    if (customerDetail.height && customerDetail.current_weight && customerDetail.age && customerDetail.gender) {
                        this.calculateBodyFatPercentage(customerDetail);
                    }

                    // 客户详情加载成功后，主动加载体重记录和产品使用记录
                    this.loadWeightRecords();
                    this.loadProductUsages();
                } else {
                    // API请求失败，但HTTP状态成功时的处理
                    console.error('API返回错误:', res);
                    self.setData({ isLoading: false });

                    // 检查是否有本地客户数据
                    const localCustomerKey = `customer_${customerId}`;
                    const localCustomer = wx.getStorageSync(localCustomerKey);

                    if (localCustomer) {
                        self.setData({
                            customer: localCustomer
                        });

                        // 如果有身高数据，计算当前BMI
                        if (localCustomer.height && localCustomer.current_weight) {
                            const currentBmi = this.calculateBmi(localCustomer.current_weight, localCustomer.height);
                            const bmiCategory = this.getBmiCategory(currentBmi);
                            const bodyFatPercentage = this.calculateBodyFat(currentBmi, localCustomer.age, localCustomer.gender);
                            const bodyFatCategory = this.getBodyFatCategory(bodyFatPercentage, localCustomer.gender);

                            this.setData({
                                currentBmi: currentBmi,
                                bmiCategory: bmiCategory,
                                bodyFatPercentage: bodyFatPercentage,
                                bodyFatCategory: bodyFatCategory
                            });
                        }

                        // 显示使用本地数据的提示
                        wx.showToast({
                            title: '使用本地客户数据',
                            icon: 'none'
                        });
                    } else {
                        // 如果没有本地数据，显示错误提示
                        wx.showToast({
                            title: res?.message || '加载客户详情失败',
                            icon: 'none'
                        });
                    }
                }
            })
            .catch(err => {
                console.error('加载客户详情失败:', err);
                self.setData({ isLoading: false });
                wx.stopPullDownRefresh();

                // 检查是否有本地客户数据
                const localCustomerKey = `customer_${customerId}`;
                const localCustomer = wx.getStorageSync(localCustomerKey);

                if (localCustomer) {
                    self.setData({
                        customer: localCustomer
                    });

                    // 如果有身高数据，计算当前BMI
                    if (localCustomer.height && localCustomer.current_weight) {
                        const currentBmi = this.calculateBmi(localCustomer.current_weight, localCustomer.height);
                        const bmiCategory = this.getBmiCategory(currentBmi);
                        const bodyFatPercentage = this.calculateBodyFat(currentBmi, localCustomer.age, localCustomer.gender);
                        const bodyFatCategory = this.getBodyFatCategory(bodyFatPercentage, localCustomer.gender);

                        this.setData({
                            currentBmi: currentBmi,
                            bmiCategory: bmiCategory,
                            bodyFatPercentage: bodyFatPercentage,
                            bodyFatCategory: bodyFatCategory
                        });
                    }

                    // 显示使用本地数据的提示
                    wx.showToast({
                        title: '使用本地缓存数据',
                        icon: 'none'
                    });
                } else {
                    // 如果没有本地数据，创建默认客户数据
                    const defaultCustomer = this.createDefaultCustomer();
                    this.setData({
                        customer: defaultCustomer
                    });

                    // 保存到本地以便下次使用
                    wx.setStorageSync(localCustomerKey, defaultCustomer);

                    wx.showToast({
                        title: '使用默认客户数据',
                        icon: 'none'
                    });
                }
            });
    },

    // 创建默认客户数据（当API和本地存储都失败时）
    createDefaultCustomer: function () {
        return {
            id: this.data.customerId,
            name: '客户' + this.data.customerId,
            phone: '1355555' + this.randomDigits(4),
            gender: 1, // 1为男性，2为女性
            age: 35,
            height: 170,
            initial_weight: 80,
            current_weight: 75,
            target_weight: 65,
            notes: '网络错误时创建的默认客户',
            create_time: this.formatDate(new Date()),
            progress: 50,
            lost_weight: 5,
            needs_to_lose: 10
        };
    },

    // 生成指定位数的随机数字
    randomDigits: function (n) {
        return Math.floor(Math.random() * Math.pow(10, n)).toString().padStart(n, '0');
    },

    // 加载减肥记录
    loadWeightRecords: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;
        console.log('开始加载体重记录，客户ID:', customerId);

        // 先从本地加载数据并显示
        this.loadWeightRecordsFromLocal();

        // 从API加载，可能需要一点时间
        request.get(config.apis.customer.weightRecords, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            }
        })
            .then(res => {
                this.setData({ isLoading: false });
                console.log('体重记录API返回数据:', res);

                if (res && res.code === 200) {
                    let records = res.data || [];
                    console.log('获取到体重记录数量:', records.length);

                    // 如果记录为空，添加一条初始记录
                    if (records.length === 0 && this.data.customer) {
                        console.log('无记录，尝试创建初始记录');
                        const { initial_weight, current_weight } = this.data.customer;

                        // 修改这里：确保即使initial_weight为空也能添加一条当前体重记录
                        const initialWeight = initial_weight || current_weight || 0;

                        // 为了图表显示，增加两个点：初始体重和当前体重
                        const initialDate = new Date();
                        initialDate.setMonth(initialDate.getMonth() - 1);

                        records = [
                            {
                                id: 'initial',
                                weight: initialWeight,
                                record_date: this.formatDate(initialDate),
                                notes: '初始体重',
                                time_type: 'morning'
                            }
                        ];

                        if (current_weight && current_weight !== initialWeight) {
                            records.push({
                                id: 'current',
                                weight: current_weight,
                                record_date: this.formatDate(new Date()),
                                notes: '当前体重',
                                time_type: 'morning'
                            });
                        } else if (!current_weight) {
                            // 如果没有当前体重，添加一条空记录用于显示
                            records.push({
                                id: 'current',
                                weight: initialWeight, // 使用初始体重作为默认值
                                record_date: this.formatDate(new Date()),
                                notes: '当前体重',
                                time_type: 'morning'
                            });
                        }

                        // 有了初始记录后，创建一个添加体重记录的按钮
                        this.setData({
                            showAddWeightBtn: true
                        });
                    } else {
                        console.log('成功获取到体重记录');
                    }

                    // 确保记录有必要的字段
                    records = records.map(record => {
                        // 确保weight是数字
                        if (typeof record.weight === 'string') {
                            record.weight = parseFloat(record.weight);
                        }

                        // 确保有time_type字段
                        if (!record.time_type) {
                            // 尝试从notes中提取，如果没有则默认为早称
                            const notes = record.notes || '';
                            record.time_type = notes.includes('晚称') ? 'evening' : 'morning';
                        }

                        return record;
                    });

                    // 计算体重变化
                    if (records.length > 0) {
                        records = this.calculateWeightChanges(records);
                    }

                    // 按日期排序，最新的在前面
                    records.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));

                    console.log('处理后的体重记录:', records);

                    // 保存到本地存储
                    const storageKey = `weight_records_${customerId}`;
                    wx.setStorageSync(storageKey, records);

                    this.setData({
                        weightRecords: records
                    });

                    // 创建减肥趋势图数据
                    this.createWeightTrendData(records);

                    // 生成减肥数据分析
                    if (records.length >= 2) {
                        this.generateWeightAnalysis(records);
                    }

                    // 计算今日掉秤量和代谢量
                    this.calculateTodayWeightMetrics();
                } else {
                    console.log('API返回错误:', res);
                    // API加载失败时，不需要处理了，因为我们已经在函数开始时从本地加载了数据
                }
            })
            .catch(err => {
                console.error('加载减肥记录失败:', err);
                this.setData({ isLoading: false });
                // API请求失败时，不需要额外处理，已经从本地加载了数据
            });
    },

    // 先从本地加载体重记录数据并显示
    loadWeightRecordsFromLocal: function () {
        const { customerId } = this.data;
        const storageKey = `weight_records_${customerId}`;
        const localRecords = wx.getStorageSync(storageKey);

        console.log('尝试从本地缓存加载体重记录...');

        if (localRecords && localRecords.length > 0) {
            console.log('从本地缓存找到体重记录:', localRecords.length, '条');

            this.setData({
                weightRecords: localRecords
            });

            // 创建体重趋势图数据
            this.createWeightTrendData(localRecords);

            // 计算今日掉秤量和代谢量
            this.calculateTodayWeightMetrics();
        } else {
            console.log('本地缓存没有体重记录');
        }
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
    loadProductUsages: function () {
        const customerId = this.data.customerId;
        const { userInfo } = this.data;

        if (!customerId || !userInfo) {
            console.error('缺少客户ID或用户信息，无法加载产品使用记录');
            return;
        }

        this.setData({ isLoading: true });

        console.log('正在加载产品使用记录，客户ID:', customerId, '用户ID:', userInfo?.id);

        // 构建API请求参数
        const requestParams = {
            user_id: userInfo.id,
            customer_id: customerId,
            page: 1,
            page_size: 999 // 一次性加载所有
        };
        console.log('API请求参数:', requestParams);

        // 从API加载最新数据
        console.log('从API加载产品使用记录');
        // 使用Promise方式发送请求
        request.get(config.apis.customer.productUsage, {
            data: requestParams
        })
            .then(res => {
                this.setData({ isLoading: false });

                if (res && res.code === 200) {
                    console.log('产品使用记录API响应:', res.data);
                    const productUsages = res.data.list || [];

                    // 确保每条记录都有完整的字段
                    const formattedUsages = productUsages.map(usage => {
                        // 确保有更新日期，如果没有则使用首购日期或当前日期
                        const updateDate = usage.update_date && usage.update_date !== '-' ?
                            usage.update_date :
                            (usage.usage_date || this.getCurrentDate());

                        return {
                            id: usage.id || 0,
                            product_id: usage.product_id || 0,
                            product_name: usage.product_name || '未知产品',
                            usage_date: usage.usage_date || this.getCurrentDate(),
                            update_date: updateDate,
                            quantity: usage.quantity || 0,            // 剩余次数
                            purchase_count: usage.purchase_count || 1 // 购买次数
                        };
                    });

                    console.log('格式化后的产品使用记录:', formattedUsages);

                    this.setData({
                        productUsageList: formattedUsages
                    });

                    // 保存到本地存储
                    const storageKey = `product_usage_${customerId}`;
                    wx.setStorageSync(storageKey, formattedUsages);
                } else {
                    // API加载失败，创建空列表
                    console.log('API获取产品使用记录失败:', res);
                    this.setData({
                        productUsageList: []
                    });
                }
            })
            .catch(err => {
                console.error('加载产品使用记录失败:', err);
                this.setData({
                    isLoading: false,
                    productUsageList: []
                });

                wx.showToast({
                    title: '加载产品记录失败',
                    icon: 'none',
                    duration: 2000
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
                    const newRecords = res.data?.list || [];

                    // 判断是否有更多数据
                    const hasMore = newRecords.length === pageSize;

                    // 确保recordList是数组
                    const currentRecords = Array.isArray(this.data.recordList) ? this.data.recordList : [];

                    this.setData({
                        recordList: currentRecords.concat(newRecords),
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

    // 创建体重趋势图数据
    createWeightTrendData: function (records) {
        console.log('开始创建体重趋势图数据');
        if (!records || records.length === 0) {
            console.log('无体重记录，无法创建趋势图');
            return;
        }

        // 按日期排序
        const sortedRecords = [...records].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

        // 提取数据
        const dates = sortedRecords.map(record => {
            // 转换日期格式为MM-DD
            try {
                const date = new Date(record.record_date);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return `${month}-${day}`;
            } catch (e) {
                console.error('日期格式转换错误:', e, record.record_date);
                return record.record_date;
            }
        });

        const weights = sortedRecords.map(record => {
            // 确保weight是数字
            try {
                return parseFloat(record.weight) || 0;
            } catch (e) {
                console.error('体重数据转换错误:', e, record.weight);
                return 0;
            }
        });

        console.log('体重趋势图数据:', { dates, weights });

        // 计算周体重变化趋势数据
        this.calculateWeeklyWeightTrend(sortedRecords);

        // 如果有身高数据，计算BMI
        const bmis = [];
        if (this.data.customer && this.data.customer.height) {
            const height = this.data.customer.height / 100; // 转换为米
            for (let weight of weights) {
                const bmi = weight / (height * height);
                bmis.push(parseFloat(bmi.toFixed(1)));
            }
        }

        // 更新图表数据
        const chartData = {
            categories: dates,
            series: [
                {
                    name: '体重',
                    data: weights,
                    type: 'line',
                    smooth: true
                }
            ]
        };

        // 添加BMI数据
        if (bmis.length > 0) {
            chartData.series.push({
                name: 'BMI',
                data: bmis,
                type: 'line',
                smooth: true,
                yAxisIndex: 1
            });
        }

        console.log('更新图表数据:', chartData);

        // 更新图表选项
        chartOption = {
            color: ['#1aad19', '#f56c6c'],
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
                data: chartData.categories
            },
            yAxis: [
                {
                    type: 'value',
                    name: '体重(kg)',
                    min: function (value) {
                        return Math.floor(value.min * 0.95);
                    }
                },
                {
                    type: 'value',
                    name: 'BMI',
                    min: function (value) {
                        return Math.floor(value.min * 0.95);
                    },
                    show: this.data.showBmi && bmis.length > 0
                }
            ],
            series: [
                {
                    name: '体重',
                    type: 'line',
                    smooth: true,
                    data: chartData.series[0].data
                }
            ]
        };

        // 添加BMI数据到图表
        if (bmis.length > 0 && this.data.showBmi) {
            chartOption.series.push({
                name: 'BMI',
                type: 'line',
                smooth: true,
                yAxisIndex: 1,
                data: chartData.series[1].data
            });
        }

        // 更新图表
        this.setData({
            chartData: chartData
        });

        // 尝试刷新图表
        this.refreshChart(chartOption);
    },

    // 刷新图表函数，使用延迟和重试机制确保图表能够正确渲染
    refreshChart: function (option) {
        // 立即尝试刷新一次
        this.doRefreshChart(option);

        // 延迟300ms后再次尝试，以防第一次尝试时组件还未完全初始化
        setTimeout(() => {
            this.doRefreshChart(option);

            // 再延迟500ms尝试最后一次，确保图表能够渲染
            setTimeout(() => {
                this.doRefreshChart(option);
            }, 500);
        }, 300);
    },

    // 实际执行图表刷新的函数
    doRefreshChart: function (option) {
        try {
            const ecComponent = this.selectComponent('#weightChart');
            if (ecComponent) {
                if (ecComponent.chart) {
                    console.log('找到图表实例，直接设置选项');
                    ecComponent.chart.setOption(option);
                } else {
                    console.log('图表实例不存在，尝试初始化');
                    ecComponent.init((canvas, width, height, dpr) => {
                        console.log('初始化图表, 尺寸:', width, height);
                        const chart = echarts.init(canvas, null, {
                            width: width,
                            height: height,
                            devicePixelRatio: dpr
                        });
                        canvas.setChart(chart);
                        chart.setOption(option);
                        return chart;
                    });
                }
            } else {
                console.log('图表组件未找到');
            }
        } catch (e) {
            console.error('刷新图表出错:', e);
        }
    },

    // 切换Tab
    switchTab: function (e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({
            activeTab: tab
        });

        // 如果切换到体重记录标签，加载体重记录并重新绘制图表
        if (tab === 'record') {
            // 加载体重记录数据
            this.loadWeightRecords();

            // 如果已有记录，重新绘制图表
            if (this.data.weightRecords && this.data.weightRecords.length > 0) {
                setTimeout(() => {
                    // 使用createWeightTrendData替代drawWeightChart
                    this.createWeightTrendData(this.data.weightRecords);
                }, 300);
            }
        } else if (tab === 'product') {
            // 加载产品使用记录
            console.log("切换到产品使用标签，加载产品使用记录");
            this.loadProductUsages();
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
        if (!this.data.weightValue || this.data.weightValue === '') {
            wx.showToast({
                title: '请输入体重',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({
            title: '保存中...',
        });

        // 获取当前客户ID
        const customerId = this.data.customer.id;
        const { userInfo } = this.data;

        // 从页面中获取数据
        const weightData = {
            user_id: userInfo.id,
            customer_id: customerId,
            weight: parseFloat(this.data.weightValue),
            record_date: this.data.weightDate,
            notes: `${this.data.weightTimeType === 'morning' ? '晨称' : '晚称'} ${this.data.weightDropValue !== null ? `掉秤量: ${this.data.weightDropValue}kg` : ''} ${this.data.metabolismValue !== null ? `代谢量: ${this.data.metabolismValue}kg` : ''}`
        };

        // 调用API保存体重记录
        request.post(config.apis.customer.addWeightRecord, weightData)
            .then(res => {
                wx.hideLoading();

                if (res && res.code === 200) {
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });

                    // 关闭弹窗
                    this.closeWeightModal();

                    // 更新客户当前体重
                    const updatedCustomer = { ...this.data.customer };
                    updatedCustomer.current_weight = weightData.weight;
                    this.setData({
                        customer: updatedCustomer
                    });

                    // 重新加载体重记录
                    this.loadWeightRecords();
                } else {
                    wx.showToast({
                        title: res?.message || '添加失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('保存体重记录失败:', err);

                wx.showToast({
                    title: '添加失败',
                    icon: 'none'
                });
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
        // 如果是本地生成的ID，直接从本地删除
        if (recordId.toString().startsWith('local_')) {
            const updatedRecords = this.data.weightRecords.filter(record => record.id !== recordId);

            // 重新计算体重变化
            if (updatedRecords.length > 0) {
                const recalculatedRecords = this.calculateWeightChanges(updatedRecords);
                this.setData({
                    weightRecords: recalculatedRecords
                });
            } else {
                this.setData({
                    weightRecords: []
                });
            }

            // 重新绘制图表
            this.createWeightTrendData(updatedRecords);

            // 保存到本地存储
            syncToLocal(this.data.customerId, 'weightRecords', updatedRecords.length > 0 ? updatedRecords : []);

            wx.showToast({
                title: '删除成功',
                icon: 'success'
            });

            return;
        }

        // 远程API删除
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

                    // 重新计算体重变化
                    if (updatedRecords.length > 0) {
                        const recalculatedRecords = this.calculateWeightChanges(updatedRecords);
                        this.setData({
                            weightRecords: recalculatedRecords
                        });
                    } else {
                        this.setData({
                            weightRecords: []
                        });
                    }

                    // 重新绘制图表
                    this.createWeightTrendData(updatedRecords);

                    // 保存到本地存储
                    syncToLocal(this.data.customerId, 'weightRecords', updatedRecords.length > 0 ? updatedRecords : []);

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
            selectedProductId: null,
            quantity: '',
            modalTitle: '添加产品记录'
        });
    },

    // 加载产品列表
    loadProductList: function () {
        console.log('加载产品列表 - 从API获取数据');
        const { userInfo } = this.data;

        // 调用API获取真实产品数据
        request.get(config.apis.customer.products, {
            data: {
                user_id: userInfo.id
            }
        })
            .then(res => {
                if (res && res.code === 200) {
                    this.setData({
                        productList: res.data || []
                    });
                    console.log('成功获取产品列表:', this.data.productList);
                } else {
                    console.log('获取产品列表失败:', res);
                    // 如果API失败，使用默认数据
                    this.loadDefaultProductList();
                }
            })
            .catch(err => {
                console.error('获取产品列表错误:', err);
                // 如果API调用出错，使用默认数据
                this.loadDefaultProductList();
            });
    },

    // 加载默认产品列表（当API调用失败时使用）
    loadDefaultProductList: function () {
        console.log('使用默认产品数据');
        this.setData({
            productList: [
                { id: 1, name: '减脂套餐A', description: '标准减脂套餐', price: 199 },
                { id: 2, name: '减脂套餐B', description: '高级减脂套餐', price: 299 },
                { id: 3, name: '全身按摩', description: '舒缓减压全身按摩', price: 159 },
                { id: 4, name: '排毒养颜', description: '排毒养颜护理', price: 259 },
                { id: 5, name: '塑形护理', description: '专业塑形护理', price: 359 }
            ]
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
        const index = parseInt(e.detail.value);
        const selectedProduct = this.data.productList[index];

        if (!selectedProduct) {
            console.error('无法找到选择的产品', index, this.data.productList);
            return;
        }

        // 设置选中的产品信息
        this.setData({
            selectedProductId: selectedProduct.id,
            productName: selectedProduct.name,
            modalTitle: '添加产品记录'
        });
    },

    // 剩余次数输入值变化
    onQuantityInput: function (e) {
        this.setData({
            quantity: e.detail.value
        });
    },

    // 保存产品使用记录
    saveProductUsage: function () {
        // 检查输入
        if (!this.data.selectedProductId || !this.data.quantity) {
            wx.showToast({
                title: '请填写完整信息',
                icon: 'none'
            });
            return;
        }

        // 显示加载
        wx.showLoading({
            title: '保存中...',
        });

        const { userInfo, customerId, selectedProductId, productName, productDate, quantity } = this.data;

        // 确保ID和数量是数字类型
        const customerIdNum = parseInt(customerId);
        const productIdNum = parseInt(selectedProductId);
        const quantityNum = parseFloat(quantity);

        if (isNaN(customerIdNum)) {
            wx.hideLoading();
            wx.showToast({
                title: '数据格式错误',
                icon: 'none'
            });
            return;
        }

        // 获取当前日期作为更新日期
        const currentDate = this.getCurrentDate();

        // 创建新产品使用记录
        const productData = {
            user_id: userInfo.id,
            customer_id: customerIdNum,
            product_id: productIdNum,
            product_name: productName,
            usage_date: productDate,
            update_date: currentDate,     // 添加更新日期
            quantity: quantityNum,        // 剩余次数
            purchase_count: parseInt(quantity)  // 设置购买次数与输入的剩余次数一致
        };

        // 调用API保存
        request.post(config.apis.customer.addProductUsage, productData)
            .then(res => {
                wx.hideLoading();

                if (res && res.code === 200) {
                    // 关闭弹窗并提示
                    this.closeProductModal();

                    // 成功后重新加载列表，确保显示最新数据
                    this.loadProductUsages();

                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '添加失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('保存产品记录失败:', err);
                wx.showToast({
                    title: '添加失败',
                    icon: 'none'
                });
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
        const type = e.currentTarget.dataset.type;
        this.setData({
            reportType: type
        });
    },

    // 选择日期范围
    selectDateRange: function (e) {
        const range = e.currentTarget.dataset.range;
        this.setData({
            dateRange: range
        });
    },

    // 关闭报表预览
    closeReportPreview: function () {
        this.setData({
            showReportPreview: false,
            reportImageUrl: ''
        });
    },

    // 计算BMI指数
    calculateBmi: function (weight, height) {
        if (!weight || !height) return 0;

        // 身高转换为米
        const heightInMeters = height / 100;
        // BMI = 体重(kg) / 身高(m)²
        const bmi = weight / (heightInMeters * heightInMeters);
        return bmi.toFixed(1);
    },

    // 估算体脂率，基于BMI、年龄和性别
    calculateBodyFat: function (bmi, age, gender) {
        if (!bmi || !age) return 0;

        // 使用简化的体脂率估算公式: 1.2 * BMI + 0.23 * 年龄 - 5.4 - (10.8 * 性别修正)
        // 性别修正: 男性为1，女性为0
        const genderFactor = gender === 'male' ? 1 : 0;
        const bodyFat = 1.2 * bmi + 0.23 * age - 5.4 - (10.8 * genderFactor);

        // 确保结果在合理范围内
        return Math.max(3, Math.min(bodyFat, 45)).toFixed(1);
    },

    // 格式化日期为YYYY-MM-DD
    formatDate: function (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
            try {
                const initialBmi = this.calculateBmi(firstRecord.weight, customer.height);
                const currentBmi = this.calculateBmi(lastRecord.weight, customer.height);

                // 确保BMI数据是有效的数字
                if (!isNaN(initialBmi) && !isNaN(currentBmi)) {
                    bmiData = {
                        initial: initialBmi,
                        current: currentBmi,
                        change: (currentBmi - initialBmi).toFixed(1)
                    };
                }
            } catch (error) {
                console.error('计算BMI数据错误:', error);
            }
        }

        // 添加体脂率估算数据
        let bodyFatData = null;
        if (customer.height && customer.age && customer.gender) {
            try {
                const initialBmi = this.calculateBmi(firstRecord.weight, customer.height);
                const currentBmi = this.calculateBmi(lastRecord.weight, customer.height);

                const initialBodyFat = this.calculateBodyFat(initialBmi, customer.age, customer.gender);
                const currentBodyFat = this.calculateBodyFat(currentBmi, customer.age, customer.gender);

                // 确保体脂率数据是有效的数字
                if (!isNaN(initialBodyFat) && !isNaN(currentBodyFat)) {
                    bodyFatData = {
                        initial: initialBodyFat,
                        current: currentBodyFat,
                        change: (currentBodyFat - initialBodyFat).toFixed(1)
                    };
                }
            } catch (error) {
                console.error('计算体脂率数据错误:', error);
            }
        }

        // 获取产品使用数据
        let productUsageData = [];
        try {
            // 创建临时对象以便处理
            const tempProductData = {};

            if (Array.isArray(this.data.productUsageList)) {
                this.data.productUsageList.forEach(usage => {
                    if (!usage) return; // 跳过无效数据

                    const productName = usage.product_name || '未知产品';
                    if (!tempProductData[productName]) {
                        tempProductData[productName] = {
                            product_name: productName,
                            usage_date: usage.usage_date || '未知日期',
                            purchase_count: 0,
                            update_date: ''
                        };
                    }

                    tempProductData[productName].purchase_count += usage.purchase_count || 1;

                    // 更新最近使用日期
                    const usageDate = usage.usage_date;
                    if (!tempProductData[productName].update_date ||
                        new Date(usageDate) > new Date(tempProductData[productName].update_date)) {
                        tempProductData[productName].update_date = usageDate;
                    }
                });

                // 将对象转换为数组格式
                productUsageData = Object.values(tempProductData);
            }
        } catch (error) {
            console.error('处理产品使用数据出错:', error);
            productUsageData = []; // 确保为有效数组
        }

        // 准备绘制Canvas的数据
        const reportData = {
            customer: customer,
            startDate: firstRecord.record_date,
            endDate: lastRecord.record_date,
            startWeight: firstRecord.weight,
            currentWeight: lastRecord.weight,
            weightLoss: parseFloat(weightLoss.toFixed(1)), // 确保weightLoss是数字而不是字符串
            lossPercentage: parseFloat(lossPercentage),    // 确保lossPercentage是数字
            bmiData: bmiData,
            bodyFatData: bodyFatData,
            productUsageData: Array.isArray(productUsageData) ? productUsageData : [], // 确保是数组
            weightRecords: targetRecords.sort((a, b) => new Date(a.record_date) - new Date(b.record_date))
        };

        console.log('报表数据:', reportData);

        // 设置延迟以确保UI更新完成
        setTimeout(() => {
            // 创建Canvas绘制报表
            this.drawReportOnCanvas(reportData);
        }, 500);
    },

    // 在Canvas上绘制报表
    drawReportOnCanvas: function (reportData) {
        const query = wx.createSelectorQuery();
        query.select('#reportCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                // 处理Canvas元素
                if (!res[0] || !res[0].node) {
                    console.error('Canvas元素不存在，尝试创建离屏Canvas');
                    try {
                        // 使用离屏Canvas - 提高分辨率
                        const offscreenCanvas = wx.createOffscreenCanvas({
                            type: '2d',
                            width: 1125,  // 增加宽度 (750 * 1.5)
                            height: 2700  // 增加高度 (1800 * 1.5)
                        });

                        // 确保Canvas被正确创建
                        if (!offscreenCanvas) {
                            throw new Error('创建离屏Canvas失败');
                        }

                        // 获取上下文
                        const ctx = offscreenCanvas.getContext('2d');
                        if (!ctx) {
                            throw new Error('获取Canvas上下文失败');
                        }

                        // 绘制内容并生成图片
                        this.drawReportContent(offscreenCanvas, reportData);
                    } catch (error) {
                        console.error('离屏Canvas处理失败:', error);
                        this.showReportError();
                    }
                    return;
                }

                try {
                    const canvas = res[0].node;

                    // 确保Canvas已准备好并且有效
                    if (!canvas || !canvas.getContext) {
                        throw new Error('Canvas元素无效');
                    }

                    // 设置Canvas大小 - 使用更高的分辨率以确保图片清晰
                    const canvasWidth = 1125;  // 增加至1.5倍分辨率
                    const canvasHeight = 2700;

                    // 重设canvas大小以避免模糊和重影
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;

                    // 获取上下文
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        throw new Error('获取Canvas上下文失败');
                    }

                    // 调用优化后的绘制函数
                    this.drawReportContent(canvas, reportData);
                } catch (error) {
                    console.error('Canvas绘制初始化失败:', error);
                    this.showReportError();
                }
            });
    },

    // 绘制报表内容
    drawReportContent: function (canvas, data) {
        if (!canvas) {
            console.error('无效的canvas对象');
            return;
        }

        // 直接从canvas获取尺寸信息
        let canvasWidth, canvasHeight;
        try {
            canvasWidth = parseInt(canvas.width) || 1125;
            canvasHeight = parseInt(canvas.height) || 2800;

            // 确保值是有效的正整数
            if (isNaN(canvasWidth) || canvasWidth <= 0 || !isFinite(canvasWidth)) {
                console.error('无效的canvas宽度:', canvasWidth);
                canvasWidth = 1125;
            }

            if (isNaN(canvasHeight) || canvasHeight <= 0 || !isFinite(canvasHeight)) {
                console.error('无效的canvas高度:', canvasHeight);
                canvasHeight = 2800;
            }

            // 避免过大的尺寸值
            canvasWidth = Math.min(canvasWidth, 5000);
            canvasHeight = Math.min(canvasHeight, 10000);

            console.log('Canvas尺寸:', canvasWidth, 'x', canvasHeight);
        } catch (error) {
            console.error('获取Canvas尺寸失败:', error);
            canvasWidth = 1125;
            canvasHeight = 2800;
        }

        // 获取上下文
        let ctx;
        try {
            ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('无法获取Canvas上下文');
            }
        } catch (error) {
            console.error('获取Canvas上下文失败:', error);
            this.showReportError();
            return;
        }

        try {
            // 完全清除Canvas
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.save();

            // 绘制白色背景
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 定义颜色方案
            const colors = {
                primary: '#3B82F6', // 蓝色
                secondary: '#10B981', // 绿色
                accent: '#F59E0B', // 橙色
                danger: '#EF4444', // 红色
                light: '#F3F4F6', // 浅灰色
                dark: '#374151', // 深灰色
                text: '#1F2937', // 文字颜色
                lightText: '#6B7280' // 浅色文字
            };

            // 定义间距和布局参数
            const margin = 40;
            const sectionMargin = 25;
            const contentWidth = canvasWidth - (margin * 2);

            // 定义当前绘制位置
            let yPos = 0;

            // ------------- 报告头部 -------------
            const headerHeight = 180;
            // 绘制渐变背景
            try {
                const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
                gradient.addColorStop(0, colors.primary);
                gradient.addColorStop(1, '#1D4ED8');
                ctx.fillStyle = gradient;
            } catch (error) {
                console.error('创建渐变失败:', error);
                ctx.fillStyle = colors.primary;
            }
            ctx.fillRect(0, 0, canvasWidth, headerHeight);

            // 绘制报告标题
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('减重管理报告', canvasWidth / 2, 80);

            // 绘制日期范围
            ctx.font = '24px sans-serif';
            const dateRange = `${data.startDate || '未知'} 至 ${data.endDate || '未知'}`;
            ctx.fillText(dateRange, canvasWidth / 2, 120);

            // 更新当前位置
            yPos = headerHeight + 30;

            // ------------- 客户信息部分 -------------
            // 获取客户数据
            const customer = data.customer || {};
            const customerName = customer.name || '未知客户';
            const gender = customer.gender ? (customer.gender === 1 ? '男' : '女') : '未知';
            const age = customer.age || '未知';
            const height = customer.height || '未知';

            // 绘制信息卡片
            this.drawSectionCard(ctx, {
                title: '客户信息',
                icon: '👤',
                startY: yPos,
                width: contentWidth,
                margin: margin,
                colors: colors
            });

            // 计算左右两列的位置
            const leftColumnX = margin + 30;
            const rightColumnX = margin + contentWidth / 2 + 30;
            const rowHeight = 40;

            // 绘制客户信息行
            ctx.font = '22px sans-serif';
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'left';

            // 左侧信息
            ctx.fillText(`姓名: ${customerName}`, leftColumnX, yPos + 90);
            ctx.fillText(`性别: ${gender}`, leftColumnX, yPos + 90 + rowHeight);
            ctx.fillText(`年龄: ${age}岁`, leftColumnX, yPos + 90 + rowHeight * 2);

            // 右侧信息
            ctx.fillText(`身高: ${height}cm`, rightColumnX, yPos + 90);
            ctx.fillText(`初始体重: ${data.startWeight}kg`, rightColumnX, yPos + 90 + rowHeight);
            ctx.fillText(`当前体重: ${data.currentWeight}kg`, rightColumnX, yPos + 90 + rowHeight * 2);

            // 更新位置
            yPos += 90 + rowHeight * 3 + 30;

            // ------------- 今日减重情况 -------------
            // 获取最新的两条体重记录，计算当天的掉秤量和代谢量
            let todayWeightInfo = null;

            if (data.weightRecords && Array.isArray(data.weightRecords) && data.weightRecords.length >= 2) {
                try {
                    // 获取排序后的记录
                    const sortedRecords = [...data.weightRecords].sort((a, b) =>
                        new Date(b.record_date) - new Date(a.record_date));

                    // 检查是否有今天的记录
                    const today = new Date();
                    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                    // 查找今天的记录和前一天的记录
                    const todayRecords = sortedRecords.filter(r => r.record_date === todayDateStr);
                    const yesterdayDate = new Date(today);
                    yesterdayDate.setDate(today.getDate() - 1);
                    const yesterdayDateStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
                    const yesterdayRecords = sortedRecords.filter(r => r.record_date === yesterdayDateStr);

                    // 查找今天和昨天的早晨体重记录
                    const todayMorning = todayRecords.find(r => r.time_type === 'morning');
                    const yesterdayMorning = yesterdayRecords.find(r => r.time_type === 'morning');

                    // 查找昨天的晚上体重记录和今天的晚上体重记录
                    const yesterdayEvening = yesterdayRecords.find(r => r.time_type === 'evening');
                    const todayEvening = todayRecords.find(r => r.time_type === 'evening');

                    // 准备今日数据
                    todayWeightInfo = {
                        date: todayDateStr,
                        hasMorningData: !!(todayMorning && yesterdayMorning),
                        hasEveningData: !!(todayEvening && yesterdayEvening),
                        dropValue: todayMorning && yesterdayMorning ?
                            (yesterdayMorning.weight - todayMorning.weight).toFixed(1) : null,
                        metaValue: todayEvening && yesterdayEvening ?
                            (yesterdayEvening.weight - todayEvening.weight).toFixed(1) : null
                    };
                } catch (e) {
                    console.error('计算今日减重数据失败:', e);
                }
            }

            // 如果有今日数据，显示今日减重情况
            if (todayWeightInfo && (todayWeightInfo.hasMorningData || todayWeightInfo.hasEveningData)) {
                yPos = this.drawSectionCard(ctx, {
                    title: '今日减重情况',
                    icon: '📊',
                    startY: yPos,
                    width: contentWidth,
                    margin: margin,
                    colors: colors,
                    accentColor: colors.accent
                });

                // 绘制日期
                const today = new Date();
                const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
                const todayFormatted = today.toLocaleDateString('zh-CN', dateOptions);

                ctx.font = 'bold 22px sans-serif';
                ctx.fillStyle = colors.text;
                ctx.textAlign = 'center';
                ctx.fillText(todayFormatted, canvasWidth / 2, yPos + 35);

                // 绘制减重数据
                const cardPadding = 20;
                const cardWidth = (contentWidth - cardPadding * 3) / 2;
                const cardHeight = 100;

                if (todayWeightInfo.hasMorningData) {
                    // 绘制掉秤量卡片
                    const dropCardX = margin + cardPadding;
                    const dropCardY = yPos + 55;
                    this.drawMetricCard(ctx, {
                        x: dropCardX,
                        y: dropCardY,
                        width: cardWidth,
                        height: cardHeight,
                        title: '掉秤量',
                        value: `${todayWeightInfo.dropValue}kg`,
                        icon: '⬇️',
                        color: parseFloat(todayWeightInfo.dropValue) > 0 ? colors.secondary : colors.danger,
                        textColor: '#FFFFFF'
                    });
                }

                if (todayWeightInfo.hasEveningData) {
                    // 绘制代谢量卡片
                    const metaCardX = margin + cardWidth + cardPadding * 2;
                    const metaCardY = yPos + 55;
                    this.drawMetricCard(ctx, {
                        x: metaCardX,
                        y: metaCardY,
                        width: cardWidth,
                        height: cardHeight,
                        title: '代谢量',
                        value: `${todayWeightInfo.metaValue}kg`,
                        icon: '🔥',
                        color: parseFloat(todayWeightInfo.metaValue) > 0 ? colors.accent : colors.danger,
                        textColor: '#FFFFFF'
                    });
                }

                // 更新位置
                yPos += 55 + cardHeight + 30;
            }

            // ------------- 减重成果统计 -------------
            yPos = this.drawSectionCard(ctx, {
                title: '减重成果统计',
                icon: '📈',
                startY: yPos,
                width: contentWidth,
                margin: margin,
                colors: colors,
                accentColor: colors.secondary
            });

            // 绘制成果卡片
            const statsCardPadding = 15;
            const statsCardWidth = (contentWidth - statsCardPadding * 4) / 3;
            const statsCardHeight = 130;

            // 初始体重卡片
            this.drawMetricCard(ctx, {
                x: margin + statsCardPadding,
                y: yPos + 30,
                width: statsCardWidth,
                height: statsCardHeight,
                title: '初始体重',
                value: `${parseFloat(data.startWeight).toFixed(1)}kg`,
                subtitle: data.bmiData ? `BMI: ${parseFloat(data.bmiData.initial).toFixed(1)}` : null,
                color: colors.light,
                textColor: colors.text,
                valueFontSize: 32
            });

            // 当前体重卡片
            this.drawMetricCard(ctx, {
                x: margin + statsCardWidth + statsCardPadding * 2,
                y: yPos + 30,
                width: statsCardWidth,
                height: statsCardHeight,
                title: '当前体重',
                value: `${parseFloat(data.currentWeight).toFixed(1)}kg`,
                subtitle: data.bmiData ? `BMI: ${parseFloat(data.bmiData.current).toFixed(1)}` : null,
                color: colors.light,
                textColor: colors.text,
                valueFontSize: 32
            });

            // 减重总量卡片
            const weightLoss = typeof data.weightLoss === 'number' ? data.weightLoss : parseFloat(data.weightLoss || 0);
            const lossPercentage = typeof data.lossPercentage === 'number' ? data.lossPercentage : parseFloat(data.lossPercentage || 0);

            this.drawMetricCard(ctx, {
                x: margin + statsCardWidth * 2 + statsCardPadding * 3,
                y: yPos + 30,
                width: statsCardWidth,
                height: statsCardHeight,
                title: '减重总量',
                value: `${weightLoss.toFixed(1)}kg`,
                subtitle: `减重比例: ${lossPercentage.toFixed(1)}%`,
                color: weightLoss > 0 ? colors.secondary : colors.danger,
                textColor: '#FFFFFF',
                valueFontSize: 32
            });

            // 更新位置
            yPos += 30 + statsCardHeight + 30;

            // ------------- 体重变化趋势 -------------
            yPos = this.drawSectionCard(ctx, {
                title: '体重变化趋势',
                icon: '📉',
                startY: yPos,
                width: contentWidth,
                margin: margin,
                colors: colors,
                accentColor: colors.primary
            });

            // 绘制图表背景
            const chartMargin = 15;
            const chartX = margin + chartMargin;
            const chartY = yPos + 30;
            const chartWidth = contentWidth - chartMargin * 2;
            const chartHeight = 280;

            // 绘制图表背景
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            this.roundRect(ctx, chartX, chartY, chartWidth, chartHeight, 8);
            ctx.fill();

            // 绘制减重曲线
            if (data.weightRecords && Array.isArray(data.weightRecords) && data.weightRecords.length >= 2) {
                this.drawWeightTrendChart(ctx, {
                    x: chartX,
                    y: chartY,
                    width: chartWidth,
                    height: chartHeight,
                    records: data.weightRecords,
                    colors: colors
                });
            } else {
                // 没有足够的数据，显示提示
                ctx.fillStyle = colors.lightText;
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('暂无足够的体重记录数据', chartX + chartWidth / 2, chartY + chartHeight / 2);
            }

            // 更新位置
            yPos += 30 + chartHeight + 30;

            // ------------- 产品使用情况 -------------
            yPos = this.drawSectionCard(ctx, {
                title: '产品使用情况',
                icon: '🛒',
                startY: yPos,
                width: contentWidth,
                margin: margin,
                colors: colors,
                accentColor: '#F59E0B' // 使用橙色作为标题背景，与图片一致
            });

            // 绘制产品表格
            const tableX = margin + 15;
            const tableY = yPos + 30;
            const tableWidth = contentWidth - 30;
            const tableHeight = 200;

            // 处理产品数据
            let formattedProductData = [];
            if (data.productUsageData && Array.isArray(data.productUsageData)) {
                // 对产品使用数据进行处理，确保格式正确，但不合并相同产品
                formattedProductData = data.productUsageData.map(product => {
                    // 确保数据包含所有必要的字段
                    return {
                        product_name: product.product_name || '未知产品',
                        first_purchase_date: product.first_purchase_date || product.usage_date || '',
                        update_date: product.update_date || product.usage_date || '',
                        purchase_count: parseInt(product.purchase_count || 0),
                        remaining_count: parseInt(product.remaining_count || product.purchase_count || 0)
                    };
                });

                // 按更新日期排序，最近的在前
                formattedProductData.sort((a, b) => new Date(b.update_date) - new Date(a.update_date));
            }

            // 绘制表格
            this.drawProductTable(ctx, {
                x: tableX,
                y: tableY,
                width: tableWidth,
                height: tableHeight,
                products: formattedProductData,
                colors: colors
            });

            // 更新位置
            yPos += 30 + tableHeight + 30;

            // ------------- 减重分析与建议 -------------
            yPos = this.drawSectionCard(ctx, {
                title: '减重分析与建议',
                icon: '💡',
                startY: yPos,
                width: contentWidth,
                margin: margin,
                colors: colors,
                accentColor: colors.primary
            });

            // 分析文本
            let analysisText = '';
            if (weightLoss <= 0) {
                analysisText = `在${data.totalDays || 30}天的时间里，您的体重没有减轻，建议调整饮食和运动计划。`;
            } else if (weightLoss < 2) {
                analysisText = `在${data.totalDays || 30}天的时间里，您总共减重${weightLoss.toFixed(1)}kg，减重效果较轻微，建议增加运动量。`;
            } else if (weightLoss < 5) {
                analysisText = `在${data.totalDays || 30}天的时间里，您总共减重${weightLoss.toFixed(1)}kg，减重效果良好，请保持当前的生活方式。`;
            } else {
                analysisText = `在${data.totalDays || 30}天的时间里，您总共减重${weightLoss.toFixed(1)}kg，减重效果显著，非常出色！`;
            }

            // 绘制分析文本
            const analysisWidth = contentWidth - 60;
            ctx.fillStyle = colors.text;
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'left';
            const analysisY = this.drawWrappedText(ctx, analysisText, margin + 30, yPos + 30, analysisWidth, 28);

            // 建议标题
            ctx.fillStyle = colors.primary;
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText('健康减重建议:', margin + 30, analysisY + 40);

            // 健康建议
            let tipsY = analysisY + 40;
            const healthTips = [
                '• 坚持适量的有氧运动，如快走、慢跑或骑自行车',
                '• 控制碳水化合物摄入，增加蛋白质和膳食纤维',
                '• 保持规律的作息时间，充足的睡眠有助于减重',
                '• 多喝水，控制饮食量，避免暴饮暴食',
                '• 定期记录体重变化，及时调整减重策略'
            ];

            ctx.fillStyle = colors.text;
            ctx.font = '18px sans-serif';
            for (const tip of healthTips) {
                tipsY += 28;
                ctx.fillText(tip, margin + 30, tipsY);
            }

            // 绘制水印
            ctx.fillStyle = 'rgba(59, 130, 246, 0.03)';
            ctx.font = 'bold 120px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('减重管理', canvasWidth / 2, canvasHeight - 100);

            // 绘制页脚
            ctx.fillStyle = colors.lightText;
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('本报告由专业减重管理系统生成', canvasWidth / 2, canvasHeight - 40);

            // 恢复状态
            ctx.restore();

            // 生成图片
            try {
                this.generateReportImage(canvas);
            } catch (error) {
                console.error('生成报告图片错误:', error);
                this.fallbackGenerateImage(canvas);
            }
        } catch (error) {
            console.error('绘制报告失败:', error);
            this.showReportError();
        }
    },

    // 绘制圆角矩形
    roundRect: function (ctx, x, y, width, height, radius) {
        if (typeof radius === 'undefined') {
            radius = 5;
        }

        // 支持设置不同角落的圆角半径
        if (typeof radius === 'object') {
            const { tl = 5, tr = 5, br = 5, bl = 5 } = radius;

            ctx.beginPath();
            ctx.moveTo(x + tl, y);
            ctx.lineTo(x + width - tr, y);
            ctx.arcTo(x + width, y, x + width, y + tr, tr);
            ctx.lineTo(x + width, y + height - br);
            ctx.arcTo(x + width, y + height, x + width - br, y + height, br);
            ctx.lineTo(x + bl, y + height);
            ctx.arcTo(x, y + height, x, y + height - bl, bl);
            ctx.lineTo(x, y + tl);
            ctx.arcTo(x, y, x + tl, y, tl);
            ctx.closePath();
            return;
        }

        // 统一的圆角半径
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
    },

    // 绘制部分标题卡片
    drawSectionCard: function (ctx, options) {
        const { title, icon, startY, width, margin, colors, accentColor = colors.primary } = options;
        const height = 60;
        const x = margin;
        const y = startY;

        // 绘制卡片背景
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        this.roundRect(ctx, x, y, width, height, 8);
        ctx.fill();

        // 绘制图标和标题
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(icon ? `${icon} ${title}` : title, x + 20, y + 38);

        return startY + height;
    },

    // 绘制指标卡片
    drawMetricCard: function (ctx, options) {
        const { x, y, width, height, title, value, subtitle, icon, color, textColor, valueFontSize = 36 } = options;

        // 绘制卡片背景
        ctx.fillStyle = color;
        ctx.beginPath();
        this.roundRect(ctx, x, y, width, height, 8);
        ctx.fill();

        // 绘制标题
        ctx.fillStyle = textColor;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(icon ? `${icon} ${title}` : title, x + width / 2, y + 30);

        // 绘制值
        ctx.font = `bold ${valueFontSize}px sans-serif`;
        ctx.fillText(value, x + width / 2, y + 30 + valueFontSize);

        // 绘制副标题
        if (subtitle) {
            ctx.font = '16px sans-serif';
            ctx.fillText(subtitle, x + width / 2, y + height - 15);
        }
    },

    // 绘制体重趋势图表
    drawWeightTrendChart: function (ctx, options) {
        const { x, y, width, height, records, colors } = options;

        if (!records || !Array.isArray(records) || records.length < 2) {
            // 绘制无数据提示
            ctx.fillStyle = colors.lightText;
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('数据不足，无法绘制趋势图', x + width / 2, y + height / 2);
            return;
        }

        try {
            // 对记录按日期排序
            const sortedRecords = [...records].sort((a, b) =>
                new Date(a.record_date) - new Date(b.record_date));

            // 找出最小和最大重量，设置图表范围
            let minWeight = Math.min(...sortedRecords.map(r => parseFloat(r.weight)));
            let maxWeight = Math.max(...sortedRecords.map(r => parseFloat(r.weight)));

            // 为了更好的视觉效果，扩展范围
            const range = maxWeight - minWeight;
            minWeight = Math.max(0, minWeight - range * 0.1);
            maxWeight = maxWeight + range * 0.1;

            // 图表内部边距
            const padding = { top: 30, right: 30, bottom: 50, left: 50 };
            const chartInnerWidth = width - padding.left - padding.right;
            const chartInnerHeight = height - padding.top - padding.bottom;

            // 绘制坐标轴
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 1;

            // Y轴
            ctx.beginPath();
            ctx.moveTo(x + padding.left, y + padding.top);
            ctx.lineTo(x + padding.left, y + height - padding.bottom);
            ctx.stroke();

            // X轴
            ctx.beginPath();
            ctx.moveTo(x + padding.left, y + height - padding.bottom);
            ctx.lineTo(x + width - padding.right, y + height - padding.bottom);
            ctx.stroke();

            // 绘制Y轴刻度
            const yTicks = 5;
            const yTickStep = chartInnerHeight / (yTicks - 1);
            const weightStep = (maxWeight - minWeight) / (yTicks - 1);

            ctx.fillStyle = colors.lightText;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'right';

            for (let i = 0; i < yTicks; i++) {
                const tickY = y + padding.top + i * yTickStep;
                const tickWeight = maxWeight - i * weightStep;

                // 绘制水平网格线
                ctx.strokeStyle = '#F3F4F6';
                ctx.beginPath();
                ctx.moveTo(x + padding.left, tickY);
                ctx.lineTo(x + width - padding.right, tickY);
                ctx.stroke();

                // 绘制刻度值
                ctx.fillText(tickWeight.toFixed(1), x + padding.left - 10, tickY + 5);
            }

            // 绘制X轴刻度 - 只显示部分日期以避免拥挤
            const dateCount = sortedRecords.length;
            const xStep = chartInnerWidth / (dateCount - 1 || 1);

            ctx.textAlign = 'center';

            // 确定要显示的日期索引
            const maxLabels = 5;
            const labelStep = Math.max(1, Math.ceil(dateCount / maxLabels));

            sortedRecords.forEach((record, index) => {
                if (index % labelStep === 0 || index === dateCount - 1) {
                    const tickX = x + padding.left + index * xStep;
                    const dateObj = new Date(record.record_date);
                    const dateLabel = `${dateObj.getMonth() + 1}-${dateObj.getDate()}`;

                    ctx.fillText(dateLabel, tickX, y + height - padding.bottom + 20);
                }
            });

            // 绘制体重曲线
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 3;
            ctx.beginPath();

            sortedRecords.forEach((record, index) => {
                const pointX = x + padding.left + index * xStep;
                const weight = parseFloat(record.weight);
                const normalizedWeight = 1 - (weight - minWeight) / (maxWeight - minWeight);
                const pointY = y + padding.top + normalizedWeight * chartInnerHeight;

                if (index === 0) {
                    ctx.moveTo(pointX, pointY);
                } else {
                    ctx.lineTo(pointX, pointY);
                }
            });

            ctx.stroke();

            // 绘制填充区域
            ctx.beginPath();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';  // 蓝色半透明

            // 起始点 (底部)
            const startX = x + padding.left;
            const startY = y + height - padding.bottom;

            // 移动到起始点
            ctx.moveTo(startX, startY);

            // 绘制体重曲线路径
            sortedRecords.forEach((record, index) => {
                const pointX = x + padding.left + index * xStep;
                const weight = parseFloat(record.weight);
                const normalizedWeight = 1 - (weight - minWeight) / (maxWeight - minWeight);
                const pointY = y + padding.top + normalizedWeight * chartInnerHeight;
                ctx.lineTo(pointX, pointY);
            });

            // 绘制回底部的路径
            const endX = x + padding.left + (dateCount - 1) * xStep;
            ctx.lineTo(endX, startY);
            ctx.closePath();
            ctx.fill();

            // 绘制数据点
            sortedRecords.forEach((record, index) => {
                const pointX = x + padding.left + index * xStep;
                const weight = parseFloat(record.weight);
                const normalizedWeight = 1 - (weight - minWeight) / (maxWeight - minWeight);
                const pointY = y + padding.top + normalizedWeight * chartInnerHeight;

                // 外圆
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
                ctx.fill();

                // 内圆
                ctx.fillStyle = colors.primary;
                ctx.beginPath();
                ctx.arc(pointX, pointY, 4, 0, Math.PI * 2);
                ctx.fill();
            });

            // 绘制图表标题
            ctx.fillStyle = colors.text;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('体重变化曲线 (kg)', x + width / 2, y + 20);

            // 添加平均减重速率
            if (sortedRecords.length >= 2) {
                const firstWeight = parseFloat(sortedRecords[0].weight);
                const lastWeight = parseFloat(sortedRecords[sortedRecords.length - 1].weight);
                const weightLoss = firstWeight - lastWeight;

                const firstDate = new Date(sortedRecords[0].record_date);
                const lastDate = new Date(sortedRecords[sortedRecords.length - 1].record_date);
                const daysDiff = Math.max(1, Math.round((lastDate - firstDate) / (24 * 60 * 60 * 1000)));

                const avgLossPerDay = (weightLoss / daysDiff).toFixed(2);

                ctx.fillStyle = colors.secondary;
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`平均每日减重: ${avgLossPerDay}kg`, x + padding.left, y + padding.top - 10);
            }

        } catch (error) {
            console.error('绘制体重趋势图表失败:', error);

            // 绘制错误提示
            ctx.fillStyle = colors.danger;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('绘制趋势图时出现错误', x + width / 2, y + height / 2);
        }
    },

    // 绘制产品表格
    drawProductTable: function (ctx, options) {
        const { x, y, width, height, products, colors } = options;

        // 绘制表格背景
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        this.roundRect(ctx, x, y, width, height, 8);
        ctx.fill();

        // 如果没有产品数据
        if (!products || !Array.isArray(products) || products.length === 0) {
            ctx.fillStyle = colors.lightText;
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无产品使用记录', x + width / 2, y + height / 2);
            return;
        }

        // 定义列宽 - 根据图片格式调整列宽比例
        const col1Width = width * 0.25; // 产品名称
        const col2Width = width * 0.25; // 首购日期
        const col3Width = width * 0.25; // 更新日期
        const col4Width = width * 0.15; // 次数
        const col5Width = width * 0.10; // 剩余

        // 绘制表头背景 - 使用橙色(#F59E0B)与图片一致
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        this.roundRect(ctx, x, y, width, 40, { tl: 8, tr: 8, bl: 0, br: 0 });
        ctx.fill();

        // 绘制表头文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';

        // 按照图片中的表头设置
        ctx.fillText('名称', x + col1Width / 2, y + 25);
        ctx.fillText('首购', x + col1Width + col2Width / 2, y + 25);
        ctx.fillText('更新', x + col1Width + col2Width + col3Width / 2, y + 25);
        ctx.fillText('次数', x + col1Width + col2Width + col3Width + col4Width / 2, y + 25);
        ctx.fillText('剩余', x + col1Width + col2Width + col3Width + col4Width + col5Width / 2, y + 25);

        // 绘制数据行
        const rowHeight = 40;
        // 最多显示5条记录，如果有更多则在底部显示信息
        const maxItems = Math.min(5, products.length);
        const displayProducts = products.slice(0, maxItems);

        displayProducts.forEach((product, index) => {
            const rowY = y + 40 + index * rowHeight;

            // 绘制行背景（所有行使用浅灰色背景 #F9FAFB）
            ctx.fillStyle = '#F9FAFB';
            ctx.fillRect(x, rowY, width, rowHeight);

            // 绘制边框线
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, rowY);
            ctx.lineTo(x + width, rowY);
            ctx.stroke();

            // 设置文本样式
            ctx.fillStyle = '#374151'; // 深灰色文本
            ctx.font = '16px sans-serif';

            // 产品名称
            ctx.textAlign = 'center';
            const productName = product.product_name || '未知产品';
            ctx.fillText(productName, x + col1Width / 2, rowY + 25);

            // 首购日期 - 格式化为 YYYY-MM-DD
            const firstPurchaseDate = product.first_purchase_date || product.usage_date || '';
            const formattedFirstDate = firstPurchaseDate ? this.formatShortDate(firstPurchaseDate) : '';
            ctx.fillText(formattedFirstDate, x + col1Width + col2Width / 2, rowY + 25);

            // 更新日期 - 格式化为 YYYY-MM-DD
            const updateDate = product.update_date || product.usage_date || '';
            const formattedUpdateDate = updateDate ? this.formatShortDate(updateDate) : '';
            ctx.fillText(formattedUpdateDate, x + col1Width + col2Width + col3Width / 2, rowY + 25);

            // 次数 - 用绿色背景突出显示
            const purchaseCount = product.purchase_count || 0;

            // 绘制次数背景 - 使用绿色背景(#10B981)
            ctx.fillStyle = '#10B981';
            const countBgX = x + col1Width + col2Width + col3Width + col4Width / 2 - 20;
            const countBgY = rowY + 10;
            const countBgWidth = 40;
            const countBgHeight = 25;
            ctx.beginPath();
            this.roundRect(ctx, countBgX, countBgY, countBgWidth, countBgHeight, 5);
            ctx.fill();

            // 绘制次数文本
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(purchaseCount + '次', x + col1Width + col2Width + col3Width + col4Width / 2, rowY + 25);

            // 剩余数量显示为 + 号
            ctx.fillStyle = '#3B82F6'; // 蓝色
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('+', x + col1Width + col2Width + col3Width + col4Width + col5Width / 2, rowY + 25);
        });

        // 如果有更多记录，显示提示
        if (products.length > maxItems) {
            ctx.fillStyle = colors.lightText;
            ctx.font = 'italic 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`还有 ${products.length - maxItems} 条记录未显示`, x + width / 2, y + height - 15);
        }
    },

    // 格式化短日期 (YYYY-MM-DD)
    formatShortDate: function (dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString; // 如果解析失败，返回原字符串
            }

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error('日期格式化错误:', e);
            return dateString; // 发生错误时返回原字符串
        }
    },

    // 绘制包裹文本，返回文本结束的Y坐标
    drawWrappedText: function (ctx, text, x, y, maxWidth, lineHeight) {
        if (!text) return y;

        // 中文文本处理方式
        const chars = text.split('');
        let line = '';
        let lineCount = 0;

        for (let n = 0; n < chars.length; n++) {
            const testLine = line + chars[n];
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, y + (lineCount * lineHeight));
                line = chars[n];
                lineCount++;
            } else {
                line = testLine;
            }
        }

        ctx.fillText(line, x, y + (lineCount * lineHeight));
        return y + (lineCount * lineHeight);
    },

    // 生成报告图片
    generateReportImage: function (canvas) {
        wx.showLoading({ title: '正在生成报表...' });
        const self = this;

        // 确保canvas是有效对象
        if (!canvas) {
            console.error('Canvas对象无效');
            this.showReportError();
            return;
        }

        try {
            // 使用wx API直接操作canvas
            wx.canvasToTempFilePath({
                canvas: canvas,
                x: 0,
                y: 0,
                width: canvas.width || 1125,
                height: canvas.height || 2700,
                destWidth: (canvas.width || 1125) * 2,  // 更高的输出分辨率
                destHeight: (canvas.height || 2700) * 2,
                fileType: 'png',  // 使用png格式以保持透明度和清晰度
                quality: 1.0, // 使用最高质量
                success: function (res) {
                    console.log('报告图片生成完成:', res.tempFilePath);
                    self.handleGeneratedImage(res.tempFilePath);
                },
                fail: function (err) {
                    console.error('生成图片失败:', err);
                    // 尝试备用方法生成图片
                    self.fallbackGenerateImage(canvas);
                },
                complete: function () {
                    setTimeout(() => {
                        wx.hideLoading();
                    }, 200);
                }
            }, self);
        } catch (error) {
            console.error('生成报告图片错误:', error);
            // 尝试备用方法
            this.fallbackGenerateImage(canvas);
        }
    },

    // 备用的图片生成方法
    fallbackGenerateImage: function (canvas) {
        try {
            console.log('尝试使用备用方法生成图片');
            const width = canvas.width || 1125;
            const height = canvas.height || 2700;

            // 创建一个新的离屏canvas
            const offscreenCanvas = wx.createOffscreenCanvas({
                type: '2d',
                width: width,
                height: height
            });

            if (!offscreenCanvas) {
                throw new Error('创建离屏Canvas失败');
            }

            const offscreenCtx = offscreenCanvas.getContext('2d');
            if (!offscreenCtx) {
                throw new Error('获取离屏Canvas上下文失败');
            }

            // 直接绘制白色背景
            offscreenCtx.fillStyle = '#ffffff';
            offscreenCtx.fillRect(0, 0, width, height);

            // 如果原canvas上下文存在，尝试复制内容
            try {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const imageData = ctx.getImageData(0, 0, width, height);
                    offscreenCtx.putImageData(imageData, 0, 0);
                }
            } catch (e) {
                console.error('复制Canvas内容失败:', e);
                // 在失败的情况下，至少提供一个基本的文本
                offscreenCtx.fillStyle = '#333333';
                offscreenCtx.font = 'bold 24px sans-serif';
                offscreenCtx.textAlign = 'center';
                offscreenCtx.fillText('客户减重报告', width / 2, 70);
            }

            // 尝试导出图片
            try {
                const tempFilePath = offscreenCanvas.toDataURL('image/png');
                if (tempFilePath) {
                    this.handleGeneratedImage(tempFilePath);
                    return;
                }
            } catch (e) {
                console.error('导出图片数据失败:', e);
            }

            // 如果上面的方法都失败，尝试使用wx API直接从离屏Canvas生成
            wx.canvasToTempFilePath({
                canvas: offscreenCanvas,
                x: 0,
                y: 0,
                width: width,
                height: height,
                destWidth: width * 2,
                destHeight: height * 2,
                fileType: 'png',
                quality: 1.0,
                success: (res) => {
                    this.handleGeneratedImage(res.tempFilePath);
                },
                fail: (err) => {
                    console.error('备用方法生成图片失败:', err);
                    this.showReportError();
                }
            });
        } catch (error) {
            console.error('备用图片生成方法失败:', error);
            this.showReportError();
        }
    },

    // 绘制减重统计区块 - 修改以避免文字重影，增加当天减重情况
    drawStatsSection: function (ctx, data, startY, width) {
        // 保存当前绘图状态
        ctx.save();

        // 标题 - 改进标题样式
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 36px sans-serif'; // 增大字体
        ctx.textAlign = 'center';
        ctx.fillText('减重成果统计', width / 2, startY);

        // 绘制装饰线
        const lineWidth = 80;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth, startY + 15);
        ctx.lineTo(width / 2 + lineWidth, startY + 15);
        ctx.stroke();

        // 绘制统计卡片背景 - 使用更轻的阴影或去除阴影
        const cardY = startY + 30;
        const cardHeight = 250; // 增加高度以容纳更多信息
        const cornerRadius = 12; // 圆角半径

        // 绘制圆角矩形
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(40 + cornerRadius, cardY);
        ctx.lineTo(width - 40 - cornerRadius, cardY);
        ctx.quadraticCurveTo(width - 40, cardY, width - 40, cardY + cornerRadius);
        ctx.lineTo(width - 40, cardY + cardHeight - cornerRadius);
        ctx.quadraticCurveTo(width - 40, cardY + cardHeight, width - 40 - cornerRadius, cardY + cardHeight);
        ctx.lineTo(40 + cornerRadius, cardY + cardHeight);
        ctx.quadraticCurveTo(40, cardY + cardHeight, 40, cardY + cornerRadius);
        ctx.lineTo(40, cardY + cornerRadius);
        ctx.quadraticCurveTo(40, cardY, 40 + cornerRadius, cardY);
        ctx.closePath();

        // 使用更轻的阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.shadowColor = 'transparent'; // 禁用阴影以避免影响后续绘制

        // 定义三列布局
        const colWidth = (width - 80) / 3;

        // 绘制"初始体重"列
        const startWeight = parseFloat(data.startWeight) || 0;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#555555';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('初始体重', 40 + colWidth / 2, cardY + 45);

        ctx.fillStyle = '#333333';
        ctx.font = 'bold 42px sans-serif';
        ctx.fillText(`${startWeight.toFixed(1)} kg`, 40 + colWidth / 2, cardY + 100);

        // 绘制BMI值
        try {
            const initialBmi = this.calculateBmi ? this.calculateBmi(startWeight, data.customer?.height) : null;
            // 确保BMI是有效数字
            const validBmi = initialBmi !== null && !isNaN(parseFloat(initialBmi));
            const bmiText = validBmi ? `BMI: ${parseFloat(initialBmi).toFixed(1)}` : 'BMI: --';
            ctx.fillStyle = '#0288D1';
            ctx.font = '18px sans-serif';
            ctx.fillText(bmiText, 40 + colWidth / 2, cardY + 130);

            // 如果有BMI分类，显示分类
            if (validBmi && this.getBmiCategory) {
                const category = this.getBmiCategory(parseFloat(initialBmi));
                if (category) {
                    ctx.fillStyle = category.color || '#0288D1';
                    ctx.font = '16px sans-serif';
                    ctx.fillText(category.label || '--', 40 + colWidth / 2, cardY + 155);
                }
            }
        } catch (e) {
            console.error('绘制BMI值失败:', e);
            ctx.fillText('BMI: --', 40 + colWidth / 2, cardY + 130);
        }

        // 绘制"当前体重"列
        const currentWeight = parseFloat(data.currentWeight) || 0;
        ctx.fillStyle = '#555555';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('当前体重', 40 + colWidth + colWidth / 2, cardY + 45);

        ctx.fillStyle = '#333333';
        ctx.font = 'bold 42px sans-serif';
        ctx.fillText(`${currentWeight.toFixed(1)} kg`, 40 + colWidth + colWidth / 2, cardY + 100);

        // 绘制体脂率
        try {
            const currentBmi = this.calculateBmi ? this.calculateBmi(currentWeight, data.customer?.height) : null;
            // 确保BMI是有效数字
            const validBmi = currentBmi !== null && !isNaN(parseFloat(currentBmi));

            let bodyFat = null;
            if (validBmi && data.customer && this.calculateBodyFat) {
                bodyFat = this.calculateBodyFat(
                    parseFloat(currentBmi),
                    data.customer.age,
                    data.customer.gender === 1 ? 'male' : 'female'
                );
            }

            // 确保体脂率是有效数字
            const validBodyFat = bodyFat !== null && !isNaN(parseFloat(bodyFat));
            const bodyFatText = validBodyFat ? `体脂率: ${parseFloat(bodyFat).toFixed(1)}%` : '体脂率: --';

            ctx.fillStyle = '#FF9800';
            ctx.font = '18px sans-serif';
            ctx.fillText(bodyFatText, 40 + colWidth + colWidth / 2, cardY + 130);

            // 如果有体脂分类，显示分类
            if (validBodyFat && this.getBodyFatCategory && data.customer) {
                const category = this.getBodyFatCategory(
                    parseFloat(bodyFat),
                    data.customer.gender === 1 ? 'male' : 'female'
                );
                if (category) {
                    ctx.fillStyle = category.color || '#FF9800';
                    ctx.font = '16px sans-serif';
                    ctx.fillText(category.label || '--', 40 + colWidth + colWidth / 2, cardY + 155);
                }
            }
        } catch (e) {
            console.error('绘制体脂率失败:', e);
            ctx.fillText('体脂率: --', 40 + colWidth + colWidth / 2, cardY + 130);
        }

        // 绘制"减重总量"列
        let weightLoss = 0;
        let lossPercentage = 0;
        let dailyLoss = 0;

        try {
            weightLoss = typeof data.weightLoss === 'number' ?
                data.weightLoss : parseFloat(data.weightLoss || 0);

            if (startWeight > 0) {
                lossPercentage = (weightLoss / startWeight) * 100;
            }

            // 计算每日平均减重 (如果有天数信息)
            if (data.totalDays && data.totalDays > 0) {
                dailyLoss = weightLoss / data.totalDays;
            }
        } catch (e) {
            console.error('计算减重数据失败:', e);
        }

        ctx.fillStyle = '#555555';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('减重总量', 40 + 2 * colWidth + colWidth / 2, cardY + 45);

        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 42px sans-serif';
        ctx.fillText(`${weightLoss.toFixed(1)} kg`, 40 + 2 * colWidth + colWidth / 2, cardY + 100);

        // 绘制减重百分比背景
        const percentBgWidth = 180;
        const percentBgHeight = 32;
        const percentBgX = 40 + 2 * colWidth + colWidth / 2 - percentBgWidth / 2;
        const percentBgY = cardY + 130;
        const percentBgRadius = 16;

        ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
        ctx.beginPath();
        ctx.moveTo(percentBgX + percentBgRadius, percentBgY);
        ctx.lineTo(percentBgX + percentBgWidth - percentBgRadius, percentBgY);
        ctx.arcTo(percentBgX + percentBgWidth, percentBgY, percentBgX + percentBgWidth, percentBgY + percentBgRadius, percentBgRadius);
        ctx.lineTo(percentBgX + percentBgWidth, percentBgY + percentBgHeight - percentBgRadius);
        ctx.arcTo(percentBgX + percentBgWidth, percentBgY + percentBgHeight, percentBgX + percentBgWidth - percentBgRadius, percentBgY + percentBgHeight, percentBgRadius);
        ctx.lineTo(percentBgX + percentBgRadius, percentBgY + percentBgHeight);
        ctx.arcTo(percentBgX, percentBgY + percentBgHeight, percentBgX, percentBgY + percentBgHeight - percentBgRadius, percentBgRadius);
        ctx.lineTo(percentBgX, percentBgY + percentBgRadius);
        ctx.arcTo(percentBgX, percentBgY, percentBgX + percentBgRadius, percentBgY, percentBgRadius);
        ctx.closePath();
        ctx.fill();

        // 绘制减重百分比文字
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`减重比例: ${lossPercentage.toFixed(1)}%`, 40 + 2 * colWidth + colWidth / 2, percentBgY + 22);

        // 添加每日减重数据
        const dailyLossTextY = percentBgY + percentBgHeight + 22;
        if (dailyLoss > 0) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = '16px sans-serif';
            ctx.fillText(`日均: ${dailyLoss.toFixed(2)} kg/天`, 40 + 2 * colWidth + colWidth / 2, dailyLossTextY);
        }

        // 绘制今日减重情况 (如果有数据)
        if (data.weightRecords && Array.isArray(data.weightRecords) && data.weightRecords.length >= 2) {
            try {
                // 按日期排序
                const sortedRecords = [...data.weightRecords].sort((a, b) =>
                    new Date(b.record_date) - new Date(a.record_date));

                // 获取最新两条记录
                const latestRecord = sortedRecords[0];
                const prevRecord = sortedRecords[1];

                // 检查最新记录是否是今天的
                const today = new Date();
                const latestDate = new Date(latestRecord.record_date);

                const isToday = latestDate.getDate() === today.getDate() &&
                    latestDate.getMonth() === today.getMonth() &&
                    latestDate.getFullYear() === today.getFullYear();

                // 如果最新记录是今天的，计算并显示今日减重情况
                if (isToday && prevRecord) {
                    const todayLoss = parseFloat(prevRecord.weight) - parseFloat(latestRecord.weight);

                    // 绘制今日减重标签
                    const todayLabelY = cardY + cardHeight - 30;
                    ctx.fillStyle = '#f8f8f8';
                    ctx.fillRect(40, todayLabelY - 20, width - 80, 40);

                    ctx.fillStyle = todayLoss > 0 ? '#4CAF50' : (todayLoss < 0 ? '#f44336' : '#757575');
                    ctx.font = 'bold 18px sans-serif';
                    ctx.textAlign = 'center';

                    const todayLossText = todayLoss > 0 ?
                        `今日减重: ${todayLoss.toFixed(2)} kg` :
                        (todayLoss < 0 ? `今日增重: ${Math.abs(todayLoss).toFixed(2)} kg` : '今日体重无变化');

                    ctx.fillText(todayLossText, width / 2, todayLabelY + 5);
                }
            } catch (e) {
                console.error('计算今日减重数据失败:', e);
            }
        }

        // 绘制增强的分隔线
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 2;

        // 第一条分隔线
        ctx.beginPath();
        ctx.moveTo(40 + colWidth, cardY + 40);
        ctx.lineTo(40 + colWidth, cardY + cardHeight - 40);
        ctx.stroke();

        // 第二条分隔线
        ctx.beginPath();
        ctx.moveTo(40 + 2 * colWidth, cardY + 40);
        ctx.lineTo(40 + 2 * colWidth, cardY + cardHeight - 40);
        ctx.stroke();

        // 恢复状态
        ctx.restore();
    },

    // 刷新图表函数，使用延迟和重试机制确保图表能够正确渲染
    refreshChart: function (option) {
        // 立即尝试刷新一次
        this.doRefreshChart(option);

        // 延迟300ms后再次尝试，以防第一次尝试时组件还未完全初始化
        setTimeout(() => {
            this.doRefreshChart(option);

            // 再延迟500ms尝试最后一次，确保图表能够渲染
            setTimeout(() => {
                this.doRefreshChart(option);
            }, 500);
        }, 300);
    },

    // 实际执行图表刷新的函数
    doRefreshChart: function (option) {
        try {
            const ecComponent = this.selectComponent('#weightChart');
            if (ecComponent) {
                if (ecComponent.chart) {
                    console.log('找到图表实例，直接设置选项');
                    ecComponent.chart.setOption(option);
                } else {
                    console.log('图表实例不存在，尝试初始化');
                    ecComponent.init((canvas, width, height, dpr) => {
                        console.log('初始化图表, 尺寸:', width, height);
                        const chart = echarts.init(canvas, null, {
                            width: width,
                            height: height,
                            devicePixelRatio: dpr
                        });
                        canvas.setChart(chart);
                        chart.setOption(option);
                        return chart;
                    });
                }
            } else {
                console.log('图表组件未找到');
            }
        } catch (e) {
            console.error('刷新图表出错:', e);
        }
    },

    // 切换Tab
    switchTab: function (e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({
            activeTab: tab
        });

        // 如果切换到体重记录标签，加载体重记录并重新绘制图表
        if (tab === 'record') {
            // 加载体重记录数据
            this.loadWeightRecords();

            // 如果已有记录，重新绘制图表
            if (this.data.weightRecords && this.data.weightRecords.length > 0) {
                setTimeout(() => {
                    // 使用createWeightTrendData替代drawWeightChart
                    this.createWeightTrendData(this.data.weightRecords);
                }, 300);
            }
        } else if (tab === 'product') {
            // 加载产品使用记录
            console.log("切换到产品使用标签，加载产品使用记录");
            this.loadProductUsages();
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
        if (!this.data.weightValue || this.data.weightValue === '') {
            wx.showToast({
                title: '请输入体重',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({
            title: '保存中...',
        });

        // 获取当前客户ID
        const customerId = this.data.customer.id;
        const { userInfo } = this.data;

        // 从页面中获取数据
        const weightData = {
            user_id: userInfo.id,
            customer_id: customerId,
            weight: parseFloat(this.data.weightValue),
            record_date: this.data.weightDate,
            notes: `${this.data.weightTimeType === 'morning' ? '晨称' : '晚称'} ${this.data.weightDropValue !== null ? `掉秤量: ${this.data.weightDropValue}kg` : ''} ${this.data.metabolismValue !== null ? `代谢量: ${this.data.metabolismValue}kg` : ''}`
        };

        // 调用API保存体重记录
        request.post(config.apis.customer.addWeightRecord, weightData)
            .then(res => {
                wx.hideLoading();

                if (res && res.code === 200) {
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });

                    // 关闭弹窗
                    this.closeWeightModal();

                    // 更新客户当前体重
                    const updatedCustomer = { ...this.data.customer };
                    updatedCustomer.current_weight = weightData.weight;
                    this.setData({
                        customer: updatedCustomer
                    });

                    // 重新加载体重记录
                    this.loadWeightRecords();
                } else {
                    wx.showToast({
                        title: res?.message || '添加失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('保存体重记录失败:', err);

                wx.showToast({
                    title: '添加失败',
                    icon: 'none'
                });
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
        // 如果是本地生成的ID，直接从本地删除
        if (recordId.toString().startsWith('local_')) {
            const updatedRecords = this.data.weightRecords.filter(record => record.id !== recordId);

            // 重新计算体重变化
            if (updatedRecords.length > 0) {
                const recalculatedRecords = this.calculateWeightChanges(updatedRecords);
                this.setData({
                    weightRecords: recalculatedRecords
                });
            } else {
                this.setData({
                    weightRecords: []
                });
            }

            // 重新绘制图表
            this.createWeightTrendData(updatedRecords);

            // 保存到本地存储
            syncToLocal(this.data.customerId, 'weightRecords', updatedRecords.length > 0 ? updatedRecords : []);

            wx.showToast({
                title: '删除成功',
                icon: 'success'
            });

            return;
        }

        // 远程API删除
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

                    // 重新计算体重变化
                    if (updatedRecords.length > 0) {
                        const recalculatedRecords = this.calculateWeightChanges(updatedRecords);
                        this.setData({
                            weightRecords: recalculatedRecords
                        });
                    } else {
                        this.setData({
                            weightRecords: []
                        });
                    }

                    // 重新绘制图表
                    this.createWeightTrendData(updatedRecords);

                    // 保存到本地存储
                    syncToLocal(this.data.customerId, 'weightRecords', updatedRecords.length > 0 ? updatedRecords : []);

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
            selectedProductId: null,
            quantity: '',
            modalTitle: '添加产品记录'
        });
    },

    // 加载产品列表
    loadProductList: function () {
        console.log('加载产品列表 - 从API获取数据');
        const { userInfo } = this.data;

        // 调用API获取真实产品数据
        request.get(config.apis.customer.products, {
            data: {
                user_id: userInfo.id
            }
        })
            .then(res => {
                if (res && res.code === 200) {
                    this.setData({
                        productList: res.data || []
                    });
                    console.log('成功获取产品列表:', this.data.productList);
                } else {
                    console.log('获取产品列表失败:', res);
                    // 如果API失败，使用默认数据
                    this.loadDefaultProductList();
                }
            })
            .catch(err => {
                console.error('获取产品列表错误:', err);
                // 如果API调用出错，使用默认数据
                this.loadDefaultProductList();
            });
    },

    // 加载默认产品列表（当API调用失败时使用）
    loadDefaultProductList: function () {
        console.log('使用默认产品数据');
        this.setData({
            productList: [
                { id: 1, name: '减脂套餐A', description: '标准减脂套餐', price: 199 },
                { id: 2, name: '减脂套餐B', description: '高级减脂套餐', price: 299 },
                { id: 3, name: '全身按摩', description: '舒缓减压全身按摩', price: 159 },
                { id: 4, name: '排毒养颜', description: '排毒养颜护理', price: 259 },
                { id: 5, name: '塑形护理', description: '专业塑形护理', price: 359 }
            ]
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
        const index = parseInt(e.detail.value);
        const selectedProduct = this.data.productList[index];

        if (!selectedProduct) {
            console.error('无法找到选择的产品', index, this.data.productList);
            return;
        }

        // 设置选中的产品信息
        this.setData({
            selectedProductId: selectedProduct.id,
            productName: selectedProduct.name,
            modalTitle: '添加产品记录'
        });
    },

    // 剩余次数输入值变化
    onQuantityInput: function (e) {
        this.setData({
            quantity: e.detail.value
        });
    },

    // 保存产品使用记录
    saveProductUsage: function () {
        // 检查输入
        if (!this.data.selectedProductId || !this.data.quantity) {
            wx.showToast({
                title: '请填写完整信息',
                icon: 'none'
            });
            return;
        }

        // 显示加载
        wx.showLoading({
            title: '保存中...',
        });

        const { userInfo, customerId, selectedProductId, productName, productDate, quantity } = this.data;

        // 确保ID和数量是数字类型
        const customerIdNum = parseInt(customerId);
        const productIdNum = parseInt(selectedProductId);
        const quantityNum = parseFloat(quantity);

        if (isNaN(customerIdNum)) {
            wx.hideLoading();
            wx.showToast({
                title: '数据格式错误',
                icon: 'none'
            });
            return;
        }

        // 获取当前日期作为更新日期
        const currentDate = this.getCurrentDate();

        // 创建新产品使用记录
        const productData = {
            user_id: userInfo.id,
            customer_id: customerIdNum,
            product_id: productIdNum,
            product_name: productName,
            usage_date: productDate,
            update_date: currentDate,     // 添加更新日期
            quantity: quantityNum,        // 剩余次数
            purchase_count: parseInt(quantity)  // 设置购买次数与输入的剩余次数一致
        };

        // 调用API保存
        request.post(config.apis.customer.addProductUsage, productData)
            .then(res => {
                wx.hideLoading();

                if (res && res.code === 200) {
                    // 关闭弹窗并提示
                    this.closeProductModal();

                    // 成功后重新加载列表，确保显示最新数据
                    this.loadProductUsages();

                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '添加失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('保存产品记录失败:', err);
                wx.showToast({
                    title: '添加失败',
                    icon: 'none'
                });
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
        const type = e.currentTarget.dataset.type;
        this.setData({
            reportType: type
        });
    },

    // 选择日期范围
    selectDateRange: function (e) {
        const range = e.currentTarget.dataset.range;
        this.setData({
            dateRange: range
        });
    },

    // 关闭报表预览
    closeReportPreview: function () {
        this.setData({
            showReportPreview: false,
            reportImageUrl: ''
        });
    },

    // 计算BMI指数
    calculateBmi: function (weight, height) {
        if (!weight || !height) return 0;

        // 身高转换为米
        const heightInMeters = height / 100;
        // BMI = 体重(kg) / 身高(m)²
        const bmi = weight / (heightInMeters * heightInMeters);
        return bmi.toFixed(1);
    },

    // 估算体脂率，基于BMI、年龄和性别
    calculateBodyFat: function (bmi, age, gender) {
        if (!bmi || !age) return 0;

        // 使用简化的体脂率估算公式: 1.2 * BMI + 0.23 * 年龄 - 5.4 - (10.8 * 性别修正)
        // 性别修正: 男性为1，女性为0
        const genderFactor = gender === 'male' ? 1 : 0;
        const bodyFat = 1.2 * bmi + 0.23 * age - 5.4 - (10.8 * genderFactor);

        // 确保结果在合理范围内
        return Math.max(3, Math.min(bodyFat, 45)).toFixed(1);
    },

    // 格式化日期为YYYY-MM-DD
    formatDate: function (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
            try {
                const initialBmi = this.calculateBmi(firstRecord.weight, customer.height);
                const currentBmi = this.calculateBmi(lastRecord.weight, customer.height);

                // 确保BMI数据是有效的数字
                if (!isNaN(initialBmi) && !isNaN(currentBmi)) {
                    bmiData = {
                        initial: initialBmi,
                        current: currentBmi,
                        change: (currentBmi - initialBmi).toFixed(1)
                    };
                }
            } catch (error) {
                console.error('计算BMI数据错误:', error);
            }
        }

        // 添加体脂率估算数据
        let bodyFatData = null;
        if (customer.height && customer.age && customer.gender) {
            try {
                const initialBmi = this.calculateBmi(firstRecord.weight, customer.height);
                const currentBmi = this.calculateBmi(lastRecord.weight, customer.height);

                const initialBodyFat = this.calculateBodyFat(initialBmi, customer.age, customer.gender);
                const currentBodyFat = this.calculateBodyFat(currentBmi, customer.age, customer.gender);

                // 确保体脂率数据是有效的数字
                if (!isNaN(initialBodyFat) && !isNaN(currentBodyFat)) {
                    bodyFatData = {
                        initial: initialBodyFat,
                        current: currentBodyFat,
                        change: (currentBodyFat - initialBodyFat).toFixed(1)
                    };
                }
            } catch (error) {
                console.error('计算体脂率数据错误:', error);
            }
        }

        // 获取产品使用数据
        let productUsageData = [];
        try {
            // 创建临时对象以便处理
            const tempProductData = {};

            if (Array.isArray(this.data.productUsageList)) {
                this.data.productUsageList.forEach(usage => {
                    if (!usage) return; // 跳过无效数据

                    const productName = usage.product_name || '未知产品';
                    if (!tempProductData[productName]) {
                        tempProductData[productName] = {
                            product_name: productName,
                            usage_date: usage.usage_date || '未知日期',
                            purchase_count: 0,
                            update_date: ''
                        };
                    }

                    tempProductData[productName].purchase_count += usage.purchase_count || 1;

                    // 更新最近使用日期
                    const usageDate = usage.usage_date;
                    if (!tempProductData[productName].update_date ||
                        new Date(usageDate) > new Date(tempProductData[productName].update_date)) {
                        tempProductData[productName].update_date = usageDate;
                    }
                });

                // 将对象转换为数组格式
                productUsageData = Object.values(tempProductData);
            }
        } catch (error) {
            console.error('处理产品使用数据出错:', error);
            productUsageData = []; // 确保为有效数组
        }

        // 准备绘制Canvas的数据
        const reportData = {
            customer: customer,
            startDate: firstRecord.record_date,
            endDate: lastRecord.record_date,
            startWeight: firstRecord.weight,
            currentWeight: lastRecord.weight,
            weightLoss: parseFloat(weightLoss.toFixed(1)), // 确保weightLoss是数字而不是字符串
            lossPercentage: parseFloat(lossPercentage),    // 确保lossPercentage是数字
            bmiData: bmiData,
            bodyFatData: bodyFatData,
            productUsageData: Array.isArray(productUsageData) ? productUsageData : [], // 确保是数组
            weightRecords: targetRecords.sort((a, b) => new Date(a.record_date) - new Date(b.record_date))
        };

        console.log('报表数据:', reportData);

        // 设置延迟以确保UI更新完成
        setTimeout(() => {
            // 创建Canvas绘制报表
            this.drawReportOnCanvas(reportData);
        }, 500);
    },

    // 在Canvas上绘制报表
    drawReportOnCanvas: function (reportData) {
        const query = wx.createSelectorQuery();
        query.select('#reportCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                // 处理Canvas元素
                if (!res[0] || !res[0].node) {
                    console.error('Canvas元素不存在，尝试创建离屏Canvas');
                    try {
                        // 使用离屏Canvas - 提高分辨率
                        const offscreenCanvas = wx.createOffscreenCanvas({
                            type: '2d',
                            width: 1125,  // 增加宽度 (750 * 1.5)
                            height: 2700  // 增加高度 (1800 * 1.5)
                        });

                        // 确保Canvas被正确创建
                        if (!offscreenCanvas) {
                            throw new Error('创建离屏Canvas失败');
                        }

                        // 获取上下文
                        const ctx = offscreenCanvas.getContext('2d');
                        if (!ctx) {
                            throw new Error('获取Canvas上下文失败');
                        }

                        // 绘制内容并生成图片
                        this.drawReportContent(offscreenCanvas, reportData);
                    } catch (error) {
                        console.error('离屏Canvas处理失败:', error);
                        this.showReportError();
                    }
                    return;
                }

                try {
                    const canvas = res[0].node;

                    // 确保Canvas已准备好并且有效
                    if (!canvas || !canvas.getContext) {
                        throw new Error('Canvas元素无效');
                    }

                    // 设置Canvas大小 - 使用更高的分辨率以确保图片清晰
                    const canvasWidth = 1125;  // 增加至1.5倍分辨率
                    const canvasHeight = 2700;

                    // 重设canvas大小以避免模糊和重影
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;

                    // 获取上下文
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        throw new Error('获取Canvas上下文失败');
                    }

                    // 调用优化后的绘制函数
                    this.drawReportContent(canvas, reportData);
                } catch (error) {
                    console.error('Canvas绘制初始化失败:', error);
                    this.showReportError();
                }
            });
    },

    // 绘制体重变化曲线
    drawWeightChart: function (ctx, data, startY, width) {
        // 保存当前状态
        ctx.save();

        // 绘制标题和装饰线
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('体重变化趋势', width / 2, startY);

        const lineWidth = 80;
        ctx.strokeStyle = '#3a7bd5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth, startY + 15);
        ctx.lineTo(width / 2 + lineWidth, startY + 15);
        ctx.stroke();

        // 绘制右侧胶囊形减重标签
        const capsuleX = width - 100;
        const capsuleY = startY - 5;
        const capsuleWidth = 80;
        const capsuleHeight = 36;
        const capsuleRadius = 18;

        // 绘制红色胶囊背景
        ctx.fillStyle = '#f44336';
        ctx.beginPath();
        ctx.moveTo(capsuleX + capsuleRadius, capsuleY);
        ctx.lineTo(capsuleX + capsuleWidth - capsuleRadius, capsuleY);
        ctx.arcTo(capsuleX + capsuleWidth, capsuleY, capsuleX + capsuleWidth, capsuleY + capsuleRadius, capsuleRadius);
        ctx.lineTo(capsuleX + capsuleWidth, capsuleY + capsuleHeight - capsuleRadius);
        ctx.arcTo(capsuleX + capsuleWidth, capsuleY + capsuleHeight, capsuleX + capsuleWidth - capsuleRadius, capsuleY + capsuleHeight, capsuleRadius);
        ctx.lineTo(capsuleX + capsuleRadius, capsuleY + capsuleHeight);
        ctx.arcTo(capsuleX, capsuleY + capsuleHeight, capsuleX, capsuleY + capsuleHeight - capsuleRadius, capsuleRadius);
        ctx.lineTo(capsuleX, capsuleY + capsuleRadius);
        ctx.arcTo(capsuleX, capsuleY, capsuleX + capsuleRadius, capsuleY, capsuleRadius);
        ctx.closePath();
        ctx.fill();

        // 绘制胶囊文字
        const weightLoss = typeof data.weightLoss === 'number' ? data.weightLoss : parseFloat(data.weightLoss || 0);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${weightLoss.toFixed(1)}kg`, capsuleX + capsuleWidth / 2, capsuleY + 25);

        // 绘制减重数据卡片
        const infoCardX = 40;
        const infoCardY = startY + 40;
        const infoCardWidth = width - 80;
        const infoCardHeight = 60;
        const infoCardRadius = 8;

        // 绘制卡片背景
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.moveTo(infoCardX + infoCardRadius, infoCardY);
        ctx.lineTo(infoCardX + infoCardWidth - infoCardRadius, infoCardY);
        ctx.arcTo(infoCardX + infoCardWidth, infoCardY, infoCardX + infoCardWidth, infoCardY + infoCardRadius, infoCardRadius);
        ctx.lineTo(infoCardX + infoCardWidth, infoCardY + infoCardHeight - infoCardRadius);
        ctx.arcTo(infoCardX + infoCardWidth, infoCardY + infoCardHeight, infoCardX + infoCardWidth - infoCardRadius, infoCardY + infoCardHeight, infoCardRadius);
        ctx.lineTo(infoCardX + infoCardRadius, infoCardY + infoCardHeight);
        ctx.arcTo(infoCardX, infoCardY + infoCardHeight, infoCardX, infoCardY + infoCardHeight - infoCardRadius, infoCardRadius);
        ctx.lineTo(infoCardX, infoCardY + infoCardRadius);
        ctx.arcTo(infoCardX, infoCardY, infoCardX + infoCardRadius, infoCardY, infoCardRadius);
        ctx.closePath();
        ctx.fill();

        // 绘制信息文字
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`总减重: ${weightLoss.toFixed(1)}kg`, width / 2, infoCardY + 35);

        // 获取最新的两条体重记录，计算当天的掉秤量和代谢量
        if (data.weightRecords && Array.isArray(data.weightRecords) && data.weightRecords.length >= 2) {
            try {
                // 获取排序后的记录
                const sortedRecords = [...data.weightRecords].sort((a, b) =>
                    new Date(b.record_date) - new Date(a.record_date));

                // 检查是否有今天的记录
                const today = new Date();
                const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                // 查找今天的记录和前一天的记录
                const todayRecords = sortedRecords.filter(r => r.record_date === todayDateStr);
                const yesterdayDate = new Date(today);
                yesterdayDate.setDate(today.getDate() - 1);
                const yesterdayDateStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
                const yesterdayRecords = sortedRecords.filter(r => r.record_date === yesterdayDateStr);

                // 查找今天和昨天的早晨体重记录
                const todayMorning = todayRecords.find(r => r.time_type === 'morning');
                const yesterdayMorning = yesterdayRecords.find(r => r.time_type === 'morning');

                // 查找昨天的晚上体重记录和今天的晚上体重记录
                const yesterdayEvening = yesterdayRecords.find(r => r.time_type === 'evening');
                const todayEvening = todayRecords.find(r => r.time_type === 'evening');

                // 绘制掉秤量和代谢量
                let hasInfo = false;
                let infoText = '';

                // 计算掉秤量 (今天早上体重 - 昨天早上体重)
                if (todayMorning && yesterdayMorning) {
                    const dropValue = (yesterdayMorning.weight - todayMorning.weight).toFixed(1);
                    if (parseFloat(dropValue) !== 0) {
                        infoText += `掉秤量: ${dropValue}kg`;
                        hasInfo = true;
                    }
                }

                // 添加分隔符
                if (hasInfo && todayEvening && yesterdayEvening) {
                    infoText += ' | ';
                }

                // 计算代谢量 (昨天晚上体重 - 今天晚上体重)
                if (todayEvening && yesterdayEvening) {
                    const metaValue = (yesterdayEvening.weight - todayEvening.weight).toFixed(1);
                    if (parseFloat(metaValue) !== 0) {
                        infoText += `代谢量: ${metaValue}kg`;
                        hasInfo = true;
                    }
                }

                // 如果有数据，绘制信息
                if (hasInfo) {
                    ctx.fillStyle = '#4CAF50';
                    ctx.font = '18px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(infoText, width / 2, infoCardY + infoCardHeight - 15);
                }
            } catch (e) {
                console.error('计算掉秤量/代谢量失败:', e);
            }
        }

        // 调整图表区域的位置以适应信息卡片
        const chartY = infoCardY + infoCardHeight + 10;
        const chartHeight = 300;
        const cornerRadius = 12;

        // 绘制圆角矩形
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(40 + cornerRadius, chartY);
        ctx.lineTo(width - 40 - cornerRadius, chartY);
        ctx.quadraticCurveTo(width - 40, chartY, width - 40, chartY + cornerRadius);
        ctx.lineTo(width - 40, chartY + chartHeight - cornerRadius);
        ctx.quadraticCurveTo(width - 40, chartY + chartHeight, width - 40 - cornerRadius, chartY + chartHeight);
        ctx.lineTo(40 + cornerRadius, chartY + chartHeight);
        ctx.quadraticCurveTo(40, chartY + chartHeight, 40, chartY + cornerRadius);
        ctx.lineTo(40, chartY + cornerRadius);
        ctx.quadraticCurveTo(40, chartY, 40 + cornerRadius, chartY);
        ctx.closePath();

        // 添加阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.shadowBlur = 0; // 重置阴影

        // 确保有体重记录数据并格式化
        let records = [];
        if (data.weightRecords && Array.isArray(data.weightRecords) && data.weightRecords.length > 0) {
            // 过滤掉无效记录
            records = data.weightRecords.filter(record => record && typeof record === 'object');
        }

        // 检查是否有足够的体重记录数据
        if (records.length < 2) {
            // 绘制无数据提示
            ctx.fillStyle = '#999999';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无足够的体重记录数据', width / 2, chartY + 150);
            ctx.restore();
            return;
        }

        // 绘制坐标系
        const chartMargin = { left: 80, right: 60, top: 50, bottom: 60 };
        const chartWidth = width - 80 - chartMargin.left - chartMargin.right;
        const chartAreaHeight = chartHeight - chartMargin.top - chartMargin.bottom;
        const chartStartX = 40 + chartMargin.left;
        const chartStartY = chartY + chartMargin.top;

        // 计算数据范围
        const weights = records.map(r => parseFloat(r.weight) || 0).filter(w => !isNaN(w) && isFinite(w));
        if (weights.length === 0) {
            // 如果没有有效的体重数据，绘制无数据提示
            ctx.fillStyle = '#999999';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无有效的体重数据', width / 2, chartY + 150);
            ctx.restore();
            return;
        }

        let maxWeight = Math.max(...weights) + 2;
        let minWeight = Math.min(...weights) - 2;
        // 确保范围合理
        if (maxWeight === minWeight || !isFinite(maxWeight) || !isFinite(minWeight)) {
            maxWeight = Math.max(...weights) + 1;
            minWeight = Math.min(...weights) - 1;
            // 如果仍然无效，使用默认值
            if (!isFinite(maxWeight) || !isFinite(minWeight)) {
                maxWeight = 100;
                minWeight = 50;
            }
        }

        // 绘制背景网格线
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        // 水平网格线和Y轴刻度
        const ySteps = 5; // 垂直分5个刻度
        const yStepSize = chartAreaHeight / ySteps;
        const weightStep = (maxWeight - minWeight) / ySteps;

        ctx.textAlign = 'right';
        ctx.fillStyle = '#666666';
        ctx.font = '16px sans-serif';

        for (let i = 0; i <= ySteps; i++) {
            const y = chartStartY + i * yStepSize;
            // 网格线
            ctx.beginPath();
            ctx.moveTo(chartStartX, y);
            ctx.lineTo(chartStartX + chartWidth, y);
            ctx.stroke();

            // Y轴刻度
            const weightValue = maxWeight - i * weightStep;
            ctx.fillText(weightValue.toFixed(1) + 'kg', chartStartX - 10, y + 5);
        }

        // 绘制X轴和刻度
        const dateCount = Math.min(records.length, 6); // 最多显示6个日期
        const xStep = chartWidth / (dateCount - 1);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#666666';

        // 选择日期点
        const dateIndices = [];

        if (records.length <= dateCount) {
            // 如果记录少于要显示的日期数，显示所有记录
            for (let i = 0; i < records.length; i++) {
                dateIndices.push(i);
            }
        } else {
            // 选择开始、结束和中间的几个点
            dateIndices.push(0); // 第一条记录

            // 选择中间的记录
            const step = Math.floor(records.length / (dateCount - 2));
            for (let i = 1; i < dateCount - 1; i++) {
                dateIndices.push(i * step);
            }

            dateIndices.push(records.length - 1); // 最后一条记录
        }

        // 绘制垂直网格线和X轴刻度
        dateIndices.forEach((index, i) => {
            if (index >= records.length) return; // 跳过无效索引

            const record = records[index];
            if (!record) return; // 跳过无效记录

            const x = chartStartX + (i / (dateIndices.length - 1)) * chartWidth;

            // 网格线
            ctx.strokeStyle = '#f0f0f0';
            ctx.beginPath();
            ctx.moveTo(x, chartStartY);
            ctx.lineTo(x, chartStartY + chartAreaHeight);
            ctx.stroke();

            // 格式化日期，确保使用短日期格式
            let date = '未知';
            if (record.record_date) {
                try {
                    const dateParts = record.record_date.split('-');
                    if (dateParts.length >= 3) {
                        date = `${parseInt(dateParts[1])}-${parseInt(dateParts[2])}`;
                    } else {
                        date = record.record_date;
                    }
                } catch (e) {
                    console.error('日期格式化错误:', e);
                    date = record.record_date;
                }
            }

            // X轴刻度
            ctx.fillText(date, x, chartStartY + chartAreaHeight + 25);
        });

        // 绘制坐标轴
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;

        // X轴
        ctx.beginPath();
        ctx.moveTo(chartStartX, chartStartY + chartAreaHeight);
        ctx.lineTo(chartStartX + chartWidth, chartStartY + chartAreaHeight);
        ctx.stroke();

        // Y轴
        ctx.beginPath();
        ctx.moveTo(chartStartX, chartStartY);
        ctx.lineTo(chartStartX, chartStartY + chartAreaHeight);
        ctx.stroke();

        // 创建绘制点的数组，确保数据有效
        const points = [];
        records.forEach((record, index) => {
            if (!record || !record.weight) return;

            const weight = parseFloat(record.weight);
            if (isNaN(weight)) return;

            const x = chartStartX + (index / (records.length - 1)) * chartWidth;
            const normalizedWeight = (maxWeight - weight) / (maxWeight - minWeight);
            const y = chartStartY + normalizedWeight * chartAreaHeight;

            points.push({ x, y, weight });
        });

        // 如果没有有效点，显示错误信息并返回
        if (points.length < 2) {
            ctx.fillStyle = '#999999';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('没有足够的有效体重数据', width / 2, chartY + 150);
            ctx.restore();
            return;
        }

        // 绘制体重变化曲线
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#4CAF50';
        ctx.beginPath();

        // 如果只有两个点，直接绘制直线
        if (points.length === 2) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
        }
        // 如果有多个点，绘制平滑曲线
        else if (points.length > 2) {
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length - 2; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }

            // 处理最后两个点
            ctx.quadraticCurveTo(
                points[points.length - 2].x,
                points[points.length - 2].y,
                points[points.length - 1].x,
                points[points.length - 1].y
            );
        }

        // 绘制线条
        ctx.stroke();

        // 创建填充区域路径
        ctx.lineTo(points[points.length - 1].x, chartStartY + chartAreaHeight);
        ctx.lineTo(points[0].x, chartStartY + chartAreaHeight);
        ctx.closePath();

        // 填充区域
        const fillGradient = ctx.createLinearGradient(0, chartStartY, 0, chartStartY + chartAreaHeight);
        fillGradient.addColorStop(0, 'rgba(76, 175, 80, 0.3)');
        fillGradient.addColorStop(1, 'rgba(76, 175, 80, 0.0)');
        ctx.fillStyle = fillGradient;
        ctx.fill();

        // 绘制数据点
        points.forEach(point => {
            // 内部白色圆圈
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // 外部绿色圆圈
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.stroke();

            // 添加体重数字标签
            ctx.fillStyle = '#333';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${point.weight.toFixed(1)}`, point.x, point.y - 15);
        });

        // 恢复状态
        ctx.restore();
    },

    // 绘制产品使用数据 - 完全重新设计
    drawProductUsage: function (ctx, data, startY, width) {
        // 保存当前状态
        ctx.save();

        // 标题
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('产品使用情况', width / 2, startY);

        // 绘制装饰线
        const lineWidth = 80;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth, startY + 15);
        ctx.lineTo(width / 2 + lineWidth, startY + 15);
        ctx.stroke();

        // 绘制表格背景
        const tableY = startY + 40;
        const tableHeight = 200;
        const tableWidth = width - 80;
        const tableX = 40;

        // 绘制完整表格背景
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.rect(tableX, tableY, tableWidth, tableHeight);
        ctx.fill();

        // 绘制表格边框
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(tableX, tableY, tableWidth, tableHeight);
        ctx.stroke();

        // 绘制表头背景
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.rect(tableX, tableY, tableWidth, 40);
        ctx.fill();

        // 绘制表头文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';

        // 三列布局
        const col1Width = tableWidth * 0.4;
        const col2Width = tableWidth * 0.35;
        const col3Width = tableWidth * 0.25;

        const col1X = tableX + 20;
        const col2X = tableX + col1Width;
        const col3X = tableX + col1Width + col2Width;

        ctx.textAlign = 'left';
        ctx.fillText('产品名称', col1X, tableY + 27);

        ctx.textAlign = 'center';
        ctx.fillText('使用日期', col2X + col2Width / 2, tableY + 27);

        ctx.textAlign = 'center';
        ctx.fillText('数量', col3X + col3Width / 2, tableY + 27);

        // 检查是否有产品使用数据
        if (!data.productUsageData || !Array.isArray(data.productUsageData) || data.productUsageData.length === 0) {
            // 空数据显示
            ctx.fillStyle = '#999999';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无产品使用记录', width / 2, tableY + 120);
            ctx.restore();
            return;
        }

        // 绘制数据行
        const maxItems = 4; // 最多显示4行
        const rowHeight = 40;
        const displayData = data.productUsageData.slice(0, maxItems);

        // 绘制列分隔线
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX + col1Width, tableY);
        ctx.lineTo(tableX + col1Width, tableY + tableHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tableX + col1Width + col2Width, tableY);
        ctx.lineTo(tableX + col1Width + col2Width, tableY + tableHeight);
        ctx.stroke();

        displayData.forEach((product, index) => {
            const rowY = tableY + 40 + (index * rowHeight);

            // 交替行背景
            if (index % 2 === 0) {
                ctx.fillStyle = '#f9f9f9';
                ctx.beginPath();
                ctx.rect(tableX, rowY, tableWidth, rowHeight);
                ctx.fill();
            }

            // 产品名称
            ctx.fillStyle = '#333333';
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'left';
            const productName = product.product_name || '未知产品';
            const truncatedName = productName.length > 12 ? productName.substring(0, 12) + '...' : productName;
            ctx.fillText(truncatedName, col1X, rowY + 25);

            // 使用日期
            ctx.textAlign = 'center';
            ctx.fillText(product.usage_date || '未知日期', col2X + col2Width / 2, rowY + 25);

            // 数量
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FF9800';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(product.purchase_count || 0, col3X + col3Width / 2, rowY + 25);
        });

        // 绘制行分隔线
        for (let i = 1; i <= Math.min(displayData.length, maxItems); i++) {
            const lineY = tableY + (i * rowHeight);
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tableX, lineY);
            ctx.lineTo(tableX + tableWidth, lineY);
            ctx.stroke();
        }

        // 如果有更多记录，显示备注
        if (data.productUsageData.length > maxItems) {
            ctx.fillStyle = '#666666';
            ctx.font = 'italic 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`还有 ${data.productUsageData.length - maxItems} 条记录未显示`, width / 2, tableY + tableHeight - 15);
        }

        ctx.restore();
    },

    // 绘制结语和建议 - 优化并增加个性化建议
    drawSummary: function (ctx, data, startY, width) {
        // 保存当前状态
        ctx.save();

        // 标题
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('减重分析与建议', width / 2, startY);

        // 绘制装饰线
        const lineWidth = 80;
        ctx.strokeStyle = '#9C27B0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth, startY + 15);
        ctx.lineTo(width / 2 + lineWidth, startY + 15);
        ctx.stroke();

        // 绘制卡片背景
        const cardY = startY + 30;
        const cardHeight = 300;
        const cornerRadius = 12;

        // 绘制圆角矩形
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(40 + cornerRadius, cardY);
        ctx.lineTo(width - 40 - cornerRadius, cardY);
        ctx.quadraticCurveTo(width - 40, cardY, width - 40, cardY + cornerRadius);
        ctx.lineTo(width - 40, cardY + cardHeight - cornerRadius);
        ctx.quadraticCurveTo(width - 40, cardY + cardHeight, width - 40 - cornerRadius, cardY + cardHeight);
        ctx.lineTo(40 + cornerRadius, cardY + cardHeight);
        ctx.quadraticCurveTo(40, cardY + cardHeight, 40, cardY + cornerRadius);
        ctx.lineTo(40, cardY + cornerRadius);
        ctx.quadraticCurveTo(40, cardY, 40 + cornerRadius, cardY);
        ctx.closePath();

        // 添加阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.shadowColor = 'transparent'; // 重置阴影

        // 设置减重评价
        let summaryText = '';
        let customAdvice = '';
        const weightLoss = typeof data.weightLoss === 'number' ? data.weightLoss : parseFloat(data.weightLoss || 0);
        const duration = data.totalDays || 30;
        let effectivenessLevel = 0; // 0:不佳, 1:轻微, 2:良好, 3:显著

        // 获取减重效果评价
        if (weightLoss <= 0) {
            summaryText = `在${duration}天的时间里，您的体重没有减轻，建议调整饮食和运动计划。`;
            effectivenessLevel = 0;
        } else if (weightLoss < 2) {
            summaryText = `在${duration}天的时间里，您总共减重${weightLoss.toFixed(1)}kg，减重效果较轻微，建议增加运动量。`;
            effectivenessLevel = 1;
        } else if (weightLoss < 5) {
            summaryText = `在${duration}天的时间里，您总共减重${weightLoss.toFixed(1)}kg，减重效果良好，请保持当前的生活方式。`;
            effectivenessLevel = 2;
        } else {
            summaryText = `在${duration}天的时间里，您总共减重${weightLoss.toFixed(1)}kg，减重效果显著，非常出色！`;
            effectivenessLevel = 3;
        }

        // 根据BMI和体脂率给出个性化建议
        try {
            const currentWeight = parseFloat(data.currentWeight) || 0;
            const height = data.customer && data.customer.height ? parseFloat(data.customer.height) : 0;

            if (currentWeight > 0 && height > 0) {
                // 计算当前BMI
                const currentBmi = this.calculateBmi ? this.calculateBmi(currentWeight, height) : (currentWeight / ((height / 100) * (height / 100)));

                if (currentBmi > 28) {
                    customAdvice = "您目前的BMI指数属于肥胖范围，建议在专业指导下进行减重，控制饮食摄入并增加有氧运动。";
                } else if (currentBmi > 24) {
                    customAdvice = "您目前的BMI指数属于超重范围，建议增加日常活动量，减少精制碳水化合物的摄入，增加蛋白质和膳食纤维。";
                } else if (currentBmi > 18.5) {
                    customAdvice = "您目前的BMI指数在正常范围内，建议保持均衡的饮食和适量的运动，维持健康的生活方式。";
                } else {
                    customAdvice = "您目前的BMI指数偏低，建议在保持健康饮食的同时，适当增加蛋白质摄入，避免过度减重。";
                }
            }
        } catch (e) {
            console.error('生成个性化建议失败:', e);
        }

        // 绘制总结文字
        ctx.fillStyle = '#555555';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'left';
        this.drawWrappedText(ctx, summaryText, 60, cardY + 40, width - 120, 22);

        // 绘制个性化建议
        if (customAdvice) {
            ctx.fillStyle = '#555555';
            ctx.font = '18px sans-serif';
            const summaryEndY = this.drawWrappedText(ctx, customAdvice, 60, cardY + 85, width - 120, 22);

            // 根据结束位置调整后续内容
            var adviceStartY = summaryEndY + 20;
        } else {
            var adviceStartY = cardY + 100;
        }

        // 提供健康建议
        ctx.fillStyle = '#9C27B0';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('健康减重建议:', 60, adviceStartY);

        ctx.fillStyle = '#555555';
        ctx.font = '16px sans-serif';

        // 根据减重效果选择不同建议
        let healthTips = [];

        if (effectivenessLevel === 0) {
            // 效果不佳建议
            healthTips = [
                '• 严格记录每日摄入的食物，控制总热量',
                '• 每天进行30-60分钟中等强度有氧运动',
                '• 增加蛋白质摄入，减少精制碳水化合物',
                '• 每天至少喝2升水，降低饥饿感',
                '• 保持规律作息，确保充足睡眠'
            ];
        } else if (effectivenessLevel === 1) {
            // 效果轻微建议
            healthTips = [
                '• 适当增加运动强度，如间歇训练或HIIT',
                '• 控制晚餐摄入量，避免睡前3小时进食',
                '• 每周坚持测量体重和体围，追踪进度',
                '• 增加日常活动量，如步行或爬楼梯',
                '• 避免含糖饮料和高热量零食'
            ];
        } else if (effectivenessLevel === 2) {
            // 效果良好建议
            healthTips = [
                '• 继续保持当前的饮食和运动习惯',
                '• 增加力量训练，提高基础代谢率',
                '• 注意营养均衡，摄入足够的维生素和矿物质',
                '• 适当调整碳水摄入时间，集中在运动前后',
                '• 保持积极心态，避免情绪性饮食'
            ];
        } else {
            // 效果显著建议
            healthTips = [
                '• 逐渐过渡到维持期，适当增加热量摄入',
                '• 增加肌肉锻炼，避免肌肉流失',
                '• 保持健康饮食习惯，避免反弹',
                '• 定期监测健康指标，如血压和血糖',
                '• 制定长期可持续的健康生活方案'
            ];
        }

        // 绘制建议列表
        let tipY = adviceStartY + 30;
        for (const tip of healthTips) {
            tipY = this.drawWrappedText(ctx, tip, 60, tipY, width - 120, 20);
        }

        // 恢复状态
        ctx.restore();
    },

    // 辅助函数：绘制带自动换行的文本
    drawWrappedText: function (ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split('');
        let line = '';

        for (let i = 0; i < words.length; i++) {
            let testLine = line + words[i];
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;

            if (testWidth > maxWidth && i > 0) {
                ctx.fillText(line, x, y);
                line = words[i];
                y += lineHeight;
            } else {
                line = testLine;
            }
        }

        ctx.fillText(line, x, y);
        return y + lineHeight; // 返回文本结束的Y坐标
    },

    // 绘制底部水印和备注
    drawFooter: function (ctx, width, height) {
        // 保存当前状态
        ctx.save();

        // 设置页脚区域
        const footerY = height - 60;

        // 绘制页脚背景
        const footerGradient = ctx.createLinearGradient(0, footerY, 0, height);
        footerGradient.addColorStop(0, 'rgba(249, 250, 251, 0)');
        footerGradient.addColorStop(1, 'rgba(249, 250, 251, 0.8)');
        ctx.fillStyle = footerGradient;
        ctx.fillRect(0, footerY, width, 60);

        // 左侧生成日期
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

        ctx.fillStyle = '#999999';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`生成日期: ${dateStr}`, 40, height - 25);

        // 右侧水印
        ctx.fillStyle = '#777777';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('由减肥顾问系统生成', width - 40, height - 25);

        // 恢复状态
        ctx.restore();
    },

    // 处理生成的图片
    handleGeneratedImage: function (tempFilePath) {
        if (!tempFilePath) {
            this.showReportError();
            return;
        }

        this.setData({
            reportImageUrl: tempFilePath,
            showReportModal: true,
            isExporting: false
        });

        wx.hideLoading();
        console.log('报告图片生成完成:', tempFilePath);
    },

    // 显示报表生成失败的错误提示
    showReportError: function () {
        this.setData({
            isExporting: false
        });
        wx.hideLoading();
        wx.showToast({
            title: '报表生成失败，请重试',
            icon: 'none',
            duration: 2000
        });
    },

    onReady: function () {
        // 初始化完成后，可以获取组件实例
        setTimeout(() => {
            // 图表组件可能需要一点时间才能完全初始化
            // 先从本地加载数据并显示
            this.loadWeightRecordsFromLocal();

            // 使用微信小程序API尝试更直接地清除红框区域
            this.clearRedArea();
        }, 300);
    },

    // 尝试更直接的方式清除红框区域
    clearRedArea: function () {
        try {
            // 创建选择器
            const query = wx.createSelectorQuery();

            // 查找电话号码和体重区域之间的元素
            query.select('.customer-meta + view:not(.weight-overview)').fields({
                node: true,
                size: true
            }, function (res) {
                if (res && res.node) {
                    console.log('找到需要移除的红框区域', res);
                    // 尝试隐藏或修改它
                    res.node.style.display = 'none';
                    res.node.innerHTML = '';
                }
            }).exec();

            // 再尝试一次，使用另一种选择器
            const query2 = wx.createSelectorQuery();
            query2.selectAll('.customer-header > view').fields({
                dataset: true,
                size: true,
                rect: true
            }, function (res) {
                if (res && res.length) {
                    console.log('查找所有可能包含66666的元素', res);
                    // 遍历找到的元素，寻找可能包含66666的
                    res.forEach(item => {
                        // 检查位置是否在电话号码和体重区域之间
                        if (item && item.top > 0) {
                            console.log('可能的红框元素', item);
                        }
                    });
                }
            }).exec();
        } catch (e) {
            console.error('清除红框区域失败', e);
        }
    },

    // 计算周体重变化趋势数据
    calculateWeeklyWeightTrend: function (sortedRecords) {
        console.log('计算周体重变化趋势数据');
        if (!sortedRecords || sortedRecords.length < 2) {
            console.log('记录数量不足，无法计算周趋势');
            this.setData({
                weeklyWeightTrend: []
            });
            return;
        }

        // 获取最近7天的记录
        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        // 筛选最近7天的记录
        const recentRecords = sortedRecords.filter(record => {
            const recordDate = new Date(record.record_date);
            return recordDate >= sevenDaysAgo;
        });

        console.log('最近7天的记录数:', recentRecords.length);

        // 如果没有最近7天的记录，返回空数组
        if (recentRecords.length < 1) {
            this.setData({
                weeklyWeightTrend: []
            });
            return;
        }

        // 按日期分组，每天取最后一条记录（最新的体重）
        const dailyRecords = {};
        recentRecords.forEach(record => {
            dailyRecords[record.record_date] = record;
        });

        // 转换为数组并排序
        const days = Object.keys(dailyRecords).sort();
        const trend = [];

        // 计算每天的变化量
        for (let i = 0; i < days.length; i++) {
            const day = days[i];
            const record = dailyRecords[day];
            const date = new Date(day);
            const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

            // 计算与前一天的差值
            let value = 0;
            if (i > 0) {
                const prevRecord = dailyRecords[days[i - 1]];
                value = (record.weight - prevRecord.weight).toFixed(1);
            } else if (days.length > 1) {
                // 第一天，计算与第二天的差值
                const nextRecord = dailyRecords[days[1]];
                value = (record.weight - nextRecord.weight).toFixed(1);
            }

            // 计算柱状图高度（根据差值大小）
            // 最大高度150rpx，最小高度30rpx
            const absValue = Math.abs(parseFloat(value));
            const height = Math.max(30, Math.min(150, 30 + absValue * 40));

            trend.push({
                date: formattedDate,
                value: value,
                height: height
            });
        }

        console.log('周体重趋势数据:', trend);

        // 更新状态
        this.setData({
            weeklyWeightTrend: trend
        });
    },

    // 增加产品剩余次数
    increaseProductCount: function (e) {
        const index = e.currentTarget.dataset.index;
        const productUsageList = this.data.productUsageList;

        if (productUsageList[index]) {
            // 确保使用整数进行计算
            productUsageList[index].quantity = (parseInt(productUsageList[index].quantity) || 0) + 1;
            productUsageList[index].update_date = this.getCurrentDate();

            this.setData({
                productUsageList: productUsageList
            });

            this.updateProductUsage(productUsageList[index]);
        }
    },

    // 减少产品剩余次数
    decreaseProductCount: function (e) {
        const index = e.currentTarget.dataset.index;
        const productUsageList = this.data.productUsageList;

        if (productUsageList[index] && parseInt(productUsageList[index].quantity) > 0) {
            // 确保使用整数进行计算
            productUsageList[index].quantity = (parseInt(productUsageList[index].quantity) || 0) - 1;
            productUsageList[index].update_date = this.getCurrentDate();

            this.setData({
                productUsageList: productUsageList
            });

            this.updateProductUsage(productUsageList[index]);
        }
    },

    // 更新产品使用记录
    updateProductUsage: function (productRecord) {
        const { userInfo, customerId } = this.data;

        // 确保customerID是数字类型
        const customerIdNum = parseInt(customerId);
        // 确保productID是数字类型 
        const productIdNum = parseInt(productRecord.product_id);
        // 确保quantity是数字类型
        const quantityNum = parseFloat(productRecord.quantity);

        if (isNaN(customerIdNum)) {
            console.error('客户ID无效:', customerId);
            wx.showToast({
                title: '客户ID无效',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        if (isNaN(productIdNum)) {
            console.error('产品ID无效:', productRecord.product_id);
            wx.showToast({
                title: '产品ID无效',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        if (isNaN(quantityNum)) {
            console.error('数量无效:', productRecord.quantity);
            wx.showToast({
                title: '数量无效',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        // 获取当前日期作为更新日期
        const updateDate = this.getCurrentDate();

        // 准备要更新的数据
        const updateData = {
            user_id: userInfo.id,
            customer_id: customerIdNum,
            product_id: productIdNum,
            quantity: quantityNum,
            usage_date: productRecord.usage_date || this.getCurrentDate(),
            update_date: updateDate
        };

        console.log('发送更新产品使用请求:', updateData);

        // 调用API更新产品使用记录
        request.post(config.apis.customer.updateProductUsage, updateData)
            .then(res => {
                if (res && res.code === 200) {
                    wx.showToast({
                        title: '更新成功',
                        icon: 'success',
                        duration: 1000
                    });
                } else {
                    wx.showToast({
                        title: '更新失败',
                        icon: 'none',
                        duration: 2000
                    });
                }
            })
            .catch(err => {
                console.error('更新产品使用记录失败:', err);
                wx.showToast({
                    title: '更新失败',
                    icon: 'none',
                    duration: 2000
                });
            });
    },

    // 获取当前日期
    getCurrentDate: function () {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 加载产品使用记录
    loadProductUsageRecords: function () {
        if (this.data.isLoading) return;

        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        console.log('加载产品使用记录', '客户ID:', customerId, '用户ID:', userInfo.id);

        const requestParams = {
            user_id: userInfo.id,
            customer_id: customerId,
            page: 1,
            page_size: 999 // 一次性加载所有
        };
        console.log('API请求参数:', requestParams);

        // 从API加载最新数据
        console.log('从API加载产品使用记录');
        // 使用Promise方式发送请求
        request.get(config.apis.customer.productUsage, {
            data: requestParams
        })
            .then(res => {
                this.setData({ isLoading: false });

                if (res && res.code === 200) {
                    console.log('产品使用记录API响应:', res.data);
                    let productUsages = res.data.list || [];

                    // 确保每个记录都有所需字段
                    productUsages = productUsages.map(item => {
                        return {
                            ...item,
                            purchase_count: item.purchase_count !== undefined ? item.purchase_count : 1,
                            update_date: item.update_date || item.usage_date || this.getCurrentDate()
                        };
                    });

                    console.log('解析后的产品使用记录:', productUsages);

                    this.setData({
                        productUsageList: productUsages
                    });

                    // 保存到本地存储
                    const storageKey = `product_usage_${customerId}`;
                    wx.setStorageSync(storageKey, productUsages);
                } else {
                    // API加载失败，创建空列表
                    console.log('API获取产品使用记录失败:', res);
                    this.setData({
                        productUsageList: []
                    });
                }
            })
            .catch(err => {
                console.error('加载产品使用记录失败:', err);
                this.setData({
                    isLoading: false,
                    productUsageList: []
                });

                wx.showToast({
                    title: '加载产品记录失败',
                    icon: 'none',
                    duration: 2000
                });
            });
    },

    // 删除产品使用记录
    deleteProductUsage: function (e) {
        const usageId = e.currentTarget.dataset.id;
        const index = e.currentTarget.dataset.index;

        if (!usageId) {
            wx.showToast({
                title: '记录ID无效',
                icon: 'none'
            });
            return;
        }

        // 显示确认对话框
        wx.showModal({
            title: '确认删除',
            content: '确定要删除这条产品使用记录吗？',
            success: (res) => {
                if (res.confirm) {
                    this.doDeleteProductUsage(usageId, index);
                }
            }
        });
    },

    // 执行删除产品使用记录操作
    doDeleteProductUsage: function (usageId, index) {
        const { userInfo } = this.data;

        wx.showLoading({
            title: '删除中...',
        });

        const deleteData = {
            user_id: userInfo.id,
            usage_id: usageId
        };

        // 调用API删除记录
        request.post(config.apis.customer.deleteProductUsage, deleteData)
            .then(res => {
                wx.hideLoading();

                if (res && res.code === 200) {
                    // 成功后从本地列表移除
                    const updatedList = [...this.data.productUsageList];
                    updatedList.splice(index, 1);

                    this.setData({
                        productUsageList: updatedList
                    });

                    wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '删除失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('删除产品使用记录失败:', err);
                wx.showToast({
                    title: '删除失败',
                    icon: 'none'
                });
            });
    },

    // 显示导出选项对话框
    showExportOptions: function () {
        this.setData({
            showExportOptions: true
        });
    },

    // 隐藏导出选项对话框
    hideExportOptions: function () {
        this.setData({
            showExportOptions: false
        });
    },

    // 关闭报表预览模态框
    closeReportModal: function () {
        this.setData({
            showReportModal: false,
            reportImageUrl: ''
        });
    },

    // 保存报表图片到相册
    saveReportImage: function () {
        const self = this;
        if (!this.data.reportImageUrl) {
            wx.showToast({
                title: '没有可保存的图片',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({
            title: '保存中...'
        });

        wx.saveImageToPhotosAlbum({
            filePath: this.data.reportImageUrl,
            success: function () {
                wx.hideLoading();
                wx.showToast({
                    title: '保存成功',
                    icon: 'success'
                });
            },
            fail: function (err) {
                wx.hideLoading();
                console.error('保存图片失败:', err);
                // 判断是否是因为用户拒绝授权导致的失败
                if (err.errMsg.indexOf('auth deny') >= 0 || err.errMsg.indexOf('authorize') >= 0) {
                    wx.showModal({
                        title: '提示',
                        content: '需要您授权保存图片到相册',
                        confirmText: '去授权',
                        success: function (res) {
                            if (res.confirm) {
                                wx.openSetting({
                                    success: function (settingRes) {
                                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                                            self.saveReportImage(); // 授权成功后重新保存
                                        }
                                    }
                                });
                            }
                        }
                    });
                } else {
                    wx.showToast({
                        title: '保存失败',
                        icon: 'none'
                    });
                }
            }
        });
    },

    // 阻止事件冒泡
    stopPropagation: function (e) {
        // 这个函数什么都不做，只阻止事件冒泡
    },

    // 初始化BMI分类
    initBmiCategories: function () {
        // BMI分类已在data中定义，这里只是确保它在UI中正确初始化
        const bmiCategories = this.data.bmiCategories;
        this.setData({
            bmiCategories: bmiCategories
        });
    },

    // 计算今日掉秤量和代谢量
    calculateTodayWeightMetrics: function () {
        // 获取今天和昨天的日期
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        // 格式化日期
        const todayStr = this.formatDate(today);
        const yesterdayStr = this.formatDate(yesterday);

        // 初始化默认值
        let weightDropValue = '0.0';
        let metabolismValue = '0.0';

        // 如果没有体重记录，则直接返回默认值
        if (!this.data.weightRecords || this.data.weightRecords.length === 0) {
            this.setData({
                weightDropValue: weightDropValue,
                metabolismValue: metabolismValue
            });
            return;
        }

        // 查找今天和昨天的体重记录
        let todayMorningWeight = null;
        let yesterdayMorningWeight = null;
        let todayEveningWeight = null;
        let yesterdayEveningWeight = null;

        for (const record of this.data.weightRecords) {
            // 找到今天的记录
            if (record.record_date === todayStr) {
                if (record.time_type === 'morning') {
                    todayMorningWeight = parseFloat(record.weight);
                } else if (record.time_type === 'evening') {
                    todayEveningWeight = parseFloat(record.weight);
                }
            }
            // 找到昨天的记录
            else if (record.record_date === yesterdayStr) {
                if (record.time_type === 'morning') {
                    yesterdayMorningWeight = parseFloat(record.weight);
                } else if (record.time_type === 'evening') {
                    yesterdayEveningWeight = parseFloat(record.weight);
                }
            }
        }

        // 计算掉秤量（昨天早上 - 今天早上）
        if (todayMorningWeight !== null && yesterdayMorningWeight !== null) {
            weightDropValue = (yesterdayMorningWeight - todayMorningWeight).toFixed(1);
        }

        // 计算代谢量（昨天晚上 - 今天晚上）
        if (todayEveningWeight !== null && yesterdayEveningWeight !== null) {
            metabolismValue = (yesterdayEveningWeight - todayEveningWeight).toFixed(1);
        }

        // 更新数据
        this.setData({
            weightDropValue: weightDropValue,
            metabolismValue: metabolismValue
        });
    },

    // 计算BMI指数并设置BMI分类
    calculateBMI: function (weight, height) {
        if (!weight || !height) return;

        // 计算BMI
        const bmi = this.calculateBmi(weight, height);

        // 获取BMI分类
        const bmiCategory = this.getBmiCategory(bmi);

        // 设置BMI和分类
        this.setData({
            currentBmi: bmi,
            bmiCategory: bmiCategory
        });

        return bmi;
    },

    // 获取BMI分类
    getBmiCategory: function (bmi) {
        const categories = this.data.bmiCategories;
        for (const category of categories) {
            if (bmi >= category.min && bmi < category.max) {
                return category;
            }
        }
        // 默认返回最后一个分类
        return categories[categories.length - 1];
    },

    // 计算体脂率估算并设置
    calculateBodyFatPercentage: function (customer) {
        if (!customer.height || !customer.current_weight || !customer.age || !customer.gender) return;

        // 计算BMI
        const bmi = this.calculateBmi(customer.current_weight, customer.height);

        // 计算体脂率
        const bodyFat = this.calculateBodyFat(bmi, customer.age, customer.gender);

        // 获取体脂分类
        const bodyFatCategory = this.getBodyFatCategory(bodyFat, customer.gender);

        // 设置体脂率和分类
        this.setData({
            bodyFatPercentage: bodyFat,
            bodyFatCategory: bodyFatCategory
        });

        return bodyFat;
    },

    // 获取体脂率分类
    getBodyFatCategory: function (bodyFat, gender) {
        let category = { label: '', color: '' };

        if (gender === 'male') {
            // 男性体脂率标准
            if (bodyFat < 10) {
                category = { label: '偏瘦', color: '#909399' };
            } else if (bodyFat >= 10 && bodyFat < 20) {
                category = { label: '标准', color: '#67c23a' };
            } else if (bodyFat >= 20 && bodyFat < 25) {
                category = { label: '轻度肥胖', color: '#e6a23c' };
            } else {
                category = { label: '肥胖', color: '#f56c6c' };
            }
        } else {
            // 女性体脂率标准
            if (bodyFat < 20) {
                category = { label: '偏瘦', color: '#909399' };
            } else if (bodyFat >= 20 && bodyFat < 30) {
                category = { label: '标准', color: '#67c23a' };
            } else if (bodyFat >= 30 && bodyFat < 35) {
                category = { label: '轻度肥胖', color: '#e6a23c' };
            } else {
                category = { label: '肥胖', color: '#f56c6c' };
            }
        }

        return category;
    },

    // 生成减肥数据分析
    generateWeightAnalysis: function (records) {
        if (!records || records.length < 2) {
            console.log('记录数量不足，无法生成分析');
            return;
        }

        try {
            // 按日期排序，旧的在前面
            const sortedRecords = [...records].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

            // 获取初始和当前体重
            const firstRecord = sortedRecords[0];
            const lastRecord = sortedRecords[sortedRecords.length - 1];

            // 计算总体减重情况
            const totalDays = Math.round((new Date(lastRecord.record_date) - new Date(firstRecord.record_date)) / (24 * 60 * 60 * 1000));
            const totalLoss = firstRecord.weight - lastRecord.weight;
            const avgDailyLoss = totalDays > 0 ? (totalLoss / totalDays).toFixed(2) : 0;

            // 查找减重效果最好的时间段
            let bestPeriodStart = 0;
            let bestPeriodEnd = 0;
            let bestLoss = 0;

            for (let i = 0; i < sortedRecords.length - 1; i++) {
                for (let j = i + 1; j < sortedRecords.length; j++) {
                    const periodLoss = sortedRecords[i].weight - sortedRecords[j].weight;
                    const periodDays = Math.round((new Date(sortedRecords[j].record_date) - new Date(sortedRecords[i].record_date)) / (24 * 60 * 60 * 1000));

                    if (periodDays >= 7 && periodLoss > bestLoss) {
                        bestLoss = periodLoss;
                        bestPeriodStart = i;
                        bestPeriodEnd = j;
                    }
                }
            }

            // 准备分析数据
            const weightAnalysis = {
                startDate: firstRecord.record_date,
                endDate: lastRecord.record_date,
                startWeight: firstRecord.weight,
                currentWeight: lastRecord.weight,
                totalLoss: totalLoss.toFixed(1),
                totalDays: totalDays,
                avgDailyLoss: avgDailyLoss,
                bestPeriod: {
                    startDate: sortedRecords[bestPeriodStart]?.record_date,
                    endDate: sortedRecords[bestPeriodEnd]?.record_date,
                    loss: bestLoss.toFixed(1),
                    days: Math.round((new Date(sortedRecords[bestPeriodEnd]?.record_date) - new Date(sortedRecords[bestPeriodStart]?.record_date)) / (24 * 60 * 60 * 1000))
                }
            };

            // 设置减肥数据分析
            this.setData({
                weightAnalysis: weightAnalysis
            });

            console.log('生成的减肥数据分析:', weightAnalysis);
            return weightAnalysis;
        } catch (error) {
            console.error('生成减肥数据分析失败:', error);
            return null;
        }
    },
}); 