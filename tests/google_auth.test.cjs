const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.NODE_ENV = 'development';
process.env.DB_DISABLED = 'true';
process.env.DATA_DIR = path.resolve('.tmp-test', 'google-auth-' + process.pid);
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
process.env.JWT_SECRET = 'synthetic-google-auth-regression-secret';
process.env.GOOGLE_CLIENT_ID = 'synthetic-client-id';
process.env.BCRYPT_ROUNDS = '4';
const db = require('../backend/src/config/dbConfig');
const auth = require('../backend/src/services/authService');
const DbService = require('../backend/src/services/dbService');
const req = { headers: {}, get: () => '', ip: '127.0.0.1' };
test('verified Google accounts can switch workspaces without claiming another identity or role', async () => {
  const profile = { sub: 'synthetic-subject', email: 'google@example.invalid', email_verified: true, name: 'Synthetic User' };
  const first = await auth.loginGoogle(profile, 'user', req);
  assert.equal(first.ok, true);
  assert.ok(first.token);
  assert.equal(db.get().sessions.find(s => s.id === first.sessionId).userId, first.user.id);
  const repeated = await auth.loginGoogle(profile, 'user', req);
  assert.equal(repeated.user.id, first.user.id);
  assert.equal((await auth.loginGoogle({ ...profile, sub: 'different-subject' }, 'user', req)).code, 409);
  const switched = await auth.loginGoogle(profile, 'lawyer', req);
  assert.equal(switched.ok, true);
  assert.equal(switched.user.id, first.user.id);
  assert.equal(switched.user.role, 'user');
  db.get().users.find(u => u.id === first.user.id).accountStatus = 'suspended';
  assert.equal((await auth.loginGoogle(profile, 'user', req)).code, 403);
});
test('verified Gmail links an existing password/admin account without replacing its identity, password or permissions', async () => {
  const existing = { id: 'existing-owner', email: 'synthetic-owner@gmail.com', role: 'admin',
    passwordHash: 'existing-bcrypt-hash', accountStatus: 'active', isVerified: true,
    fullName: 'Existing Owner', verificationStatus: 'not_applicable' };
  await DbService.createUser(existing);
  db.workspaceFor(existing.id).cases = [{ id: 'private-existing-case' }];
  const profile = { sub: 'synthetic-owner-sub', email: 'Synthetic-Owner@gmail.com', email_verified: true, name: 'Google Name' };
  for (const portal of ['user', 'lawyer']) {
    const result = await auth.loginGoogle(profile, portal, req);
    assert.equal(result.ok, true);
    assert.equal(result.user.id, existing.id);
    assert.equal(result.user.role, 'admin');
    assert.equal(result.user.fullName, 'Existing Owner');
    assert.equal(result.user.verificationStatus, 'not_applicable');
    assert.equal(db.get().sessions.find(s => s.id === result.sessionId).userId, existing.id);
  }
  const stored = db.get().users.find(u => u.id === existing.id);
  assert.equal(stored.passwordHash, existing.passwordHash);
  assert.equal(stored.googleSubject, profile.sub);
  assert.equal(stored.isGoogleAuth, true);
  assert.equal(db.get().users.filter(u => u.email.toLowerCase() === existing.email).length, 1);
  assert.deepEqual(db.workspaceFor(existing.id).cases, [{ id: 'private-existing-case' }]);
  // Re-open persisted state in a fresh process, as happens on a hosted restart.
  db.flushNow();
  const child = require('node:child_process').spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const db = require('./backend/src/config/dbConfig');
    const user = db.get().users.find(u => u.id === 'existing-owner');
    assert.equal(user.googleSubject, 'synthetic-owner-sub');
    assert.equal(user.passwordHash, 'existing-bcrypt-hash');
    assert.equal(user.role, 'admin');
    assert.equal(user.isGoogleAuth, true);
    assert.equal(db.workspaceFor(user.id).cases[0].id, 'private-existing-case');
  `], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});
test('Google subject remains the identity when a Workspace address changes', async () => {
  const original = { sub: 'workspace-sub', email: 'original@example.invalid', email_verified: true, hd: 'example.invalid' };
  const first = await auth.loginGoogle(original, 'lawyer', req);
  const changed = await auth.loginGoogle({ ...original, email: 'renamed@example.invalid' }, 'user', req);
  assert.equal(changed.ok, true);
  assert.equal(changed.user.id, first.user.id);
  assert.equal(changed.user.role, 'lawyer');
});
test('unverified claims, non-authoritative emails and different Google subjects cannot take over existing accounts', async () => {
  const existing = { id: 'third-party-owner', email: 'owner@third-party.invalid', role: 'user', passwordHash: 'preserved-hash', accountStatus: 'active' };
  await DbService.createUser(existing);
  const profile = { sub: 'third-party-sub', email: existing.email, email_verified: true };
  const count = db.get().sessions.length;
  assert.equal((await auth.loginGoogle({ ...profile, email_verified: false }, 'user', req)).ok, false);
  assert.equal((await auth.loginGoogle(profile, 'user', req)).code, 409);
  assert.equal((await auth.loginGoogle(profile, 'admin', req)).ok, false);
  assert.equal(db.get().sessions.length, count);
  assert.equal(db.get().users.find(u => u.id === existing.id).googleSubject, undefined);
  const linked = await auth.loginGoogle({ ...profile, hd: 'third-party.invalid' }, 'lawyer', req);
  assert.equal(linked.ok, true);
  assert.equal(linked.user.role, 'user');
  assert.equal((await auth.loginGoogle({ ...profile, sub: 'impostor-sub', hd: 'third-party.invalid' }, 'user', req)).code, 409);
  db.get().users.find(u => u.id === existing.id).accountStatus = 'suspended';
  assert.equal((await auth.loginGoogle({ ...profile, hd: 'third-party.invalid' }, 'lawyer', req)).code, 403);
});
test('a browser-decoded forged JWT cannot create a backend session', async () => {
  const controller = require('../backend/src/controllers/authController');
  let status, result;
  const res = { status(code) { status = code; return this; }, json(data) { result = data; return this; } };
  const count = db.get().sessions.length;
  await controller.googleLogin({ body: { credential: 'not-a-signed-google-token', role: 'user' } }, res);
  assert.equal(status, 401);
  assert.ok(result.error);
  assert.equal(db.get().sessions.length, count);
});
