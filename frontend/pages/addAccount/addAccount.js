import request from '../../utils/request';
import config from '../../config/config';
import dateUtil from '../../utils/date';

Page({
  data: {
    id: null, // 添加账单ID，用于判断是新增还是编辑
    storeId: '',
    typeId: '',
    accountType: 'expense', // 默认支出（与大多数记账软件习惯一致）
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
    pickerStep: 'date', // 'date' 或 'time'
    defaultSettings: null, // 存储用户默认设置
    isTypeSwitchedByUser: false, // 标记是否由用户手动切换了类型
    username: '', // 当前用户名
    isEditMode: false, // 标记是否为编辑模式
    accountId: null // 添加accountId，用于保存账单ID
  },

  onLoad: function (options) {
    console.log('接收到的参数:', options);

    // 检查是否为编辑模式
    const isEditMode = !!options.id;

    // 从options中获取类型参数，如果有指定则使用，否则使用默认值
    // 修复type参数为对象的情况
    let accountType = 'expense'; // 默认为支出

    if (options.type) {
      // 检查类型参数是否为对象或[object Object]字符串
      if (typeof options.type === 'object') {
        accountType = 'expense'; // 如果是对象，默认为支出
        console.warn('警告: 接收到类型参数为对象，已设置为默认值"expense"');
      } else if (options.type === '[object Object]') {
        accountType = 'expense'; // 如果是[object Object]字符串，默认为支出
        console.warn('警告: 接收到类型参数为[object Object]字符串，已设置为默认值"expense"');
      } else if (options.type === 'income' || options.type === 'expense') {
        accountType = options.type; // 如果是有效字符串，使用传入值
      } else {
        console.warn('警告: 接收到无效的类型参数:', options.type, '已设置为默认值"expense"');
      }
    }

    const isDefault = options.isDefault === 'true';

    // 设置当前日期和时间
    let currentDate, currentTime, fullDateTime;

    if (options.date && isEditMode) {
      // 处理编辑模式下的日期时间
      try {
        const dateObj = new Date(decodeURIComponent(options.date));
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');

        currentDate = `${year}-${month}-${day}`;
        currentTime = `${hours}:${minutes}`;
        fullDateTime = `${currentDate} ${currentTime}`;
      } catch (e) {
        console.error('解析日期出错:', e);
        // 使用当前时间作为默认值
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        currentDate = `${year}-${month}-${day}`;
        currentTime = `${hours}:${minutes}`;
        fullDateTime = `${currentDate} ${currentTime}`;
      }
    } else {
      // 新增模式使用当前时间
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      currentDate = `${year}-${month}-${day}`;
      currentTime = `${hours}:${minutes}`;
      fullDateTime = `${currentDate} ${currentTime}`;
    }

    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    let username = '';
    if (userInfo) {
      username = userInfo.username || '当前用户';
    }

    // 设置数据
    const initialData = {
      id: options.id || null,
      currentDate,
      currentTime,
      transactionTime: fullDateTime,
      storeId: options.storeId || '',
      typeId: options.typeId || '',
      accountType: accountType,
      username: username,
      isEditMode: isEditMode,
      accountId: options.id || null
    };

    // 如果是编辑模式，添加金额和备注
    if (isEditMode && options.amount) {
      initialData.amount = options.amount;
    }

    if (isEditMode && options.remark) {
      initialData.remark = decodeURIComponent(options.remark);
    }

    this.setData(initialData);

    // 加载用户默认设置
    this.loadDefaultSettings();

    // 加载店铺列表
    this.loadStores().then(() => {
      // storeId优先级：1.URL参数 2.默认设置 3.列表第一个
      if (!this.data.storeId && this.data.defaultSettings && this.data.defaultSettings.store_id) {
        this.setData({
          storeId: this.data.defaultSettings.store_id.toString()
        });
      }

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
    this.loadAccountTypes();
  },

  // 加载用户默认设置
  loadDefaultSettings: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) return;

    // 尝试从本地缓存读取
    const cachedSettings = wx.getStorageSync('defaultSettings');
    if (cachedSettings) {
      console.log('从缓存加载默认设置:', cachedSettings);
      this.setData({ defaultSettings: cachedSettings });
      return;
    }

    // 如果本地没有，则从服务器获取
    request.get(config.apis.settings.get)
      .then(res => {
        if (res.data) {
          console.log('从服务器加载默认设置:', res.data);
          this.setData({ defaultSettings: res.data });
          wx.setStorageSync('defaultSettings', res.data);
        }
      })
      .catch(err => {
        console.error('获取默认设置失败:', err);
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
          }
          // 如果没有设置storeId，且有默认设置，应用默认店铺
          else if (!this.data.storeId && this.data.defaultSettings && this.data.defaultSettings.store_id && this.data.stores.length > 0) {
            const defaultStore = this.data.stores.find(s => s.id == this.data.defaultSettings.store_id);
            if (defaultStore) {
              this.setData({
                storeId: defaultStore.id.toString(),
                selectedStoreName: defaultStore.name
              });
            }
          }
          // 如果没有storeId也没有默认设置，使用第一个店铺
          else if (this.data.stores.length > 0) {
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

          // 如果类型为空，显示提示并返回
          if (types.length === 0) {
            // 重置类型选择器的文本显示
            this.setData({
              selectedTypeName: '请选择类型',
              typeId: ''  // 清空typeId以避免提交无效数据
            });

            wx.showToast({
              title: `没有${this.data.accountType === 'income' ? '收入' : '支出'}类型，请先创建`,
              icon: 'none',
              duration: 2000
            });
            resolve();
            return;
          }

          // 根据情况设置默认类型ID
          let defaultTypeId = '';

          // 1. 优先使用URL传递的typeId
          if (this.data.typeId) {
            defaultTypeId = this.data.typeId;
          }
          // 2. 其次使用默认设置中对应的类型ID
          else if (this.data.defaultSettings) {
            if (this.data.accountType === 'income' && this.data.defaultSettings.income_type_id) {
              defaultTypeId = this.data.defaultSettings.income_type_id.toString();
            } else if (this.data.accountType === 'expense' && this.data.defaultSettings.expense_type_id) {
              defaultTypeId = this.data.defaultSettings.expense_type_id.toString();
            }
          }

          // 根据typeId查找并设置类型名称
          if (defaultTypeId && types.length > 0) {
            const selectedType = types.find(type => type.id.toString() === defaultTypeId);
            if (selectedType) {
              this.setData({
                typeId: selectedType.id.toString(),
                selectedTypeName: selectedType.name
              });
              console.log('已选中类型:', selectedType.name);
            } else {
              // 如果没找到匹配的类型（可能是切换了收入/支出），使用该类别下的第一个类型
              this.setData({
                typeId: types[0].id.toString(),
                selectedTypeName: types[0].name
              });
              console.log('未找到匹配类型，使用第一个类型:', types[0].name);
            }
          } else if (types.length > 0) {
            // 如果没有默认类型，使用第一个类型
            this.setData({
              typeId: types[0].id.toString(),
              selectedTypeName: types[0].name
            });
            console.log('使用第一个类型:', types[0].name);
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

    // 如果当前已经是选中的类型，不做任何处理
    if (type === this.data.accountType) {
      return;
    }

    this.setData({
      accountType: type,
      isTypeSwitchedByUser: true,  // 标记为用户手动切换
      // 切换类型时先重置类型选择器状态，避免显示之前的类型
      selectedTypeName: '请选择类型',
      typeId: ''
    });

    // 重新加载账务类型列表
    this.loadAccountTypes().then(() => {
      // 切换类型后，应用对应的默认类型ID（如果有设置的话）
      if (this.data.defaultSettings) {
        const defaultTypeId = type === 'income'
          ? this.data.defaultSettings.income_type_id
          : this.data.defaultSettings.expense_type_id;

        if (defaultTypeId) {
          const matchingType = this.data.accountTypes.find(t =>
            t.id.toString() === defaultTypeId.toString()
          );

          if (matchingType) {
            this.setData({
              typeId: matchingType.id.toString(),
              selectedTypeName: matchingType.name
            });
            console.log(`已应用${type === 'income' ? '收入' : '支出'}默认类型:`, matchingType.name);
          }
        }
      }
    });
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

  // 保存账目
  saveAccount: function () {
    if (!this.validateForm()) return;

    // 显示加载提示
    wx.showLoading({
      title: this.data.isEditMode ? '更新中...' : '提交中...',
      mask: true
    });

    // 准备API路径
    const apiUrl = this.data.isEditMode ?
      `${config.apis.accounts.update}/${this.data.accountId}` :
      config.apis.accounts.add;

    // 准备请求方法
    const requestMethod = this.data.isEditMode ?
      request.put.bind(request) :
      request.post.bind(request);

    // 准备账目数据 - 确保数字类型正确
    const amount = parseFloat(this.data.amount);
    let finalAmount = amount;

    // 如果是支出，转为负值
    if (this.data.accountType === 'expense') {
      finalAmount = -Math.abs(amount);
    } else {
      // 确保收入是正数
      finalAmount = Math.abs(amount);
    }

    // 构建账目数据对象
    const accountData = {
      store_id: parseInt(this.data.storeId, 10),
      type_id: parseInt(this.data.typeId, 10),
      amount: finalAmount,
      remark: this.data.remark || '',
      transaction_time: this.data.transactionTime
    };

    // 如果是编辑模式，添加ID
    if (this.data.isEditMode) {
      accountData.id = parseInt(this.data.accountId, 10);
    }

    // 打印提交的数据
    console.log(this.data.isEditMode ? '更新账目数据:' : '提交账目数据:', accountData);

    requestMethod(apiUrl, accountData)
      .then(() => {
        wx.hideLoading();

        // 设置标志，表示账目列表页面需要刷新
        wx.setStorageSync('accountListNeedRefresh', true);

        // 设置首页也需要刷新
        wx.setStorageSync('indexNeedRefresh', true);

        // 显示成功消息
        wx.showToast({
          title: this.data.isEditMode ? '更新成功' : '记账成功',
          icon: 'success',
          duration: 2000
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      })
      .catch(err => {
        wx.hideLoading();
        console.error(this.data.isEditMode ? '更新失败:' : '记账提交失败:', err);
        wx.showToast({
          title: err.message || (this.data.isEditMode ? '更新失败' : '提交失败'),
          icon: 'none'
        });
      });
  },

  // 取消记账
  cancelAccount: function () {
    wx.navigateBack();
  },

  // 日期选择
  bindDateChange: function (e) {
    const selectedDate = e.detail.value;
    const currentDateTime = `${selectedDate} ${this.data.currentTime}`;

    this.setData({
      currentDate: selectedDate,
      transactionTime: currentDateTime
    });

    console.log('设置交易日期为:', currentDateTime);
  },

  // 时间选择
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

    if (!this.data.amount || isNaN(parseFloat(this.data.amount)) || parseFloat(this.data.amount) <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return false;
    }

    return true;
  }
}) 