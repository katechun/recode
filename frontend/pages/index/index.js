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
    selectedStoreId: 0,
    selectedStoreName: '',
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
    defaultExpenseTypeId: '',
    selectedStore: null,        // 添加选中的店铺对象
    selectedStoreName: '',      // 添加选中的店铺名称
    selectedIncomeType: null,   // 添加选中的收入类型对象
    selectedExpenseType: null,  // 添加选中的支出类型对象
    income: 0,
    expense: 0,
    profit: 0,
    showAccountDetail: false,
    currentAccount: null,
    todayDateStr: '',
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
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ 
        userInfo: userInfo,
        isLoading: true 
      });
      
      // 优化异常处理
      this.getStores()
        .then(() => {
          // 获取其他数据
          return Promise.all([
            this.getStatistics(),
            this.getRecentAccounts()
          ]);
        })
        .then(() => {
          this.setData({ isLoading: false });
        })
        .catch(err => {
          console.error('数据加载失败:', err);
          wx.showToast({
            title: '数据加载失败，请重试',
            icon: 'none'
          });
          this.setData({ isLoading: false });
        });
    } else {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }

    // 检查状态是否变化
    this.checkStateChange();
    
    // 设置今日日期字符串
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.setData({
      todayDateStr: `${year}-${month}-${day}`
    });
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
    const dateOptions = this.data.dateOptions;
    
    const periods = ['day', 'week', 'month', 'year'];
    const period = periods[index];
    
    this.setData({
      dateRange: dateOptions[index],
      isLoading: true
    });
    
    // 根据选择的日期范围获取统计数据
    wx.request({
      url: `${config.apiBaseUrl}/api/accounts/statistics`,
      method: 'GET',
      data: {
        store_id: this.data.selectedStoreId,
        period: period
      },
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        this.setData({ isLoading: false });
        if (res.data.code === 200 && res.data.data) {
          const data = res.data.data;
          this.setData({
            totalIncome: data.income || 0,
            totalExpense: data.expense || 0,
            netAmount: data.income - data.expense || 0
          });
        } else {
          console.error('获取统计数据失败:', res.data.message);
          wx.showToast({
            title: '获取统计数据失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({ isLoading: false });
        console.error('请求统计数据失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
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
  getStores: function() {
    return new Promise((resolve, reject) => {
      if (!this.data.userInfo) {
        reject(new Error('用户未登录'));
        return;
      }
      
      wx.request({
        url: `${config.apiBaseUrl}/api/stores`,
        method: 'GET',
        header: {
          'X-User-ID': this.data.userInfo.id
        },
        success: (res) => {
          if (res.data.code === 200) {
            const stores = res.data.data || [];
            
            // 如果有店铺数据
            if (stores.length > 0) {
              // 从本地存储获取默认店铺ID
              const defaultSettings = wx.getStorageSync('defaultAccountSettings') || {};
              const defaultStoreId = defaultSettings.storeId;
              
              // 查找默认店铺或使用第一个店铺
              let selectedStore = null;
              let selectedIndex = 0;
              
              if (defaultStoreId) {
                const index = stores.findIndex(store => store.id === defaultStoreId);
                if (index !== -1) {
                  selectedStore = stores[index];
                  selectedIndex = index;
                }
              }
              
              // 如果没有找到默认店铺，使用第一个
              if (!selectedStore) {
                selectedStore = stores[0];
              }
              
              this.setData({
                stores: stores,
                selectedStoreId: selectedStore.id,
                selectedStoreName: selectedStore.name,
                storeIndex: selectedIndex
              });
              resolve(stores);
            } else {
              this.setData({ 
                stores: [],
                selectedStoreId: 0,
                selectedStoreName: '暂无店铺'
              });
              resolve([]);
            }
          } else {
            console.error('获取店铺列表失败:', res.data.message);
            reject(new Error(res.data.message || '获取店铺列表失败'));
          }
        },
        fail: (err) => {
          console.error('请求店铺列表失败:', err);
          reject(err);
        }
      });
    });
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
    const accountType = e.currentTarget.dataset.type;
    const typeId = accountType === 'income' ? 
                  (this.data.selectedIncomeType ? this.data.selectedIncomeType.id : '') : 
                  (this.data.selectedExpenseType ? this.data.selectedExpenseType.id : '');
    
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?type=${accountType}&storeId=${this.data.selectedStoreId}&typeId=${typeId}`
    });
  },
  // 导航到账目列表页面
  goToAccountList: function() {
    wx.navigateTo({
      url: `/pages/accountList/accountList?storeId=${this.data.selectedStoreId}`
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
    const defaultSettings = wx.getStorageSync('defaultSettings');
    console.log('读取到的默认设置:', defaultSettings);
    
    // 先尝试从服务器获取设置
    request.get(config.apis.settings.get)
      .then(res => {
        console.log('从服务器获取的默认设置:', res.data);
        if (res.data) {
          // 保存到本地
          const settings = {
            storeId: res.data.store_id,
            storeName: '',  // 需要根据ID查找名称
            incomeTypeId: res.data.income_type_id,
            incomeTypeName: '',
            expenseTypeId: res.data.expense_type_id,
            expenseTypeName: ''
          };
          
          wx.setStorageSync('defaultSettings', settings);
          
          // 应用设置
          this.applyDefaultSettings(settings);
        } else if (defaultSettings) {
          // 如果服务器没有设置但本地有，则使用本地设置
          this.applyDefaultSettings(defaultSettings);
        }
      })
      .catch(err => {
        console.error('获取服务器默认设置失败:', err);
        // 出错时使用本地设置
        if (defaultSettings) {
          this.applyDefaultSettings(defaultSettings);
        }
      });
  },
  
  // 新增函数用于应用默认设置
  applyDefaultSettings: function(settings) {
    // 等待店铺和账户类型加载完成
    const checkAndApply = () => {
      if (!this.data.stores || !this.data.incomeTypes || !this.data.expenseTypes) {
        console.log('数据还未加载完成，等待中...');
        setTimeout(checkAndApply, 500);
        return;
      }

      console.log('开始应用默认设置', settings);
      
      // 应用默认店铺
      if (settings.storeId) {
        const storeIndex = this.data.stores.findIndex(
          store => store.id === settings.storeId
        );

        if (storeIndex >= 0) {
          const selectedStore = this.data.stores[storeIndex];
          this.setData({
            selectedStore: selectedStore,
            selectedStoreName: selectedStore.name,
            storeIndex: storeIndex
          });
          console.log('应用默认店铺成功:', selectedStore);
        }
      }

      // 应用默认收入类型
      if (settings.incomeTypeId) {
        const incomeTypeIndex = this.data.incomeTypes.findIndex(
          type => type.id === settings.incomeTypeId
        );

        if (incomeTypeIndex >= 0) {
          const selectedIncomeType = this.data.incomeTypes[incomeTypeIndex];
          this.setData({
            selectedIncomeType: selectedIncomeType,
            incomeTypeIndex: incomeTypeIndex,
            defaultIncomeTypeId: settings.incomeTypeId
          });
          console.log('应用默认收入类型成功:', selectedIncomeType);
        }
      }

      // 应用默认支出类型
      if (settings.expenseTypeId) {
        const expenseTypeIndex = this.data.expenseTypes.findIndex(
          type => type.id === settings.expenseTypeId
        );

        if (expenseTypeIndex >= 0) {
          const selectedExpenseType = this.data.expenseTypes[expenseTypeIndex];
          this.setData({
            selectedExpenseType: selectedExpenseType,
            expenseTypeIndex: expenseTypeIndex,
            defaultExpenseTypeId: settings.expenseTypeId
          });
          console.log('应用默认支出类型成功:', selectedExpenseType);
        }
      }

      console.log('应用默认设置完成');
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
      storeId: this.data.selectedStore.id,
      storeName: this.data.selectedStore.name,
      incomeTypeId: this.data.selectedIncomeType.id,
      incomeTypeName: this.data.selectedIncomeType.name,
      expenseTypeId: this.data.selectedExpenseType.id,
      expenseTypeName: this.data.selectedExpenseType.name
    };
    
    console.log('保存的设置:', settings);

    // 先调用后端接口保存设置
    request.post(config.apis.settings.save, {
      store_id: settings.storeId,
      income_type_id: settings.incomeTypeId,
      expense_type_id: settings.expenseTypeId
    })
    .then(res => {
      // 后端保存成功后，再保存到本地存储
      wx.setStorage({
        key: 'defaultSettings',
        data: settings,
        success: () => {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          this.setData({ 
            showDefaultSettings: false,
            // 更新当前选中的值和名称
            selectedStore: this.data.stores[this.data.storeIndex],
            selectedStoreName: this.data.stores[this.data.storeIndex].name,
            selectedIncomeType: this.data.incomeTypes[this.data.incomeTypeIndex],
            selectedExpenseType: this.data.expenseTypes[this.data.expenseTypeIndex],
            storeIndex: this.data.stores.findIndex(s => s.id === settings.storeId),
            incomeTypeIndex: this.data.incomeTypes.findIndex(t => t.id === settings.incomeTypeId),
            expenseTypeIndex: this.data.expenseTypes.findIndex(t => t.id === settings.expenseTypeId)
          });
        },
        fail: (err) => {
          console.error('本地保存设置失败:', err);
          wx.showToast({
            title: '保存失败',
            icon: 'error'
          });
        }
      });
    })
    .catch(err => {
      console.error('保存设置到服务器失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
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
  },
  getStatistics: function() {
    return new Promise((resolve, reject) => {
      const storeId = this.data.selectedStoreId;
      
      console.log('正在获取统计数据，店铺ID:', storeId, '类型:', typeof storeId);
      
      // 清空现有数据以避免显示旧数据
      this.setData({
        income: 0,
        expense: 0,
        profit: 0,
        totalIncome: 0,
        totalExpense: 0,
        netAmount: 0,
        todayIncome: 0,
        todayExpense: 0
      });
      
      // 确保storeId是整数类型
      const numericStoreId = parseInt(storeId);
      
      // 检查storeId是否为有效数字，如果不是则使用0（全部店铺）
      if (isNaN(numericStoreId) || numericStoreId <= 0) {
        console.log('使用默认店铺ID（所有店铺）');
      }
      
      // 获取月度统计数据
      wx.request({
        url: `${config.apiBaseUrl}/api/accounts/statistics`,
        method: 'GET',
        data: {
          store_id: numericStoreId,
          period: 'month' // 指定获取月度数据
        },
        header: {
          'X-User-ID': this.data.userInfo.id
        },
        success: (res) => {
          console.log('统计数据响应:', res.data);
          
          if (res.data.code === 200 && res.data.data) {
            const data = res.data.data;
            
            // 确保数据为数字类型并格式化
            const income = parseFloat(data.income || 0).toFixed(2);
            const expense = parseFloat(data.expense || 0).toFixed(2);
            const profit = (parseFloat(data.income || 0) - parseFloat(data.expense || 0)).toFixed(2);
            
            this.setData({
              income: income,
              expense: expense,
              profit: profit,
              // 同时更新前端显示变量
              totalIncome: income,
              totalExpense: expense,
              netAmount: profit
            });
            
            console.log('格式化后的统计数据:', {
              income: income,
              expense: expense,
              profit: profit
            });
            
            // 获取今日统计数据并返回原始月度数据
            this.getTodayStatistics(numericStoreId)
              .then(() => resolve(data))
              .catch(() => resolve(data)); // 即使今日数据获取失败，也返回月度数据
          } else {
            console.error('获取统计数据失败:', res.data.message);
            reject(new Error(res.data.message || '获取统计数据失败'));
          }
        },
        fail: (err) => {
          console.error('请求统计数据失败:', err);
          reject(err);
        }
      });
    });
  },
  getTodayStatistics: function(storeId) {
    return new Promise((resolve, reject) => {
      console.log('正在获取今日统计数据，店铺ID:', storeId);
      
      // 确保storeId是整数类型
      const numericStoreId = parseInt(storeId);
      
      wx.request({
        url: `${config.apiBaseUrl}/api/accounts/statistics`,
        method: 'GET',
        data: {
          store_id: numericStoreId,
          period: 'day' // 指定获取今日数据
        },
        header: {
          'X-User-ID': this.data.userInfo.id
        },
        success: (res) => {
          console.log('今日统计数据响应:', res.data);
          
          if (res.data.code === 200 && res.data.data) {
            const data = res.data.data;
            
            // 确保数据为数字类型并格式化
            const todayIncome = parseFloat(data.income || 0).toFixed(2);
            const todayExpense = parseFloat(data.expense || 0).toFixed(2);
            
            this.setData({
              todayIncome: todayIncome,
              todayExpense: todayExpense
            });
            
            console.log('格式化后的今日数据:', {
              todayIncome: todayIncome,
              todayExpense: todayExpense
            });
            
            resolve(data);
          } else {
            console.error('获取今日统计数据失败:', res.data.message);
            // 这里只记录错误但不拒绝Promise，确保主流程继续
            resolve({});
          }
        },
        fail: (err) => {
          console.error('请求今日统计数据失败:', err);
          // 这里只记录错误但不拒绝Promise，确保主流程继续
          resolve({});
        }
      });
    });
  },
  getRecentAccounts: function() {
    return new Promise((resolve, reject) => {
      const storeId = this.data.selectedStoreId;
      
      console.log('正在获取近期账务，店铺ID:', storeId);
      
      // 确保storeId是整数类型
      const numericStoreId = parseInt(storeId);
      
      // 清空现有数据以避免显示旧数据
      this.setData({
        recentAccounts: []
      });
      
      wx.request({
        url: `${config.apiBaseUrl}/api/accounts`,
        method: 'GET',
        data: {
          store_id: numericStoreId,
          limit: 5  // 只获取最近5条
        },
        header: {
          'X-User-ID': this.data.userInfo.id
        },
        success: (res) => {
          console.log('近期账务响应:', res.data);
          
          if (res.data.code === 200) {
            // 格式化时间显示
            const accounts = res.data.data || [];
            accounts.forEach(account => {
              if (account.create_time) {
                // 保存原始时间用于详情显示
                account.create_time_raw = account.create_time;
                // 将完整时间格式化为"MM-DD HH:MM"格式
                const dateObj = new Date(account.create_time);
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                account.create_time = `${month}-${day} ${hours}:${minutes}`;
              } else {
                account.create_time = '';
              }
            });
            
            this.setData({
              recentAccounts: accounts
            });
            resolve(res.data.data);
          } else {
            console.error('获取最近账务失败:', res.data.message);
            reject(new Error(res.data.message || '获取最近账务失败'));
          }
        },
        fail: (err) => {
          console.error('请求最近账务失败:', err);
          reject(err);
        }
      });
    });
  },
  storeChange: function(e) {
    const index = e.detail.value;
    const selectedStore = this.data.stores[index];
    
    console.log('切换到店铺:', selectedStore);
    
    // 检查店铺数据有效性
    if (!selectedStore) {
      wx.showToast({
        title: '店铺数据无效',
        icon: 'none'
      });
      return;
    }
    
    // 对于"全部店铺"选项特殊处理
    const storeId = selectedStore.id === '' ? 0 : selectedStore.id;
    
    // 设置加载状态
    this.setData({
      isLoading: true,
      selectedStoreId: storeId,
      selectedStoreName: selectedStore.name
    });
    
    // 清空现有统计数据，避免显示旧数据
    this.setData({
      income: 0,
      expense: 0,
      profit: 0,
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      todayIncome: 0,
      todayExpense: 0,
      recentAccounts: []
    });
    
    // 强制组件刷新，确保数据变化会重新渲染
    setTimeout(() => {
      // 先获取统计数据，再获取最近账务，避免并行请求可能造成的问题
      this.getStatistics()
        .then(() => {
          return this.getRecentAccounts();
        })
        .then(() => {
          console.log('数据更新完成，统计数据:', {
            totalIncome: this.data.totalIncome,
            totalExpense: this.data.totalExpense,
            netAmount: this.data.netAmount,
            todayIncome: this.data.todayIncome,
            todayExpense: this.data.todayExpense
          });
          this.setData({ isLoading: false });
          
          // 再次强制更新
          this.setData({
            forceUpdate: Date.now()
          });
        })
        .catch(err => {
          console.error('数据更新失败:', err);
          wx.showToast({
            title: '数据加载失败',
            icon: 'none'
          });
          this.setData({ isLoading: false });
        });
    }, 100);
  },
  // 显示账目详情
  showAccountDetail: function(e) {
    const account = e.currentTarget.dataset.account;
    
    // 格式化完整时间显示
    if (account.create_time_full === undefined && account.create_time) {
      const dateObj = new Date(account.create_time_raw || account.create_time);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      account.create_time_full = `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    
    this.setData({
      showAccountDetail: true,
      currentAccount: account
    });
  },
  // 隐藏账目详情
  hideAccountDetail: function() {
    this.setData({
      showAccountDetail: false,
      currentAccount: null
    });
  },
  // 编辑账目
  editAccount: function() {
    const account = this.data.currentAccount;
    if (!account) return;
    
    this.hideAccountDetail();
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?id=${account.id}&edit=true`
    });
  },
  // 删除账目
  deleteAccount: function() {
    const account = this.data.currentAccount;
    if (!account) return;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记账记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          });
          
          wx.request({
            url: `${config.apiBaseUrl}/api/accounts/${account.id}`,
            method: 'DELETE',
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
                
                // 刷新数据
                this.hideAccountDetail();
                this.getStatistics();
                this.getRecentAccounts();
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
                title: '网络错误',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },
})
