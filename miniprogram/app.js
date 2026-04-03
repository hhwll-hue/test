const AUTH_STORAGE_KEY = 'fan-price-auth';

App({
  globalData: {
    auth: null
  },

  onLaunch() {
    const auth = wx.getStorageSync(AUTH_STORAGE_KEY) || null;
    this.globalData.auth = auth;

    if (wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        env: 'https://fan-240142-10-1417324185.sh.run.tcloudbase.com'
      });
    }
  },

  getAuth() {
    if (this.globalData.auth) {
      return this.globalData.auth;
    }

    const auth = wx.getStorageSync(AUTH_STORAGE_KEY) || null;
    this.globalData.auth = auth;
    return auth;
  },

  setAuth(auth) {
    this.globalData.auth = auth || null;

    if (auth) {
      wx.setStorageSync(AUTH_STORAGE_KEY, auth);
      return;
    }

    wx.removeStorageSync(AUTH_STORAGE_KEY);
  },

  clearAuth() {
    this.setAuth(null);
  },

  getAuthHeader() {
    const auth = this.getAuth();

    if (!auth || !auth.token) {
      return {};
    }

    return {
      Authorization: `Bearer ${auth.token}`
    };
  }
});
