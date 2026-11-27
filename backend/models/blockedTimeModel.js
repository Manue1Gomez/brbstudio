async function findOnDate(executor, date, { forUpdate = false } = {}) {
  const [rows] = await executor.query(
    `SELECT blocked_time_id AS id,
            DATE_FORMAT(event_date, '%Y-%m-%d') AS date,
            TIME_FORMAT(start_time, '%H:%i') AS startTime,
            TIME_FORMAT(end_time, '%H:%i') AS endTime,
            TIME_TO_SEC(start_time) DIV 60 AS startMinute,
            TIME_TO_SEC(end_time) DIV 60 AS endMinute
       FROM blocked_time
      WHERE event_date = ?
      ORDER BY start_time${forUpdate ? ' FOR UPDATE' : ''}`,
    [date]
  );
  return rows;
}

async function findById(executor, id) {
  const [[row]] = await executor.query(
    `SELECT blocked_time_id AS id,
            DATE_FORMAT(event_date, '%Y-%m-%d') AS date
       FROM blocked_time
      WHERE blocked_time_id = ?`,
    [id]
  );
  return row || null;
}

async function create(executor, { date, startTime, endTime }) {
  const [result] = await executor.query(
    'INSERT INTO blocked_time (event_date, start_time, end_time) VALUES (?, ?, ?)',
    [date, `${startTime}:00`, `${endTime}:00`]
  );
  return result.insertId;
}

async function remove(executor, id) {
  const [result] = await executor.query('DELETE FROM blocked_time WHERE blocked_time_id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { findOnDate, findById, create, remove };
