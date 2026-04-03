const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const { SERVER_CONFIG, WECHAT_CONFIG = {} } = require('./config');
const {
  getProductsWithLatestPrice,
  saveProductPrice,
  getAppUserByUserName,
  getAppUserById,
  getAppUserByWechatOpenId,
  bindWechatOpenId
} = require('./db');

const app = express();
const port = SERVER_CONFIG.port || 3000;
const allowedRoles = new Set([1, 2]);
const tokenSecret = String(WECHAT_CONFIG.tokenSecret || 'fan-price-miniapp-token-secret');
const tokenExpiresInHours = Number(WECHAT_CONFIG.tokenExpiresInHours || 72);

app.use(cors());
app.use(express.json());

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function createToken(payload) {
  const serialized = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(serialized);
  const signature = crypto.createHmac('sha256', tokenSecret).update(encodedPayload).digest('hex');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  const [encodedPayload, signature] = String(token || '').split('.');

  if (!encodedPayload || !signature) {
    throw new Error('Invalid token format');
  }

  const expectedSignature = crypto.createHmac('sha256', tokenSecret).update(encodedPayload).digest('hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (!payload || !payload.uid || !payload.exp) {
    throw new Error('Invalid token payload');
  }

  if (Date.now() > Number(payload.exp)) {
    throw new Error('Token expired');
  }

  return payload;
}

function getRoleLabel(role) {
  if (Number(role) === 1) {
    return '超级管理员';
  }

  if (Number(role) === 2) {
    return '普通运营';
  }

  return '未授权角色';
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    user_name: user.user_name,
    role: user.role,
    role_label: getRoleLabel(user.role),
    status: user.status,
    phone: user.phone,
    wechat_openid: user.wechat_openid || '',
    can_record_price: allowedRoles.has(Number(user.role)) && Number(user.status) === 1
  };
}

function fetchWechatSession(code) {
  const appId = String(WECHAT_CONFIG.appId || '').trim();
  const appSecret = String(WECHAT_CONFIG.appSecret || '').trim();

  if (!appId || !appSecret) {
    return Promise.reject(new Error('WECHAT_CONFIG.appId or appSecret is not configured'));
  }

  const requestUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(
    appId
  )}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(
    code
  )}&grant_type=authorization_code`;

  return new Promise((resolve, reject) => {
    https
      .get(requestUrl, (response) => {
        let rawData = '';

        response.on('data', (chunk) => {
          rawData += chunk;
        });

        response.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);

            if (parsed.errcode) {
              reject(new Error(parsed.errmsg || `WeChat API error: ${parsed.errcode}`));
              return;
            }

            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function requireAuth(req, res, next) {
  const authorization = String(req.headers.authorization || '').trim();

  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Missing access token'
    });
    return;
  }

  const token = authorization.slice(7).trim();

  try {
    const payload = verifyToken(token);
    const user = await getAppUserById(payload.uid);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User does not exist'
      });
      return;
    }

    if (Number(user.status) !== 1) {
      res.status(403).json({
        success: false,
        message: '当前账号已被禁止登录'
      });
      return;
    }

    if (!allowedRoles.has(Number(user.role))) {
      res.status(403).json({
        success: false,
        message: '当前账号没有价格登记权限'
      });
      return;
    }

    if (user.wechat_openid && payload.openid && user.wechat_openid !== payload.openid) {
      res.status(401).json({
        success: false,
        message: '微信登录标识不匹配，请重新登录'
      });
      return;
    }

    req.auth = {
      tokenPayload: payload,
      user
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: '登录已失效，请重新登录',
      error: error.message
    });
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'server is running'
  });
});

app.post('/api/auth/wechat-login', async (req, res) => {
  const code = String((req.body && req.body.code) || '').trim();
  const userName = String((req.body && req.body.user_name) || '').trim();

  if (!userName) {
    res.status(400).json({
      success: false,
      message: 'user_name is required'
    });
    return;
  }

  if (!code) {
    res.status(400).json({
      success: false,
      message: 'wx.login code is required'
    });
    return;
  }

  try {
    const wechatSession = await fetchWechatSession(code);
    const wechatOpenId = String(wechatSession.openid || '').trim();

    if (!wechatOpenId) {
      res.status(500).json({
        success: false,
        message: 'Failed to get wechat_openid from WeChat'
      });
      return;
    }

    const user = await getAppUserByUserName(userName);

    if (!user) {
      res.status(404).json({
        success: false,
        message: '登录姓名不存在，请先在 app_user 中登记'
      });
      return;
    }

    if (Number(user.status) !== 1) {
      res.status(403).json({
        success: false,
        message: '当前账号已被禁止登录'
      });
      return;
    }

    if (!allowedRoles.has(Number(user.role))) {
      res.status(403).json({
        success: false,
        message: '当前账号没有价格登记权限'
      });
      return;
    }

    if (user.wechat_openid && user.wechat_openid !== wechatOpenId) {
      res.status(403).json({
        success: false,
        message: '当前账号已绑定其他微信账号，请联系管理员处理'
      });
      return;
    }

    const boundUser = await getAppUserByWechatOpenId(wechatOpenId);

    if (boundUser && Number(boundUser.id) !== Number(user.id)) {
      res.status(403).json({
        success: false,
        message: '该微信号已绑定其他登录账号'
      });
      return;
    }

    const wechatOpenIdSaved = !user.wechat_openid
      ? await bindWechatOpenId(user.id, wechatOpenId)
      : false;
    const latestUser = await getAppUserById(user.id);
    const token = createToken({
      uid: user.id,
      openid: wechatOpenId,
      exp: Date.now() + tokenExpiresInHours * 60 * 60 * 1000
    });

    res.json({
      success: true,
      data: {
        token,
        wechat_openid: wechatOpenId,
        wechat_openid_saved: wechatOpenIdSaved,
        user: sanitizeUser(latestUser || user)
      }
    });
  } catch (error) {
    console.error('WeChat login failed:', error);
    res.status(500).json({
      success: false,
      message: '微信登录失败，请检查小程序 appId/appSecret 和 code 是否有效',
      error: error.message
    });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    data: {
      user: sanitizeUser(req.auth.user)
    }
  });
});

app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const data = await getProductsWithLatestPrice();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Query failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database query failed',
      error: error.message
    });
  }
});

app.post('/api/products/:id/price', requireAuth, async (req, res) => {
  const productId = Number(req.params.id);
  const rawPrice = req.body ? req.body.purchase_price : '';
  const purchasePrice = String(rawPrice === undefined || rawPrice === null ? '' : rawPrice).trim();

  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({
      success: false,
      message: 'Invalid product id'
    });
    return;
  }

  if (!purchasePrice) {
    res.status(400).json({
      success: false,
      message: 'purchase_price is required'
    });
    return;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(purchasePrice)) {
    res.status(400).json({
      success: false,
      message: 'purchase_price must be a valid number with up to 2 decimal places'
    });
    return;
  }

  try {
    const product = await saveProductPrice(productId, purchasePrice);

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Save price failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save price',
      error: error.message
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server started on port ${port}`);
});
