/* ============================================================
   Nyay Setu — API ROUTES
   ============================================================ */

const express = require('express');
const router = express.Router();

const auth = require('../controllers/authController');
const state = require('../controllers/stateController');
const verify = require('../controllers/verificationController');
const db = require('../config/dbConfig');
const DbService = require('../services/dbService');
const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const config = require('../config/envConfig');
const {
  authenticate,
  requireRole,
  ensureNotLocked,
} = require('../middlewares/authMiddleware');

async function optionalAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const cookieToken = (req.cookies && req.cookies[config.cookie.name]) || '';
  const token = bearer || cookieToken;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await DbService.findUserById(payload.sub).catch(() => null);
      if (user) req.user = user;
    } catch (_) {}
  }
  next();
}

/* ---------------- Public health / status ---------------- */
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    emailChannel:
      require('../services/mailService').activeChannel() || 'console_dev_mode',
    database: db.hosted ? 'external_mysql_durable' : 'local_development',
  });
});
router.get('/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const [health] = await Promise.all([
      require('../services/aiSupervisor').checkHealth(),
      db.hosted ? require('../services/hostedStore').health() : Promise.resolve()
    ]);
    const ready = health.ok && db.persistenceHealthy() && (!config.isProd || health.data?.provider_configured === true);
    res.status(ready ? 200 : 503).json({ ready, ai: health.ok, storage: db.persistenceHealthy() });
  } catch (_) { res.status(503).json({ ready: false, error: 'A required service is unavailable.' }); }
});

/* ---------------- Public auth flow ----------------
   Registration: initiate (email+password → OTP email) → verify-otp
   (marks email verified + HttpOnly session cookie) → complete profile. */
router.post('/auth/register-initiate', auth.registerInitiate);
router.post('/auth/google', auth.googleLogin);
router.get('/public-config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' }));
router.post('/auth/demo-lawyer', auth.startLawyerDemo);
router.post('/auth/register-complete', authenticate, auth.registerComplete);
router.post('/auth/login', auth.login);
router.post('/auth/forgot-password', auth.forgotPassword);
router.post('/auth/reset-password', auth.resetPassword);
router.post('/auth/otp/resend', auth.resendOTP);
router.post('/auth/resend-otp', auth.resendOTP); // spec name
router.post('/auth/otp/verify', auth.verifyOTP);
router.post('/auth/verify-otp', auth.verifyOTP); // spec name

/* ---------------- Session-scoped ---------------- */
router.get('/auth/session', authenticate, auth.session);
router.post('/auth/logout', authenticate, auth.logout);
router.post('/auth/device-confirm', authenticate, auth.confirmNewDevice);
router.post('/auth/change-password', authenticate, auth.changePassword);

router.get('/auth/devices', authenticate, auth.listDevices);
router.delete('/auth/devices/:deviceId', authenticate, auth.revokeDevice);
router.get('/auth/activity', authenticate, auth.listActivity);
router.get('/auth/sessions', authenticate, auth.listSessions);
router.delete('/auth/sessions/:sessionId', authenticate, auth.terminateSession);
router.post(
  '/auth/incident/unrecognized-login',
  authenticate,
  auth.reportIncident
);

/* ---------------- Workspace state sync ---------------- */
router.get('/state', authenticate, state.getWorkspace);
router.put('/state/:collection', authenticate, state.putCollection);
router.use('/assistant', require('./assistant'));
router.use('/advocate', require('./advocate'));

/* ---------------- Verification & documents ---------------- */
router.post(
  '/lawyer/verification/bar-lookup',
  authenticate,
  ensureNotLocked,
  verify.lookupBarCouncil
);
router.post(
  '/lawyer/documents/upload',
  authenticate,
  ensureNotLocked,
  verify.uploadMiddleware,
  verify.uploadDocument
);
router.get('/lawyer/documents', authenticate, verify.listDocuments);
router.get(
  '/lawyer/documents/:docId/download',
  authenticate,
  verify.downloadDocument
);
router.delete('/lawyer/documents/:docId', authenticate, verify.deleteDocument);
router.post('/lawyer/identity-check', authenticate, verify.submitIdentityCheck);
router.get('/lawyer/verification-summary', authenticate, verify.summary);

