import config from '../config/config';

/**
 * 封装wx.request
 */
const request = (method, url, data, headers = {}) => {
  const app = getApp();
  const { token } = app.globalData.userInfo || {};

  return new Promise((resolve, reject) => {
    console.log(`API请求开始: ${method} ${url}`);
    console.log('请求数据:', data);

    // 显示加载图标
    wx.showLoading({
      title: '加载中',
      mask: true
    });

    wx.request({
      url,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...headers
      },
      success: function (res) {
        console.log(`API响应: ${method} ${url}`, res);

        wx.hideLoading();

        if (res.statusCode === 401) {
          // 未授权，跳转到登录页
          wx.showToast({
            title: '登录已过期，请重新登录',
            icon: 'none',
            duration: 2000
          });

          // 清除登录信息
          app.globalData.userInfo = null;
          wx.removeStorageSync('userInfo');

          // 跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 1500);

          reject({ message: '登录已过期', response: res.data });
          return;
        }

        if (res.statusCode >= 400) {
          // 处理错误响应
          const errorMsg = (res.data && res.data.message) ||
            '服务器错误，请稍后再试';

          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });

          reject({
            message: errorMsg,
            response: res.data,
            statusCode: res.statusCode
          });
          return;
        }

        resolve(res.data);
      },
      fail: function (err) {
        console.error(`API请求失败: ${method} ${url}`, err);
        wx.hideLoading();

        // 处理网络错误
        let errorMsg = '网络连接失败，请稍后再试';
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMsg = '请求超时，请稍后再试';
          } else if (err.errMsg.includes('fail')) {
            errorMsg = '网络连接失败，请检查网络设置';
          }
        }

        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        });

        reject({
          message: errorMsg,
          error: err
        });
      }
    });
  });
};

// 请求工具函数
const requestWrapper = (url, options = {}) => {
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
  let showedLoading = false;
  if (!newOptions.hideLoading) {
    wx.showLoading({
      title: '加载中...'
    });
    showedLoading = true;
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
        console.error('请求网络错误:', err, {
          url: newOptions.url
        });

        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });

        reject({
          code: err.errno || 500,
          message: err.errMsg || '网络请求失败',
          originalError: err
        });
      },
      complete: () => {
        // 隐藏加载提示
        if (showedLoading) {
          wx.hideLoading();
        }

        if (typeof options.complete === 'function') {
          options.complete();
        }
      }
    });
  });
};

/**
 * POST请求
 * @param {string} url - 请求地址
 * @param {object} data - 请求数据
 * @param {object} header - 请求头
 * @returns {Promise}
 */
const post = (url, data = {}, header = {}) => {
  // 打印完整请求信息，方便调试
  console.log('POST请求', {
    url,
    data: JSON.stringify(data),
    header
  });

  try {
    // 确保数据符合JSON格式
    const validData = JSON.parse(JSON.stringify(data));

    // 构建完整URL
    const fullUrl = url.startsWith('http') ? url : config.apiBaseUrl + url;

    // 获取用户信息以设置请求头
    const userInfo = wx.getStorageSync('userInfo');
    const userIdHeader = userInfo ? userInfo.id : '';

    // 合并自定义header
    const mergedHeaders = {
      'content-type': 'application/json',
      'X-User-ID': userIdHeader,
      ...header
    };

    console.log('发送请求到:', fullUrl);
    console.log('完整请求头:', mergedHeaders);

    return request('POST', fullUrl, validData, mergedHeaders);
  } catch (error) {
    console.error('数据格式转换错误', error);
    return Promise.reject({
      message: '请求数据格式错误',
      error
    });
  }
};

