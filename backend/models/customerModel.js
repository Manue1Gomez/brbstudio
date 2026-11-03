const { pool } = require('../config/db');

async function countAll() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM customer');
  return row.total;
}

module.exports = { countAll };
