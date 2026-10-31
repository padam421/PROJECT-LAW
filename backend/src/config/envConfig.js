/* ============================================================
   Nyay Setu — ENVIRONMENT CONFIGURATION
   envConfig.js — Loads .env, exposes typed config with safe
   defaults and production fail-fast validation.
   ============================================================ */

const path = require('path');
const fs = require('fs');

// Try loading from project root first, then backend folder
const rootEnv = path.join(__dirname, '..', '..', '..', '.env');
const backendEnv = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
}
if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
}

const env = process.env;

const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production';

const DEFAULT_JWT_SECRET = 'Nyay Setu-dev-secret-change-me';

const config = {
  env: isProd ? 'production' : 'development',
  isProd,
  demoRegistrationEnabled: String(env.DEMO_REGISTRATION_ENABLED || (isProd ? 'false' : 'true')) === 'true',
  port: parseInt(env.PORT || '3000', 10),
  host: env.HOST || '0.0.0.0',

  // Auth / crypto
  jwtSecret: env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: parseInt(env.BCRYPT_ROUNDS || '10', 10),
  otpBcryptRounds: parseInt(env.OTP_BCRYPT_ROUNDS || '10', 10),

  // Session cookie (HttpOnly + Secure in production) — the JWT never
  // needs to touch JavaScript or URLs.
  cookie: {
    name: env.SESSION_COOKIE_NAME || 'lc_session',
    secure: String(env.COOKIE_SECURE || (isProd ? 'true' : 'false')) === 'true',
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE || 'lax',
    maxAgeMs: parseDurationMs(env.JWT_EXPIRES_IN || '24h', 24 * 60 * 60 * 1000)
  },

  // Data layer (stored in user home directory to prevent Live Server from reloading the SPA)
  dataDir: env.DATA_DIR || path.join(require('os').homedir(), '.Nyay Setu_data'),
  uploadsDir: env.UPLOADS_DIR || path.join(require('os').homedir(), '.Nyay Setu_data', 'uploads'),

  // Uploads
  maxUploadBytes: parseInt(env.MAX_UPLOAD_MB || '10', 10) * 1024 * 1024,
  allowedUploadMime: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ],

  // Security policy (enforced by authService — see otpSendLog / verifyOTP)
  maxLoginAttempts: 5,
  lockDurationMs: 15 * 60 * 1000,
  otpExpiryMs: 5 * 60 * 1000,          // codes live 5 minutes
  otpMaxAttempts: 5,                   // consecutive wrong entries before the OTP locks
  otpResendCooldownMs: parseInt(env.OTP_RESEND_COOLDOWN_MS || '30000', 10), // 30s cooldown
  otpRateWindowMs: 15 * 60 * 1000,     // rolling window for flood protection
  otpMaxSendsPerWindow: parseInt(env.OTP_MAX_SENDS_PER_WINDOW || (isProd ? '5' : '20'), 10), // 20 sends per 15 min in dev

  // Outbound email — any ONE of these channels is enough.
  // Priority order: Resend → Brevo → SendGrid → SMTP(nodemailer).
  resendApiKey: env.RESEND_API_KEY || '',
  brevoApiKey: env.BREVO_API_KEY || '',
  sendgridApiKey: env.SENDGRID_API_KEY || '',
  smtp: {
    host: env.SMTP_HOST || '',
    port: parseInt(env.SMTP_PORT || '465', 10),
    secure: String(env.SMTP_SECURE || 'true') === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || ''
  },
  appBaseUrl: env.APP_BASE_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${parseInt(env.PORT || '3000')}`,
  resetTokenExpiryMs: 30 * 60 * 1000, // password-reset links

  // Platform economics
  platformFeePct: 0.10
};

/** Parses values like "24h", "15m", "30s" into milliseconds. */
function parseDurationMs(value, fallback) {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value || '').trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case 'ms': return n;
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 3600 * 1000;
    case 'd': return n * 86400 * 1000;
    default: return n * 1000; // bare number = seconds
  }
}

/**
 * Production fail-fast: refuse to boot an insecure deployment instead of
 * silently running with a known default secret and no email channel.
 */
function validateForEnvironment() {
  const problems = [];
  if (isProd) {
    if (!env.JWT_SECRET || config.jwtSecret.length < 32 || /^(change-me|Nyay Setu-dev)/i.test(config.jwtSecret)) {
      problems.push('JWT_SECRET must be set to a long random value in production.');
    }
    if (String(env.SEED_DEMO_DATA).toLowerCase() === 'true') {
      problems.push('SEED_DEMO_DATA must be false in production.');
    }
    if (!mailChannelConfigured()) {
      problems.push('Configure at least one email channel (RESEND_API_KEY / BREVO_API_KEY / SENDGRID_API_KEY / SMTP_*).');
    }
    if (!env.ADMIN_PASSWORD) {
      problems.push('ADMIN_PASSWORD must be provided in production (no defaults are used).');
    }
    if (env.RENDER === 'true') {
      if (env.STATE_STORE !== 'mysql' || !env.DB_HOST || !env.DB_USER || !env.DB_NAME || !env.DB_PASSWORD) {
        problems.push('Render requires STATE_STORE=mysql and an external DB_HOST/DB_USER/DB_NAME/DB_PASSWORD. Local files are ephemeral.');
      }
      if (env.DB_SSL !== 'true') problems.push('Render external database connections require DB_SSL=true.');
      if (!config.resendApiKey && !config.brevoApiKey && !config.sendgridApiKey) problems.push('Render free requires an HTTPS email API. SMTP ports are blocked.');
      if (!env.GEMINI_API_KEY) problems.push('GEMINI_API_KEY is required for the hosted chatbot and courtroom.');
      if (!/^https:\/\//.test(config.appBaseUrl)) problems.push('APP_BASE_URL or RENDER_EXTERNAL_URL must be an HTTPS URL.');
      if (!config.cookie.secure) problems.push('Secure cookies must remain enabled on Render.');
      if (env.DB_DISABLED === 'true') problems.push('DB_DISABLED cannot be true on Render.');
    }
  } else if (config.jwtSecret === DEFAULT_JWT_SECRET) {
    console.warn('[config] WARNING: using the development JWT_SECRET. Set JWT_SECRET in .env before deploying.');
  }
  if (problems.length) {
    console.error('\n[config] Refusing to start — fix the following production issues:');
    for (const p of problems) console.error('  - ' + p);
    console.error('');
    process.exit(1);
  }
}

/** True when at least one transactional email channel has credentials. */
function mailChannelConfigured() {
  return Boolean(
    config.resendApiKey ||
    config.brevoApiKey ||
    config.sendgridApiKey ||
    (config.smtp.host && config.smtp.user && config.smtp.pass)
  );
}

module.exports = config;
module.exports.validateForEnvironment = validateForEnvironment;
module.exports.mailChannelConfigured = mailChannelConfigured;
