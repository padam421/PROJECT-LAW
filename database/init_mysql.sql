-- ============================================================
-- LEGALCONNECT — MYSQL DATABASE INITIALIZATION SCRIPT
-- init_mysql.sql — Creates database and all required tables
-- for both Citizens/Users and Advocates/Lawyers.
-- ============================================================

CREATE DATABASE IF NOT EXISTS legalconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE legalconnect;

-- 1. USERS TABLE (Identity & Authentication)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  role ENUM('user', 'lawyer', 'admin') NOT NULL DEFAULT 'user',
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_google_auth BOOLEAN DEFAULT FALSE,
  account_status ENUM('active', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. USER PROFILES TABLE (Citizen / Client Profiles)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20),
  date_of_birth DATE,
  state VARCHAR(100),
  city VARCHAR(100),
  preferred_language VARCHAR(10) DEFAULT 'en',
  profile_photo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. LAWYER PROFILES TABLE (Advocate Details & Practice)
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  specialization VARCHAR(150) NOT NULL,
  experience_years INT DEFAULT 0,
  bar_council_id VARCHAR(100),
  courts_practiced TEXT,
  languages_spoken TEXT,
  consultation_fee DECIMAL(10,2) DEFAULT 500.00,
  rating DECIMAL(3,2) DEFAULT 4.80,
  total_reviews INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_photo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. CASES TABLE (Client Legal Issues & Files)
CREATE TABLE IF NOT EXISTS cases (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lawyer_id VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  description TEXT,
  court_name VARCHAR(150),
  location VARCHAR(100),
  status ENUM('new', 'ongoing', 'resolved', 'closed') DEFAULT 'ongoing',
  next_hearing_date DATE,
  next_hearing_time VARCHAR(50),
  next_hearing_purpose VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. CONSULTATIONS TABLE (Bookings & Video Calls)
CREATE TABLE IF NOT EXISTS consultations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lawyer_id VARCHAR(64) NOT NULL,
  case_id VARCHAR(64),
  consult_date DATE NOT NULL,
  consult_time VARCHAR(50) NOT NULL,
  consult_mode ENUM('video', 'audio', 'inperson') DEFAULT 'video',
  status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
  fee DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 50.00,
  total_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  summary_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. CASE DOCUMENTS & VAULT TABLE
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  case_id VARCHAR(64),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size VARCHAR(50),
  file_category VARCHAR(100),
  privacy ENUM('private', 'shared') DEFAULT 'private',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type ENUM('hearing', 'lawyer', 'document', 'payment', 'security') NOT NULL,
  title VARCHAR(150),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
