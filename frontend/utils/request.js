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
        // 确保res和res.data存在
        if (!res || res.statusCode !== 200) {
          const errorMsg = res ? `HTTP错误: ${res.statusCode}` : '响应为空';
          console.error(`请求失败: ${errorMsg}`, { url: newOptions.url });

          wx.showToast({
            title: errorMsg,
            icon: 'none'
          });

          return reject({
            code: res ? res.statusCode : 500,
            message: errorMsg
          });
        }

        // 处理没有数据的情况
        if (!res.data) {
          const errorMsg = '服务器返回的数据为空';
          console.error(errorMsg, { url: newOptions.url });

          wx.showToast({
            title: errorMsg,
            icon: 'none'
          });

          return reject({
            code: 500,
            message: errorMsg
          });
        }

        // 处理正常的API响应
        if (res.data.code === 200) {
          // 返回完整响应，让业务代码决定如何提取数据
          resolve(res.data);
        } else {
          const errorMessage = res.data.message || '请求失败';

          wx.showToast({
            title: errorMessage,
            icon: 'none'
          });

          // 返回错误信息
          reject({
            code: res.data.code || 500,
            message: errorMessage,
            data: res.data
          });
        }
      },
      fail: (err) => {
        const errorMsg = err ? (err.errMsg || '网络请求失败') : '网络请求失败';
        console.error(`请求失败: ${errorMsg}`, { url: newOptions.url, error: err });

        wx.showToast({
          title: errorMsg,
          icon: 'none'
        });

        reject({
          code: err ? (err.errno || 500) : 500,
          message: errorMsg,
          originalError: err
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
  post: function (url, data = {}, options = {}) {
    // 打印完整的请求信息用于调试
    console.log('发送POST请求详情:', {
      url: url,
      data: data,
      dataString: JSON.stringify(data), // 显示字符串化的数据
      options: options
    });

    // 确保URL不包含额外的查询参数
    const cleanUrl = url.split('?')[0]; // 移除可能存在的查询字符串

    // 获取用户信息以设置请求头
    const userInfo = wx.getStorageSync('userInfo');
    const userIdHeader = userInfo ? userInfo.id : '';

    // 准备请求头
    const headers = {
      'content-type': 'application/json',
      'X-User-ID': userIdHeader,
      ...(options.header || {}) // 合并自定义header
    };

    console.log('请求头:', headers);
    console.log('准备发送的JSON数据:', JSON.stringify(data));

    return new Promise((resolve, reject) => {
      wx.request({
        url: config.apiBaseUrl + cleanUrl,
        method: 'POST',
        data: data,
        header: headers,
        success: function (res) {
          console.log('收到响应:', {
            statusCode: res.statusCode,
            headers: res.header,
            data: res.data
          });

          if (res.statusCode >= 400) {
            console.log('请求失败: HTTP错误:', res.statusCode, {
              url: config.apiBaseUrl + cleanUrl,
              response: res.data
            });
            reject({
              code: res.statusCode,
              message: 'HTTP错误: ' + res.statusCode,
              response: res.data
            });
            return;
          }

          // 特殊处理服务器返回的数据格式
          const responseData = res.data;
          if (responseData && (responseData.code === 200 || responseData.code === 0)) {
            resolve(responseData);
          } else {
            console.log('请求异常:', responseData);
            reject(responseData || {
              code: res.statusCode,
              message: '服务器返回异常数据'
            });
          }
        },
        fail: function (err) {
          console.error('请求失败:', err, { url: config.apiBaseUrl + cleanUrl, data: data });
          reject(err);
        },
        complete: function () {
          // options中的其他功能如hideLoading等可以在这里处理
        }
      });
    });
  },
  put: function (url, data = {}, options = {}) {
    // 处理两种不同的调用方式
    // 1. put(url, data, options)
    // 2. put({ url, data, success, fail })
    let requestUrl, requestData, successCallback, failCallback;

    if (typeof url === 'object') {
      // 处理对象参数格式
      const params = url;
      requestUrl = params.url;
      requestData = params.data || {};
      successCallback = params.success;
      failCallback = params.fail;
      options = {};
    } else {
      // 标准参数格式
      requestUrl = url;
      requestData = data;
      successCallback = null;
      failCallback = null;
    }

    console.log('发送PUT请求:', requestUrl, requestData);

    // 确保URL不包含额外的查询参数
    const cleanUrl = requestUrl.split('?')[0]; // 移除可能存在的查询字符串

    // 获取用户信息以设置请求头
    const userInfo = wx.getStorageSync('userInfo');
    const userIdHeader = userInfo ? userInfo.id : '';

    // 准备请求头
    const headers = {
      'content-type': 'application/json',
      'X-User-ID': userIdHeader,
      ...(options.header || {}) // 合并自定义header
    };

    const requestPromise = new Promise((resolve, reject) => {
      wx.request({
        url: config.apiBaseUrl + cleanUrl,
        method: 'PUT',
        data: requestData,
        header: headers,
        success: function (res) {
          if (res.statusCode >= 400) {
            console.log('请求失败: HTTP错误:', res.statusCode, {
              url: config.apiBaseUrl + cleanUrl,
              response: res.data
            });

            const error = {
              code: res.statusCode,
              message: 'HTTP错误: ' + res.statusCode,
              response: res.data
            };

            if (failCallback) {
              failCallback(error);
            }

            reject(error);
            return;
          }

          // 特殊处理服务器返回的数据格式
          const responseData = res.data;
          if (responseData && (responseData.code === 200 || responseData.code === 0)) {
            if (successCallback) {
              successCallback(responseData);
            }
            resolve(responseData);
          } else {
            console.log('请求异常:', responseData);

            const error = responseData || {
              code: res.statusCode,
              message: '服务器返回异常数据'
            };

            if (failCallback) {
              failCallback(error);
            }

            reject(error);
          }
        },
        fail: function (err) {
          console.error('请求失败:', err, { url: config.apiBaseUrl + cleanUrl, data: requestData });

          if (failCallback) {
            failCallback(err);
          }

          reject(err);
        },
        complete: function () {
          // 完成处理
        }
      });
    });

    // 如果有回调，处理Promise，否则返回Promise
    return requestPromise;
  },
  delete: function (url) {
    console.log('发送DELETE请求:', url);

    // 不再移除查询参数
    // const cleanUrl = url.split('?')[0]; // 这行代码会移除查询参数，导致后端无法获取到用户ID

    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: '处理中...',
        mask: true
      });

      wx.request({
        url: config.apiBaseUrl + url, // 使用完整URL，包括查询参数
        method: 'DELETE',
        header: {
          'content-type': 'application/json',
          'X-User-ID': wx.getStorageSync('userInfo') ? wx.getStorageSync('userInfo').id : ''
        },
        success: function (res) {
          wx.hideLoading();
          if (res.statusCode >= 400) {
            console.log('请求失败: HTTP错误:', res.statusCode, { url: config.apiBaseUrl + url });
            reject({
              code: res.statusCode,
              message: 'HTTP错误: ' + res.statusCode,
              response: res.data
            });
            return;
          }

          // 特殊处理服务器返回的数据格式
          const responseData = res.data;
          if (responseData && (responseData.code === 200 || responseData.code === 0)) {
            resolve(responseData);
          } else {
            console.log('请求异常:', responseData);
            reject(responseData || {
              code: res.statusCode,
              message: '服务器返回异常数据'
            });
          }
        },
        fail: function (err) {
          wx.hideLoading();
          console.error('请求失败:', err, { url: config.apiBaseUrl + url });
          reject(err);
        },
        complete: function () {
          // wx.hideLoading() 移至success和fail中以避免race condition
        }
      });
    });
  }
}; 