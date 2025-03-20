// pages/productManage/productManage.js
import request from '../../utils/request';
import config from '../../config/config';

Page({
  data: {
    userInfo: null,
    products: [],
    isLoading: false,
    showAddModal: false,
    newProduct: {
      name: '',
      description: '',
      price: '',
      stock: 100
    }
  },

  onLoad: function (options) {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};

    this.setData({
      userInfo: userInfo
    });

    // 加载产品列表
    this.loadProducts();
  },

  onPullDownRefresh: function () {
    this.loadProducts();
  },

  // 加载产品列表
  loadProducts: function () {
    const self = this;
    const { userInfo } = this.data;

    this.setData({ isLoading: true });

    request.get(config.apis.products.list, {
      data: {
        user_id: userInfo.id
      }
    })
      .then(res => {
        wx.stopPullDownRefresh();
        self.setData({ isLoading: false });

        if (res && res.code === 200) {
          self.setData({
            products: res.data || []
          });
        } else {
          wx.showToast({
            title: '加载产品失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('加载产品失败:', err);
        wx.stopPullDownRefresh();
        self.setData({ isLoading: false });
        
        wx.showToast({
          title: '加载产品失败',
          icon: 'none'
        });
      });
  },

  // 显示添加产品弹窗
  showAddProductModal: function () {
    this.setData({
      showAddModal: true,
      newProduct: {
        name: '',
        description: '',
        price: '',
        stock: 100
      }
    });
  },

  // 隐藏添加产品弹窗
  hideAddProductModal: function () {
    this.setData({
      showAddModal: false
    });
  },

  // 处理输入字段变化
  handleInputChange: function (e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const newProduct = { ...this.data.newProduct };
    
    newProduct[field] = value;
    
    this.setData({
      newProduct
    });
  },

  // 添加产品
  addProduct: function () {
    const { userInfo, newProduct } = this.data;
    
    // 校验数据
    if (!newProduct.name) {
      wx.showToast({
        title: '请输入产品名称',
        icon: 'none'
      });
      return;
    }
    
    if (!newProduct.price || isNaN(parseFloat(newProduct.price)) || parseFloat(newProduct.price) <= 0) {
      wx.showToast({
        title: '请输入有效的价格',
        icon: 'none'
      });
      return;
    }
    
    // 显示加载中
    wx.showLoading({
      title: '添加中...',
    });
    
    // 准备请求数据
    const productData = {
      user_id: userInfo.id,
      name: newProduct.name,
      description: newProduct.description || '',
      price: parseFloat(newProduct.price),
      stock: parseInt(newProduct.stock) || 100
    };
    
    // 调用添加产品API
    request.post(config.apis.products.add, productData)
      .then(res => {
        wx.hideLoading();
        
        if (res && res.code === 200) {
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
          
          // 关闭弹窗
          this.hideAddProductModal();
          
          // 重新加载产品列表
          this.loadProducts();
        } else {
          wx.showToast({
            title: res?.message || '添加失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('添加产品失败:', err);
        wx.hideLoading();
        
        wx.showToast({
          title: '添加产品失败',
          icon: 'none'
        });
      });
  },

  // 删除产品
  deleteProduct: function (e) {
    const { id, name } = e.currentTarget.dataset;
    const { userInfo } = this.data;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除产品"${name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          // 显示加载中
          wx.showLoading({
            title: '删除中...',
          });
          
          // 调用删除产品API
          request.post(config.apis.products.delete, {
            user_id: userInfo.id,
            product_id: id
          })
            .then(res => {
              wx.hideLoading();
              
              if (res && res.code === 200) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                
                // 重新加载产品列表
                this.loadProducts();
              } else {
                wx.showToast({
                  title: res?.message || '删除失败',
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              console.error('删除产品失败:', err);
              wx.hideLoading();
              
              wx.showToast({
                title: '删除产品失败',
                icon: 'none'
              });
            });
        }
      }
    });
  }
}); 