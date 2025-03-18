// pages/accountType/accountType.js
import request from '../../utils/request';
import config from '../../config/config';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    accountTypes: [],
    showDialog: false,
    isEditing: false,
    currentType: {
      id: 0,
      name: '',
      is_expense: true,
      category: 2  // 默认为支出类型，对应category=2
    },
    categoryOptions: [
      { id: true, name: '支出' },
      { id: false, name: '收入' }
    ],
    categoryIndex: 0, // 默认选中支出
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
    this.loadAccountTypes();
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
    this.loadAccountTypes();
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

  // 加载账务类型
  loadAccountTypes: function () {
    wx.showLoading({
      title: '加载中...',
    });

    request.get(config.apis.accountTypes.list)
      .then(res => {
        wx.hideLoading();
        this.setData({
          accountTypes: res.data
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      });
  },

  // 显示添加对话框
  showAddDialog: function () {
    this.setData({
      showDialog: true,
      isEditing: false,
      currentType: {
        id: 0,
        name: '',
        is_expense: true,
        category: 2  // 默认为支出类型，对应category=2
      },
      categoryIndex: 0,
      errorMsg: ''
    });
  },

  // 编辑账务类型
  editType: function (e) {
    const typeId = e.currentTarget.dataset.id;
    const accountType = this.data.accountTypes.find(item => item.id === typeId);

    if (accountType) {
      this.setData({
        showDialog: true,
        isEditing: true,
        currentType: accountType,
        categoryIndex: accountType.is_expense ? 0 : 1,
        errorMsg: ''
      });
    }
  },

  // 关闭对话框
  closeDialog: function () {
    this.setData({
      showDialog: false
    });
  },

  // 输入类型名称
  inputTypeName: function (e) {
    this.setData({
      'currentType.name': e.detail.value
    });
  },

  // 选择类型分类
  bindCategoryChange: function (e) {
    const index = e.detail.value;
    const isExpense = this.data.categoryOptions[index].id;
    this.setData({
      categoryIndex: index,
      'currentType.is_expense': isExpense,
      'currentType.category': isExpense ? 2 : 1  // 根据是否为支出设置category值
    });
  },

  // 确认删除
  confirmDelete: function (e) {
    const typeId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个账务类型吗？已关联的账务记录将无法显示该类型。',
      success: (res) => {
        if (res.confirm) {
          this.deleteType(typeId);
        }
      }
    });
  },

  // 删除账务类型
  deleteType: function (typeId) {
    wx.showLoading({
      title: '删除中...',
    });

    request.delete(`${config.apis.accountTypes.delete}?id=${typeId}`)
      .then(res => {
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        this.loadAccountTypes();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      });
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    return;
  },

  // 提交表单
  submitForm: function () {
    const { currentType, isEditing } = this.data;

    // 表单验证
    if (!currentType.name.trim()) {
      this.setData({ errorMsg: '类型名称不能为空' });
      return;
    }

    // 确保category字段已设置
    if (!currentType.category) {
      this.setData({
        'currentType.category': currentType.is_expense ? 2 : 1  // 根据is_expense设置category
      });
    }

    wx.showLoading({
      title: isEditing ? '更新中...' : '添加中...',
    });

    const url = isEditing
      ? config.apis.accountTypes.update
      : config.apis.accountTypes.create;

    const requestMethod = isEditing ? request.put : request.post;

    // 添加日志以检查请求数据
    console.log('提交账务类型数据:', currentType);

    requestMethod(url, currentType)
      .then(res => {
        wx.hideLoading();
        wx.showToast({
          title: isEditing ? '更新成功' : '添加成功',
          icon: 'success'
        });
        this.setData({ showDialog: false });
        this.loadAccountTypes();
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('请求失败:', err);
        this.setData({
          errorMsg: '网络请求失败：' + (err.message || '未知错误')
        });
      });
  }
})