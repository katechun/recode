// app.js
App({
  onLaunch: function () {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      // 未登录，跳转到登录页
      wx.reLaunch({
        url: '/pages/login/login',
      });
    }

    // 添加调试功能，在控制台执行 wx.testLogin() 可以手动设置登录状态
    wx.testLogin = function() {
      const mockUserInfo = {
        id: 1,
        username: 'admin',
        nickname: '管理员',
        role: 1
      };
      wx.setStorageSync('userInfo', mockUserInfo);
      wx.switchTab({
        url: '/pages/index/index',
      });
      console.log('已模拟登录，用户信息:', mockUserInfo);
    };
  },
  globalData: {
    userInfo: null,
    lastError: null
  },
  onError: function(error) {
    console.error('应用错误:', error);
    
    // 记录最后一次错误
    this.globalData.lastError = error;
    
    // 对于WXML错误的特殊处理
    if (error.indexOf('WXML') > -1) {
      console.log('检测到WXML错误，尝试重置页面数据');
      
      // 可以添加一些恢复逻辑
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        // 重置当前页面的关键数据
        currentPage.setData({
          stores: [],
          recentRecords: []
          // 添加其他可能导致问题的数据
        });
      }
    }
  }
})
