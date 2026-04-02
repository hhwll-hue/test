const { API_BASE_URL } = require('../../utils/config');

Page({
  data: {
    loading: true,
    error: '',
    products: [],
    totalProducts: 0,
    savingProductId: null
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
          products: (payload.products || []).map((item) => ({
            ...item,
            draftPrice: ''
          })),
          totalProducts: payload.totalProducts || 0
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
  },

  onPriceInput(event) {
    const { index } = event.currentTarget.dataset;
    const { value } = event.detail;

    this.setData({
      [`products[${index}].draftPrice`]: value
    });
  },

  submitPrice(event) {
    const { index } = event.currentTarget.dataset;
    const product = this.data.products[index];

    if (!product) {
      return;
    }

    const purchasePrice = String(product.draftPrice || '').trim();

    if (!purchasePrice) {
      wx.showToast({
        title: '请输入价格',
        icon: 'none'
      });
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(purchasePrice)) {
      wx.showToast({
        title: '价格格式不正确',
        icon: 'none'
      });
      return;
    }

    this.setData({
      savingProductId: product.id
    });

    wx.request({
      url: `${API_BASE_URL}/api/products/${product.id}/price`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        purchase_price: purchasePrice
      },
      success: (res) => {
        const { data } = res;

        if (res.statusCode !== 200 || !data || !data.success || !data.data) {
          wx.showToast({
            title: (data && data.message) || '保存失败',
            icon: 'none'
          });
          return;
        }

        this.setData({
          [`products[${index}].purchase_price`]: data.data.purchase_price || '',
          [`products[${index}].price_time`]: data.data.price_time || '',
          [`products[${index}].draftPrice`]: ''
        });

        wx.showToast({
          title: '价格已保存',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('save price fail:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          savingProductId: null
        });
      }
    });
  }
});
