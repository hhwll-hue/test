const { API_BASE_URL } = require('../../utils/config');

Page({
  data: {
    loading: true,
    error: '',
    list: []
  },

  onLoad() {
    this.loadFanTypes();
  },

  loadFanTypes() {
    this.setData({
      loading: true,
      error: ''
    });

    wx.request({
      url: `${API_BASE_URL + '/https://fan-240142-10-1417324185.sh.run.tcloudbase.com'}/api/fan-types`,
      method: 'GET',
      success: (res) => {
        const { data } = res;

        if (res.statusCode !== 200 || !data.success) {
          this.setData({
            loading: false,
            error: data.message || '接口请求失败'
          });
          return;
        }

        this.setData({
          loading: false,
          list: data.data || []
        });
      },
      fail: () => {
        this.setData({
          loading: false,
          error: '无法连接后端接口，请检查服务地址和端口'
        });
      }
    });
  }
});
