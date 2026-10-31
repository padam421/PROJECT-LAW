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
process.env.JWT_EXPIRES_IN = '30d';
const express = require('../backend/node_modules/express');
const bcrypt = require('../backend/node_modules/bcryptjs');
const db = require('../backend/src/config/dbConfig');
let emails = 0, upstreamCalls = [], upstream, server, base;
const capturedCodes = new Map();
const mailPath = require.resolve('../backend/src/services/mailService');
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: {
  isConfigured: () => true, otpEmailHtml: () => '',
  send: async message => { emails++; capturedCodes.set(message.to, message.text.match(/\b\d{6}\b/)[0]); return { sent: true, provider: 'synthetic-capture' }; }
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

test('verified accounts sign directly into either public workspace without another email OTP', async () => {
  const beforeEmails = emails;
  for (const portal of ['user', 'lawyer']) for (const role of ['user', 'lawyer', 'admin']) {
    const raw = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: role + '@example.invalid', password: 'SyntheticPassword123', role: portal }) });
    const response = { status: raw.status, data: await raw.json() };
    assert.equal(response.status, 200);
    assert.equal(response.data.directLogin, true);
    assert.equal(response.data.requires2FA, false);
    assert.equal(response.data.user.role, role);
    assert.equal(response.data.token, undefined);
    assert.match(raw.headers.get('set-cookie'), /HttpOnly/);
    assert.match(raw.headers.get('set-cookie'), /Max-Age=2592000/);
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

test('ordinary email signup unlocks lawyer tools after email verification without professional details', async () => {
  const email = 'ordinary-account@example.invalid';
  const registration = await request('/api/auth/register-initiate', null,
    { email, password: 'SyntheticPassword123', role: 'lawyer' });
  assert.equal(registration.status, 200);
  const verified = await fetch(base + '/api/auth/verify-otp', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: registration.data.challengeId, code: capturedCodes.get(email) })
  });
  assert.equal(verified.status, 200);
  const result = await verified.json();
  assert.equal(result.user.registrationStage, 'awaiting_profile');
  assert.equal(result.user.barCouncil, '');
  const response = await fetch(base + '/api/advocate/chat', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: verified.headers.get('set-cookie').split(';')[0] },
    body: JSON.stringify({ message: 'Synthetic preparation query' })
  });
  assert.equal(response.status, 200);
});

test('administrator console retains email OTP while verified lawyer tools use direct sign-in', async () => {
  const response = await request('/api/auth/login', null,
    { email: 'lawyer@example.invalid', password: 'SyntheticPassword123', role: 'lawyer' });
  assert.equal(response.status, 200);
  assert.equal(response.data.requires2FA, false);
  const admin = await request('/api/auth/login', null,
    { email: 'admin@example.invalid', password: 'SyntheticPassword123', role: 'admin' });
  assert.equal(admin.data.requires2FA, true);
  assert.ok(admin.data.challengeId);
  assert.equal(db.get().users.find(u => u.id === 'synthetic-lawyer').role, 'lawyer');
});

test('incorrect passwords do not start sessions and unverified emails still require ownership verification', async () => {
  const count = db.get().sessions.length;
  const wrong = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.invalid', password: 'WrongPassword123', role: 'user' }) });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);
  assert.equal(db.get().sessions.length, count);
  const user = db.get().users.find(u => u.id === 'synthetic-user');
  user.isVerified = false;
  const verify = await request('/api/auth/login', null,
    { email: user.email, password: 'SyntheticPassword123', role: 'user' });
  assert.equal(verify.data.requires2FA, true);
  assert.ok(verify.data.challengeId);
  assert.equal(db.get().sessions.length, count);
  user.isVerified = true;
});

