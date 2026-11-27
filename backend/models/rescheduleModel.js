const { pool } = require('../config/db');
const { RESCHEDULE_STATUS } = require('../config/bookingStatus');
const { REFERENCE, CLIENT_NAME, SERVICES_SUBQUERY } = require('./bookingSql');

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

module.exports = {
  findPending
};