import config from '../../config/config';
import request from '../../utils/request';
import requestHandler from '../../utils/requestHandler';
import filter from '../../utils/filter';

Page({
  data: {
    accounts: [],
    isLoading: false,
    isRefreshing: false,
    searchKeyword: '',
    // 搜索历史相关
    searchHistory: [],
    showSearchHistory: false,
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
    currentAccount: {},       // 当前查看的账目详情
    // 新增筛选相关状态
    hasActiveFilters: false, // 是否有活跃的筛选条件
    activeFilterCount: 0,    // 活跃的筛选条件数量
    timeRange: '',           // 当前选择的时间范围
    isFilterApplied: false, // 是否应用了筛选条件
    filterTags: [], // 筛选标签
  },

  onLoad: function (options) {
    console.log('页面加载开始:', new Date().toISOString());
    // 初始化组件状态
    this.setData({
      currentPage: 1,
      accounts: [],
      isLoading: false,
      selectedStoreName: '全部店铺',
      selectedTypeName: '全部类型',
      showFilterModal: false,
      isFilterApplied: false, // 是否应用了筛选条件
      hasMore: true, // 是否还有更多数据
      isFirstLoad: true, // 是否首次加载
      filterTags: [] // 筛选标签
    });

    // 初始化数据
    this.initData();

    // 添加初次加载调试日志
    console.log('页面初始化完成，记录初始状态:', {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      startDate: this.data.startDate,
      endDate: this.data.endDate
    });

    // 每次启动记录调试信息
    wx.setStorageSync('appStartInfo', {
      time: new Date().toISOString(),
      initialState: {
        storeId: this.data.storeId,
        typeId: this.data.typeId,
        startDate: this.data.startDate,
        endDate: this.data.endDate
      }
    });

    // 设置页面标题
    if (options.title) {
      wx.setNavigationBarTitle({
        title: options.title
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
  },

  onShow: function () {
    // 页面显示时，检查是否需要刷新数据
    const needRefresh = wx.getStorageSync('accountListNeedRefresh');
    if (needRefresh) {
      console.log('检测到需要刷新标志，重新加载数据');
      this.loadAccounts(true);
      this.loadStatistics();
      wx.removeStorageSync('accountListNeedRefresh');
    }

    // 检查当前的筛选状态
    console.log('当前筛选状态检查:', {
      storeId: this.data.storeId,
      storeIdType: typeof this.data.storeId,
      selectedStoreName: this.data.selectedStoreName,
      typeId: this.data.typeId,
      startDate: this.data.startDate,
      endDate: this.data.endDate
    });

    // 如果显示有筛选标签但storeId为空，可能是数据不一致的情况
    if (this.data.selectedStoreName !== '全部店铺' && (!this.data.storeId || this.data.storeId === '')) {
      console.warn('筛选状态不一致: 已选择特定店铺但storeId为空');

      // 查找匹配的店铺并修复
      if (this.data.stores && this.data.stores.length > 0) {
        const matchedStore = this.data.stores.find(store => store.name === this.data.selectedStoreName);
        if (matchedStore && matchedStore.id) {
          console.log('找到匹配的店铺，修复storeId:', matchedStore);
          const storeIdNum = parseInt(Number(matchedStore.id), 10);
          if (!isNaN(storeIdNum) && storeIdNum > 0) {
            this.setData({ storeId: storeIdNum });
            console.log('已修复storeId为:', storeIdNum);
            this.loadAccounts(true);
            this.loadStatistics();
          }
        }
      }
    }
  },

  // 初始化日期范围，默认展示最近一个月的数据
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

  // 日期格式化
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
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

    // 添加店铺筛选条件
    if (this.data.storeId !== undefined && this.data.storeId !== null && this.data.storeId !== '') {
      console.log('处理筛选店铺ID:', {
        original: this.data.storeId,
        type: typeof this.data.storeId
      });

      // 确保是有效的数字类型，才添加筛选条件
      const storeIdNum = parseInt(Number(this.data.storeId), 10);
      if (!isNaN(storeIdNum) && storeIdNum > 0) {
        params.store_id = storeIdNum;
        console.log('发送给API的店铺ID:', params.store_id, typeof params.store_id);

        // 记录发送的店铺ID和时间戳，便于调试
        const debugInfo = wx.getStorageSync('debugApiRequests') || [];
        debugInfo.unshift({
          type: '筛选请求',
          storeId: storeIdNum,
          params: { ...params },
          timestamp: new Date().toISOString()
        });
        if (debugInfo.length > 10) debugInfo.pop(); // 只保留最近10条
        wx.setStorageSync('debugApiRequests', debugInfo);
      } else {
        console.log('店铺ID无效，不添加筛选条件:', this.data.storeId);
      }
    } else {
      console.log('未设置店铺ID或为空值');
    }

    // 添加类型筛选
    if (this.data.typeId !== undefined && this.data.typeId !== null && this.data.typeId !== '') {
      console.log('处理筛选类型ID:', {
        original: this.data.typeId,
        type: typeof this.data.typeId
      });

      // 确保是有效的数字类型
      const typeIdNum = parseInt(Number(this.data.typeId), 10);
      if (!isNaN(typeIdNum) && typeIdNum > 0) {
        params.type_id = typeIdNum;
        console.log('发送给API的类型ID:', params.type_id, typeof params.type_id);
      } else {
        console.log('类型ID无效，不添加筛选条件:', this.data.typeId);
      }
    } else {
      console.log('未设置类型ID或为空值');
    }

    // 添加搜索关键词
    if (this.data.searchKeyword) {
      params.keyword = this.data.searchKeyword.trim();
    }

    // 添加金额范围
    if (this.data.minAmount !== undefined && this.data.minAmount !== null && this.data.minAmount !== '') {
      console.log('处理最小金额:', {
        original: this.data.minAmount,
        type: typeof this.data.minAmount
      });

      // 确保是有效的数字类型
      const minAmountNum = parseFloat(this.data.minAmount);
      if (!isNaN(minAmountNum)) {
        params.min_amount = minAmountNum;
        console.log('发送给API的最小金额:', params.min_amount, typeof params.min_amount);
      } else {
        console.log('最小金额无效，不添加筛选条件:', this.data.minAmount);
      }
    }

    if (this.data.maxAmount !== undefined && this.data.maxAmount !== null && this.data.maxAmount !== '') {
      console.log('处理最大金额:', {
        original: this.data.maxAmount,
        type: typeof this.data.maxAmount
      });

      // 确保是有效的数字类型
      const maxAmountNum = parseFloat(this.data.maxAmount);
      if (!isNaN(maxAmountNum)) {
        params.max_amount = maxAmountNum;
        console.log('发送给API的最大金额:', params.max_amount, typeof params.max_amount);
      } else {
        console.log('最大金额无效，不添加筛选条件:', this.data.maxAmount);
      }
    }

    // 调试输出完整请求URL
    const baseUrl = config.apis.accounts.list;
    const queryParams = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const fullUrl = `${baseUrl}?${queryParams}`;
    console.log('完整请求URL:', fullUrl);
    console.log('筛选参数:', JSON.stringify(params));

    // 添加加载提示
    if (isRefresh) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
    }

    // 发起请求 - 使用增强的requestHandler
    return requestHandler.get(config.apis.accounts.list, params, { hideLoading: !isRefresh })
      .then(res => {
        // 隐藏加载提示
        if (isRefresh) {
          wx.hideLoading();
        }

        // 设置加载完成状态
        this.setData({ isLoading: false });

        const { data, total, limit } = res.data;

        console.log('API返回数据:', JSON.stringify(res.data));

        if (!data || !Array.isArray(data)) {
          console.error('返回数据格式错误:', res);
          this.setData({
            hasMore: false
          });
          return [];
        }

        // 处理返回的数据
        const newAccounts = this.processAccounts(data);

        // 更新页面数据
        this.setData({
          accounts: this.data.currentPage === 1 ? newAccounts : this.data.accounts.concat(newAccounts),
          hasMore: newAccounts.length >= limit,
          totalCount: total
        });

        return data;
      })
      .catch(err => {
        console.error('获取账务列表失败:', err);
        this.setData({
          isLoading: false,
          hasMore: false
        });

        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });

        return [];
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
    console.log('开始加载店铺列表');
    return new Promise((resolve, reject) => {
      request.get(config.apis.stores.list)
        .then(res => {
          if (!res.data || !Array.isArray(res.data)) {
            console.error('返回店铺数据格式错误:', res);
            reject(new Error('店铺数据格式错误'));
            return;
          }

          console.log('返回的店铺数据:', JSON.stringify(res.data));

          // 确保所有店铺ID是整数类型，并保持原始ID值不变
          const storesList = res.data.map(store => ({
            ...store,
            id: parseInt(Number(store.id), 10) // 转换为整数但保持原始ID值
          }));

          // 添加"全部店铺"选项
          const stores = [
            { id: '', name: '全部店铺' },
            ...storesList
          ];

          // 输出店铺ID映射，便于调试
          console.log('店铺ID映射:', storesList.map(store => ({
            id: store.id,
            name: store.name
          })));

          console.log('处理后的店铺列表:', JSON.stringify(stores));
          this.setData({ stores });

          // 如果有店铺ID，设置对应的店铺名称
          if (this.data.storeId) {
            console.log('尝试匹配店铺ID:', this.data.storeId);
            // 使用严格整数比较
            const selectedStore = stores.find(store =>
            (typeof store.id === 'number' && typeof this.data.storeId === 'number' &&
              store.id === this.data.storeId) // 直接比较整数ID
            );
            if (selectedStore) {
              console.log('找到匹配的店铺:', selectedStore);
              this.setData({
                selectedStoreName: selectedStore.name
              });
            } else {
              console.error('未找到匹配的店铺:', {
                storeId: this.data.storeId,
                typeStoreId: typeof this.data.storeId,
                availableStores: stores.map(s => ({ id: s.id, typeId: typeof s.id, name: s.name }))
              });
            }
          }

          resolve(stores);
        })
        .catch(err => {
          console.error('加载店铺列表失败:', err);
          reject(err);
        });
    });
  },

  // 加载账务类型
  loadAccountTypes: function () {
    return new Promise((resolve, reject) => {
      request.get(config.apis.accountTypes.list)
        .then(res => {
          if (!res.data || !Array.isArray(res.data)) {
            console.error('返回账务类型数据格式错误:', res);
            reject(new Error('账务类型数据格式错误'));
            return;
          }

          const typesList = res.data || [];

          // 添加"全部类型"选项
          const accountTypes = [
            { id: '', name: '全部类型' },
            ...typesList
          ];

          this.setData({ accountTypes });

          // 如果有类型ID，设置对应的类型名称
          if (this.data.typeId) {
            const selectedType = accountTypes.find(type => String(type.id) === String(this.data.typeId));
            if (selectedType) {
              this.setData({
                selectedTypeName: selectedType.name
              });
            }
          }

          resolve(accountTypes);
        })
        .catch(err => {
          console.error('加载账务类型失败:', err);
          reject(err);
        });
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

  // 绑定筛选器显示/隐藏
  showFilter: function () {
    this.setData({
      showFilterModal: true
    });

    // 显示筛选器时，输出当前筛选状态用于调试
    console.log('当前筛选状态:', {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      dataType: {
        storeId: typeof this.data.storeId,
        typeId: typeof this.data.typeId
      },
      selectedStoreName: this.data.selectedStoreName,
      selectedTypeName: this.data.selectedTypeName
    });
  },

  hideFilter: function () {
    this.setData({
      showFilterModal: false
    });
  },

  // 重置所有筛选条件，显示所有记录
  resetFilter: function () {
    console.log('重置所有筛选条件');

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
      selectedTypeName: '全部类型',
      timeRange: ''
    });

    // 更新筛选状态
    this.updateFilterStatus();

    // 隐藏筛选面板
    this.hideFilter();

    // 清除本地存储的筛选设置
    wx.removeStorageSync('accountListFilter');

    // 记录重置操作
    console.log('已重置筛选条件', {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      minAmount: this.data.minAmount,
      maxAmount: this.data.maxAmount
    });

    // 重新加载数据
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 保存筛选设置到本地缓存
  saveFilterSettings: function () {
    const filterSettings = {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      minAmount: this.data.minAmount,
      maxAmount: this.data.maxAmount,
      searchKeyword: this.data.searchKeyword,
      timeRange: this.data.timeRange,
      selectedStoreName: this.data.selectedStoreName,
      selectedTypeName: this.data.selectedTypeName
    };

    console.log('保存筛选设置:', filterSettings);
    wx.setStorageSync('accountListFilter', filterSettings);

    // 添加调试信息，便于排查
    wx.setStorageSync('lastFilterSave', {
      time: new Date().toISOString(),
      settings: filterSettings
    });
  },

  // 应用筛选
  applyFilter: function () {
    console.log('应用筛选 - 当前筛选条件:', {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      minAmount: this.data.minAmount,
      maxAmount: this.data.maxAmount,
      searchKeyword: this.data.searchKeyword
    });

    // 检查筛选一致性
    this.checkFilterConsistency();

    this.hideFilter();

    // 使用统一的刷新函数
    this.refreshWithFilters();
  },

  // 加载统计功能
  loadStatistics: function () {
    // 构建API请求参数，与筛选条件保持一致
    const params = {
      start_date: this.data.startDate,
      end_date: this.data.endDate
    };

    // 添加店铺筛选条件
    if (this.data.storeId !== undefined && this.data.storeId !== null && this.data.storeId !== '') {
      console.log('统计API请求: 处理店铺ID:', {
        id: this.data.storeId,
        type: typeof this.data.storeId
      });

      // 确保是有效的数字类型
      const storeIdNum = parseInt(Number(this.data.storeId), 10);
      if (!isNaN(storeIdNum) && storeIdNum > 0) {
        params.store_id = storeIdNum;
        console.log('统计API请求: 添加店铺ID:', params.store_id, typeof params.store_id);
      } else {
        console.log('统计API请求: 店铺ID无效，不添加筛选条件:', this.data.storeId);
      }
    } else {
      console.log('统计API请求: 未设置店铺ID或为空值');
    }

    // 添加类型筛选
    if (this.data.typeId !== undefined && this.data.typeId !== null && this.data.typeId !== '') {
      console.log('统计API请求: 处理类型ID:', {
        id: this.data.typeId,
        type: typeof this.data.typeId
      });

      // 确保是有效的数字类型
      const typeIdNum = parseInt(Number(this.data.typeId), 10);
      if (!isNaN(typeIdNum) && typeIdNum > 0) {
        params.type_id = typeIdNum;
        console.log('统计API请求: 添加类型ID:', params.type_id, typeof params.type_id);
      } else {
        console.log('统计API请求: 类型ID无效，不添加筛选条件:', this.data.typeId);
      }
    }

    // 添加金额范围
    if (this.data.minAmount !== undefined && this.data.minAmount !== null && this.data.minAmount !== '') {
      const minAmountNum = parseFloat(this.data.minAmount);
      if (!isNaN(minAmountNum)) {
        params.min_amount = minAmountNum;
        console.log('统计API请求: 添加最小金额:', params.min_amount);
      }
    }

    if (this.data.maxAmount !== undefined && this.data.maxAmount !== null && this.data.maxAmount !== '') {
      const maxAmountNum = parseFloat(this.data.maxAmount);
      if (!isNaN(maxAmountNum)) {
        params.max_amount = maxAmountNum;
        console.log('统计API请求: 添加最大金额:', params.max_amount);
      }
    }

    // 调试输出完整请求URL
    const baseUrl = config.apis.accounts.statistics;
    const queryParams = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const fullUrl = `${baseUrl}?${queryParams}`;
    console.log('统计API完整请求URL:', fullUrl);
    console.log('统计API筛选参数:', JSON.stringify(params));

    // 记录请求到调试存储
    const debugInfo = wx.getStorageSync('debugApiRequests') || [];
    debugInfo.unshift({
      type: '统计请求',
      params: { ...params },
      url: fullUrl,
      timestamp: new Date().toISOString()
    });
    if (debugInfo.length > 10) debugInfo.pop(); // 只保留最近10条
    wx.setStorageSync('debugApiRequests', debugInfo);

    // 使用增强的requestHandler发起请求
    return requestHandler.get(config.apis.accounts.statistics, params)
      .then(res => {
        console.log('统计数据:', res.data);
        if (res.data && res.data.data) {
          const stats = res.data.data;
          this.setData({
            statistics: stats
          });
          return stats;
        }
        return null;
      })
      .catch(err => {
        console.error('获取统计数据失败:', err);
        return null;
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

  // 加载店铺信息
  loadStoreInfo: function (storeId) {
    console.log('尝试加载店铺信息，ID:', storeId);

    if (!storeId || !this.data.stores || this.data.stores.length === 0) {
      console.log('无法加载店铺信息: 店铺ID为空或店铺列表未加载');
      return;
    }

    // 确保使用整数比较
    const storeIdNum = parseInt(Number(storeId), 10);
    const store = this.data.stores.find(s => {
      // 转换为数字进行比较
      const sid = parseInt(Number(s.id), 10);
      return !isNaN(sid) && !isNaN(storeIdNum) && sid === storeIdNum;
    });

    if (store) {
      console.log('找到店铺信息:', store);
      this.setData({
        selectedStoreName: store.name
      });
    } else {
      console.error('未找到店铺信息:', {
        storeId: storeId,
        storeIdNum: storeIdNum,
        stores: this.data.stores
      });
      // 如果未找到，重置为全部店铺
      this.setData({
        selectedStoreName: '全部店铺',
        storeId: ''
      });
    }
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
  processAccounts: function (accounts) {
    if (!accounts || !Array.isArray(accounts)) {
      console.error('处理账目数据时收到无效数据:', accounts);
      return [];
    }

    return accounts.map(account => {
      // 确保各项数据有效性
      const id = account.id || 0;
      const storeId = account.store_id || 0;
      const storeName = account.store_name || '未知店铺';
      const typeId = account.type_id || 0;
      const typeName = account.type_name || '未知类型';
      const amount = parseFloat(account.amount) || 0;
      const remark = account.remark || '';
      const transactionTime = account.transaction_time || '';

      // 格式化日期
      let formattedDate = '';
      let date = '';

      if (transactionTime) {
        try {
          const dateObj = new Date(transactionTime.replace(/-/g, '/'));
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            date = dateObj.toISOString().split('T')[0];
          }
        } catch (err) {
          console.error('日期格式化错误:', err, transactionTime);
          formattedDate = transactionTime;
          date = transactionTime.split(' ')[0];
        }
      }

      // 格式化金额
      const formattedAmount = Math.abs(amount).toFixed(2);
      const isIncome = amount >= 0;

      return {
        id,
        store_id: storeId,
        store_name: storeName,
        type_id: typeId,
        type_name: typeName,
        amount,
        remark,
        transaction_time: transactionTime,
        formattedDate,
        formattedAmount,
        isIncome,
        date
      };
    });
  },

  // 在onLoad或loadAccounts执行完后添加计算活跃筛选条件
  updateFilterStatus: function () {
    let activeCount = 0;
    if (this.data.selectedStoreName !== '全部店铺') activeCount++;
    if (this.data.selectedTypeName !== '全部类型') activeCount++;
    if (this.data.startDate || this.data.endDate) activeCount++;
    if (this.data.minAmount || this.data.maxAmount) activeCount++;
    if (this.data.searchKeyword) activeCount++;

    this.setData({
      hasActiveFilters: activeCount > 0,
      activeFilterCount: activeCount
    });
  },

  // 清除单个筛选条件
  clearSingleFilter: function (e) {
    const filterType = e.currentTarget.dataset.filter;

    switch (filterType) {
      case 'store':
        this.setData({
          storeId: '',
          selectedStoreName: '全部店铺'
        });
        break;
      case 'type':
        this.setData({
          typeId: '',
          selectedTypeName: '全部类型'
        });
        break;
      case 'date':
        // 设置为默认日期范围（最近一个月）
        this.initDateRange();
        this.setData({
          timeRange: ''  // 清除快速日期选择的活跃状态
        });
        break;
      case 'amount':
        this.setData({
          minAmount: '',
          maxAmount: ''
        });
        break;
      case 'keyword':
        this.setData({
          searchKeyword: ''
        });
        break;
    }

    // 更新筛选状态
    this.updateFilterStatus();

    // 重新加载数据
    this.loadAccounts(true);
    this.loadStatistics();

    // 保存筛选设置
    this.saveFilterSettings();
  },

  // 清除搜索关键词
  clearSearch: function () {
    this.setData({
      searchKeyword: ''
    });
    this.updateFilterStatus();

    // 如果之前有搜索内容，重新加载数据
    if (this.data.hasActiveFilters) {
      this.loadAccounts(true);
      this.loadStatistics();
    }
  },

  // 快速选择日期范围
  selectQuickDate: function (e) {
    const range = e.currentTarget.dataset.range;
    const today = new Date();
    let startDate;

    switch (range) {
      case 'day':
        // 今天
        startDate = this.formatDate(today);
        break;
      case 'week':
        // 本周一
        const dayOfWeek = today.getDay() || 7; // 将周日的0转为7
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + 1);
        startDate = this.formatDate(monday);
        break;
      case 'month':
        // 本月1日
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = this.formatDate(firstDayOfMonth);
        break;
      case 'quarter':
        // 本季度第一天
        const quarter = Math.floor(today.getMonth() / 3);
        const firstDayOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        startDate = this.formatDate(firstDayOfQuarter);
        break;
      case 'year':
        // 本年1月1日
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        startDate = this.formatDate(firstDayOfYear);
        break;
    }

    const endDate = this.formatDate(today);

    this.setData({
      startDate: startDate,
      endDate: endDate,
      timeRange: range
    });

    // 更新筛选状态并重新加载数据
    this.updateFilterStatus();
    this.loadAccounts(true);
    this.loadStatistics();

    // 保存筛选设置
    this.saveFilterSettings();
  },

  // 添加一个显式的函数来应用筛选并加载数据
  refreshWithFilters: function () {
    console.log('刷新数据，当前筛选条件:', {
      storeId: this.data.storeId,
      storeIdType: typeof this.data.storeId,
      typeId: this.data.typeId,
      selectedStoreName: this.data.selectedStoreName
    });

    // 在加载数据前再次检查筛选一致性
    this.checkFilterConsistency();

    // 确保页码重置
    this.setData({
      currentPage: 1,
      accounts: []
    });

    // 更新筛选标签状态
    this.updateFilterStatus();

    // 保存当前筛选设置
    this.saveFilterSettings();

    // 加载数据
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 在选择器变化时直接更新加载
  bindStoreChange: function (e) {
    const index = e.detail.value;
    if (index === undefined || !this.data.stores || index >= this.data.stores.length) {
      console.error('店铺选择错误: 无效的索引或店铺列表', {
        index: index,
        storesLength: this.data.stores ? this.data.stores.length : 0
      });
      return;
    }

    // 获取选择的店铺
    const selectedStore = this.data.stores[index];
    const storeId = selectedStore.id;
    const storeName = selectedStore.name;

    console.log('选择店铺:', {
      index: index,
      id: storeId,
      name: storeName,
      idType: typeof storeId
    });
    console.log('所有店铺列表:', JSON.stringify(this.data.stores));

    // 处理店铺ID
    let storeIdNum = null;
    if (storeName === '全部店铺') {
      // 全部店铺时设置为空字符串
      storeIdNum = '';
      console.log('选择了全部店铺，设置storeId为空');
    } else {
      // 确保店铺ID是纯数字，并转换为整数
      if (storeId !== undefined && storeId !== null && storeId !== '') {
        storeIdNum = parseInt(Number(storeId), 10);
        if (isNaN(storeIdNum) || storeIdNum <= 0) {
          console.error('无效的店铺ID:', storeId);
          storeIdNum = '';
        } else {
          console.log('选择了特定店铺，storeId设置为:', storeIdNum);
        }
      }
    }

    console.log('处理后的店铺ID:', {
      original: storeId,
      processed: storeIdNum,
      type: typeof storeIdNum
    });

    // 保存到状态
    this.setData({
      storeId: storeIdNum,
      selectedStoreName: storeName
    });

    // 保存选择，便于调试
    wx.setStorageSync('debugStoreSelection', {
      index: index,
      id: storeId,
      processedId: storeIdNum,
      name: storeName,
      timestamp: new Date().toISOString(),
      stores: this.data.stores
    });

    console.log('更新后的筛选条件:', {
      storeId: this.data.storeId,
      type: typeof this.data.storeId,
      storeName: this.data.selectedStoreName
    });

    // 检查是否是"店1"（用于测试）
    if (storeName === '店1' && storeIdNum !== 2) {
      console.error('店1的ID应该是2，但实际获取到:', storeIdNum);
    }

    // 立即应用筛选并加载数据
    this.refreshWithFilters();
  },

  // 类型选择器变化处理函数
  bindTypeChange: function (e) {
    const index = e.detail.value;
    if (index === undefined || !this.data.accountTypes || index >= this.data.accountTypes.length) {
      console.error('类型选择错误: 无效的索引或类型列表', {
        index: index,
        typesLength: this.data.accountTypes ? this.data.accountTypes.length : 0
      });
      return;
    }

    // 获取选择的类型
    const selectedType = this.data.accountTypes[index];
    const typeId = selectedType.id;
    const typeName = selectedType.name;

    console.log('选择账目类型:', {
      index: index,
      id: typeId,
      name: typeName,
      idType: typeof typeId
    });

    // 处理类型ID
    let typeIdValue = '';
    if (typeName === '全部类型') {
      // 全部类型时设置为空字符串
      typeIdValue = '';
      console.log('选择了全部类型，设置typeId为空');
    } else {
      // 确保类型ID是有效值
      if (typeId !== undefined && typeId !== null && typeId !== '') {
        typeIdValue = parseInt(Number(typeId), 10);
        if (isNaN(typeIdValue) || typeIdValue <= 0) {
          console.error('无效的类型ID:', typeId);
          typeIdValue = '';
        } else {
          console.log('选择了特定类型，typeId设置为:', typeIdValue);
        }
      }
    }

    // 保存到状态
    this.setData({
      typeId: typeIdValue,
      selectedTypeName: typeName
    });

    // 保存选择，便于调试
    wx.setStorageSync('debugTypeSelection', {
      index: index,
      id: typeId,
      processedId: typeIdValue,
      name: typeName,
      timestamp: new Date().toISOString()
    });

    console.log('更新后的筛选条件:', {
      typeId: this.data.typeId,
      type: typeof this.data.typeId,
      typeName: this.data.selectedTypeName
    });

    // 立即应用筛选并加载数据
    this.refreshWithFilters();
  },

  // 金额输入处理函数
  onMinAmountInput: function (e) {
    const value = e.detail.value;
    console.log('最小金额输入:', value);
    // 只允许输入数字和小数点
    if (value === '' || /^(0|[1-9]\d*)(\.\d{0,2})?$/.test(value)) {
      this.setData({
        minAmount: value
      });
    }
  },

  onMaxAmountInput: function (e) {
    const value = e.detail.value;
    console.log('最大金额输入:', value);
    // 只允许输入数字和小数点
    if (value === '' || /^(0|[1-9]\d*)(\.\d{0,2})?$/.test(value)) {
      this.setData({
        maxAmount: value
      });
    }
  },

  // 筛选状态一致性检查
  checkFilterConsistency: function () {
    console.log('检查筛选一致性，当前状态:', {
      storeId: this.data.storeId,
      storeIdType: typeof this.data.storeId,
      selectedStoreName: this.data.selectedStoreName,
      stores: this.data.stores ? this.data.stores.length : 0
    });

    // 如果没有店铺列表，先等待加载
    if (!this.data.stores || this.data.stores.length === 0) {
      console.log('店铺列表尚未加载，跳过一致性检查');
      return;
    }

    // 检查店铺ID和名称的一致性
    const storeId = this.data.storeId;
    const selectedStoreName = this.data.selectedStoreName;

    // 如果已选择了特定店铺
    if (storeId !== undefined && storeId !== null && storeId !== '') {
      // 确保storeId是数字类型
      const storeIdNum = parseInt(Number(storeId), 10);
      console.log('检查店铺ID一致性:', {
        storeId: storeId,
        convertedId: storeIdNum,
        selectedName: selectedStoreName
      });

      if (!isNaN(storeIdNum) && storeIdNum > 0) {
        // 查找这个ID对应的店铺
        const matchingStore = this.data.stores.find(store => {
          const storeIdInt = parseInt(Number(store.id), 10);
          return storeIdInt === storeIdNum;
        });

        if (matchingStore) {
          // 找到匹配的店铺，检查名称是否一致
          console.log('找到匹配的店铺:', matchingStore);
          if (matchingStore.name !== selectedStoreName) {
            console.warn('店铺名称不匹配，更新名称:', {
              oldName: selectedStoreName,
              newName: matchingStore.name,
              id: storeIdNum
            });
            this.setData({
              selectedStoreName: matchingStore.name
            });
          }
        } else {
          console.error('无法找到匹配的店铺:', {
            storeId: storeIdNum,
            availableStores: this.data.stores.map(s => ({ id: s.id, name: s.name }))
          });
          // 重置为默认值
          this.setData({
            storeId: '',
            selectedStoreName: '全部店铺'
          });
        }
      } else if (selectedStoreName !== '全部店铺') {
        // ID无效但选择了特定店铺名，尝试根据名称找到ID
        console.log('店铺ID无效，尝试通过名称匹配:', selectedStoreName);
        const matchingStore = this.data.stores.find(store =>
          store.name === selectedStoreName
        );

        if (matchingStore) {
          console.log('通过名称找到匹配店铺:', matchingStore);
          const correctId = parseInt(Number(matchingStore.id), 10);
          if (!isNaN(correctId) && correctId > 0) {
            this.setData({
              storeId: correctId
            });
            console.log('根据店铺名称更新ID:', correctId);
          }
        } else {
          console.warn('根据名称无法找到匹配店铺，重置为全部店铺');
          this.setData({
            storeId: '',
            selectedStoreName: '全部店铺'
          });
        }
      }
    } else if (selectedStoreName !== '全部店铺') {
      // ID为空但选择了特定店铺，尝试修复
      console.log('店铺ID为空但选择了特定店铺:', selectedStoreName);
      const matchingStore = this.data.stores.find(store =>
        store.name === selectedStoreName
      );

      if (matchingStore) {
        const correctId = parseInt(Number(matchingStore.id), 10);
        if (!isNaN(correctId) && correctId > 0) {
          this.setData({
            storeId: correctId
          });
          console.log('根据店铺名称设置ID:', correctId);
        }
      } else {
        // 找不到匹配的店铺，重置为全部
        console.warn('无法找到名为', selectedStoreName, '的店铺，重置为全部店铺');
        this.setData({
          selectedStoreName: '全部店铺'
        });
      }
    }

    // 同样检查类型ID和名称一致性
    // 省略类似的检查代码...

    // 保存更新后的筛选状态
    this.saveFilterSettings();
  },

  // 初始化数据
  initData: function () {
    console.log('初始化数据开始');

    // 初始化日期范围 - 默认最近3个月
    this.initDateRange();

    // 加载搜索历史
    this.loadSearchHistory();

    // 从本地存储恢复筛选设置（如果有）
    const hasStoredFilter = this.loadFilterSettings();
    console.log('是否从存储恢复了筛选设置:', hasStoredFilter);

    // 加载店铺列表和账目类型
    const tasks = [
      this.loadStores(),
      this.loadAccountTypes()
    ];

    // 异步加载所有数据
    Promise.all(tasks)
      .then(() => {
        console.log('基础数据加载完成，准备加载账目和统计');

        // 检查筛选条件一致性
        this.checkFilterConsistency();

        // 显示筛选状态标签
        this.updateFilterStatus();

        // 保证只会加载一次
        if (this.data.isFirstLoad) {
          this.setData({ isFirstLoad: false });
          console.log('首次加载数据开始', new Date().toISOString());

          // 加载账目列表和统计数据
          this.loadAccounts(true);
          this.loadStatistics();
        }
      })
      .catch(err => {
        console.error('初始化数据失败:', err);
        wx.showToast({
          title: '加载数据失败，请重试',
          icon: 'none'
        });
      });
  },

  // 加载筛选条件
  loadFilterSettings: function () {
    const filterSettings = wx.getStorageSync('accountListFilter');
    console.log('从存储加载的筛选设置:', filterSettings);

    if (filterSettings) {
      // 恢复筛选设置
      this.setData({
        storeId: filterSettings.storeId !== undefined ? filterSettings.storeId : '',
        typeId: filterSettings.typeId !== undefined ? filterSettings.typeId : '',
        startDate: filterSettings.startDate || '',
        endDate: filterSettings.endDate || '',
        minAmount: filterSettings.minAmount || '',
        maxAmount: filterSettings.maxAmount || '',
        searchKeyword: filterSettings.searchKeyword || '',
        timeRange: filterSettings.timeRange || '',
        selectedStoreName: filterSettings.selectedStoreName || '全部店铺',
        selectedTypeName: filterSettings.selectedTypeName || '全部类型'
      });

      // 检查是否有实际应用的筛选条件
      const hasActiveFilter = (
        filterSettings.storeId ||
        filterSettings.typeId ||
        filterSettings.startDate ||
        filterSettings.endDate ||
        filterSettings.minAmount ||
        filterSettings.maxAmount ||
        filterSettings.searchKeyword
      );

      // 添加日志，记录当前的storeId类型和值
      console.log('加载筛选设置后的storeId:', {
        value: filterSettings.storeId,
        type: typeof filterSettings.storeId,
        selectedStoreName: filterSettings.selectedStoreName
      });

      // 如果有筛选条件，标记为已应用筛选
      this.setData({
        isFilterApplied: hasActiveFilter
      });

      // 记录恢复的筛选状态
      wx.setStorageSync('loadedFilterState', {
        time: new Date().toISOString(),
        settings: { ...this.data }
      });

      return true;
    }

    return false;
  },

  // 搜索关键词输入处理
  onSearchInput: function (e) {
    const value = e.detail.value;
    console.log('搜索关键词输入:', value);
    this.setData({
      searchKeyword: value
    });
  },

  // 执行搜索
  doSearch: function () {
    console.log('执行搜索, 关键词:', this.data.searchKeyword);
    // 保存搜索历史
    if (this.data.searchKeyword) {
      this.saveSearchHistory(this.data.searchKeyword);
    }

    // 更新筛选状态
    this.updateFilterStatus();

    // 保存筛选设置
    this.saveFilterSettings();

    // 重新加载数据
    this.refreshWithFilters();
  },

  // 清除搜索
  clearSearch: function () {
    console.log('清除搜索关键词');
    this.setData({
      searchKeyword: ''
    });

    // 如果之前有搜索内容，更新筛选状态并重新加载数据
    this.updateFilterStatus();
    this.saveFilterSettings();
    this.refreshWithFilters();
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
    console.log('保存搜索历史:', history);
  },

  // 取消筛选按钮事件
  onClearFilter: function () {
    console.log('清除所有筛选');
    this.resetFilter();
  },

  // 加载搜索历史
  loadSearchHistory: function () {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({
      searchHistory: history
    });
    console.log('加载搜索历史:', history);
  },

  // 清除搜索历史
  clearSearchHistory: function () {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有搜索历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({
            searchHistory: [],
            showSearchHistory: false
          });
          console.log('已清除搜索历史');
          wx.showToast({
            title: '已清除历史',
            icon: 'success'
          });
        }
      }
    });
  },

  // 使用历史记录进行搜索
  useSearchHistory: function (e) {
    const keyword = e.currentTarget.dataset.keyword;
    console.log('使用历史关键词搜索:', keyword);

    this.setData({
      searchKeyword: keyword,
      showSearchHistory: false
    });

    // 立即执行搜索
    this.doSearch();
  },

  // 搜索框获取焦点，显示历史记录
  onSearchFocus: function () {
    // 加载最新的搜索历史
    this.loadSearchHistory();

    // 只有当有历史记录时才显示
    if (this.data.searchHistory.length > 0) {
      this.setData({
        showSearchHistory: true
      });
    }
  },

  // 搜索框失去焦点，隐藏历史记录（延迟执行，避免点击历史记录无效）
  onSearchBlur: function () {
    setTimeout(() => {
      this.setData({
        showSearchHistory: false
      });
    }, 200);
  },
}) 