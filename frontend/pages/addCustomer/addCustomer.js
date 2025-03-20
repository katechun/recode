// pages/addCustomer/addCustomer.js
import request from '../../utils/request';
import config from '../../config/config';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    isLoading: false,
    isEdit: false,
    customerId: '',
    stores: [],
    selectedStoreId: '',
    selectedStoreIndex: 0,
    name: '',
    phone: '',
    gender: 1, // 1:男, 2:女
    age: '',
    height: '',
    initialWeight: '',
    currentWeight: '',
    targetWeight: '',
    notes: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }

    // 判断是新增还是编辑
    const customerId = options.id;
    const isEdit = !!customerId;

    this.setData({
      userInfo,
      isEdit,
      customerId
    });

    // 加载店铺列表
    this.loadStores(isEdit);
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

  // 加载店铺列表
  loadStores: function (isEdit) {
    this.setData({ isLoading: true });
    const userInfo = this.data.userInfo;

    // 尝试从存储中获取店铺数据
    const cachedStores = wx.getStorageSync('availableStores');
    if (cachedStores && Array.isArray(cachedStores) && cachedStores.length > 0) {
      console.log('从缓存获取到店铺数据:', cachedStores);
      this.setData({
        stores: cachedStores,
        selectedStoreId: !isEdit && cachedStores.length > 0 ? cachedStores[0].id : this.data.selectedStoreId
      });

      // 如果是编辑模式，加载客户详情
      if (isEdit) {
        this.loadCustomerDetail();
      }

      this.setData({ isLoading: false });
      return;
    }

    wx.showLoading({
      title: '加载中...'
    });

    // 使用与店铺管理页面完全相同的方式获取店铺列表
    request.get(config.apis.stores.list)
      .then(res => {
        wx.hideLoading();
        console.log('店铺列表结果:', res);

        // 健壮的响应处理逻辑，支持多种格式
        let storeData = [];

        // 1. res.data为数组: 直接使用
        if (Array.isArray(res.data)) {
          storeData = res.data;
        }
        // 2. res.data.data为数组: API返回了包装对象
        else if (res.data && Array.isArray(res.data.data)) {
          storeData = res.data.data;
        }
        // 3. res.data为对象，包含code和data字段: 标准API响应
        else if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
          storeData = res.data.data;
        }
        // 4. res自身包含code和data字段: 另一种API响应格式
        else if (res.code === 200 && Array.isArray(res.data)) {
          storeData = res.data;
        }

        console.log('处理后的店铺数据:', storeData);

        if (storeData.length > 0) {
          this.setData({
            stores: storeData,
            // 如果是新增客户，默认选择第一个店铺
            selectedStoreId: !isEdit && storeData.length > 0 ? storeData[0].id : this.data.selectedStoreId
          });

          // 如果是编辑模式，加载客户详情
          if (isEdit) {
            this.loadCustomerDetail();
          }
        } else {
          wx.showToast({
            title: '请先创建店铺后再添加客户',
            icon: 'none',
            duration: 2000
          });
        }

        this.setData({ isLoading: false });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取店铺列表失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      });
  },

  // 加载客户详情
  loadCustomerDetail: function () {
    this.setData({ isLoading: true });

    const { userInfo, customerId } = this.data;

    request.get(config.apis.customer.detail, {
      data: {
        user_id: userInfo.id,
        customer_id: customerId
      }
    })
      .then(res => {
        console.log('客户详情结果:', res);
        if (res && res.code === 200) {
          const customer = res.data || {};

          // 找到对应的店铺索引
          let storeIndex = 0;
          if (customer.store_id && this.data.stores.length > 0) {
            const index = this.data.stores.findIndex(store => store.id === customer.store_id);
            if (index !== -1) {
              storeIndex = index;
            }
          }

          this.setData({
            name: customer.name || '',
            phone: customer.phone || '',
            gender: customer.gender || 1,
            age: customer.age ? String(customer.age) : '',
            height: customer.height ? String(customer.height) : '',
            initialWeight: customer.initial_weight ? String(customer.initial_weight) : '',
            currentWeight: customer.current_weight ? String(customer.current_weight) : '',
            targetWeight: customer.target_weight ? String(customer.target_weight) : '',
            notes: customer.notes || '',
            selectedStoreId: customer.store_id || '',
            selectedStoreIndex: storeIndex
          });
        } else {
          wx.showToast({
            title: res?.message || '加载客户详情失败',
            icon: 'none'
          });
        }
        this.setData({ isLoading: false });
      })
      .catch(err => {
        console.error('加载客户详情失败:', err);
        wx.showToast({
          title: '加载客户详情失败',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      });
  },

  // 店铺选择变更
  bindStoreChange: function (e) {
    const index = e.detail.value;
    const store = this.data.stores[index];

    this.setData({
      selectedStoreIndex: index,
      selectedStoreId: store ? store.id : ''
    });
  },

  // 性别选择变更
  bindGenderChange: function (e) {
    const gender = parseInt(e.detail.value) + 1; // 转为1或2
    this.setData({ gender });
  },

  // 输入框变更
  bindInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    this.setData({
      [field]: value
    });
  },

  // 保存客户信息
  saveCustomer: function () {
    // 表单验证
    const { name, phone, selectedStoreId } = this.data;

    if (!name.trim()) {
      wx.showToast({
        title: '请输入客户姓名',
        icon: 'none'
      });
      return;
    }

    if (!phone.trim()) {
      wx.showToast({
        title: '请输入联系电话',
        icon: 'none'
      });
      return;
    }

    if (!selectedStoreId) {
      wx.showToast({
        title: '请选择所属店铺',
        icon: 'none'
      });
      return;
    }

    // 组装请求数据
    const { userInfo, isEdit, customerId, gender, age, height, initialWeight, currentWeight, targetWeight, notes } = this.data;

    const data = {
      user_id: parseInt(userInfo.id), // 确保是整数
      name: this.data.name.trim(),
      phone: this.data.phone.trim(),
      store_id: parseInt(this.data.selectedStoreId), // 确保是整数
      gender: parseInt(gender), // 确保是整数
      notes: notes.trim() || '' // 确保notes不为undefined
    };

    // 添加可选字段，确保为适当的类型
    if (age) data.age = parseInt(age);
    if (height) data.height = parseFloat(height);
    if (initialWeight) data.initial_weight = parseFloat(initialWeight);
    if (currentWeight) data.current_weight = parseFloat(currentWeight);
    if (targetWeight) data.target_weight = parseFloat(targetWeight);

    // 如果是编辑，添加客户ID
    if (isEdit) {
      data.customer_id = customerId;
    }

    // 移除所有undefined或null值
    Object.keys(data).forEach(key => {
      if (data[key] === undefined || data[key] === null) {
        delete data[key];
      }
      // 检查数字类型是否为NaN，如果是则设为0
      if (typeof data[key] === 'number' && isNaN(data[key])) {
        data[key] = 0;
      }
    });

    this.setData({ isLoading: true });

    // 显示加载提示
    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    // 设置请求超时定时器
    const timeout = setTimeout(() => {
      wx.hideLoading();
      this.setData({ isLoading: false });
      wx.showToast({
        title: '保存超时，请重试',
        icon: 'none'
      });
    }, 15000); // 15秒超时

    console.log('保存客户数据:', data);

    // 使用promise方式发送请求
    const apiUrl = isEdit ? config.apis.customer.update : config.apis.customer.add;
    request.post(apiUrl, data)
      .then(res => {
        clearTimeout(timeout); // 清除超时定时器
        wx.hideLoading();
        this.setData({ isLoading: false });

        console.log('保存客户响应:', res);

        if (res && res.code === 200) {
          wx.showToast({
            title: isEdit ? '客户信息更新成功' : '客户添加成功',
            icon: 'success'
          });

          // 设置刷新标志
          wx.setStorageSync('customerListNeedRefresh', true);

          if (isEdit) {
            wx.setStorageSync('customerDetailNeedRefresh', true);
          }

          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res?.message || (isEdit ? '更新失败' : '添加失败'),
            icon: 'none'
          });
        }
      })
      .catch(err => {
        clearTimeout(timeout); // 清除超时定时器
        wx.hideLoading();
        this.setData({ isLoading: false });

        console.error('保存客户失败:', err);

        wx.showToast({
          title: isEdit ? '更新失败' : '添加失败',
          icon: 'none',
          duration: 3000
        });

        // 显示详细错误信息
        if (err && err.response && err.response.message) {
          setTimeout(() => {
            wx.showModal({
              title: '错误详情',
              content: err.response.message,
              showCancel: false
            });
          }, 1000);
        }
        // 取消
        cancelCustomer: function () {
          wx.navigateBack();
        },

        // 跳转到添加店铺页面
        navigateToAddStore: function () {
          wx.navigateTo({
            url: '/pages/storeManage/storeManage',
            success: () => {
              // 关闭当前页面，返回后直接到店铺管理页
              setTimeout(() => {
                wx.navigateBack();
              }, 100);
            }
          });
        }
      })