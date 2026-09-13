/* ============================================================
   Nyay Setu — MYSQL AUTOMATIC SETUP SCRIPT
   Run with: node database/setup_mysql.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function setupDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  console.log(`[MySQL Setup] Connecting to MySQL server at ${host}:${port} as ${user}...`);

  try {
    // 1. Connect to MySQL server
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      port,
      multipleStatements: true
    });

    console.log('✓ [MySQL Setup] Connected to MySQL server successfully!');

    // 2. Read SQL schema
    const sqlFile = path.join(__dirname, 'init_mysql.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('[MySQL Setup] Creating "Nyay Setu" database and tables...');
    await connection.query(sqlContent);

    console.log('✅ [MySQL Setup] Database "Nyay Setu" & all 7 tables created successfully!');
    console.log('   - users\n   - user_profiles\n   - lawyer_profiles\n   - cases\n   - consultations\n   - documents\n   - notifications\n');
    await connection.end();
  } catch (err) {
    console.error('❌ [MySQL Setup] Could not connect to MySQL:', err.message);
    console.log('\n💡 Note: Make sure MySQL server (e.g. MySQL Workbench or XAMPP) is started on your laptop.');
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
