// pages/userManage/userManage.js
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
    this.loadUsers();
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

    wx.request({
      url: 'http://localhost:8080/api/users',
      method: 'GET',
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200 && res.data.data) {
          this.setData({ users: res.data.data });
        } else {
          wx.showToast({
            title: res.data.message || '获取用户列表失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
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
    this.loadUserPermissions(userId);
  },

  // 加载用户权限
  loadUserPermissions: function (userId) {
    wx.showLoading({
      title: '加载中...',
    });

    wx.request({
      url: `http://localhost:8080/api/users/permissions?user_id=${userId}`,
      method: 'GET',
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200 && res.data.data) {
          this.setData({
            showPermissionsDialog: true,
            currentPermUserId: userId,
            storePermissions: res.data.data,
            permErrorMsg: ''
          });
        } else {
          wx.showToast({
            title: res.data.message || '获取用户权限失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 切换权限状态
  togglePermission: function (e) {
    const storeId = e.currentTarget.dataset.id;
    const permissions = [...this.data.storePermissions];
    const index = permissions.findIndex(p => p.store_id === storeId);
    
    if (index >= 0) {
      permissions[index].has_permission = permissions[index].has_permission === 1 ? 0 : 1;
      this.setData({ storePermissions: permissions });
    }
  },

  // 提交权限设置
  submitPermissions: function () {
    wx.showLoading({
      title: '保存中...',
    });

    // 获取所有已选择的店铺ID
    const selectedStoreIds = this.data.storePermissions
      .filter(p => p.has_permission === 1)
      .map(p => p.store_id);

    wx.request({
      url: 'http://localhost:8080/api/users/update-permissions',
      method: 'POST',
      data: {
        user_id: this.data.currentPermUserId,
        store_ids: selectedStoreIds
      },
      header: {
        'X-User-ID': this.data.userInfo.id,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          this.setData({ showPermissionsDialog: false });
        } else {
          this.setData({ 
            permErrorMsg: res.data.message || '保存失败' 
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ 
          permErrorMsg: '网络请求失败' 
        });
      }
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
    wx.showLoading({
      title: '删除中...',
    });

    wx.request({
      url: `http://localhost:8080/api/users/delete?id=${userId}`,
      method: 'DELETE',
      header: {
        'X-User-ID': this.data.userInfo.id
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          this.loadUsers();
        } else {
          wx.showToast({
            title: res.data.message || '删除失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
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
      'currentUser.username': e.detail.value,
      errorMsg: ''
    });
  },

  // 输入密码
  inputPassword: function (e) {
    this.setData({
      'currentUser.password': e.detail.value
    });
  },

  // 输入昵称
  inputNickname: function (e) {
    this.setData({
      'currentUser.nickname': e.detail.value
    });
  },

  // 角色选择
  bindRoleChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      roleIndex: index,
      'currentUser.role': this.data.roleOptions[index].id
    });
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
    const { currentUser, isEditing } = this.data;
    
    // 表单验证
    if (!currentUser.username.trim()) {
      this.setData({ errorMsg: '用户名不能为空' });
      return;
    }
    
    if (!isEditing && !currentUser.password.trim()) {
      this.setData({ errorMsg: '密码不能为空' });
      return;
    }
    
    wx.showLoading({
      title: isEditing ? '更新中...' : '添加中...',
    });
    
    const url = isEditing 
      ? 'http://localhost:8080/api/users/update' 
      : 'http://localhost:8080/api/users/create';
    
    const method = isEditing ? 'PUT' : 'POST';
    
    wx.request({
      url: url,
      method: method,
      data: currentUser,
      header: {
        'X-User-ID': this.data.userInfo.id,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          wx.showToast({
            title: isEditing ? '更新成功' : '添加成功',
            icon: 'success'
          });
          this.setData({ showDialog: false });
          this.loadUsers();
        } else {
          this.setData({ 
            errorMsg: res.data.message || (isEditing ? '更新失败' : '添加失败') 
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ 
          errorMsg: '网络请求失败' 
        });
      }
    });
  },

  // 提交重置密码
  submitResetPassword: function () {
    // 表单验证
    if (!this.data.newPassword.trim()) {
      this.setData({ resetErrorMsg: '新密码不能为空' });
      return;
    }
    
    if (this.data.newPassword !== this.data.confirmPassword) {
      this.setData({ resetErrorMsg: '两次输入的密码不一致' });
      return;
    }
    
    wx.showLoading({
      title: '重置中...',
    });
    
    wx.request({
      url: 'http://localhost:8080/api/users/reset-password',
      method: 'POST',
      data: {
        user_id: this.data.targetUserId,
        new_password: this.data.newPassword
      },
      header: {
        'X-User-ID': this.data.userInfo.id,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          wx.showToast({
            title: '密码重置成功',
            icon: 'success'
          });
          this.setData({ showResetPwdDialog: false });
        } else {
          this.setData({ 
            resetErrorMsg: res.data.message || '密码重置失败' 
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ 
          resetErrorMsg: '网络请求失败' 
        });
      }
    });
  }
})