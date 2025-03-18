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
    defaultExpenseTypeId: '',
    selectedStore: null,        // 添加选中的店铺对象
    selectedStoreName: '',      // 添加选中的店铺名称
    selectedIncomeType: null,   // 添加选中的收入类型对象
    selectedExpenseType: null,  // 添加选中的支出类型对象
    currentStoreId: '', // 添加当前店铺ID属性
    isLoadingStoreData: false, // 添加标记防止数据覆盖
    currentAccount: null,
    showDetailModal: false,
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

    // 获取当前选中的店铺ID
    const currentStoreId = wx.getStorageSync('currentStoreId') || '';
    this.setData({
      currentStoreId: currentStoreId
    });

    // 加载数据
    this.loadPageData();
  },
  onShow() {
    // 检查userInfo是否存在
    if (this.data.userInfo) {
      // 避免自动加载覆盖店铺特定数据
      if (this.data.isLoadingStoreData !== true) {
        console.log('页面显示，加载常规数据');
        this.loadStatistics();
        this.loadRecentRecords();
      } else {
        console.log('跳过常规数据加载，因为店铺数据正在加载中');
      }
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

    // 检查店铺是否已切换
    this.checkStoreChanged();

    // 如果没有选择店铺ID，使用默认值
    if (!this.data.currentStoreId) {
      const defaultStoreId = wx.getStorageSync('defaultSettings')?.storeId || '';
      if (defaultStoreId) {
        this.setData({ currentStoreId: defaultStoreId });
        wx.setStorageSync('currentStoreId', defaultStoreId);
        this.loadPageData();
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
        // 后端已经过滤了权限，这里直接使用返回的结果
        // 为店铺列表添加"全部店铺"选项
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

    console.log('开始切换店铺:', selectedStoreName, '(ID:', selectedStoreId, ')');

    // 设置标记，防止onShow覆盖数据
    this.setData({ isLoadingStoreData: true });

    // 保存当前选择的店铺ID到本地存储
    wx.setStorageSync('currentStoreId', selectedStoreId);

    // 显示加载提示
    wx.showLoading({
      title: '加载数据中...',
      mask: true
    });

    // 更新页面数据
    this.setData({
      selectedStoreId,
      selectedStoreName,
      currentStoreId: selectedStoreId,
      storePickerVisible: false
    });

    // 清空当前数据
    this.setData({
      todayData: {
        income: '0.00',
        expense: '0.00',
        profit: '0.00'
      },
      recentAccounts: [],
      totalIncome: '0.00',
      totalExpense: '0.00',
      netAmount: '0.00'
    });

    // 重新请求所有数据
    Promise.all([
      this.requestStoreStatistics(selectedStoreId),
      this.requestTodayData(selectedStoreId),
      this.requestRecentAccounts(selectedStoreId)
    ])
      .then((results) => {
        wx.hideLoading();
        // 显示更详细的完成信息
        console.log('============店铺数据更新结果============');
        console.log('月度数据:', results[0]);
        console.log('今日数据:', results[1]);
        console.log('账目数据:', results[2]?.length || 0, '条记录');

        wx.showToast({
          title: '数据已更新',
          icon: 'success'
        });

        // 移除标记
        this.setData({ isLoadingStoreData: false });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '更新失败',
          icon: 'error'
        });
        console.error('店铺切换数据更新失败:', err);

        // 移除标记
        this.setData({ isLoadingStoreData: false });
      });
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  // 加载统计数据
  loadStatistics() {
    const startDate = this.getStartDateByRange(this.data.dateRange);

    const params = {
      start_date: startDate,
    };

    if (this.data.selectedStoreId) {
      params.store_id = this.data.selectedStoreId;
    }

    // 用户ID已经在request工具函数中添加了
    request.get(config.apis.accounts.statistics, params)
      .then(res => {
        if (res.code === 200 && res.data) {
          this.setData({
            totalIncome: this.formatAmount(res.data.total_income || 0),
            totalExpense: this.formatAmount(res.data.total_expense || 0),
            netAmount: this.formatAmount(res.data.net_amount || 0)
          });
        }
      })
      .catch(err => {
        console.error('获取统计数据失败:', err);
      });
  },
  // 加载最近记账记录
  loadRecentRecords() {
    const params = {
      limit: 5, // 只获取最近5条记录
      start_date: this.getStartDateByRange(this.data.dateRange),
    };

    if (this.data.selectedStoreId) {
      params.store_id = this.data.selectedStoreId;
    }

    // 用户ID已经在request工具函数中添加了
    request.get(config.apis.accounts.list, params)
      .then(res => {
        if (!res.data || !res.data.data || !Array.isArray(res.data.data)) {
          this.setData({ recentRecords: [] });
          return;
        }

        // 处理数据...
      })
      .catch(err => {
        console.error('获取最近账目失败:', err);
        this.setData({ recentRecords: [] });
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
  navigateToAccounting: function () {
    wx.navigateTo({
      url: '/pages/logs/logs'
    })
  },
  // 添加收入跳转
  navigateToIncome: function () {
    wx.navigateTo({
      url: '/pages/accountList/accountList?showAdd=true&type=income'
    });
  },
  // 添加支出跳转
  navigateToExpense: function () {
    wx.navigateTo({
      url: '/pages/accountList/accountList?showAdd=true&type=expense'
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
  // 修改添加账目的方法
  goToAddAccount: function (e) {
    // 检查是否已选择店铺和账务类型
    if (!this.data.selectedStore || !this.data.selectedStore.id) {
      wx.showToast({
        title: '请先选择店铺',
        icon: 'none'
      });
      return;
    }

    // 获取类型：收入或支出
    const type = e.currentTarget.dataset.type;

    // 根据类型选择默认的类型ID
    let typeId = '';
    if (type === 'income' && this.data.selectedIncomeType && this.data.selectedIncomeType.id) {
      typeId = this.data.selectedIncomeType.id;
      console.log('使用默认收入类型:', this.data.selectedIncomeType.name, '(ID:', typeId, ')');
    } else if (type === 'expense' && this.data.selectedExpenseType && this.data.selectedExpenseType.id) {
      typeId = this.data.selectedExpenseType.id;
      console.log('使用默认支出类型:', this.data.selectedExpenseType.name, '(ID:', typeId, ')');
    }

    // 跳转到添加账目页面
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${this.data.selectedStore.id}&typeId=${typeId}&type=${type}&isDefault=true`,
      fail: function (err) {
        console.error('导航到记账页面失败:', err);
        wx.showToast({
          title: '页面跳转失败: ' + err.errMsg,
          icon: 'none'
        });
      }
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
  applyDefaultSettings: function (settings) {
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
  // 检查店铺是否已切换
  checkStoreChanged: function () {
    const currentStoreId = wx.getStorageSync('currentStoreId') || '';

    // 如果店铺ID变化，则重新加载数据
    if (currentStoreId !== this.data.currentStoreId) {
      console.log('店铺已切换，从', this.data.currentStoreId, '到', currentStoreId);
      this.setData({
        currentStoreId: currentStoreId
      });

      // 重新加载页面数据
      this.loadPageData();
    }
  },
  // 加载页面数据（今日数据和最近账目）
  loadPageData: function () {
    // 清空之前的数据
    this.setData({
      todayData: {
        income: '0.00',
        expense: '0.00',
        profit: '0.00'
      },
      recentAccounts: [],
      // 同时清空月度统计
      totalIncome: '0.00',
      totalExpense: '0.00',
      netAmount: '0.00'
    });

    // 根据当前店铺ID加载今日数据
    this.loadTodayData();

    // 根据当前店铺ID加载最近账目
    this.loadRecentAccounts();

    // 加载月度统计数据 - 添加这一行
    this.loadStatistics();
  },

  // 加载今日数据
  loadTodayData: function () {
    const storeId = this.data.currentStoreId;
    console.log('加载店铺ID为', storeId, '的今日数据');

    // 使用项目中已有的API获取今日数据
    const now = new Date();
    const today = this.formatDate(now);

    // 确定API请求参数
    const params = {
      start_date: today,
      end_date: today
    };

    // 只有当选择了特定店铺时才添加店铺过滤
    if (storeId) {
      params.store_id = storeId;
    }

    request.get(config.apis.accounts.statistics, { params })
      .then(res => {
        const stats = res.data;
        this.setData({
          todayData: {
            income: stats.total_income.toFixed(2),
            expense: stats.total_expense.toFixed(2),
            net: stats.net_amount.toFixed(2)
          },
          totalIncome: stats.total_income.toFixed(2),
          totalExpense: stats.total_expense.toFixed(2),
          netAmount: stats.net_amount.toFixed(2)
        });
        console.log('今日数据加载成功，店铺:', this.data.selectedStoreName || '全部');
      })
      .catch(err => {
        console.error('获取今日数据失败:', err);
      });
  },

  // 加载最近账目
  loadRecentAccounts: function () {
    const storeId = this.data.currentStoreId;
    console.log('加载店铺ID为', storeId, '的最近账目');

    // 确定API请求参数
    const params = {
      limit: 10
    };

    // 只有当选择了特定店铺时才添加店铺过滤
    if (storeId) {
      params.store_id = storeId;
    }

    request.get(config.apis.accounts.list, { params })
      .then(res => {
        if (res.data && res.data.data) {
          // 格式化数据用于显示
          let formattedRecords = res.data.data.map(record => ({
            ...record,
            amount: record.amount.toFixed(2),
            create_time: this.formatDateTime(new Date(record.transaction_time))
          }));

          // 如果服务器没有按店铺过滤，在前端再次过滤
          if (storeId && storeId !== '') {
            formattedRecords = formattedRecords.filter(record =>
              record.store_id === storeId || record.store_id === parseInt(storeId)
            );
          }

          this.setData({
            recentAccounts: formattedRecords
          });
          console.log('最近账目加载成功，共', formattedRecords.length, '条记录');
        } else {
          this.setData({
            recentAccounts: []
          });
        }
      })
      .catch(err => {
        console.error('获取最近账目失败:', err);
        this.setData({
          recentAccounts: []
        });
      });
  },

  // 新增函数：专门请求店铺统计数据
  requestStoreStatistics(storeId) {
    console.log('请求店铺统计数据, ID:', storeId);

    const { startDate, endDate } = this.getDateRange();

    // 直接构建URL查询字符串，确保参数能被后端读取
    let url = `${config.apis.accounts.statistics}?start_date=${startDate}&end_date=${endDate}`;

    // 只有在有特定店铺ID时才添加店铺参数
    if (storeId !== undefined && storeId !== null && storeId !== '') {
      const parsedId = parseInt(storeId);
      url += `&store_id=${parsedId}`;
      console.log(`添加店铺过滤，URL中包含store_id参数: ${parsedId}`);
    }

    console.log('完整请求URL:', url);

    return new Promise((resolve, reject) => {
      // 直接使用构建的URL，不再使用params对象
      request.get(url)
        .then(res => {
          console.log('统计API完整响应:', JSON.stringify(res.data));

          const stats = res.data;
          if (stats && typeof stats.total_income !== 'undefined') {
            console.log(`店铺ID ${storeId || '全部'} 的统计数据: 收入=${stats.total_income}, 支出=${stats.total_expense}`);

            this.setData({
              totalIncome: parseFloat(stats.total_income).toFixed(2),
              totalExpense: parseFloat(stats.total_expense).toFixed(2),
              netAmount: parseFloat(stats.net_amount).toFixed(2)
            });
            resolve(stats);
          } else {
            console.error('无效的统计数据响应:', stats);
            reject(new Error('无效的统计数据'));
          }
        })
        .catch(err => {
          console.error('获取店铺统计数据失败:', err);
          reject(err);
        });
    });
  },

  // 修改requestTodayData函数，统一数据格式和处理方式
  requestTodayData(storeId) {
    console.log('请求今日数据, 店铺ID:', storeId);

    const now = new Date();
    const today = this.formatDate(now);

    // 使用后端理解的准确时间格式
    const startTime = `${today} 00:00:00`;
    const endTime = `${today} 23:59:59`;

    // 添加调试信息
    console.log('今日数据时间范围:', startTime, '至', endTime);

    // 构建URL
    let url = `${config.apis.accounts.statistics}?start_date=${today}&end_date=${today}`;

    // 明确添加店铺ID
    if (storeId !== undefined && storeId !== null && storeId !== '') {
      url += `&store_id=${storeId}`;
      console.log(`今日数据请求包含店铺ID: ${storeId}`);
    } else {
      console.log('今日数据请求不包含店铺ID，将获取所有店铺数据');
    }

    console.log('今日数据完整请求URL:', url);

    return new Promise((resolve, reject) => {
      request.get(url)
        .then(res => {
          console.log('今日数据API响应:', JSON.stringify(res.data));

          const stats = res.data || { total_income: 0, total_expense: 0, net_amount: 0 };

          // 确保数据为数字且转为两位小数
          const todayData = {
            income: this.formatAmount(stats.total_income),
            expense: this.formatAmount(stats.total_expense),
            net: this.formatAmount(stats.net_amount)
          };

          // 同时更新两种数据格式，保证兼容性
          this.setData({
            todayData,
            todayIncome: todayData.income,
            todayExpense: todayData.expense
          });

          // 输出红框内将要显示的数据
          console.log(`今日数据更新成功: 收入=${todayData.income}, 支出=${todayData.expense}, 净额=${todayData.net}`);
          resolve(stats);
        })
        .catch(err => {
          console.error('获取今日数据失败:', err);

          // 出错时显示零值
          const defaultData = {
            income: '0.00',
            expense: '0.00',
            net: '0.00'
          };

          this.setData({
            todayData: defaultData,
            todayIncome: defaultData.income,
            todayExpense: defaultData.expense
          });

          reject(err);
        });
    });
  },

  // 同样修改最近账目请求函数
  requestRecentAccounts(storeId) {
    console.log('请求最近账目, 店铺ID:', storeId);

    // 直接构建URL查询字符串
    let url = `${config.apis.accounts.list}?limit=10`;

    // 添加店铺ID参数
    if (storeId !== undefined && storeId !== null && storeId !== '') {
      const parsedId = parseInt(storeId);
      url += `&store_id=${parsedId}`;
      console.log(`添加店铺过滤，URL中包含store_id参数: ${parsedId}`);
    }

    console.log('完整请求URL:', url);

    return new Promise((resolve, reject) => {
      request.get(url)
        .then(res => {
          console.log('最近账目API响应:', JSON.stringify(res.data));

          if (res.data && res.data.data && Array.isArray(res.data.data)) {
            // 格式化数据
            let formattedRecords = res.data.data.map(record => ({
              ...record,
              amount: record.amount.toFixed(2),
              create_time: this.formatDateTime(new Date(record.transaction_time))
            }));

            this.setData({
              recentAccounts: formattedRecords
            });
            console.log('最近账目加载成功, 条数:', formattedRecords.length);
            resolve(formattedRecords);
          } else {
            this.setData({
              recentAccounts: []
            });
            resolve([]);
          }
        })
        .catch(err => {
          console.error('获取最近账目失败:', err);
          reject(err);
        });
    });
  },

  // 修改数据展示部分的处理逻辑
  getStatistics: function (storeId = '') {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // 获取今日统计
    request.get(`${config.apis.accounts.statistics}?store_id=${storeId}&start_date=${todayStr}&end_date=${todayStr}`)
      .then(res => {
        // 确保数值正确处理，防止NaN或undefined
        const todayStats = res.data || { total_income: 0, total_expense: 0, net_amount: 0 };

        this.setData({
          todayData: {
            income: parseFloat(todayStats.total_income || 0).toFixed(2),
            expense: parseFloat(todayStats.total_expense || 0).toFixed(2),
            net: parseFloat(todayStats.net_amount || 0).toFixed(2)
          }
        });
      })
      .catch(err => {
        console.error('获取今日统计失败:', err);
        // 发生错误时显示为0
        this.setData({
          todayData: {
            income: '0.00',
            expense: '0.00',
            net: '0.00'
          }
        });
      });

    // 获取本月统计...同样添加错误处理和默认值
  },

  // 优化金额显示的辅助函数
  formatAmount: function (amount) {
    // 处理非数值情况
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }

    // 转为数字并保留两位小数
    return parseFloat(amount).toFixed(2);
  },

  // 获取当月第一天
  getMonthStartDate: function () {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  },

  // 获取本周第一天
  getWeekStartDate: function () {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 将周日的0转为7
    const dayOffset = dayOfWeek - 1; // 周一为本周第一天
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOffset);
    return this.formatDate(monday);
  },

  // 获取本年第一天
  getYearStartDate: function () {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  },

  // 修改navigateToAccountList函数，使用简化日期逻辑
  navigateToAccountList: function () {
    // 获取当前选中的店铺ID
    const storeId = this.data.currentStoreId || '';

    // 准备日期参数
    const now = new Date();
    const today = this.formatDate(now);

    // 获取日期范围参数
    let startDate = today;
    let endDate = today;

    // 根据当前选择的日期范围设置参数
    switch (this.data.dateRange) {
      case '今日':
        // 默认已经设置为today
        break;
      case '本周':
        startDate = this.getWeekStartDate();
        endDate = today;
        break;
      case '本月':
        startDate = this.getMonthStartDate();
        endDate = today;
        break;
      case '本年':
        startDate = this.getYearStartDate();
        endDate = today;
        break;
      default:
        // 默认使用本月
        startDate = this.getMonthStartDate();
        endDate = today;
    }

    // 跳转到账目列表页面，传递筛选参数
    wx.navigateTo({
      url: `/pages/accountList/accountList?storeId=${storeId}&startDate=${startDate}&endDate=${endDate}&title=账务管理`
    });
  },

  // 修改底部TAB点击处理
  handleTabClick: function (e) {
    const tabId = e.currentTarget.dataset.id;

    switch (tabId) {
      case 'home':
        // 首页，不需要跳转
        break;
      case 'account':
        // 跳转到账目列表页
        wx.navigateTo({
          url: '/pages/accountList/accountList'
        });
        break;
      case 'add':
        // 修改为使用与"查看更多"相同的跳转逻辑
        this.navigateToAccountList();
        break;
      case 'statistics':
        // 统计页面
        wx.navigateTo({
          url: '/pages/statistics/statistics'
        });
        break;
      case 'mine':
        // 我的页面
        wx.navigateTo({
          url: '/pages/user/user'
        });
        break;
    }
  },

  // 添加记账选项点击处理
  handleAddOptionClick: function (e) {
    const type = e.currentTarget.dataset.type;

    // 隐藏选项窗口
    this.setData({
      showAddOptions: false
    });

    // 检查是否已选择店铺
    if (!this.data.selectedStore || !this.data.selectedStore.id) {
      wx.showToast({
        title: '请先选择店铺',
        icon: 'none'
      });
      return;
    }

    // 根据类型选择默认的类型ID
    let typeId = '';
    if (type === 'income' && this.data.selectedIncomeType && this.data.selectedIncomeType.id) {
      typeId = this.data.selectedIncomeType.id;
    } else if (type === 'expense' && this.data.selectedExpenseType && this.data.selectedExpenseType.id) {
      typeId = this.data.selectedExpenseType.id;
    }

    // 确保type参数是字符串
    const accountType = type === 'income' ? 'income' : 'expense';

    // 跳转到添加账目页面而不是账目列表页
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${this.data.selectedStore.id}&typeId=${typeId}&type=${accountType}`
    });
  },

  // 修改账目详情处理函数，确保金额正确格式化
  viewAccountDetail: function (e) {
    const accountId = e.currentTarget.dataset.id;
    console.log('查看首页账目详情, ID:', accountId);

    // 从现有数据中查找账目
    const account = this.data.recentAccounts.find(item => item.id === accountId);

    if (account) {
      // 处理金额格式化
      const amountValue = parseFloat(account.amount);
      const formattedAccount = {
        ...account,
        amountValue: amountValue,
        formattedAmount: this.formatAmount(Math.abs(amountValue)),
        isIncome: amountValue >= 0
      };

      // 显示详情弹窗
      this.setData({
        currentAccount: formattedAccount,
        showDetailModal: true
      });
    } else {
      // 如果在本地找不到，发起请求获取详情
      this.loadAccountDetail(accountId);
    }
  },

  // 加载单个账目详情
  loadAccountDetail: function (accountId) {
    wx.showLoading({
      title: '加载中...',
    });

    request.get(`${config.apis.accounts.detail}?id=${accountId}`)
      .then(res => {
        wx.hideLoading();

        if (res.data) {
          const amountValue = parseFloat(res.data.amount);

          // 处理账目数据
          const account = {
            ...res.data,
            amountValue: amountValue,
            formattedAmount: this.formatAmount(Math.abs(amountValue)),
            formattedDate: res.data.transaction_time ? res.data.transaction_time.substring(0, 16).replace('T', ' ') : '',
            isIncome: amountValue >= 0
          };

          // 显示详情弹窗
          this.setData({
            currentAccount: account,
            showDetailModal: true
          });
        } else {
          wx.showToast({
            title: '账目不存在',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载账目详情失败:', err);

        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },

  // 隐藏详情弹窗
  hideDetail: function () {
    this.setData({
      showDetailModal: false
    });
  },

  // 从详情弹窗编辑账目
  editDetailAccount: function () {
    // 隐藏弹窗
    this.hideDetail();

    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?id=${this.data.currentAccount.id}&edit=true`
    });
  },

  // 从详情弹窗删除账目
  deleteDetailAccount: function () {
    // 隐藏弹窗
    this.hideDetail();

    // 确认删除
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条账目记录吗？',
      success: (res) => {
        if (res.confirm) {
          // 用户点击确定，执行删除
          this.deleteAccount(this.data.currentAccount.id);
        }
      }
    });
  },

  // 删除账目
  deleteAccount: function (accountId) {
    wx.showLoading({
      title: '删除中...'
    });

    request.delete(`${config.apis.accounts.delete}?id=${accountId}`)
      .then(res => {
        wx.hideLoading();

        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });

        // 刷新账目列表
        this.loadRecentRecords();
        this.loadStatistics();
      })
      .catch(err => {
        wx.hideLoading();
        console.error('删除账目失败:', err);

        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      });
  },

  // 添加 getStartDateByRange 函数，根据日期范围返回开始日期
  getStartDateByRange: function (range) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    switch (range) {
      case '今日':
        // 返回今天的日期
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      case '本周':
        // 计算本周一的日期
        const currentDay = now.getDay() || 7; // 将周日的0转为7
        const mondayDate = new Date(now);
        mondayDate.setDate(now.getDate() - currentDay + 1);
        return `${mondayDate.getFullYear()}-${(mondayDate.getMonth() + 1).toString().padStart(2, '0')}-${mondayDate.getDate().toString().padStart(2, '0')}`;
      case '本月':
        // 返回本月1号
        return `${year}-${month.toString().padStart(2, '0')}-01`;
      case '本年':
        // 返回本年1月1日
        return `${year}-01-01`;
      default:
        // 默认返回今天
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  },

  navigateToAddAccount: function (type) {
    const storeId = this.data.selectedStore ? this.data.selectedStore.id : '';
    let typeId = '';

    // 确保type参数是有效的字符串
    const accountType = (type === 'income') ? 'income' : 'expense';

    // 根据类型获取对应的默认类型ID
    if (accountType === 'income' && this.data.selectedIncomeType) {
      typeId = this.data.selectedIncomeType.id;
    } else if (accountType === 'expense' && this.data.selectedExpenseType) {
      typeId = this.data.selectedExpenseType.id;
    }

    if (!storeId || !typeId) {
      wx.showToast({
        title: '请先选择店铺和账务类型',
        icon: 'none'
      });
      return;
    }

    // 跳转到记账页面并传递参数
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${storeId}&typeId=${typeId}&type=${accountType}`,
      fail: function (err) {
        console.error('导航失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 快速记账处理函数
  handleQuickRecord: function (e) {
    // 检查是否已选择店铺
    if (!this.data.selectedStore || !this.data.selectedStore.id) {
      wx.showToast({
        title: '请先选择店铺',
        icon: 'none'
      });
      return;
    }

    // 获取类型：收入或支出
    const type = e.currentTarget.dataset.type;

    // 确保type参数是有效的字符串
    const accountType = (type === 'income') ? 'income' : 'expense';

    // 根据类型选择默认的类型ID
    let typeId = '';
    if (accountType === 'income' && this.data.selectedIncomeType && this.data.selectedIncomeType.id) {
      typeId = this.data.selectedIncomeType.id;
      console.log('使用默认收入类型:', this.data.selectedIncomeType.name, '(ID:', typeId, ')');
    } else if (accountType === 'expense' && this.data.selectedExpenseType && this.data.selectedExpenseType.id) {
      typeId = this.data.selectedExpenseType.id;
      console.log('使用默认支出类型:', this.data.selectedExpenseType.name, '(ID:', typeId, ')');
    }

    // 跳转到添加账目页面
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?storeId=${this.data.selectedStore.id}&typeId=${typeId}&type=${accountType}&isDefault=true`,
      fail: function (err) {
        console.error('导航到记账页面失败:', err);
        wx.showToast({
          title: '页面跳转失败: ' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },
})
