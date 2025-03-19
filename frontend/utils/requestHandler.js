// requestHandler.js - 增强型请求处理工具
import config from '../config/config';

// 处理请求参数，特别是筛选相关参数
function processParams(params) {
    if (!params) return {};

    const processedParams = { ...params };

    // 特殊处理店铺ID参数
    if (processedParams.store_id !== undefined) {
        const storeId = processedParams.store_id;
        console.log('requestHandler - 处理店铺ID:', {
            原始值: storeId,
            类型: typeof storeId
        });

        // 将空字符串、null、undefined转换为undefined，让后端处理
        if (storeId === '' || storeId === null || storeId === undefined) {
            console.log('requestHandler - 店铺ID为空，移除参数');
            delete processedParams.store_id;
        } else {
            // 确保是有效的数字
            const storeIdNum = parseInt(Number(storeId), 10);
            if (!isNaN(storeIdNum) && storeIdNum > 0) {
                // 转换为数字类型
                processedParams.store_id = storeIdNum;
                console.log('requestHandler - 处理后的店铺ID:', {
                    处理后值: processedParams.store_id,
                    类型: typeof processedParams.store_id
                });
            } else {
                console.log('requestHandler - 店铺ID无效，移除:', storeId);
                delete processedParams.store_id;
            }
        }
    }

    // 特殊处理记账类型ID参数
    if (processedParams.type_id !== undefined) {
        const typeId = processedParams.type_id;
        console.log('requestHandler - 处理类型ID:', {
            原始值: typeId,
            类型: typeof typeId
        });

        // 将空字符串、null、undefined转换为undefined，让后端处理
        if (typeId === '' || typeId === null || typeId === undefined) {
            console.log('requestHandler - 类型ID为空，移除参数');
            delete processedParams.type_id;
        } else {
            // 确保是有效的数字
            const typeIdNum = parseInt(Number(typeId), 10);
            if (!isNaN(typeIdNum) && typeIdNum > 0) {
                // 转换为数字类型
                processedParams.type_id = typeIdNum;
                console.log('requestHandler - 处理后的类型ID:', {
                    处理后值: processedParams.type_id,
                    类型: typeof processedParams.type_id
                });
            } else {
                console.log('requestHandler - 类型ID无效，移除:', typeId);
                delete processedParams.type_id;
            }
        }
    }

    // 特殊处理金额区间参数
    if (processedParams.min_amount !== undefined) {
        const minAmount = processedParams.min_amount;
        console.log('requestHandler - 处理最小金额:', {
            原始值: minAmount,
            类型: typeof minAmount
        });

        if (minAmount === '' || minAmount === null || minAmount === undefined) {
            console.log('requestHandler - 最小金额为空，移除参数');
            delete processedParams.min_amount;
        } else {
            // 确保是有效的数字
            const minAmountNum = parseFloat(minAmount);
            if (!isNaN(minAmountNum)) {
                processedParams.min_amount = minAmountNum;
                console.log('requestHandler - 处理后的最小金额:', {
                    处理后值: processedParams.min_amount,
                    类型: typeof processedParams.min_amount
                });
            } else {
                console.log('requestHandler - 最小金额无效，移除:', minAmount);
                delete processedParams.min_amount;
            }
        }
    }

    if (processedParams.max_amount !== undefined) {
        const maxAmount = processedParams.max_amount;
        console.log('requestHandler - 处理最大金额:', {
            原始值: maxAmount,
            类型: typeof maxAmount
        });

        if (maxAmount === '' || maxAmount === null || maxAmount === undefined) {
            console.log('requestHandler - 最大金额为空，移除参数');
            delete processedParams.max_amount;
        } else {
            // 确保是有效的数字
            const maxAmountNum = parseFloat(maxAmount);
            if (!isNaN(maxAmountNum)) {
                processedParams.max_amount = maxAmountNum;
                console.log('requestHandler - 处理后的最大金额:', {
                    处理后值: processedParams.max_amount,
                    类型: typeof processedParams.max_amount
                });
            } else {
                console.log('requestHandler - 最大金额无效，移除:', maxAmount);
                delete processedParams.max_amount;
            }
        }
    }

    // 确保数值类型参数格式正确
    ['limit', 'page'].forEach(key => {
        if (processedParams[key] !== undefined && processedParams[key] !== '' && processedParams[key] !== null) {
            const numValue = Number(processedParams[key]);
            if (!isNaN(numValue)) {
                processedParams[key] = numValue;
            }
        }
    });

    return processedParams;
}

