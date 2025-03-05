// 环境配置
const env = {
  development: {
    apiBaseUrl: 'http://10.100.7.4:8080'
  },
  production: {
    // apiBaseUrl: 'http://8.152.197.192:8080' // 生产环境地址
    apiBaseUrl: 'http://www.cjns.site' // 生产环境地址

  }
};

// 当前环境，可以通过编译时配置
const currentEnv = 'development';
// const currentEnv = 'production';

const config = {
  // API基础地址
  apiBaseUrl: env[currentEnv].apiBaseUrl,

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
      delete: '/api/stores/delete'
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
    }
  }
};

export default config; 