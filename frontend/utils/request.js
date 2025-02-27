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
  post: (url, data, options = {}) => request(url, { ...options, method: 'POST', data }),
  put: (url, data, options = {}) => request(url, { ...options, method: 'PUT', data }),
  delete: (url, options = {}) => request(url, { ...options, method: 'DELETE' })
}; 