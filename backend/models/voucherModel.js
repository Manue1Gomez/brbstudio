const { pool } = require('../config/db');
const { findMissingColumnProblems } = require('../config/schemaCheck');

const REQUIRED_COLUMNS = [
  'voucher_id',
  'voucher_code',
  'voucher_name',
  'discount_type',
  'discount_value',
  'start_date',
  'end_date',
  'usage_limit',
  'used_count',
];

const VOUCHER_FIELDS = `voucher_id AS id,
                        voucher_code AS code,
                        voucher_name AS name,
                        discount_type AS discountType,
                        discount_value AS discountValue,
                        start_date AS startDate,
                        end_date AS endDate,
                        usage_limit AS usageLimit,
                        used_count AS usedCount,
                        end_date < CURDATE() AS expired`;

async function findAll(executor = pool) {
  const [rows] = await executor.query(`SELECT ${VOUCHER_FIELDS} FROM voucher ORDER BY voucher_id ASC`);
  return rows;
}

async function findById(id, executor = pool) {
  const [[row]] = await executor.query(`SELECT ${VOUCHER_FIELDS} FROM voucher WHERE voucher_id = ?`, [id]);
  return row || null;
}

async function lockById(connection, id) {
  const [[row]] = await connection.query(
    `SELECT ${VOUCHER_FIELDS} FROM voucher WHERE voucher_id = ? FOR UPDATE`,
    [id]
  );
  return row || null;
}

async function findAvailableForUse(executor, code, { forUpdate = false } = {}) {
  const [[row]] = await executor.query(
    `SELECT voucher_id AS id,
            voucher_code AS code,
            voucher_name AS name,
            discount_type AS discountType,
            discount_value AS discountValue,
            usage_limit AS usageLimit,
            used_count AS usedCount
       FROM voucher
      WHERE voucher_code = ?
        AND CURDATE() BETWEEN start_date AND end_date
        AND used_count < usage_limit${forUpdate ? ' FOR UPDATE' : ''}`,
    [code]
  );
  return row || null;
}

async function findByCodeForUpdate(connection, code) {
  const [[row]] = await connection.query(
    `SELECT voucher_id AS id, voucher_code AS code
       FROM voucher
      WHERE voucher_code = ?
      FOR UPDATE`,
    [code]
  );
  return row || null;
}

async function incrementUsedCount(executor, id) {
  const [result] = await executor.query(
    'UPDATE voucher SET used_count = used_count + 1 WHERE voucher_id = ? AND used_count < usage_limit',
    [id]
  );
  return result.affectedRows === 1;
}

async function countBookingReferences(code, executor = pool) {
  const [[row]] = await executor.query(
    'SELECT COUNT(*) AS total FROM booking WHERE voucher_code = ?',
    [code]
  );
  return Number(row.total);
}

async function decrementUsedCount(executor, code) {
  const [result] = await executor.query(
    'UPDATE voucher SET used_count = GREATEST(used_count - 1, 0) WHERE voucher_code = ?',
    [code]
  );
  return result.affectedRows === 1;
}

async function create({ code, name, discountType, discountValue, startDate, endDate, usageLimit }) {
  const [result] = await pool.query(
    `INSERT INTO voucher
       (voucher_code, voucher_name, discount_type, discount_value, start_date, end_date, usage_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code, name, discountType, discountValue, startDate, endDate, usageLimit]
  );
  return result.insertId;
}

async function update(id, { code, name, discountType, discountValue, startDate, endDate, usageLimit }, executor = pool) {
  await executor.query(
    `UPDATE voucher
        SET voucher_code = ?, voucher_name = ?, discount_type = ?, discount_value = ?,
            start_date = ?, end_date = ?, usage_limit = ?
      WHERE voucher_id = ?`,
    [code, name, discountType, discountValue, startDate, endDate, usageLimit, id]
  );
}

async function verifySchema() {
  const { problems } = await findMissingColumnProblems('voucher', REQUIRED_COLUMNS);

  if (problems.length > 0) {
    problems.push('Run database/update_voucher_usage.sql for existing databases, or database/voucher_table.sql for new installs.');
  }
  return problems;
}

module.exports = {
  findAll,
  findById,
  lockById,
  findAvailableForUse,
  findByCodeForUpdate,
  incrementUsedCount,
  decrementUsedCount,
  countBookingReferences,
  create,
  update,
  verifySchema,
};
