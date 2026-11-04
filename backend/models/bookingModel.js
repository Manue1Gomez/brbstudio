const { pool } = require('../config/db');

async function countAll() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM booking');
  return row.total;
}

async function countByStatus(status) {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS total FROM booking WHERE Status = ?',
    [status]
  );
  return row.total;
}

async function sumBalanceByStatuses(statuses) {
  const [[row]] = await pool.query(
    'SELECT COALESCE(SUM(Balance), 0) AS total FROM booking WHERE Status IN (?)',
    [statuses]
  );
  return Number(row.total);
}

async function findUpcoming(statuses, limit) {
  const [rows] = await pool.query(
    `SELECT b.Booking_ID AS id,
            DATE_FORMAT(b.Event_date, '%Y-%m-%d') AS eventDate,
            b.Time_Slot AS timeSlot,
            s.Service_Name AS serviceName,
            CONCAT(c.f_name, ' ', c.l_name) AS clientName
       FROM booking b
       JOIN customer c ON c.customer_id = b.Customer_ID
       JOIN service s ON s.Service_ID = b.Service_ID
      WHERE b.Event_date >= CURDATE()
        AND b.Status IN (?)
      ORDER BY b.Event_date ASC
      LIMIT ?`,
    [statuses, limit]
  );
  return rows;
}

async function findByDate(date, statuses) {
  const [rows] = await pool.query(
    `SELECT b.Booking_ID AS id,
            b.Service_ID AS serviceId,
            b.Time_Slot AS timeSlot,
            b.Status AS status,
            s.Service_Name AS serviceName,
            CONCAT(c.f_name, ' ', c.l_name) AS clientName
       FROM booking b
       JOIN customer c ON c.customer_id = b.Customer_ID
       JOIN service s ON s.Service_ID = b.Service_ID
      WHERE DATE(b.Event_date) = ?
        AND b.Status IN (?)`,
    [date, statuses]
  );
  return rows;
}

module.exports = {
  countAll,
  countByStatus,
  sumBalanceByStatuses,
  findUpcoming,
  findByDate,
};
