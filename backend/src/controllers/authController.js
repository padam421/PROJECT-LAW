/* ============================================================
   LEGALCONNECT — AUTH CONTROLLER
   ============================================================ */

const authService = require('../services/authService');
const db = require('../config/dbConfig');
const { validateBody, validatePassword } = require('../utils/helpers');

const registerSchema = {
  fullName: { required: true, label: 'Full legal name', maxLength: 120 },
  dob: { required: true, type: 'date', label: 'Date of birth' },
  gender: { required: true, enum: ['Male', 'Female', 'Other'], label: 'Gender' },
  phone: { required: true, type: 'phone', label: 'Mobile number' },
  email: { required: true, type: 'email', label: 'Email address' },
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
  primarySpecialization: { required: true, label: 'Primary specialization' },
  password: { required: true, label: 'Password' }
};

exports.register = async (req, res) => {
  const check = validateBody(registerSchema, req.body || {});
  if (!check.ok) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', fieldErrors: check.errors });
  }
  if (!validatePassword(req.body.password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and contain both letters and numbers.',
      fieldErrors: { password: 'At least 8 characters with letters and numbers' }
    });
  }
  if (req.body.password !== req.body.confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.', fieldErrors: { confirmPassword: 'Passwords do not match' } });
  }

  const result = await authService.register(req.body);
  if (!result.ok) return res.status(result.code).json({ error: result.error });

  if (result.underInvestigation) {
    return res.status(202).json({
      status: 'under_investigation',
      message: 'Your registration was received, but this Bar Council registration is already linked to another verified advocate profile. Our investigation desk will contact you. You cannot sign in until this is resolved.'
    });
  }

  return res.json({
    status: 'created',
    lawyerId: result.lawyerId,
    message: 'Registration received. Proceed to credential verification.'
  });
};

exports.login = async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your registered email/mobile and password.' });
  }
  const result = await authService.login(identifier, password, req);
  return res.status(result.ok ? 200 : result.code).json(
    result.ok
      ? {
          requires2FA: true,
          challengeId: result.challengeId,
          maskedEmail: result.maskedEmail,
          maskedPhone: result.maskedPhone,
          isNewDevice: result.isNewDevice,
          devOtp: result.devOtp
        }
      : { error: result.error, attemptsRemaining: result.attemptsRemaining }
  );
};

exports.forgotPassword = async (req, res) => {
  const email = String((req.body || {}).email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

exports.resendOTP = (req, res) => {
  const result = authService.resendOTP(req.body ? req.body.challengeId : '');
  return res.status(result.ok ? 200 : result.code).json(result.ok ? { resent: true, devOtp: result.devOtp } : { error: result.error });
};

exports.verifyOTP = (req, res) => {
  const { challengeId, code } = req.body || {};
  if (!challengeId || !/^\d{6}$/.test(String(code || ''))) {
    return res.status(400).json({ error: 'Enter the complete 6-digit verification code.' });
  }
  const result = authService.verifyOTP(challengeId, code, req);
  return res.status(result.ok ? 200 : result.code).json(
    result.ok
      ? {
          token: result.token,
          sessionId: result.sessionId,
          requiresDeviceConfirmation: result.requiresDeviceConfirmation,
          user: result.user
        }
      : { error: result.error, attemptsRemaining: result.attemptsRemaining, locked: !!result.locked }
  );
};

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
  res.json({ ok: true });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const bcrypt = require('bcryptjs');
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
  // Security best-practice: revoke every other session after a password change.
  const revoked = authService.revokeAllSessions(req.user.id, req.session.id);
  db.save();
  authService.notifyUser(req.user.id, 'security', 'Password Changed', 'Your password was changed. All other sessions were signed out.', '/settings/tab/security');
  res.json({ ok: true, revokedSessions: revoked });
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
  res.json({ ...result, message: 'All sessions were terminated. Sign-in remains available, but sensitive actions stay locked for 1 hour or until you change your password. Our security desk has been notified.' });
};
