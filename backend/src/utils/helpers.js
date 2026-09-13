/* ============================================================
   Nyay Setu — VALIDATION & SHARED HELPERS
   ============================================================ */

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const BAR_RE = /^[A-Z]{2}\/[A-Za-z0-9]+\/\d{4}$/;

function validateEmail(email) {
  return EMAIL_RE.test(String(email || '').toLowerCase());
}

function validatePhone(phone) {
  return PHONE_RE.test(String(phone || '').replace(/[\s\-+]/g, '').replace(/^91/, ''));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-+]/g, '').replace(/^91/, '');
}

function validateBarNumber(bar) {
  if (!BAR_RE.test(String(bar || '').trim().toUpperCase())) return false;
  const year = parseInt(String(bar).trim().split('/').pop(), 10);
  const currentYear = new Date().getFullYear();
  return year >= 1950 && year <= currentYear;
}

function validatePassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/** Field-by-field validator. Returns { ok, errors: {field: message} } */
function validateBody(schema, body) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    const raw = body[field];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${rules.label || field} is required`;
      continue;
    }
    if (value === undefined || value === null || value === '') continue; // optional & empty
    if (rules.type === 'email' && !validateEmail(value)) errors[field] = 'Enter a valid email address';
    if (rules.type === 'phone' && !validatePhone(value)) errors[field] = 'Enter a valid 10-digit Indian mobile number';
    if (rules.type === 'bar' && !validateBarNumber(value)) errors[field] = 'Format must be XX/NUMBER/YEAR (e.g. DL/1234/2010)';
    if (rules.type === 'date') {
      const d = new Date(value);
      if (isNaN(d.getTime())) errors[field] = 'Enter a valid date';
    }
    if (rules.type === 'number') {
      const n = Number(value);
      if (isNaN(n)) errors[field] = 'Must be a number';
      else if (rules.min !== undefined && n < rules.min) errors[field] = `Minimum is ${rules.min}`;
      else if (rules.max !== undefined && n > rules.max) errors[field] = `Maximum is ${rules.max}`;
    }
    if (rules.maxLength && String(value).length > rules.maxLength) errors[field] = `Maximum ${rules.maxLength} characters`;
    if (rules.enum && !rules.enum.includes(value)) errors[field] = 'Invalid selection';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '•••••';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}••@${domain}`;
  return `${user[0]}${'•'.repeat(Math.min(user.length - 2, 4))}${user[user.length - 1]}@${domain}`;
}

function maskPhone(phone) {
  const p = normalizePhone(phone);
  if (p.length < 4) return '••••••••';
  return `${'•'.repeat(p.length - 4)}${p.slice(-4)}`;
}

function sha256Short(input) {
  // Lightweight non-reversible reference hash for duplicate-detection joins.
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(input).toLowerCase().trim()).digest('hex').slice(0, 32);
}

module.exports = {
  validateEmail,
  validatePhone,
  validateBarNumber,
  validatePassword,
  validateBody,
  maskEmail,
  maskPhone,
  normalizePhone,
  sha256Short
};
