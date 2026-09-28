/* ============================================================
   Nyay Setu — SERVER ENTRYPOINT
   server.js — Boot sequence: seed database, start listener
   ============================================================ */

const app = require('./app');
const envConfig = require('./config/envConfig');
const db = require('./config/dbConfig');
const { seedIfEmpty } = require('./data/seed');

async function main() {
  db.load();
  await seedIfEmpty();

  const PORT = envConfig.port;
  app.listen(PORT, envConfig.host, () => {
    console.log('──────────────────────────────────────────────');
    console.log('  Nyay Setu — Advocate Portal API');
    console.log(`  Environment : ${envConfig.env}`);
    console.log(`  Portal      : http://localhost:${PORT}/  (lawyer SPA)`);
    console.log(`  Admin desk  : http://localhost:${PORT}/admin`);
    console.log(`  Database    : ${db.DB_FILE}`);
    console.log(`  Email       : ${require('./services/mailService').activeChannel() || 'NOT CONFIGURED (dev: OTPs print to this console)'}`);
    console.log('──────────────────────────────────────────────');

    // Auto-check Supreme Court AI RAG Service status
    const { ensureAIServiceRunning } = require('./services/aiSupervisor');
    ensureAIServiceRunning().catch(() => {});
  });
}

main().catch(err => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
