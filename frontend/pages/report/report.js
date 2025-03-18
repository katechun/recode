// pages/report/report.js
// 移除 ECharts 导入，改用简单 canvas 绘图
// import * as echarts from '../../ec-canvas/echarts';
import request from '../../utils/request';
import config from '../../config/config';
// 移除 dayjs 导入
// import dayjs from '../../utils/dayjs.min.js';

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
    timeRange: 'month', // 默认显示本月数据
    chartType: 'trend', // 默认显示趋势图
    categoryType: 'expense', // 默认显示支出分类
    isLoading: false,
    totalIncome: '0.00',
    totalExpense: '0.00',
    netIncome: '0.00',
    selectedStore: null,
    storePickerVisible: false,
    chartData: {
      trend: [],
      compare: []
    },
    // 格式化后的数据
    formattedTrendData: [],
    formattedCompareData: [],
    categoryData: []
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

  // 加载店铺列表
  loadStores() {
    request.get(config.apis.stores.list)
      .then(res => {
        if (res.data) {
          // 添加"全部店铺"选项
          const stores = [{ id: '', name: '全部店铺' }].concat(res.data);
          this.setData({ stores });
        }
      })
      .catch(err => {
        console.error('加载店铺失败:', err);
        wx.showToast({
          title: '加载店铺失败',
          icon: 'none'
        });
      });
  },

  // 加载报表数据
  loadReportData() {
    this.setData({ isLoading: true });

    // 构建参数对象
    const params = {};

    // 添加时间范围参数
    params.timeRange = this.data.timeRange;

    // 如果选择了特定店铺，添加店铺ID
    if (this.data.selectedStoreId) {
      params.storeId = this.data.selectedStoreId;
    }

    console.log('加载报表数据，参数:', params);

    // 用户ID已经在request工具函数中添加了
    request.get(config.apis.statistics.report, params)
      .then(res => {
        console.log('报表数据返回:', res);

        if (res.code === 200 && res.data) {
          const reportData = res.data;

          this.setData({
            totalIncome: this.formatAmount(reportData.totalIncome || 0),
            totalExpense: this.formatAmount(Math.abs(reportData.totalExpense) || 0),
            netIncome: this.formatAmount(reportData.netIncome || 0),
            chartData: reportData
          });

          // 处理趋势数据 - 预先格式化
          const formattedTrendData = (reportData.trend || []).map(item => ({
            date: item.date,
            income: this.formatAmount(item.income || 0),
            expense: this.formatAmount(Math.abs(item.expense || 0)),
            net: this.formatAmount(item.net || 0),
            isPositive: parseFloat(item.net) >= 0
          }));

          // 处理对比数据 - 预先格式化
          const formattedCompareData = (reportData.compare || []).map(item => ({
            category: item.category,
            income: this.formatAmount(item.income || 0),
            expense: this.formatAmount(Math.abs(item.expense || 0)),
            net: this.formatAmount(item.net || 0),
            isPositive: parseFloat(item.net) >= 0
          }));

          this.setData({
            formattedTrendData,
            formattedCompareData
          });

          // 处理分类数据
          this.processCategoryData(reportData);
        } else {
          wx.showToast({
            title: res.message || '数据加载失败',
            icon: 'none'
          });
        }
        this.setData({ isLoading: false });
      })
      .catch(err => {
        console.error('获取报表数据失败:', err);
        this.setData({
          isLoading: false,
          // 清空数据以避免显示旧数据
          formattedTrendData: [],
          formattedCompareData: [],
          categoryData: [],
          totalIncome: '0.00',
          totalExpense: '0.00',
          netIncome: '0.00'
        });

        wx.hideLoading(); // 确保隐藏所有加载提示

        // 显示更详细的错误信息
        wx.showToast({
          title: err.message || '数据加载失败，请稍后重试',
          icon: 'none',
          duration: 3000
        });
      });
  },

  // 处理分类数据
  processCategoryData(reportData) {
    let categoryData = [];
    let totalAmount = 0;

    if (this.data.categoryType === 'income') {
      categoryData = reportData.incomeCategories || [];
      totalAmount = parseFloat(reportData.totalIncome) || 0;
    } else {
      categoryData = reportData.expenseCategories || [];
      totalAmount = Math.abs(parseFloat(reportData.totalExpense)) || 0;
    }

    // 计算百分比
    categoryData = categoryData.map(item => {
      const itemAmount = Math.abs(parseFloat(item.amount) || 0);
      return {
        ...item,
        amount: this.formatAmount(itemAmount),
        percentage: totalAmount > 0 ?
          ((itemAmount / totalAmount) * 100).toFixed(2) : 0
      };
    });

    this.setData({ categoryData });
  },

  // 格式化金额
  formatAmount(amount) {
    return parseFloat(amount).toFixed(2);
  },

  // 改变时间范围
  changeTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    this.loadReportData();
  },

  // 改变图表类型
  changeChartType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ chartType: type });
  },

  // 改变分类类型
  changeCategoryType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ categoryType: type });
    // 重新处理分类数据
    this.processCategoryData(this.data.chartData);
  },

  // 显示店铺选择器
  showStorePicker() {
    this.setData({ storePickerVisible: true });
  },

  // 关闭店铺选择器
  closeStorePicker() {
    this.setData({ storePickerVisible: false });
  },

  // 选择店铺
  selectStore(e) {
    const storeId = e.currentTarget.dataset.id;
    const storeName = e.currentTarget.dataset.name;

    this.setData({
      selectedStoreId: storeId,
      selectedStore: { id: storeId, name: storeName },
      storePickerVisible: false
    });

    this.loadReportData();
  },

  // 阻止事件冒泡
  stopPropagation() {
    return;
  }
})