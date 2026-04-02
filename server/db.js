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

async function getProductGroups() {
  const [rows] = await pool.query(`
    SELECT
      id,
      sku_code,
      brand,
      product_name,
      fan_type,
      model,
      series_name,
      voltage,
      power,
      image_url,
      listing_status,
      sales_level,
      remark,
      created_at,
      updated_at
    FROM product_master
    ORDER BY updated_at DESC, id DESC
  `);

  const groups = [];
  const groupIndexMap = new Map();

  rows.forEach((row) => {
    const imageUrl = normalizeText(row.image_url);
    const groupKey = imageUrl ? `image:${imageUrl}` : `product:${row.id}`;

    let group = groupIndexMap.get(groupKey);

    if (!group) {
      group = {
        groupKey,
        imageUrl,
        products: []
      };

      groupIndexMap.set(groupKey, group);
      groups.push(group);
    }

    group.products.push({
      id: row.id,
      sku_code: normalizeText(row.sku_code),
      brand: normalizeText(row.brand),
      product_name: normalizeText(row.product_name),
      fan_type: normalizeText(row.fan_type),
      model: normalizeText(row.model),
      series_name: normalizeText(row.series_name),
      voltage: normalizeText(row.voltage),
      power: normalizeText(row.power),
      image_url: imageUrl,
      listing_status: normalizeText(row.listing_status),
      sales_level: normalizeText(row.sales_level),
      remark: normalizeText(row.remark),
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at)
    });
  });

  return {
    totalProducts: rows.length,
    totalGroups: groups.length,
    groups: groups.map((group) => ({
      groupKey: group.groupKey,
      imageUrl: group.imageUrl,
      sharedImage: Boolean(group.imageUrl) && group.products.length > 1,
      products: group.products
    }))
  };
}

module.exports = {
  getProductGroups
};