export default {
  get: (url, options = {}) => requestWrapper(url, { ...options, method: 'GET' }),
  post,
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

    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const userIdHeader = userInfo ? userInfo.id : '';

    // 构建完整的请求头
    const headers = {
      'content-type': 'application/json',
      'X-User-ID': userIdHeader
    };

    // 显示加载提示
    wx.showLoading({
      title: '处理中...',
      mask: true
    });

    // 检查URL格式
    if (!url) {
      console.error('DELETE请求错误: URL为空');
      wx.hideLoading();
      return Promise.reject({
        code: 400,
        message: 'URL不能为空'
      });
    }

    console.log('DELETE请求详情:', {
      url: config.apiBaseUrl + url,
      headers: headers
    });

    return new Promise((resolve, reject) => {
      wx.request({
        url: config.apiBaseUrl + url,
        method: 'DELETE',
        header: headers,
        success: function (res) {
          console.log('DELETE响应状态码:', res.statusCode);
          console.log('DELETE响应数据:', res.data);

          wx.hideLoading();

          if (res.statusCode === 405) {
            console.error('服务器不支持DELETE方法，可能需要使用POST请求模拟DELETE操作');
            reject({
              code: 405,
              message: '服务器不支持DELETE方法',
              response: res.data,
              suggestion: '尝试使用POST请求并添加_method=DELETE参数'
            });
            return;
          }

          if (res.statusCode >= 400) {
            console.error('DELETE请求失败:', {
              statusCode: res.statusCode,
              url: config.apiBaseUrl + url,
              response: res.data
            });

            reject({
              code: res.statusCode,
              message: 'HTTP错误: ' + res.statusCode,
              response: res.data
            });
            return;
          }

          // 处理成功响应
          const responseData = res.data;
          if (responseData && (responseData.code === 200 || responseData.code === 0)) {
            resolve(responseData);
          } else {
            console.error('DELETE请求返回异常数据:', responseData);
            reject(responseData || {
              code: res.statusCode,
              message: '服务器返回异常数据'
            });
          }
        },
        fail: function (err) {
          wx.hideLoading();
          console.error('DELETE请求网络错误:', err, {
            url: config.apiBaseUrl + url
          });

          reject({
            code: err.errno || 500,
            message: err.errMsg || '网络请求失败',
            originalError: err
          });
        }
      });
    });
  },
  // 使用POST方法模拟DELETE操作，用于不支持DELETE方法的服务器
  simulateDelete: function (url) {
    console.log('使用POST模拟DELETE请求:', url);

    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const userIdHeader = userInfo ? userInfo.id : '';

    // 构建请求头
    const headers = {
      'content-type': 'application/json',
      'X-User-ID': userIdHeader,
      'X-HTTP-Method-Override': 'DELETE' // 告诉服务器这是一个DELETE请求
    };

    // 检查URL格式
    if (!url) {
      console.error('模拟DELETE请求错误: URL为空');
      return Promise.reject({
        code: 400,
        message: 'URL不能为空'
      });
    }

    // 处理URL，添加_method参数
    let requestUrl = url;
    if (requestUrl.includes('?')) {
      requestUrl += '&_method=DELETE';
    } else {
      requestUrl += '?_method=DELETE';
    }

    console.log('模拟DELETE详情:', {
      url: config.apiBaseUrl + requestUrl,
      headers: headers
    });

    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: '处理中...',
        mask: true
      });

      wx.request({
        url: config.apiBaseUrl + requestUrl,
        method: 'POST',
        header: headers,
        data: { _method: 'DELETE' }, // 在请求体中也添加方法标识
        success: function (res) {
          wx.hideLoading();
          console.log('模拟DELETE响应:', {
            statusCode: res.statusCode,
            data: res.data
          });

          if (res.statusCode >= 400) {
            console.error('模拟DELETE请求失败:', {
              statusCode: res.statusCode,
              url: config.apiBaseUrl + requestUrl,
              response: res.data
            });

            reject({
              code: res.statusCode,
              message: 'HTTP错误: ' + res.statusCode,
              response: res.data
            });
            return;
          }

          // 处理成功响应
          const responseData = res.data;
          if (responseData && (responseData.code === 200 || responseData.code === 0)) {
            resolve(responseData);
          } else {
            console.error('模拟DELETE请求返回异常数据:', responseData);
            reject(responseData || {
              code: res.statusCode,
              message: '服务器返回异常数据'
            });
          }
        },
        fail: function (err) {
          wx.hideLoading();
          console.error('模拟DELETE请求网络错误:', err, {
            url: config.apiBaseUrl + requestUrl
          });

          reject({
            code: err.errno || 500,
            message: err.errMsg || '网络请求失败',
            originalError: err
          });
        }
      });
    });
  },
}; 