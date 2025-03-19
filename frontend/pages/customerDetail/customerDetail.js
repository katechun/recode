// pages/customerDetail/customerDetail.js
import request from '../../utils/request';
import config from '../../config/config';

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
        hasMore: true
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

        request.get(config.apis.customer.detail, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            },
            success: (res) => {
                if (res && res.code === 200) {
                    const customerDetail = res.data || {};

                    // 计算减重进度
                    if (customerDetail.initial_weight && customerDetail.target_weight && customerDetail.current_weight) {
                        const totalNeedLoss = customerDetail.initial_weight - customerDetail.target_weight;
                        const currentLoss = customerDetail.initial_weight - customerDetail.current_weight;
                        const progress = totalNeedLoss <= 0 ? 0 : Math.min(100, Math.round((currentLoss / totalNeedLoss) * 100));

                        customerDetail.progress = progress;
                    } else {
                        customerDetail.progress = 0;
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
            },
            complete: () => {
                this.setData({ isLoading: false });
                wx.stopPullDownRefresh();
            }
        });
    },

    // 加载减肥记录
    loadWeightRecords: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        request.get(config.apis.customer.weightRecords, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            },
            success: (res) => {
                if (res && res.code === 200) {
                    const records = res.data || [];

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
            },
            complete: () => {
                this.setData({ isLoading: false });
            }
        });
    },

    // 加载产品使用记录
    loadProductUsage: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        request.get(config.apis.customer.productUsage, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId,
                page: 1,
                page_size: 999 // 一次性加载所有
            },
            success: (res) => {
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
            },
            complete: () => {
                this.setData({ isLoading: false });
            }
        });
    },

    // 加载更多记录
    loadMoreRecords: function () {
        if (this.data.isLoading) return;

        this.setData({ isLoading: true });

        const { userInfo, customerId, pageNum, pageSize } = this.data;

        request.get(config.apis.customer.records, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId,
                page: pageNum,
                page_size: pageSize
            },
            success: (res) => {
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
            },
            complete: () => {
                this.setData({ isLoading: false });
            }
        });
    },

    // 创建减肥趋势图数据
    createWeightTrendData: function (records) {
        if (!records || records.length === 0) return;

        // 按日期升序排序，以便正确显示趋势
        const sortedRecords = [...records].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

        // 用于图表的数据
        const dates = sortedRecords.map(record => record.record_date.substring(5)); // 只显示月-日
        const weights = sortedRecords.map(record => record.weight);

        // 在页面中设置图表数据
        this.setData({
            chartData: {
                categories: dates,
                series: [
                    {
                        name: '体重',
                        data: weights,
                        format: (val) => val + 'kg'
                    }
                ]
            }
        });
    },

    // 切换Tab
    switchTab: function (e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({
            activeTab: tab
        });
    },

    // 添加减肥记录
    addWeightRecord: function () {
        wx.navigateTo({
            url: `/pages/addWeightRecord/addWeightRecord?customer_id=${this.data.customerId}`
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

    // 导出减肥报表
    exportWeightReport: function () {
        wx.showToast({
            title: '生成中，请稍候',
            icon: 'loading',
            duration: 2000
        });

        const { userInfo, customerId } = this.data;

        request.get(config.apis.customer.exportReport, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            },
            success: (res) => {
                if (res && res.code === 200) {
                    const reportUrl = res.data.url;

                    if (reportUrl) {
                        // 如果是小程序环境，使用微信API预览或下载
                        wx.showModal({
                            title: '报表已生成',
                            content: '可以通过以下方式查看报表：\n1. 预览报表\n2. 复制报表链接',
                            cancelText: '预览',
                            confirmText: '复制链接',
                            success: (result) => {
                                if (result.confirm) {
                                    // 复制链接
                                    wx.setClipboardData({
                                        data: reportUrl,
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
                                        url: reportUrl,
                                        success: (res) => {
                                            if (res.statusCode === 200) {
                                                const filePath = res.tempFilePath;
                                                wx.openDocument({
                                                    filePath: filePath,
                                                    showMenu: true,
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
                                        fail: () => {
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
            }
        });
    }
}); 