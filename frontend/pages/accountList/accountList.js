Page({
  data: {
    accounts: []
  },

  onLoad: function() {
    console.log('账户列表页面加载');
    // 初始化账户列表数据
    this.loadAccounts();
  },

  onShow: function() {
    // 每次显示页面时刷新数据
    this.loadAccounts();
  },

  loadAccounts: function() {
    // 这里应该从服务器或本地存储获取账户数据
    // 示例数据
    const accounts = [
      { id: 1, name: '现金账户', balance: '1000.00' },
      { id: 2, name: '银行卡', balance: '5000.00' },
      { id: 3, name: '支付宝', balance: '2500.00' }
    ];
    
    this.setData({
      accounts: accounts
    });
  },

  addAccount: function() {
    // 跳转到添加账户页面
    wx.navigateTo({
      url: '../addAccount/addAccount'
    });
  },

  editAccount: function(e) {
    const accountId = e.currentTarget.dataset.id;
    // 跳转到编辑账户页面
    wx.navigateTo({
      url: `../editAccount/editAccount?id=${accountId}`
    });
  },

  deleteAccount: function(e) {
    const accountId = e.currentTarget.dataset.id;
    const that = this;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个账户吗？',
      success: function(res) {
        if (res.confirm) {
          // 这里应该调用删除账户的API
          console.log('删除账户ID:', accountId);
          
          // 更新列表（示例）
          const updatedAccounts = that.data.accounts.filter(item => item.id !== accountId);
          that.setData({
            accounts: updatedAccounts
          });
        }
      }
    });
  }
}) 