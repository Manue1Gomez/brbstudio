const { REFERENCE } = require('./bookingSql');

async function findAvailableServices(connection, serviceIds) {
  const [rows] = await connection.query(
    `SELECT service_id AS id,
            service_name AS name,
            duration_hours AS durationHours,
            price
       FROM service
      WHERE availability = 1
        AND service_id IN (?)
      ORDER BY service_id`,
    [serviceIds]
  );
  return rows;
}

async function create(connection, { customerId, eventDate, startTime, endTime, subtotal, discountAmount, totalAmount, voucherCode }) {
  const [result] = await connection.query(
    `INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, discount_amount, total_amount, voucher_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customerId, eventDate, `${startTime}:00`, `${endTime}:00`, subtotal, discountAmount ?? 0, totalAmount, voucherCode ?? null]
  );
  return result.insertId;
}

async function addServices(connection, bookingId, services) {
  await connection.query('INSERT INTO booking_service (booking_id, service_id, price) VALUES ?', [
    services.map((service) => [bookingId, service.id, service.price]),
  ]);
}

async function findReference(connection, bookingId) {
  const [[row]] = await connection.query(
    `SELECT ${REFERENCE} AS reference FROM booking b WHERE b.booking_id = ?`,
    [bookingId]
  );
  return row.reference;
}

module.exports = { findAvailableServices, create, addServices, findReference };
