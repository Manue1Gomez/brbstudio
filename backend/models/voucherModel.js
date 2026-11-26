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

async function findById(id, executor = pool) {
  const [[row]] = await executor.query(`SELECT ${VOUCHER_FIELDS} FROM voucher WHERE voucher_id = ?`, [id]);
  return row || null;
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

async function incrementUsedCount(executor, id) {
  const [result] = await executor.query(
    'UPDATE voucher SET used_count = used_count + 1 WHERE voucher_id = ? AND used_count < usage_limit',
    [id]
  );
  return result.affectedRows === 1;
}

async function remove(id) {
  await pool.query('DELETE FROM voucher WHERE voucher_id = ?', [id]);
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
  remove,
  verifySchema,
};