const app = getApp();
// 导入配置文件
const config = require('../../config/config').default;
// 使用配置文件中的API基础URL
const API_BASE_URL = config.apiBaseUrl || 'http://localhost:8080';

Page({
  data: {
    products: [],
    loading: false,
    showModal: false,
    storeList: [], // 存储店铺列表
    selectedStoreId: '', // 选中的店铺ID
    productForm: {
      name: '',
      description: '',
      price: '',
      stock: '',
      store_id: ''
    }
  },

  onLoad: function () {
    // 确保API基础URL已设置
    console.log('当前API基础URL:', API_BASE_URL);
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        });
      }, 1500);
      return;
    }
    this.loadStoreList();
    this.loadProducts();
  },

  onShow: function () {
    this.loadProducts();
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadProducts(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载店铺列表
  loadStoreList: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    wx.request({
      url: `${API_BASE_URL}/api/stores`,
      method: 'GET',
      data: { user_id: userInfo.id },
      header: {
        'content-type': 'application/json',
        'X-User-ID': userInfo.id
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          this.setData({
            storeList: res.data.data || [],
            // 默认选择第一个店铺
            selectedStoreId: res.data.data.length > 0 ? res.data.data[0].id : '',
            'productForm.store_id': res.data.data.length > 0 ? res.data.data[0].id : ''
          });
        } else {
          wx.showToast({
            title: res.data?.message || '获取店铺列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取店铺列表错误:', err);
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 加载产品列表
  loadProducts: function (callback) {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    wx.request({
      url: `${API_BASE_URL}/api/products/list`,
      method: 'GET',
      data: { user_id: userInfo.id },
      header: {
        'content-type': 'application/json',
        'X-User-ID': userInfo.id
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          this.setData({
            products: res.data.data || [],
            loading: false
          });
        } else {
          wx.showToast({
            title: res.data?.message || '获取产品列表失败',
            icon: 'none'
          });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        console.error('获取产品列表错误:', err);
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        });
        this.setData({ loading: false });
      },
      complete: () => {
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  // 显示添加产品弹窗
  showAddModal: function () {
    // 重置表单状态
    this.setData({
      showModal: true,
      productForm: {
        name: '',
        description: '',
        price: '',
        stock: '',
        store_id: this.data.selectedStoreId
      }
    });
  },

  // 隐藏弹窗
  hideModal: function () {
    this.setData({
      showModal: false
    });
  },

  // 表单输入处理函数
  inputName: function (e) {
    this.setData({
      'productForm.name': e.detail.value
    });
  },

  inputDescription: function (e) {
    this.setData({
      'productForm.description': e.detail.value
    });
  },

  inputPrice: function (e) {
    this.setData({
      'productForm.price': e.detail.value
    });
  },

  inputStock: function (e) {
    this.setData({
      'productForm.stock': e.detail.value
    });
  },

  // 选择店铺
  changeStore: function (e) {
    const index = e.detail.value;
    const storeId = this.data.storeList[index].id;

    this.setData({
      selectedStoreId: storeId,
      'productForm.store_id': storeId
    });
  },

  // 添加产品
  handleAddProduct: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    const { name, price, stock, store_id } = this.data.productForm;

    // 表单验证
    if (!name.trim()) {
      wx.showToast({
        title: '请输入产品名称',
        icon: 'none'
      });
      return;
    }

    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      wx.showToast({
        title: '请输入有效的价格',
        icon: 'none'
      });
      return;
    }

    if (!stock.trim() || isNaN(Number(stock)) || Number(stock) < 0) {
      wx.showToast({
        title: '请输入有效的库存数量',
        icon: 'none'
      });
      return;
    }

    if (!store_id) {
      wx.showToast({
        title: '请选择所属店铺',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '添加中...',
      mask: true
    });

    wx.request({
      url: `${API_BASE_URL}/api/products/add`,
      method: 'POST',
      data: {
        user_id: Number(userInfo.id),
        name: name,
        description: this.data.productForm.description,
        price: Number(price),
        stock: Number(stock),
        store_id: Number(store_id)
      },
      header: {
        'content-type': 'application/json',
        'X-User-ID': userInfo.id
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          wx.showToast({
            title: '添加产品成功',
            icon: 'success'
          });
          this.hideModal();
          this.loadProducts();
        } else {
          wx.showToast({
            title: res.data?.message || '添加产品失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('添加产品错误:', err);
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 删除产品
  handleDelete: function (e) {
    const productId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除此产品吗？此操作不可恢复。',
      success: res => {
        if (res.confirm) {
          this.deleteProduct(productId);
        }
      }
    });
  },

  // 执行删除产品操作
  deleteProduct: function (productId) {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    wx.request({
      url: `${API_BASE_URL}/api/products/delete`,
      method: 'POST',
      data: {
        user_id: userInfo.id,
        product_id: productId
      },
      header: {
        'content-type': 'application/json',
        'X-User-ID': userInfo.id
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          wx.showToast({
            title: '删除产品成功',
            icon: 'success'
          });
          this.loadProducts();
        } else {
          wx.showToast({
            title: res.data?.message || '删除产品失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('删除产品错误:', err);
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  }
}); 