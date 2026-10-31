/* Real production middleware with storage failure injected only at the external I/O boundary. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'synthetic-production-test-with-a-long-enough-secret';
process.env.ADMIN_PASSWORD = 'synthetic-test-admin-password';
process.env.BREVO_API_KEY = 'synthetic-not-a-provider-key';
process.env.APP_BASE_URL = 'https://nyay.example.invalid';
process.env.STATE_STORE = 'mysql';
process.env.DATA_DIR = path.resolve('.tmp-test', 'production-http-' + process.pid);
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
let unavailable = false, saved;
const storePath = require.resolve('../backend/src/services/hostedStore');
require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: {
  initialize: async () => null,
  save: async payload => { if (unavailable) throw new Error('Synthetic storage outage'); saved = JSON.parse(payload); }
} };
const db = require('../backend/src/config/dbConfig');
const express = require('../backend/node_modules/express');
const routes = express.Router();
routes.post('/qa/state', (req, res) => {
  db.get().workspace.example = { value: req.body.value };
  db.save();
  res.cookie('test_session', 'synthetic', { httpOnly: true });
  res.json({ ok: true });
});
const routesPath = require.resolve('../backend/src/routes');
require.cache[routesPath] = { id: routesPath, filename: routesPath, loaded: true, exports: routes };
const app = require('../backend/src/app');

test('production rejects cross-site mutations and never reports unsaved writes as successful', async () => {
  await db.initialize();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const send = (value, origin = process.env.APP_BASE_URL) => fetch(base + '/api/qa/state', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ value })
  });
  try {
    const client = await fetch(base + '/frontend/user/index.html');
    assert.equal(client.status, 200);
    assert.equal(client.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    assert.equal(client.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    const otherPortal = await fetch(base + '/frontend/lawyer/index.html');
    assert.equal(otherPortal.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal((await send('cross-site', 'https://untrusted.example')).status, 403);
    assert.equal(saved, undefined);
    assert.equal((await send('durable')).status, 200);
    assert.equal(saved.workspace.example.value, 'durable');
    unavailable = true;
    const failure = await send('pending');
    assert.equal(failure.status, 503);
    assert.equal(failure.headers.get('set-cookie'), null);
    assert.equal((await failure.json()).ok, false);
    assert.equal(saved.workspace.example.value, 'durable');
    assert.equal(db.persistenceHealthy(), false);
    unavailable = false;
    assert.equal((await send('recovered')).status, 200);
    assert.equal(saved.workspace.example.value, 'recovered');
    assert.equal(db.persistenceHealthy(), true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
