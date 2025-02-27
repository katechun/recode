import request from '../../utils/request';
import config from '../../config/config';

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
    
    const isDefault = options.isDefault === 'true';
    
    // 设置当前日期
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    this.setData({
      currentDate,
      transactionTime: currentDate,
      storeId: options.storeId || '',
      typeId: options.typeId || '',
      accountType: options.type || 'expense'
    });

    // 加载店铺列表
    this.loadStores().then(() => {
      if (isDefault && options.storeId) {
        // 设置默认选中的店铺
        const storeIndex = this.data.stores.findIndex(
          store => store.id.toString() === options.storeId
        );
        if (storeIndex >= 0) {
          this.setData({
            selectedStoreName: this.data.stores[storeIndex].name
          });
        }
      }
    });

    // 获取账务类型
    this.loadAccountTypes().then(() => {
      if (isDefault && options.typeId) {
        // 设置默认选中的类型
        const accountTypes = this.data.accountTypes || [];
        const typeIndex = accountTypes.findIndex(
          type => type.id.toString() === options.typeId
        );
        if (typeIndex >= 0) {
          this.setData({
            selectedTypeName: accountTypes[typeIndex].name
          });
        }
      }
    });
  },

  // 加载店铺列表
  loadStores: function() {
    return new Promise((resolve, reject) => {
      request.get(config.apis.stores.list)
        .then(res => {
          this.setData({
            stores: res.data || []
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
          resolve();
        })
        .catch(err => {
          console.error('获取店铺失败:', err);
          reject(err);
        });
    });
  },

  // 加载账务类型
  loadAccountTypes: function() {
    return new Promise((resolve, reject) => {
      request.get(config.apis.accountTypes.list)
        .then(res => {
          // 根据当前选择的类型(收入/支出)筛选账务类型
          const types = res.data.filter(item => 
            (this.data.accountType === 'income' && !item.is_expense) || 
            (this.data.accountType === 'expense' && item.is_expense)
          );
          
          this.setData({
            accountTypes: types
          });
          
          if (!this.data.typeId && types.length > 0) {
            this.setData({
              typeId: types[0].id
            });
          }
          resolve();
        })
        .catch(err => {
          console.error('获取账务类型失败:', err);
          reject(err);
        });
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
    // 表单验证
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

    if (!this.data.amount || isNaN(this.data.amount) || parseFloat(this.data.amount) <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return;
    }

    const amount = this.data.accountType === 'expense' ? 
      -Math.abs(parseFloat(this.data.amount)) : 
      Math.abs(parseFloat(this.data.amount));

    const accountData = {
      store_id: parseInt(this.data.storeId),
      type_id: parseInt(this.data.typeId),
      amount: amount,
      remark: this.data.remark || '',
      transaction_time: this.data.transactionTime
    };

    request.post(config.apis.accounts.create, accountData)
      .then(() => {
        wx.showToast({
          title: '记账成功',
          icon: 'success',
          duration: 2000
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      });
  },

  // 取消记账
  cancelAccount: function() {
    wx.navigateBack();
  }
}) 