const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./config');

const DB_HOST = DB_CONFIG.host;
const DB_PORT = Number(DB_CONFIG.port || 3306);
const DB_NAME = DB_CONFIG.database;
const DB_USER = DB_CONFIG.user;
const DB_PASSWORD = DB_CONFIG.password;

if (!DB_HOST) throw new Error('DB_HOST is not set');
if (!DB_NAME) throw new Error('DB_NAME is not set');
if (!DB_USER) throw new Error('DB_USER is not set');
if (!DB_PASSWORD) throw new Error('DB_PASSWORD is not set');

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value);
}

function mapProductRow(row) {
  return {
    id: row.id,
    product_name: normalizeText(row.product_name),
    model: normalizeText(row.model),
    voltage: normalizeText(row.voltage),
    power: normalizeText(row.power),
    image_url: normalizeText(row.image_url),
    purchase_price: normalizePrice(row.purchase_price),
    price_time: formatDateTime(row.price_time)
  };
}

async function getProductsWithLatestPrice() {
  const [rows] = await pool.query(`
    SELECT
      pm.id,
      pm.product_name,
      pm.model,
      pm.voltage,
      pm.power,
      pm.image_url,
      (
        SELECT ph.purchase_price
        FROM price_history ph
        WHERE ph.product_id = pm.id
        ORDER BY ph.price_time DESC
        LIMIT 1
      ) AS purchase_price,
      (
        SELECT ph.price_time
        FROM price_history ph
        WHERE ph.product_id = pm.id
        ORDER BY ph.price_time DESC
        LIMIT 1
      ) AS price_time
    FROM product_master
    AS pm
    ORDER BY pm.updated_at DESC, pm.id DESC
  `);

  return {
    totalProducts: rows.length,
    products: rows.map(mapProductRow)
  };
}

async function getProductWithLatestPrice(productId) {
  const [rows] = await pool.query(
    `
      SELECT
        pm.id,
        pm.product_name,
        pm.model,
        pm.voltage,
        pm.power,
        pm.image_url,
        (
          SELECT ph.purchase_price
          FROM price_history ph
          WHERE ph.product_id = pm.id
          ORDER BY ph.price_time DESC
          LIMIT 1
        ) AS purchase_price,
        (
          SELECT ph.price_time
          FROM price_history ph
          WHERE ph.product_id = pm.id
          ORDER BY ph.price_time DESC
          LIMIT 1
        ) AS price_time
      FROM product_master pm
      WHERE pm.id = ?
      LIMIT 1
    `,
    [productId]
  );

  if (!rows.length) {
    return null;
  }

  return mapProductRow(rows[0]);
}

async function saveProductPrice(productId, purchasePrice) {
  const product = await getProductWithLatestPrice(productId);

  if (!product) {
    return null;
  }

  await pool.execute(
    `
      INSERT INTO price_history (product_id, purchase_price)
      VALUES (?, ?)
    `,
    [productId, purchasePrice]
  );

  return getProductWithLatestPrice(productId);
}

module.exports = {
  getProductsWithLatestPrice,
  saveProductPrice
};
