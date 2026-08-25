# LegalConnect

AI-Powered Advocate Portal & Virtual Court Platform — a legal-tech
platform where verified advocates manage clients, cases,
consultations and earnings.

## Repository layout

| Path | Purpose |
|---|---|
| `frontend/lawyer/` | Advocate portal SPA (vanilla JS + glassmorphism design system) |
| `frontend/admin/` | Verification desk console for admin reviewers |
| `frontend/user/` | Client portal (coming soon — holding page) |
| `frontend/shared/` | Design tokens, components, router, store, auth manager |
| `backend/src/` | Express API: auth/2FA, verification pipeline, workspace sync |
| `database/` | PostgreSQL DDL mirror of the data layer (`schema/`, `migrations/`, `seeders/`) |
| `ai-service/` | Python microservice skeleton (planned client-side AI features) |

## Quick start

```bash
cd backend
npm install
npm start          # http://localhost:3000 → advocate portal
```

1. Open the portal and choose **Lawyer / Advocate**.
2. Click **Start Advocate Registration** and complete the two-step form.
3. Sign in with your registered email/mobile + password.
4. Complete two-factor verification — a 6-digit code is required after your password.

### Enabling real email delivery

Sign-in codes and password-reset emails are delivered over SMTP as soon as
you configure it in `.env`:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=<Google App Password>   # account → security → 2-step verification → app passwords
MAIL_FROM=LegalConnect <you@gmail.com>
APP_BASE_URL=http://localhost:3000
```

Until SMTP is configured, the server runs in development mode: OTP codes are
printed to the server console (and returned as `devOtp` outside production) so
you can still sign in locally. Password-reset email returns an explicit
"service not configured" error instead of pretending to send.

### Verification desk (admin)

The review console lives at `/admin`. Bootstrap credentials come from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` — override them before any real
deployment. Demo/sample data is **disabled by default**; set
`SEED_DEMO_DATA=true` on an empty database only if you want sample content.

## Data layer

Development uses an atomic file-backed JSON store
(`backend/data/db.json`) that mirrors the relational model 1:1.
For production PostgreSQL:

```bash
psql -d legalconnect -f database/migrations/001_initial_schema.sql
psql -d legalconnect -f database/seeders/demo_data.sql
```

## Environment

Copy `.env.example` → `.env` and set at minimum `JWT_SECRET`
before any deployment. See `.env.example` for all options
(`PORT`, `BCRYPT_ROUNDS`, `MAX_UPLOAD_MB`, …).
