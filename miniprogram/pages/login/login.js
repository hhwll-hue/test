const { API_BASE_URL } = require('../../utils/config');

Page({
  data: {
    loggingIn: false,
    error: ''
  },

  onShow() {
    const app = getApp();
    const auth = app.getAuth();

    if (auth && auth.token) {
      wx.reLaunch({
        url: '/pages/index/index'
      });
    }
  },

  onGetPhoneNumber(event) {
    if (this.data.loggingIn) {
      return;
    }

    const detail = event.detail || {};
    const phoneCode = String(detail.code || '').trim();
    const errMsg = String(detail.errMsg || '').trim();
    const errno = detail.errno;

    console.log('getPhoneNumber detail:', detail);

    if (!phoneCode) {
      let errorMessage = '未获取到微信手机号授权，请允许手机号登录后重试';

      if (errMsg.includes('user deny') || errMsg.includes('user cancel')) {
        errorMessage = '你已取消手机号授权，请重新点击并允许微信手机号登录';
      } else if (Number(errno) === 102 || errMsg.includes('jsapi has no permission')) {
        errorMessage =
          '当前小程序 AppID 没有微信手机号接口权限，请在小程序后台确认主体类型、认证状态和手机号能力是否已开通';
      } else if (errMsg) {
        errorMessage = `微信手机号授权失败：${errMsg}${errno !== undefined ? ` (${errno})` : ''}`;
      }

      this.setData({
        error: errorMessage
      });
      return;
    }

    this.setData({
      loggingIn: true,
      error: ''
    });

    wx.request({
      url: `${API_BASE_URL}/api/auth/wechat-phone-login`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        phone_code: phoneCode
      },
      success: (res) => {
        const { data } = res;
        console.log('wechat-phone-login response:', res);
        console.log(
          'wechat-phone-login payload:',
          JSON.stringify(
            {
              statusCode: res.statusCode,
              data
            },
            null,
            2
          )
        );

        if (res.statusCode !== 200 || !data || !data.success || !data.data) {
          const backendError = data && data.error ? `：${data.error}` : '';
          this.setData({
            error: ((data && data.message) || '登录失败，请检查手机号是否已登记') + backendError
          });
          return;
        }

        const app = getApp();

        app.setAuth({
          token: data.data.token,
          user: data.data.user,
          phone: data.data.phone || ''
        });

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        wx.reLaunch({
          url: '/pages/index/index'
        });
      },
      fail: () => {
        this.setData({
          error: '无法连接登录接口，请检查后端服务'
        });
      },
      complete: () => {
        this.setData({
          loggingIn: false
        });
      }
    });
  }
});
