const baseUrl = config.apiBaseUrl;
const apiEndpoints = {
  createAccount: '/api/accounts/create',
  getAccounts: '/api/accounts',
  getAccountTypes: '/api/account-types',
  getStores: '/api/stores',
  login: '/api/login',
  // 其他API端点...
};

function request(options) {
  const { url, method, data, header } = options;

  // URL验证
  if (!url || url.includes('undefined')) {
    console.error('无效的API URL:', url);
    return Promise.reject({ errno: 600009, errMsg: '无效的API URL' });
  }

  return new Promise((resolve, reject) => {
    wx.showLoading({
      title: '加载中...',
    });

    wx.request({
      url,
      method: method || 'GET',
      data,
      header: header || {
        'content-type': 'application/json'
      },
      success(res) {
        resolve(res.data);
      },
      fail(err) {
        console.error('请求失败:', url, err);
        reject(err);
      },
      complete() {
        wx.hideLoading();
      }
    });
  });
}

function get(path, params) {
  const fullUrl = baseUrl + path;
  return request({
    url: fullUrl,
    method: 'GET',
    data: params
  });
}

function post(path, data) {
  if (!path) {
    console.error('POST请求的路径为空');
    return Promise.reject({ errno: 600009, errMsg: "API路径为空" });
  }

  const fullUrl = baseUrl + path;
  console.log('发送POST请求:', fullUrl, data);

  return request({
    url: fullUrl,
    method: 'POST',
    data
  });
}

function createAccount(data) {
  return post(apiEndpoints.createAccount, data);
}

function getAccountTypes() {
  return get(apiEndpoints.getAccountTypes);
}

function getStores() {
  return get(apiEndpoints.getStores);
}

function login(data) {
  return post(apiEndpoints.login, data);
}

module.exports = {
  request,
  get,
  post,
  createAccount,
  getAccountTypes,
  getStores,
  login,
  // 其他函数...
}; 