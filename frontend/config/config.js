// 环境配置
const env = {
  development: {
    // apiBaseUrl: 'http://10.100.7.4:8080'
    apiBaseUrl: 'http://127.0.0.1:8080'

  },
  production: {
    // apiBaseUrl: 'http://8.152.197.192:8080' // 生产环境地址
    apiBaseUrl: 'https://www.cjns.site' // 生产环境地址

  }
};

// 当前环境，可以通过编译时配置
const currentEnv = 'development';
// const currentEnv = 'production';

const config = {
  // API基础地址
  apiBaseUrl: env[currentEnv].apiBaseUrl,

  // 添加baseUrl以支持完整URL访问
  baseUrl: env[currentEnv].apiBaseUrl,

  // API路径
  apis: {
    login: '/api/login',
    accounts: {
      list: '/api/accounts',
      create: '/api/accounts/create',
      add: '/api/accounts/create',
      update: '/api/account',
      delete: '/api/accounts',
      statistics: '/api/accounts/statistics'
    },
    stores: {
      list: '/api/stores',
      create: '/api/stores/create',
      update: '/api/stores/update',
      delete: '/api/stores/delete',
      detail: '/api/stores'
    },
    accountTypes: {
      list: '/api/account-types',
      create: '/api/account-types/create',
      update: '/api/account-types/update',
      delete: '/api/account-types/delete'
    },
    users: {
      list: '/api/users',
      create: '/api/users/create',
      update: '/api/users/update',
      delete: '/api/users/delete',
      resetPassword: '/api/users/reset-password',
      permissions: '/api/users/permissions'
    },
    settings: {
      save: '/api/settings/default',  // 保存默认设置
      get: '/api/settings/default'    // 获取默认设置
    },
    statistics: {
      report: '/api/statistics/report',
    },
    // 客户管理相关API
    customer: {
      list: '/api/customers',
      detail: '/api/customers/detail',
      add: '/api/customers/create',
      update: '/api/customers/update',
      weight: '/api/customers/weight',  // 添加体重记录
      updateCurrentWeight: '/api/customers/update-current-weight', // 更新当前体重
      weightRecords: '/api/customers/weight-records', // 获取体重记录
      addWeightRecord: '/api/customers/add-weight-record', // 添加体重记录
      deleteWeightRecord: '/api/customers/delete-weight-record', // 删除体重记录
      productUsage: '/api/customers/product-usage', // 产品使用记录
      addProductUsage: '/api/customers/add-product-usage', // 添加产品使用记录
      updateProductUsage: '/api/customers/update-product-usage', // 更新产品使用记录
      deleteProductUsage: '/api/customers/delete-product-usage', // 删除产品使用记录
      records: '/api/customers/records',
      exportReport: '/api/customers/export-report',
      products: '/api/customer/products'
    },
    products: {
      list: '/api/products/list',
      add: '/api/products/add',
      delete: '/api/products/delete'
    },
    report: {
      generate: '/api/report/generate' // 生成报表
    }
  }
};

export default config; 