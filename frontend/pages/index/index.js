// index.js
import request from '../../utils/request';
import config from '../../config/config';

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
    incomeTypeIndex: -1,
    expenseTypeIndex: -1,
    showDefaultSettings: false,
    isLoading: false,
    loadError: '',
    lastRefreshTime: 0,
    refreshInterval: 5 * 60 * 1000, // 5分钟刷新一次
    isRefreshing: false,
    isFirstLoad: true,
    defaultIncomeTypeId: '',
    defaultExpenseTypeId: ''
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
  onLoad(options) {
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

    // 清理缓存
    this.cleanupCache();

    // 设置3秒后隐藏骨架屏
    setTimeout(() => {
      this.setData({ isFirstLoad: false });
    }, 3000);
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

    request.get(config.apis.stores.list)
      .then(res => {
        const stores = [{ id: '', name: '全部店铺' }, ...res.data];
        this.setData({ stores });
      })
      .catch(err => {
        console.error('获取店铺失败:', err);
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

    request.get(config.apis.accounts.statistics, {
      params: {
        store_id: this.data.selectedStoreId,
        start_date: startDate,
        end_date: endDate
      }
    })
      .then(res => {
        const stats = res.data;
        this.setData({
          totalIncome: stats.total_income.toFixed(2),
          totalExpense: stats.total_expense.toFixed(2),
          netAmount: stats.net_amount.toFixed(2)
        });
      })
      .catch(err => {
        console.error('获取统计数据失败:', err);
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

    request.get(config.apis.accounts.list, {
      params: {
        store_id: this.data.selectedStoreId,
        start_date: startDate,
        end_date: endDate,
        limit: 10
      }
    })
    .then(res => {
      if (res.data) {
        // 格式化数据用于显示
        const formattedRecords = res.data.map(record => ({
          ...record,
          amount: record.amount.toFixed(2),
          create_time: this.formatDateTime(new Date(record.transaction_time))
        }));
        
        this.setData({ 
          recentAccounts: formattedRecords
        });
      }
    })
    .catch(err => {
      console.error('获取最近记录失败:', err);
    });
  },
  // 添加日期时间格式化方法
  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },
  // 跳转到记账页面
  goToAccount: function () {
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
      fail: function (err) {
        console.error('导航到记账页面失败:', err);
        wx.showToast({
          title: '页面跳转失败: ' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },
  // 跳转到店铺管理
  goToStoreManage: function () {
    wx.navigateTo({
      url: '/pages/storeManage/storeManage',
    });
  },
  // 跳转到用户管理
  goToUserManage: function () {
    wx.navigateTo({
      url: '/pages/userManage/userManage',
    });
  },
  // 跳转到账务类型管理
  goToAccountType: function () {
    wx.navigateTo({
      url: '/pages/accountType/accountType',
    });
  },
  // 退出登录
  logout: function () {
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
  quickAddAccount: function (e) {
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
      fail: function (err) {
        console.error('导航失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  // 添加这个函数确保选择默认值
  selectDefaultValues: function () {
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
  getAccountTypes: function () {
    request.get(config.apis.accountTypes.list)
      .then(res => {
        if (res.data) {
          // 分离收入和支出类型
          const incomeTypes = res.data.filter(type => !type.is_expense);
          const expenseTypes = res.data.filter(type => type.is_expense);
          
          // 查找默认选中的类型
          const selectedIncomeType = incomeTypes.find(t => t.id === this.data.defaultIncomeTypeId);
          const selectedExpenseType = expenseTypes.find(t => t.id === this.data.defaultExpenseTypeId);
          
          // 设置索引，如果没有找到对应类型则设为0
          const incomeTypeIndex = selectedIncomeType ? 
            incomeTypes.findIndex(t => t.id === this.data.defaultIncomeTypeId) : 
            (incomeTypes.length > 0 ? 0 : -1);
          
          const expenseTypeIndex = selectedExpenseType ? 
            expenseTypes.findIndex(t => t.id === this.data.defaultExpenseTypeId) : 
            (expenseTypes.length > 0 ? 0 : -1);
          
          this.setData({
            incomeTypes,
            expenseTypes,
            incomeTypeIndex,
            expenseTypeIndex,
            // 如果没有找到默认类型，则选择第一个
            selectedIncomeType: selectedIncomeType || (incomeTypes.length > 0 ? incomeTypes[0] : null),
            selectedExpenseType: selectedExpenseType || (expenseTypes.length > 0 ? expenseTypes[0] : null)
          });
        }
      })
      .catch(err => {
        console.error('获取账务类型失败:', err);
      });
  },
  getUserInfo: function () {
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
  getStores: function () {
    // 获取店铺列表
    this.loadStores();
  },
  bindStoreChange: function (e) {
    const index = e.detail.value;
    if (index >= 0 && this.data.stores.length > index) {
      this.setData({
        selectedStore: this.data.stores[index],
        storeIndex: index
      });

      // 自动保存到临时数据，无需用户手动保存
      this.updateTempSettings();

      // 提供视觉反馈
      wx.vibrateShort({
        type: 'light'
      });
    }
  },
  bindIncomeTypeChange: function (e) {
    const index = parseInt(e.detail.value);
    const selectedType = this.data.incomeTypes[index];
    this.setData({
      incomeTypeIndex: index,
      selectedIncomeType: selectedType,
      defaultIncomeTypeId: selectedType.id
    });
  },
  bindExpenseTypeChange: function (e) {
    const index = parseInt(e.detail.value);
    const selectedType = this.data.expenseTypes[index];
    this.setData({
      expenseTypeIndex: index,
      selectedExpenseType: selectedType,
      defaultExpenseTypeId: selectedType.id
    });
  },
  // 添加临时设置保存方法
  updateTempSettings: function () {
    this.data._tempSettings = {
      storeId: this.data.selectedStore ? this.data.selectedStore.id : '',
      incomeTypeId: this.data.selectedIncomeType ? this.data.selectedIncomeType.id : '',
      expenseTypeId: this.data.selectedExpenseType ? this.data.selectedExpenseType.id : '',
    };
  },
  // 改进记账跳转，传递默认设置
  goToAddAccount: function (e) {
    // 获取用户点击的类型，收入或支出
    const type = e.currentTarget.dataset.type;
    
    // 获取默认设置
    const defaultSettings = wx.getStorageSync('defaultSettings');
    
    // 如果没有默认设置，提示用户设置
    if (!defaultSettings || 
      !defaultSettings.storeId ||
      (type === 'income' && !defaultSettings.incomeTypeId) ||
      (type === 'expense' && !defaultSettings.expenseTypeId)) {

      // 提示用户先设置默认参数
      wx.showModal({
        title: '提示',
        content: '请先设置记账默认参数',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.showDefaultSettings();
          }
        }
      });
      return;
    }

    // 从默认设置中获取正确的类型ID
    const typeId = type === 'income'
      ? defaultSettings.incomeTypeId
      : defaultSettings.expenseTypeId;

    // 带上默认参数跳转
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${defaultSettings.storeId}&typeId=${typeId}&type=${type}&isDefault=true`
    });
  },
  // 显示默认设置弹窗
  showDefaultSettings: function () {
    console.log('打开记账默认设置弹窗');
    this.setData({
      showDefaultSettings: true
    });
  },
  // 关闭默认设置弹窗
  closeDefaultSettings: function () {
    console.log('关闭记账默认设置弹窗');
    this.setData({
      showDefaultSettings: false
    });

    // 保存设置
    this.saveDefaultSettings();
  },
  // 阻止事件冒泡
  stopPropagation: function () {
    // 什么都不做，只阻止事件传递
  },
  // 修改加载默认设置的方法
  loadDefaultSettings: function () {
    // 先清空当前选择
    this.setData({
      selectedStore: null,
      selectedIncomeType: null,
      selectedExpenseType: null
    });

    const defaultSettings = wx.getStorageSync('defaultSettings');
    console.log('读取到的默认设置:', defaultSettings);
    if (!defaultSettings) return;

    // 等待店铺和账户类型加载完成
    const checkAndApply = () => {
      if (!this.data.stores || !this.data.incomeTypes || !this.data.expenseTypes) {
        // 如果数据还没加载完成，延迟500ms后再检查
        setTimeout(checkAndApply, 500);
        return;
      }

      // 应用默认店铺
      if (defaultSettings.storeId) {
        const storeIndex = this.data.stores.findIndex(
          store => store.id === defaultSettings.storeId
        );

        console.log('找到的店铺索引:', storeIndex);
        if (storeIndex >= 0) {
          this.setData({
            selectedStore: this.data.stores[storeIndex],
            storeIndex: storeIndex
          });
        }
      }

      // 应用默认收入类型
      if (defaultSettings.incomeTypeId) {
        const incomeTypeIndex = this.data.incomeTypes.findIndex(
          type => type.id === defaultSettings.incomeTypeId
        );

        if (incomeTypeIndex >= 0) {
          this.setData({
            selectedIncomeType: this.data.incomeTypes[incomeTypeIndex],
            incomeTypeIndex: incomeTypeIndex
          });
        }
      }

      // 应用默认支出类型
      if (defaultSettings.expenseTypeId) {
        const expenseTypeIndex = this.data.expenseTypes.findIndex(
          type => type.id === defaultSettings.expenseTypeId
        );

        if (expenseTypeIndex >= 0) {
          this.setData({
            selectedExpenseType: this.data.expenseTypes[expenseTypeIndex],
            expenseTypeIndex: expenseTypeIndex
          });
        }
      }
    };

    // 开始检查
    checkAndApply();
  },
  // 修改保存默认设置的方法
  saveDefaultSettings: function () {
    // 确保所有必要的数据都存在
    if (!this.data.selectedStore || !this.data.selectedIncomeType || !this.data.selectedExpenseType) {
      wx.showToast({
        title: '请选择完整设置',
        icon: 'none'
      });
      return;
    }

    const settings = {
      storeId: this.data.selectedStore ? this.data.selectedStore.id : '',
      incomeTypeId: this.data.selectedIncomeType ? this.data.selectedIncomeType.id : '',
      expenseTypeId: this.data.selectedExpenseType ? this.data.selectedExpenseType.id : ''
    };
    
    console.log('保存的设置:', settings);

    // 保存到本地存储
    wx.setStorage({
      key: 'defaultSettings',
      data: settings,
      success: () => {
        // 重新加载默认设置以验证
        this.loadDefaultSettings();
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        this.setData({ showDefaultSettings: false });
      },
      fail: (err) => {
        console.error('保存设置失败:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'error'
        });
      }
    });
  },
  // 添加刷新数据的方法
  refreshData: function () {
    const now = new Date().getTime();
    if (now - this.data.lastRefreshTime < this.data.refreshInterval) {
      return;
    }

    this.setData({ isLoading: true, loadError: '' });

    Promise.all([
      this.loadStores(),
      this.getAccountTypes(),
      this.loadRecentRecords()
    ]).then(() => {
      this.setData({
        lastRefreshTime: now,
        isLoading: false
      });
    }).catch(err => {
      console.error('刷新数据失败:', err);
      this.setData({
        loadError: '加载数据失败，请稍后重试',
        isLoading: false
      });
    });
  },
  // 添加下拉刷新方法
  onPullRefresh: function () {
    this.setData({ isRefreshing: true });

    // 使用现有的刷新方法加载数据
    Promise.all([
      this.loadStores(),
      this.getAccountTypes(),
      this.loadRecentRecords()
    ]).then(() => {
      this.setData({
        lastRefreshTime: new Date().getTime(),
        isRefreshing: false
      });
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }).catch(err => {
      console.error('刷新数据失败:', err);
      this.setData({
        loadError: '刷新失败，请稍后重试',
        isRefreshing: false
      });
      wx.showToast({
        title: '刷新失败',
        icon: 'error',
        duration: 1000
      });
    });
  },
  cleanupCache: function () {
    try {
      const cacheTime = wx.getStorageSync('cacheLastCleanTime') || 0;
      const now = new Date().getTime();

      // 30天清理一次缓存
      if (now - cacheTime > 30 * 24 * 60 * 60 * 1000) {
        // 只清理不必要的缓存数据，保留用户登录信息和默认设置
        const keysToKeep = ['userInfo', 'defaultAccountSettings'];

        wx.getStorageInfo({
          success: (res) => {
            const allKeys = res.keys;

            allKeys.forEach(key => {
              if (!keysToKeep.includes(key)) {
                wx.removeStorage({ key });
              }
            });

            wx.setStorageSync('cacheLastCleanTime', now);
            console.log('缓存清理完成');
          }
        });
      }
    } catch (e) {
      console.error('缓存清理出错:', e);
    }
  }
})
