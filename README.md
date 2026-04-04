# 微信小程序工业风机价格录入示例

## 目录

- `server`: Node.js 后端接口，负责连接 MySQL，读取 `product_master` 并写入 `price_history`
- `miniprogram`: 微信小程序页面，展示产品图片和基础参数，并支持录入采购价格

## 当前登录方案

- 登录页直接调用微信手机号授权按钮 `open-type="getPhoneNumber"`
- 小程序把 `event.detail.code` 传给后端 `POST /api/auth/wechat-phone-login`
- 后端通过微信接口 `getuserphonenumber` 换取当前微信绑定手机号
- 后端按 `app_user.phone` 查询账号，并校验 `status=1` 且 `role in (1, 2)` 后允许登录
- 不再依赖 `wx.login`、`jscode2session` 和 `wechat_openid`

## 启动后端

1. 进入 `server`
2. 执行 `npm install`
3. 配置后端环境变量
4. 执行 `npm start`

## 打开小程序

1. 用微信开发者工具打开 `miniprogram`
2. 如果接口不是当前写死的地址，修改 `miniprogram/utils/config.js`
3. 在微信开发者工具里为测试号/体验版确认手机号授权能力可用
4. 在开发者工具里关闭域名校验，或把后端地址加入合法 request 域名
5. 把对象存储图片域名加入合法 download/image 域名

## 当前接口

- `GET /api/health`
- `POST /api/auth/wechat-phone-login`
- `POST /api/auth/wechat-login`
  - 兼容旧路径，内部已经切到手机号登录逻辑
- `GET /api/auth/me`
- `GET /api/products`
- `POST /api/products/:id/price`

## 当前页面行为

- 启动小程序后先进入登录页
- 用户点击“微信手机号登录”后，前端申请微信手机号授权
- 授权成功后，后端按 `app_user.phone` 自动识别账号
- 若手机号未登记、账号被禁用、或角色无权限，则拒绝登录
- 页面只展示 `product_master` 中的 `product_name`、`model`、`voltage`、`power` 和 `image_url`
- 页面会读取 `price_history` 中每个产品最新一条 `purchase_price` 作为当前价格展示
- 输入价格并保存后，后端会往 `price_history` 插入一条新记录，`price_time` 使用接口写入时的当前时间

## 你需要自行修改的环境

- `miniprogram/utils/config.js`
  - 改成你的后端接口地址
- 小程序后台 / 微信开发者工具
  - 确认当前 `AppID` 对应的小程序已具备手机号授权能力
  - 把后端域名加入合法 `request` 域名
  - 把图片域名加入合法 `downloadFile` / `image` 域名
- 后端运行环境变量
  - `PORT` 或 `SERVER_PORT`
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`
  - `WECHAT_APP_ID`
  - `WECHAT_APP_SECRET`
  - `WECHAT_TOKEN_SECRET`
  - `WECHAT_TOKEN_EXPIRES_IN_HOURS`
  - `WECHAT_TLS_REJECT_UNAUTHORIZED`
    - 默认不填或为 `1`，严格校验证书
    - 如果运行环境代理了微信 HTTPS 并注入自签名证书，可临时设为 `0`
- 数据库 `app_user` 表
  - 需要提前把每个可登录用户的手机号维护到 `phone` 字段
  - 建议统一存纯手机号，例如 `13800138000`

## 环境变量示例

```bash
PORT=3000
# 或者
SERVER_PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=fan_price_miniapp
DB_USER=root
DB_PASSWORD=your_password
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=your_wechat_secret
WECHAT_TOKEN_SECRET=replace_with_a_long_random_string
WECHAT_TOKEN_EXPIRES_IN_HOURS=72
WECHAT_TLS_REJECT_UNAUTHORIZED=1
```

## 数据库建议

建议把 `app_user.phone` 中的手机号统一成一种格式，避免同一个号码混用下面几种写法：

- `13800138000`
- `+8613800138000`
- `86 13800138000`

当前后端会自动忽略手机号里的空格和中划线，也会同时尝试匹配微信返回的 `138...`、`+86...`、`86...` 三种形式。

## 对象存储说明

- 当前代码默认数据库中的 `image_url` 就是可直接访问的图片完整地址
- 如果你的对象存储是公开读地址，前端不需要再额外配置 SDK
- 如果你的对象存储是私有读地址，需要在 `server/db.js` 中把数据库里的原始路径转换成临时签名 URL，再返回给小程序

## 注意

- 当前后端读取的是环境变量，不读取 `server/config.js`
- 如果你本地有 `server/config.js`，那只是你自己的本地文件，除非你额外改启动方式，否则不会生效
- 如果微信手机号登录报错 `self-signed certificate`，说明服务端访问 `api.weixin.qq.com` 时经过了带自签名证书的代理
- 更稳妥的修复是把代理根证书加入信任链；`WECHAT_TLS_REJECT_UNAUTHORIZED=0` 只建议作为临时排障手段
