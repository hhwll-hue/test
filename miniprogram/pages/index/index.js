const { API_BASE_URL } = require('../../utils/config');

Page({
  data: {
    loading: true,
    error: '',
    groups: [],
    totalProducts: 0,
    totalGroups: 0
  },

  onLoad() {
    this.testHealth();
    this.loadProducts();
  },

  testHealth() {
    wx.request({
      url: `${API_BASE_URL}/api/health`,
      method: 'GET',
      success: (res) => {
        console.log('health success:', res.data);
      },
      fail: (err) => {
        console.error('health fail:', err);
      }
    });
  },

  loadProducts() {
    this.setData({
      loading: true,
      error: ''
    });

    wx.request({
      url: `${API_BASE_URL}/api/products`,
      method: 'GET',
      success: (res) => {
        const { data } = res;

        if (res.statusCode !== 200 || !data || !data.success) {
          this.setData({
            loading: false,
            error: (data && data.message) || '接口请求失败'
          });
          return;
        }

        const payload = data.data || {};

        this.setData({
          loading: false,
          groups: payload.groups || [],
          totalProducts: payload.totalProducts || 0,
          totalGroups: payload.totalGroups || 0
        });
      },
      fail: (err) => {
        console.error('products fail:', err);
        this.setData({
          loading: false,
          error: '无法连接后端接口，请检查服务地址和端口'
        });
      }
    });
  }
});
