import request from '../../utils/request';
import config from '../../config/config';
import dateUtil from '../../utils/date';

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
    currentTime: '',
    selectedStoreName: '请选择店铺',
    selectedTypeName: '请选择类型',
    dateTimePickerVisible: false,
    pickerStep: 'date' // 'date' 或 'time'
  },

  onLoad: function (options) {
    console.log('接收到的参数:', options);

    const isDefault = options.isDefault === 'true';

    // 设置当前日期和时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // 设置日期和时间
    const currentDate = `${year}-${month}-${day}`;
    const currentTime = `${hours}:${minutes}`;
    const fullDateTime = `${currentDate} ${currentTime}`;

    // 提取类型ID并确保它是一个字符串
    const typeId = options.typeId || '';
    console.log('设置类型ID:', typeId, '类型:', options.type || 'expense');

    this.setData({
      currentDate,
      currentTime,
      transactionTime: fullDateTime,
      storeId: options.storeId || '',
      typeId: typeId,
      accountType: options.type || 'expense'
    });

    // 加载店铺列表
    this.loadStores().then(() => {
      if (this.data.storeId) {
        // 设置默认选中的店铺
        const store = this.data.stores.find(store =>
          store.id.toString() === this.data.storeId.toString()
        );
        if (store) {
          this.setData({
            selectedStoreName: store.name
          });
        }
      }
    });

    // 获取账务类型
    this.loadAccountTypes().then(() => {
      if (this.data.typeId) {
        // 设置默认选中的类型
        const accountTypes = this.data.accountTypes || [];
        const type = accountTypes.find(type =>
          type.id.toString() === this.data.typeId.toString()
        );
        if (type) {
          this.setData({
            selectedTypeName: type.name
          });
          console.log('已选中类型:', type.name);
        } else {
          console.log('未找到匹配类型, 当前类型列表:', accountTypes.map(t => ({ id: t.id, name: t.name })));
        }
      }
    });
  },

  // 加载店铺列表
  loadStores: function () {
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
  loadAccountTypes: function () {
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

          // 检查是否有传入的typeId
          if (this.data.typeId && types.length > 0) {
            // 查找typeId对应的类型
            const selectedType = types.find(type => type.id == this.data.typeId);
            if (selectedType) {
              // 如果找到了，设置选中的类型名称
              this.setData({
                selectedTypeName: selectedType.name
              });
            } else {
              // 如果没有找到匹配的类型，使用第一个类型
              this.setData({
                typeId: types[0].id,
                selectedTypeName: types[0].name
              });
            }
          } else if (types.length > 0) {
            // 如果没有传入typeId但有类型可选，使用第一个类型
            this.setData({
              typeId: types[0].id,
              selectedTypeName: types[0].name
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
  switchAccountType: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      accountType: type
    });

    // 重新加载账务类型列表
    this.loadAccountTypes();
  },

  // 店铺选择
  bindStoreChange: function (e) {
    const index = e.detail.value;
    const selectedStore = this.data.stores[index];
    this.setData({
      storeId: selectedStore.id,
      selectedStoreName: selectedStore.name
    });
  },

  // 账务类型选择
  bindTypeChange: function (e) {
    const index = e.detail.value;
    const selectedType = this.data.accountTypes[index];
    this.setData({
      typeId: selectedType.id,
      selectedTypeName: selectedType.name
    });
  },

  // 显示日期时间选择器
  showDateTimePicker: function () {
    // 先显示日期选择器
    this.setData({
      dateTimePickerVisible: true,
      pickerStep: 'date'
    });

    // 打开日期选择器
    wx.showActionSheet({
      itemList: ['选择日期', '选择时间'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 选择日期
          this.selectDateAction();
        } else if (res.tapIndex === 1) {
          // 选择时间
          this.selectTimeAction();
        }
      }
    });
  },

  // 选择日期操作
  selectDateAction: function () {
    const that = this;
    wx.showDatePickerView({
      value: that.data.currentDate,
      success: (res) => {
        const selectedDate = res.value;
        const currentDateTime = `${selectedDate} ${that.data.currentTime}`;

        that.setData({
          currentDate: selectedDate,
          transactionTime: currentDateTime
        });

        console.log('设置交易日期为:', currentDateTime);
      }
    });
  },

  // 选择时间操作
  selectTimeAction: function () {
    const that = this;
    wx.showTimePickerView({
      value: that.data.currentTime,
      success: (res) => {
        const selectedTime = res.value;
        const currentDateTime = `${that.data.currentDate} ${selectedTime}`;

        that.setData({
          currentTime: selectedTime,
          transactionTime: currentDateTime
        });

        console.log('设置交易时间为:', currentDateTime);
      }
    });
  },

  // 金额输入
  bindAmountInput: function (e) {
    this.setData({
      amount: e.detail.value
    });
  },

  // 备注输入
  bindRemarkInput: function (e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 提交记账
  submitAccount: function () {
    if (!this.validateForm()) {
      return;
    }

    const amount = parseFloat(this.data.amount);
    if (isNaN(amount) || amount <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return;
    }

    // 根据账目类型决定金额正负
    const finalAmount = this.data.accountType === 'expense' ? -amount : amount;

    // 格式化日期时间，确保iOS兼容性
    const transactionTime = dateUtil.formatDateString(this.data.transactionTime);

    const accountData = {
      store_id: parseInt(this.data.storeId),
      type_id: parseInt(this.data.typeId),
      amount: finalAmount,
      remark: this.data.remark,
      transaction_time: transactionTime
    };

    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    request.post(config.apis.accounts.create, accountData)
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '记账成功',
          icon: 'success',
          duration: 2000
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      })
      .catch(err => {
        wx.hideLoading();
        console.error('记账提交失败:', err);
        wx.showToast({
          title: '提交失败',
          icon: 'error'
        });
      });
  },

  // 取消记账
  cancelAccount: function () {
    wx.navigateBack();
  },

  // 恢复日期选择函数
  bindDateChange: function (e) {
    const selectedDate = e.detail.value;
    const currentDateTime = `${selectedDate} ${this.data.currentTime}`;

    this.setData({
      currentDate: selectedDate,
      transactionTime: currentDateTime
    });

    console.log('设置交易日期为:', currentDateTime);
  },

  // 恢复时间选择函数
  bindTimeChange: function (e) {
    const selectedTime = e.detail.value;
    const currentDateTime = `${this.data.currentDate} ${selectedTime}`;

    this.setData({
      currentTime: selectedTime,
      transactionTime: currentDateTime
    });

    console.log('设置交易时间为:', currentDateTime);
  },

  validateForm: function () {
    if (!this.data.storeId) {
      wx.showToast({
        title: '请选择店铺',
        icon: 'none'
      });
      return false;
    }

    if (!this.data.typeId) {
      wx.showToast({
        title: '请选择账务类型',
        icon: 'none'
      });
      return false;
    }

    return true;
  }
}) 