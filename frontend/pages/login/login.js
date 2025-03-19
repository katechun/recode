import request from '../../utils/request';
import config from '../../config/config';

Page({
  data: {
    username: '',
    password: '',
    errorMsg: '',
    isLoading: false
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
  usernameInput(e) {
    this.setData({
      username: e.detail.value,
      errorMsg: ''
    });
  },

  // 输入密码
  passwordInput(e) {
    this.setData({
      password: e.detail.value,
      errorMsg: ''
    });
  },

  // 登录处理
  handleLogin(e) {
    this.login();
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

    // 显示加载状态
    this.setData({
      isLoading: true
    });

    // 使用微信小程序的环境判断
    const envVersion = __wxConfig.envVersion;
    if (envVersion === 'develop') {
      console.log('开发环境登录');
    }

    // 调用登录接口
    request.post(config.apis.login, {
      username: username,
      password: password
    }).then(res => {
      this.setData({
        isLoading: false
      });

      const userInfo = res.data;

      if (userInfo) {
        // 登录成功，保存用户信息
        wx.setStorageSync('userInfo', userInfo);

        // 跳转到首页
        wx.switchTab({
          url: '/pages/index/index',
        });
      } else {
        // 登录失败，显示错误信息
        this.setData({
          errorMsg: '登录失败，请检查用户名和密码'
        });
      }
    }).catch(err => {
      this.setData({
        isLoading: false
      });

      console.error('登录请求失败', err);
      console.log('错误详情:', err.code, err.message);
      console.log('请求URL:', config.apis.login);
      console.log('请求数据:', { username: this.data.username });

      this.setData({
        errorMsg: '登录失败，请检查网络连接'
      });

      // 如果是开发环境，添加一个测试跳过登录的选项
      if (envVersion === 'develop') {
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
    });
  },

  testConnection: function () {
    request.get('/api/debug/users', { hideLoading: true })
      .then(res => {
        console.log('服务器连接成功，用户数据:', res.data);
        wx.showModal({
          title: '测试结果',
          content: `服务器连接成功，发现${res.data ? res.data.length : 0}个用户`,
          showCancel: false
        });
      })
      .catch(err => {
        console.error('服务器连接失败:', err);
        wx.showModal({
          title: '测试结果',
          content: '服务器连接失败，请检查后端是否启动',
          showCancel: false
        });
      });
  }
}) 