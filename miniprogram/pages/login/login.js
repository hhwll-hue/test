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

    const phoneCode = String((event.detail && event.detail.code) || '').trim();

    if (!phoneCode) {
      this.setData({
        error: '未获取到微信手机号授权，请允许手机号登录后重试'
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

        if (res.statusCode !== 200 || !data || !data.success || !data.data) {
          this.setData({
            error: (data && data.message) || '登录失败，请检查手机号是否已登记'
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
