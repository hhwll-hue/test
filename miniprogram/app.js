const AUTH_STORAGE_KEY = 'fan-price-auth';

App({
  globalData: {
    auth: null
  },

  onLaunch() {
    const auth = wx.getStorageSync(AUTH_STORAGE_KEY) || null;
    this.globalData.auth = auth;
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
