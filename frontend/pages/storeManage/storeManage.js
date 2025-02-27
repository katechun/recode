// pages/storeManage/storeManage.js
import request from '../../utils/request';
import config from '../../config/config';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    stores: [],
    filteredStores: [],
    searchKey: '',
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

    request.get(config.apis.stores.list)
      .then(res => {
        wx.hideLoading();
        if (res.data) {
          this.setData({ 
            stores: res.data,
            filteredStores: res.data 
          });
        } else {
          wx.showToast({
            title: '获取店铺列表失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取店铺列表失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
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
        content: `确定要删除店铺"${store.name}"吗？此操作不可恢复。`,
        success: (res) => {
          if (res.confirm) {
            this.deleteStore(storeId);
          }
        }
      });
    }
  },

  // 删除店铺
  deleteStore: function (e) {
    // 支持既可以传入 storeId 参数，也可以从事件中获取
    let storeId;
    let storeName;
    
    // 检查是否从按钮事件直接调用
    if (e && e.currentTarget && e.currentTarget.dataset) {
      storeId = e.currentTarget.dataset.id;
      storeName = e.currentTarget.dataset.name;
      
      // 如果是从按钮点击直接调用，需要先显示确认对话框
      wx.showModal({
        title: '确认删除',
        content: `确定要删除店铺"${storeName}"吗？此操作不可恢复。`,
        success: (res) => {
          if (res.confirm) {
            this.executeDeleteStore(storeId);
          }
        }
      });
      return;
    }
    
    // 如果已经是传入 ID 参数，直接执行删除
    this.executeDeleteStore(storeId);
  },

  // 实际执行删除操作的函数
  executeDeleteStore: function (storeId) {
    // 验证参数
    if (!storeId) {
      wx.showModal({
        title: '删除失败',
        content: '店铺ID无效',
        showCancel: false
      });
      return;
    }
    
    // 确保storeId是数值类型
    storeId = Number(storeId);

    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    // 打印请求数据以便调试
    console.log('发送删除请求:', { store_id: storeId });

    request.post(config.apis.stores.delete, { store_id: storeId })
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        this.loadStores();
      })
      .catch(err => {
        wx.hideLoading();
        console.error('删除店铺失败:', err);
        wx.showModal({
          title: '删除失败',
          content: err.message || '未知错误，请重试',
          showCancel: false
        });
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
      ? config.apiBaseUrl+'/api/stores/update'
      : config.apiBaseUrl+'/api/stores/create';

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
  },

  // 搜索店铺
  searchStores: function(e) {
    const keyword = e.detail.value.toLowerCase();
    this.setData({
      searchKey: keyword,
      filteredStores: keyword ? 
        this.data.stores.filter(store => 
          store.name.toLowerCase().includes(keyword) || 
          (store.address && store.address.toLowerCase().includes(keyword)) ||
          (store.phone && store.phone.includes(keyword))
        ) : 
        this.data.stores
    });
  }
})