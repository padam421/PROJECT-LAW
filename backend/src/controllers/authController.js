/* ============================================================
   Nyay Setu — AUTH CONTROLLER
   authController.js — Registration (initiate → OTP → complete),
   login with email OTP 2FA, sessions (HttpOnly cookie), devices,
   incidents, password management.
   ============================================================ */

const authService = require('../services/authService');
const DbService = require('../services/dbService');
const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const { validateBody, validatePassword, validateEmail } = require('../utils/helpers');

/* Schema for phase-2 profile completion (professional credentials) */
const profileSchema = {
  fullName: { required: true, label: 'Full legal name', maxLength: 120 },
  dob: { required: true, type: 'date', label: 'Date of birth' },
  gender: { required: true, enum: ['Male', 'Female', 'Other'], label: 'Gender' },
  phone: { required: true, type: 'phone', label: 'Mobile number' },
  address: { required: true, label: 'Address', maxLength: 250 },
  city: { required: true, label: 'City', maxLength: 80 },
  state: { required: true, label: 'State', maxLength: 80 },
  barCouncil: { required: true, type: 'bar', label: 'Bar Council Registration Number' },
  stateBarCouncil: { required: true, label: 'State Bar Council' },
  enrollmentDate: { required: true, type: 'date', label: 'Enrollment date' },
  qualification: { required: true, label: 'LLB qualification', maxLength: 160 },
  university: { required: true, label: 'University / college', maxLength: 200 },
  yearsOfPractice: { required: true, type: 'number', min: 0, max: 60, label: 'Years of practice' },
  practiceType: { required: true, label: 'Practice type' },
  primarySpecialization: { required: true, label: 'Primary specialization' }
};

/* ----------------------------------------------------------
   REGISTRATION — Phase 1: email + password → OTP email
   ---------------------------------------------------------- */
exports.registerInitiate = async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!validateEmail(email)) {
    return res.status(400).json({
      error: 'Enter a valid email address.',
      fieldErrors: { email: 'Enter a valid email address' }
    });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and contain both letters and numbers.',
      fieldErrors: { password: 'At least 8 characters with letters and numbers' }
    });
  }

  const result = await authService.registerInitiate(email, password, req, role || 'user');
  if (!result.ok) {
    return res.status(result.code).json({
      error: result.error,
      fieldErrors: result.fieldErrors,
      reason: result.reason,
      retryAfterMs: result.retryAfterMs
    });
  }

  return res.json({
    status: 'otp_sent',
    challengeId: result.challengeId,
    email: result.email,
    maskedEmail: result.maskedEmail,
    expiresAt: result.expiresAt,
    resendAvailableAt: result.resendAvailableAt,
    reused: !!result.reused
  });
};

/* ----------------------------------------------------------
   REGISTRATION — Phase 2: profile details after verification
   ---------------------------------------------------------- */
exports.registerComplete = async (req, res) => {
  const user = req.user;

  if (!user.isVerified) {
    return res.status(403).json({ error: 'Verify your email address before completing your profile.' });
  }
  if (user.registrationStage === 'complete') {
    return res.status(409).json({ error: 'Your profile is already complete.', code: 'already_complete' });
  }

  const isClient = user.role === 'user' || req.body.role === 'user';
  if (!isClient) {
    const check = validateBody(profileSchema, req.body || {});
    if (!check.ok) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fieldErrors: check.errors });
    }
  }

  const payload = { ...req.body };
  delete payload.profilePhotoData; // handled separately below

  if (typeof req.body.profilePhotoData === 'string' && req.body.profilePhotoData.length > 1_500_000) {
    return res.status(413).json({ error: 'Photo too large. Please choose an image under 1 MB.' });
  }

  const result = await authService.registerComplete(user, { ...payload, profilePhotoData: req.body.profilePhotoData });
  if (!result.ok) {
    return res.status(result.code).json({ error: result.error, fieldErrors: result.fieldErrors });
  }

  if (result.underInvestigation) {
    return res.status(202).json({
      status: 'under_investigation',
      message: 'Your registration was received, but this Bar Council registration is already linked to another verified advocate profile. Our investigation desk will contact you.'
    });
  }

  return res.json({
    status: 'profile_complete',
    lawyerId: result.lawyerId,
    message: 'Registration complete. Proceed to credential verification.',
    user: authService.publicUser(req.user)
  });
};

