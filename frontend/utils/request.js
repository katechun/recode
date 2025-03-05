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

  // 在URL参数中也添加用户ID
  if (url.indexOf('?') > -1) {
    // URL已有参数，添加userId参数
    url += `&userId=${userInfo?.id || ''}`;
  } else {
    // URL没有参数，添加第一个参数
    url += `?userId=${userInfo?.id || ''}`;
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
          // 返回完整响应，让业务代码决定如何提取数据
          resolve(res.data);
        } else {
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          });
          // 返回错误信息
          reject(res.data);
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        reject(err);
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
    if (!url) {
      console.error('POST请求的路径为空');
      return Promise.reject({errno: 600009, errMsg: "API路径为空"});
    }
    
    // 确保path以/开头
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    const fullUrl = config.apiBaseUrl + url;
    console.log('发送POST请求:', url, data); // 记录路径而不是完整URL，便于调试
    
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
  delete: (url, options = {}) => {
    console.log(`发起DELETE请求: ${url}`);
    
    // 确保传入的是有效URL
    if (!url || url.indexOf('undefined') !== -1) {
      console.error('无效的API URL:', url);
      return Promise.reject({
        code: -1,
        message: '无效的API URL'
      });
    }
    
    // 显示加载状态
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    return request(url, { 
      ...options, 
      method: 'DELETE'
    }).then(res => {
      wx.hideLoading();
      return res;
    }).catch(err => {
      wx.hideLoading();
      console.error(`DELETE请求失败: ${url}`, err);
      throw err;
    });
  }
}; 