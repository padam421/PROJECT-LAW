-- ============================================================
-- LEGALCONNECT — SCHEMA: IDENTITY & ACCOUNT SECURITY
-- users.sql — Accounts, advocate profiles, devices, sessions,
-- OTP challenges and login activity.
--
-- This DDL is the production mirror of the file-backed JSON
-- driver (backend/src/config/dbConfig.js). Collection names in
-- the JSON DB map to these tables 1:1 so the data layer can be
-- swapped without touching service code.
--
-- Engine assumption: PostgreSQL 14+
-- ============================================================

-- ------------------------------------------------------------
-- users — every authentication identity (advocates AND admins)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,                       -- 'law_*' | 'adm_*' (db.uid prefix)
  role                  TEXT NOT NULL DEFAULT 'lawyer'
                        CHECK (role IN ('lawyer', 'admin')),
  email                 TEXT UNIQUE NOT NULL,                   -- stored lowercase
  email_hash            CHAR(32) NOT NULL,                      -- sha256[:32] duplicate-detection join
  phone                 VARCHAR(15),
  phone_normalized      VARCHAR(10) UNIQUE,                     -- digits only after +91 strip
  phone_hash            CHAR(32),
  password_hash         TEXT NOT NULL,                          -- bcrypt, cost from env BCRYPT_ROUNDS
  password_change_required BOOLEAN NOT NULL DEFAULT FALSE,

  -- Email verification (6-digit OTP) & signup lifecycle
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  registration_stage    TEXT NOT NULL DEFAULT 'complete'
                        CHECK (registration_stage IN ('awaiting_otp','awaiting_profile','complete')),

  -- Lifecycle / access control
  account_status        TEXT NOT NULL DEFAULT 'active'
                        CHECK (account_status IN ('active','suspended','restricted_pending_investigation')),
  sensitive_actions_locked_until TIMSTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role       ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users (email_hash);

-- ------------------------------------------------------------
-- lawyer_profiles — 1:1 extension carrying advocate-only fields
-- (personal + statutory credentials + public portfolio state)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Identity (compared against official documents during review)
  full_legal_name        VARCHAR(120) NOT NULL,
  professional_name      VARCHAR(120),
  gender                 TEXT CHECK (gender IN ('Male','Female','Other')),
  -- Minimum 21 years of age is enforced at registration time
  -- (authService fraud signal 'underage_dob'); kept out of CHECK because
  -- CURRENT_DATE is non-immutable and rejected in table constraints.
  date_of_birth          DATE NOT NULL,
  address                VARCHAR(250),
  city                   VARCHAR(80),
  state                  VARCHAR(80),
  profile_photo          TEXT,                                  -- data URL ≤1MB (moves to object storage in prod)

  -- Statutory credentials (hash kept for duplicate detection)
  bar_council_number     VARCHAR(30) NOT NULL,                  -- 'XX/NUMBER/YEAR'
  bar_number_hash        CHAR(32) NOT NULL,
  state_bar_council      VARCHAR(120) NOT NULL,
  enrollment_date        DATE NOT NULL,
  enrollment_year        SMALLINT CHECK (enrollment_year BETWEEN 1950 AND 2100),

  -- Education & practice
  qualification          VARCHAR(160) NOT NULL,
  university             VARCHAR(200) NOT NULL,
  years_of_practice      SMALLINT NOT NULL CHECK (years_of_practice BETWEEN 0 AND 60),
  practice_type          VARCHAR(120) NOT NULL,

  -- Public portfolio
  bio                    TEXT NOT NULL DEFAULT '',
  primary_specialization VARCHAR(80) NOT NULL,
  additional_specializations JSONB NOT NULL DEFAULT '[]',       -- array of strings
  courts                 JSONB NOT NULL DEFAULT '[]',
  languages              JSONB NOT NULL DEFAULT '[]',

  -- Verification outcome (fast-path copy of verification_records verdict)
  verification_status    TEXT NOT NULL DEFAULT 'pending'
                         CHECK (verification_status IN ('pending','verified','rejected','info_mismatch','manual_review')),
  verification_id        VARCHAR(40) UNIQUE,                    -- 'LC-VER-YYYY-NNNN' once approved
  verification_date      DATE,
  rating                 NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  total_reviews          INTEGER NOT NULL DEFAULT 0,
  profile_deactivated    BOOLEAN NOT NULL DEFAULT FALSE,        -- paused: hidden from new bookings

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_lawyer_bar_hash UNIQUE (bar_number_hash)
);

