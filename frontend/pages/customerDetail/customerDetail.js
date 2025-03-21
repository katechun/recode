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

        if (isNaN(customerIdNum) || isNaN(productIdNum) || isNaN(quantityNum)) {
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

        // 模拟报表生成成功
        setTimeout(() => {
            this.setData({ isExporting: false, showExportOptions: false });

            wx.showToast({
                title: '报表生成成功',
                icon: 'success'
            });

            console.log('模拟生成报表:', reportData);

            // 未来当服务器支持时，可以替换为真实的API调用
            /*
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
            */
        }, 1500);
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

    // 切换BMI显示
    toggleBmi: function () {
        const newShowBmi = !this.data.showBmi;
        this.setData({
            showBmi: newShowBmi
        });

        // 重新加载图表
        if (this.data.weightRecords && this.data.weightRecords.length > 0) {
            this.createWeightTrendData(this.data.weightRecords);
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

    // 计算BMI基础函数
    calculateBmi: function (weight, height) {
        if (!weight || !height) return 0;
        const heightInMeters = height / 100;
        return (weight / (heightInMeters * heightInMeters)).toFixed(1);
    },

    // 计算BMI
    calculateBMI: function (weight, height) {
        const currentBmi = this.calculateBmi(weight, height);
        const bmiCategory = this.getBmiCategory(currentBmi);

        this.setData({
            currentBmi: currentBmi,
            bmiCategory: bmiCategory
        });

        return currentBmi;
    },

    // 计算体脂率
    calculateBodyFatPercentage: function (customerDetail) {
        const currentBmi = this.calculateBmi(customerDetail.current_weight, customerDetail.height);
        const bodyFatPercentage = this.calculateBodyFat(currentBmi, customerDetail.age, customerDetail.gender);
        const bodyFatCategory = this.getBodyFatCategory(bodyFatPercentage, customerDetail.gender);

        this.setData({
            bodyFatPercentage: bodyFatPercentage,
            bodyFatCategory: bodyFatCategory
        });

        return bodyFatPercentage;
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

    // 初始化BMI分类
    initBmiCategories: function () {
        this.setData({
            bmiCategories: [
                { min: 0, max: 18.5, label: '偏瘦', color: '#909399' },
                { min: 18.5, max: 24, label: '正常', color: '#67c23a' },
                { min: 24, max: 28, label: '超重', color: '#e6a23c' },
                { min: 28, max: 32, label: '肥胖', color: '#f56c6c' },
                { min: 32, max: 100, label: '重度肥胖', color: '#c03639' }
            ]
        });
    },

    // 计算今日掉秤量和代谢量
    calculateTodayWeightMetrics: function () {
        // 如果体重记录未加载，先加载
        if (!this.data.weightRecords || this.data.weightRecords.length === 0) {
            console.log('没有体重记录，无法计算掉秤量和代谢量');
            this.setData({
                weightDropValue: '0.0',
                metabolismValue: '0.0'
            });
            return;
        }

        // 获取今天和昨天的日期
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayString = this.formatDate(today);
        const yesterdayString = this.formatDate(yesterday);

        console.log('正在计算掉秤量和代谢量', '今天:', todayString, '昨天:', yesterdayString);

        // 查找今天和昨天的早晚称记录
        let todayMorning = null;
        let todayEvening = null;
        let yesterdayMorning = null;
        let yesterdayEvening = null;

        // 遍历所有记录查找匹配的日期和类型
        this.data.weightRecords.forEach(record => {
            console.log('检查记录:', record.record_date, record.time_type, record.weight);
            if (record.record_date === todayString) {
                if (record.time_type === 'morning') {
                    todayMorning = record.weight;
                    console.log('找到今天早称:', todayMorning);
                } else if (record.time_type === 'evening') {
                    todayEvening = record.weight;
                    console.log('找到今天晚称:', todayEvening);
                }
            } else if (record.record_date === yesterdayString) {
                if (record.time_type === 'morning') {
                    yesterdayMorning = record.weight;
                    console.log('找到昨天早称:', yesterdayMorning);
                } else if (record.time_type === 'evening') {
                    yesterdayEvening = record.weight;
                    console.log('找到昨天晚称:', yesterdayEvening);
                }
            }
        });

        // 计算掉秤量：昨天早上体重 - 今天早上体重
        let weightDrop = '0.0';
        if (yesterdayMorning !== null && todayMorning !== null) {
            weightDrop = (yesterdayMorning - todayMorning).toFixed(1);
            console.log('计算掉秤量:', yesterdayMorning, '-', todayMorning, '=', weightDrop);
        } else {
            console.log('无法计算掉秤量, 昨天早称:', yesterdayMorning, '今天早称:', todayMorning);
        }

        // 计算代谢量：昨天晚上体重 - 今天晚上体重
        let metabolism = '0.0';
        if (yesterdayEvening !== null && todayEvening !== null) {
            metabolism = (yesterdayEvening - todayEvening).toFixed(1);
            console.log('计算代谢量:', yesterdayEvening, '-', todayEvening, '=', metabolism);
        } else {
            console.log('无法计算代谢量, 昨天晚称:', yesterdayEvening, '今天晚称:', todayEvening);
        }

        // 使用负值表示体重上涨了
        if (Number(weightDrop) < 0) {
            console.log('体重上涨, 掉秤量为负值:', weightDrop);
        }

        if (Number(metabolism) < 0) {
            console.log('代谢量为负值:', metabolism);
        }

        // 更新数据
        this.setData({
            weightDropValue: weightDrop,
            metabolismValue: metabolism
        });

        console.log('掉秤量和代谢量计算完成:', weightDrop, metabolism);
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
}); 