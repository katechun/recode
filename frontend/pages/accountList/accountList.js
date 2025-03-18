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
    currentAccount: {},       // 当前查看的账目详情
    // 新增筛选相关状态
    hasActiveFilters: false, // 是否有活跃的筛选条件
    activeFilterCount: 0,    // 活跃的筛选条件数量
    timeRange: '',           // 当前选择的时间范围
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

    // 首先加载基础数据
    Promise.all([
      this.loadStores(),
      this.loadAccountTypes()
    ]).then(() => {
      // 基础数据加载完成后，设置筛选条件

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
          endDate: savedFilter.endDate,
          timeRange: savedFilter.timeRange || ''
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

      // 更新筛选状态
      this.updateFilterStatus();

      // 加载账目数据和统计
      this.loadAccounts(true);
      this.loadStatistics();
    });

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
      this.loadAccounts(true);
      this.loadStatistics();
      wx.removeStorageSync('accountListNeedRefresh');
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

    // 添加筛选条件，确保类型转换正确
    if (this.data.storeId !== undefined && this.data.storeId !== null && this.data.storeId !== '') {
      // 确保storeId是字符串且不为0
      const storeIdStr = String(this.data.storeId);
      if (storeIdStr !== '0') {
        console.log('处理筛选店铺ID:', {
          original: this.data.storeId,
          converted: storeIdStr,
          type: typeof storeIdStr
        });
        params.store_id = storeIdStr;
      } else {
        console.log('店铺ID是0，不添加筛选条件');
      }
    } else {
      console.log('未设置店铺ID或为空值');
    }

    if (this.data.typeId !== undefined && this.data.typeId !== null && this.data.typeId !== '') {
      // 确保typeId是字符串且不为0
      const typeIdStr = String(this.data.typeId);
      if (typeIdStr !== '0') {
        console.log('处理筛选类型ID:', {
          original: this.data.typeId,
          converted: typeIdStr,
          type: typeof typeIdStr
        });
        params.type_id = typeIdStr;
      } else {
        console.log('类型ID是0，不添加筛选条件');
      }
    } else {
      console.log('未设置类型ID或为空值');
    }

    if (this.data.searchKeyword && this.data.searchKeyword.trim()) {
      // 去除前后空白字符
      params.keyword = this.data.searchKeyword.trim();
    }

    if (this.data.minAmount) {
      // 确保数值类型正确
      const minAmount = parseFloat(this.data.minAmount);
      if (!isNaN(minAmount)) {
        params.min_amount = minAmount;
      }
    }

    if (this.data.maxAmount) {
      // 确保数值类型正确
      const maxAmount = parseFloat(this.data.maxAmount);
      if (!isNaN(maxAmount)) {
        params.max_amount = maxAmount;
      }
    }

    // 调试输出
    console.log('筛选参数:', JSON.stringify(params));

    // 添加加载提示
    if (isRefresh) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
    }

    // 发起请求 - 后端已处理权限过滤
    return new Promise((resolve, reject) => {
      request.get(config.apis.accounts.list, params)
        .then(res => {
          // 隐藏加载提示
          if (isRefresh) {
            wx.hideLoading();
          }

          console.log('API返回数据:', JSON.stringify(res.data));

          if (!res.data || !res.data.data || !Array.isArray(res.data.data)) {
            console.error('返回数据格式错误:', res);
            this.setData({
              isLoading: false,
              isRefreshing: false,
              shouldShowEmptyState: isRefresh
            });

            wx.showToast({
              title: '数据格式错误',
              icon: 'none'
            });

            return reject(new Error('数据格式错误'));
          }

          // 处理返回的数据，处理后端返回的新格式
          const data = res.data.data || [];

          // 分析返回数据中的店铺信息
          if (this.data.storeId) {
            const storeIds = data.map(item => item.store_id);
            const storeNames = data.map(item => item.store_name);
            console.log('筛选店铺ID:', this.data.storeId);
            console.log('返回数据中的店铺IDs:', storeIds);
            console.log('返回数据中的店铺Names:', storeNames);
          }

          const total = res.data.total || data.length || 0;
          const newAccounts = this.processAccounts(data);

          // 更新空状态标志
          const isEmpty = isRefresh && newAccounts.length === 0;

          this.setData({
            accounts: isRefresh ? newAccounts : [...this.data.accounts, ...newAccounts],
            isLoading: false,
            isRefreshing: false,
            hasMore: newAccounts.length === this.data.pageSize,
            shouldShowEmptyState: isEmpty,
            recordCount: total
          });

          // 增加页码
          this.setData({
            currentPage: this.data.currentPage + 1
          });

          // 如果是刷新操作，显示结果提示
          if (isRefresh) {
            if (isEmpty) {
              wx.showToast({
                title: '暂无符合条件的记录',
                icon: 'none',
                duration: 2000
              });
            } else {
              wx.showToast({
                title: `已加载 ${newAccounts.length} 条记录`,
                icon: 'success',
                duration: 1500
              });
            }
          }

          resolve(newAccounts);
        })
        .catch(err => {
          console.error('加载账目失败:', err);
          if (isRefresh) {
            wx.hideLoading();
          }

          this.setData({
            isLoading: false,
            isRefreshing: false
          });

          wx.showToast({
            title: '加载失败，请重试',
            icon: 'none'
          });

          reject(err);
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

          // 确保所有店铺ID是字符串类型
          const storesList = res.data.map(store => ({
            ...store,
            id: String(store.id) // 确保ID是字符串
          }));

          // 添加"全部店铺"选项
          const stores = [
            { id: '', name: '全部店铺' },
            ...storesList
          ];

          console.log('处理后的店铺列表:', JSON.stringify(stores));
          this.setData({ stores });

          // 如果有店铺ID，设置对应的店铺名称
          if (this.data.storeId) {
            console.log('尝试匹配店铺ID:', this.data.storeId);
            const selectedStore = stores.find(store => String(store.id) === String(this.data.storeId));
            if (selectedStore) {
              console.log('找到匹配的店铺:', selectedStore);
              this.setData({
                selectedStoreName: selectedStore.name
              });
            } else {
              console.error('未找到匹配的店铺:', {
                storeId: this.data.storeId,
                availableStores: stores.map(s => ({ id: s.id, name: s.name }))
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

  // 显示筛选弹窗
  showFilter: function () {
    this.setData({
      showFilterModal: true
    });
  },

  // 隐藏筛选弹窗
  hideFilter: function () {
    this.setData({
      showFilterModal: false
    });
  },

  // 防止穿透滑动
  preventTouchMove: function () {
    return false;
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

    // 处理店铺ID，确保它是字符串类型，特殊值处理为空字符串
    let storeId = this.data.storeId;
    if (storeId === undefined || storeId === null || storeId === 0) {
      storeId = '';
    } else {
      storeId = String(storeId);
    }

    // 处理类型ID，确保它是字符串类型，特殊值处理为空字符串
    let typeId = this.data.typeId;
    if (typeId === undefined || typeId === null || typeId === 0) {
      typeId = '';
    } else {
      typeId = String(typeId);
    }

    console.log('筛选处理后的ID值：', {
      storeId: storeId,
      typeId: typeId,
      storeIdType: typeof storeId,
      typeIdType: typeof typeId
    });

    // 更新处理后的值
    this.setData({
      storeId: storeId,
      typeId: typeId
    });

    // 保存筛选设置
    this.saveFilterSettings();

    // 更新筛选状态
    this.updateFilterStatus();

    this.hideFilter();

    // 添加日志
    console.log('即将加载数据 - 最终筛选条件:', {
      storeId: this.data.storeId,
      typeId: this.data.typeId
    });

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
      selectedTypeName: '全部类型',
      timeRange: ''
    });

    // 更新筛选状态
    this.updateFilterStatus();

    // 隐藏筛选面板
    this.hideFilter();

    // 清除本地存储的筛选设置
    wx.removeStorageSync('accountListFilter');

    // 重新加载数据
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 开始日期变更
  bindStartDateChange: function (e) {
    const newStartDate = e.detail.value;

    // 检查日期有效性
    if (!this.isValidDate(newStartDate)) {
      wx.showToast({
        title: '日期格式无效',
        icon: 'none'
      });
      return;
    }

    this.setData({
      startDate: newStartDate,
      timeRange: '' // 清除快速日期选择状态
    });
  },

  // 结束日期变更
  bindEndDateChange: function (e) {
    const newEndDate = e.detail.value;

    // 检查日期有效性
    if (!this.isValidDate(newEndDate)) {
      wx.showToast({
        title: '日期格式无效',
        icon: 'none'
      });
      return;
    }

    this.setData({
      endDate: newEndDate,
      timeRange: '' // 清除快速日期选择状态
    });
  },

  // 检查日期是否有效
  isValidDate: function (dateStr) {
    // 简单验证日期格式 YYYY-MM-DD
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
  },

  // 店铺选择
  bindStoreChange: function (e) {
    const index = e.detail.value;
    if (index === undefined || !this.data.stores || index >= this.data.stores.length) {
      console.error('店铺选择错误: 无效的索引或店铺列表', {
        index: index,
        storesLength: this.data.stores ? this.data.stores.length : 0
      });
      return;
    }

    const storeId = this.data.stores[index].id;
    const storeName = this.data.stores[index].name;

    console.log('选择店铺:', {
      index: index,
      id: storeId,
      name: storeName,
      idType: typeof storeId,
      allStores: JSON.stringify(this.data.stores)
    });

    // 确保storeId是字符串类型并且不为undefined
    this.setData({
      storeId: String(storeId || ''),
      selectedStoreName: storeName || '未知店铺'
    });

    console.log('更新后的店铺ID:', {
      storeId: this.data.storeId,
      type: typeof this.data.storeId
    });
  },

  // 类型选择
  bindTypeChange: function (e) {
    const index = e.detail.value;
    const typeId = this.data.accountTypes[index].id;
    const typeName = this.data.accountTypes[index].name;

    this.setData({
      typeId: typeId,
      selectedTypeName: typeName
    });
  },

  // 金额输入
  onMinAmountInput: function (e) {
    const value = e.detail.value;
    // 只允许输入数字和小数点
    if (value === '' || /^(0|[1-9]\d*)(\.\d{0,2})?$/.test(value)) {
      this.setData({
        minAmount: value
      });
    }
  },

  onMaxAmountInput: function (e) {
    const value = e.detail.value;
    // 只允许输入数字和小数点
    if (value === '' || /^(0|[1-9]\d*)(\.\d{0,2})?$/.test(value)) {
      this.setData({
        maxAmount: value
      });
    }
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

    // 不再在此处验证关键词是否为空，让后端处理
    // if (!keyword) {
    //   wx.showToast({
    //     title: '请输入搜索关键词',
    //     icon: 'none'
    //   });
    //   return;
    // }

    // 记录搜索历史
    this.saveSearchHistory(keyword);

    // 更新筛选状态
    this.updateFilterStatus();

    // 保存筛选设置
    this.saveFilterSettings();

    // 重置并加载数据
    this.loadAccounts(true);
    this.loadStatistics();
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
    // 日期验证
    if (this.data.startDate && this.data.endDate) {
      const start = new Date(this.data.startDate);
      const end = new Date(this.data.endDate);

      if (start > end) {
        wx.showToast({
          title: '开始日期不能大于结束日期',
          icon: 'none'
        });
        return;
      }
    }

    // 更新筛选状态
    this.updateFilterStatus();

    // 保存筛选设置
    this.saveFilterSettings();

    // 重新加载数据
    this.loadAccounts(true);
    this.loadStatistics();
  },

  // 加载统计功能
  loadStatistics: function () {
    // 构建请求参数
    const params = {};

    // 添加筛选条件
    if (this.data.startDate) {
      params.start_date = this.data.startDate;
    }

    if (this.data.endDate) {
      params.end_date = this.data.endDate;
    }

    // 处理店铺ID，使用与loadAccounts相同的逻辑
    if (this.data.storeId !== undefined && this.data.storeId !== null && this.data.storeId !== '') {
      const storeIdStr = String(this.data.storeId);
      if (storeIdStr !== '0') {
        console.log('统计 - 处理店铺ID:', {
          original: this.data.storeId,
          converted: storeIdStr
        });
        params.store_id = storeIdStr;
      } else {
        console.log('统计 - 店铺ID是0，不添加筛选条件');
      }
    }

    // 处理类型ID，使用与loadAccounts相同的逻辑
    if (this.data.typeId !== undefined && this.data.typeId !== null && this.data.typeId !== '') {
      const typeIdStr = String(this.data.typeId);
      if (typeIdStr !== '0') {
        console.log('统计 - 处理类型ID:', {
          original: this.data.typeId,
          converted: typeIdStr
        });
        params.type_id = typeIdStr;
      } else {
        console.log('统计 - 类型ID是0，不添加筛选条件');
      }
    }

    if (this.data.minAmount) {
      const minAmount = parseFloat(this.data.minAmount);
      if (!isNaN(minAmount)) {
        params.min_amount = minAmount;
      }
    }

    if (this.data.maxAmount) {
      const maxAmount = parseFloat(this.data.maxAmount);
      if (!isNaN(maxAmount)) {
        params.max_amount = maxAmount;
      }
    }

    // 调试输出
    console.log('统计参数:', JSON.stringify(params));

    return new Promise((resolve, reject) => {
      // 获取统计数据
      request.get(config.apis.accounts.statistics, params)
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
    console.log('尝试加载店铺详情, ID:', storeId);

    // 尝试首先从已经加载的店铺列表中查找
    if (this.data.stores && this.data.stores.length > 0) {
      const storeFromCache = this.data.stores.find(store => String(store.id) === String(storeId));
      if (storeFromCache) {
        console.log('从已加载的店铺列表中找到店铺:', storeFromCache);
        this.setData({
          selectedStoreName: storeFromCache.name
        });
        return; // 找到店铺，直接返回
      }
    }

    // 如果本地没有，再发起请求获取
    console.log('本地未找到店铺，发起API请求:', `${config.apis.stores.detail}?id=${storeId}`);
    request.get(`${config.apis.stores.detail}`)
      .then(res => {
        if (!res.data || !Array.isArray(res.data)) {
          console.error('返回店铺数据格式错误:', res);
          return;
        }

        // 从返回的店铺列表中查找指定ID的店铺
        const store = res.data.find(item => String(item.id) === String(storeId));
        if (store) {
          console.log('API返回中找到店铺:', store);
          this.setData({
            selectedStoreName: store.name
          });

          // 更新本地店铺列表缓存
          if (!this.data.stores || this.data.stores.length === 0) {
            const stores = [{ id: '', name: '全部店铺' }, ...res.data];
            this.setData({ stores });
          }
        } else {
          console.warn('在API返回中未找到店铺ID:', storeId);
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

  // 保存筛选设置
  saveFilterSettings: function () {
    wx.setStorageSync('accountListFilter', {
      storeId: this.data.storeId,
      typeId: this.data.typeId,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      minAmount: this.data.minAmount,
      maxAmount: this.data.maxAmount,
      timeRange: this.data.timeRange
    });
  },
}) 