-- One verified account per Bar Council registration is enforced at the
-- application layer during approval (see verification_records); this unique
-- hash index above makes accidental double-inserts impossible at rest.

CREATE INDEX IF NOT EXISTS idx_lawyer_ver_status ON lawyer_profiles (verification_status);

-- ------------------------------------------------------------
-- trusted_devices — remembered devices after new-device confirmation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trusted_devices (
  id           TEXT PRIMARY KEY,                                -- 'dev_*'
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    VARCHAR(64) NOT NULL,                            -- browser-stable X-LC-Device value
  device_type  VARCHAR(16) NOT NULL DEFAULT 'Desktop',
  browser      VARCHAR(40) NOT NULL DEFAULT 'Unknown browser',
  os           VARCHAR(60) NOT NULL DEFAULT 'Unknown OS',
  location     VARCHAR(120) DEFAULT 'India (approx.)',
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, device_id)
);

-- ------------------------------------------------------------
-- auth_sessions — server-side session records backing JWT 'sid'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
  id           TEXT PRIMARY KEY,                                -- 'sess_*'
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device       JSONB NOT NULL DEFAULT '{}',                     -- getDeviceProfile() snapshot
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  expired      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON auth_sessions (user_id) WHERE revoked = FALSE;

-- ------------------------------------------------------------
-- otp_challenges — bcrypt-hashed 6-digit codes; raw codes are
-- never stored, logged, or returned by the API.
-- Mirrors a Redis key `otp:${email}:${purpose}` semantics with a
-- 5-minute TTL, max-attempt lockout and single-use consumption.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_challenges (
  id          TEXT PRIMARY KEY,                                 -- 'otp_*'
  key         VARCHAR(120) UNIQUE,                              -- 'otp:${email}:${purpose}'
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'login'
              CHECK (purpose IN ('login','registration')),
  hashed_otp  TEXT NOT NULL,                                    -- bcrypt(6-digit code)
  device      JSONB NOT NULL DEFAULT '{}',
  is_new_device BOOLEAN NOT NULL DEFAULT FALSE,
  attempts    SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 5,                      -- wrong entries before the code locks
  expires_at  TIMESTAMPTZ NOT NULL,                             -- created_at + 5 minutes
  is_used     BOOLEAN NOT NULL DEFAULT FALSE,                   -- consumed or locked
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                -- powers the 60s resend cooldown
);

CREATE INDEX IF NOT EXISTS idx_otp_open ON otp_challenges (user_id, purpose) WHERE is_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_otp_email_recent ON otp_challenges (email, last_sent_at DESC);

-- ------------------------------------------------------------
-- otp_sends — rolling-window flood control log per address
-- (max 3 sends / email / 15 minutes). Rows outside the window
-- are pruned by the application after use.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_sends (
  id        TEXT PRIMARY KEY,                                   -- 'osend_*'
  email_key TEXT NOT NULL,                                      -- lowercased recipient address
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_sends_window ON otp_sends (email_key, sent_at DESC);

-- ------------------------------------------------------------
-- login_activity — audit trail powering lockout & Security Center
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_activity (
  id               TEXT PRIMARY KEY,                            -- 'act_*'
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  identifier_tried VARCHAR(64),                                 -- only when no account matched
  type             TEXT NOT NULL CHECK (type IN
                   ('login','login_failed','login_blocked','login_new_device','logout',
                    'device_trusted','device_revoked','otp_locked','document_uploaded',
                    'registration_initiated')),
  description      TEXT NOT NULL,
  result           TEXT NOT NULL DEFAULT 'success',
  device           JSONB NOT NULL DEFAULT '{}',
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_time ON login_activity (user_id, timestamp DESC);

-- Lockout query support: failed logins per user inside the window
CREATE INDEX IF NOT EXISTS idx_activity_failed_recent
  ON login_activity (user_id, timestamp DESC)
  WHERE type = 'login_failed';