/* ----------------------------------------------------------
   LOGIN — credentials then direct login or email OTP 2FA
   ---------------------------------------------------------- */
exports.login = async (req, res) => {
  const { identifier, email, password } = req.body || {};
  const userIdentifier = email || identifier;
  if (!userIdentifier || !password) {
    return res.status(400).json({ error: 'Enter your registered email and password.' });
  }
  const result = await authService.login(userIdentifier, password, req);
  if (!result.ok) {
    return res.status(result.code || 401).json({
      error: result.error,
      attemptsRemaining: result.attemptsRemaining,
      reason: result.reason,
      retryAfterMs: result.retryAfterMs
    });
  }

  // Direct login when verified and 2FA not required
  if (result.directLogin) {
    authService.setAuthCookie(res, result.token);
    return res.json({
      ok: true,
      directLogin: true,
      requires2FA: false,
      sessionId: result.sessionId,
      token: result.token,
      user: result.user
    });
  }

  return res.json({
    ok: true,
    requires2FA: true,
    challengeId: result.challengeId,
    email: result.email,
    maskedEmail: result.maskedEmail,
    maskedPhone: result.maskedPhone,
    isNewDevice: result.isNewDevice,
    expiresAt: result.expiresAt,
    resendAvailableAt: result.resendAvailableAt,
    emailNotVerified: !!result.emailNotVerified
  });
};

/* ----------------------------------------------------------
   OTP VERIFICATION — issues the HttpOnly session cookie
   ---------------------------------------------------------- */
exports.verifyOTP = async (req, res) => {
  const { challengeId, code, email, otp } = req.body || {};
  const inputCode = code || otp;
  if (!inputCode || !/^\d{6}$/.test(String(inputCode).trim())) {
    return res.status(400).json({ error: 'Enter the complete 6-digit verification code.' });
  }
  if (!challengeId && !email) {
    return res.status(400).json({ error: 'Email address or verification challenge ID is required.' });
  }

  const result = await authService.verifyOTP({ challengeId, email, code: inputCode }, req);
  if (!result.ok) {
    return res.status(result.code).json({
      error: result.error,
      attemptsRemaining: result.attemptsRemaining,
      locked: !!result.locked,
      expired: !!result.expired
    });
  }

  // JWT lives in an HttpOnly Secure cookie from here on.
  authService.setAuthCookie(res, result.token);

  return res.json({
    ok: true,
    message: 'Email verified successfully',
    sessionId: result.sessionId,
    token: result.token,
    purpose: result.purpose,
    requiresDeviceConfirmation: result.requiresDeviceConfirmation,
    needsProfileCompletion: result.needsProfileCompletion,
    user: result.user
  });
};

exports.resendOTP = async (req, res) => {
  const { challengeId, email } = req.body || {};
  if (!challengeId && !email) {
    return res.status(400).json({ error: 'Email address or verification challenge ID is required.' });
  }
  const result = await authService.resendOTP({ challengeId, email }, req);
  if (!result.ok) {
    return res.status(result.code).json({ error: result.error, reason: result.reason, retryAfterMs: result.retryAfterMs });
  }
  return res.json({
    ok: true,
    message: 'Verification code resent successfully',
    expiresAt: result.expiresAt,
    resendAvailableAt: result.resendAvailableAt
  });
};

/* ----------------------------------------------------------
   PASSWORD RESET
   ---------------------------------------------------------- */
exports.forgotPassword = async (req, res) => {
  const email = String((req.body || {}).email || '').trim();
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const result = await authService.requestPasswordReset(email);
  return res.status(result.ok ? 200 : result.code).json(
    result.ok ? { message: result.message } : { error: result.error }
  );
};

exports.resetPassword = (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Reset link is incomplete. Please use the link from your email.' });
  }
  const result = authService.resetPassword(token, newPassword);
  return res.status(result.ok ? 200 : result.code).json(
    result.ok ? { ok: true } : { error: result.error }
  );
};

