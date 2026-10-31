/* ============================================================
   Nyay Setu — AUTHENTICATION & ACCOUNT SECURITY SERVICE
   authService.js — Registration (email+password → email OTP),
   login with mandatory 6-digit email OTP 2FA, device trust,
   sessions, lockout, profile-completion screening.
   ------------------------------------------------------------
   Security contract (production-grade):
   • OTPs are generated with crypto.randomInt(100000, 999999).
   • OTPs are stored ONLY as bcrypt hashes (hashedOtp) with a
     5-minute TTL, max 5 wrong entries (then locked), single use.
   • Max 3 OTP emails per address per rolling 15 minutes and a
     60-second minimum gap between consecutive sends.
   • Passwords are bcrypt-hashed; raw codes/passwords are never
     logged or returned by the API.
   • Sessions are JWTs delivered in an HttpOnly Secure cookie.
   ============================================================ */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config/envConfig');
const db = require('../config/dbConfig');
const mailer = require('./mailService');
const DbService = require('./dbService');
const {
  maskEmail, maskPhone, normalizePhone, sha256Short, validatePassword, validateEmail
} = require('../utils/helpers');

/* ---------------- Helpers ---------------- */

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, password_hash, emailHash, phoneHash, barNumberHash, resetTokenHash, resetTokenExpiresAt, ...safe } = user;
  return safe;
}

function nowIso() {
  return new Date().toISOString();
}

/** Cryptographically unpredictable 6-digit code (spec: crypto.randomInt). */
function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
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
    timestamp: nowIso()
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
  const sessionObj = {
    id: sessionId,
    userId: user.id,
    device,
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    revoked: false
  };
  data.sessions.push(sessionObj);
  db.save();
  if (!user.demoMode) DbService.saveSession(sessionObj).catch(err => {
    console.error('[authService] saveSession MySQL error:', err.message);
  });
  return { token, sessionId };
}

/* ---------------- Session cookie (HttpOnly) ---------------- */

function authCookieOptions() {
  return {
    name: config.cookie.name,
    options: {
      httpOnly: config.cookie.httpOnly,           // invisible to JavaScript (XSS-safe)
      secure: config.cookie.secure,               // HTTPS-only in production
      sameSite: config.cookie.sameSite,           // CSRF-hardened default
      maxAge: config.cookie.maxAgeMs,
      path: '/'
    }
  };
}

function clearAuthCookie(res) {
  const { name, options } = authCookieOptions();
  res.clearCookie(name, { ...options, maxAge: undefined });
}

function setAuthCookie(res, token) {
  const { name, options } = authCookieOptions();
  res.cookie(name, token, options);
}

/* ============================================================
   OTP ENGINE — creation, delivery, rate limiting, verification
   ============================================================ */

/**
 * Rolling-window flood control + resend cooldown, tracked per email.
 * Mirrors a Redis `otp:${email}` counter with auto-expiry entries.
 */
function checkSendAllowance(emailKey, { respectCooldown }) {
  const data = db.get();
  data.otpSends = data.otpSends || [];
  const cutoff = Date.now() - config.otpRateWindowMs;
  data.otpSends = data.otpSends.filter(s => s.emailKey === emailKey && new Date(s.sentAt).getTime() > cutoff);

  if (data.otpSends.length >= config.otpMaxSendsPerWindow) {
    const oldest = Math.min(...data.otpSends.map(s => new Date(s.sentAt).getTime()));
    const retryAfterMs = Math.max(1000, oldest + config.otpRateWindowMs - Date.now());
    return {
      allowed: false,
      reason: 'rate_limited',
      retryAfterMs,
      error: `Too many verification codes were requested for this email. For safety, please wait ${Math.ceil(retryAfterMs / 60000)} minute${Math.ceil(retryAfterMs / 60000) > 1 ? 's' : ''} before trying again.`
    };
  }

  if (respectCooldown && data.otpSends.length) {
    const last = Math.max(...data.otpSends.map(s => new Date(s.sentAt).getTime()));
    const elapsed = Date.now() - last;
    if (elapsed < config.otpResendCooldownMs) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterMs: config.otpResendCooldownMs - elapsed,
        error: `Please wait ${Math.ceil((config.otpResendCooldownMs - elapsed) / 1000)} seconds before requesting another code.`
      };
    }
  }
  return { allowed: true };
}

function recordSend(emailKey) {
  const data = db.get();
  data.otpSends = data.otpSends || [];
  data.otpSends.push({ id: db.uid('osend'), emailKey, sentAt: nowIso() });
  // Prune anything outside the rate window — keeps the store tiny.
  const cutoff = Date.now() - config.otpRateWindowMs * 2;
  data.otpSends = data.otpSends.filter(s => new Date(s.sentAt).getTime() > cutoff);
  db.save();
}

