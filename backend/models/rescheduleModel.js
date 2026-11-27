const { pool } = require('../config/db');
const { findMissingColumnProblems } = require('../config/schemaCheck');
const { RESCHEDULE_STATUS } = require('../config/bookingStatus');
const { REFERENCE, CLIENT_NAME, SERVICES_SUBQUERY } = require('./bookingSql');

const REQUIRED_COLUMNS = [
  'request_id',
  'booking_id',
  'old_date',
  'old_start_time',
  'old_end_time',
  'new_date',
  'new_start_time',
  'new_end_time',
  'status',
  'created_at',
  'reviewed_at',
];

async function findPending() {
  const [rows] = await pool.query(
    `SELECT rr.request_id AS id,
            rr.booking_id AS bookingId,
            ${REFERENCE} AS reference,
            ${CLIENT_NAME} AS customerName,
            ${SERVICES_SUBQUERY} AS services,
            DATE_FORMAT(b.event_date, '%Y-%m-%d') AS oldDate,
            TIME_TO_SEC(b.start_time) DIV 60 AS oldStartMinutes,
            TIME_TO_SEC(b.end_time) DIV 60 AS oldEndMinutes,
            DATE_FORMAT(rr.new_date, '%Y-%m-%d') AS newDate,
            TIME_TO_SEC(rr.new_start_time) DIV 60 AS newStartMinutes,
            TIME_TO_SEC(rr.new_end_time) DIV 60 AS newEndMinutes,
            DATE_FORMAT(rr.created_at, '%Y-%m-%d %H:%i:%s') AS requestedAt
       FROM reschedule_request rr
       JOIN booking b ON b.booking_id = rr.booking_id
       JOIN customer c ON c.customer_id = b.customer_id
      WHERE rr.status = ?
      ORDER BY rr.created_at ASC, rr.request_id ASC`,
    [RESCHEDULE_STATUS.PENDING]
  );
  return rows;
}

async function lockPendingById(connection, id) {
  const [[row]] = await connection.query(
    `SELECT request_id AS id,
            booking_id AS bookingId,
            DATE_FORMAT(new_date, '%Y-%m-%d') AS newDate,
            TIME_FORMAT(new_start_time, '%H:%i') AS newStartTime,
            TIME_FORMAT(new_end_time, '%H:%i') AS newEndTime
       FROM reschedule_request
      WHERE request_id = ? AND status = ?
        FOR UPDATE`,
    [id, RESCHEDULE_STATUS.PENDING]
  );
  return row || null;
}

async function markReviewed(connection, id, status) {
  await connection.query('UPDATE reschedule_request SET status = ?, reviewed_at = NOW() WHERE request_id = ?', [
    status,
    id,
  ]);
}

async function findPendingIdByBooking(connection, bookingId) {
  const [[row]] = await connection.query(
    'SELECT request_id AS id FROM reschedule_request WHERE booking_id = ? AND status = ? FOR UPDATE',
    [bookingId, RESCHEDULE_STATUS.PENDING]
  );
  return row ? row.id : null;
}

async function create(connection, { bookingId, old, requested }) {
  await connection.query(
    `INSERT INTO reschedule_request
       (booking_id, old_date, old_start_time, old_end_time, new_date, new_start_time, new_end_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      bookingId,
      old.date,
      `${old.startTime}:00`,
      `${old.endTime}:00`,
      requested.date,
      `${requested.startTime}:00`,
      `${requested.endTime}:00`,
    ]
  );
}

async function updatePending(connection, id, { date, startTime, endTime }) {
  await connection.query(
    `UPDATE reschedule_request
        SET new_date = ?, new_start_time = ?, new_end_time = ?, created_at = NOW()
      WHERE request_id = ?`,
    [date, `${startTime}:00`, `${endTime}:00`, id]
  );
}

async function findLatestByBooking(bookingId) {
  const [[row]] = await pool.query(
    `SELECT status,
            DATE_FORMAT(new_date, '%Y-%m-%d') AS newDate,
            TIME_FORMAT(new_start_time, '%H:%i') AS newStartTime,
            TIME_FORMAT(new_end_time, '%H:%i') AS newEndTime,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS requestedAt
       FROM reschedule_request
      WHERE booking_id = ?
      ORDER BY created_at DESC, request_id DESC
      LIMIT 1`,
    [bookingId]
  );
  return row || null;
}

async function verifySchema() {
  const { problems } = await findMissingColumnProblems('reschedule_request', REQUIRED_COLUMNS);

  if (problems.length > 0) {
    problems.push('Run database/reschedule_table.sql (new table) or database/update_reschedule_table.sql (existing table) in phpMyAdmin to fix this.');
  }
  return problems;
}

module.exports = {
  findPending,
  lockPendingById,
  markReviewed,
  findPendingIdByBooking,
  create,
  updatePending,
  findLatestByBooking,
  verifySchema,
};
