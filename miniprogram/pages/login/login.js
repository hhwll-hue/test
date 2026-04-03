const { API_BASE_URL } = require('../../utils/config');

Page({
  data: {
    userName: '',
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

  onUserNameInput(event) {
    this.setData({
      userName: event.detail.value,
      error: ''
    });
  },

  submitLogin() {
    const userName = String(this.data.userName || '').trim();

    if (!userName) {
      this.setData({
        error: '请输入登录姓名'
      });
      return;
    }

    this.setData({
      loggingIn: true,
      error: ''
    });

    wx.login({
      success: ({ code }) => {
        if (!code) {
          this.setData({
            loggingIn: false,
            error: '微信登录失败，请稍后重试'
          });
          return;
        }

        wx.request({
          url: `${API_BASE_URL}/api/auth/wechat-login`,
          method: 'POST',
          header: {
            'content-type': 'application/json'
          },
          data: {
            code,
            user_name: userName
          },
          success: (res) => {
            const { data } = res;

            if (res.statusCode !== 200 || !data || !data.success || !data.data) {
              this.setData({
                error: (data && data.message) || '登录失败，请检查账号状态'
              });
              return;
            }

            const app = getApp();

            app.setAuth({
              token: data.data.token,
              user: data.data.user,
              wechat_openid: data.data.wechat_openid || ''
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
      },
      fail: () => {
        this.setData({
          loggingIn: false,
          error: '微信登录失败，请确认开发者工具已开启小程序能力'
        });
      }
    });
  }
});
