/* ============================================================
   Nyay Setu — AUTH MIDDLEWARE
   authMiddleware.js — JWT verification, role guards,
   sensitive-action lock enforcement
   ============================================================ */

const jwt = require('jsonwebtoken');
const config = require('../config/envConfig');
const DbService = require('../services/dbService');
const db = require('../config/dbConfig');

async function authenticate(req, res, next) {
  // Token sources, in order: Authorization: Bearer <jwt> (API clients),
  // then the HttpOnly session cookie set by /api/auth/otp/verify.
  // Query-string tokens are deliberately NOT accepted — URLs leak into
  // logs, history and referrer headers.
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const cookieToken = (req.cookies && req.cookies[config.cookie.name]) || '';
  const token = bearer || cookieToken;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    const expired = err && err.name === 'TokenExpiredError';
    return res.status(401).json({ error: expired ? 'Your session has expired. Please sign in again.' : 'Invalid session token.', code: expired ? 'session_expired' : 'invalid_token' });
  }

  const data = db.get();
  let session = (data.sessions || []).find(s => s.id === payload.sid);
  if (!session) {
    session = await DbService.findSession(payload.sid).catch(() => null);
  }
  if (!session || session.revoked) {
    return res.status(401).json({ error: 'This session was terminated. Please sign in again.', code: 'session_terminated' });
  }

  let user = (data.users || []).find(u => u.id === payload.sub);
  if (!user) {
    user = await DbService.findUserById(payload.sub).catch(() => null);
  }
  if (!user || user.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Account unavailable. Contact support.', code: 'account_unavailable' });
  }

  req.user = user;
  req.session = session;
  session.lastSeenAt = new Date().toISOString();
  db.save();
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

/** Blocks sensitive actions while an incident cool-down is active. */
function ensureNotLocked(req, res, next) {
  if (req.user.sensitiveActionsLockedUntil && new Date(req.user.sensitiveActionsLockedUntil).getTime() > Date.now()) {
    return res.status(423).json({
      error: 'Sensitive actions are temporarily locked following a reported security incident. Change your password to restore full access.',
      code: 'sensitive_locked'
    });
  }
  next();
}

module.exports = { authenticate, requireRole, ensureNotLocked };
