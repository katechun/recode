// pages/addCustomer/addCustomer.js
import request from '../../utils/request';
import config from '../../config/config';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    isLoading: false,
    isEdit: false,
    customerId: '',
    stores: [],
    selectedStoreId: '',
    selectedStoreIndex: 0,
    name: '',
    phone: '',
    gender: 1, // 1:男, 2:女
    age: '',
    height: '',
    initialWeight: '',
    currentWeight: '',
    targetWeight: '',
    notes: ''
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

    // 判断是新增还是编辑
    const customerId = options.id;
    const isEdit = !!customerId;

    this.setData({
      userInfo,
      isEdit,
      customerId
    });

    // 加载店铺列表
    this.loadStores();

    // 如果是编辑，加载客户详情
    if (isEdit) {
      this.loadCustomerDetail();
    }
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

  // 加载店铺列表
  loadStores: function () {
    const userInfo = this.data.userInfo;

    request.get(config.apis.stores.list, {
      data: {
        user_id: userInfo.id
      },
      success: (res) => {
        if (res && res.code === 200) {
          const stores = res.data || [];
          this.setData({ stores });
        } else {
          wx.showToast({
            title: res?.message || '加载店铺失败',
            icon: 'none'
          });
        }
      }
    });
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
          const customer = res.data || {};

          // 找到对应的店铺索引
          let storeIndex = 0;
          if (customer.store_id) {
            const index = this.data.stores.findIndex(store => store.id === customer.store_id);
            if (index !== -1) {
              storeIndex = index;
            }
          }

          this.setData({
            name: customer.name || '',
            phone: customer.phone || '',
            gender: customer.gender || 1,
            age: customer.age ? String(customer.age) : '',
            height: customer.height ? String(customer.height) : '',
            initialWeight: customer.initial_weight ? String(customer.initial_weight) : '',
            currentWeight: customer.current_weight ? String(customer.current_weight) : '',
            targetWeight: customer.target_weight ? String(customer.target_weight) : '',
            notes: customer.notes || '',
            selectedStoreId: customer.store_id || '',
            selectedStoreIndex: storeIndex
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
      }
    });
  },

  // 店铺选择变更
  bindStoreChange: function (e) {
    const index = e.detail.value;
    const store = this.data.stores[index];

    this.setData({
      selectedStoreIndex: index,
      selectedStoreId: store ? store.id : ''
    });
  },

  // 性别选择变更
  bindGenderChange: function (e) {
    const gender = parseInt(e.detail.value) + 1; // 转为1或2
    this.setData({ gender });
  },

  // 输入框变更
  bindInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    this.setData({
      [field]: value
    });
  },

  // 保存客户信息
  saveCustomer: function () {
    // 表单验证
    const { name, phone, selectedStoreId } = this.data;

    if (!name.trim()) {
      wx.showToast({
        title: '请输入客户姓名',
        icon: 'none'
      });
      return;
    }

    if (!phone.trim()) {
      wx.showToast({
        title: '请输入联系电话',
        icon: 'none'
      });
      return;
    }

    if (!selectedStoreId) {
      wx.showToast({
        title: '请选择所属店铺',
        icon: 'none'
      });
      return;
    }

    // 组装请求数据
    const { userInfo, isEdit, customerId, gender, age, height, initialWeight, currentWeight, targetWeight, notes } = this.data;

    const data = {
      user_id: userInfo.id,
      name: this.data.name.trim(),
      phone: this.data.phone.trim(),
      store_id: this.data.selectedStoreId,
      gender,
      notes: notes.trim()
    };

    // 添加可选字段
    if (age) data.age = parseInt(age) || 0;
    if (height) data.height = parseFloat(height) || 0;
    if (initialWeight) data.initial_weight = parseFloat(initialWeight) || 0;
    if (currentWeight) data.current_weight = parseFloat(currentWeight) || 0;
    if (targetWeight) data.target_weight = parseFloat(targetWeight) || 0;

    // 如果是编辑，添加客户ID
    if (isEdit) {
      data.customer_id = customerId;
    }

    this.setData({ isLoading: true });

    // 发送请求
    request.post(isEdit ? config.apis.customer.update : config.apis.customer.add, data, {
      success: (res) => {
        if (res && res.code === 200) {
          wx.showToast({
            title: isEdit ? '客户信息更新成功' : '客户添加成功',
            icon: 'success'
          });

          // 设置刷新标志
          wx.setStorageSync('customerListNeedRefresh', true);

          if (isEdit) {
            wx.setStorageSync('customerDetailNeedRefresh', true);
          }

          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res?.message || (isEdit ? '更新失败' : '添加失败'),
            icon: 'none'
          });
        }
      },
      complete: () => {
        this.setData({ isLoading: false });
      }
    });
  },

  // 取消
  cancelCustomer: function () {
    wx.navigateBack();
  }
})