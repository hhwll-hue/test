function readNumberEnv(name, fallback) {
  const value = process.env[name];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return Number(value);
}

const SERVER_CONFIG = {
  port: readNumberEnv('PORT', readNumberEnv('SERVER_PORT', 3000))
};

const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  tokenSecret: process.env.WECHAT_TOKEN_SECRET || '',
  tokenExpiresInHours: readNumberEnv('WECHAT_TOKEN_EXPIRES_IN_HOURS', 72)
};

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: readNumberEnv('DB_PORT', 3306),
  database: process.env.DB_NAME || 'your_database_name',
  user: process.env.DB_USER || 'your_db_user',
  password: process.env.DB_PASSWORD || 'your_db_password'
};

module.exports = {
  SERVER_CONFIG,
  WECHAT_CONFIG,
  DB_CONFIG
};
