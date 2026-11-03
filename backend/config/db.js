const mysql = require('mysql2/promise');
require('dotenv').config();

// Defaults match a fresh XAMPP install (user "root", empty password).
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'brbstudiodb',
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE/DATETIME columns as plain strings so timezones never shift a booking day.
  dateStrings: true,
});

async function testConnection() {
  const connection = await pool.getConnection();
  connection.release();
}

module.exports = { pool, testConnection };
