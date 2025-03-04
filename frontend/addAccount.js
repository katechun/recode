// 引入API模块
const api = require('../../utils/request.js');

Page({
  data: {
    // 页面数据...
  },
  
  // 提交账务
  submitAccount: function() {
    // 构建账务数据
    const accountData = {
      store_id: this.data.selectedStore.id,
      type_id: this.data.selectedType.id,
      amount: this.data.isExpense ? -Math.abs(this.data.amount) : Math.abs(this.data.amount),
      remark: this.data.remark,
      transaction_time: this.data.transactionDate + ' ' + this.data.transactionTime
    };
    
    console.log('提交的账务数据:', accountData);
    
    // 使用封装的API函数
    api.createAccount(accountData)
      .then(res => {
        wx.showToast({
          title: '记账成功',
          icon: 'success'
        });
        // 其他成功处理...
      })
      .catch(err => {
        console.log('记账提交失败:', err);
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        });
      });
  }
}); 