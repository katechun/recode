// pages/account/account.js
import request from '../../utils/request';
import config from '../../config/config';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    stores: [],
    storeIndex: -1,
    accountTypes: [],
    typeIndex: -1,
    amount: '',
    remark: '',
    errorMsg: '',
    recentRecords: [],
    currentStoreId: '',
    startDate: '',
    endDate: '',
    accounts: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }

    this.setData({ userInfo });
    this.loadStores();
    this.loadAccountTypes();
    this.loadRecentRecords();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 加载用户可访问的店铺
  loadStores() {
    wx.request({
      url: config.apiBaseUrl + '/api/stores',
      method: 'GET',
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        console.log('店铺数据:', res.data);
        if (res.data.code === 200 && res.data.data) {
          this.setData({ stores: res.data.data });

          // 如果只有一个店铺，自动选中
          if (res.data.data.length === 1) {
            this.setData({ storeIndex: 0 });
          }
        }
      },
      fail: (err) => {
        console.error('获取店铺失败:', err);
        wx.showToast({
          title: '获取店铺失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载账务类型
  loadAccountTypes() {
    wx.request({
      url: config.apiBaseUrl + '/api/account-types',
      method: 'GET',
      success: (res) => {
        console.log('账务类型数据:', res.data);
        if (res.data.code === 200 && res.data.data) {
          this.setData({ accountTypes: res.data.data });
        }
      },
      fail: (err) => {
        console.error('获取账务类型失败:', err);
        wx.showToast({
          title: '获取账务类型失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载最近记账记录
  loadRecentRecords() {
    // 当前选中的店铺ID
    const storeID = this.data.storeIndex >= 0 ? this.data.stores[this.data.storeIndex].id : '';

    wx.request({
      url: config.apiBaseUrl + '/api/accounts',
      method: 'GET',
      data: {
        store_id: storeID,
        limit: 10
      },
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        console.log('最近记账数据:', res.data);
        if (res.data.code === 200 && res.data.data) {
          this.setData({ recentRecords: res.data.data });
        }
      },
      fail: (err) => {
        console.error('获取记账记录失败:', err);
      }
    });
  },

  // 选择店铺
  bindStoreChange(e) {
    this.setData({
      storeIndex: e.detail.value
    });

    // 当店铺变更时，重新加载该店铺的记账记录
    this.loadRecentRecords();
  },

  // 选择账务类型
  bindTypeChange(e) {
    this.setData({
      typeIndex: e.detail.value
    });
  },

  // 输入金额
  inputAmount(e) {
    this.setData({
      amount: e.detail.value
    });
  },

  // 输入备注
  inputRemark(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 提交记账
  submitAccount() {
    const { storeIndex, typeIndex, amount, remark, stores, accountTypes, userInfo } = this.data;

    // 表单验证
    if (storeIndex < 0) {
      this.setData({ errorMsg: '请选择店铺' });
      return;
    }

    if (typeIndex < 0) {
      this.setData({ errorMsg: '请选择账务类型' });
      return;
    }

    if (!amount) {
      this.setData({ errorMsg: '请输入金额' });
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      this.setData({ errorMsg: '金额格式不正确' });
      return;
    }

    // 清除错误提示
    this.setData({ errorMsg: '' });

    // 准备数据
    const accountData = {
      store_id: stores[storeIndex].id,
      type_id: accountTypes[typeIndex].id,
      amount: accountTypes[typeIndex].category === '收入' ? Math.abs(amountValue) : -Math.abs(amountValue),
      remark: remark
    };

    console.log('提交记账数据:', accountData);

    // 调用API创建账务记录
    wx.request({
      url: config.apiBaseUrl + '/api/accounts/create',
      method: 'POST',
      data: accountData,
      header: {
        'content-type': 'application/json',
        'X-User-ID': userInfo.id
      },
      success: (res) => {
        console.log('记账响应:', res.data);
        if (res.data.code === 200) {
          wx.showToast({
            title: '记账成功',
            icon: 'success',
            duration: 2000,
            success: () => {
              // 重置表单
              this.setData({
                storeIndex: -1,
                typeIndex: -1,
                amount: '',
                remark: ''
              });

              // 刷新最近记录
              this.loadRecentRecords();
            }
          });
        } else {
          this.setData({ errorMsg: res.data.message || '创建记录失败' });
        }
      },
      fail: (err) => {
        console.error('记账请求失败:', err);
        this.setData({ errorMsg: '网络请求失败，请稍后再试' });
      }
    });
  },

  // 加载账务记录
  loadAccounts: function () {
    request.get(config.apis.accounts.list, {
      params: {
        store_id: this.data.currentStoreId,
        start_date: this.data.startDate,
        end_date: this.data.endDate
      }
    }).then(res => {
      this.setData({
        accounts: (res.data && res.data.data) ? res.data.data : []
      });
    }).catch(err => {
      console.error('加载账务记录失败:', err);
      this.setData({
        accounts: []
      });
    });
  }
})