// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    motto: 'Hello World',
    userInfo: null,
    isAdmin: false,
    storeList: [],
    recentAccounts: [],
    todayIncome: 0,
    todayExpense: 0,
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    totalIncome: 0,
    totalExpense: 0,
    netAmount: 0,
    recentRecords: [],
    dateRange: '本月',
    dateOptions: ['今日', '本周', '本月', '本年'],
    stores: [],
    selectedStoreId: '',
    storePickerVisible: false,
    selectedStoreName: '全部店铺',
    incomeTypes: [],
    expenseTypes: [],
    accountTypes: [],
    selectedIncomeType: null,
    selectedExpenseType: null,
    storeIndex: 0,
    incomeTypeIndex: 0,
    expenseTypeIndex: 0,
    defaultSettingsVisible: false
  },
  bindViewTap() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const { nickName } = this.data.userInfo
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
      hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
    })
  },
  onInputChange(e) {
    const nickName = e.detail.value
    const { avatarUrl } = this.data.userInfo
    this.setData({
      "userInfo.nickName": nickName,
      hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
    })
  },
  getUserProfile(e) {
    // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
    wx.getUserProfile({
      desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
      success: (res) => {
        console.log(res)
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },
  onLoad: function (options) {
    // 检查方法是否存在
    console.log('showDefaultSettings方法存在:', typeof this.showDefaultSettings === 'function');
    
    // 获取用户信息
    this.getUserInfo();
    
    // 获取店铺列表
    this.getStores();
    
    // 获取账务类型
    this.getAccountTypes();
    
    // 加载默认设置
    this.loadDefaultSettings();
  },
  onShow() {
    // 检查userInfo是否存在
    if (this.data.userInfo) {
      this.loadStatistics();
      this.loadRecentRecords();
    } else {
      // 尝试从Storage获取用户信息
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ userInfo });
        this.loadStatistics();
        this.loadRecentRecords();
      } else {
        // 如果仍然没有用户信息，跳转到登录页
        wx.reLaunch({
          url: '/pages/login/login',
        });
      }
    }
  },
  // 加载用户可访问的店铺
  loadStores() {
    // 首先检查userInfo是否存在
    if (!this.data.userInfo) {
      console.log('用户信息不存在，无法加载店铺');
      return;
    }

    wx.request({
      url: 'http://localhost:8080/api/stores',
      method: 'GET',
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        if (res.data.code === 200 && res.data.data) {
          const stores = [{ id: '', name: '全部店铺' }, ...res.data.data];
          this.setData({ stores });
        }
      }
    });
  },
  // 日期范围选择
  bindDateRangeChange(e) {
    const index = e.detail.value;
    this.setData({
      dateRange: this.data.dateOptions[index]
    });

    this.loadStatistics();
    this.loadRecentRecords();
  },
  // 店铺选择
  showStorePicker() {
    this.setData({
      storePickerVisible: true
    });
  },
  closeStorePicker() {
    this.setData({
      storePickerVisible: false
    });
  },
  selectStore(e) {
    const index = e.currentTarget.dataset.index;
    const selectedStore = this.data.stores[index];
    const selectedStoreId = selectedStore.id;
    const selectedStoreName = selectedStore.name;
    
    this.setData({
      selectedStoreId,
      selectedStoreName,
      storePickerVisible: false
    });

    this.loadStatistics();
    this.loadRecentRecords();
  },
  // 获取日期范围
  getDateRange() {
    const now = new Date();
    let startDate = '';
    let endDate = '';
    
    switch (this.data.dateRange) {
      case '今日':
        startDate = this.formatDate(now);
        endDate = startDate;
        break;
      case '本周':
        const dayOfWeek = now.getDay() || 7; // 获取星期几，若是周日则为0，转为7
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek + 1); // 周一
        startDate = this.formatDate(startOfWeek);
        endDate = this.formatDate(now);
        break;
      case '本月':
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = this.formatDate(now);
        break;
      case '本年':
        startDate = `${now.getFullYear()}-01-01`;
        endDate = this.formatDate(now);
        break;
    }

    return { startDate, endDate };
  },
  // 格式化日期为YYYY-MM-DD
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },
  // 加载统计数据
  loadStatistics() {
    // 首先检查userInfo是否存在
    if (!this.data.userInfo) {
      console.log('用户信息不存在，无法加载统计数据');
      return;
    }

    const { startDate, endDate } = this.getDateRange();
    
    wx.request({
      url: 'http://localhost:8080/api/accounts/statistics',
      method: 'GET',
      data: {
        store_id: this.data.selectedStoreId,
        start_date: startDate,
        end_date: endDate
      },
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        if (res.data.code === 200 && res.data.data) {
          const stats = res.data.data;
          this.setData({
            totalIncome: stats.total_income.toFixed(2),
            totalExpense: stats.total_expense.toFixed(2),
            netAmount: stats.net_amount.toFixed(2)
          });
        }
      }
    });
  },
  // 加载最近记账记录
  loadRecentRecords() {
    // 首先检查userInfo是否存在
    if (!this.data.userInfo) {
      console.log('用户信息不存在，无法加载记录');
      return;
    }

    const { startDate, endDate } = this.getDateRange();
    
    wx.request({
      url: 'http://localhost:8080/api/accounts',
      method: 'GET',
      data: {
        store_id: this.data.selectedStoreId,
        start_date: startDate,
        end_date: endDate,
        limit: 10
      },
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        if (res.data.code === 200 && res.data.data) {
          this.setData({ recentRecords: res.data.data });
        }
      }
    });
  },
  // 跳转到记账页面
  goToAccount: function() {
    // 检查是否已选择店铺和账务类型
    if (!this.data.selectedStore || !this.data.selectedStore.id) {
      wx.showToast({
        title: '请先选择店铺',
        icon: 'none'
      });
      return;
    }
    
    // 默认使用收入类型
    let typeId = '';
    if (this.data.selectedIncomeType && this.data.selectedIncomeType.id) {
      typeId = this.data.selectedIncomeType.id;
    }
    
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${this.data.selectedStore.id}&typeId=${typeId}&type=income`,
      fail: function(err) {
        console.error('导航到记账页面失败:', err);
        wx.showToast({
          title: '页面跳转失败: ' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },
  // 跳转到店铺管理
  goToStoreManage: function() {
    wx.navigateTo({
      url: '/pages/storeManage/storeManage',
    });
  },
  // 跳转到用户管理
  goToUserManage: function() {
    wx.navigateTo({
      url: '/pages/userManage/userManage',
    });
  },
  // 跳转到账务类型管理
  goToAccountType: function() {
    wx.navigateTo({
      url: '/pages/accountType/accountType',
    });
  },
  // 退出登录
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除存储的用户信息
          wx.removeStorageSync('userInfo');
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login',
          });
        }
      }
    });
  },
  stopPropagation() {
    // 这个函数仅用于阻止事件冒泡
    return;
  },
  // 添加快捷记账功能
  quickAddAccount: function(e) {
    const type = e.currentTarget.dataset.type;
    const storeId = e.currentTarget.dataset.storeId;
    const typeId = e.currentTarget.dataset.typeId;
    
    console.log('快捷记账:', type, storeId, typeId); // 添加日志查看数据
    
    if (!storeId || !typeId) {
      wx.showToast({
        title: '请先选择店铺和账务类型',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到记账页面并传递参数
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${storeId}&typeId=${typeId}&type=${type}`,
      fail: function(err) {
        console.error('导航失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  // 添加这个函数确保选择默认值
  selectDefaultValues: function() {
    const stores = this.data.stores;
    const incomeTypes = this.data.incomeTypes;
    const expenseTypes = this.data.expenseTypes;
    
    if (stores && stores.length > 0 && !this.data.selectedStore) {
      this.setData({
        selectedStore: stores[0]
      });
    }
    
    if (incomeTypes && incomeTypes.length > 0 && !this.data.selectedIncomeType) {
      this.setData({
        selectedIncomeType: incomeTypes[0]
      });
    }
    
    if (expenseTypes && expenseTypes.length > 0 && !this.data.selectedExpenseType) {
      this.setData({
        selectedExpenseType: expenseTypes[0]
      });
    }
  },
  getAccountTypes: function() {
    const that = this;
    wx.showLoading({
      title: '加载中',
    });
    
    wx.request({
      url: 'http://localhost:8080/api/account-types',
      method: 'GET',
      header: {
        'X-User-ID': wx.getStorageSync('userId') || ''
      },
      success: function(res) {
        wx.hideLoading();
        if (res.data.code === 200) {
          let incomeTypes = [];
          let expenseTypes = [];
          
          // 分类处理
          res.data.data.forEach(item => {
            if (item.is_expense) {
              expenseTypes.push(item);
            } else {
              incomeTypes.push(item);
            }
          });
          
          that.setData({
            accountTypes: res.data.data,
            incomeTypes: incomeTypes,
            expenseTypes: expenseTypes
          });
          
          // 选择默认值
          that.selectDefaultValues();
        } else {
          wx.showToast({
            title: '获取账务类型失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('获取账务类型失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },
  getUserInfo: function() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }

    this.setData({
      userInfo,
      isAdmin: userInfo.role === 1, // 1表示管理员
      stores: [],               // 初始化为空数组
      recentRecords: [],        // 初始化为空数组
      selectedStoreId: '',
      selectedStoreName: '全部店铺',
      totalIncome: '0.00',
      totalExpense: '0.00',
      netAmount: '0.00',
      todayIncome: 0,
      todayExpense: 0
    });

    // 获取店铺列表（实际项目中应该从API获取）
    // 这里仅做示例
    this.setData({
      storeList: [
        { id: 1, name: '总店' },
        { id: 2, name: '分店1' },
        { id: 3, name: '分店2' }
      ],
      recentAccounts: [
        { id: 1, store_name: '总店', type_name: '销售收入', amount: 1200, create_time: '2023-06-01 10:21' },
        { id: 2, store_name: '分店1', type_name: '水电费', amount: -300, create_time: '2023-06-01 09:15' },
        { id: 3, store_name: '分店2', type_name: '进货支出', amount: -2500, create_time: '2023-05-31 16:42' }
      ],
      todayIncome: 1200,
      todayExpense: 300
    });

    this.loadStores();
  },
  getStores: function() {
    // 获取店铺列表
    this.loadStores();
  },
  bindStoreChange: function(e) {
    const index = e.detail.value;
    this.setData({
      storeIndex: index,
      selectedStore: this.data.stores[index]
    });
    
    // 自动保存设置
    this.saveDefaultSettings();
  },
  bindIncomeTypeChange: function(e) {
    const index = e.detail.value;
    this.setData({
      incomeTypeIndex: index,
      selectedIncomeType: this.data.incomeTypes[index]
    });
    
    // 自动保存设置
    this.saveDefaultSettings();
  },
  bindExpenseTypeChange: function(e) {
    const index = e.detail.value;
    this.setData({
      expenseTypeIndex: index,
      selectedExpenseType: this.data.expenseTypes[index]
    });
    
    // 自动保存设置
    this.saveDefaultSettings();
  },
  // 统一添加这个方法
  navigateToAccount: function() {
    this.goToAccount();
  },
  // 显示默认设置弹窗
  showDefaultSettings: function() {
    console.log('打开记账默认设置弹窗');
    this.setData({
      defaultSettingsVisible: true
    });
  },
  // 关闭默认设置弹窗
  closeDefaultSettings: function() {
    console.log('关闭记账默认设置弹窗');
    this.setData({
      defaultSettingsVisible: false
    });
    
    // 保存设置
    this.saveDefaultSettings();
  },
  // 阻止事件冒泡
  stopPropagation: function() {
    // 什么都不做，只阻止事件传递
  },
  loadDefaultSettings: function() {
    const defaultSettings = wx.getStorageSync('defaultAccountSettings');
    if (defaultSettings) {
      // 如果有保存的设置，恢复它们
      // 注意：实际恢复逻辑需要在加载完成stores和accountTypes后执行
      // 这里只是示例，实际实现可能需要在回调中处理
      this.setData({
        selectedStoreId: defaultSettings.storeId,
        selectedIncomeTypeId: defaultSettings.incomeTypeId,
        selectedExpenseTypeId: defaultSettings.expenseTypeId
      });
    }
  },
  // 添加保存默认设置的方法
  saveDefaultSettings: function() {
    // 保存设置到本地缓存
    wx.setStorageSync('defaultAccountSettings', {
      storeId: this.data.selectedStore ? this.data.selectedStore.id : '',
      incomeTypeId: this.data.selectedIncomeType ? this.data.selectedIncomeType.id : '',
      expenseTypeId: this.data.selectedExpenseType ? this.data.selectedExpenseType.id : ''
    });
    
    // 显示保存成功提示
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 2000
    });
  }
})
