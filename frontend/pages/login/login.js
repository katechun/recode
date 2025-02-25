Page({
  data: {
    username: '',
    password: '',
    errorMsg: ''
  },

  onLoad(options) {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      wx.switchTab({
        url: '/pages/index/index',
      });
    }
  },

  // 输入用户名
  inputUsername(e) {
    this.setData({
      username: e.detail.value,
      errorMsg: ''
    });
  },

  // 输入密码
  inputPassword(e) {
    this.setData({
      password: e.detail.value,
      errorMsg: ''
    });
  },

  // 登录
  login() {
    const { username, password } = this.data;
    
    // 表单验证
    if (!username.trim()) {
      this.setData({ errorMsg: '请输入用户名' });
      return;
    }
    
    if (!password.trim()) {
      this.setData({ errorMsg: '请输入密码' });
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '登录中...',
    });
    
    // 调用登录接口
    wx.request({
      url: 'http://localhost:8080/api/login',
      method: 'POST',
      data: {
        username: username,
        password: password
      },
      success: (res) => {
        wx.hideLoading();
        
        const { code, message, data } = res.data;
        
        if (code === 200 && data) {
          // 登录成功，保存用户信息
          wx.setStorageSync('userInfo', data);
          
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index',
          });
        } else {
          // 登录失败，显示错误信息
          this.setData({
            errorMsg: message || '登录失败，请检查用户名和密码'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('登录请求失败', err);
        
        // 处理网络错误或服务器错误
        this.setData({
          errorMsg: '网络请求失败，请检查网络连接或服务器状态'
        });
        
        // 如果是开发环境，添加一个测试跳过登录的选项
        if (process.env.NODE_ENV === 'development') {
          wx.showModal({
            title: '开发环境提示',
            content: '是否跳过登录直接进入首页？(仅开发环境有效)',
            success: (res) => {
              if (res.confirm) {
                // 模拟一个用户信息
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
              }
            }
          });
        }
      }
    });
  },

  testConnection: function() {
    wx.request({
      url: 'http://localhost:8080/api/debug/users',
      method: 'GET',
      success: (res) => {
        console.log('服务器连接成功，用户数据:', res.data);
        wx.showModal({
          title: '测试结果',
          content: `服务器连接成功，发现${res.data.data ? res.data.data.length : 0}个用户`,
          showCancel: false
        });
      },
      fail: (err) => {
        console.error('服务器连接失败:', err);
        wx.showModal({
          title: '测试结果',
          content: '服务器连接失败，请检查后端是否启动',
          showCancel: false
        });
      }
    });
  }
}) 