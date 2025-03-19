import request from '../../utils/request';
import config from '../../config/config';

Page({
    data: {
        userInfo: null,
        customers: [],
        isLoading: false,
        pageNum: 1,
        pageSize: 20,
        hasMore: true,
        selectedStoreId: '',
        stores: [],
        storePickerVisible: false,
        selectedStore: null
    },

    onLoad: function () {
        // 检查用户是否已登录
        const userInfo = wx.getStorageSync('userInfo');
        if (!userInfo) {
            wx.reLaunch({
                url: '/pages/login/login',
            });
            return;
        }

        this.setData({
            userInfo
        });

        // 加载店铺列表
        this.loadStores();
        // 加载客户列表
        this.loadCustomers(true);
    },

    onShow: function () {
        // 检查是否需要刷新
        if (wx.getStorageSync('customerListNeedRefresh')) {
            // 重置页码，重新加载数据
            this.setData({
                pageNum: 1,
                customers: []
            });
            this.loadCustomers(true);
            wx.removeStorageSync('customerListNeedRefresh');
        }
    },

    onPullDownRefresh: function () {
        // 下拉刷新，重置页码，重新加载数据
        this.setData({
            pageNum: 1,
            customers: []
        });
        this.loadCustomers(true);
    },

    onReachBottom: function () {
        // 上拉加载更多
        if (this.data.hasMore && !this.data.isLoading) {
            this.loadCustomers(false);
        }
    },

    // 加载店铺列表
    loadStores: function () {
        const userInfo = this.data.userInfo;

        request.get(config.apis.stores.list, {
            data: {
                user_id: userInfo.id
            },
            success: (res) => {
                if (res && res.code === 200) {
                    const storeList = res.data || [];

                    // 处理店铺列表，添加全部店铺选项
                    const stores = [
                        { id: '', name: '全部店铺' },
                        ...storeList
                    ];

                    this.setData({
                        stores,
                        selectedStore: stores[0]
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '加载店铺失败',
                        icon: 'none'
                    });
                }
            }
        });
    },

    // 加载客户列表
    loadCustomers: function (refresh) {
        if (this.data.isLoading) return;

        this.setData({ isLoading: true });

        const { userInfo, pageNum, pageSize, selectedStoreId } = this.data;

        request.get(config.apis.customer.list, {
            data: {
                user_id: userInfo.id,
                store_id: selectedStoreId || '',
                page: pageNum,
                page_size: pageSize
            },
            success: (res) => {
                if (res && res.code === 200) {
                    const newCustomers = res.data || [];

                    // 判断是否有更多数据
                    const hasMore = newCustomers.length === pageSize;

                    if (refresh) {
                        // 刷新数据
                        this.setData({
                            customers: newCustomers,
                            pageNum: 2,
                            hasMore
                        });
                    } else {
                        // 加载更多
                        this.setData({
                            customers: [...this.data.customers, ...newCustomers],
                            pageNum: pageNum + 1,
                            hasMore
                        });
                    }
                } else {
                    wx.showToast({
                        title: res?.message || '加载客户列表失败',
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

    // 显示店铺选择弹窗
    showStorePicker: function () {
        this.setData({
            storePickerVisible: true
        });
    },

    // 关闭店铺选择弹窗
    closeStorePicker: function () {
        this.setData({
            storePickerVisible: false
        });
    },

    // 阻止事件冒泡
    stopPropagation: function () { },

    // 选择店铺
    selectStore: function (e) {
        const index = e.currentTarget.dataset.index;
        const selectedStore = this.data.stores[index];

        this.setData({
            selectedStore,
            selectedStoreId: selectedStore.id,
            storePickerVisible: false,
            pageNum: 1,
            customers: []
        });

        // 重新加载客户列表
        this.loadCustomers(true);
    },

    // 跳转到客户详情页
    navigateToDetail: function (e) {
        const customerId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/customerDetail/customerDetail?id=${customerId}`
        });
    },

    // 跳转到添加客户页
    navigateToAdd: function () {
        wx.navigateTo({
            url: '/pages/addCustomer/addCustomer'
        });
    }
}); 