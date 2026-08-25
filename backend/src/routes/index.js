/* ============================================================
   LEGALCONNECT — API ROUTES
   ============================================================ */

const express = require('express');
const router = express.Router();

const auth = require('../controllers/authController');
const state = require('../controllers/stateController');
const verify = require('../controllers/verificationController');
const db = require('../config/dbConfig');
const authService = require('../services/authService');
const { authenticate, requireRole, ensureNotLocked } = require('../middlewares/authMiddleware');

/* ---------------- Public auth flow ---------------- */
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.post('/auth/forgot-password', auth.forgotPassword);
router.post('/auth/reset-password', auth.resetPassword);
router.post('/auth/otp/resend', auth.resendOTP);
router.post('/auth/otp/verify', auth.verifyOTP);

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
router.post('/auth/incident/unrecognized-login', authenticate, auth.reportIncident);

/* ---------------- Workspace state sync ---------------- */
router.get('/state', authenticate, state.getWorkspace);
router.put('/state/:collection', authenticate, state.putCollection);

/* ---------------- Verification & documents ---------------- */
router.post('/lawyer/verification/bar-lookup', authenticate, ensureNotLocked, verify.lookupBarCouncil);
router.post('/lawyer/documents/upload', authenticate, ensureNotLocked, verify.uploadMiddleware, verify.uploadDocument);
router.get('/lawyer/documents', authenticate, verify.listDocuments);
router.get('/lawyer/documents/:docId/download', authenticate, verify.downloadDocument);
router.delete('/lawyer/documents/:docId', authenticate, verify.deleteDocument);
router.post('/lawyer/identity-check', authenticate, verify.submitIdentityCheck);
router.get('/lawyer/verification-summary', authenticate, verify.summary);

/* ---------------- Advocate profile ---------------- */
router.patch('/lawyer/profile', authenticate, (req, res) => {
  const user = req.user;
  const allowed = ['professionalName', 'bio', 'city', 'state', 'primarySpecialization', 'additionalSpecializations', 'courts', 'languages', 'yearsOfPractice'];
  let reverify = false;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      // Changing statutory credentials forces re-verification
      if ((key === 'yearsOfPractice') && Number(req.body[key]) !== Number(user[key])) {
        user[key] = Number(req.body[key]);
        continue;
      }
      user[key] = req.body[key];
    }
  }
  if (req.body.profilePhotoData !== undefined) {
    if (typeof req.body.profilePhotoData === 'string' && req.body.profilePhotoData.length > 1_500_000) {
      return res.status(413).json({ error: 'Photo too large. Please choose an image under 1 MB.' });
    }
    user.profilePhoto = req.body.profilePhotoData;
  }
  if (req.body.barCouncil && String(req.body.barCouncil).trim().toUpperCase() !== String(user.barCouncil).toUpperCase()) {
    user.barCouncil = String(req.body.barCouncil).trim().toUpperCase();
    user.barNumberHash = require('../utils/helpers').sha256Short(user.barCouncil);
    user.verificationStatus = 'pending';
    user.verificationId = null;
    user.verificationDate = null;
    reverify = true;
    const data = db.get();
    data.adminActions.push({ id: db.uid('adm'), type: 'reverification_triggered', lawyerId: user.id, summary: 'Bar Council registration number changed via portfolio.', status: 'open', createdAt: new Date().toISOString() });
    authService.notifyUser(user.id, 'verification', 'Re-Verification Required', 'Your Bar Council registration number changed. Your verified badge is paused until the new number is confirmed.', '/settings/tab/notifications');
  }
  db.save();
  res.json({ ok: true, reVerificationTriggered: reverify, lawyer: authService.publicUser(user) });
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
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = [
    ['Client', 'Service', 'Date', 'Gross Paid (INR)', 'Platform Fee (INR)', 'Net Earnings (INR)', 'Method', 'Status'].join(','),
    ...rows.map(t => [esc(t.clientName), esc(t.service), t.date, t.amount, t.platformFee, t.netEarnings, esc(t.paymentMethod || ''), t.paymentStatus].join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="legalconnect-statement-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\ufeff' + csv);
});

/* ---------------- Admin review console ---------------- */
router.get('/admin/queue', authenticate, requireRole('admin'), verify.adminQueue);
router.post('/admin/decide/:lawyerId', authenticate, requireRole('admin'), verify.adminDecide);

module.exports = router;
