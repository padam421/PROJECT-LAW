/* ============================================================
   LEGALCONNECT — TRANSACTIONAL MAIL SERVICE
   mailService.js — Real SMTP delivery for OTP codes and
   password-reset links via nodemailer.
   ------------------------------------------------------------
   Configuration (.env):
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=465
     SMTP_SECURE=true
     SMTP_USER=you@gmail.com
     SMTP_PASS=<Gmail App Password — never the account password>
     MAIL_FROM="LegalConnect <you@gmail.com>"
     APP_BASE_URL=http://localhost:3000

   When SMTP is not configured, isConfigured() returns false and
   callers fall back to development-only code surfacing. Nothing
   here pretends an email was sent if it wasn't.
   ============================================================ */

const nodemailer = require('nodemailer');
const config = require('../config/envConfig');

let _transporter = null;

function transporter() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass }
    });
  }
  return _transporter;
}

function isConfigured() {
  return !!transporter();
}

/** Sends mail; resolves {sent, error}. Never throws into request path. */
async function send({ to, subject, html, text }) {
  const tx = transporter();
  if (!tx) return { sent: false, error: 'SMTP not configured' };
  try {
    await tx.sendMail({
      from: config.smtp.from || config.smtp.user,
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

function otpEmailHtml(code, minutesValid) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1a2744;margin:0 0 4px">LegalConnect</h2>
    <p style="color:#4b5563;margin:0 0 20px">Your sign-in verification code</p>
    <div style="background:#f1f5f9;border-radius:14px;padding:24px;text-align:center;margin-bottom:16px">
      <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0d9488">${code}</span>
    </div>
    <p style="color:#6b7280;font-size:14px">This code expires in ${minutesValid} minutes. If you didn't request it, ignore this email — your account stays secure.</p>
  </div>`;
}

function resetEmailHtml(link, minutesValid) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1a2744;margin:0 0 4px">LegalConnect</h2>
    <p style="color:#4b5563;margin:0 0 20px">Password reset requested</p>
    <p style="margin-bottom:20px">
      <a href="${link}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;
         padding:13px 28px;border-radius:999px;font-weight:700">Reset My Password</a>
    </p>
    <p style="color:#6b7280;font-size:14px">This link works once and expires in ${minutesValid} minutes.<br>
    If you didn't request a reset, your account is safe — no changes were made.</p>
  </div>`;
}

module.exports = { isConfigured, send, otpEmailHtml, resetEmailHtml };
