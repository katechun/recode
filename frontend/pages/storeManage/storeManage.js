// pages/storeManage/storeManage.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    stores: [],
    showDialog: false,
    isEditing: false,
    currentStore: {
      id: 0,
      name: '',
      address: '',
      phone: ''
    },
    errorMsg: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }

    // 检查用户权限
    if (userInfo.role !== 1) {
      wx.showModal({
        title: '提示',
        content: '您没有权限访问此页面',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }
      });
      return;
    }

    this.setData({ userInfo });
    this.loadStores();
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
    this.loadStores();
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
    if (!this.data.userInfo) return;

    wx.showLoading({
      title: '加载中...',
    });

    wx.request({
      url: 'http://localhost:8080/api/stores',
      method: 'GET',
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200 && res.data.data) {
          this.setData({ stores: res.data.data });
        } else {
          wx.showToast({
            title: res.data.message || '获取店铺列表失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 显示添加店铺弹窗
  showAddDialog: function () {
    this.setData({
      showDialog: true,
      isEditing: false,
      currentStore: {
        id: 0,
        name: '',
        address: '',
        phone: ''
      },
      errorMsg: ''
    });
  },

  // 编辑店铺
  editStore: function (e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.data.stores.find(s => s.id === storeId);
    
    if (store) {
      this.setData({
        showDialog: true,
        isEditing: true,
        currentStore: { ...store },
        errorMsg: ''
      });
    }
  },

  // 确认删除
  confirmDelete: function (e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.data.stores.find(s => s.id === storeId);
    
    if (store) {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除店铺 "${store.name}" 吗？`,
        success: (res) => {
          if (res.confirm) {
            this.deleteStore(storeId);
          }
        }
      });
    }
  },

  // 删除店铺
  deleteStore: function (storeId) {
    wx.showLoading({
      title: '删除中...',
    });

    wx.request({
      url: 'http://localhost:8080/api/stores/delete',
      method: 'DELETE',
      data: {
        id: storeId
      },
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          this.loadStores();
        } else {
          wx.showToast({
            title: res.data.message || '删除失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 关闭弹窗
  closeDialog: function () {
    this.setData({
      showDialog: false
    });
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    return;
  },

  // 输入店铺名称
  inputStoreName: function (e) {
    this.setData({
      'currentStore.name': e.detail.value,
      errorMsg: ''
    });
  },

  // 输入店铺地址
  inputStoreAddress: function (e) {
    this.setData({
      'currentStore.address': e.detail.value
    });
  },

  // 输入店铺电话
  inputStorePhone: function (e) {
    this.setData({
      'currentStore.phone': e.detail.value
    });
  },

  // 提交表单
  submitStore: function () {
    const { currentStore, isEditing } = this.data;
    
    // 表单验证
    if (!currentStore.name.trim()) {
      this.setData({ errorMsg: '店铺名称不能为空' });
      return;
    }
    
    wx.showLoading({
      title: isEditing ? '更新中...' : '添加中...',
    });
    
    const url = isEditing 
      ? 'http://localhost:8080/api/stores/update' 
      : 'http://localhost:8080/api/stores/create';
    
    const method = isEditing ? 'PUT' : 'POST';
    
    wx.request({
      url: url,
      method: method,
      data: currentStore,
      header: {
        'X-User-ID': this.data.userInfo.id,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          wx.showToast({
            title: isEditing ? '更新成功' : '添加成功',
            icon: 'success'
          });
          this.setData({ showDialog: false });
          this.loadStores();
        } else {
          this.setData({ 
            errorMsg: res.data.message || (isEditing ? '更新失败' : '添加失败') 
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ 
          errorMsg: '网络请求失败' 
        });
      }
    });
  }
})