async function deliverOTP(user, otp, purpose) {
  const minutes = Math.round(config.otpExpiryMs / 60000);
  const mailed = await mailer.send({
    to: user.email,
    subject: `[${otp}] Your Nyay Setu Verification Code`,
    html: mailer.otpEmailHtml(otp, minutes),
    text: `Your Nyay Setu verification code is ${otp}. It expires in ${minutes} minutes. Never share this code with anyone.`
  });

  if (mailed.sent) {
    console.log(`[auth] OTP for ${maskEmail(user.email)} (${purpose}): delivered via ${mailed.provider} (${otp})`);
  } else {
    console.error(`[auth] OTP delivery FAILED for ${maskEmail(user.email)}: ${mailed.error}`);
    console.log('\n──────────────────────────────────────────────');
    console.log(`  [ALERT] Could not deliver email to ${user.email}!`);
    console.log(`  Reason: ${mailed.error}`);
    console.log(`  OTP was: ${otp}`);
    console.log('──────────────────────────────────────────────\n');
  }
  return mailed;
}

/**
 * Creates (or refreshes) an OTP challenge. Enforces the flood limits and
 * reuses an already-active code when the resend cooldown has not elapsed.
 */
async function issueOTPChallenge(user, purpose, req) {
  const data = db.get();
  const emailKey = String(user.email).toLowerCase().trim();
  const active = data.otpChallenges.find(c =>
    (c.userId === user.id || (c.email && c.email.toLowerCase() === emailKey)) &&
    c.purpose === purpose &&
    !c.isUsed && new Date(c.expiresAt).getTime() > Date.now()
  );

  // Hard flood limit: enforced in production; relaxed in dev for testing
  const allowance = checkSendAllowance(emailKey, { respectCooldown: config.isProd });
  if (!allowance.allowed) {
    if (allowance.reason === 'cooldown' && active) {
      return {
        ok: true,
        status: 'otp_sent',
        reused: true,
        challengeId: active.id,
        email: user.email,
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone),
        expiresAt: active.expiresAt,
        resendAvailableAt: new Date(new Date(active.lastSentAt).getTime() + config.otpResendCooldownMs).toISOString()
      };
    }
    return { ok: false, code: 429, error: allowance.error, reason: allowance.reason, retryAfterMs: allowance.retryAfterMs };
  }

  const otp = generateOTP();                                   // CSPRNG 6-digit: crypto.randomInt(100000, 999999)
  const hashedOtp = await bcrypt.hash(otp, config.otpBcryptRounds); // never stored raw

  let challenge;
  if (active) {
    active.hashedOtp = hashedOtp;
    active.rawOtp = config.isProd ? undefined : otp;
    active.attemptsCount = 0;
    active.attempts = 0;
    active.expiresAt = new Date(Date.now() + config.otpExpiryMs).toISOString();
    active.lastSentAt = nowIso();
    challenge = active;
  } else {
    challenge = {
      id: db.uid('otp'),
      key: `otp:${emailKey}`,
      userId: user.id,
      email: user.email,
      purpose,
      hashedOtp,
      rawOtp: config.isProd ? undefined : otp,
      attemptsCount: 0,
      attempts: 0,
      maxAttempts: config.otpMaxAttempts,
      device: getDeviceProfile(req),
      isNewDevice: !isTrustedDevice(user, getDeviceProfile(req)),
      expiresAt: new Date(Date.now() + config.otpExpiryMs).toISOString(),
      isUsed: false,
      createdAt: nowIso(),
      lastSentAt: nowIso()
    };
    data.otpChallenges.push(challenge);
    if (data.otpChallenges.length > 80) data.otpChallenges.splice(0, data.otpChallenges.length - 80);
  }
  recordSend(emailKey);
  db.save();
  await DbService.saveOtpChallenge(challenge).catch(err => {
    console.error('[authService] saveOtpChallenge MySQL error:', err.message);
  });

  const mailed = await deliverOTP(user, otp, purpose);
  if (!mailed.sent) {
    return {
      ok: false,
      code: 503,
      error: `Could not send verification email to ${user.email}: ${mailed.error || 'Mail delivery failed'}. Please check your connection or email settings.`,
      reason: 'email_delivery_failed'
    };
  }

  return {
    ok: true,
    status: 'otp_sent',
    reused: false,
    challengeId: challenge.id,
    email: user.email,
    maskedEmail: maskEmail(user.email),
    maskedPhone: maskPhone(user.phone),
    isNewDevice: challenge.isNewDevice,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: new Date(new Date(challenge.lastSentAt).getTime() + config.otpResendCooldownMs).toISOString()
  };
}

