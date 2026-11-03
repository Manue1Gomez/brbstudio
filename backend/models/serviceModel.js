const { pool } = require('../config/db');

// Services the studio currently offers (the "Active" toggle on the Services page).
async function findActive() {
  const [rows] = await pool.query(
    `SELECT Service_ID AS serviceId,
            Service_Name AS serviceName
       FROM service
      WHERE Availability = 1
      ORDER BY Service_ID ASC`
  );
  return rows;
}

module.exports = { findActive };
