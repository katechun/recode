Page({
  data: {
    storeId: '',
    typeId: '',
    accountType: 'income', // 默认收入
    amount: '',
    remark: '',
    transactionTime: '',
    stores: [],
    accountTypes: [],
    currentDate: '',
    selectedStoreName: '请选择店铺',
    selectedTypeName: '请选择类型'
  },

  onLoad: function (options) {
    console.log('接收到的参数:', options);
    
    // 设置当前日期
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    this.setData({
      currentDate: currentDate,
      transactionTime: currentDate
    });
    
    // 获取传递的参数
    if (options.storeId && options.typeId && options.type) {
      this.setData({
        storeId: options.storeId,
        typeId: options.typeId,
        accountType: options.type // 收入或支出
      });
    }
    
    // 加载必要数据
    this.loadStores();
    this.loadAccountTypes();
  },

  // 加载店铺列表
  loadStores: function() {
    wx.request({
      url: 'http://localhost:8080/api/stores',
      method: 'GET',
      header: {
        'X-User-ID': wx.getStorageSync('userInfo').id || ''
      },
      success: (res) => {
        if (res.data.code === 200) {
          this.setData({
            stores: res.data.data || []
          });
          
          // 如果已设置storeId，找到对应的店铺名称
          if (this.data.storeId && this.data.stores.length > 0) {
            const store = this.data.stores.find(s => s.id == this.data.storeId);
            if (store) {
              this.setData({
                selectedStoreName: store.name
              });
            }
          } else if (this.data.stores.length > 0) {
            this.setData({
              storeId: this.data.stores[0].id,
              selectedStoreName: this.data.stores[0].name
            });
          }
        }
      },
      fail: (err) => {
        console.error('获取店铺失败:', err);
        wx.showToast({
          title: '获取店铺列表失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载账务类型
  loadAccountTypes: function() {
    wx.request({
      url: 'http://localhost:8080/api/account-types',
      method: 'GET',
      header: {
        'X-User-ID': wx.getStorageSync('userInfo').id || ''
      },
      success: (res) => {
        if (res.data.code === 200) {
          // 根据当前选择的类型(收入/支出)筛选账务类型
          const types = res.data.data.filter(item => 
            (this.data.accountType === 'income' && !item.is_expense) || 
            (this.data.accountType === 'expense' && item.is_expense)
          );
          
          this.setData({
            accountTypes: types
          });
          
          // 如果已设置typeId，则不需要再设置
          if (!this.data.typeId && types.length > 0) {
            this.setData({
              typeId: types[0].id
            });
          }
        }
      },
      fail: (err) => {
        console.error('获取账务类型失败:', err);
        wx.showToast({
          title: '获取账务类型失败',
          icon: 'none'
        });
      }
    });
  },

  // 切换账务类型
  switchAccountType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      accountType: type
    });
    
    // 重新加载账务类型列表
    this.loadAccountTypes();
  },

  // 店铺选择
  bindStoreChange: function(e) {
    const index = e.detail.value;
    const selectedStore = this.data.stores[index];
    this.setData({
      storeId: selectedStore.id,
      selectedStoreName: selectedStore.name
    });
  },

  // 账务类型选择
  bindTypeChange: function(e) {
    const index = e.detail.value;
    const selectedType = this.data.accountTypes[index];
    this.setData({
      typeId: selectedType.id,
      selectedTypeName: selectedType.name
    });
  },

  // 日期选择
  bindDateChange: function(e) {
    this.setData({
      transactionTime: e.detail.value
    });
  },

  // 金额输入
  bindAmountInput: function(e) {
    this.setData({
      amount: e.detail.value
    });
  },

  // 备注输入
  bindRemarkInput: function(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 提交记账
  submitAccount: function() {
    // 验证数据
    if (!this.data.storeId) {
      wx.showToast({
        title: '请选择店铺',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.typeId) {
      wx.showToast({
        title: '请选择账务类型',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.amount || isNaN(parseFloat(this.data.amount))) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return;
    }
    
    // 处理金额（支出为负数）
    let amount = parseFloat(this.data.amount);
    if (this.data.accountType === 'expense') {
      amount = -Math.abs(amount);
    } else {
      amount = Math.abs(amount);
    }
    
    // 发送请求
    wx.request({
      url: 'http://localhost:8080/api/accounts/create',
      method: 'POST',
      header: {
        'X-User-ID': wx.getStorageSync('userInfo').id || ''
      },
      data: {
        store_id: this.data.storeId,
        type_id: this.data.typeId,
        amount: amount,
        remark: this.data.remark,
        transaction_time: this.data.transactionTime
      },
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({
            title: '记账成功',
            icon: 'success'
          });
          
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.message || '记账失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('记账失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 取消记账
  cancelAccount: function() {
    wx.navigateBack();
  }
}) 