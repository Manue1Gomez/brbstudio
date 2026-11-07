const { pool } = require('../config/db');
const { findMissingColumnProblems } = require('../config/schemaCheck');

const REQUIRED_BOOKING_COLUMNS = [
  'booking_id',
  'customer_id',
  'event_date',
  'start_time',
  'end_time',
  'subtotal',
  'discount_amount',
  'total_amount',
  'amount_paid',
  'status',
];
const REQUIRED_BOOKING_SERVICE_COLUMNS = ['booking_id', 'service_id', 'price'];

const CLIENT_NAME = "CONCAT(c.f_name, ' ', c.l_name)";
const START_MINUTES = 'TIME_TO_SEC(b.start_time) DIV 60';
const END_MINUTES = 'TIME_TO_SEC(b.end_time) DIV 60';

async function countAll() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM booking');
  return row.total;
}

async function countByStatus(status) {
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM booking WHERE status = ?', [status]);
  return row.total;
}

async function sumBalanceByStatuses(statuses) {
  const [[row]] = await pool.query(
    'SELECT COALESCE(SUM(total_amount - amount_paid), 0) AS total FROM booking WHERE status IN (?)',
    [statuses]
  );
  return Number(row.total);
}

async function findUpcoming(statuses, limit) {
  const [rows] = await pool.query(
    `SELECT b.booking_id AS id,
            DATE_FORMAT(b.event_date, '%Y-%m-%d') AS eventDate,
            ${START_MINUTES} AS startMinutes,
            ${CLIENT_NAME} AS clientName,
            GROUP_CONCAT(s.service_name ORDER BY s.service_id SEPARATOR ', ') AS serviceName
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       JOIN booking_service bs ON bs.booking_id = b.booking_id
       JOIN service s ON s.service_id = bs.service_id
      WHERE b.event_date >= CURDATE()
        AND b.status IN (?)
      GROUP BY b.booking_id, b.event_date, b.start_time, c.f_name, c.l_name
      ORDER BY b.event_date, b.start_time
      LIMIT ?`,
    [statuses, limit]
  );
  return rows;
}

async function findScheduleEntries(date, statuses) {
  const [rows] = await pool.query(
    `SELECT b.booking_id AS id,
            bs.service_id AS serviceId,
            s.service_name AS serviceName,
            ${START_MINUTES} AS startMinutes,
            ${END_MINUTES} AS endMinutes,
            b.status AS status,
            ${CLIENT_NAME} AS clientName
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       JOIN booking_service bs ON bs.booking_id = b.booking_id
       JOIN service s ON s.service_id = bs.service_id
      WHERE b.event_date = ?
        AND b.status IN (?)`,
    [date, statuses]
  );
  return rows;
}

async function findBookedDates(startDate, endDate, statuses) {
  const [rows] = await pool.query(
    `SELECT DISTINCT DATE_FORMAT(event_date, '%Y-%m-%d') AS date
       FROM booking
      WHERE event_date BETWEEN ? AND ?
        AND status IN (?)
      ORDER BY date`,
    [startDate, endDate, statuses]
  );
  return rows.map((row) => row.date);
}

async function findOnDate(date, statuses) {
  const [rows] = await pool.query(
    `SELECT b.booking_id AS id,
            ${START_MINUTES} AS startMinutes,
            ${END_MINUTES} AS endMinutes,
            b.status AS status,
            ${CLIENT_NAME} AS clientName,
            GROUP_CONCAT(s.service_name ORDER BY s.service_id SEPARATOR ', ') AS serviceNames
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       JOIN booking_service bs ON bs.booking_id = b.booking_id
       JOIN service s ON s.service_id = bs.service_id
      WHERE b.event_date = ?
        AND b.status IN (?)
      GROUP BY b.booking_id, b.start_time, b.end_time, b.status, c.f_name, c.l_name
      ORDER BY b.start_time`,
    [date, statuses]
  );
  return rows;
}

async function verifySchema() {
  const [booking, bookingService] = await Promise.all([
    findMissingColumnProblems('booking', REQUIRED_BOOKING_COLUMNS),
    findMissingColumnProblems('booking_service', REQUIRED_BOOKING_SERVICE_COLUMNS),
  ]);

  const problems = [...booking.problems, ...bookingService.problems];
  if (problems.length > 0) problems.push('Run database/booking_tables.sql in phpMyAdmin to fix this.');

  return problems;
}

module.exports = {
  countAll,
  countByStatus,
  sumBalanceByStatuses,
  findUpcoming,
  findScheduleEntries,
  findBookedDates,
  findOnDate,
  verifySchema,
};
