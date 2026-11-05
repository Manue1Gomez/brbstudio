const { pool } = require('./db');

async function getTableColumns(tableName) {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME AS name, CHARACTER_MAXIMUM_LENGTH AS length
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?`,
    [tableName]
  );

  if (columns.length === 0) return null;
  return new Map(columns.map(({ name, length }) => [name.toLowerCase(), length]));
}

async function findMissingColumnProblems(tableName, requiredColumns) {
  const columns = await getTableColumns(tableName);

  if (!columns) return { columns: null, problems: [`Table "${tableName}" was not found in the database.`] };

  const problems = requiredColumns
    .filter((name) => !columns.has(name))
    .map((name) => `Table "${tableName}" is missing the column "${name}".`);

  return { columns, problems };
}

module.exports = { getTableColumns, findMissingColumnProblems };
