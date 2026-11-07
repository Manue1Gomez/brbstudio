const { pool } = require('../config/db');
const { findMissingColumnProblems } = require('../config/schemaCheck');

const REQUIRED_COLUMNS = ['blocked_id', 'blocked_on'];

async function findBetween(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(blocked_on, '%Y-%m-%d') AS date
       FROM blocked_date
      WHERE blocked_on BETWEEN ? AND ?
      ORDER BY blocked_on`,
    [startDate, endDate]
  );
  return rows.map((row) => row.date);
}

async function findFrom(startDate) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(blocked_on, '%Y-%m-%d') AS date
       FROM blocked_date
      WHERE blocked_on >= ?
      ORDER BY blocked_on`,
    [startDate]
  );
  return rows.map((row) => row.date);
}

async function exists(date) {
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM blocked_date WHERE blocked_on = ?', [date]);
  return row.total > 0;
}

async function create(date) {
  await pool.query('INSERT INTO blocked_date (blocked_on) VALUES (?)', [date]);
}

async function remove(date) {
  const [result] = await pool.query('DELETE FROM blocked_date WHERE blocked_on = ?', [date]);
  return result.affectedRows > 0;
}

async function verifySchema() {
  const { problems } = await findMissingColumnProblems('blocked_date', REQUIRED_COLUMNS);

  if (problems.length > 0) problems.push('Run database/booking_tables.sql in phpMyAdmin to fix this.');
  return problems;
}

module.exports = { findBetween, findFrom, exists, create, remove, verifySchema };