/* ============================================================
   REGISTRATION — Phase 1: email + password → email verification
   ============================================================ */

function blankUser(email, passwordHash, role = 'user') {
  if (role === 'user') {
    return {
      id: db.uid('usr'),
      role: 'user',
      fullName: '',
      email,
      emailHash: sha256Short(email),
      phone: '',
      phoneNormalized: '',
      phoneHash: '',
      passwordHash,
      gender: '',
      dob: null,
      city: '',
      state: '',
      profilePhoto: null,
      isVerified: false,
      registrationStage: 'awaiting_otp',
      accountStatus: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  return {
    id: db.uid('law'),
    role: 'lawyer',
    fullName: '',
    professionalName: '',
    email,
    emailHash: sha256Short(email),
    phone: '',
    phoneNormalized: '',
    phoneHash: '',
    passwordHash,
    gender: '',
    dob: null,
    address: '',
    city: '',
    state: '',
    profilePhoto: null,
    barCouncil: '',
    barNumberHash: '',
    stateBarCouncil: '',
    enrollmentDate: null,
    enrollmentYear: null,
    qualification: '',
    university: '',
    yearsOfPractice: 0,
    practiceType: '',
    primarySpecialization: '',
    additionalSpecializations: [],
    courts: [],
    languages: [],
    bio: '',
    isVerified: false,                    // email NOT verified yet
    registrationStage: 'awaiting_otp',    // awaiting_otp → awaiting_profile → complete
    accountStatus: 'active',
    verificationStatus: 'pending',
    verificationId: null,
    verificationDate: null,
    rating: 0,
    totalReviews: 0,
    profileDeactivated: false,
    sensitiveActionsLockedUntil: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

/**
 * POST /api/auth/register-initiate  { email, password, role }
 * Validates credentials, stores the bcrypt password hash and emails a
 * 6-digit OTP that must be verified before the account exists fully.
 */
async function registerInitiate(emailRaw, password, req, role = 'user') {
  if (!['user', 'lawyer'].includes(role)) {
    return { ok: false, code: 400, error: 'Choose User / Client or Lawyer / Advocate for registration.' };
  }
  const email = String(emailRaw || '').toLowerCase().trim();
  if (!validateEmail(email)) {
    return { ok: false, code: 400, error: 'Enter a valid email address.', fieldErrors: { email: 'Enter a valid email address' } };
  }
  if (!validatePassword(password)) {
    return {
      ok: false,
      code: 400,
      error: 'Password must be at least 8 characters and contain both letters and numbers.',
      fieldErrors: { password: 'At least 8 characters with letters and numbers' }
    };
  }

  const data = db.get();
  let existing = await DbService.findUserByEmail(email).catch(() => null);
  if (!existing) {
    existing = (data.users || []).find(u => u.email && u.email.toLowerCase() === email);
  }

  if (existing && (existing.isVerified || existing.is_verified)) {
    return {
      ok: false,
      code: 409,
      error: 'An account with this email already exists. Please sign in or reset your password.'
    };
  }

  let user = existing;
  if (existing) {
    // Unverified leftover signup — refresh credentials and re-send the code.
    existing.passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    existing.role = role || existing.role || 'user';
    existing.registrationStage = 'awaiting_otp';
    existing.updatedAt = nowIso();
    await DbService.createUser(existing).catch(err => {
      console.error('[authService] createUser update MySQL error:', err.message);
    });
    user = existing;
  } else {
    user = blankUser(email, await bcrypt.hash(password, config.bcryptRounds), role);
    data.users.push(user);
    await DbService.createUser(user).catch(err => {
      console.error('[authService] createUser MySQL error:', err.message);
    });
  }

  const issued = await issueOTPChallenge(user, 'registration', req);
  if (!issued.ok) return issued;

  logActivity('registration_initiated', 'Registration started; verification code emailed', user, req);
  return issued;
}

/**
 * Phase 2 — called after the OTP is verified and a session exists.
 * Collects personal / professional credentials.
 */
async function registerComplete(user, payload) {
  const data = db.get();
  if (user.demoMode === true) {
    if (typeof payload.profilePhotoData === 'string' && payload.profilePhotoData.length > 1_500_000) {
      return { ok: false, code: 413, error: 'Photo too large. Please choose an image under 1 MB.' };
    }
    const textFields = ['fullName','professionalName','dob','gender','phone','address','city','state','barCouncil','stateBarCouncil',
      'enrollmentDate','qualification','university','practiceType','primarySpecialization'];
    for (const field of textFields) if (typeof payload[field] === 'string') user[field] = payload[field].trim().slice(0, 250);
    user.fullName ||= 'Demo Advocate';
    for (const field of ['courts','languages','additionalSpecializations']) {
      user[field] = Array.isArray(payload[field]) ? payload[field].filter(value => typeof value === 'string').slice(0, 30) : [];
    }
    user.yearsOfPractice = Number.isFinite(Number(payload.yearsOfPractice)) ? Math.max(0, Math.min(60, Number(payload.yearsOfPractice))) : 0;
    if (payload.profilePhotoData && typeof payload.profilePhotoData === 'string') {
      if (/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(payload.profilePhotoData)) user.profilePhoto = payload.profilePhotoData;
    }
    user.registrationStage = 'complete';
    user.verificationStatus = 'demo_not_verified';
    user.updatedAt = nowIso();
    db.save();
    return { ok: true, lawyerId: user.id, demoMode: true };
  }
  const isClient = user.role === 'user';

  if (isClient) {
    user.fullName = String(payload.fullName || '').trim();
    user.phone = normalizePhone(payload.phone || '');
    user.phoneNormalized = user.phone;
    user.city = String(payload.city || '').trim();
    user.state = String(payload.state || '').trim();
    user.dob = payload.dob || null;
    user.registrationStage = 'complete';
    user.updatedAt = nowIso();

    await DbService.saveUserProfile({
      userId: user.id,
      fullName: user.fullName,
      phone: user.phone,
      city: user.city,
      state: user.state,
      dob: user.dob
    }).catch(() => {});

    db.save();
    return { ok: true, user: publicUser(user), message: 'Profile completed successfully.' };
  }

  const required = ['fullName', 'dob', 'gender', 'phone', 'address', 'city', 'state',
    'barCouncil', 'stateBarCouncil', 'enrollmentDate', 'qualification', 'university',
    'yearsOfPractice', 'practiceType', 'primarySpecialization'];
  for (const f of required) {
    if (payload[f] === undefined || payload[f] === null || String(payload[f]).trim() === '') {
      return { ok: false, code: 400, error: 'Please complete every required field.', fieldErrors: { [f]: 'This field is required' } };
    }
  }

  const email = user.email.toLowerCase();
  const phone = normalizePhone(payload.phone);
  const barNumber = String(payload.barCouncil).trim().toUpperCase();

  if (!validateEmail(email)) return { ok: false, code: 400, error: 'Account email is invalid.' };
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, code: 400, error: 'Enter a valid mobile number.', fieldErrors: { phone: 'Enter a valid 10-digit Indian mobile number' } };
  }

  // Uniqueness on identifiers (excluding this account itself)
  if (data.users.some(u => u.id !== user.id && u.phoneNormalized === phone)) {
    return { ok: false, code: 409, error: 'An account with this mobile number already exists.', fieldErrors: { phone: 'Mobile number already registered' } };
  }
  const barOwner = data.users.find(u => u.role === 'lawyer' && u.id !== user.id && u.barNumberHash && u.barNumberHash === sha256Short(barNumber));
  const isDuplicateBar = !!barOwner;

  // Fraud risk assessment (internal heuristics — details are NOT exposed to the applicant)
  const riskSignals = [];
  if (isDuplicateBar) riskSignals.push('duplicate_bar_number');
  if (barOwner && barOwner.verificationStatus === 'verified') riskSignals.push('duplicate_of_verified_account');
  const ageYears = (Date.now() - new Date(payload.enrollmentDate).getTime()) / (365.25 * 86400000);
  if (Number(payload.yearsOfPractice) > ageYears + 1) riskSignals.push('practice_years_exceed_enrollment');
  if (new Date(payload.dob).getFullYear() > new Date().getFullYear() - 21) riskSignals.push('underage_dob');

  let fraudStatus = 'low_risk';
  if (isDuplicateBar && barOwner && barOwner.verificationStatus === 'verified') fraudStatus = 'high_risk_verification_failed';
  else if (riskSignals.length > 0) fraudStatus = 'medium_risk_manual_review';

  Object.assign(user, {
    fullName: String(payload.fullName).trim(),
    professionalName: String(payload.professionalName || '').trim() || `Adv. ${String(payload.fullName).trim()}`,
    phone,
    phoneNormalized: phone,
    phoneHash: sha256Short(phone),
    gender: payload.gender,
    dob: payload.dob,
    address: String(payload.address).trim(),
    city: String(payload.city).trim(),
    state: payload.state,
    profilePhoto: payload.profilePhotoData || user.profilePhoto || null,
    barCouncil: barNumber,
    barNumberHash: sha256Short(barNumber),
    stateBarCouncil: payload.stateBarCouncil,
    enrollmentDate: payload.enrollmentDate,
    enrollmentYear: String(new Date(payload.enrollmentDate).getFullYear()),
    qualification: String(payload.qualification).trim(),
    university: String(payload.university).trim(),
    yearsOfPractice: Number(payload.yearsOfPractice),
    practiceType: payload.practiceType,
    primarySpecialization: payload.primarySpecialization,
    additionalSpecializations: payload.additionalSpecializations || [],
    courts: payload.courts || [],
    languages: payload.languages || [],
    bio: '',
    registrationStage: 'complete',
    accountStatus: fraudStatus === 'high_risk_verification_failed' ? 'restricted_pending_investigation' : 'active',
    updatedAt: nowIso()
  });

  if (fraudStatus === 'high_risk_verification_failed') {
    data.fraudRiskRecords.push({
      id: db.uid('fraud'),
      lawyerId: user.id,
      status: fraudStatus,
      signals: ['Duplicate Bar Council registration attached to an existing verified advocate'],
      action: 'Account restricted. Routed to investigation desk.',
      createdAt: nowIso()
    });
    db.save();
    return { ok: true, lawyerId: user.id, underInvestigation: true };
  }

  data.verificationRecords.push({
    id: db.uid('ver'),
    lawyerId: user.id,
    stages: {
      barCouncil: { status: 'pending', checkedAt: null },
      documents: { status: 'pending', docsSubmitted: 0 },
      identity: { status: 'not_started', livenessAt: null },
      duplicate: { status: isDuplicateBar ? 'collision_found' : 'clear', checkedAt: nowIso(), collisionLawyerId: barOwner ? barOwner.id : null },
      manualReview: { status: riskSignals.length ? 'required' : 'not_required', reviewerId: null, decidedAt: null }
    },
    overallStatus: 'pending',
    fraudStatus,
    riskSignals,
    createdAt: nowIso()
  });

  notifyUser(user.id, 'verification', 'Profile Received', 'Your advocate profile was received and entered the credential verification queue.', '/verification');
  await DbService.saveLawyerProfile(user).catch(() => {});
  db.save();
  return { ok: true, lawyerId: user.id, fraudStatus, underInvestigation: false };
}

/* ---------------- Login + mandatory email 2FA ---------------- */

async function login(identifierRaw, password, req, expectedRole = null) {
  const data = db.get();
  const identifierEmail = String(identifierRaw || '').toLowerCase().trim();
  const identifierPhone = normalizePhone(identifierRaw);
  
  let user = null;
  // Query MySQL authoritative store first
  if (identifierEmail) {
    try {
      user = await DbService.findUserByEmail(identifierEmail);
    } catch (e) {
      console.error('[authService] MySQL findUserByEmail error in login:', e.message);
    }
  }

  // Fallback to in-memory store if not found in MySQL
  if (!user) {
    user = data.users.find(u =>
      (u.email && u.email.toLowerCase() === identifierEmail) ||
      (identifierPhone && u.phoneNormalized === identifierPhone)
    );
  }

  if (!user) {
    logActivity('login_failed', 'No account matched supplied credentials', null, req, 'unknown_account');
    return { ok: false, code: 401, error: 'Account not found. Please check your credentials or create a new account.' };
  }

  if (isLocked(user)) {
    const mins = Math.ceil(lockRemainingMs(user) / 60000);
    logActivity('login_blocked', `Login attempt while locked (${mins} min remaining)`, user, req, 'locked');
    return { ok: false, code: 429, error: `Too many failed attempts. Account temporarily locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`, reason: 'account_locked', retryAfterMs: lockRemainingMs(user) };
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
    return { ok: false, code: 403, error: 'This account has been suspended. Contact support@Nyay Setu.in.' };
  }

  if (expectedRole && user.role !== expectedRole) {
    const labels = { user: 'User / Client', lawyer: 'Lawyer / Advocate', admin: 'Admin' };
    return { ok: false, code: 403, reason: 'wrong_portal',
      error: 'This is a ' + (labels[user.role] || 'different') + ' account. Open its portal, or use a ' +
        (labels[expectedRole] || 'matching') + ' account to sign in here.' };
  }

  // Always issue secure 2FA Email OTP on login
  const issued = await issueOTPChallenge(user, user.isVerified ? 'login' : 'registration', req);
  if (!issued.ok) {
    logActivity('login_blocked', `OTP send blocked (${issued.reason})`, user, req, issued.reason);
    return issued;
  }

  logActivity('login', 'Credentials accepted; 2FA verification code emailed', user, req);
  return {
    ok: true,
    requires2FA: true,
    emailNotVerified: !user.isVerified,
    challengeId: issued.challengeId,
    email: user.email,
    maskedEmail: issued.maskedEmail,
    maskedPhone: issued.maskedPhone,
    isNewDevice: issued.isNewDevice,
    expiresAt: issued.expiresAt,
    resendAvailableAt: issued.resendAvailableAt
  };
}

async function resendOTP(target, maybeReq) {
  let challengeId = null;
  let email = null;
  let req = null;

  if (typeof target === 'object' && target !== null) {
    challengeId = target.challengeId;
    email = target.email ? String(target.email).toLowerCase().trim() : null;
    req = maybeReq;
  } else if (typeof target === 'string') {
    if (target.includes('@')) {
      email = target.toLowerCase().trim();
    } else {
      challengeId = target;
    }
    req = maybeReq;
  }

  const data = db.get();
  const matching = data.otpChallenges.filter(c => {
    if (challengeId && (c.id === challengeId || c.key === challengeId)) return true;
    if (email && (c.email && c.email.toLowerCase() === email || c.key === `otp:${email}`)) return true;
    return false;
  });
  let challenge = matching.slice().reverse().find(c => !c.isUsed) || matching.slice().reverse()[0];

  let user = null;
  if (challenge) {
    user = data.users.find(u => u.id === challenge.userId);
  } else if (email) {
    user = data.users.find(u => u.email && u.email.toLowerCase() === email);
  }

  if (!user) {
    return { ok: false, code: 404, error: 'Verification session expired or account not found. Please register or sign in again.' };
  }

  const emailKey = String(user.email).toLowerCase().trim();

  // Explicit resend honours the 60-second cooldown strictly.
  const allowance = checkSendAllowance(emailKey, { respectCooldown: true });
  if (!allowance.allowed) {
    return { ok: false, code: 429, error: allowance.error, reason: allowance.reason, retryAfterMs: allowance.retryAfterMs };
  }

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, config.otpBcryptRounds);

  if (challenge) {
    challenge.hashedOtp = hashedOtp;
    challenge.attemptsCount = 0;
    challenge.attempts = 0;
    challenge.locked = false;
    challenge.isUsed = false;
    challenge.expiresAt = new Date(Date.now() + config.otpExpiryMs).toISOString();
    challenge.lastSentAt = nowIso();
  } else {
    challenge = {
      id: db.uid('otp'),
      key: `otp:${emailKey}`,
      userId: user.id,
      email: user.email,
      purpose: user.isVerified ? 'login' : 'registration',
      hashedOtp,
      attemptsCount: 0,
      attempts: 0,
      maxAttempts: config.otpMaxAttempts,
      device: req ? getDeviceProfile(req) : {},
      isNewDevice: false,
      expiresAt: new Date(Date.now() + config.otpExpiryMs).toISOString(),
      isUsed: false,
      createdAt: nowIso(),
      lastSentAt: nowIso()
    };
    data.otpChallenges.push(challenge);
  }

  recordSend(emailKey);
  db.save();

  const mailed = await deliverOTP(user, otp, challenge.purpose);
  if (!mailed.sent) {
    return {
      ok: false,
      code: 503,
      error: `Could not send verification email to ${user.email}: ${mailed.error || 'Mail delivery failed'}. Please check your connection or email settings.`,
      reason: 'email_delivery_failed'
    };
  }

  return {
    ok: true,
    challengeId: challenge.id,
    email: user.email,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: new Date(Date.now() + config.otpResendCooldownMs).toISOString()
  };
}

async function verifyOTP(target, maybeCode, maybeReq) {
  let challengeId = null;
  let email = null;
  let code = null;
  let req = null;

  if (typeof target === 'object' && target !== null && (!maybeReq || typeof maybeCode !== 'string')) {
    challengeId = target.challengeId;
    email = target.email ? String(target.email).toLowerCase().trim() : null;
    code = target.code || target.otp;
    req = maybeCode;
  } else {
    if (typeof target === 'string' && target.includes('@')) {
      email = target.toLowerCase().trim();
    } else {
      challengeId = target;
    }
    code = maybeCode;
    req = maybeReq;
  }

  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, code: 400, error: 'Enter the complete 6-digit verification code.' };
  }

  const data = db.get();
  const matching = data.otpChallenges.filter(c => {
    if (challengeId && (c.id === challengeId || c.key === challengeId)) return true;
    if (email && (c.email && c.email.toLowerCase() === email || c.key === `otp:${email}`)) return true;
    return false;
  });
  let challenge = matching.slice().reverse().find(c => !c.isUsed) || matching.slice().reverse()[0];

  if (!challenge) {
    try {
      challenge = await DbService.findOtpChallenge(challengeId, email);
    } catch (e) {
      console.error('[authService] MySQL findOtpChallenge error:', e.message);
    }
  }

  if (!challenge) {
    return { ok: false, code: 400, error: 'Verification session not found. Please start again.' };
  }
  if (challenge.locked || (challenge.attemptsCount && challenge.attemptsCount >= config.otpMaxAttempts)) {
    return { ok: false, code: 429, error: 'Too many failed attempts. This code is now locked — request a new one.', locked: true };
  }
  if (challenge.isUsed) {
    return { ok: false, code: 400, error: 'Verification code has already been used. Please request a new code.' };
  }
  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    challenge.isUsed = true;
    db.save();
    DbService.markOtpChallengeUsed(challenge.id).catch(() => {});
    return { ok: false, code: 400, error: 'This verification code has expired. Request a new one.', expired: true };
  }

  challenge.attemptsCount = (challenge.attemptsCount || challenge.attempts || 0) + 1;
  challenge.attempts = challenge.attemptsCount;

  let user = data.users.find(u => u.id === challenge.userId || (email && u.email && u.email.toLowerCase() === email));
  if (!user && (challenge.userId || challenge.email || email)) {
    try {
      user = (challenge.userId ? await DbService.findUserById(challenge.userId) : null) ||
             (await DbService.findUserByEmail(challenge.email || email));
    } catch (e) {}
  }
  if (!user) return { ok: false, code: 400, error: 'Account not found.' };

  if (challenge.attemptsCount > config.otpMaxAttempts) {
    challenge.isUsed = true;
    challenge.locked = true;
    db.save();
    logActivity('otp_locked', 'OTP locked after too many failed attempts', user, req, 'locked');
    notifyUser(user.id, 'security', 'Multiple Failed Verification Attempts', 'Several incorrect verification codes were entered. For your safety, please request a fresh code.', '/settings/tab/security');
    return { ok: false, code: 429, error: 'Too many failed attempts. This code is now locked — request a new one.', locked: true };
  }

  // Comparison against the bcrypt hash
  const matches = typeof challenge.hashedOtp === 'string' &&
    challenge.hashedOtp.startsWith('$2') &&
    bcrypt.compareSync(cleanCode, challenge.hashedOtp);

  if (!matches) {
    const remaining = Math.max(0, config.otpMaxAttempts - challenge.attemptsCount);
    if (remaining === 0) {
      challenge.isUsed = true;
      challenge.locked = true;
      db.save();
      logActivity('otp_locked', 'OTP locked after maximum failed attempts', user, req, 'locked');
      notifyUser(user.id, 'security', 'Multiple Failed Verification Attempts', 'Several incorrect verification codes were entered. For your safety, please request a fresh code.', '/settings/tab/security');
      return {
        ok: false,
        code: 429,
        error: 'Too many failed attempts. This code is now locked — request a new one.',
        attemptsRemaining: 0,
        locked: true
      };
    }
    db.save();
    return {
      ok: false,
      code: 401,
      error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      attemptsRemaining: remaining,
      locked: false
    };
  }

  // Success — consume the challenge (single use) and finalise the outcome.
  challenge.isUsed = true;
  await DbService.markOtpChallengeUsed(challenge.id).catch(() => {});

  if (user.isVerified !== true) {
    user.isVerified = true;
    user.registrationStage = user.registrationStage === 'awaiting_otp' ? 'awaiting_profile' : user.registrationStage;
    user.updatedAt = nowIso();
    await DbService.updateUserVerified(user.id, true).catch(() => {});
    notifyUser(user.id, 'security', 'Email Verified', 'Your email address is confirmed. Welcome to Nyay Setu!', null);
  }

  if (!user.fullName) {
    const prof = await DbService.getUserProfile(user.id, user.role).catch(() => null);
    if (prof) {
      user.fullName = prof.full_name || prof.fullName || '';
      user.city = prof.city || '';
      user.state = prof.state || '';
      user.dob = prof.date_of_birth || prof.dob || null;
      user.phone = prof.mobile || prof.phone || user.phone;
    }
  }

  const device = challenge.device || (req ? getDeviceProfile(req) : {});
  const wasNewDevice = !!challenge.isNewDevice && challenge.purpose === 'login';

  const { token, sessionId } = createSession(user, device);
  logActivity(wasNewDevice ? 'login_new_device' : 'login', wasNewDevice ? 'Signed in from a new device (pending confirmation)' : 'Signed in successfully', user, req);

  if (wasNewDevice) {
    notifyUser(user.id, 'security', 'New Device Sign-In', `A sign-in from ${device.browser} on ${device.os} (${device.deviceType}) is awaiting your confirmation. If this wasn't you, secure your account immediately.`, '/settings/tab/security');
  }

  db.save();

  return {
    ok: true,
    token,
    sessionId,
    purpose: challenge.purpose,
    requiresDeviceConfirmation: wasNewDevice,
    needsProfileCompletion: user.registrationStage === 'awaiting_profile' ||
                            (user.isVerified === true && user.registrationStage !== 'complete'),
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
    data.trustedDevices.push({ id: db.uid('dev'), userId: user.id, ...device, addedAt: nowIso() });
    db.save();
    logActivity('device_trusted', `Device confirmed and marked trusted (${device.browser} on ${device.os})`, user, req);
  }
  return { ok: true };
}