/* ---------------- Advocate profile ---------------- */
router.patch('/lawyer/profile', authenticate, (req, res) => {
  const user = req.user;
  const allowed = [
    'professionalName',
    'bio',
    'city',
    'state',
    'primarySpecialization',
    'additionalSpecializations',
    'courts',
    'languages',
    'yearsOfPractice',
  ];
  let reverify = false;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      // Changing statutory credentials forces re-verification
      if (
        key === 'yearsOfPractice' &&
        Number(req.body[key]) !== Number(user[key])
      ) {
        user[key] = Number(req.body[key]);
        continue;
      }
      user[key] = req.body[key];
    }
  }
  if (req.body.profilePhotoData !== undefined) {
    if (
      typeof req.body.profilePhotoData === 'string' &&
      req.body.profilePhotoData.length > 1_500_000
    ) {
      return res
        .status(413)
        .json({ error: 'Photo too large. Please choose an image under 1 MB.' });
    }
    user.profilePhoto = req.body.profilePhotoData;
  }
  if (user.demoMode && typeof req.body.barCouncil === 'string') {
    user.barCouncil = req.body.barCouncil.trim().slice(0, 250);
  }
  if (
    !user.demoMode && req.body.barCouncil &&
    String(req.body.barCouncil).trim().toUpperCase() !==
      String(user.barCouncil).toUpperCase()
  ) {
    user.barCouncil = String(req.body.barCouncil).trim().toUpperCase();
    user.barNumberHash = require('../utils/helpers').sha256Short(
      user.barCouncil
    );
    user.verificationStatus = 'pending';
    user.verificationId = null;
    user.verificationDate = null;
    reverify = true;
    const data = db.get();
    data.adminActions.push({
      id: db.uid('adm'),
      type: 'reverification_triggered',
      lawyerId: user.id,
      summary: 'Bar Council registration number changed via portfolio.',
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    authService.notifyUser(
      user.id,
      'verification',
      'Re-Verification Required',
      'Your Bar Council registration number changed. Your verified badge is paused until the new number is confirmed.',
      '/settings/tab/notifications'
    );
  }
  db.save();
  res.json({
    ok: true,
    reVerificationTriggered: reverify,
    lawyer: authService.publicUser(user),
  });
});

/* ---------------- Deactivate / reactivate ---------------- */
router.post('/lawyer/deactivate', authenticate, (req, res) => {
  req.user.profileDeactivated = true;
  db.save();
  res.json({ ok: true, profileDeactivated: true });
});
router.post('/lawyer/reactivate', authenticate, (req, res) => {
  req.user.profileDeactivated = false;
  db.save();
  res.json({ ok: true, profileDeactivated: false });
});

