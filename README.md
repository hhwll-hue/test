# 微信小程序工业风机价格录入示例

## 目录

- `server`: Node.js 后端接口，负责连接 MySQL，读取 `product_master` 并写入 `price_history`
- `miniprogram`: 微信小程序页面，展示产品图片和基础参数，并支持录入采购价格

## 启动后端

1. 进入 `server`
2. 执行 `npm install`
3. 修改 `server/config.js` 中的数据库连接参数
4. 执行 `npm start`

## 打开小程序

1. 用微信开发者工具打开 `miniprogram`
2. 如果接口不是本机 `3000` 端口，修改 `miniprogram/utils/config.js`
3. 在开发者工具里关闭域名校验，或把后端地址加入合法 request 域名
4. 把对象存储图片域名加入合法 download/image 域名

## 当前接口

- `GET /api/health`
- `GET /api/products`
- `POST /api/products/:id/price`

## 当前页面行为

- 启动小程序后不需要登录，页面会自动请求 `/api/products`
- 页面只展示 `product_master` 中的 `product_name`、`model`、`voltage`、`power` 和 `image_url`
- 页面会读取 `price_history` 中每个产品最新一条 `purchase_price` 作为当前价格展示
- 输入价格并保存后，后端会往 `price_history` 插入一条新记录，`price_time` 使用接口写入时的当前时间

## 你需要修改的文件

- `server/config.js`
  - 填你的 MySQL 地址、端口、数据库名、用户名、密码
- `miniprogram/utils/config.js`
  - 填后端接口地址，例如本机、局域网地址或你部署后的域名

## 对象存储说明

- 当前代码默认数据库中的 `image_url` 就是可直接访问的图片完整地址
- 如果你的对象存储是公开读地址，前端不需要再额外配置 SDK
- 如果你的对象存储是私有读地址，需要在 `server/db.js` 中把数据库里的原始路径转换成临时签名 URL，再返回给小程序
