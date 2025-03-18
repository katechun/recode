import request from '../../utils/request';
import config from '../../config/config';
import filter from '../../utils/filter';

Page({
  data: {
    accounts: [],
    isLoading: false,
    isRefreshing: false,
    searchKeyword: '',
    // 分页相关
    pageSize: 20,
    currentPage: 1,
    hasMore: true,
    // 筛选相关
    startDate: '',
    endDate: '',
    storeId: '',
    typeId: '',
    minAmount: '',
    maxAmount: '',
    // 数据源
    stores: [],
    accountTypes: [],
    // 显示字段
    selectedStoreName: '全部店铺',
    selectedTypeName: '全部类型',
    // 统计数据
    totalIncome: '0.00',
    totalExpense: '0.00',
    netAmount: '0.00',
    // 状态控制
    showFilterModal: false,
    isFirstLoad: true,
    groupByDate: true,  // 按日期分组显示
    sortOrder: 'desc',  // 默认降序(最新的在前)
    recordCount: 0,     // 记录总数
    shouldShowEmptyState: false,  // 控制空状态显示的标志
    showDetailModal: false,  // 控制详情弹窗显示
    currentAccount: {}       // 当前查看的账目详情
  },

  onLoad: function (options) {
    console.log('账目列表页面接收到参数:', options);

    // 设置页面标题
    if (options.title) {
      wx.setNavigationBarTitle({
        title: options.title
      });
    }

    // 获取存储的筛选设置
    const savedFilter = wx.getStorageSync('accountListFilter') || {};

    // 如果从首页传递了storeId，优先使用
    if (options.storeId) {
      this.setData({
        storeId: options.storeId
      });

      // 获取并设置店铺名称
      this.loadStoreInfo(options.storeId);
    } else if (savedFilter.storeId) {
      // 使用保存的筛选条件
      this.setData({
        storeId: savedFilter.storeId
      });
      this.loadStoreInfo(savedFilter.storeId);
    }

    // 处理日期参数
    if (options.startDate && options.endDate) {
      this.setData({
        startDate: options.startDate,
        endDate: options.endDate
      });
    } else if (savedFilter.startDate && savedFilter.endDate) {
      this.setData({
        startDate: savedFilter.startDate,
        endDate: savedFilter.endDate
      });
    } else {
      // 否则初始化为最近一个月
      this.initDateRange();
    }

    // 恢复保存的其他筛选条件
    if (savedFilter.typeId) {
      this.setData({
        typeId: savedFilter.typeId
      });
    }

    if (savedFilter.minAmount !== undefined) {
      this.setData({
        minAmount: savedFilter.minAmount
      });
    }

    if (savedFilter.maxAmount !== undefined) {
      this.setData({
        maxAmount: savedFilter.maxAmount
      });
    }

    // 检查是否需要直接显示添加界面
    if (options.showAdd === 'true') {
      // 直接跳转到添加记账页面
      this.navigateToAddAccount(options.type || 'expense');
    }

    // 开始3秒后隐藏骨架屏
    setTimeout(() => {
      this.setData({ isFirstLoad: false });
    }, 2000);

    // 加载数据
    this.loadStores();
    this.loadAccountTypes();
    this.loadAccounts(true);
    this.loadStatistics();
  },

  onShow: function () {
    // 页面显示时，检查是否需要刷新数据
    const needRefresh = wx.getStorageSync('accountListNeedRefresh');
    if (needRefresh) {
      this.loadAccounts(true);
      this.loadStatistics();
      wx.removeStorageSync('accountListNeedRefresh');
    }
  },

  // 初始化日期范围为最近一个月
  initDateRange: function () {
    const today = new Date();
    const endDate = this.formatDate(today);

    // 获取一个月前的日期
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    this.setData({
      startDate: this.formatDate(startDate),
      endDate: endDate
    });
  },

  // 格式化日期为YYYY-MM-DD
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载账目列表，添加分组显示
  loadAccounts: function (isRefresh = false) {
    if (isRefresh) {
      this.setData({
        currentPage: 1,
        accounts: []
      });
    }

    // 设置加载状态
    this.setData({ isLoading: true });

    // 构建API请求参数
    const params = {
      page: this.data.currentPage,
      limit: this.data.pageSize,
      start_date: this.data.startDate,
      end_date: this.data.endDate
    };

    // 添加筛选条件
    if (this.data.storeId) {
      params.store_id = this.data.storeId;
    }

    if (this.data.typeId) {
      params.type_id = this.data.typeId;
    }

    if (this.data.searchKeyword) {
      params.keyword = this.data.searchKeyword;
    }

    if (this.data.minAmount) {
      params.min_amount = this.data.minAmount;
    }

    if (this.data.maxAmount) {
      params.max_amount = this.data.maxAmount;
    }

    // 发起请求 - 后端已处理权限过滤
    request.get(config.apis.accounts.list, params)
      .then(res => {
        // 处理返回的数据
        const newAccounts = this.processAccounts(res.data);

        this.setData({
          accounts: isRefresh ? newAccounts : [...this.data.accounts, ...newAccounts],
          isLoading: false,
          isRefreshing: false,
          hasMore: newAccounts.length === this.data.pageSize
        });

        // 增加页码
        this.setData({
          currentPage: this.data.currentPage + 1
        });
      })
      .catch(err => {
        console.error('加载账目失败:', err);
        this.setData({
          isLoading: false,
          isRefreshing: false
        });

        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },

  // 按日期对账目进行分组
  groupAccountsByDate: function (accounts) {
    if (!accounts || accounts.length === 0) {
      this.setData({
        groupedAccounts: []
      });
      return;
    }

    // 按日期分组
    const grouped = {};
    accounts.forEach(account => {
      const date = account.date;
      if (!grouped[date]) {
        grouped[date] = {
          date: date,
          accounts: [],
          dayTotal: 0
        };
      }
      grouped[date].accounts.push(account);
      grouped[date].dayTotal += parseFloat(account.amount);
    });

    // 转为数组并排序
    const groupArray = Object.values(grouped).sort((a, b) => {
      // 按日期排序，最新的在前
      return this.data.sortOrder === 'desc' ?
        (b.date.localeCompare(a.date)) :
        (a.date.localeCompare(b.date));
    });

    this.setData({
      groupedAccounts: groupArray
    });
  },

  // 合并两个分组数据
  mergeGroupedData: function (existing, newGroups) {
    const merged = [...existing];

    newGroups.forEach(newGroup => {
      // 查找是否已存在该日期分组
      const existingIndex = merged.findIndex(group => group.date === newGroup.date);

      if (existingIndex >= 0) {
        // 合并账目数据
        merged[existingIndex].accounts = [
          ...merged[existingIndex].accounts,
          ...newGroup.accounts
        ];
        // 重新计算总额
        merged[existingIndex].dayTotal = merged[existingIndex].accounts.reduce(
          (sum, account) => sum + parseFloat(account.amount), 0
        );
      } else {
        // 添加新分组
        merged.push(newGroup);
      }
    });

    // 重新排序
    return merged.sort((a, b) => {
      if (this.data.sortOrder === 'desc') {
        return new Date(b.date) - new Date(a.date);
      } else {
        return new Date(a.date) - new Date(b.date);
      }
    });
  },

  // 加载店铺列表
  loadStores: function () {
    request.get(config.apis.stores.list)
      .then(res => {
        const storesList = res.data || [];
        // 添加"全部店铺"选项
        const stores = [
          { id: '', name: '全部店铺' },
          ...storesList
        ];

        this.setData({ stores });

        // 如果有店铺ID，设置对应的店铺名称
        if (this.data.storeId) {
          const selectedStore = stores.find(store => store.id == this.data.storeId);
          if (selectedStore) {
            this.setData({
              selectedStoreName: selectedStore.name
            });
          }
        }
      })
      .catch(err => {
        console.error('加载店铺列表失败:', err);
      });
  },

  // 加载账务类型
  loadAccountTypes: function () {
    request.get(config.apis.accountTypes.list)
      .then(res => {
        const typesList = res.data || [];

        // 添加"全部类型"选项
        const accountTypes = [
          { id: '', name: '全部类型' },
          ...typesList
        ];

        this.setData({ accountTypes });

        // 如果有类型ID，设置对应的类型名称
        if (this.data.typeId) {
          const selectedType = accountTypes.find(type => type.id == this.data.typeId);
          if (selectedType) {
            this.setData({
              selectedTypeName: selectedType.name
            });
          }
        }
      })
      .catch(err => {
        console.error('加载账务类型失败:', err);
      });
  },

  // 切换排序顺序
  toggleSortOrder: function () {
    const newOrder = this.data.sortOrder === 'desc' ? 'asc' : 'desc';
    this.setData({
      sortOrder: newOrder
    });

    // 重新加载数据
    this.loadAccounts(true);
  },

  // 切换分组显示
  toggleGroupByDate: function () {
    this.setData({
      groupByDate: !this.data.groupByDate
    });

    // 如果当前启用分组显示，需要处理现有数据
    if (this.data.groupByDate) {
      const groupedData = this.groupAccountsByDate(this.data.accounts);
      this.setData({
        groupedAccounts: groupedData
      });
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.setData({ isRefreshing: true });
    Promise.all([
      this.loadStatistics(),
      this.loadAccounts(true)
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom: function () {
    if (!this.data.isLoading && this.data.hasMore) {
      this.loadAccounts();
    }
  },

  // 添加记账
  navigateToAddAccount: function (type = 'expense') {
    // 确保type参数是有效的字符串
    const accountType = (type === 'income') ? 'income' : 'expense';

    // 获取默认设置
    const defaultSettings = wx.getStorageSync('defaultSettings') || {};

    // 从默认设置或当前选择获取storeId
    const storeId = this.data.storeId || defaultSettings.storeId || '';

    // 获取对应类型的默认typeId
    let typeId = '';
    if (accountType === 'income') {
      typeId = defaultSettings.incomeTypeId || '';
    } else {
      typeId = defaultSettings.expenseTypeId || '';
    }

    // 跳转到添加页面
    wx.navigateTo({
      url: `/pages/addAccount/addAccount?type=${accountType}&storeId=${storeId}&typeId=${typeId}`
    });
  },

  // 编辑记账
  editAccount: function (e) {
    const accountId = e.currentTarget.dataset.id;
    const account = this.findAccountById(accountId);

    if (!account) {
      wx.showToast({
        title: '找不到对应账目',
        icon: 'none'
      });
      return;
    }

    // 确保type参数是字符串
    const type = account.amount >= 0 ? 'income' : 'expense';
    const amount = Math.abs(account.amount);

    wx.navigateTo({
      url: `/pages/addAccount/addAccount?id=${accountId}&type=${type}&storeId=${account.store_id}&typeId=${account.type_id}&amount=${amount}&remark=${account.remark || ''}&date=${account.transaction_time}`
    });
  },

  // 从普通列表或分组列表中查找账目
  findAccountById: function (id) {
    // 先从普通列表查找
    let account = this.data.accounts.find(item => item.id == id);

    // 如果没找到且有分组数据，从分组中查找
    if (!account && this.data.groupedAccounts) {
      for (const group of this.data.groupedAccounts) {
        account = group.accounts.find(item => item.id == id);
        if (account) break;
      }
    }

    return account;
  },

  // 删除记账
  deleteAccount: function (e) {
    const accountId = e.currentTarget.dataset.id;
    console.log('即将删除账目ID:', accountId);

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记账记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.confirmDeleteAccount(accountId);
        }
      }
    });
  },

  // 执行删除账目操作
  confirmDeleteAccount: function (accountId) {
    // 确保accountId有效
    if (!accountId) {
      console.error('无效的账目ID');
      wx.showToast({
        title: '删除失败：无效ID',
        icon: 'none'
      });
      return;
    }

    // 首先尝试RESTful风格URL
    const url = `${config.apis.accounts.delete}/${accountId}`;
    console.log('删除账目URL:', url);

    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    request.delete(url)
      .then(res => {
        // ... 处理成功响应 ...
      })
      .catch(err => {
        console.error('RESTful方式删除失败，尝试查询参数方式:', err);

        // 如果RESTful风格失败，尝试查询参数风格
        const queryUrl = `${config.apis.accounts.delete}?id=${accountId}`;
        console.log('尝试备用删除URL:', queryUrl);

        return request.delete(queryUrl);
      })
      .then(res => {
        // 处理任一方式的成功结果
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });

        // 从列表中移除该账目
        const updatedAccounts = this.data.accounts.filter(item => item.id !== accountId);
        this.setData({
          accounts: updatedAccounts,
          recordCount: this.data.recordCount - 1
        });

        // 重新加载统计数据
        this.loadStatistics();
      })
      .catch(err => {
        // 两种方式都失败
        wx.hideLoading();
        console.error('删除账目最终失败:', err);

        wx.showToast({
          title: '删除失败，请重试',
          icon: 'none'
        });
      });
  },

  // 显示筛选弹窗
  showFilter: function () {
    this.setData({ showFilterModal: true });
  },

  // 隐藏筛选弹窗
  hideFilter: function () {
    this.setData({ showFilterModal: false });
  },

  // 阻止弹窗内容上的点击事件穿透到遮罩
  preventTouchMove: function () {
    return false;
  },

  // 应用筛选
  applyFilter: function () {
    // 保存筛选设置
    wx.setStorageSync('accountListFilter', {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      minAmount: this.data.minAmount,
      maxAmount: this.data.maxAmount
    });

    this.hideFilter();
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 重置所有筛选条件，显示所有记录
  resetFilter: function () {
    // 初始化为最近3个月的数据
    const today = new Date();
    const endDate = this.formatDate(today);

    // 获取三个月前的日期，确保能看到更多数据
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    this.setData({
      storeId: '',
      typeId: '',
      minAmount: '',
      maxAmount: '',
      searchKeyword: '',
      startDate: this.formatDate(startDate),
      endDate: endDate,
      selectedStoreName: '全部店铺',
      selectedTypeName: '全部类型'
    });

    // 隐藏筛选面板
    this.hideFilter();

    // 重新加载数据
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 日期选择器
  bindStartDateChange: function (e) {
    this.setData({ startDate: e.detail.value });
  },

  bindEndDateChange: function (e) {
    this.setData({ endDate: e.detail.value });
  },

  // 店铺选择
  bindStoreChange: function (e) {
    const index = e.detail.value;
    const selectedStore = this.data.stores[index];

    this.setData({
      storeId: selectedStore.id,
      selectedStoreName: selectedStore.name
    });
  },

  // 类型选择
  bindTypeChange: function (e) {
    const index = e.detail.value;
    const selectedType = this.data.accountTypes[index];

    this.setData({
      typeId: selectedType.id,
      selectedTypeName: selectedType.name
    });
  },

  // 金额输入
  onMinAmountInput: function (e) {
    this.setData({
      minAmount: e.detail.value
    });
  },

  onMaxAmountInput: function (e) {
    this.setData({
      maxAmount: e.detail.value
    });
  },

  // 搜索关键词输入
  onSearchInput: function (e) {
    this.setData({
      searchKeyword: e.detail.value.trim() // 去除前后空格
    });
  },

  // 执行搜索
  doSearch: function () {
    // 去除空格并保存关键词
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }

    // 记录搜索历史
    this.saveSearchHistory(keyword);

    // 重置并加载数据
    this.setData({
      currentPage: 1,
      accounts: [],
      hasMore: true
    });

    // 显示加载提示
    wx.showLoading({
      title: '搜索中...'
    });

    // 调用加载数据方法，并传入搜索参数
    this.loadAccounts(true)
      .then(accounts => {
        wx.hideLoading();

        if (accounts.length === 0) {
          wx.showToast({
            title: '未找到相关记录',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: `找到 ${accounts.length} 条记录`,
            icon: 'success'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('搜索失败:', err);

        wx.showToast({
          title: '搜索失败，请重试',
          icon: 'none'
        });
      });
  },

  // 保存搜索历史
  saveSearchHistory: function (keyword) {
    if (!keyword) return;

    let history = wx.getStorageSync('searchHistory') || [];

    // 如果已存在，删除旧记录
    const index = history.indexOf(keyword);
    if (index > -1) {
      history.splice(index, 1);
    }

    // 添加到历史记录开头
    history.unshift(keyword);

    // 最多保存10条
    if (history.length > 10) {
      history = history.slice(0, 10);
    }

    wx.setStorageSync('searchHistory', history);
  },

  // 应用日期筛选
  applyDateFilter: function () {
    // 验证日期
    if (new Date(this.data.startDate) > new Date(this.data.endDate)) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      });
      return;
    }

    // 重置页码并重新加载数据
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 加载统计功能
  loadStatistics: function () {
    // 构建请求参数
    let url = `${config.apis.accounts.statistics}?`;

    // 添加筛选条件
    if (this.data.startDate) {
      url += `&start_date=${this.data.startDate}`;
    }

    if (this.data.endDate) {
      url += `&end_date=${this.data.endDate}`;
    }

    if (this.data.storeId) {
      url += `&store_id=${this.data.storeId}`;
    }

    if (this.data.typeId) {
      url += `&type_id=${this.data.typeId}`;
    }

    return new Promise((resolve, reject) => {
      // 获取统计数据
      request.get(url)
        .then(res => {
          console.log('统计数据:', res);

          // 根据实际API返回结构提取数据
          const stats = res.data || { total_income: 0, total_expense: 0, net_amount: 0 };

          this.setData({
            totalIncome: filter.formatAmount(stats.total_income),
            totalExpense: filter.formatAmount(stats.total_expense),
            netAmount: filter.formatAmount(stats.net_amount)
          });

          resolve(stats);
        })
        .catch(err => {
          console.error('加载统计数据失败:', err);
          this.setData({
            totalIncome: '0.00',
            totalExpense: '0.00',
            netAmount: '0.00'
          });

          reject(err);
        });
    });
  },

  // 格式化日期时间显示
  formatDateTime: function (date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 加载店铺详情
  loadStoreInfo: function (storeId) {
    request.get(`${config.apis.stores.detail}?id=${storeId}`)
      .then(res => {
        if (res.data && res.data.name) {
          this.setData({
            selectedStoreName: res.data.name
          });
        }
      })
      .catch(err => {
        console.error('加载店铺详情失败:', err);
      });
  },

  // 添加查看详情功能
  viewAccountDetail: function (e) {
    const accountId = e.currentTarget.dataset.id;
    console.log('查看账目详情, ID:', accountId);

    // 从现有数据中查找账目
    const account = this.data.accounts.find(item => item.id === accountId);

    if (account) {
      // 显示详情弹窗
      this.setData({
        currentAccount: account,
        showDetailModal: true
      });
    } else {
      // 如果在本地找不到，可以发起请求获取详情
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
          // 处理账目数据
          const account = {
            ...res.data,
            formattedAmount: filter.formatAmount(Math.abs(res.data.amount)),
            formattedDate: res.data.transaction_time ? res.data.transaction_time.substring(0, 16).replace('T', ' ') : '',
            isIncome: parseFloat(res.data.amount) >= 0
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
    this.editAccount({
      currentTarget: {
        dataset: {
          id: this.data.currentAccount.id
        }
      }
    });
  },

  // 从详情弹窗删除账目
  deleteDetailAccount: function () {
    // 隐藏弹窗
    this.hideDetail();

    // 调用删除方法
    this.deleteAccount({
      currentTarget: {
        dataset: {
          id: this.data.currentAccount.id
        }
      }
    });
  },

  // 处理返回的数据
  processAccounts: function (data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(account => {
      return {
        ...account,
        formattedAmount: filter.formatAmount(Math.abs(account.amount)),
        formattedDate: account.transaction_time ? account.transaction_time.substring(0, 16).replace('T', ' ') : '',
        isIncome: parseFloat(account.amount) >= 0,
        date: account.transaction_time ? account.transaction_time.substring(0, 10) : '',
        // 确保有用户名，如果后端未返回则显示默认值
        username: account.username || '未知用户'
      };
    });
  }
}) 