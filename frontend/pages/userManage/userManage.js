// pages/userManage/userManage.js
import request from '../../utils/request';
import config from '../../config/config';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    users: [],
    showDialog: false,
    isEditing: false,
    currentUser: {
      id: 0,
      username: '',
      password: '',
      nickname: '',
      role: 2 // 默认为店员
    },
    roleOptions: [
      { id: 1, name: '管理员' },
      { id: 2, name: '店员' }
    ],
    roleIndex: 1, // 默认选中店员
    errorMsg: '',

    // 重置密码
    showResetPwdDialog: false,
    targetUserId: 0,
    newPassword: '',
    confirmPassword: '',
    resetErrorMsg: '',

    // 权限管理
    showPermissionsDialog: false,
    currentPermUserId: 0,
    storePermissions: [],
    permErrorMsg: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }

    // 检查用户权限
    if (userInfo.role !== 1) {
      wx.showModal({
        title: '提示',
        content: '您没有权限访问此页面',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }
      });
      return;
    }

    this.setData({ userInfo });
    this.loadUsers();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 检查是否需要刷新数据
    const needRefresh = wx.getStorageSync('userListNeedRefresh');
    if (needRefresh) {
      console.log('检测到需要刷新用户列表标志，重新加载数据');
      this.loadUsers();
      // 清除刷新标志
      wx.removeStorageSync('userListNeedRefresh');
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 加载用户列表
  loadUsers: function () {
    if (!this.data.userInfo) return;

    wx.showLoading({
      title: '加载中...',
    });

    request.get(config.apis.users.list)
      .then(res => {
        wx.hideLoading();
        if (res.data) {  // 直接检查是否有数据
          this.setData({ users: res.data });
        } else {
          wx.showToast({
            title: '获取用户列表失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取用户列表失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      });
  },

  // 显示添加用户弹窗
  showAddDialog: function () {
    this.setData({
      showDialog: true,
      isEditing: false,
      currentUser: {
        id: 0,
        username: '',
        password: '',
        nickname: '',
        role: 2
      },
      roleIndex: 1,
      errorMsg: ''
    });
  },

  // 编辑用户
  editUser: function (e) {
    const userId = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === userId);

    if (user) {
      this.setData({
        showDialog: true,
        isEditing: true,
        currentUser: { ...user },
        roleIndex: user.role === 1 ? 0 : 1,
        errorMsg: ''
      });
    }
  },

  // 显示重置密码弹窗
  showResetDialog: function (e) {
    const userId = e.currentTarget.dataset.id;
    this.setData({
      showResetPwdDialog: true,
      targetUserId: userId,
      newPassword: '',
      confirmPassword: '',
      resetErrorMsg: ''
    });
  },

  // 显示权限设置弹窗
  showPermDialog: function (e) {
    const userId = e.currentTarget.dataset.id;
    if (!userId) {
      wx.showToast({
        title: '用户ID无效',
        icon: 'none'
      });
      return;
    }

    this.loadUserPermissions(userId);
  },

  // 加载用户权限
  loadUserPermissions: function (userId) {
    const requestUrl = `${config.apiBaseUrl}${config.apis.users.permissions}?user_id=${userId}`;
    console.log('【请求】获取用户权限:', {
      url: requestUrl,
      method: 'GET',
      headers: {
        'X-User-ID': wx.getStorageSync('userInfo').id
      }
    });

    wx.showLoading({
      title: '加载中...',
    });

    request.get(`${config.apis.users.permissions}?user_id=${userId}`)
      .then(res => {
        console.log('【响应】获取用户权限:', {
          url: requestUrl,
          statusCode: res.statusCode,
          data: res.data
        });
        wx.hideLoading();
        if (res.data) {
          this.setData({
            showPermissionsDialog: true,
            currentPermUserId: userId,
            storePermissions: res.data,
            permErrorMsg: ''
          });
        } else {
          wx.showToast({
            title: '获取用户权限失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('【错误】获取用户权限失败:', {
          url: requestUrl,
          error: err.message || err,
          stack: err.stack
        });
        this.setData({
          permErrorMsg: '获取权限失败'
        });
      });
  },

  // 切换权限状态
  togglePermission: function (e) {
    const storeId = e.currentTarget.dataset.id;
    const permissions = [...this.data.storePermissions];
    const index = permissions.findIndex(p => p.store_id === storeId);

    if (index >= 0) {
      const currentValue = parseInt(permissions[index].has_permission) || 0;
      permissions[index].has_permission = currentValue === 1 ? 0 : 1;
      this.setData({ storePermissions: permissions });
    }
  },

  // 提交权限设置
  submitPermissions: function () {
    const userId = this.data.currentPermUserId;
    const selectedStores = this.data.storePermissions
      .filter(store => store.has_permission === 1)
      .map(store => store.store_id);

    const requestData = {
      user_id: userId,
      store_ids: selectedStores
    };

    console.log('提交的权限数据:', {
      permissions: this.data.storePermissions,
      selectedStores: selectedStores,
      requestData: requestData
    });

    const requestUrl = `${config.apiBaseUrl}${config.apis.users.permissions}`;
    console.log('【请求】更新用户权限:', {
      url: requestUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': wx.getStorageSync('userInfo').id
      },
      data: requestData
    });

    wx.showLoading({
      title: '保存中...',
    });

    request.post(config.apis.users.permissions, requestData)
      .then(res => {
        console.log('【响应】更新用户权限:', {
          url: requestUrl,
          statusCode: res.statusCode,
          data: res.data
        });
        wx.hideLoading();
        if (res.code === 200) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          this.setData({
            showPermissionsDialog: false,
            permErrorMsg: ''
          });
        } else {
          this.setData({
            permErrorMsg: res.message || '保存失败，请重试'
          });
          console.error('权限更新失败:', {
            response: res
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('【错误】更新用户权限失败:', {
          url: requestUrl,
          requestData: requestData,
          error: err,
          stack: err.stack,
          fullError: JSON.stringify(err, null, 2)
        });
        let errorMsg = '网络请求失败，请重试';
        if (typeof err === 'object') {
          errorMsg = err.message || err.msg || errorMsg;
        }
        this.setData({
          permErrorMsg: errorMsg
        });
      });
  },

  // 确认删除
  confirmDelete: function (e) {
    const userId = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === userId);

    if (user) {
      // 不能删除自己
      if (user.id === this.data.userInfo.id) {
        wx.showToast({
          title: '不能删除当前登录的用户',
          icon: 'none'
        });
        return;
      }

      wx.showModal({
        title: '确认删除',
        content: `确定要删除用户 "${user.nickname || user.username}" 吗？`,
        success: (res) => {
          if (res.confirm) {
            this.deleteUser(userId);
          }
        }
      });
    }
  },

  // 删除用户
  deleteUser: function (userId) {
    if (!userId) {
      wx.showToast({
        title: '用户ID无效',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    // 根据后端API要求，userId应作为查询参数传递
    // 查看后端代码: targetUserID := r.URL.Query().Get("id")
    const deleteUrl = `${config.apis.users.delete}?id=${userId}`;
    console.log('删除用户请求URL:', deleteUrl);

    request.delete(deleteUrl)
      .then(res => {
        wx.hideLoading();
        if (res && res.code === 200) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          this.loadUsers();
        } else {
          console.warn('删除用户返回异常:', res);
          wx.showToast({
            title: (res && res.message) ? res.message : '删除失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('删除用户失败:', err);

        let errorMsg = '网络请求失败';
        if (err) {
          if (err.response && err.response.message) {
            // 使用后端返回的具体错误消息
            errorMsg = err.response.message;
          } else if (err.message) {
            errorMsg = err.message;
          } else if (err.errMsg) {
            errorMsg = err.errMsg;
          }
        }

        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000  // 显示时间更长，以便用户看清错误信息
        });
      });
  },

  // 关闭弹窗
  closeDialog: function () {
    this.setData({
      showDialog: false
    });
  },

  closeResetDialog: function () {
    this.setData({
      showResetPwdDialog: false
    });
  },

  closePermDialog: function () {
    this.setData({
      showPermissionsDialog: false
    });
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    return;
  },

  // 输入用户名
  inputUsername: function (e) {
    this.setData({
      'currentUser.username': e.detail.value || '',
      errorMsg: ''
    });
  },

  // 输入密码
  inputPassword: function (e) {
    this.setData({
      'currentUser.password': e.detail.value || ''
    });
  },

  // 输入昵称
  inputNickname: function (e) {
    this.setData({
      'currentUser.nickname': e.detail.value || ''
    });
  },

  // 角色选择
  bindRoleChange: function (e) {
    const index = parseInt(e.detail.value);
    // 确保角色值是数字类型 (1:管理员, 2:店员)
    const roleValue = this.data.roleOptions[index].id;
    this.setData({
      roleIndex: index,
      'currentUser.role': roleValue
    });
    console.log('已选择角色:', roleValue, typeof roleValue);
  },

  // 输入新密码
  inputNewPassword: function (e) {
    this.setData({
      newPassword: e.detail.value,
      resetErrorMsg: ''
    });
  },

  // 输入确认密码
  inputConfirmPassword: function (e) {
    this.setData({
      confirmPassword: e.detail.value,
      resetErrorMsg: ''
    });
  },

  // 提交用户表单
  submitUser: function () {
    // 处理编辑模式和新增模式的数据不同
    const userData = {
      id: this.data.isEditing ? this.data.currentUser.id : 0,
      username: this.data.currentUser.username ? this.data.currentUser.username.trim() : '',
      nickname: this.data.currentUser.nickname ? this.data.currentUser.nickname.trim() : '',
      role: Number(this.data.currentUser.role)
    };

    // 只在新增模式或密码字段存在时才添加密码
    if (!this.data.isEditing && this.data.currentUser.password) {
      userData.password = this.data.currentUser.password.trim();
    } else if (this.data.currentUser.password) {
      // 如果是编辑模式且用户输入了新密码，也添加
      userData.password = this.data.currentUser.password.trim();
    }

    // 验证数据
    if (!userData.username) {
      this.setData({ errorMsg: '用户名不能为空' });
      return;
    }

    // 添加新用户时，密码是必须的
    if (!this.data.isEditing && !userData.password) {
      this.setData({ errorMsg: '密码不能为空' });
      return;
    }

    // 验证角色
    if (!userData.role || (userData.role !== 1 && userData.role !== 2)) {
      this.setData({ errorMsg: '请选择有效的用户角色' });
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: this.data.isEditing ? '更新中...' : '添加中...',
      mask: true
    });

    if (this.data.isEditing) {
      // 编辑现有用户 - 不要重复添加apiBaseUrl
      const url = config.apis.users.update;

      // 在编辑模式下，如果没有设置新密码，从请求数据中移除密码字段
      if (!userData.password) {
        delete userData.password;
      }

      console.log('更新用户请求数据:', userData);

      request.put({
        url: url,
        data: userData,
        success: (res) => {
          wx.hideLoading();
          if (res && res.code === 200) {
            wx.showToast({
              title: '更新成功',
              icon: 'success'
            });
            this.setData({ showDialog: false });
            this.loadUsers();
          } else {
            this.setData({
              errorMsg: res && res.message ? res.message : '更新失败'
            });
          }
        },
        fail: (error) => {
          wx.hideLoading();
          this.setData({
            errorMsg: '请求失败: ' + (error.message || error)
          });
        }
      });
    } else {
      // 添加新用户，使用新的createUser方法
      this.createUser(userData);
    }
  },

  // 创建用户的专用函数 - 尝试一种新的方法，用专门的字段名称
  createUser: function (userData) {
    // 确保密码字段存在且不为空
    if (!userData.password) {
      wx.hideLoading();
      this.setData({
        errorMsg: '密码不能为空'
      });
      return;
    }

    // 构建请求的URL - 使用新的替代API端点
    const url = '/api/users/create-alt'; // 移除重复的apiBaseUrl

    // 获取用户ID用于请求头
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo ? userInfo.id : '';

    // 尝试使用特殊的自定义请求结构
    console.log('尝试使用替代API创建用户');

    // 创建请求数据 - 确保处理空值
    const customData = {
      username: userData.username || '',
      password: userData.password || '',
      nickname: userData.nickname || '',
      role: Number(userData.role) || 2
    };

    // 记录详细的请求信息
    console.log('发送创建用户请求:', {
      url: url,
      method: 'POST',
      data: customData
    });

    // 发送请求
    request.post(url, customData)
      .then(res => {
        wx.hideLoading();
        console.log('创建用户响应:', res);

        if (res && res.code === 200) {
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
          this.setData({ showDialog: false });
          this.loadUsers();
        } else {
          let errorMsg = '添加失败';

          console.error('创建用户失败详情:', {
            response: res
          });

          if (res && res.message) {
            errorMsg = res.message;
          }

          this.setData({
            errorMsg: errorMsg
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('创建用户请求失败:', err);

        this.setData({
          errorMsg: err.message || err.errMsg || '网络请求失败'
        });
      });
  },

  // 提交重置密码
  submitResetPassword: function () {
    if (!this.data.newPassword) {
      this.setData({ resetErrorMsg: '新密码不能为空' });
      return;
    }

    if (this.data.newPassword !== this.data.confirmPassword) {
      this.setData({ resetErrorMsg: '两次输入的密码不一致' });
      return;
    }

    wx.showLoading({
      title: '重置中...',
      mask: true
    });

    const resetData = {
      user_id: this.data.targetUserId,
      new_password: this.data.newPassword
    };

    console.log('重置密码请求数据:', resetData);

    request.post(config.apis.users.resetPassword, resetData)
      .then(res => {
        wx.hideLoading();
        // 确保res不为null或undefined，并且有data属性
        if (res && res.code === 200) {
          wx.showToast({
            title: '密码重置成功',
            icon: 'success'
          });
          this.setData({
            showResetPwdDialog: false,
            newPassword: '',
            confirmPassword: '',
            resetErrorMsg: ''
          });
        } else {
          this.setData({
            resetErrorMsg: (res && res.message) ? res.message : '密码重置失败'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('提交重置密码失败:', err);

        // 根据错误类型给用户不同的反馈
        let errorMsg = '网络请求失败';
        if (err) {
          if (err.message) {
            errorMsg = err.message;
          } else if (err.errMsg) {
            errorMsg = err.errMsg;
          } else if (typeof err === 'string') {
            errorMsg = err;
          }
        }

        this.setData({
          resetErrorMsg: errorMsg
        });
      });
  }
})