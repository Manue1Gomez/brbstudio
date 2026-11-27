const { pool } = require('../config/db');
const { REFERENCE, CLIENT_NAME } = require('./bookingSql');

const SHARE = 'bs.price / NULLIF(b.subtotal, 0)';

async function findSummary(startDate, endDate, statuses) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS bookings,
            COALESCE(SUM(b.total_amount), 0) AS bookingValue,
            COALESCE(SUM(b.amount_paid), 0) AS received
       FROM booking b
      WHERE b.event_date BETWEEN ? AND ?
        AND b.status IN (?)`,
    [startDate, endDate, statuses]
  );
  return row;
}

async function findServiceSummary(serviceId, startDate, endDate, statuses) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS bookings,
            COALESCE(SUM(b.total_amount * ${SHARE}), 0) AS bookingValue,
            COALESCE(SUM(b.amount_paid * ${SHARE}), 0) AS received
       FROM booking b
       JOIN booking_service bs ON bs.booking_id = b.booking_id
      WHERE bs.service_id = ?
        AND b.event_date BETWEEN ? AND ?
        AND b.status IN (?)`,
    [serviceId, startDate, endDate, statuses]
  );
  return row;
}

async function findMonthlyIncome(startDate, endDate, statuses) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(b.event_date, '%Y-%m') AS month,
            COALESCE(SUM(b.amount_paid), 0) AS income
       FROM booking b
      WHERE b.event_date BETWEEN ? AND ?
        AND b.status IN (?)
      GROUP BY month`,
    [startDate, endDate, statuses]
  );
  return rows;
}

async function findServiceMonthlyIncome(serviceId, startDate, endDate, statuses) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(b.event_date, '%Y-%m') AS month,
            COALESCE(SUM(b.amount_paid * ${SHARE}), 0) AS income
       FROM booking b
       JOIN booking_service bs ON bs.booking_id = b.booking_id
      WHERE bs.service_id = ?
        AND b.event_date BETWEEN ? AND ?
        AND b.status IN (?)
      GROUP BY month`,
    [serviceId, startDate, endDate, statuses]
  );
  return rows;
}

async function findBookingsByService(startDate, endDate, statuses) {
  const [rows] = await pool.query(
    `SELECT s.service_id AS id,
            s.service_name AS name,
            COUNT(b.booking_id) AS bookings,
            COALESCE(SUM(b.total_amount * ${SHARE}), 0) AS bookingValue,
            COALESCE(SUM(b.amount_paid * ${SHARE}), 0) AS received
       FROM service s
       LEFT JOIN booking_service bs ON bs.service_id = s.service_id
       LEFT JOIN booking b ON b.booking_id = bs.booking_id
        AND b.event_date BETWEEN ? AND ?
        AND b.status IN (?)
      GROUP BY s.service_id, s.service_name
      ORDER BY s.service_id`,
    [startDate, endDate, statuses]
  );
  return rows;
}

async function findServiceBookings(serviceId, startDate, endDate, statuses) {
  const [rows] = await pool.query(
    `SELECT b.booking_id AS id,
            ${REFERENCE} AS reference,
            ${CLIENT_NAME} AS clientName,
            DATE_FORMAT(b.event_date, '%Y-%m-%d') AS eventDate,
            b.status AS status,
            b.total_amount * ${SHARE} AS bookingValue,
            b.amount_paid * ${SHARE} AS received
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       JOIN booking_service bs ON bs.booking_id = b.booking_id
      WHERE bs.service_id = ?
        AND b.event_date BETWEEN ? AND ?
        AND b.status IN (?)
      ORDER BY b.event_date DESC, b.booking_id DESC`,
    [serviceId, startDate, endDate, statuses]
  );
  return rows;
}

module.exports = {
  findSummary,
  findServiceSummary,
  findMonthlyIncome,
  findServiceMonthlyIncome,
  findBookingsByService,
  findServiceBookings,
};
