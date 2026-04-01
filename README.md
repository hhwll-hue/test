# 微信小程序 SQL 测试示例

## 目录

- `server`: Node.js 后端接口，负责连接 MySQL 并读取 `product_master`
- `miniprogram`: 微信小程序测试页，启动后直接展示 `fan_type`

## 启动后端

1. 进入 `server`
2. 执行 `npm install`
3. 修改 `server/db.js` 中的数据库连接参数
4. 执行 `npm start`

## 打开小程序

1. 用微信开发者工具打开 `miniprogram`
2. 如果接口不是本机 `3000` 端口，修改 `miniprogram/utils/config.js`
3. 在开发者工具里关闭域名校验或把后端地址加入合法域名

## 当前接口

- `GET /api/health`
- `GET /api/fan-types`
