# Nyay Setu

AI-Powered Advocate Portal & Virtual Court Platform — a legal-tech
platform where verified advocates manage clients, cases,
consultations and earnings.

Live website: **[nyay-setu-4aik.onrender.com](https://nyay-setu-4aik.onrender.com/)**.
Free Render hosting setup and operating limits: [deployment guide](docs/render-deployment.md).
Both portals use that deployment: [User / Client](https://nyay-setu-4aik.onrender.com/frontend/user/index.html)
and [Lawyer / Advocate](https://nyay-setu-4aik.onrender.com/frontend/lawyer/index.html).
The same signed-in account can use both workspaces. Chats and files stay scoped to that
account; tool access does not grant administrator powers or professional verification.
New accounts can use research and hearing practice after email verification; professional
profile completion is optional for using those tools.

## Repository layout

| Path | Purpose |
|---|---|
| `frontend/lawyer/` | Advocate portal SPA (vanilla JS + glassmorphism design system) |
| `frontend/admin/` | Verification desk console for admin reviewers |
| `frontend/user/` | Client portal, AI assistant and virtual court preparation |
| `frontend/shared/` | Design tokens, components, router, store, auth manager |
| `backend/src/` | Express API: auth/2FA, verification pipeline, workspace sync |
| `database/` | Hosted MySQL schema plus historical schema/migration mirrors |
| `ai-service/` | Python AI APIs, packaged precedent search and advocate research/rehearsal |

## Quick start

```bash
cd backend
npm install
npm start          # http://localhost:3000 → advocate portal
```

1. Open the portal and choose **Lawyer / Advocate → Start Advocate Registration**.
2. **Step 1:** email + password → a 6-digit verification code is emailed instantly.
3. **Step 2:** enter the code on the OTP screen (six boxes with paste support,
   live 5-minute countdown, resend unlocks after 60 s).
4. Email verified ✓ — complete your professional profile, then you're in.
5. Every later sign-in: password → fresh emailed OTP (2FA), session held in an
   HttpOnly secure cookie.

Full configuration walkthrough: **[docs/AUTH_SETUP.md](docs/AUTH_SETUP.md)**.

### Enabling real email delivery

Any ONE transactional channel is enough — priority order:
**Resend API → Brevo API → SendGrid API → SMTP** (`nodemailer`).

```ini
# e.g. Resend (resend.com):
RESEND_API_KEY=re_xxxxxxxxxxxx
MAIL_FROM=Nyay Setu <no-reply@yourdomain.com>   # domain verified in provider

# or Gmail SMTP:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=<Google App Password>
MAIL_FROM=Nyay Setu <you@gmail.com>
APP_BASE_URL=http://localhost:3000
```

Until a channel is configured, dev mode prints codes to the **server console
only** — they are never returned by the API.

### Security guarantees (enforced server-side)

- CSPRNG codes via `crypto.randomInt(100000, 999999)`; stored only as bcrypt hashes
- 5-minute expiry, single-use, lockout after 5 wrong entries
- Max 3 OTP emails / address / rolling 15 min + 60-second resend cooldown
- JWT sessions in HttpOnly + Secure cookies (no tokens in JS storage or URLs)
- Login lockout (5 fails → 15 min), enumeration-safe password reset

### Verification desk (admin)

The review console lives at `/admin`. Bootstrap credentials come from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` — production refuses to boot
without an explicit password. Demo/sample data is **disabled by default**;
set `SEED_DEMO_DATA=true` on an empty database only if you want sample content.

## Data layer

Development uses an atomic file-backed JSON store
(`backend/data/db.json`) that mirrors the relational model 1:1.
For production PostgreSQL:

```bash
psql -d Nyay Setu -f database/migrations/001_initial_schema.sql
psql -d Nyay Setu -f database/seeders/demo_data.sql
```

## Environment

Copy `.env.example` → `.env` and set at minimum `JWT_SECRET`
before any deployment. See `.env.example` for all options
(`PORT`, `BCRYPT_ROUNDS`, `MAX_UPLOAD_MB`, …).
