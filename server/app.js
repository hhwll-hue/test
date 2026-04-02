const express = require('express');
const cors = require('cors');
const { SERVER_CONFIG } = require('./config');
const { getProductsWithLatestPrice, saveProductPrice } = require('./db');

const app = express();
const port = SERVER_CONFIG.port || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'server is running'
  });
});

app.get('/api/products', async (req, res) => {
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

app.post('/api/products/:id/price', async (req, res) => {
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
