const express = require('express');
const cors = require('cors');
const { SERVER_CONFIG } = require('./config');
const { getProductGroups } = require('./db');

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
    const data = await getProductGroups();
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Server started on port ${port}`);
});