/* ----------------------------------------------------------
   SESSION / ACCOUNT MANAGEMENT
   ---------------------------------------------------------- */
exports.confirmNewDevice = (req, res) => {
  const result = authService.confirmNewDevice(req.user.id, req);
  return res.status(result.ok ? 200 : result.code).json(result.ok ? { trusted: true } : { error: result.error });
};

exports.session = (req, res) => {
  res.json({ user: authService.publicUser(req.user), sessionId: req.session.id });
};

exports.logout = (req, res) => {
  authService.revokeSession(req.user.id, req.session.id);
  authService.logActivity('logout', 'Signed out', req.user, req);
  authService.clearAuthCookie(res); // clear the HttpOnly cookie server-side
  res.json({ ok: true });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const ok = await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Your current password is incorrect.' });
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters with letters and numbers.' });
  }
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  req.user.passwordChangeRequired = false;
  // Password change is the advertised recovery path for an incident lock —
  // completing it restores sensitive-action access immediately.
  req.user.sensitiveActionsLockedUntil = null;
  // Persist directly to MySQL users table
  await DbService.updateUserPassword(req.user.id, req.user.passwordHash).catch(err => {
    console.error('[authController] changePassword MySQL error:', err.message);
  });
  // Security best-practice: revoke every other session after a password change.
  const revoked = authService.revokeAllSessions(req.user.id, req.session.id);
  db.save();
  authService.notifyUser(req.user.id, 'security', 'Password Changed', 'Your password was changed. All other sessions were signed out.', '/settings/tab/security');
  res.json({ ok: true, revokedSessions: revoked, message: 'Password updated successfully and saved to database.' });
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, city, state } = req.body || {};
    if (fullName) req.user.fullName = String(fullName).trim();
    if (phone) {
      req.user.phone = String(phone).trim();
      req.user.phoneNormalized = req.user.phone;
    }
    if (city) req.user.city = String(city).trim();
    if (state) req.user.state = String(state).trim();

    // Persist to MySQL
    await DbService.updateUserProfile(req.user.id, {
      fullName: req.user.fullName,
      phone: req.user.phone,
      city: req.user.city,
      state: req.user.state
    });

    db.save();
    return res.json({
      success: true,
      message: 'Profile updated successfully and saved to database.',
      user: {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone,
        city: req.user.city,
        state: req.user.state,
        role: req.user.role
      }
    });
  } catch (err) {
    console.error('[authController] updateProfile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

exports.listDevices = (req, res) => {
  const devices = db.get().trustedDevices.filter(d => d.userId === req.user.id);
  res.json({ devices });
};

exports.revokeDevice = (req, res) => {
  const data = db.get();
  const before = data.trustedDevices.length;
  data.trustedDevices = data.trustedDevices.filter(d => !(d.id === req.params.deviceId && d.userId === req.user.id));
  db.save();
  if (data.trustedDevices.length === before) return res.status(404).json({ error: 'Device not found.' });
  authService.logActivity('device_revoked', `Trusted device revoked (${req.params.deviceId})`, req.user, req);
  res.json({ ok: true });
};

exports.listActivity = (req, res) => {
  const activity = db.get().loginActivity.filter(a => a.userId === req.user.id).slice(0, 50);
  res.json({ activity });
};

exports.listSessions = (req, res) => {
  const sessions = authService.listSessions(req.user.id).map(s => ({
    id: s.id,
    device: s.device,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    current: s.id === req.session.id,
    expired: !!s.expired
  }));
  res.json({ sessions });
};

exports.terminateSession = (req, res) => {
  if (req.params.sessionId === req.session.id) {
    return res.status(400).json({ error: 'Use sign-out to end the current session.' });
  }
  const done = authService.revokeSession(req.user.id, req.params.sessionId);
  res.status(done ? 200 : 404).json(done ? { ok: true } : { error: 'Session not found.' });
};

exports.reportIncident = (req, res) => {
  const result = authService.reportIncident(req.user.id, req.session.id);
  authService.clearAuthCookie(res);
  res.json({ ...result, message: 'All sessions were terminated. Sign-in remains available, but sensitive actions stay locked for 1 hour or until you change your password. Our security desk has been notified.' });
};
