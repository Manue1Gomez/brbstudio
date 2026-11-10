const { pool } = require('../config/db');
const { ONGOING_STATUSES } = require('../config/bookingRules');
const {
  REFERENCE,
  CLIENT_NAME,
  START_MINUTES,
  END_MINUTES,
  SERVICES_SUBQUERY,
  PENDING_PAYMENTS_SUBQUERY,
} = require('./bookingSql');

const quoteList = (values) => values.map((value) => `'${value}'`).join(', ');

const BOOKING_FIELDS = `b.booking_id AS id,
                        b.customer_id AS customerId,
                        DATE_FORMAT(b.event_date, '%Y-%m-%d') AS eventDate,
                        TIME_FORMAT(b.start_time, '%H:%i') AS startTime,
                        TIME_FORMAT(b.end_time, '%H:%i') AS endTime,
                        b.event_address AS eventAddress,
                        b.total_amount AS totalAmount,
                        b.amount_paid AS amountPaid,
                        b.status AS status`;

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildFilters({ search, serviceId, date }) {
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${escapeLike(search.replace(/^#/, ''))}%`;
    conditions.push(`(${CLIENT_NAME} LIKE ? OR c.email LIKE ? OR ${REFERENCE} LIKE ?)`);
    params.push(term, term, term);
  }

  if (serviceId) {
    conditions.push('EXISTS (SELECT 1 FROM booking_service x WHERE x.booking_id = b.booking_id AND x.service_id = ?)');
    params.push(serviceId);
  }

  if (date) {
    conditions.push('b.event_date = ?');
    params.push(date);
  }

  return { conditions, params };
}

function whereClause(conditions) {
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

async function findPage(filters, status, limit, offset) {
  const { conditions, params } = buildFilters(filters);

  if (status) {
    conditions.push('b.status = ?');
    params.push(status);
  }

  const ongoing = quoteList(ONGOING_STATUSES);

  const [rows] = await pool.query(
    `SELECT b.booking_id AS id,
            ${REFERENCE} AS reference,
            ${CLIENT_NAME} AS customerName,
            c.email AS customerEmail,
            ${SERVICES_SUBQUERY} AS services,
            DATE_FORMAT(b.event_date, '%Y-%m-%d') AS eventDate,
            ${START_MINUTES} AS startMinutes,
            ${END_MINUTES} AS endMinutes,
            b.status AS status,
            b.total_amount AS totalAmount,
            b.amount_paid AS amountPaid,
            ${PENDING_PAYMENTS_SUBQUERY} AS pendingPayments
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       ${whereClause(conditions)}
      ORDER BY CASE WHEN b.status IN (${ongoing}) THEN 0 WHEN b.status = 'Completed' THEN 1 ELSE 2 END,
               CASE WHEN b.status IN (${ongoing}) THEN b.event_date END ASC,
               CASE WHEN b.status NOT IN (${ongoing}) THEN b.event_date END DESC,
               b.start_time, b.booking_id
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function countFiltered(filters, status) {
  const { conditions, params } = buildFilters(filters);

  if (status) {
    conditions.push('b.status = ?');
    params.push(status);
  }

  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       ${whereClause(conditions)}`,
    params
  );
  return row.total;
}

async function countByStatus(filters) {
  const { conditions, params } = buildFilters(filters);

  const [rows] = await pool.query(
    `SELECT b.status AS status, COUNT(*) AS total
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
       ${whereClause(conditions)}
      GROUP BY b.status`,
    params
  );
  return rows;
}

async function findDetails(id) {
  const [[row]] = await pool.query(
    `SELECT ${BOOKING_FIELDS},
            ${REFERENCE} AS reference,
            ${CLIENT_NAME} AS customerName,
            c.email AS customerEmail,
            c.contact_num AS customerContact,
            b.voucher_code AS voucherCode,
            b.subtotal AS subtotal,
            b.discount_amount AS discountAmount,
            DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM booking b
       JOIN customer c ON c.customer_id = b.customer_id
      WHERE b.booking_id = ?`,
    [id]
  );
  return row || null;
}

async function findServices(id) {
  const [rows] = await pool.query(
    `SELECT s.service_id AS id, s.service_name AS name, bs.price AS price
       FROM booking_service bs
       JOIN service s ON s.service_id = bs.service_id
      WHERE bs.booking_id = ?
      ORDER BY s.service_id`,
    [id]
  );
  return rows;
}

async function lockById(connection, id) {
  const [[row]] = await connection.query(`SELECT ${BOOKING_FIELDS} FROM booking b WHERE b.booking_id = ? FOR UPDATE`, [id]);
  return row || null;
}

async function findServiceIds(connection, id) {
  const [rows] = await connection.query('SELECT service_id AS serviceId FROM booking_service WHERE booking_id = ?', [id]);
  return rows.map((row) => row.serviceId);
}

async function findConflict(connection, { bookingId, date, startTime, endTime, serviceIds, statuses }) {
  if (serviceIds.length === 0) return null;

  const [[row]] = await connection.query(
    `SELECT ${REFERENCE} AS reference,
            s.service_name AS serviceName,
            TIME_FORMAT(b.start_time, '%H:%i') AS startTime,
            TIME_FORMAT(b.end_time, '%H:%i') AS endTime
       FROM booking b
       JOIN booking_service bs ON bs.booking_id = b.booking_id
       JOIN service s ON s.service_id = bs.service_id
      WHERE b.event_date = ?
        AND b.booking_id <> ?
        AND b.status IN (?)
        AND bs.service_id IN (?)
        AND b.start_time < ?
        AND b.end_time > ?
      ORDER BY b.start_time
      LIMIT 1`,
    [date, bookingId, statuses, serviceIds, `${endTime}:00`, `${startTime}:00`]
  );
  return row || null;
}

async function addToPaid(connection, id, amount) {
  await connection.query('UPDATE booking SET amount_paid = amount_paid + ? WHERE booking_id = ?', [amount, id]);
}

async function setStatus(connection, id, status) {
  await connection.query('UPDATE booking SET status = ? WHERE booking_id = ?', [status, id]);
}

async function update(connection, id, { status, eventDate, startTime, endTime, eventAddress }) {
  await connection.query(
    `UPDATE booking
        SET status = ?, event_date = ?, start_time = ?, end_time = ?, event_address = ?
      WHERE booking_id = ?`,
    [status, eventDate, `${startTime}:00`, `${endTime}:00`, eventAddress, id]
  );
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM booking WHERE booking_id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findPage,
  countFiltered,
  countByStatus,
  findDetails,
  findServices,
  lockById,
  findServiceIds,
  findConflict,
  addToPaid,
  setStatus,
  update,
  remove,
};
