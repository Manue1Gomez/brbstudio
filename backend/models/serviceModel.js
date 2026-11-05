const { pool } = require('../config/db');
const { findMissingColumnProblems } = require('../config/schemaCheck');

const REQUIRED_COLUMNS = [
  'service_id',
  'service_name',
  'description',
  'price',
  'image_path',
  'availability',
];

const SERVICE_FIELDS = `service_id AS id,
                        service_name AS name,
                        description,
                        price,
                        image_path AS imagePath,
                        availability AS available`;

async function findAll() {
  const [rows] = await pool.query(`SELECT ${SERVICE_FIELDS} FROM service ORDER BY service_id ASC`);
  return rows;
}

async function findAvailable() {
  const [rows] = await pool.query(
    `SELECT ${SERVICE_FIELDS} FROM service WHERE availability = 1 ORDER BY service_id ASC`
  );
  return rows;
}

async function findById(id) {
  const [[row]] = await pool.query(`SELECT ${SERVICE_FIELDS} FROM service WHERE service_id = ?`, [id]);
  return row || null;
}

// Used by the dashboard: one column per service the studio currently offers.
async function findActive() {
  const [rows] = await pool.query(
    `SELECT service_id AS serviceId,
            service_name AS serviceName
       FROM service
      WHERE availability = 1
      ORDER BY service_id ASC`
  );
  return rows;
}

async function create({ name, description, price, imagePath, available }) {
  const [result] = await pool.query(
    `INSERT INTO service (service_name, description, price, image_path, availability)
     VALUES (?, ?, ?, ?, ?)`,
    [name, description, price, imagePath, available ? 1 : 0]
  );
  return result.insertId;
}

async function update(id, { name, description, price, imagePath, available }) {
  await pool.query(
    `UPDATE service
        SET service_name = ?, description = ?, price = ?, image_path = ?, availability = ?
      WHERE service_id = ?`,
    [name, description, price, imagePath, available ? 1 : 0, id]
  );
}

async function setAvailability(id, available) {
  await pool.query('UPDATE service SET availability = ? WHERE service_id = ?', [available ? 1 : 0, id]);
}

async function remove(id) {
  await pool.query('DELETE FROM service WHERE service_id = ?', [id]);
}

// True when any booking uses this service. Treats a not-yet-created booking table as "no bookings".
async function hasBookings(id) {
  try {
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM booking WHERE service_id = ?', [id]);
    return row.total > 0;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') return false;
    throw error;
  }
}

async function verifySchema() {
  const { problems } = await findMissingColumnProblems('service', REQUIRED_COLUMNS);

  if (problems.length > 0) problems.push('Run database/service_table.sql in phpMyAdmin to fix this.');
  return problems;
}

module.exports = {
  findAll,
  findAvailable,
  findById,
  findActive,
  create,
  update,
  setAvailability,
  remove,
  hasBookings,
  verifySchema,
};
