const { API_BASE_URL } = require('../../utils/config');

Page({
  data: {
    loading: true,
    error: '',
    list: []
  },

  onLoad() {
    this.testHealth();
    this.loadFanTypes();
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

  loadFanTypes() {
    this.setData({
      loading: true,
      error: ''
    });

    wx.request({
      url: `${API_BASE_URL}/api/fan-types`,
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

        this.setData({
          loading: false,
          list: data.data || []
        });
      },
      fail: (err) => {
        console.error('fan-types fail:', err);
        this.setData({
          loading: false,
          error: '无法连接后端接口，请检查服务地址和端口'
        });
      }
    });
  }
});