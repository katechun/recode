// 添加一个统一的金额格式化过滤器
const filters = {
  // 格式化金额显示，确保两位小数
  formatAmount: function(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }
    return parseFloat(amount).toFixed(2);
  },
  
  // 格式化金额，添加正负号和颜色类
  formatAmountWithSign: function(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return {
        value: '0.00',
        class: ''
      };
    }
    
    const value = parseFloat(amount).toFixed(2);
    const isNegative = parseFloat(amount) < 0;
    
    return {
      value: isNegative ? value : '+' + value,
      class: isNegative ? 'amount-negative' : 'amount-positive'
    };
  }
};

module.exports = filters; 