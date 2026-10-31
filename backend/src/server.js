/* ============================================================
   Nyay Setu — SERVER ENTRYPOINT
   server.js — Boot sequence: seed database, start listener
   ============================================================ */

const app = require('./app');
const envConfig = require('./config/envConfig');
const db = require('./config/dbConfig');
const { seedIfEmpty } = require('./data/seed');

async function main() {
  await db.initialize();
  await seedIfEmpty();
  await db.flushDurable();

  const PORT = envConfig.port;
  const server = app.listen(PORT, envConfig.host, () => {
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
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const forced = setTimeout(() => process.exit(1), 25000);
    forced.unref();
    server.close(async () => {
      try {
        db.flushNow();
        await db.flushDurable();
        if (db.hosted) await require('./services/hostedStore').close();
        clearTimeout(forced);
        process.exit(0);
      } catch (_) { process.exit(1); }
    });
    server.closeIdleConnections();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
