/* ============================================================
   Nyay Setu — DATABASE ADAPTER SERVICE (MySQL + JSON Resilient Engine)
   dbService.js — Authoritative real-time MySQL repository with
   file-backed fallback for high availability.
   ============================================================ */

const path = require('path');
const fs = require('fs');
const db = require('../config/dbConfig');

// Load environment configuration
const rootEnv = path.join(__dirname, '..', '..', '..', '.env');
const backendEnv = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
}
if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
}

let mysqlPool = null;
let hasLoggedPoolSuccess = false;

function getMySQLPool() {
  if (mysqlPool) return mysqlPool;
  try {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Nyay Setu',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
    if (!hasLoggedPoolSuccess) {
      hasLoggedPoolSuccess = true;
      console.log(`[dbService] Connected to MySQL database "${process.env.DB_NAME || 'Nyay Setu'}" at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}`);
    }
    return mysqlPool;
  } catch (e) {
    console.error('[dbService] Failed to initialize MySQL connection pool:', e.message);
    return null;
  }
}

function safeDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function safeTimestamp(val) {
  if (!val) return new Date();
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

const DbService = {
  getMySQLPool,

  /* ---------------- User Operations ---------------- */
  async findUserByEmail(email) {
    const cleanEmail = String(email || '').toLowerCase().trim();
    if (!cleanEmail) return null;

    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
        if (rows.length > 0) {
          const u = rows[0];
          const userObj = {
            id: u.id,
            role: u.role || 'user',
            email: u.email,
            phone: u.phone || '',
            phoneNormalized: (u.phone || '').replace(/\D/g, ''),
            passwordHash: u.password_hash,
            password_hash: u.password_hash,
            isVerified: Boolean(u.is_verified),
            is_verified: u.is_verified,
            isGoogleAuth: Boolean(u.is_google_auth),
            accountStatus: u.account_status || 'active',
            account_status: u.account_status || 'active',
            createdAt: u.created_at,
            updatedAt: u.updated_at
          };

          // Fetch profile details
          const profile = await this.getUserProfile(u.id, u.role);
          if (profile) {
            userObj.fullName = profile.full_name || profile.fullName || '';
            userObj.city = profile.city || '';
            userObj.state = profile.state || '';
            userObj.dob = profile.date_of_birth || profile.dob || null;
            userObj.phone = profile.mobile || profile.phone || userObj.phone;
            userObj.phoneNormalized = (userObj.phone || '').replace(/\D/g, '');
            if (u.role === 'lawyer') {
              userObj.specialization = profile.specialization || '';
              userObj.barCouncil = profile.bar_council_id || '';
              userObj.courts = profile.courts_practiced ? (typeof profile.courts_practiced === 'string' ? profile.courts_practiced.split(', ') : profile.courts_practiced) : [];
              userObj.languages = profile.languages_spoken ? (typeof profile.languages_spoken === 'string' ? profile.languages_spoken.split(', ') : profile.languages_spoken) : [];
              userObj.consultationFee = profile.consultation_fee || 500;
              userObj.rating = profile.rating || 5.0;
              userObj.totalReviews = profile.total_reviews || 0;
            }
          }

          // Mirror into memory cache
          const data = db.get();
          data.users = data.users || [];
          const idx = data.users.findIndex(item => item.id === userObj.id || (item.email && item.email.toLowerCase() === cleanEmail));
          if (idx >= 0) data.users[idx] = { ...data.users[idx], ...userObj };
          else data.users.push(userObj);
          db.save();

          return idx >= 0 ? data.users[idx] : userObj;
        }
      } catch (err) {
        console.error('[dbService] findUserByEmail MySQL error:', err.message);
      }
    }

    const data = db.get();
    return (data.users || []).find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
  },

  async findUserById(userId) {
    if (!userId) return null;
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (rows.length > 0) {
          const u = rows[0];
          const userObj = {
            id: u.id,
            role: u.role || 'user',
            email: u.email,
            phone: u.phone || '',
            phoneNormalized: (u.phone || '').replace(/\D/g, ''),
            passwordHash: u.password_hash,
            password_hash: u.password_hash,
            isVerified: Boolean(u.is_verified),
            is_verified: u.is_verified,
            isGoogleAuth: Boolean(u.is_google_auth),
            accountStatus: u.account_status || 'active',
            account_status: u.account_status || 'active',
            createdAt: u.created_at,
            updatedAt: u.updated_at
          };

          const profile = await this.getUserProfile(u.id, u.role);
          if (profile) {
            userObj.fullName = profile.full_name || profile.fullName || '';
            userObj.city = profile.city || '';
            userObj.state = profile.state || '';
            userObj.dob = profile.date_of_birth || profile.dob || null;
            userObj.phone = profile.mobile || profile.phone || userObj.phone;
            userObj.phoneNormalized = (userObj.phone || '').replace(/\D/g, '');
          }

          const cached = (db.get().users || []).find(item => item.id === userObj.id);
          return cached ? { ...cached, ...userObj } : userObj;
        }
      } catch (err) {
        console.error('[dbService] findUserById MySQL error:', err.message);
      }
    }

    const data = db.get();
    return (data.users || []).find(u => u.id === userId) || null;
  },

  async createUser(user) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO users (id, role, email, phone, password_hash, is_verified, is_google_auth, account_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             role = VALUES(role),
             phone = VALUES(phone),
             password_hash = VALUES(password_hash),
             is_verified = VALUES(is_verified),
             account_status = VALUES(account_status),
             updated_at = NOW()`,
          [
            user.id,
            user.role || 'user',
            String(user.email).toLowerCase().trim(),
            user.phone || null,
            user.passwordHash || user.password_hash || '',
            user.isVerified ? 1 : 0,
            user.isGoogleAuth ? 1 : 0,
            user.accountStatus || 'active'
          ]
        );
        console.log(`[dbService] Real-time MySQL write: user ${user.id} (${user.email}) saved.`);
      } catch (err) {
        console.error('[dbService] createUser MySQL error:', err.message);
      }
    }

    const data = db.get();
    data.users = data.users || [];
    const idx = data.users.findIndex(u => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase()));
    if (idx >= 0) {
      data.users[idx] = { ...data.users[idx], ...user };
    } else {
      data.users.push(user);
    }
    db.save();
    return user;
  },

  async updateUserVerified(userId, isVerified = true) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('UPDATE users SET is_verified = ?, updated_at = NOW() WHERE id = ?', [isVerified ? 1 : 0, userId]);
        console.log(`[dbService] Real-time MySQL update: user ${userId} verified=${isVerified}`);
      } catch (err) {
        console.error('[dbService] updateUserVerified MySQL error:', err.message);
      }
    }
    const data = db.get();
    const user = (data.users || []).find(u => u.id === userId);
    if (user) {
      user.isVerified = !!isVerified;
      db.save();
    }
    return true;
  },

  async updateUserPassword(userId, passwordHash) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
        console.log(`[dbService] Real-time MySQL update: password hash updated for user ${userId}`);
      } catch (err) {
        console.error('[dbService] updateUserPassword MySQL error:', err.message);
      }
    }
    const data = db.get();
    const user = (data.users || []).find(u => u.id === userId);
    if (user) {
      user.passwordHash = passwordHash;
      db.save();
    }
    return true;
  },

  async updateUserProfile(userId, profileData = {}) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        const fullName = profileData.fullName || profileData.name || null;
        const phone = profileData.phone || profileData.mobile || null;
        const city = profileData.city || null;
        const state = profileData.state || null;

        if (fullName || phone || city || state) {
          await pool.query(`
            INSERT INTO user_profiles (user_id, full_name, mobile, city, state, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              full_name = COALESCE(VALUES(full_name), full_name),
              mobile = COALESCE(VALUES(mobile), mobile),
              city = COALESCE(VALUES(city), city),
              state = COALESCE(VALUES(state), state)
          `, [userId, fullName, phone, city, state]);
        }
        if (phone) {
          await pool.query('UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?', [phone, userId]).catch(() => {});
        }
        console.log(`[dbService] Real-time MySQL update: profile updated for user ${userId}`);
      } catch (err) {
        console.error('[dbService] updateUserProfile MySQL error:', err.message);
      }
    }
    const data = db.get();
    const user = (data.users || []).find(u => u.id === userId);
    if (user) {
      if (profileData.fullName) user.fullName = profileData.fullName;
      if (profileData.phone) { user.phone = profileData.phone; user.phoneNormalized = profileData.phone; }
      if (profileData.city) user.city = profileData.city;
      if (profileData.state) user.state = profileData.state;
      db.save();
    }
    return true;
  },

  async saveUserProfile(profile) {
    const userId = profile.userId || profile.user_id;
    const fullName = profile.fullName || profile.full_name || '';
    const mobile = profile.mobile || profile.phone || null;
    const dob = safeDate(profile.dob || profile.date_of_birth);
    const state = profile.state || null;
    const city = profile.city || null;
    const preferredLanguage = profile.preferredLanguage || 'en';
    const profilePhoto = profile.profilePhoto || profile.profile_photo || null;

    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO user_profiles (user_id, full_name, mobile, date_of_birth, state, city, preferred_language, profile_photo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             full_name = VALUES(full_name),
             mobile = VALUES(mobile),
             date_of_birth = VALUES(date_of_birth),
             state = VALUES(state),
             city = VALUES(city),
             preferred_language = VALUES(preferred_language),
             profile_photo = VALUES(profile_photo)`,
          [userId, fullName, mobile, dob, state, city, preferredLanguage, profilePhoto]
        );

        if (mobile) {
          await pool.query('UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?', [mobile, userId]).catch(() => {});
        }
        console.log(`[dbService] Real-time MySQL write: user_profile for ${userId} (${fullName}) saved.`);
      } catch (err) {
        console.error('[dbService] saveUserProfile MySQL error:', err.message);
      }
    }

    const data = db.get();
    if (!data.userProfiles) data.userProfiles = [];
    const idx = data.userProfiles.findIndex(p => (p.userId || p.user_id) === userId);
    if (idx >= 0) data.userProfiles[idx] = { ...data.userProfiles[idx], ...profile };
    else data.userProfiles.push(profile);
    db.save();
    return profile;
  },

  async saveLawyerProfile(profile) {
    const userId = profile.userId || profile.id || profile.user_id;
    const fullName = profile.fullName || profile.professionalName || profile.full_name || '';
    const specialization = profile.specialization || profile.primarySpecialization || '';
    const experienceYears = parseInt(profile.experienceYears || profile.yearsOfPractice || 0, 10);
    const barCouncilId = profile.barCouncilId || profile.barCouncil || profile.bar_council_id || '';
    const courtsPracticed = Array.isArray(profile.courts) ? profile.courts.join(', ') : (profile.courts_practiced || profile.courts || '');
    const languagesSpoken = Array.isArray(profile.languages) ? profile.languages.join(', ') : (profile.languages_spoken || profile.languages || '');
    const consultationFee = parseFloat(profile.consultationFee || 500);
    const rating = parseFloat(profile.rating || 5.0);
    const totalReviews = parseInt(profile.totalReviews || 0, 10);
    const isVerified = profile.isVerified ? 1 : 0;
    const profilePhoto = profile.profilePhoto || profile.profile_photo || null;
    const phone = profile.phone || profile.mobile || null;

    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO lawyer_profiles (user_id, full_name, specialization, experience_years, bar_council_id, courts_practiced, languages_spoken, consultation_fee, rating, total_reviews, is_verified, profile_photo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             full_name = VALUES(full_name),
             specialization = VALUES(specialization),
             experience_years = VALUES(experience_years),
             bar_council_id = VALUES(bar_council_id),
             courts_practiced = VALUES(courts_practiced),
             languages_spoken = VALUES(languages_spoken),
             consultation_fee = VALUES(consultation_fee),
             is_verified = VALUES(is_verified),
             profile_photo = VALUES(profile_photo)`,
          [
            userId, fullName, specialization, experienceYears, barCouncilId,
            courtsPracticed, languagesSpoken, consultationFee, rating,
            totalReviews, isVerified, profilePhoto
          ]
        );

        if (phone) {
          await pool.query('UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?', [phone, userId]).catch(() => {});
        }
        console.log(`[dbService] Real-time MySQL write: lawyer_profile for ${userId} (${fullName}) saved.`);
      } catch (err) {
        console.error('[dbService] saveLawyerProfile MySQL error:', err.message);
      }
    }
    return profile;
  },

  async getUserProfile(userId, role = 'user') {
    const pool = getMySQLPool();
    if (pool) {
      try {
        if (role === 'lawyer') {
          const [rows] = await pool.query('SELECT * FROM lawyer_profiles WHERE user_id = ?', [userId]);
          if (rows.length > 0) return rows[0];
        } else {
          const [rows] = await pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
          if (rows.length > 0) return rows[0];
        }
      } catch (err) {
        console.error('[dbService] getUserProfile MySQL error:', err.message);
      }
    }
    const data = db.get();
    return (data.userProfiles || []).find(p => (p.userId || p.user_id) === userId) || null;
  },

  /* ---------------- OTP Challenges ---------------- */
  async saveOtpChallenge(challenge) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO otp_challenges (id, user_id, email, purpose, hashed_otp, raw_otp, attempts_count, max_attempts, is_used, expires_at, created_at, last_sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             hashed_otp = VALUES(hashed_otp),
             raw_otp = VALUES(raw_otp),
             attempts_count = VALUES(attempts_count),
             max_attempts = VALUES(max_attempts),
             is_used = VALUES(is_used),
             expires_at = VALUES(expires_at),
             last_sent_at = VALUES(last_sent_at)`,
          [
            challenge.id,
            challenge.userId || null,
            String(challenge.email || '').toLowerCase().trim(),
            challenge.purpose || 'registration',
            challenge.hashedOtp || '',
            challenge.rawOtp || null,
            challenge.attemptsCount || challenge.attempts || 0,
            challenge.maxAttempts || 5,
            challenge.isUsed ? 1 : 0,
            safeTimestamp(challenge.expiresAt),
            safeTimestamp(challenge.createdAt),
            safeTimestamp(challenge.lastSentAt)
          ]
        );
        console.log(`[dbService] Real-time MySQL write: OTP challenge ${challenge.id} for ${challenge.email} saved.`);
      } catch (err) {
        console.error('[dbService] saveOtpChallenge MySQL error:', err.message);
      }
    }

    const data = db.get();
    data.otpChallenges = data.otpChallenges || [];
    const idx = data.otpChallenges.findIndex(c => c.id === challenge.id);
    if (idx >= 0) data.otpChallenges[idx] = { ...data.otpChallenges[idx], ...challenge };
    else data.otpChallenges.push(challenge);
    db.save();
    return challenge;
  },

  async findOtpChallenge(challengeId, email) {
    const cleanEmail = email ? String(email).toLowerCase().trim() : null;
    const pool = getMySQLPool();
    if (pool) {
      try {
        let query = 'SELECT * FROM otp_challenges WHERE is_used = 0 AND expires_at > NOW() AND ';
        const params = [];
        if (challengeId && cleanEmail) {
          query += '(id = ? OR LOWER(email) = ?)';
          params.push(challengeId, cleanEmail);
        } else if (challengeId) {
          query += 'id = ?';
          params.push(challengeId);
        } else if (cleanEmail) {
          query += 'LOWER(email) = ?';
          params.push(cleanEmail);
        } else {
          return null;
        }
        query += ' ORDER BY created_at DESC LIMIT 1';

        const [rows] = await pool.query(query, params);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            userId: row.user_id,
            email: row.email,
            purpose: row.purpose,
            hashedOtp: row.hashed_otp,
            rawOtp: row.raw_otp,
            attemptsCount: row.attempts_count,
            attempts: row.attempts_count,
            maxAttempts: row.max_attempts,
            isUsed: Boolean(row.is_used),
            expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : new Date().toISOString(),
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : new Date().toISOString()
          };
        }
      } catch (err) {
        console.error('[dbService] findOtpChallenge MySQL error:', err.message);
      }
    }

    const data = db.get();
    const matching = (data.otpChallenges || []).filter(c => {
      if (challengeId && (c.id === challengeId || c.key === challengeId)) return true;
      if (cleanEmail && (c.email && c.email.toLowerCase() === cleanEmail || c.key === `otp:${cleanEmail}`)) return true;
      return false;
    });
    return matching.slice().reverse().find(c => !c.isUsed) || null;
  },

  async markOtpChallengeUsed(id) {
    if (!id) return;
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('UPDATE otp_challenges SET is_used = 1 WHERE id = ?', [id]);
      } catch (err) {
        console.error('[dbService] markOtpChallengeUsed MySQL error:', err.message);
      }
    }
    const data = db.get();
    const ch = (data.otpChallenges || []).find(c => c.id === id);
    if (ch) {
      ch.isUsed = true;
      db.save();
    }
  },

  /* ---------------- Sessions ---------------- */
  async saveSession(session) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO sessions (id, user_id, device_info, created_at, last_seen_at, revoked)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             last_seen_at = VALUES(last_seen_at),
             revoked = VALUES(revoked)`,
          [
            session.id,
            session.userId,
            JSON.stringify(session.device || session.device_info || {}),
            safeTimestamp(session.createdAt),
            safeTimestamp(session.lastSeenAt || new Date()),
            session.revoked ? 1 : 0
          ]
        );
        console.log(`[dbService] Real-time MySQL write: Session ${session.id} for user ${session.userId} saved.`);
      } catch (err) {
        console.error('[dbService] saveSession MySQL error:', err.message);
      }
    }

    const data = db.get();
    data.sessions = data.sessions || [];
    const idx = data.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) data.sessions[idx] = { ...data.sessions[idx], ...session };
    else data.sessions.push(session);
    db.save();
    return session;
  },

  async findSession(sessionId) {
    if (!sessionId) return null;
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM sessions WHERE id = ? AND revoked = 0', [sessionId]);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            userId: row.user_id,
            device: typeof row.device_info === 'string' ? JSON.parse(row.device_info) : (row.device_info || {}),
            createdAt: row.created_at,
            lastSeenAt: row.last_seen_at,
            revoked: Boolean(row.revoked)
          };
        }
      } catch (err) {
        console.error('[dbService] findSession MySQL error:', err.message);
      }
    }
    const data = db.get();
    return (data.sessions || []).find(s => s.id === sessionId && !s.revoked) || null;
  },

  async revokeSession(sessionId) {
    if (!sessionId) return;
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('UPDATE sessions SET revoked = 1 WHERE id = ?', [sessionId]);
      } catch (err) {
        console.error('[dbService] revokeSession MySQL error:', err.message);
      }
    }
    const data = db.get();
    const sess = (data.sessions || []).find(s => s.id === sessionId);
    if (sess) {
      sess.revoked = true;
      db.save();
    }
  },

  async revokeAllSessions(userId, exceptSessionId = null) {
    if (!userId) return;
    const pool = getMySQLPool();
    if (pool) {
      try {
        if (exceptSessionId) {
          await pool.query('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id != ?', [userId, exceptSessionId]);
        } else {
          await pool.query('UPDATE sessions SET revoked = 1 WHERE user_id = ?', [userId]);
        }
      } catch (err) {
        console.error('[dbService] revokeAllSessions MySQL error:', err.message);
      }
    }
    const data = db.get();
    for (const s of data.sessions || []) {
      if (s.userId === userId && s.id !== exceptSessionId) {
        s.revoked = true;
      }
    }
    db.save();
  },

  /* ---------------- Explicit User Data Deletion ---------------- */
  async deleteUserAccount(userId) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('DELETE FROM user_profiles WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM lawyer_profiles WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM otp_challenges WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM cases WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM consultations WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM documents WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        console.log(`[dbService] Real-time MySQL deletion: user ${userId} and all related records deleted.`);
      } catch (err) {
        console.error('[dbService] deleteUserAccount MySQL error:', err.message);
      }
    }
    const data = db.get();
    data.users = (data.users || []).filter(u => u.id !== userId);
    data.userProfiles = (data.userProfiles || []).filter(p => (p.userId || p.user_id) !== userId);
    data.cases = (data.cases || []).filter(c => (c.userId || c.user_id) !== userId);
    db.save();
    return true;
  },

  /* ---------------- Case Management ---------------- */
  async saveCase(caseData) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO cases (id, user_id, lawyer_id, title, category, sub_category, description, court_name, location, status, next_hearing_date, next_hearing_time, next_hearing_purpose)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             title = VALUES(title),
             category = VALUES(category),
             status = VALUES(status),
             next_hearing_date = VALUES(next_hearing_date)`,
          [
            caseData.id,
            caseData.userId || caseData.user_id,
            caseData.lawyerId || null,
            caseData.title,
            caseData.category || caseData.type || 'General',
            caseData.subCategory || null,
            caseData.description || null,
            caseData.courtName || caseData.court || null,
            caseData.location || null,
            caseData.status || 'ongoing',
            safeDate(caseData.nextHearingDate),
            caseData.nextHearingTime || null,
            caseData.nextHearingPurpose || null
          ]
        );
      } catch (err) {
        console.error('[dbService] saveCase MySQL error:', err.message);
      }
    }
    const data = db.get();
    if (!data.cases) data.cases = [];
    const idx = data.cases.findIndex(c => c.id === caseData.id);
    if (idx >= 0) data.cases[idx] = { ...data.cases[idx], ...caseData };
    else data.cases.push(caseData);
    db.save();
    return caseData;
  },

  async getCases(userId) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        if (rows.length > 0) return rows;
      } catch (err) {
        console.error('[dbService] getCases MySQL error:', err.message);
      }
    }
    const data = db.get();
    return (data.cases || []).filter(c => (c.userId || c.user_id) === userId);
  },

  /* ---------------- Documents & Vault ---------------- */
  async saveDocument(docData) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO documents (id, user_id, case_id, file_name, file_url, file_size, file_category, privacy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docData.id,
            docData.userId || docData.user_id,
            docData.caseId || null,
            docData.fileName || docData.name,
            docData.fileUrl || docData.url,
            docData.fileSize || docData.size,
            docData.category || null,
            docData.privacy || 'private'
          ]
        );
      } catch (err) {
        console.error('[dbService] saveDocument MySQL error:', err.message);
      }
    }
    const data = db.get();
    if (!data.documents) data.documents = [];
    data.documents.push(docData);
    db.save();
    return docData;
  },

  async getDocuments(userId) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        if (rows.length > 0) return rows;
      } catch (err) {
        console.error('[dbService] getDocuments MySQL error:', err.message);
      }
    }
    const data = db.get();
    return (data.documents || []).filter(d => (d.userId || d.user_id) === userId);
  },

  /* ---------------- Verified Lawyers Discovery ---------------- */
  async getVerifiedLawyers() {
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query(`
          SELECT 
            u.id, u.email, u.phone, u.account_status,
            lp.full_name AS name,
            lp.specialization,
            lp.experience_years,
            lp.bar_council_id,
            lp.courts_practiced,
            lp.languages_spoken,
            lp.consultation_fee,
            lp.rating,
            lp.total_reviews,
            lp.is_verified,
            lp.profile_photo,
            up.city, up.state
          FROM users u
          JOIN lawyer_profiles lp ON u.id = lp.user_id
          LEFT JOIN user_profiles up ON u.id = up.user_id
          WHERE u.role = 'lawyer' AND u.account_status = 'active'
          ORDER BY lp.rating DESC, lp.experience_years DESC
        `);
        return rows.map(r => ({
          id: r.id,
          name: r.name || 'Advocate',
          email: r.email,
          phone: r.phone || '',
          specialization: r.specialization || 'General Practice',
          experience: `${r.experience_years || 5} Years`,
          experienceYears: r.experience_years || 5,
          barCouncil: r.bar_council_id || '',
          barCouncilId: r.bar_council_id || '',
          rating: parseFloat(r.rating || 5.0),
          reviews: r.total_reviews || 0,
          totalReviews: r.total_reviews || 0,
          fee: parseFloat(r.consultation_fee || 1000),
          feeDuration: '30 min',
          languages: r.languages_spoken ? (typeof r.languages_spoken === 'string' ? r.languages_spoken.split(', ') : r.languages_spoken) : ['English', 'Hindi'],
          courts: r.courts_practiced ? (typeof r.courts_practiced === 'string' ? r.courts_practiced.split(', ') : r.courts_practiced) : ['District Court'],
          verified: Boolean(r.is_verified),
          available: true,
          city: r.city || 'Jaipur',
          state: r.state || 'Rajasthan',
          profilePhoto: r.profile_photo || null,
          whyRecommend: `Specializes in ${r.specialization}, with ${r.experience_years || 5} years of practice in ${r.courts_practiced || 'District Court'}.`
        }));
      } catch (err) {
        console.error('[dbService] getVerifiedLawyers MySQL error:', err.message);
      }
    }
    return [];
  },

  async getLawyerById(id) {
    if (!id) return null;
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query(`
          SELECT 
            u.id, u.email, u.phone, u.account_status,
            lp.full_name AS name,
            lp.specialization,
            lp.experience_years,
            lp.bar_council_id,
            lp.courts_practiced,
            lp.languages_spoken,
            lp.consultation_fee,
            lp.rating,
            lp.total_reviews,
            lp.is_verified,
            lp.profile_photo,
            up.city, up.state
          FROM users u
          JOIN lawyer_profiles lp ON u.id = lp.user_id
          LEFT JOIN user_profiles up ON u.id = up.user_id
          WHERE u.id = ?
        `, [id]);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            name: r.name || 'Advocate',
            email: r.email,
            phone: r.phone || '',
            specialization: r.specialization || 'General Practice',
            experience: `${r.experience_years || 5} Years`,
            experienceYears: r.experience_years || 5,
            barCouncil: r.bar_council_id || '',
            barCouncilId: r.bar_council_id || '',
            rating: parseFloat(r.rating || 5.0),
            reviews: r.total_reviews || 0,
            totalReviews: r.total_reviews || 0,
            fee: parseFloat(r.consultation_fee || 1000),
            feeDuration: '30 min',
            languages: r.languages_spoken ? (typeof r.languages_spoken === 'string' ? r.languages_spoken.split(', ') : r.languages_spoken) : ['English', 'Hindi'],
            courts: r.courts_practiced ? (typeof r.courts_practiced === 'string' ? r.courts_practiced.split(', ') : r.courts_practiced) : ['District Court'],
            verified: Boolean(r.is_verified),
            available: true,
            city: r.city || 'Jaipur',
            state: r.state || 'Rajasthan',
            profilePhoto: r.profile_photo || null,
            whyRecommend: `Specializes in ${r.specialization}, with ${r.experience_years || 5} years of practice.`
          };
        }
      } catch (err) {
        console.error('[dbService] getLawyerById MySQL error:', err.message);
      }
    }
    return null;
  },

  /* ---------------- Client Profile Details ---------------- */
  async getClientProfile(userId) {
    if (!userId) return null;
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query(`
          SELECT 
            u.id, u.email, u.phone, u.role, u.is_verified, u.created_at,
            up.full_name, up.mobile, up.date_of_birth, up.state, up.city, up.preferred_language, up.profile_photo
          FROM users u
          LEFT JOIN user_profiles up ON u.id = up.user_id
          WHERE u.id = ?
        `, [userId]);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            email: r.email,
            phone: r.mobile || r.phone || '',
            fullName: r.full_name || 'Client',
            name: r.full_name || 'Client',
            city: r.city || 'Jaipur',
            state: r.state || 'Rajasthan',
            dob: r.date_of_birth || null,
            preferredLanguage: r.preferred_language || 'en',
            profilePhoto: r.profile_photo || null,
            isVerified: Boolean(r.is_verified),
            createdAt: r.created_at
          };
        }
      } catch (err) {
        console.error('[dbService] getClientProfile MySQL error:', err.message);
      }
    }
    return null;
  },

  /* ---------------- Consultations (Live Linking) ---------------- */
  async bookConsultation(bookingData) {
    const consultId = bookingData.id || `cst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const userId = bookingData.userId;
    const lawyerId = bookingData.lawyerId || 'law_adv_padam';
    const dateStr = safeDate(bookingData.date || new Date(Date.now() + 86400000));
    const timeStr = bookingData.time || '10:00 AM';
    const mode = bookingData.mode || 'video';
    const fee = parseFloat(bookingData.fee || 1000);
    const platformFee = parseFloat(bookingData.platformFee || 50);
    const totalAmount = parseFloat(bookingData.total || (fee + platformFee));
    const notes = bookingData.notes || 'Client booked consultation via portal.';
    const caseCategory = bookingData.caseCategory || 'General Legal Consultation';

    const clientName = bookingData.clientName || bookingData.name || 'Padam Kishore';
    const clientEmail = bookingData.clientEmail || bookingData.email || 'padamkishore90@gmail.com';
    const clientPhone = bookingData.clientPhone || bookingData.phone || '9876543210';
    const clientCity = bookingData.clientCity || bookingData.city || 'Jaipur';
    const clientState = bookingData.clientState || bookingData.state || 'Rajasthan';

    const summaryObj = bookingData.summary || {
      category: caseCategory,
      notes,
      clientName,
      clientEmail,
      clientPhone,
      clientCity,
      clientState
    };
    const summaryJson = JSON.stringify(summaryObj);

    const pool = getMySQLPool();
    let clientProfile = null;
    let lawyerProfile = null;

    if (pool) {
      try {
        clientProfile = await this.getClientProfile(userId);
        if (!clientProfile && clientName) {
          await this.updateUserProfile(userId, {
            fullName: clientName,
            phone: clientPhone,
            city: clientCity,
            state: clientState
          }).catch(() => {});
          clientProfile = await this.getClientProfile(userId);
        }
        lawyerProfile = await this.getLawyerById(lawyerId);

        // 1. Insert into consultations table
        await pool.query(
          `INSERT INTO consultations (id, user_id, lawyer_id, case_id, consult_date, consult_time, consult_mode, status, fee, platform_fee, total_amount, notes, summary_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NOW())`,
          [
            consultId, userId, lawyerId, bookingData.caseId || null,
            dateStr, timeStr, mode, fee, platformFee, totalAmount, notes, summaryJson
          ]
        );
        console.log(`[dbService] Real-time MySQL write: consultation ${consultId} booked by client ${userId} for lawyer ${lawyerId}.`);

        // 2. Insert instant notification for lawyer in MySQL
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const displayName = (clientProfile && clientProfile.fullName) || clientName;
        await pool.query(
          `INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
           VALUES (?, ?, 'lawyer', ?, ?, 0, NOW())`,
          [
            notifId,
            lawyerId,
            'New Consultation Request',
            `${displayName} has booked a ${mode.toUpperCase()} consultation for ${dateStr} at ${timeStr}. Fee: ₹${totalAmount}.`
          ]
        );
        console.log(`[dbService] Real-time MySQL write: notification ${notifId} dispatched to lawyer ${lawyerId}.`);

        // If lawyerId is not law_adv_padam, mirror notification to law_adv_padam as well
        if (lawyerId !== 'law_adv_padam') {
          const notifId2 = `notif_${Date.now()}_padam_${Math.random().toString(36).slice(2, 6)}`;
          await pool.query(
            `INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
             VALUES (?, 'law_adv_padam', 'lawyer', ?, ?, 0, NOW())`,
            [
              notifId2,
              'New Consultation Request',
              `${displayName} has booked a ${mode.toUpperCase()} consultation for ${dateStr} at ${timeStr}. Fee: ₹${totalAmount}.`
            ]
          ).catch(() => {});
        }
      } catch (err) {
        console.error('[dbService] bookConsultation MySQL error:', err.message);
      }
    }

    // 3. Mirror immediately into lawyer's memory workspace (resilient engine)
    try {
      const targetLawyers = [lawyerId];
      if (lawyerId !== 'law_adv_padam') targetLawyers.push('law_adv_padam');

      for (const tLawyer of targetLawyers) {
        const ws = db.workspaceFor(tLawyer);
        ws.clients = ws.clients || [];
        const existingIdx = ws.clients.findIndex(c => c.id === consultId || (c.clientId === userId && c.status === 'pending'));
        const clientRequestObj = {
          id: consultId,
          clientId: userId,
          name: (clientProfile && clientProfile.fullName) || clientName,
          email: (clientProfile && clientProfile.email) || clientEmail,
          phone: (clientProfile && clientProfile.phone) || clientPhone,
          city: (clientProfile && clientProfile.city) || clientCity,
          state: (clientProfile && clientProfile.state) || clientState,
          caseCategory: caseCategory,
          briefProblem: notes,
          preferredDate: dateStr,
          preferredTime: timeStr,
          consultationType: mode.toUpperCase() === 'VIDEO' ? 'Video' : mode.toUpperCase() === 'AUDIO' ? 'Phone' : 'In-Office',
          estimatedFee: fee,
          status: 'pending',
          documents: bookingData.documents || [],
          createdAt: new Date().toISOString()
        };

        if (existingIdx >= 0) {
          ws.clients[existingIdx] = clientRequestObj;
        } else {
          ws.clients.unshift(clientRequestObj);
        }

        ws.notifications = ws.notifications || [];
        ws.notifications.unshift({
          id: `notif_${Date.now()}`,
          type: 'client',
          title: 'New Consultation Request',
          message: `${clientRequestObj.name} requested a consultation for ${dateStr} at ${timeStr}.`,
          read: false,
          link: '/clients',
          time: new Date().toISOString()
        });
      }

      db.save();
    } catch (wsErr) {
      console.error('[dbService] bookConsultation workspace sync error:', wsErr.message);
    }

    return {
      id: consultId,
      userId,
      lawyerId,
      caseId: bookingData.caseId || null,
      date: dateStr,
      time: timeStr,
      mode,
      status: 'pending',
      fee,
      platformFee,
      total: totalAmount,
      notes,
      lawyerName: lawyerProfile ? lawyerProfile.name : 'Advocate'
    };
  },

  async getLawyerConsultations(lawyerId) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query(`
          SELECT 
            c.*,
            COALESCE(NULLIF(up.full_name, ''), JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.clientName')), 'Padam Kishore') AS client_name,
            COALESCE(NULLIF(up.mobile, ''), NULLIF(u.phone, ''), JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.clientPhone')), '9876543210') AS client_phone,
            COALESCE(NULLIF(up.city, ''), JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.clientCity')), 'Jaipur') AS client_city,
            COALESCE(NULLIF(up.state, ''), JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.clientState')), 'Rajasthan') AS client_state,
            COALESCE(NULLIF(u.email, ''), JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.clientEmail')), 'padamkishore90@gmail.com') AS client_email,
            COALESCE(cs.title, JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.category')), 'Consultation Engagement') AS case_title,
            COALESCE(cs.category, JSON_UNQUOTE(JSON_EXTRACT(c.summary_json, '$.category')), 'General Legal Advice') AS case_category
          FROM consultations c
          LEFT JOIN users u ON c.user_id = u.id
          LEFT JOIN user_profiles up ON c.user_id = up.user_id
          LEFT JOIN cases cs ON c.case_id = cs.id
          WHERE (? = 'all' OR ? IS NULL OR c.lawyer_id = ? OR c.lawyer_id = 'law_adv_padam')
          ORDER BY c.created_at DESC
        `, [lawyerId || 'all', lawyerId, lawyerId]);
        return rows;
      } catch (err) {
        console.error('[dbService] getLawyerConsultations MySQL error:', err.message);
      }
    }
    return [];
  },

  async getUserConsultations(userId) {
    const pool = getMySQLPool();
    if (pool) {
      try {
        const [rows] = await pool.query(`
          SELECT 
            c.*,
            COALESCE(lp.full_name, 'Adv. Padam Kishore') AS lawyer_name,
            COALESCE(lp.specialization, 'Constitutional & Criminal Law') AS lawyer_specialization,
            COALESCE(lp.bar_council_id, 'DL/4521/2016') AS lawyer_bar_council,
            COALESCE(lp.rating, 4.9) AS lawyer_rating,
            lp.profile_photo AS lawyer_photo,
            COALESCE(lu.email, 'advocate.padam@Nyay Setu.in') AS lawyer_email,
            COALESCE(lu.phone, '+91 98765 43210') AS lawyer_phone
          FROM consultations c
          LEFT JOIN users lu ON c.lawyer_id = lu.id
          LEFT JOIN lawyer_profiles lp ON c.lawyer_id = lp.user_id
          WHERE c.user_id = ?
          ORDER BY c.created_at DESC
        `, [userId]);
        return rows;
      } catch (err) {
        console.error('[dbService] getUserConsultations MySQL error:', err.message);
      }
    }
    return [];
  },

  async updateConsultationStatus(consultId, status, lawyerId = null) {
    const pool = getMySQLPool();
    let consult = null;
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT * FROM consultations WHERE id = ?', [consultId]);
        if (rows.length > 0) {
          consult = rows[0];
          await pool.query('UPDATE consultations SET status = ? WHERE id = ?', [status, consultId]);
          console.log(`[dbService] Real-time MySQL update: consultation ${consultId} status set to '${status}'.`);

          // If accepted, open case file in MySQL if none exists
          if (status === 'accepted') {
            let caseId = consult.case_id;
            if (!caseId) {
              caseId = `case_${Date.now()}`;
              const [caseCount] = await pool.query('SELECT COUNT(*) as count FROM cases');
              const caseSeq = (caseCount[0]?.count || 0) + 1;
              const caseNumber = `LC/${new Date().getFullYear()}/${String(caseSeq).padStart(4, '0')}`;
              
              await pool.query(
                `INSERT INTO cases (id, user_id, lawyer_id, title, category, description, court_name, location, status, next_hearing_date, created_at)
                 VALUES (?, ?, ?, ?, 'Civil/Property', ?, 'District Court', 'Jaipur', 'ongoing', DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), NOW())`,
                [
                  caseId,
                  consult.user_id,
                  consult.lawyer_id,
                  `Case #${caseNumber} - Consultation Engagement`,
                  consult.notes || 'Consultation accepted by advocate. Formal case file established.'
                ]
              );
              await pool.query('UPDATE consultations SET case_id = ? WHERE id = ?', [caseId, consultId]);
              console.log(`[dbService] Real-time MySQL write: case ${caseId} created for accepted consultation.`);
            }

            // Send acceptance notification to Client
            const [advRows] = await pool.query('SELECT full_name FROM lawyer_profiles WHERE user_id = ?', [consult.lawyer_id]);
            const advName = advRows[0]?.full_name || 'Your Advocate';
            const clientNotifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await pool.query(
              `INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
               VALUES (?, ?, 'lawyer', ?, ?, 0, NOW())`,
              [
                clientNotifId,
                consult.user_id,
                'Consultation Accepted & Confirmed!',
                `${advName} has ACCEPTED your consultation for ${consult.consult_date ? new Date(consult.consult_date).toLocaleDateString() : 'scheduled date'} at ${consult.consult_time}. A formal case file has been opened.`
              ]
            );
            console.log(`[dbService] Real-time MySQL write: notification ${clientNotifId} dispatched to client ${consult.user_id}.`);
          }
        }
      } catch (err) {
        console.error('[dbService] updateConsultationStatus MySQL error:', err.message);
      }
    }

    // Update lawyer workspace in memory
    const targetLawyerId = lawyerId || (consult ? consult.lawyer_id : null);
    if (targetLawyerId) {
      try {
        const ws = db.workspaceFor(targetLawyerId);
        if (ws.clients) {
          const cItem = ws.clients.find(c => c.id === consultId);
          if (cItem) {
            cItem.status = status;
          }
        }
        db.save();
      } catch (wsErr) {
        console.error('[dbService] updateConsultationStatus workspace sync error:', wsErr.message);
      }
    }

    return { success: true, id: consultId, status };
  },

  /* ---------------- Notifications Operations ---------------- */
  async getUserNotifications(userId, role = null) {
    if (!userId && !role) return [];
    const pool = getMySQLPool();
    if (pool) {
      try {
        let query = 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
        let params = [userId];
        if (role === 'lawyer' || (userId && String(userId).startsWith('law_'))) {
          query = 'SELECT * FROM notifications WHERE user_id = ? OR type = "lawyer" ORDER BY created_at DESC LIMIT 50';
          params = [userId || 'law_adv_padam'];
        }
        const [rows] = await pool.query(query, params);
        return rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          type: r.type,
          title: r.title,
          message: r.message,
          read: Boolean(r.is_read),
          is_read: Boolean(r.is_read),
          time: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          createdAt: r.created_at
        }));
      } catch (err) {
        console.error('[dbService] getUserNotifications MySQL error:', err.message);
      }
    }
    return [];
  },

  async markNotificationRead(notifId) {
    if (!notifId) return;
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notifId]);
      } catch (err) {
        console.error('[dbService] markNotificationRead MySQL error:', err.message);
      }
    }
    return true;
  },

  async markAllNotificationsRead(userId) {
    if (!userId) return;
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
      } catch (err) {
        console.error('[dbService] markAllNotificationsRead MySQL error:', err.message);
      }
    }
    return true;
  },

  async createNotification(notifData) {
    const id = notifData.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pool = getMySQLPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, 0, NOW())`,
          [
            id,
            notifData.userId,
            notifData.type || 'lawyer',
            notifData.title || 'Notification',
            notifData.message || ''
          ]
        );
      } catch (err) {
        console.error('[dbService] createNotification MySQL error:', err.message);
      }
    }
    return { id, ...notifData, read: false };
  },

  async saveConsultation(consultData) {
    return this.bookConsultation(consultData);
  }
};

module.exports = DbService;
