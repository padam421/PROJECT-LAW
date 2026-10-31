/* ============================================================
   Nyay Setu — TRANSACTIONAL MAIL SERVICE
   mailService.js — Real OTP & password-reset delivery through
   any ONE configured channel. Priority order:
     1. Resend API        (RESEND_API_KEY)
     2. Brevo API         (BREVO_API_KEY)      [ex-Sendinblue]
     3. SendGrid API      (SENDGRID_API_KEY)
     4. SMTP / nodemailer (SMTP_HOST/USER/PASS — Gmail etc.)
   ------------------------------------------------------------
   All HTTP providers are used via their plain REST endpoints so
   no extra SDKs are required. Delivery to Gmail, Yahoo, Outlook
   and custom domains works worldwide on every channel.
   When NO channel is configured, isConfigured() is false and
   callers log codes to the server console in development only.
   Nothing here pretends an email was sent if it wasn't.
   ============================================================ */

const nodemailer = require('nodemailer');
const config = require('../config/envConfig');

let _transporter = null;

/* ---------------- Channel detection ---------------- */

function activeChannel() {
  if (config.resendApiKey) return 'resend';
  if (config.brevoApiKey) return 'brevo';
  if (config.sendgridApiKey) return 'sendgrid';
  if (config.smtp.host && config.smtp.user && config.smtp.pass) return 'smtp';
  return null;
}

function transporter() {
  if (activeChannel() !== 'smtp') return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }
  return _transporter;
}

function isConfigured() {
  return activeChannel() !== null;
}

function defaultFrom() {
  const smtpFrom = config.smtp.from || config.smtp.user;
  return smtpFrom || 'Nyay Setu <no-reply@Nyay Setu.in>';
}

/* ---------------- Delivery ---------------- */

/** Sends mail; resolves {sent, provider, error}. Never throws into request path. */
async function send({ to, subject, html, text }) {
  const channel = activeChannel();
  if (!channel) return { sent: false, error: 'No email channel configured' };
  try {
    switch (channel) {
      case 'resend': return await sendViaResend({ to, subject, html, text });
      case 'brevo': return await sendViaBrevo({ to, subject, html, text });
      case 'sendgrid': return await sendViaSendGrid({ to, subject, html, text });
      case 'smtp': return await sendViaSmtp({ to, subject, html, text });
      default: return { sent: false, error: 'Unknown channel' };
    }
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(12000),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: defaultFrom(), to: [to], subject, text, html })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, provider: 'resend' };
}

async function sendViaBrevo({ to, subject, html, text }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    signal: AbortSignal.timeout(12000),
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: parseSender(defaultFrom()),
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, provider: 'brevo' };
}

