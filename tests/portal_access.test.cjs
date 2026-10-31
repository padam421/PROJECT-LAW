/* Real cookie/session/role checks, with external AI and conversation storage I/O stubbed. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.NODE_ENV = 'development';
process.env.DB_DISABLED = 'true';
process.env.DATA_DIR = path.resolve('.tmp-test', 'portal-access-' + process.pid);
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
process.env.JWT_SECRET = 'synthetic-portal-access-regression-secret';
process.env.ADMIN_EMAIL = 'synthetic-admin@example.invalid';
process.env.ADMIN_PASSWORD = 'SyntheticAdmin123';
process.env.BCRYPT_ROUNDS = '4';
process.env.OTP_BCRYPT_ROUNDS = '4';
process.env.COOKIE_SECURE = 'false';
const express = require('../backend/node_modules/express');
const bcrypt = require('../backend/node_modules/bcryptjs');
const db = require('../backend/src/config/dbConfig');
let emails = 0, upstreamCalls = [], upstream, server, base;
const mailPath = require.resolve('../backend/src/services/mailService');
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: {
  isConfigured: () => true, otpEmailHtml: () => '',
  send: async () => { emails++; return { sent: true, provider: 'synthetic-capture' }; }
} };
const auth = require('../backend/src/services/authService');
const cookies = {};
const threadRows = new Map();
const historyPath = require.resolve('../backend/src/services/assistantRepository');
require.cache[historyPath] = { id: historyPath, filename: historyPath, loaded: true, exports: {
  list: async owner => [...threadRows.values()].filter(row => row.owner === owner).map(row => row.thread),
  put: async (owner, thread) => {
    const saved = { ...thread, revision: 1 };
    threadRows.set(owner + ':' + thread.id, { owner, thread: saved });
    return saved;
  }
} };

before(async () => {
  const ai = express();
  ai.use(express.json());
  for (const feature of ['chat', 'rehearsal']) ai.post('/api/ai/advocate/' + feature, (req, res) => {
    upstreamCalls.push(feature);
    res.json({ ok: true, message: 'Synthetic checked response', sources: [], sections: [] });
  });
  ai.post('/api/ai/advocate/documents', express.raw({ type: '*/*' }), (req, res) => {
    upstreamCalls.push('documents');
    assert.ok(req.body.includes(Buffer.from('Synthetic NDPS record')));
    res.json({ ok: true, document: { name: 'synthetic.txt', text: 'Synthetic NDPS record', characters: 21 } });
  });
  upstream = ai.listen(0, '127.0.0.1');
  await new Promise(resolve => upstream.once('listening', resolve));
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:' + upstream.address().port;
  db.load();
  const passwordHash = await bcrypt.hash('SyntheticPassword123', 4);
  for (const role of ['user', 'lawyer', 'admin']) {
    const user = { id: 'synthetic-' + role, role, email: role + '@example.invalid',
      passwordHash, isVerified: true, accountStatus: 'active', registrationStage: 'complete' };
    db.get().users.push(user);
    const session = auth.createSession(user, {});
    cookies[role] = 'lc_session=' + session.token;
  }
  server = require('../backend/src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  db.flushNow();
  if (server) await new Promise(resolve => server.close(resolve));
  if (upstream) await new Promise(resolve => upstream.close(resolve));
});

async function request(endpoint, role, body) {
  const response = await fetch(base + endpoint, { method: body ? 'POST' : 'GET',
    headers: { ...(role ? { Cookie: cookies[role] } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}

test('client/admin credentials cannot start lawyer sign-in or send an unnecessary OTP', async () => {
  const beforeEmails = emails;
  for (const role of ['user', 'admin']) {
    const response = await request('/api/auth/login', null,
      { email: role + '@example.invalid', password: 'SyntheticPassword123', role: 'lawyer' });
    assert.equal(response.status, 403);
    assert.equal(response.data.reason, 'wrong_portal');
    assert.match(response.data.error, /Lawyer \/ Advocate/);
  }
  assert.equal(emails, beforeEmails);
});

test('public signup cannot request an administrator role', async () => {
  const beforeEmails = emails;
  const response = await request('/api/auth/register-initiate', null,
    { email: 'public-admin-attempt@example.invalid', password: 'SyntheticPassword123', role: 'admin' });
  assert.equal(response.status, 400);
  assert.equal(emails, beforeEmails);
  assert.equal(db.get().users.some(u => u.email === 'public-admin-attempt@example.invalid'), false);
});

test('a matching lawyer sign-in starts normal OTP verification, without changing account roles', async () => {
  const response = await request('/api/auth/login', null,
    { email: 'lawyer@example.invalid', password: 'SyntheticPassword123', role: 'lawyer' });
  assert.equal(response.status, 200);
  assert.equal(response.data.requires2FA, true);
  assert.ok(response.data.challengeId);
  assert.equal(db.get().users.find(u => u.id === 'synthetic-lawyer').role, 'lawyer');
});

test('unauthenticated and cross-role AI/history calls never reach the provider', async () => {
  const count = upstreamCalls.length;
  assert.equal((await request('/api/advocate/chat', null, { message: 'Synthetic' })).status, 401);
  for (const role of ['user', 'admin']) {
    const response = await request('/api/advocate/chat', role, { message: 'Synthetic' });
    assert.equal(response.status, 403);
    assert.equal(response.data.code, 'wrong_portal');
    assert.equal((await request('/api/advocate/assistant/threads', role)).status, 403);
  }
  assert.equal(upstreamCalls.length, count);
});

test('a real lawyer cookie reaches research, rehearsal, document extraction and saved history', async () => {
  for (const feature of ['chat', 'rehearsal']) {
    const response = await request('/api/advocate/' + feature, 'lawyer', { message: 'Synthetic' });
    assert.equal(response.status, 200);
    assert.equal(response.data.ok, true);
  }
  const form = new FormData();
  form.append('file', new Blob(['Synthetic NDPS record']), 'synthetic.txt');
  const upload = await fetch(base + '/api/advocate/documents', {
    method: 'POST', headers: { Cookie: cookies.lawyer }, body: form
  });
  assert.equal(upload.status, 200);
  assert.equal((await upload.json()).document.text, 'Synthetic NDPS record');
  const thread = { id: 'synthetic-case', title: 'Synthetic NDPS case',
    messages: [{ id: 'synthetic-message', sender: 'user', text: 'Synthetic facts' }], courtSessions: {} };
  const save = await fetch(base + '/api/advocate/assistant/threads/' + thread.id, {
    method: 'PUT', headers: { Cookie: cookies.lawyer, 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread })
  });
  assert.equal(save.status, 200);
  const history = await request('/api/advocate/assistant/threads', 'lawyer');
  assert.equal(history.status, 200);
  assert.equal(history.data.threads[0].messages[0].text, 'Synthetic facts');
  assert.equal(threadRows.values().next().value.owner, 'advocate:synthetic-lawyer');
  assert.deepEqual(upstreamCalls.slice(-3), ['chat', 'rehearsal', 'documents']);
});
