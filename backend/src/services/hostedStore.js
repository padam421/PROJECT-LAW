/* Durable state and credential files for hosts with an ephemeral filesystem.
   One web instance only: optimistic revisions refuse competing snapshot writers. */
const fs = require('fs');
const path = require('path');
let revision = 0;
function pool() {
  const result = require('./dbService').getMySQLPool();
  if (!result) throw new Error('A MySQL database is required for durable hosted storage.');
  return result;
}
async function initialize() {
  const database = pool();
  await database.query('SELECT 1');
  // All statements are fixed, checked-in schema; credentials never enter SQL text.
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../database/setup_complete_mysql.sql'), 'utf8')
    .replace(/^\s*--.*$/gm, '');
  for (const statement of sql.split(';').map(s => s.trim()).filter(s => /^CREATE TABLE\b/i.test(s))) {
    await database.query(statement);
  }
  await database.query(`CREATE TABLE IF NOT EXISTS hosted_app_state (
    id INT PRIMARY KEY, revision INT NOT NULL, payload LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await database.query(`CREATE TABLE IF NOT EXISTS hosted_upload_parts (
    name VARCHAR(200) NOT NULL, part INT NOT NULL, content MEDIUMBLOB NOT NULL,
    PRIMARY KEY(name,part))`);
  const [rows] = await database.query('SELECT revision,payload FROM hosted_app_state WHERE id=1');
  revision = rows[0]?.revision || 0;
  return rows.length ? JSON.parse(rows[0].payload) : null;
}
async function save(payload) {
  if (!revision) {
    await pool().query('INSERT INTO hosted_app_state(id,revision,payload) VALUES(1,1,?)', [payload]);
    revision = 1;
    return;
  }
  const [result] = await pool().query('UPDATE hosted_app_state SET payload=?,revision=revision+1 WHERE id=1 AND revision=?', [payload, revision]);
  if (result.affectedRows !== 1) throw new Error('Durable state revision conflict. Run a single web instance and restart it.');
  revision += 1;
}
async function saveFile(name, bytes) {
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    for (let offset = 0, part = 0; offset < bytes.length; offset += 512 * 1024, part++) {
      await connection.query('INSERT INTO hosted_upload_parts(name,part,content) VALUES(?,?,?)', [name, part, bytes.subarray(offset, offset + 512 * 1024)]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
async function readFile(name) {
  const [rows] = await pool().query('SELECT content FROM hosted_upload_parts WHERE name=? ORDER BY part', [name]);
  return rows.length ? Buffer.concat(rows.map(row => row.content)) : null;
}
async function deleteFile(name) {
  await pool().query('DELETE FROM hosted_upload_parts WHERE name=?', [name]);
}
async function health() { await pool().query({ sql: 'SELECT 1', timeout: 2500 }); }
async function close() { await pool().end(); }
module.exports = { initialize, save, saveFile, readFile, deleteFile, health, close };
