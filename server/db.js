const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

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

async function getFanTypeList() {
  const [rows] = await pool.query(`
    SELECT id, fan_type
    FROM product_master
    ORDER BY id DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    fan_type: row.fan_type || ''
  }));
}

module.exports = {
  getFanTypeList
};