test('Remember Me, active-session renewal and logout preserve account data while revoking access', async () => {
  const jwt = require('../backend/node_modules/jsonwebtoken');
  const user = db.get().users.find(u => u.id === 'synthetic-user');
  const session = auth.createSession(user, {});
  const iat = Math.floor(Date.now() / 1000) - 2 * 86400;
  const old = jwt.sign({ sub: user.id, role: user.role, sid: session.sessionId, iat }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const refresh = await fetch(base + '/api/auth/session', { headers: { Cookie: 'lc_session=' + old } });
  assert.equal(refresh.status, 200);
  const cookie = refresh.headers.get('set-cookie');
  assert.match(cookie, /Max-Age=2592000/);
  const renewed = decodeURIComponent(cookie.split(';')[0].slice('lc_session='.length));
  const claims = jwt.verify(renewed, process.env.JWT_SECRET);
  assert.equal(claims.sid, session.sessionId);
  assert.ok(claims.iat > iat);
  const sessionOnly = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'SyntheticPassword123', role: 'lawyer', rememberMe: false }) });
  assert.equal(sessionOnly.status, 200);
  assert.doesNotMatch(sessionOnly.headers.get('set-cookie'), /Max-Age|Expires=/);
  db.workspaceFor(user.id).cases = [{ id: 'retained-case', title: 'Private saved work' }];
  const signedOut = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: 'lc_session=' + renewed } });
  assert.equal(signedOut.status, 200);
  assert.equal((await fetch(base + '/api/auth/session', { headers: { Cookie: 'lc_session=' + renewed } })).status, 401);
  assert.equal(db.workspaceFor(user.id).cases[0].id, 'retained-case');
  const signedIn = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'SyntheticPassword123', role: 'user' }) });
  assert.equal(signedIn.status, 200);
  const reopened = await fetch(base + '/api/state', { headers: { Cookie: signedIn.headers.get('set-cookie').split(';')[0] } });
  assert.equal((await reopened.json()).workspace.cases[0].id, 'retained-case');
});

test('unsigned requests stay blocked and every signed-in account can use the advocate tools', async () => {
  const count = upstreamCalls.length;
  assert.equal((await request('/api/advocate/chat', null, { message: 'Synthetic' })).status, 401);
  for (const role of ['user', 'admin']) {
    const response = await request('/api/advocate/chat', role, { message: 'Synthetic' });
    assert.equal(response.status, 200);
    assert.equal(response.data.ok, true);
    assert.equal((await request('/api/advocate/rehearsal', role, { message: 'Synthetic' })).status, 200);
    assert.equal((await request('/api/advocate/assistant/threads', role)).status, 200);
  }
  assert.equal(upstreamCalls.length, count + 4);
});

test('workspace access does not promote clients to admins or mix another account history', async () => {
  assert.equal((await request('/api/admin/queue', 'user')).status, 403);
  const workspace = await request('/api/state', 'admin');
  assert.equal(workspace.data.lawyer.workspaceOnly, true);
  assert.equal(workspace.data.lawyer.verificationStatus, 'not_applicable');
  assert.equal(db.get().users.find(u => u.id === 'synthetic-user').role, 'user');
  const thread = { id: 'private-record', title: 'Private', messages: [{ id: 'm-private', sender: 'user', text: 'Only this account' }] };
  await fetch(base + '/api/advocate/assistant/threads/' + thread.id, {
    method: 'PUT', headers: { Cookie: cookies.user, 'Content-Type': 'application/json' }, body: JSON.stringify({ thread })
  });
  assert.equal((await request('/api/advocate/assistant/threads', 'user')).data.threads.length, 1);
  assert.equal((await request('/api/advocate/assistant/threads', 'admin')).data.threads.length, 0);
  assert.equal((await request('/api/assistant/threads', 'user')).data.threads.length, 0);
});

test('either workspace reads the signed-in account notifications and bookings, ignoring supplied owner IDs', async () => {
  const service = require('../backend/src/services/dbService');
  const original = { getLawyerConsultations: service.getLawyerConsultations, getUserConsultations: service.getUserConsultations,
    getUserNotifications: service.getUserNotifications };
  service.getLawyerConsultations = async owner => [{ owner }];
  service.getUserConsultations = async owner => [{ owner }];
  service.getUserNotifications = async owner => [{ owner }];
  try {
    for (const role of ['user', 'lawyer', 'admin']) {
      assert.equal((await request('/api/consultations/lawyer?lawyerId=another-person', role)).data.consultations[0].owner, 'synthetic-' + role);
      assert.equal((await request('/api/consultations/user?userId=another-person', role)).data.consultations[0].owner, 'synthetic-' + role);
      assert.equal((await request('/api/notifications?role=lawyer&userId=another-person', role)).data.notifications[0].owner, 'synthetic-' + role);
    }
    assert.equal((await request('/api/notifications?role=lawyer')).status, 401);
  } finally { Object.assign(service, original); }
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
  assert.equal(threadRows.get('advocate:synthetic-lawyer:' + thread.id).owner, 'advocate:synthetic-lawyer');
  assert.deepEqual(upstreamCalls.slice(-3), ['chat', 'rehearsal', 'documents']);
});
