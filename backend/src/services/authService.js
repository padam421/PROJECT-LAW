/* ============================================================
   LEGALCONNECT — AUTHENTICATION & ACCOUNT SECURITY SERVICE
   authService.js — Login, 2FA OTP, device trust, sessions,
   lockout, registration + fraud/duplicate screening.
   ------------------------------------------------------------
   Honesty note: OTP delivery is SIMULATED (no SMS/email gateway
   is configured). Codes are logged server-side and surfaced in
   the API response only outside production.
   ============================================================ */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/envConfig');
const db = require('../config/dbConfig');
const mailer = require('./mailService');
const { maskEmail, maskPhone, normalizePhone, sha256Short, validatePassword } = require('../utils/helpers');

/* ---------------- Helpers ---------------- */
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, emailHash, phoneHash, barNumberHash, resetTokenHash, ...safe } = user;
  return safe;
}

/**
 * Real OTP delivery. When SMTP is configured the code is emailed;
 * the raw code is then NEVER included in API responses.
 * Without SMTP (local development only) the code is surfaced so
 * the flow stays usable — clearly labelled as simulated.
 */
async function deliverOTP(user, otp) {
  const mailed = await mailer.send({
    to: user.email,
    subject: 'LegalConnect sign-in code',
    html: mailer.otpEmailHtml(otp, Math.round(config.otpExpiryMs / 60000)),
    text: `Your LegalConnect verification code is ${otp}. It expires in ${Math.round(config.otpExpiryMs / 60000)} minutes.`
  });
  console.log(`[auth] OTP for ${user.email}: ${mailed.sent ? 'emailed via SMTP' : `NOT delivered (${mailed.error})`}`);
  return mailed.sent;
}