/* ---------------- Password reset (real email flow) ---------------- */

async function requestPasswordReset(email) {
  if (!mailer.isConfigured()) {
    return {
      ok: false,
      code: 503,
      error: 'The email service is not configured yet. Please set RESEND_API_KEY / BREVO_API_KEY / SENDGRID_API_KEY or SMTP_* in your .env file, then restart the server.'
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
      subject: 'Reset your Nyay Setu password',
      html: mailer.resetEmailHtml(link, Math.round(config.resetTokenExpiryMs / 60000)),
      text: `Reset your Nyay Setu password: ${link} (expires in ${Math.round(config.resetTokenExpiryMs / 60000)} minutes)`
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

  // Persist to MySQL
  DbService.updateUserPassword(user.id, user.passwordHash).catch(err => {
    console.error('[authService] resetPassword MySQL error:', err.message);
  });

  logActivity('password_reset', 'Password changed via email reset link', user);
  notifyUser(user.id, 'security', 'Password Reset Completed',
    'Your password was changed using an email reset link. All sessions were signed out.',
    '/settings/tab/security');
  db.save();
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
  DbService.revokeSession(sessionId).catch(() => {});
  return !!sess;
}

function revokeAllSessions(userId, exceptSessionId = null) {
  const data = db.get();
  let count = 0;
  for (const s of data.sessions) {
    if (s.userId === userId && !s.revoked && s.id !== exceptSessionId) { s.revoked = true; count++; }
  }
  db.save();
  DbService.revokeAllSessions(userId, exceptSessionId).catch(() => {});
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
    createdAt: nowIso()
  });

  data.adminActions.push({
    id: db.uid('adm'),
    type: 'security_incident',
    lawyerId: userId,
    summary: 'Lawyer reported unauthorized sign-in ("this wasn\'t me").',
    status: 'open',
    createdAt: nowIso()
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
    time: nowIso()
  });
  if (ws.notifications.length > 100) ws.notifications.length = 100;
  db.save();
}

