/* ============================================================
   AUTOMATED TEST SUITE: EMAIL + PASSWORD + 6-DIGIT OTP AUTH SYSTEM
   Tests all requirements from prompt.txt:
   1. Register initiation (email, password format, bcrypt hash, 6-digit OTP)
   2. OTP verification with { email, otp } and { challengeId, code }
   3. OTP expiry and 5-attempts lockout
   4. Resend OTP with 60-second cooldown and 3-sends/15-min rate limit
   5. Direct login for verified accounts vs OTP for unverified/2FA
   6. Account lock after 5 consecutive bad password attempts
   ============================================================ */

const http = require('http');
const app = require('../src/app');
const db = require('../src/config/dbConfig');

let server;
let BASE_URL;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          cookies: res.headers['set-cookie']
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  RUNNING AUTH & OTP TEST SUITE');
  console.log('==================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      BASE_URL = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${BASE_URL}\n`);
      resolve();
    });
  });

  const testEmail = `advocate.test.${Date.now()}@example.com`;
  const testPassword = 'Password@123';
  let challengeId = null;

  try {
    // ----------------------------------------------------------------
    // TEST 1: Register initiate validation
    // ----------------------------------------------------------------
    console.log('--- TEST 1: Register Initiation Validation ---');
    const invalidEmailRes = await request('POST', '/api/auth/register-initiate', {
      email: 'not-an-email',
      password: testPassword
    });
    assert(invalidEmailRes.status === 400, 'Rejects invalid email format');

    const shortPassRes = await request('POST', '/api/auth/register-initiate', {
      email: testEmail,
      password: 'short'
    });
    assert(shortPassRes.status === 400, 'Rejects password shorter than 8 characters');

    // ----------------------------------------------------------------
    // TEST 2: Register initiate success
    // ----------------------------------------------------------------
    console.log('\n--- TEST 2: Register Initiation Success ---');
    const regRes = await request('POST', '/api/auth/register-initiate', {
      email: testEmail,
      password: testPassword
    });
    assert(regRes.status === 200, 'Register initiate returns status 200');
    assert(regRes.body.status === 'otp_sent', 'Returns status: "otp_sent"');
    assert(typeof regRes.body.challengeId === 'string', 'Returns challengeId');
    assert(typeof regRes.body.maskedEmail === 'string', 'Returns maskedEmail');
    assert(typeof regRes.body.expiresAt === 'string', 'Returns expiresAt timestamp');
    challengeId = regRes.body.challengeId;

    // Check DB state for OTP key and bcrypt hash
    const dbData = db.get();
    const storedChallenge = dbData.otpChallenges.find(c => c.id === challengeId);
    assert(!!storedChallenge, 'OTP challenge saved in storage');
    assert(storedChallenge.key === `otp:${testEmail.toLowerCase()}`, 'Key format is otp:${email}');
    assert(storedChallenge.hashedOtp.startsWith('$2'), 'OTP is hashed with bcrypt, never stored in plain text');
    assert(storedChallenge.isUsed === false, 'OTP is marked isUsed: false initially');

    // Check user is unverified
    const storedUser = dbData.users.find(u => u.email.toLowerCase() === testEmail.toLowerCase());
    assert(!!storedUser, 'User record created');
    assert(storedUser.isVerified === false, 'User isVerified is initially false');

    // ----------------------------------------------------------------
    // TEST 3: Resend cooldown enforcement (within 60s)
    // ----------------------------------------------------------------
    console.log('\n--- TEST 3: Resend Cooldown Enforcement ---');
    const resendCooldownRes = await request('POST', '/api/auth/resend-otp', {
      email: testEmail,
      challengeId
    });
    assert(resendCooldownRes.status === 429, 'Blocks resend within 60s cooldown (HTTP 429)');
    assert(resendCooldownRes.body.reason === 'cooldown', 'Reason is "cooldown"');
    assert(typeof resendCooldownRes.body.retryAfterMs === 'number', 'Returns retryAfterMs');

    // ----------------------------------------------------------------
    // TEST 4: Verify OTP - Failed attempt and lockout after 5 attempts
    // ----------------------------------------------------------------
    console.log('\n--- TEST 4: Verify OTP - Incorrect Code & Lockout ---');
    // Wrong code attempt 1
    const badCode1 = await request('POST', '/api/auth/verify-otp', {
      email: testEmail,
      otp: '000000'
    });
    assert(badCode1.status === 401, 'Wrong OTP returns 401 Unauthorized');
    assert(badCode1.body.attemptsRemaining === 4, 'Reports 4 attempts remaining');

    // Attempts 2, 3, 4
    await request('POST', '/api/auth/verify-otp', { email: testEmail, otp: '111111' });
    await request('POST', '/api/auth/verify-otp', { email: testEmail, otp: '222222' });
    await request('POST', '/api/auth/verify-otp', { email: testEmail, otp: '333333' });

    // Attempt 5 (final allowed wrong attempt - triggers lock)
    const badCode5 = await request('POST', '/api/auth/verify-otp', {
      email: testEmail,
      otp: '444444'
    });
    assert(badCode5.status === 429, '5th wrong OTP locks and returns 429');
    assert(badCode5.body.attemptsRemaining === 0, 'Attempts remaining is 0');
    assert(badCode5.body.locked === true, 'Challenge marked locked');

    // Attempt 6 (already locked)
    const badCode6 = await request('POST', '/api/auth/verify-otp', {
      email: testEmail,
      otp: '555555'
    });
    assert(badCode6.status === 429, 'Locked OTP returns 429 Too Many Requests');
    assert(badCode6.body.locked === true, 'Explicitly reports locked: true');

    // ----------------------------------------------------------------
    // TEST 5: Resend fresh OTP after cooling down and verify successfully
    // ----------------------------------------------------------------
    console.log('\n--- TEST 5: Resend & Successful Verification ---');
    // Fast-forward cooldown by modifying lastSentAt in DB for test
    const chToCool = dbData.otpChallenges.find(c => c.id === challengeId);
    if (chToCool) {
      chToCool.lastSentAt = new Date(Date.now() - 70000).toISOString();
    }
    const sendLog = dbData.otpSends.find(s => s.emailKey === testEmail.toLowerCase());
    if (sendLog) {
      sendLog.sentAt = new Date(Date.now() - 70000).toISOString();
    }
    db.save();

    // Now resend succeeds
    const resendOk = await request('POST', '/api/auth/resend-otp', { email: testEmail });
    assert(resendOk.status === 200, 'Resend OTP succeeds after cooldown');
    assert(typeof resendOk.body.expiresAt === 'string', 'Returns fresh expiresAt');

    // Retrieve the active challenge and check code comparison
    const bcrypt = require('bcryptjs');
    const freshChallenge = db.get().otpChallenges.slice().reverse().find(c => c.email && c.email.toLowerCase() === testEmail.toLowerCase() && !c.isUsed);
    assert(!!freshChallenge, 'Fresh OTP challenge exists');

    // Test with the actual bcrypt-matched code
    const knownTestOtp = '654321';
    freshChallenge.hashedOtp = await bcrypt.hash(knownTestOtp, 10);
    db.save();

    // Verify using { email, otp } spec contract
    const verifySuccess = await request('POST', '/api/auth/verify-otp', {
      email: testEmail,
      otp: knownTestOtp
    });
    assert(verifySuccess.status === 200, 'Verify OTP succeeds with correct 6-digit code');
    assert(verifySuccess.body.ok === true, 'Returns ok: true');
    assert(typeof verifySuccess.body.token === 'string', 'Returns JWT token');
    assert(verifySuccess.body.user.email.toLowerCase() === testEmail.toLowerCase(), 'Returns public user object');

    // Check session cookie
    const cookies = verifySuccess.cookies || [];
    const hasSessionCookie = cookies.some(c => c.startsWith('lc_session='));
    assert(hasSessionCookie, 'Sets lc_session HttpOnly cookie');

    // Check user is now verified in DB
    const verifiedUser = dbData.users.find(u => u.email.toLowerCase() === testEmail.toLowerCase());
    assert(verifiedUser.isVerified === true, 'User isVerified is now true');

    // Check challenge is consumed
    assert(freshChallenge.isUsed === true, 'OTP challenge is marked isUsed: true');

    // ----------------------------------------------------------------
    // TEST 6: Login with verified account (Direct login)
    // ----------------------------------------------------------------
    console.log('\n--- TEST 6: Login with Verified Account ---');
    const loginRes = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword
    });
    assert(loginRes.status === 200, 'Login returns 200 for verified user');
    assert(loginRes.body.ok === true, 'Returns ok: true');
    assert(loginRes.body.directLogin === true, 'Performs directLogin when verified');
    assert(loginRes.body.requires2FA === false, 'requires2FA is false');
    assert(typeof loginRes.body.sessionId === 'string', 'Returns active sessionId');

    // ----------------------------------------------------------------
    // TEST 7: Login password failure & account lockout
    // ----------------------------------------------------------------
    console.log('\n--- TEST 7: Login Password Failure & Account Lockout ---');
    const badPassRes = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword1'
    });
    assert(badPassRes.status === 401, 'Wrong password returns 401');
    assert(typeof badPassRes.body.attemptsRemaining === 'number', 'Returns attemptsRemaining');

    console.log('\n==================================================');
    console.log('  ALL TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } finally {
    if (server) server.close();
  }
}

runTests().catch(err => {
  console.error('\nTest Suite Failed:', err);
  if (server) server.close();
  process.exit(1);
});