/** Only expose codes in responses while no real channel exists AND not production. */
function shouldSurfaceDevCode(mailedSuccessfully) {
  return !config.isProd && !mailedSuccessfully;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getDeviceProfile(req) {
  const ua = req.get('user-agent') || '';
  let deviceType = 'Desktop';
  let browser = 'Unknown browser';
  if (/mobile/i.test(ua)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  return {
    deviceId: req.get('x-lc-device') || 'unknown-device',
    deviceType,
    browser,
    os: /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android' : /mac os/i.test(ua) ? 'macOS' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : (req.get('sec-ch-ua-platform') || 'Unknown OS'),
    location: 'India (approx.)'
  };
}

function logActivity(type, description, user, req, result) {
  const data = db.get();
  data.loginActivity.unshift({
    id: db.uid('act'),
    userId: user ? user.id : null,
    identifierTried: user ? undefined : (req && req.body ? String(req.body.identifier || '').slice(0, 64) : undefined),
    type,
    description,
    result: result || 'success',
    device: getDeviceProfile(req),
    timestamp: new Date().toISOString()
  });
  if (data.loginActivity.length > 200) data.loginActivity.length = 200;
  db.save();
}

function recentFailedAttempts(userId) {
  const cutoff = Date.now() - config.lockDurationMs;
  return db.get().loginActivity.filter(a =>
    a.userId === userId && a.type === 'login_failed' &&
    new Date(a.timestamp).getTime() > cutoff
  );
}

function isLocked(user) {
  return recentFailedAttempts(user.id).length >= config.maxLoginAttempts;
}

function lockRemainingMs(user) {
  const attempts = recentFailedAttempts(user.id);
  if (!attempts.length) return 0;
  const oldest = Math.min(...attempts.map(a => new Date(a.timestamp).getTime()));
  return Math.max(0, config.lockDurationMs - (Date.now() - oldest));
}

function isTrustedDevice(user, device) {
  return db.get().trustedDevices.some(d => d.userId === user.id && d.deviceId === device.deviceId);
}

function createSession(user, device) {
  const data = db.get();
  const sessionId = db.uid('sess');
  const token = jwt.sign(
    { sub: user.id, role: user.role, sid: sessionId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
  data.sessions.push({
    id: sessionId,
    userId: user.id,
    device,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    revoked: false
  });
  db.save();
  return { token, sessionId };
}

/* ---------------- Registration + screening ---------------- */
async function register(payload) {
  const data = db.get();
  const email = String(payload.email).toLowerCase();
  const phone = normalizePhone(payload.phone);
  const barNumber = String(payload.barCouncil || '').trim().toUpperCase();

  // Uniqueness checks on verified identifiers
  if (data.users.some(u => u.email === email)) {
    return { ok: false, code: 409, error: 'An account with this email already exists.' };
  }
  if (data.users.some(u => u.phoneNormalized === phone)) {
    return { ok: false, code: 409, error: 'An account with this mobile number already exists.' };
  }

  // Duplicate professional identity check (Bar Council number)
  const barOwner = data.users.find(u => u.role === 'lawyer' && u.barNumberHash === sha256Short(barNumber));
  const isDuplicateBar = !!barOwner;

  // Fraud risk assessment (internal heuristics — details are NOT exposed to the applicant)
  const riskSignals = [];
  if (isDuplicateBar) riskSignals.push('duplicate_bar_number');
  if (barOwner && barOwner.verificationStatus === 'verified') riskSignals.push('duplicate_of_verified_account');
  const ageYears = (Date.now() - new Date(payload.enrollmentDate).getTime()) / (365.25 * 86400000);
  if (payload.yearsOfPractice > ageYears + 1) riskSignals.push('practice_years_exceed_enrollment');
  if (new Date(payload.dob).getFullYear() > new Date().getFullYear() - 21) riskSignals.push('underage_dob');

  let fraudStatus = 'low_risk';
  if (isDuplicateBar && barOwner && barOwner.verificationStatus === 'verified') fraudStatus = 'high_risk_verification_failed';
  else if (riskSignals.length > 0) fraudStatus = 'medium_risk_manual_review';

  const passwordHash = await bcrypt.hash(payload.password, config.bcryptRounds);

  const lawyer = {
    id: db.uid('law'),
    role: 'lawyer',
    fullName: payload.fullName,
    professionalName: payload.professionalName || `Adv. ${payload.fullName}`,
    email,
    emailHash: sha256Short(email),
    phone,
    phoneNormalized: phone,
    phoneHash: sha256Short(phone),
    passwordHash,
    gender: payload.gender,
    dob: payload.dob,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    profilePhoto: payload.profilePhotoData || null,
    barCouncil: barNumber,
    barNumberHash: sha256Short(barNumber),
    stateBarCouncil: payload.stateBarCouncil,
    enrollmentDate: payload.enrollmentDate,
    enrollmentYear: String(new Date(payload.enrollmentDate).getFullYear()),
    qualification: payload.qualification,
    university: payload.university,
    yearsOfPractice: Number(payload.yearsOfPractice),
    practiceType: payload.practiceType,
    primarySpecialization: payload.primarySpecialization,
    additionalSpecializations: payload.additionalSpecializations || [],
    courts: payload.courts || [],
    languages: payload.languages || [],
    bio: '',
    accountStatus: isDuplicateBar && barOwner && barOwner.verificationStatus === 'verified' ? 'restricted_pending_investigation' : 'active',
    verificationStatus: 'pending',
    verificationId: null,
    verificationDate: null,
    rating: 0,
    totalReviews: 0,
    profileDeactivated: false,
    sensitiveActionsLockedUntil: null,
    createdAt: new Date().toISOString()
  };

  data.users.push(lawyer);

  // Duplicate of a VERIFIED account → block auto-approval entirely, route to investigation
  if (fraudStatus === 'high_risk_verification_failed') {
    data.fraudRiskRecords.push({
      id: db.uid('fraud'),
      lawyerId: lawyer.id,
      status: fraudStatus,
      signals: ['Duplicate Bar Council registration attached to an existing verified advocate'],
      action: 'Account restricted. Routed to investigation desk.',
      createdAt: new Date().toISOString()
    });
    db.save();
    return { ok: true, lawyerId: lawyer.id, underInvestigation: true };
  }

  // Verification record pipeline starts here
  data.verificationRecords.push({
    id: db.uid('ver'),
    lawyerId: lawyer.id,
    stages: {
      barCouncil: { status: 'pending', checkedAt: null },
      documents: { status: 'pending', docsSubmitted: 0 },
      identity: { status: 'not_started', livenessAt: null },
      duplicate: { status: isDuplicateBar ? 'collision_found' : 'clear', checkedAt: new Date().toISOString(), collisionLawyerId: barOwner ? barOwner.id : null },
      manualReview: { status: riskSignals.length ? 'required' : 'not_required', reviewerId: null, decidedAt: null }
    },
    overallStatus: 'pending',
    fraudStatus,
    riskSignals,
    createdAt: new Date().toISOString()
  });

  db.save();
  return { ok: true, lawyerId: lawyer.id, fraudStatus, underInvestigation: false };
}

/* ---------------- Login + 2FA ---------------- */
async function login(identifierRaw, password, req) {
  const data = db.get();
  const identifierEmail = String(identifierRaw || '').toLowerCase().trim();
  const identifierPhone = normalizePhone(identifierRaw);
  // Advocates and verification-desk admins share this entry point;
  // downstream routes enforce role via requireRole().
  const user = data.users.find(u =>
    (u.role === 'lawyer' || u.role === 'admin') &&
    (u.email === identifierEmail || u.phoneNormalized === identifierPhone)
  );

  if (!user) {
    logActivity('login_failed', 'No account matched supplied credentials', null, req, 'unknown_account');
    return { ok: false, code: 401, error: 'Account not found. Please check your credentials or register as an advocate.' };
  }

  if (isLocked(user)) {
    const mins = Math.ceil(lockRemainingMs(user) / 60000);
    logActivity('login_blocked', `Login attempt while locked (${mins} min remaining)`, user, req, 'locked');
    return { ok: false, code: 429, error: `Too many failed attempts. Account temporarily locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` };
  }

  const passwordOk = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!passwordOk) {
    const attempts = recentFailedAttempts(user.id).length + 1;
    const willLock = attempts >= config.maxLoginAttempts;
    logActivity('login_failed', `Incorrect password (attempt ${attempts}/${config.maxLoginAttempts})`, user, req, 'bad_password');
    return {
      ok: false,
      code: 401,
      error: willLock
        ? 'Incorrect password. Your account is now temporarily locked for 15 minutes after repeated failed attempts.'
        : `Incorrect password. ${config.maxLoginAttempts - attempts} attempt${config.maxLoginAttempts - attempts === 1 ? '' : 's'} remaining before temporary lock.`,
      attemptsRemaining: willLock ? 0 : config.maxLoginAttempts - attempts
    };
  }

  if (user.accountStatus === 'suspended') {
    logActivity('login_blocked', 'Suspended account login attempt', user, req, 'suspended');
    return { ok: false, code: 403, error: 'This account has been suspended. Contact support@legalconnect.in.' };
  }

  // Success → issue OTP challenge (2FA)
  const device = getDeviceProfile(req);
  const isNewDevice = !isTrustedDevice(user, device);
  const otp = generateOTP();
  const challenge = {
    id: db.uid('otp'),
    userId: user.id,
    codeHash: sha256Short(otp + user.id), // never store raw code at rest
    device,
    isNewDevice,
    attempts: 0,
    expiresAt: new Date(Date.now() + config.otpExpiryMs).toISOString(),
    consumed: false,
    createdAt: new Date().toISOString()
  };
  data.otpChallenges.push(challenge);
  if (data.otpChallenges.length > 50) data.otpChallenges.splice(0, data.otpChallenges.length - 50);
  db.save();

  const mailed = await deliverOTP(user, otp);

  return {
    ok: true,
    challengeId: challenge.id,
    maskedEmail: maskEmail(user.email),
    maskedPhone: maskPhone(user.phone),
    isNewDevice,
    devOtp: shouldSurfaceDevCode(mailed) ? otp : undefined
  };
}

async function resendOTP(challengeId) {
  const data = db.get();
  const challenge = data.otpChallenges.find(c => c.id === challengeId && !c.consumed);
  if (!challenge) return { ok: false, code: 404, error: 'Verification session expired. Please sign in again.' };
  const user = data.users.find(u => u.id === challenge.userId);
  const otp = generateOTP();
  challenge.codeHash = sha256Short(otp + user.id);
  challenge.attempts = 0;
  challenge.expiresAt = new Date(Date.now() + config.otpExpiryMs).toISOString();
  db.save();
  const mailed = await deliverOTP(user, otp);
  return { ok: true, devOtp: shouldSurfaceDevCode(mailed) ? otp : undefined };
}

/* ---------------- Password reset (real email flow) ---------------- */
const crypto = require('crypto');

async function requestPasswordReset(email) {
  if (!mailer.isConfigured()) {
    return {
      ok: false,
      code: 503,
      error: 'The email service is not configured yet. Please set SMTP_HOST, SMTP_USER and SMTP_PASS in your .env file, then restart the server.'
    };
  }
  const data = db.get();
  const user = data.users.find(u => u.email === String(email).toLowerCase().trim());

  // Enumeration-safe: identical response whether or not the account exists
  const genericMessage = 'If an account exists for this address, a password reset link is on its way. It expires in 30 minutes.';
  if (user && user.role !== 'admin') {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = sha256Short(token + user.id);
    user.resetTokenExpiresAt = new Date(Date.now() + config.resetTokenExpiryMs).toISOString();
    db.save();

    const link = `${config.appBaseUrl}/frontend/lawyer/index.html#/reset-password?token=${token}`;
    await mailer.send({
      to: user.email,
      subject: 'Reset your LegalConnect password',
      html: mailer.resetEmailHtml(link, Math.round(config.resetTokenExpiryMs / 60000)),
      text: `Reset your LegalConnect password: ${link} (expires in ${Math.round(config.resetTokenExpiryMs / 60000)} minutes)`
    });
  }
  return { ok: true, message: genericMessage };
}

function resetPassword(token, newPassword) {
  if (!validatePassword(newPassword)) {
    return { ok: false, code: 400, error: 'Password must be at least 8 characters with letters and numbers.' };
  }
  const data = db.get();
  const user = data.users.find(u =>
    u.resetTokenHash &&
    u.resetTokenExpiresAt &&
    new Date(u.resetTokenExpiresAt).getTime() > Date.now() &&
    u.resetTokenHash === sha256Short(String(token || '') + u.id)
  );
  if (!user) {
    return { ok: false, code: 400, error: 'This reset link is invalid or has expired. Please request a fresh one.' };
  }

  // Consume the token immediately (single-use)
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.passwordHash = bcrypt.hashSync(newPassword, config.bcryptRounds);
  user.passwordChangeRequired = false;
  user.sensitiveActionsLockedUntil = null;
  revokeAllSessions(user.id); // every signed-in device must re-authenticate

  logActivity('password_reset', 'Password changed via email reset link', user);
  notifyUser(user.id, 'security', 'Password Reset Completed',
    'Your password was changed using an email reset link. All sessions were signed out.',
    '/settings/tab/security');
  db.save();
  return { ok: true };
}

function verifyOTP(challengeId, code, req) {
  const data = db.get();
  const challenge = data.otpChallenges.find(c => c.id === challengeId);
  if (!challenge || challenge.consumed) {
    return { ok: false, code: 400, error: 'Verification session not found or already used. Please sign in again.' };
  }
  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    return { ok: false, code: 400, error: 'This code has expired. Request a new one.' };
  }
  challenge.attempts += 1;

  const user = data.users.find(u => u.id === challenge.userId);
  if (!user) return { ok: false, code: 400, error: 'Account not found.' };

  if (challenge.attempts > config.otpMaxAttempts) {
    challenge.consumed = true;
    db.save();
    logActivity('otp_locked', 'OTP verification abandoned after too many failed attempts', user, req, 'locked');
    // Security notification
    notifyUser(user.id, 'security', 'Multiple Failed Verification Attempts', 'Several incorrect verification codes were entered. For your safety, please start a fresh sign-in.', '/settings/tab/security');
    return { ok: false, code: 429, error: 'Too many failed attempts. Start a fresh sign-in to receive a new code.', locked: true };
  }

  if (sha256Short(String(code).trim() + user.id) !== challenge.codeHash) {
    db.save();
    return {
      ok: false,
      code: 401,
      error: 'Incorrect code. Please try again.',
      attemptsRemaining: Math.max(0, config.otpMaxAttempts - challenge.attempts)
    };
  }

  challenge.consumed = true;
  const device = challenge.device;
  const wasNewDevice = challenge.isNewDevice;

  // Trust the device only AFTER successful OTP + explicit new-device confirmation happens client-side next.
  const { token, sessionId } = createSession(user, device);
  logActivity(wasNewDevice ? 'login_new_device' : 'login', wasNewDevice ? 'Signed in from a new device (pending confirmation)' : 'Signed in successfully', user, req);

  if (wasNewDevice) {
    notifyUser(user.id, 'security', 'New Device Sign-In', `A sign-in from ${device.browser} on ${device.os} (${device.deviceType}) is awaiting your confirmation. If this wasn't you, secure your account immediately.`, '/settings/tab/security');
  }

  return {
    ok: true,
    token,
    sessionId,
    requiresDeviceConfirmation: wasNewDevice,
    user: publicUser(user)
  };
}

/** Called when the lawyer confirms "Yes, this is me" on the New Device screen. */
function confirmNewDevice(userId, req) {
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  if (!user) return { ok: false, code: 404, error: 'Account not found' };
  const device = getDeviceProfile(req);
  if (!isTrustedDevice(user, device)) {
    data.trustedDevices.push({ id: db.uid('dev'), userId: user.id, ...device, addedAt: new Date().toISOString() });
    db.save();
    logActivity('device_trusted', `Device confirmed and marked trusted (${device.browser} on ${device.os})`, user, req);
  }
  return { ok: true };
}

/* ---------------- Sessions & incidents ---------------- */
function listSessions(userId) {
  const now = Date.now();
  return db.get().sessions
    .filter(s => s.userId === userId && !s.revoked)
    .map(s => ({ ...s, expired: new Date(s.createdAt).getTime() + 24 * 3600 * 1000 < now }));
}

function revokeSession(userId, sessionId) {
  const data = db.get();
  const sess = data.sessions.find(s => s.id === sessionId && s.userId === userId);
  if (sess) { sess.revoked = true; db.save(); }
  return !!sess;
}

function revokeAllSessions(userId, exceptSessionId = null) {
  const data = db.get();
  let count = 0;
  for (const s of data.sessions) {
    if (s.userId === userId && !s.revoked && s.id !== exceptSessionId) { s.revoked = true; count++; }
  }
  db.save();
  return count;
}

/** "This wasn't me" incident response: kill sessions, lock sensitive actions, alert desk. */
function reportIncident(userId, currentSessionId) {
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  if (!user) return { ok: false };

  revokeAllSessions(userId, null); // terminate EVERYTHING including current
  user.sensitiveActionsLockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour cool-down
  user.passwordChangeRequired = true;

  data.fraudRiskRecords.push({
    id: db.uid('fraud'),
    lawyerId: userId,
    status: 'medium_risk_manual_review',
    signals: ['Account holder reported unrecognized sign-in'],
    action: 'All sessions terminated; sensitive actions locked 1h; password reset required; security desk notified.',
    createdAt: new Date().toISOString()
  });

  data.adminActions.push({
    id: db.uid('adm'),
    type: 'security_incident',
    lawyerId: userId,
    summary: 'Lawyer reported unauthorized sign-in ("this wasn\'t me").',
    status: 'open',
    createdAt: new Date().toISOString()
  });

  db.save();
  return { ok: true };
}

/* ---------------- Notifications (internal helper) ---------------- */
function notifyUser(lawyerId, type, title, message, link = null) {
  const ws = db.workspaceFor(lawyerId);
  ws.notifications = ws.notifications || [];
  ws.notifications.unshift({
    id: db.uid('notif'),
    type, title, message, link,
    read: false,
    time: new Date().toISOString()
  });
  if (ws.notifications.length > 100) ws.notifications.length = 100;
  db.save();
}

module.exports = {
  publicUser,
  getDeviceProfile,
  logActivity,
  register,
  login,
  resendOTP,
  verifyOTP,
  requestPasswordReset,
  resetPassword,
  confirmNewDevice,
  listSessions,
  revokeSession,
  revokeAllSessions,
  reportIncident,
  notifyUser,
  createSession
};