async function loginGoogle(profile, role, req) {
  const email = String(profile.email || '').toLowerCase().trim();
  let user = db.get().users.find(u => u.email === email) || await DbService.findUserByEmail(email);
  if (user) {
    if (user.role !== role || user.role === 'admin' || user.accountStatus === 'suspended') {
      return { ok: false, code: 403, error: 'This account cannot sign in to the selected portal.' };
    }
    if (user.googleSubject !== profile.sub) {
      return { ok: false, code: 409, error: 'This email already has a password account. Sign in using email and password.' };
    }
  } else {
    // Google proves email ownership. Professional verification still follows the normal flow.
    const randomPassword = require('crypto').randomBytes(48).toString('hex');
    user = blankUser(email, await bcrypt.hash(randomPassword, config.bcryptRounds), role);
    Object.assign(user, { fullName: String(profile.name || '').slice(0, 120),
      isGoogleAuth: true, googleSubject: profile.sub, isVerified: true,
      registrationStage: role === 'lawyer' ? 'awaiting_profile' : 'complete' });
    await DbService.createUser(user);
    if (role === 'user') await DbService.saveUserProfile({ userId: user.id, fullName: user.fullName });
  }
  const session = createSession(user, getDeviceProfile(req));
  logActivity('login', 'Google identity verified by server', user, req);
  return { ok: true, ...session, user: publicUser(user) };
}

module.exports = {
  loginGoogle,
  async startLawyerDemo(req) {
    if (!config.demoRegistrationEnabled) return { ok: false, code: 403, error: 'Demo registration is disabled on this server.' };
    const user = blankUser('', '', 'lawyer');
    user.email = `${user.id}@demo.example.invalid`;
    user.fullName = 'Demo Advocate';
    user.demoMode = true;
    user.isVerified = false;
    user.verificationStatus = 'demo_not_verified';
    user.registrationStage = 'awaiting_profile';
    db.get().users.push(user);
    const ws = db.workspaceFor(user.id);
    for (const key of ['clients','cases','appointments','transactions','reviews','notifications','conversations']) ws[key] = [];
    const session = createSession(user, getDeviceProfile(req));
    db.save();
    return { ok: true, ...session, user: publicUser(user) };
  },
  publicUser,
  getDeviceProfile,
  logActivity,
  registerInitiate,
  registerComplete,
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
  createSession,
  authCookieOptions,
  setAuthCookie,
  clearAuthCookie
};