async function sendViaSendGrid({ to, subject, html, text }) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    signal: AbortSignal.timeout(12000),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: parseSender(defaultFrom()),
      subject,
      content: [
        { type: 'text/plain', value: text || '' },
        { type: 'text/html', value: html || '' }
      ]
    })
  });
  if (!res.ok && res.status !== 202) {
    const body = await res.text().catch(() => '');
    throw new Error(`SendGrid API ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, provider: 'sendgrid' };
}

async function sendViaSmtp({ to, subject, html, text }) {
  const tx = transporter();
  if (!tx) return { sent: false, error: 'SMTP not configured' };
  const from = defaultFrom();
  console.log(`[mail:smtp] Attempting delivery to ${to} from ${from}...`);
  const info = await tx.sendMail({
    from,
    to,
    replyTo: config.smtp.user,
    subject,
    text,
    html,
    priority: 'high',
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'High'
    }
  });
  console.log(`[mail:smtp] Email accepted by Gmail SMTP server for ${to}. Message-ID: ${info.messageId}`);
  return { sent: true, provider: 'smtp', messageId: info.messageId };
}

/** "Nyay Setu <you@domain>" → { name, email } for APIs that need structured senders. */
function parseSender(from) {
  const m = /^(.*)<([^>]+)>\s*$/.exec(String(from || '').trim());
  if (m) return { name: m[1].trim().replace(/^["']|["']$/g, '') || 'Nyay Setu', email: m[2].trim() };
  return { name: 'Nyay Setu', email: String(from || '').trim() };
}

/* ============================================================
   EMAIL TEMPLATES
   Dark-mode compatible: solid opaque surfaces + explicit text
   colors render correctly whether or not the client applies a
   dark theme. The code box keeps high contrast in both modes.
   ============================================================ */

const BRAND_BG = '#0b1220';        // deep navy card surface
const BRAND_SURFACE = '#131c30';   // inner panel
const BRAND_TEXT = '#e8edf7';      // near-white body text
const BRAND_MUTED = '#94a3b8';     // slate muted text
const BRAND_ACCENT = '#14b8a6';    // teal accent
const BRAND_CODE_TEXT = '#0b1220'; // dark digits on bright code chip

function pageWrap(inner) {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>Nyay Setu</title>
</head>
<body style="margin:0;padding:0;background-color:#070d18;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your Nyay Setu verification code</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#070d18;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:520px;background-color:${BRAND_BG};border-radius:20px;border:1px solid #1f2a44;overflow:hidden;">
        ${inner}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:18px 8px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#5b6b85;">
            You received this email because a verification code was requested for your Nyay Setu account.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function brandHeader() {
  return `
        <tr>
          <td style="padding:28px 32px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="padding-right:10px;vertical-align:middle;">
                  <div style="width:40px;height:40px;border-radius:12px;background-color:${BRAND_ACCENT};text-align:center;line-height:40px;font-size:22px;">&#9878;</div>
                </td>
                <td style="vertical-align:middle;text-align:left;">
                  <span style="font-size:19px;font-weight:bold;color:${BRAND_TEXT};letter-spacing:.4px;">Nyay Setu</span><br>
                  <span style="font-size:11px;color:${BRAND_MUTED};letter-spacing:1.5px;">ADVOCATE PORTAL</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/**
 * Responsive OTP email — clear branding, bold 6-digit code box with
 * large typography, expiry warning and security disclaimer.
 */
function otpEmailHtml(code, minutesValid) {
  return pageWrap(`
        ${brandHeader()}
        <tr>
          <td style="padding:26px 32px 0;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0;font-size:21px;line-height:28px;color:${BRAND_TEXT};">Verify your email address</h1>
            <p style="margin:10px 0 0;font-size:14px;line-height:22px;color:${BRAND_MUTED};">
              Use the secure code below to continue. It was sent because someone
              (hopefully you) started signing in or registering at Nyay Setu.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <div style="background-color:${BRAND_SURFACE};border:1px solid #24304e;border-radius:16px;padding:26px 16px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${BRAND_MUTED};letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">
                Your verification code
              </div>
              <div style="background-color:${BRAND_ACCENT};border-radius:14px;display:inline-block;padding:16px 34px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:42px;line-height:48px;font-weight:bold;
                             letter-spacing:12px;color:${BRAND_CODE_TEXT};">${code}</span>
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND_ACCENT};font-weight:bold;margin-top:14px;">
                Expires in ${minutesValid} minutes
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 32px 0;">
            <div style="border-left:3px solid #f59e0b;background-color:#171f33;border-radius:8px;padding:12px 16px;
                        font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:${BRAND_MUTED};">
              <strong style="color:#fbbf24;">Security notice:</strong> never share this code with anyone —
              Nyay Setu staff will NEVER ask for it. If you didn't request this code, ignore this email
              and your account will remain secure.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 30px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6b85;">
            Need help? Contact <a href="mailto:support@Nyay Setu.in" style="color:${BRAND_ACCENT};text-decoration:none;">support@Nyay Setu.in</a>
          </td>
        </tr>`);
}

/** Password reset email — same visual system as the OTP template. */
function resetEmailHtml(link, minutesValid) {
  return pageWrap(`
        ${brandHeader()}
        <tr>
          <td style="padding:26px 32px 0;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0;font-size:21px;line-height:28px;color:${BRAND_TEXT};">Reset your password</h1>
            <p style="margin:10px 0 0;font-size:14px;line-height:22px;color:${BRAND_MUTED};">
              We received a request to reset the password for your Nyay Setu account.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;text-align:center;">
            <a href="${link}" style="display:inline-block;background-color:${BRAND_ACCENT};color:${BRAND_CODE_TEXT};
               font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;
               padding:14px 34px;border-radius:999px;">Reset My Password</a>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:${BRAND_MUTED};text-align:center;">
            This link works once and expires in ${minutesValid} minutes.<br>
            If you didn't request a reset, your account is safe — no changes were made.
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 30px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6b85;">
            Button not working? Paste this link into your browser:<br>
            <a href="${link}" style="color:${BRAND_ACCENT};word-break:break-all;">${link}</a>
          </td>
        </tr>`);
}

module.exports = { isConfigured, send, otpEmailHtml, resetEmailHtml, activeChannel };
