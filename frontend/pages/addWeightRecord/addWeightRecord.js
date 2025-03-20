// pages/addWeightRecord/addWeightRecord.js
import request from '../../utils/request';
import config from '../../config/config';

Page({
    data: {
        userInfo: null,
        customerId: '',
        customerName: '',
        isLoading: false,
        weightRecord: {
            recordDate: '',
            weight: '',
            notes: ''
        },
        showCalendar: false,
        currentDate: new Date().toISOString().split('T')[0] // 当前日期，格式：YYYY-MM-DD
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

        const customerId = options.customer_id;
        if (!customerId) {
            wx.showToast({
                title: '客户ID不能为空',
                icon: 'none'
            });
            wx.navigateBack();
            return;
        }

        // 设置当前日期为默认记录日期
        const today = new Date().toISOString().split('T')[0];

        this.setData({
            userInfo,
            customerId,
            'weightRecord.recordDate': today,
            currentDate: today
        });

        // 获取客户基本信息
        this.loadCustomerBasicInfo();
    },

    // 加载客户基本信息
    loadCustomerBasicInfo: function () {
        this.setData({ isLoading: true });

        const { userInfo, customerId } = this.data;

        request.get(config.apis.customer.detail, {
            data: {
                user_id: userInfo.id,
                customer_id: customerId
            }
        })
            .then(res => {
                this.setData({ isLoading: false });
                if (res && res.code === 200) {
                    const customer = res.data || {};
                    this.setData({
                        customerName: customer.name || '',
                        // 如果有当前体重，默认填入当前体重
                        'weightRecord.weight': customer.current_weight ? String(customer.current_weight) : ''
                    });
                } else {
                    wx.showToast({
                        title: res?.message || '获取客户信息失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                console.error('获取客户信息失败:', err);
                this.setData({ isLoading: false });
                wx.showToast({
                    title: '获取客户信息失败',
                    icon: 'none'
                });
            });
    },

    // 日期选择相关方法
    showDatePicker: function () {
        this.setData({
            showCalendar: true
        });
    },

    hideDatePicker: function () {
        this.setData({
            showCalendar: false
        });
    },

    confirmDate: function (e) {
        const date = e.detail.value;
        this.setData({
            'weightRecord.recordDate': date,
            showCalendar: false
        });
    },

    // 输入框变更方法
    bindInputChange: function (e) {
        const field = e.currentTarget.dataset.field;
        const value = e.detail.value;

        this.setData({
            [`weightRecord.${field}`]: value
        });
    },

    // 保存体重记录
    saveWeightRecord: function () {
        // 表单验证
        const { weight, recordDate } = this.data.weightRecord;

        if (!weight) {
            wx.showToast({
                title: '请输入体重',
                icon: 'none'
            });
            return;
        }

        if (!recordDate) {
            wx.showToast({
                title: '请选择记录日期',
                icon: 'none'
            });
            return;
        }

        this.setData({ isLoading: true });
        wx.showLoading({ title: '保存中...', mask: true });

        // 设置请求超时定时器
        const timeout = setTimeout(() => {
            wx.hideLoading();
            this.setData({ isLoading: false });
            wx.showToast({
                title: '保存超时，请重试',
                icon: 'none'
            });
        }, 15000); // 15秒超时

        const { userInfo, customerId, weightRecord } = this.data;

        // 构建请求数据
        const data = {
            user_id: userInfo.id,
            customer_id: customerId,
            weight: parseFloat(weightRecord.weight),
            record_date: weightRecord.recordDate,
            notes: weightRecord.notes || ''
        };

        console.log('保存体重记录:', data);

        // 使用Promise方式发送请求
        request.post(config.apis.customer.addWeightRecord, data)
            .then(res => {
                clearTimeout(timeout); // 清除超时定时器
                wx.hideLoading();
                this.setData({ isLoading: false });

                console.log('保存体重记录响应:', res);
                if (res && res.code === 200) {
                    // 更新客户当前体重
                    this.updateCustomerCurrentWeight(weightRecord.weight);

                    wx.showToast({
                        title: '记录添加成功',
                        icon: 'success'
                    });

                    // 设置刷新标志
                    wx.setStorageSync('customerDetailNeedRefresh', true);

                    // 返回上一页
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                } else {
                    wx.showToast({
                        title: res?.message || '添加失败',
                        icon: 'none'
                    });
                }
            })
            .catch(err => {
                clearTimeout(timeout); // 清除超时定时器
                wx.hideLoading();
                this.setData({ isLoading: false });

                console.error('保存体重记录失败:', err);
                wx.showToast({
                    title: '添加失败',
                    icon: 'none'
                });
            });
    },

    // 更新客户当前体重
    updateCustomerCurrentWeight: function (weight) {
        const { userInfo, customerId } = this.data;

        // 构建请求数据
        const data = {
            user_id: userInfo.id,
            customer_id: customerId,
            current_weight: parseFloat(weight)
        };

        // 更新客户当前体重
        request.post(config.apis.customer.update, data)
            .then(res => {
                console.log('更新客户当前体重响应:', res);
                if (res && res.code === 200) {
                    console.log('客户当前体重已更新');
                } else {
                    console.error('更新客户当前体重失败:', res?.message);
                }
            })
            .catch(err => {
                console.error('更新客户当前体重请求失败:', err);
            });
    },

    // 取消
    cancel: function () {
        wx.navigateBack();
    }
}) 