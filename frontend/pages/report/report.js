// pages/report/report.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    startDate: '',
    endDate: '',
    stores: [],
    selectedStoreId: '',
    incomeData: [], // 收入数据
    expenseData: [], // 支出数据
    showIncome: true // 控制显示收入还是支出报表
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }

    // 设置默认日期范围为本月
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = this.formatDate(now);

    this.setData({ 
      userInfo,
      startDate,
      endDate
    });

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
    this.loadReportData();
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

  // 格式化日期为YYYY-MM-DD
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  // 加载用户可访问的店铺
  loadStores() {
    wx.request({
      url: config.apiBaseUrl+'/api/stores',
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

  // 加载报表数据
  loadReportData() {
    // 显示加载提示
    wx.showLoading({
      title: '加载中',
    });

    // 请求账务数据进行分析
    wx.request({
      url: config.apiBaseUrl+'/api/accounts',
      method: 'GET',
      data: {
        store_id: this.data.selectedStoreId,
        start_date: this.data.startDate,
        end_date: this.data.endDate
      },
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.data.code === 200 && res.data.data) {
          const accounts = res.data.data;
          
          // 分析收入和支出数据
          this.analyzeData(accounts);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      }
    });
  },

  // 分析数据，生成报表数据
  analyzeData(accounts) {
    // 按类型分组
    const incomeByType = {};
    const expenseByType = {};
    
    accounts.forEach(item => {
      const { type_id, type_name, amount } = item;
      
      if (amount > 0) { // 收入
        if (!incomeByType[type_id]) {
          incomeByType[type_id] = {
            type_id,
            type_name,
            total: 0,
            count: 0
          };
        }
        incomeByType[type_id].total += amount;
        incomeByType[type_id].count += 1;
      } else if (amount < 0) { // 支出
        if (!expenseByType[type_id]) {
          expenseByType[type_id] = {
            type_id,
            type_name,
            total: 0,
            count: 0
          };
        }
        expenseByType[type_id].total += Math.abs(amount);
        expenseByType[type_id].count += 1;
      }
    });
    
    // 转换为数组并排序
    const incomeData = Object.values(incomeByType).sort((a, b) => b.total - a.total);
    const expenseData = Object.values(expenseByType).sort((a, b) => b.total - a.total);
    
    // 计算百分比
    const totalIncome = incomeData.reduce((sum, item) => sum + item.total, 0);
    const totalExpense = expenseData.reduce((sum, item) => sum + item.total, 0);
    
    incomeData.forEach(item => {
      item.percentage = totalIncome ? (item.total / totalIncome * 100).toFixed(2) : 0;
    });
    
    expenseData.forEach(item => {
      item.percentage = totalExpense ? (item.total / totalExpense * 100).toFixed(2) : 0;
    });
    
    this.setData({
      incomeData,
      expenseData
    });
  },

  // 开始日期选择
  bindStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    });
    this.loadReportData();
  },

  // 结束日期选择
  bindEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    });
    this.loadReportData();
  },

  // 店铺选择
  bindStoreChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedStoreId: this.data.stores[index].id
    });
    this.loadReportData();
  },

  // 切换展示收入/支出报表
  toggleReportType() {
    this.setData({
      showIncome: !this.data.showIncome
    });
  }
})