/* ---------------- Payments export ---------------- */
router.get('/payments/export.csv', authenticate, (req, res) => {
  const ws = db.workspaceFor(req.user.id);
  const rows = ws.transactions || [];
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = [
    [
      'Client',
      'Service',
      'Date',
      'Gross Paid (INR)',
      'Platform Fee (INR)',
      'Net Earnings (INR)',
      'Method',
      'Status',
    ].join(','),
    ...rows.map((t) =>
      [
        esc(t.clientName),
        esc(t.service),
        t.date,
        t.amount,
        t.platformFee,
        t.netEarnings,
        esc(t.paymentMethod || ''),
        t.paymentStatus,
      ].join(',')
    ),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Nyay Setu-statement-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send('\ufeff' + csv);
});

/* ---------------- Admin review console ---------------- */
router.get(
  '/admin/queue',
  authenticate,
  requireRole('admin'),
  verify.adminQueue
);
router.post(
  '/admin/decide/:lawyerId',
  authenticate,
  requireRole('admin'),
  verify.adminDecide
);

/* ---------------- Verified Lawyers Discovery ---------------- */
router.get('/lawyers', async (req, res) => {
  try {
    const lawyers = await DbService.getVerifiedLawyers();
    res.json({ ok: true, lawyers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lawyers/:id', async (req, res) => {
  try {
    const lawyer = await DbService.getLawyerById(req.params.id);
    if (!lawyer) return res.status(404).json({ error: 'Advocate not found' });
    res.json({ ok: true, lawyer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Client Profiles ---------------- */
router.get('/users/:id/profile', optionalAuth, async (req, res) => {
  try {
    const profile = await DbService.getClientProfile(req.params.id);
    if (!profile)
      return res.status(404).json({ error: 'User profile not found' });
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Consultations (Live Linking) ---------------- */
router.post('/consultations/book', optionalAuth, async (req, res) => {
  try {
    // If authenticated, use req.user.id; otherwise use provided userId or default to Padam Kishore
    let userId = req.user ? req.user.id : req.body.userId || null;
    if (!userId && req.body.email) {
      const existingUser = await DbService.findUserByEmail(req.body.email);
      if (existingUser) userId = existingUser.id;
    }
    if (!userId) {
      // Fallback to active registered user Padam Kishore if present
      userId = 'usr_mtlac008z0vvsq';
    }

    const bookingPayload = {
      ...req.body,
      userId,
    };

    const consultation = await DbService.bookConsultation(bookingPayload);
    res.status(201).json({ ok: true, consultation });
  } catch (err) {
    console.error('[routes] Error booking consultation:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/consultations/lawyer', authenticate, async (req, res) => {
  try {
    const lawyerId = req.user.id;
    const consultations = await DbService.getLawyerConsultations(lawyerId);
    res.json({ ok: true, consultations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/consultations/user', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const consultations = await DbService.getUserConsultations(userId);
    res.json({ ok: true, consultations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/consultations/:id/status', optionalAuth, async (req, res) => {
  try {
    const status = req.body.status || 'accepted';
    const lawyerId = req.user ? req.user.id : req.body.lawyerId || null;
    const result = await DbService.updateConsultationStatus(
      req.params.id,
      status,
      lawyerId
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/profile', optionalAuth, async (req, res) => {
  try {
    const userId =
      (req.user ? req.user.id : null) ||
      req.body.userId ||
      'usr_mtlac008z0vvsq';
    const { fullName, phone, city, state } = req.body;
    await DbService.updateUserProfile(userId, { fullName, phone, city, state });
    res.json({ ok: true, message: 'Profile updated in MySQL successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Notifications ---------------- */
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const role = req.query.role || (req.user ? req.user.role : null);
    const userId = req.user.id;
    const notifications = await DbService.getUserNotifications(userId, role);
    res.json({ ok: true, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    await DbService.markAllNotificationsRead(userId);
    res.json({ ok: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const updated = await DbService.markNotificationRead(req.params.id, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI SERVICE PROXY (RAG Chatbot & Virtual Court Simulator)
// ============================================================
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const aiCapacity = require('../middlewares/aiCapacity');

// POST keeps answer text out of browser URLs and access logs.
router.post('/ai/tts', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { text, language } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > 300 ||
      !['hi','en','mr','gu','bn','ta','te','kn','ml','pa','ur','or','as','ne','sa'].includes(language)) {
    return res.status(400).json({ ok: false, error: 'Invalid speech text or language.' });
  }
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/ai/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('audio/')) {
      return res.status(502).json({ ok: false, error: 'Speech service is unavailable. Please retry.' });
    }
    res.type('audio/mpeg').send(Buffer.from(await response.arrayBuffer()));
  } catch (_) {
    res.status(502).json({ ok: false, error: 'Speech service is unavailable. Please retry.' });
  }
});

router.post('/ai/chat', authenticate, aiCapacity, async (req, res) => {
  try {
    const aiResp = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(230000),
    });
    const data = await aiResp.json();
    res.status(aiResp.status).json(data);
  } catch (err) {
    console.error('AI Proxy Error:', err.message);
    const { ensureAIServiceRunning } = require('../services/aiSupervisor');
    ensureAIServiceRunning().catch(() => {});
    res.status(502).json({
      ok: false,
      error:
        'Nyay Setu AI Service is currently connecting or initializing. Please wait a moment and try again.',
    });
  }
});

router.post('/ai/court', authenticate, aiCapacity, async (req, res) => {
  try {
    const aiResp = await fetch(`${AI_SERVICE_URL}/api/ai/court`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(70000),
    });
    const data = await aiResp.json();
    if (aiResp.headers.get('retry-after')) res.set('Retry-After', aiResp.headers.get('retry-after'));
    res.status(aiResp.status).json(data);
  } catch (err) {
    console.error('AI Court Proxy Error:', err.message);
    res.status(502).json({
      ok: false,
      error: 'Courtroom Simulator AI service is currently unavailable.',
    });
  }
});

router.get('/ai/health', async (_req, res) => {
  try {
    const aiResp = await fetch(`${AI_SERVICE_URL}/api/ai/health`, { signal: AbortSignal.timeout(2500) });
    const data = await aiResp.json();
    res.status(aiResp.status).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, status: 'offline', error: 'AI service is unavailable.' });
  }
});

module.exports = router;