// 增强版GET请求
function enhancedGet(url, params = {}, options = {}) {
    // 处理参数
    const processedParams = processParams(params);

    // 调试输出
    console.log('requestHandler - 发送GET请求:', {
        url: config.apiBaseUrl + url,
        原始参数: params,
        处理后参数: processedParams
    });

    // 记录请求历史
    const requestInfo = {
        method: 'GET',
        url: url,
        originalParams: params,
        processedParams: processedParams,
        timestamp: new Date().toISOString()
    };

    const requestHistory = wx.getStorageSync('apiRequestHistory') || [];
    requestHistory.unshift(requestInfo);
    if (requestHistory.length > 20) requestHistory.pop();
    wx.setStorageSync('apiRequestHistory', requestHistory);

    // 获取用户信息以设置请求头
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo ? userInfo.id : '1'; // 默认用户ID为1

    // 添加用户ID到URL参数中
    if (url.indexOf('?') > -1) {
        url += `&userId=${userId}`;
    } else {
        url += `?userId=${userId}`;
    }

    // 设置请求头
    const headers = {
        'content-type': 'application/json',
        'X-User-ID': userId,
        ...(options.header || {})
    };

    // 构建完整的请求URL用于调试
    const queryString = Object.entries(processedParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    const fullUrl = `${config.apiBaseUrl}${url}${url.includes('?') ? '&' : '?'}${queryString}`;
    console.log('requestHandler - 完整请求URL:', fullUrl);

    return new Promise((resolve, reject) => {
        if (!options.hideLoading) {
            wx.showLoading({ title: '加载中...' });
        }

        wx.request({
            url: config.apiBaseUrl + url,
            method: 'GET',
            data: processedParams,
            header: headers,
            success: function (res) {
                console.log('requestHandler - 收到响应:', {
                    statusCode: res.statusCode,
                    url: url,
                    data: res.data
                });

                if (res.statusCode === 200 && res.data && (res.data.code === 200 || res.data.code === 0)) {
                    resolve(res.data);
                } else {
                    const errorMessage = res.data ? (res.data.message || `HTTP错误: ${res.statusCode}`) : `HTTP错误: ${res.statusCode}`;
                    console.error('requestHandler - 请求失败:', {
                        url: url,
                        statusCode: res.statusCode,
                        error: errorMessage
                    });

                    wx.showToast({
                        title: errorMessage,
                        icon: 'none'
                    });

                    reject({
                        code: res.data ? res.data.code : res.statusCode,
                        message: errorMessage
                    });
                }
            },
            fail: function (err) {
                console.error('requestHandler - 请求失败:', {
                    url: url,
                    error: err
                });

                const errorMsg = err ? (err.errMsg || '网络请求失败') : '网络请求失败';

                wx.showToast({
                    title: errorMsg,
                    icon: 'none'
                });

                reject({
                    code: 500,
                    message: errorMsg,
                    error: err
                });
            },
            complete: function () {
                if (!options.hideLoading) {
                    wx.hideLoading();
                }
            }
        });
    });
}

// 增强版POST请求
function enhancedPost(url, data = {}, options = {}) {
    console.log('requestHandler - 发送POST请求:', {
        url: config.apiBaseUrl + url,
        data: data
    });

    // 记录请求历史
    const requestInfo = {
        method: 'POST',
        url: url,
        data: data,
        timestamp: new Date().toISOString()
    };

    const requestHistory = wx.getStorageSync('apiRequestHistory') || [];
    requestHistory.unshift(requestInfo);
    if (requestHistory.length > 20) requestHistory.pop();
    wx.setStorageSync('apiRequestHistory', requestHistory);

    // 获取用户信息以设置请求头
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo ? userInfo.id : '1'; // 默认用户ID为1

    // 设置请求头
    const headers = {
        'content-type': 'application/json',
        'X-User-ID': userId,
        ...(options.header || {})
    };

    return new Promise((resolve, reject) => {
        if (!options.hideLoading) {
            wx.showLoading({ title: '处理中...' });
        }

        wx.request({
            url: config.apiBaseUrl + url,
            method: 'POST',
            data: data,
            header: headers,
            success: function (res) {
                console.log('requestHandler - 收到POST响应:', {
                    statusCode: res.statusCode,
                    url: url,
                    data: res.data
                });

                if (res.statusCode === 200 && res.data && (res.data.code === 200 || res.data.code === 0)) {
                    resolve(res.data);
                } else {
                    const errorMessage = res.data ? (res.data.message || `HTTP错误: ${res.statusCode}`) : `HTTP错误: ${res.statusCode}`;
                    console.error('requestHandler - POST请求失败:', {
                        url: url,
                        statusCode: res.statusCode,
                        error: errorMessage
                    });

                    wx.showToast({
                        title: errorMessage,
                        icon: 'none'
                    });

                    reject({
                        code: res.data ? res.data.code : res.statusCode,
                        message: errorMessage
                    });
                }
            },
            fail: function (err) {
                console.error('requestHandler - POST请求失败:', {
                    url: url,
                    error: err
                });

                const errorMsg = err ? (err.errMsg || '网络请求失败') : '网络请求失败';

                wx.showToast({
                    title: errorMsg,
                    icon: 'none'
                });

                reject({
                    code: 500,
                    message: errorMsg,
                    error: err
                });
            },
            complete: function () {
                if (!options.hideLoading) {
                    wx.hideLoading();
                }
            }
        });
    });
}

export default {
    get: enhancedGet,
    post: enhancedPost,
    processParams: processParams
}; 