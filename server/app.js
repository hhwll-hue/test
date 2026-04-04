const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const dns = require('dns').promises;

const SERVER_CONFIG = {
  port: Number(process.env.PORT || process.env.SERVER_PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development'
};

const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  tokenSecret: process.env.WECHAT_TOKEN_SECRET || 'fan-price-miniapp-token-secret',
  tokenExpiresInHours: Number(process.env.WECHAT_TOKEN_EXPIRES_IN_HOURS || 72)
};

const {
  getProductsWithLatestPrice,
  saveProductPrice,
  getAppUserById,
  getAppUserByPhone
} = require('./db');

const app = express();
const port = SERVER_CONFIG.port || 3000;
const allowedRoles = new Set([1, 2]);
const tokenSecret = String(WECHAT_CONFIG.tokenSecret || 'fan-price-miniapp-token-secret');
const tokenExpiresInHours = Number(WECHAT_CONFIG.tokenExpiresInHours || 72);
const wechatAccessTokenCache = {
  value: '',
  expiresAt: 0
};

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
    can_record_price: allowedRoles.has(Number(user.role)) && Number(user.status) === 1
  };
}

function httpsRequestJson(method, requestUrl, body) {
  const targetUrl = new URL(requestUrl);
  const payload = body ? JSON.stringify(body) : '';
  const requestOptions = {
    method,
    hostname: targetUrl.hostname,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers: {}
  };

  if (payload) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.headers['Content-Length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (response) => {
      let rawData = '';

      response.on('data', (chunk) => {
        rawData += chunk;
      });

      response.on('end', () => {
        try {
          const parsed = rawData ? JSON.parse(rawData) : {};

          if (parsed.errcode) {
            reject(new Error(parsed.errmsg || `WeChat API error: ${parsed.errcode}`));
            return;
          }

          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function getWechatAccessToken() {
  const appId = String(WECHAT_CONFIG.appId || '').trim();
  const appSecret = String(WECHAT_CONFIG.appSecret || '').trim();

  if (!appId || !appSecret) {
    throw new Error('WECHAT_APP_ID or WECHAT_APP_SECRET is not configured');
  }

  if (wechatAccessTokenCache.value && Date.now() < wechatAccessTokenCache.expiresAt) {
    return wechatAccessTokenCache.value;
  }

  const requestUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(
    appId
  )}&secret=${encodeURIComponent(appSecret)}`;
  const result = await httpsRequestJson('GET', requestUrl);
  const accessToken = String(result.access_token || '').trim();
  const expiresIn = Number(result.expires_in || 7200);

  if (!accessToken) {
    throw new Error('Failed to get WeChat access token');
  }

  wechatAccessTokenCache.value = accessToken;
  wechatAccessTokenCache.expiresAt = Date.now() + Math.max(expiresIn - 300, 60) * 1000;

  return accessToken;
}

function buildPhoneCandidates(phoneInfo) {
  const candidates = [];
  const phoneNumber = String((phoneInfo && phoneInfo.phoneNumber) || '').trim();
  const purePhoneNumber = String((phoneInfo && phoneInfo.purePhoneNumber) || '').trim();
  const countryCode = String((phoneInfo && phoneInfo.countryCode) || '').trim();

  if (phoneNumber) {
    candidates.push(phoneNumber);
  }

  if (purePhoneNumber) {
    candidates.push(purePhoneNumber);
  }

  if (countryCode && purePhoneNumber) {
    candidates.push(`+${countryCode}${purePhoneNumber}`);
    candidates.push(`${countryCode}${purePhoneNumber}`);
  }

  return [...new Set(candidates.map((item) => item.replace(/[\s-]/g, '')).filter(Boolean))];
}

async function fetchWechatPhoneNumber(phoneCode) {
  const accessToken = await getWechatAccessToken();
  const requestUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(
    accessToken
  )}`;
  const result = await httpsRequestJson('POST', requestUrl, { code: phoneCode });

  if (!result.phone_info) {
    throw new Error('Failed to get phone_info from WeChat');
  }

  return result.phone_info;
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

async function handleWechatPhoneLogin(req, res) {
  const phoneCode = String((req.body && req.body.phone_code) || '').trim();

  if (!phoneCode) {
    res.status(400).json({
      success: false,
      message: 'phone_code is required'
    });
    return;
  }

  try {
    const phoneInfo = await fetchWechatPhoneNumber(phoneCode);
    const phoneCandidates = buildPhoneCandidates(phoneInfo);
    let user = null;

    for (const phone of phoneCandidates) {
      user = await getAppUserByPhone(phone);
      if (user) {
        break;
      }
    }

    if (!user) {
      res.status(403).json({
        success: false,
        message: '该微信手机号未登记，请先在 app_user.phone 中维护后再登录'
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

    const latestUser = await getAppUserById(user.id);
    const token = createToken({
      uid: user.id,
      phone: user.phone,
      exp: Date.now() + tokenExpiresInHours * 60 * 60 * 1000
    });

    res.json({
      success: true,
      data: {
        token,
        phone: user.phone,
        user: sanitizeUser(latestUser || user)
      }
    });
  } catch (error) {
    console.error('WeChat phone login failed:', error);
    res.status(500).json({
      success: false,
      message: '微信手机号登录失败，请检查小程序 appId/appSecret 和手机号授权配置',
      error: error.message
    });
  }
}

app.post('/api/auth/wechat-phone-login', handleWechatPhoneLogin);
app.post('/api/auth/wechat-login', handleWechatPhoneLogin);

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

app.get('/api/debug/wechat-tls', async (req, res) => {
  const result = {
    env: {
      HTTPS_PROXY: process.env.HTTPS_PROXY || '',
      HTTP_PROXY: process.env.HTTP_PROXY || '',
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS || '',
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || ''
    },
    dns: null,
    https: null
  };

  try {
    result.dns = await dns.lookup('api.weixin.qq.com', { all: true });
  } catch (e) {
    result.dns = { error: e.message, code: e.code };
  }

  await new Promise((resolve) => {
    const req = https.get('https://api.weixin.qq.com', (response) => {
      result.https = {
        ok: true,
        statusCode: response.statusCode,
        headers: response.headers
      };
      response.resume();
      resolve();
    });

    req.on('error', (err) => {
      result.https = {
        ok: false,
        message: err.message,
        code: err.code
      };
      resolve();
    });

    req.setTimeout(8000, () => {
      req.destroy(new Error('debug request timeout'));
    });
  });

  res.json(result);
});
