const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.NODE_ENV = 'production';
process.env.DB_DISABLED = 'true';
process.env.DATA_DIR = path.resolve('.tmp-test', 'email-verification-' + process.pid);
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
process.env.JWT_SECRET = 'synthetic-email-regression-secret-with-enough-length';
process.env.BCRYPT_ROUNDS = '4';
process.env.OTP_BCRYPT_ROUNDS = '4';
let available = false;
const messages = [];
const mailPath = require.resolve('../backend/src/services/mailService');
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: {
  isConfigured: () => true, otpEmailHtml: code => '<p>' + code + '</p>',
  send: async message => {
    messages.push(message);
    return available ? { sent: true, provider: 'synthetic-mail' } : { sent: false, error: '535-5.7.8 Username and Password not accepted' };
  }
} };
const auth = require('../backend/src/services/authService');
const db = require('../backend/src/config/dbConfig');
const req = { headers: {}, get: () => '', ip: '127.0.0.1' };

test('failed email delivery cannot claim success on a cooldown retry or create a session, and codes stay out of logs', async () => {
  const logs = [], oldLog = console.log, oldError = console.error;
  console.log = (...args) => logs.push(args.join(' '));
  console.error = (...args) => logs.push(args.join(' '));
  let failed, retry;
  try {
    failed = await auth.registerInitiate('failed@example.invalid', 'SyntheticPassword123', req, 'user');
    retry = await auth.registerInitiate('failed@example.invalid', 'SyntheticPassword123', req, 'user');
  } finally { console.log = oldLog; console.error = oldError; }
  assert.equal(failed.code, 503);
  assert.equal(failed.reason, 'email_delivery_failed');
  assert.doesNotMatch(failed.error, /535|BadCredentials|gsmtp/);
  assert.equal(retry.ok, false);
  assert.equal(retry.reason, 'cooldown');
  assert.equal(db.get().sessions.length, 0);
  assert.equal(db.get().otpChallenges[0].deliveryStatus, 'failed');
  const code = messages[0].text.match(/\b\d{6}\b/)[0];
  assert.ok(logs.every(line => !line.includes(code)));
  assert.ok(!messages[0].subject.includes(code));
});

test('requesting a second address does not reset the first address resend limit', async () => {
  available = true;
  const first = await auth.registerInitiate('first@example.invalid', 'SyntheticPassword123', req, 'user');
  assert.equal(first.ok, true);
  const second = await auth.registerInitiate('second@example.invalid', 'SyntheticPassword123', req, 'user');
  assert.equal(second.ok, true);
  const count = messages.length;
  const blocked = await auth.resendOTP(first.challengeId, req);
  assert.equal(blocked.reason, 'cooldown');
  assert.equal(messages.length, count);
  assert.ok(db.get().otpSends.some(row => row.emailKey === 'first@example.invalid'));
  assert.ok(db.get().otpSends.some(row => row.emailKey === 'second@example.invalid'));
});
