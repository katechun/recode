// pages/report/report.js
import * as echarts from '../../ec-canvas/echarts';
import request from '../../utils/request';
import config from '../../config/config';
import dayjs from '../../utils/dayjs.min.js';

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
    showIncome: true, // 控制显示收入还是支出报表
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
    this.loadReportData();
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
    this.setData({ isLoading: true });
    
    const params = {
      timeRange: this.data.timeRange,
      storeId: this.data.selectedStoreId
    };
    
    // 获取收支统计数据
    request.get(config.apis.statistics.report, params)
      .then(res => {
        const reportData = res.data;
        
        // 处理总览数据
        this.setData({
          totalIncome: this.formatAmount(reportData.totalIncome || 0),
          totalExpense: this.formatAmount(Math.abs(reportData.totalExpense) || 0),
          netIncome: this.formatAmount(reportData.netIncome || 0)
        });
        
        // 处理图表数据
        this.processChartData(reportData);
        
        // 处理分类数据
        this.processCategoryData(reportData);
        
        // 渲染图表
        this.renderCharts();
      })
      .catch(err => {
        console.error('获取报表数据失败:', err);
        wx.showToast({
          title: '获取报表数据失败',
          icon: 'none'
        });
      })
      .finally(() => {
        this.setData({ isLoading: false });
      });
  },

  // 处理图表数据
  processChartData(reportData) {
    // 处理趋势图数据
    const trendData = reportData.trend || [];
    
    // 处理对比图数据
    const compareData = reportData.compare || [];
    
    this.setData({
      'chartData.trend': trendData,
      'chartData.compare': compareData
    });
  },

  // 处理分类数据
  processCategoryData(reportData) {
    const categoryType = this.data.categoryType;
    const categoryData = reportData[categoryType + 'Categories'] || [];
    
    // 计算总额
    const total = categoryData.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    
    // 计算百分比
    const processedData = categoryData.map(item => {
      const percentage = total > 0 ? (Math.abs(item.amount) / total * 100).toFixed(1) : 0;
      return {
        ...item,
        amount: this.formatAmount(Math.abs(item.amount)),
        percentage
      };
    });
    
    // 按金额排序
    processedData.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    
    this.setData({ categoryData: processedData });
  },

  // 渲染图表
  renderCharts() {
    this.renderTrendChart();
    this.renderCompareChart();
  },

  // 渲染趋势图
  renderTrendChart() {
    const ctx = wx.createCanvasContext('trend-chart');
    const trendData = this.data.chartData.trend;
    
    if (!trendData || trendData.length === 0) {
      this.drawEmptyChart(ctx, '暂无趋势数据');
      return;
    }
    
    // 提取日期和数据
    const dates = trendData.map(item => this.formatDateLabel(item.date));
    const incomeData = trendData.map(item => item.income);
    const expenseData = trendData.map(item => Math.abs(item.expense));
    
    // 计算图表尺寸和位置
    const canvasWidth = 300; // 设定适当的宽度
    const canvasHeight = 200; // 设定适当的高度
    const padding = { top: 30, right: 20, bottom: 30, left: 50 };
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;
    
    // 计算数据最大值
    const maxValue = Math.max(
      ...incomeData,
      ...expenseData,
      1 // 确保最小为1，避免所有数据为0的情况
    );
    
    // 绘制背景和坐标轴
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制水平线
    ctx.setStrokeStyle('#eeeeee');
    ctx.setLineWidth(1);
    
    const yStep = chartHeight / 5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + i * yStep;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      
      // 绘制Y轴标签
      const labelValue = (maxValue * (5 - i) / 5).toFixed(0);
      ctx.setFillStyle('#999999');
      ctx.setTextAlign('right');
      ctx.setFontSize(10);
      ctx.fillText(labelValue, padding.left - 5, y + 4);
    }
    
    // 绘制收入曲线
    this.drawCurve(ctx, padding, chartWidth, chartHeight, dates.length, incomeData, maxValue, '#52c41a', '收入');
    
    // 绘制支出曲线
    this.drawCurve(ctx, padding, chartWidth, chartHeight, dates.length, expenseData, maxValue, '#f5222d', '支出');
    
    // 绘制X轴日期标签
    const xStep = chartWidth / (dates.length - 1);
    ctx.setFillStyle('#999999');
    ctx.setTextAlign('center');
    ctx.setFontSize(10);
    
    dates.forEach((date, index) => {
      // 根据日期数量，可能需要跳过一些标签避免拥挤
      if (dates.length <= 10 || index % Math.ceil(dates.length / 10) === 0) {
        const x = padding.left + index * xStep;
        const y = padding.top + chartHeight + 15;
        ctx.fillText(date, x, y);
      }
    });
    
    ctx.draw();
  },

  // 绘制曲线
  drawCurve(ctx, padding, chartWidth, chartHeight, pointCount, data, maxValue, color, label) {
    const xStep = chartWidth / (pointCount - 1);
    
    // 绘制曲线
    ctx.beginPath();
    ctx.setStrokeStyle(color);
    ctx.setLineWidth(2);
    
    data.forEach((value, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (value / maxValue * chartHeight);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // 绘制数据点
    data.forEach((value, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (value / maxValue * chartHeight);
      
      ctx.beginPath();
      ctx.setFillStyle(color);
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 绘制图例
    ctx.setFillStyle(color);
    ctx.beginPath();
    ctx.rect(padding.left + 100 * (label === '收入' ? 0 : 1), padding.top - 15, 10, 10);
    ctx.fill();
    
    ctx.setFillStyle('#333333');
    ctx.setTextAlign('left');
    ctx.setFontSize(10);
    ctx.fillText(label, padding.left + 115 * (label === '收入' ? 0 : 1), padding.top - 7);
  },

  // 渲染对比图
  renderCompareChart() {
    const ctx = wx.createCanvasContext('compare-chart');
    const compareData = this.data.chartData.compare;
    
    if (!compareData || compareData.length === 0) {
      this.drawEmptyChart(ctx, '暂无对比数据');
      return;
    }
    
    // 提取数据
    const categories = compareData.map(item => item.category);
    const incomeData = compareData.map(item => item.income);
    const expenseData = compareData.map(item => Math.abs(item.expense));
    
    // 计算图表尺寸和位置
    const canvasWidth = 300;
    const canvasHeight = 200;
    const padding = { top: 40, right: 20, bottom: 30, left: 50 };
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;
    
    // 计算最大值
    const maxValue = Math.max(
      ...incomeData,
      ...expenseData,
      1
    );
    
    // 绘制背景和坐标轴
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制水平线
    ctx.setStrokeStyle('#eeeeee');
    ctx.setLineWidth(1);
    
    const yStep = chartHeight / 5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + i * yStep;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      
      // 绘制Y轴标签
      const labelValue = (maxValue * (5 - i) / 5).toFixed(0);
      ctx.setFillStyle('#999999');
      ctx.setTextAlign('right');
      ctx.setFontSize(10);
      ctx.fillText(labelValue, padding.left - 5, y + 4);
    }
    
    // 绘制柱状图
    const barWidth = chartWidth / categories.length / 3; // 每组柱子的宽度
    const groupWidth = barWidth * 3; // 分组宽度（包含两个柱子和间距）
    
    categories.forEach((category, index) => {
      const x = padding.left + index * groupWidth + barWidth / 2;
      
      // 收入柱
      const incomeHeight = incomeData[index] / maxValue * chartHeight;
      ctx.setFillStyle('#52c41a');
      ctx.fillRect(x, padding.top + chartHeight - incomeHeight, barWidth, incomeHeight);
      
      // 支出柱
      const expenseHeight = expenseData[index] / maxValue * chartHeight;
      ctx.setFillStyle('#f5222d');
      ctx.fillRect(x + barWidth, padding.top + chartHeight - expenseHeight, barWidth, expenseHeight);
      
      // 绘制X轴类别标签
      ctx.setFillStyle('#999999');
      ctx.setTextAlign('center');
      ctx.setFontSize(9);
      ctx.fillText(this.formatCategoryLabel(category), x + barWidth / 2, padding.top + chartHeight + 15);
    });
    
    // 绘制图例
    ctx.setFillStyle('#52c41a');
    ctx.beginPath();
    ctx.rect(padding.left, padding.top - 25, 10, 10);
    ctx.fill();
    
    ctx.setFillStyle('#333333');
    ctx.setTextAlign('left');
    ctx.setFontSize(10);
    ctx.fillText('收入', padding.left + 15, padding.top - 17);
    
    ctx.setFillStyle('#f5222d');
    ctx.beginPath();
    ctx.rect(padding.left + 60, padding.top - 25, 10, 10);
    ctx.fill();
    
    ctx.setFillStyle('#333333');
    ctx.fillText('支出', padding.left + 75, padding.top - 17);
    
    ctx.draw();
  },

  // 绘制空图表
  drawEmptyChart(ctx, message) {
    const canvasWidth = 300;
    const canvasHeight = 200;
    
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.setFillStyle('#cccccc');
    ctx.setTextAlign('center');
    ctx.setFontSize(14);
    ctx.fillText(message, canvasWidth / 2, canvasHeight / 2);
    
    ctx.draw();
  },

  // 格式化金额
  formatAmount(amount) {
    return parseFloat(amount).toFixed(2);
  },

  // 格式化日期标签
  formatDateLabel(dateString) {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    switch (this.data.timeRange) {
      case 'day':
        return `${day}日${date.getHours()}时`;
      case 'week':
        return `${month}/${day}`;
      case 'month':
        return `${day}日`;
      case 'year':
        return `${month}月`;
      default:
        return `${month}/${day}`;
    }
  },

  // 格式化类别标签
  formatCategoryLabel(label) {
    // 如果标签太长，截断并添加省略号
    if (label.length > 4) {
      return label.substring(0, 4) + '...';
    }
    return label;
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