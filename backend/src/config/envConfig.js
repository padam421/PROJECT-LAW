/* ============================================================
   LEGALCONNECT — ENVIRONMENT CONFIGURATION
   envConfig.js — Loads .env, exposes typed config with safe defaults
   ============================================================ */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = process.env;

const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production';

const config = {
  env: isProd ? 'production' : 'development',
  isProd,
  port: parseInt(env.PORT || '3000', 10),
  host: env.HOST || '0.0.0.0',

  // Auth / crypto
  jwtSecret: env.JWT_SECRET || 'legalconnect-dev-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: parseInt(env.BCRYPT_ROUNDS || '10', 10),

  // Data layer (file-backed JSON database; swap for PostgreSQL in production)
  dataDir: path.join(__dirname, '..', '..', 'data'),
  uploadsDir: path.join(__dirname, '..', '..', 'data', 'uploads'),

  // Uploads
  maxUploadBytes: parseInt(env.MAX_UPLOAD_MB || '10', 10) * 1024 * 1024,
  allowedUploadMime: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ],

  // Security policy
  maxLoginAttempts: 5,
  lockDurationMs: 15 * 60 * 1000,
  otpExpiryMs: 5 * 60 * 1000,
  otpMaxAttempts: 5,

  // Outbound email (real SMTP delivery when configured)
  smtp: {
    host: env.SMTP_HOST || '',
    port: parseInt(env.SMTP_PORT || '465', 10),
    secure: String(env.SMTP_SECURE || 'true') === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || ''
  },
  appBaseUrl: env.APP_BASE_URL || `http://localhost:${parseInt(env.PORT || '3000', 10)}`,
  resetTokenExpiryMs: 30 * 60 * 1000, // password-reset links

  // Platform economics
  platformFeePct: 0.10
};

module.exports = config;
