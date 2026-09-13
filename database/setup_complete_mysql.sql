-- ============================================================
-- LEGALCONNECT — COMPLETE MYSQL DATABASE SETUP
-- Database: legalconnect
-- Supports User & Lawyer Portals, Real-time Auth, Profiles,
-- Cases, Consultations, Documents, and Notifications.
-- ============================================================

CREATE DATABASE IF NOT EXISTS legalconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE legalconnect;

-- 1. USERS TABLE (Core Authentication & Credentials)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  role ENUM('user', 'lawyer', 'admin') NOT NULL DEFAULT 'user',
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(20) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_verified TINYINT(1) DEFAULT 0,
  is_google_auth TINYINT(1) DEFAULT 0,
  account_status ENUM('active', 'suspended', 'restricted_pending_investigation') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CLIENT / USER PROFILES
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  preferred_language VARCHAR(20) DEFAULT 'en',
  profile_photo LONGTEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. LAWYER / ADVOCATE PROFILES
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  professional_name VARCHAR(150) DEFAULT NULL,
  specialization VARCHAR(150) NOT NULL,
  additional_specializations TEXT DEFAULT NULL,
  experience_years INT DEFAULT 0,
  bar_council_id VARCHAR(100) DEFAULT NULL,
  state_bar_council VARCHAR(100) DEFAULT NULL,
  courts_practiced TEXT DEFAULT NULL,
  languages_spoken TEXT DEFAULT NULL,
  consultation_fee DECIMAL(10,2) DEFAULT 500.00,
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_reviews INT DEFAULT 0,
  is_verified TINYINT(1) DEFAULT 0,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  profile_photo LONGTEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lawyer_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. OTP CHALLENGES (Real-time email OTP verification)
CREATE TABLE IF NOT EXISTS otp_challenges (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) DEFAULT NULL,
  email VARCHAR(191) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'registration',
  hashed_otp VARCHAR(255) NOT NULL,
  raw_otp VARCHAR(10) DEFAULT NULL,
  attempts_count INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  is_used TINYINT(1) DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email (email),
  INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SESSIONS TABLE (Active login sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  device_info JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revoked TINYINT(1) DEFAULT 0,
  INDEX idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. CASES TABLE (Litigation briefs, client-lawyer assignments)
CREATE TABLE IF NOT EXISTS cases (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lawyer_id VARCHAR(64) DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  court_name VARCHAR(150) DEFAULT NULL,
  location VARCHAR(100) DEFAULT NULL,
  status ENUM('new', 'ongoing', 'resolved', 'closed') DEFAULT 'new',
  next_hearing_date DATE DEFAULT NULL,
  next_hearing_time VARCHAR(50) DEFAULT NULL,
  next_hearing_purpose VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cases_user (user_id),
  INDEX idx_cases_lawyer (lawyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. CONSULTATIONS TABLE (Virtual & In-person appointments)
CREATE TABLE IF NOT EXISTS consultations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lawyer_id VARCHAR(64) NOT NULL,
  case_id VARCHAR(64) DEFAULT NULL,
  consult_date DATE NOT NULL,
  consult_time VARCHAR(50) NOT NULL,
  consult_mode ENUM('video', 'audio', 'inperson') DEFAULT 'video',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  fee DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  platform_fee DECIMAL(10,2) DEFAULT 50.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 550.00,
  notes TEXT DEFAULT NULL,
  summary_json JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_consult_user (user_id),
  INDEX idx_consult_lawyer (lawyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. DOCUMENTS TABLE (Case documents, IDs, Bar certificates)
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  case_id VARCHAR(64) DEFAULT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size VARCHAR(50) DEFAULT NULL,
  file_category VARCHAR(100) DEFAULT 'other',
  privacy ENUM('private', 'shared') DEFAULT 'shared',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_docs_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. NOTIFICATIONS TABLE (Alerts & Reminders)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'lawyer',
  title VARCHAR(150) DEFAULT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- QUICK VERIFICATION & INSPECTION QUERIES (Run in MySQL Workbench)
-- ============================================================
-- 1. View all registered accounts:
-- SELECT id, role, email, phone, is_verified, account_status, created_at FROM users ORDER BY created_at DESC;

-- 2. View client / user profile details:
-- SELECT u.email, up.full_name, up.mobile, up.city, up.state, up.date_of_birth FROM users u JOIN user_profiles up ON u.id = up.user_id;

-- 3. View advocate / lawyer profile details:
-- SELECT u.email, lp.full_name, lp.specialization, lp.bar_council_id, lp.experience_years, lp.courts_practiced FROM users u JOIN lawyer_profiles lp ON u.id = lp.user_id;

-- 4. View latest live OTP challenges sent to Gmail:
-- SELECT id, email, purpose, raw_otp, is_used, expires_at, created_at FROM otp_challenges ORDER BY created_at DESC LIMIT 20;

-- 5. View active authenticated login sessions:
-- SELECT s.id, u.email, u.role, s.device_info, s.created_at, s.last_seen_at, s.revoked FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.revoked = 0;
