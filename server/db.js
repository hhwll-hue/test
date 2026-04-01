const mysql = require('mysql2/promise');

function parseMysqlAddress(address) {
  if (!address) {
    throw new Error('MYSQL_ADDRESS is not set');
  }

  const [host, port] = address.split(':');

  return {
    host,
    port: Number(port || 3306)
  };
}

const { host, port } = parseMysqlAddress(process.env.MYSQL_ADDRESS);

const pool = mysql.createPool({
  host,
  port,
  user: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
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