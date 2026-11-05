const { pool } = require('../config/db');
const { findMissingColumnProblems } = require('../config/schemaCheck');

// Columns the customer table must have for registration and login to work.
const REQUIRED_COLUMNS = ['customer_id', 'f_name', 'l_name', 'contact_num', 'email', 'password'];
// A bcrypt hash is 60 characters long.
const MIN_PASSWORD_LENGTH = 60;

async function countAll() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM customer');
  return row.total;
}

async function findByEmail(email) {
  const [[row]] = await pool.query(
    `SELECT customer_id AS id,
            f_name AS firstName,
            l_name AS lastName,
            contact_num AS contactNumber,
            email,
            password AS passwordHash
       FROM customer
      WHERE email = ?
      LIMIT 1`,
    [email]
  );
  return row || null;
}

async function create({ firstName, lastName, contactNumber, email, passwordHash }) {
  const [result] = await pool.query(
    `INSERT INTO customer (f_name, l_name, contact_num, email, password)
     VALUES (?, ?, ?, ?, ?)`,
    [firstName, lastName, contactNumber, email, passwordHash]
  );
  return result.insertId;
}

// Compares the real table with what the code expects and returns readable problems.
async function verifySchema() {
  const { columns, problems } = await findMissingColumnProblems('customer', REQUIRED_COLUMNS);
  if (!columns) return problems;

  const passwordLength = columns.get('password');
  if (passwordLength && passwordLength < MIN_PASSWORD_LENGTH) {
    problems.push(
      `customer.password is VARCHAR(${passwordLength}); passwords are stored as 60-character hashes, so use VARCHAR(255). See database/customer_table.sql.`
    );
  }

  return problems;
}

module.exports = { countAll, findByEmail, create, verifySchema };
