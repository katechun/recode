import config from '../config/config';

// 请求工具函数
const request = (url, options = {}) => {
  const defaultOptions = {
    header: {
      'content-type': 'application/json'
    }
  };

  // 添加用户认证信息
  const userInfo = wx.getStorageSync('userInfo');
  if (userInfo && userInfo.id) {
    defaultOptions.header['X-User-ID'] = userInfo.id;
  }

  // 合并配置
  const newOptions = {
    ...defaultOptions,
    ...options,
    url: `${config.apiBaseUrl}${url}`
  };

  // 显示加载提示
  if (!newOptions.hideLoading) {
    wx.showLoading({
      title: '加载中...'
    });
  }

  return new Promise((resolve, reject) => {
    wx.request({
      ...newOptions,
      success: (res) => {
        if (res.data.code === 200) {
          // 返回响应数据
          resolve({
            code: res.data.code,
            message: res.data.message,
            data: res.data.data
          });
        } else {
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          });
          // 返回错误信息
          reject({
            code: res.data.code,
            message: res.data.message
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        reject({
          code: -1,
          message: '网络请求失败'
        });
      },
      complete: () => {
        if (!newOptions.hideLoading) {
          wx.hideLoading();
        }
      }
    });
  });
};

export default {
  get: (url, options = {}) => request(url, { ...options, method: 'GET' }),
  post: (url, data, options = {}) => {
    // 登录接口不需要验证登录状态
    if (url === config.apis.login) {
      return request(url, { ...options, method: 'POST', data });
    }
    
    // 其他接口需要验证登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '您尚未登录或登录已过期',
        icon: 'none'
      });
      
      // 延迟跳转回登录页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 1500);
      
      return Promise.reject({
        code: 401,
        message: '未登录'
      });
    }
    
    // 打印请求数据
    console.log(`发送POST请求: ${url}`, data);
    
    return request(url, { 
      ...options, 
      method: 'POST', 
      data,
      // 添加调试信息  
      success: (res) => {
        console.log(`API请求成功: ${url}`, res);
      },
      fail: (err) => {
        console.error(`API请求失败: ${url}`, err);
        console.log('请求数据:', data);
      }
    });
  },
  put: (url, data, options = {}) => request(url, { ...options, method: 'PUT', data }),
  delete: (url, options = {}) => request(url, { ...options, method: 'DELETE' })
}; 