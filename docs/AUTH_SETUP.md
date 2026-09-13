# Nyay Setu — Email OTP Authentication: Setup Guide

Production-grade **Email + Password + 6-Digit Numeric Email OTP** verification & login.
Everything below is already implemented and wired end-to-end — this guide only covers
configuration and running it.

---

## What is enforced (real-world behaviour)

| Rule | Value | Where |
|---|---|---|
| OTP generation | `crypto.randomInt(100000, 999999)` (CSPRNG) | `backend/src/services/authService.js` |
| OTP storage | bcrypt hash only — raw code never stored/logged/returned | `otpChallenges.hashedOtp` |
| OTP expiry | 5 minutes, single-use (`isUsed`) | `config.otpExpiryMs` |
| Wrong attempts | Code locks after **5** consecutive wrong entries | `config.otpMaxAttempts` |
| Resend cooldown | **60 s** minimum between two sends to the same address | `config.otpResendCooldownMs` |
| Flood limit | Max **3 OTP emails / address / rolling 15 min** → HTTP 429 + retry time | `checkSendAllowance()` |
| Passwords | bcrypt (cost 10), ≥8 chars with letters+numbers | `registerInitiate` |
| Session | JWT inside an **HttpOnly + Secure cookie** (`lc_session`) | `setAuthCookie()` |
| Login lockout | 5 wrong passwords → 15-minute account lock | `login()` |

---

## 1. Configure an email channel (pick ONE)

Open `.env` in the project root. Channels are tried in this order:
**Resend → Brevo → SendGrid → SMTP.**

### Option A — Resend (recommended, fastest)
1. Sign up at <https://resend.com> → **API Keys** → *Create API Key*.
2. Put it in `.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   MAIL_FROM=Nyay Setu <onboarding@resend.dev>
   ```
3. `onboarding@resend.dev` works for **testing only**. For production:
   add & verify your domain under **Domains**, then set
   `MAIL_FROM=Nyay Setu <no-reply@yourdomain.com>`.

### Option B — Brevo (300 free emails/day)
1. Sign up at <https://brevo.com> → SMTP & API → **Generate API key**.
2. ```
   BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxx
   MAIL_FROM=Nyay Setu <you@yourdomain.com>
   ```
   The sender address must be added/verified in Brevo → Senders.

### Option C — SendGrid (100 free emails/day)
1. <https://sendgrid.com> → Settings → Sender Authentication (verify a single sender or domain).
2. Settings → API Keys → *Create* with **Mail Send** permission.
3. ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx
   MAIL_FROM=Nyay Setu <you@yourdomain.com>
   ```

### Option D — Gmail over SMTP
1. Enable **2-Step Verification** on the Google account.
2. Google Account → Security → **App passwords** → create one for "Mail".
3. ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=you@gmail.com
   SMTP_PASS=<16-character App Password>   # NOT your login password
   MAIL_FROM=Nyay Setu <you@gmail.com>
   ```

> Until any channel is configured, the server runs in dev fallback mode:
> OTPs are printed **only in the server console** — never through the API.

---

## 2. Run locally

```bash
cd backend
npm install          # installs express, bcryptjs, cookie-parser, nodemailer, ...
npm start            # http://localhost:3000  (advocate portal)
# admin review desk: http://localhost:3000/admin
```

Set a strong secret before deploying:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 3. The user flows (as wired in the UI)

**Registration**
1. `#/register` → Step 1: **Email + Password (+confirm)** → `POST /api/auth/register-initiate`.
2. `#/otp` screen: six digit boxes (auto-advance, paste-all, Enter/auto-submit),
   live countdown synced to server expiry, Resend button disabled until the
   60-second cooldown elapses → verify via `POST /api/auth/otp/verify`.
3. Email verified ✓ → session cookie issued → profile form (personal + Bar Council
   credentials) → `POST /api/auth/register-complete` → verification pipeline.

**Login**
1. `#/login` email/mobile + password → `POST /api/auth/login`.
2. 6-digit code emailed → `POST /api/auth/otp/verify` → HttpOnly cookie session.
3. New device? → confirmation screen; "This wasn't me" kills all sessions.

**Password reset** — `POST /api/auth/forgot-password` emails a single-use,
30-minute reset link (requires a configured email channel).

---

## 4. API summary

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register-initiate` | `{email, password}` → emails OTP |
| `POST /api/auth/verify-otp` *(alias `/api/auth/otp/verify`)* | `{challengeId, otp}` → verifies, marks verified, sets cookie |
| `POST /api/auth/resend-otp` *(alias `/api/auth/otp/resend`)* | resend after 60 s, max 3 / 15 min |
| `POST /api/auth/register-complete` | profile details after verification |
| `POST /api/auth/login` | credentials → OTP challenge (2FA) |
| `GET  /api/auth/session` | current user from cookie/bearer |

Error responses carry machine-readable reasons the UI acts on:
`rate_limited`, `cooldown`, `email_unavailable`, plus `retryAfterMs`.

---

## 5. Production checklist

- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_SECRET` (server **refuses to boot** without it)
- [ ] `ADMIN_PASSWORD` set explicitly
- [ ] Domain-verified `MAIL_FROM`
- [ ] HTTPS enabled → cookies automatically become `Secure`
- [ ] `SEED_DEMO_DATA=false`
- [ ] Swap the JSON store for PostgreSQL using `database/migrations/001_initial_schema.sql` (mirrors 1:1)
