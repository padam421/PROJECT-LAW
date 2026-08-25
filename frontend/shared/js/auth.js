/* ============================================================
   LEGALCONNECT — AUTHENTICATION MANAGER
   auth.js — Login, logout, session, OTP/2FA, device trust,
   incident reporting. Backed by the LegalConnect API
   (bcrypt + JWT + server-side lockout & OTP challenges).
   ============================================================ */

const AuthManager = {
  SESSION_KEY: 'lc_session',
  TOKEN_KEY: 'lc_token',
  DEVICE_KEY: 'lc_device_id',
  MAX_ATTEMPTS: 5,

  _pendingOTPChallenge: null,   // active 2FA challenge from server

  /* --------------------------------------------------------
     SESSION MANAGEMENT
     -------------------------------------------------------- */
  checkSession() {
    const session = this.getSession();
    if (!session) return null;
    if (Date.now() - session.loginTime > 24 * 60 * 60 * 1000) {
      this.clearSession();
      return null;
    }
    return session;
  },

  getSession() {
    try {
      const data = localStorage.getItem(this.SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  },

  setSession(user, token) {
    const session = {
      ...user,
      loginTime: Date.now(),
      deviceId: this.getDeviceId(),
      sessionId: user.sessionId || Utils.generateId('sess')
    };
    if (token) localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  },

  clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
  },

  isLoggedIn() {
    return this.checkSession() !== null && !!this.getToken();
  },

  /* --------------------------------------------------------
     LOGIN (server round-trip)
     -------------------------------------------------------- */
  async login(emailOrPhone, password /* rememberMe kept for UX parity */) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LC-Device': this.getDeviceId() },
        body: JSON.stringify({ identifier: emailOrPhone, password })
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Sign-in failed. Please try again.' };
      }

      this._pendingOTPChallenge = {
        id: data.challengeId,
        maskedPhone: data.maskedPhone,
        maskedEmail: data.maskedEmail,
        isNewDevice: data.isNewDevice
      };

      if (data.devOtp) {
        console.log('[LegalConnect] Simulated OTP delivery:', data.devOtp);
        this._lastDevOtp = data.devOtp;
      }

      return {
        success: true,
        requires2FA: true,
        isNewDevice: data.isNewDevice,
        maskedPhone: data.maskedPhone,
        maskedEmail: data.maskedEmail
      };
    } catch (_e) {
      return { success: false, error: 'Cannot reach LegalConnect servers. Check your connection and retry.' };
    }
  },

  /* --------------------------------------------------------
     OTP VERIFICATION (2FA)
     -------------------------------------------------------- */
  async verifyOTP(code) {
    if (!this._pendingOTPChallenge) {
      return { success: false, error: 'No verification in progress. Please sign in again.' };
    }
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: this._pendingOTPChallenge.id, code })
      });
      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Verification failed.',
          attemptsRemaining: data.attemptsRemaining,
          locked: !!data.locked
        };
      }

      // Persist session with authoritative user record
      const pendingUser = data.user;
      this.setSession(pendingUser, data.token);
      this._deviceConfirmationRequired = !!data.requiresDeviceConfirmation;

      // Hydrate workspace for this account immediately
      if (window.Store) await Store.refreshFromServer().catch(() => {});

      return { success: true, session: this.getSession(), requiresDeviceConfirmation: !!data.requiresDeviceConfirmation };
    } catch (_e) {
      return { success: false, error: 'Network error during verification. Please retry.' };
    }
  },

  async resendOTP() {
    if (!this._pendingOTPChallenge) return { success: false, message: 'No active verification.' };
    try {
      const res = await fetch('/api/auth/otp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: this._pendingOTPChallenge.id })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error || 'Could not resend code.' };
      if (data.devOtp) {
        console.log('[LegalConnect] Simulated OTP delivery:', data.devOtp);
        this._lastDevOtp = data.devOtp;
      }
      return { success: true, message: 'A fresh 6-digit code was generated.', devOtp: data.devOtp };
    } catch (_e) {
      return { success: false, message: 'Network error while resending.' };
    }
  },

  /* --------------------------------------------------------
     REGISTRATION
     -------------------------------------------------------- */
  async register(formData) {
    try {
      const payload = { ...formData };
      delete payload.profilePhotoData; // photo syncs via profile PATCH after sign-in
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Registration failed.',
          fieldErrors: data.fieldErrors || {}
        };
      }

      if (data.status === 'under_investigation') {
        return {
          success: false,
          underInvestigation: true,
          error: data.message
        };
      }

      return { success: true, lawyerId: data.lawyerId, message: data.message };
    } catch (_e) {
      return { success: false, error: 'Network error during registration. Please retry.' };
    }
  },

  /* --------------------------------------------------------
      FORGOT PASSWORD (server-issued reset link via email)
      -------------------------------------------------------- */
  async forgotPassword(email) {
    if (!Utils.validateEmail(email)) {
      return { sent: false, message: 'Please enter a valid email address.' };
    }
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { sent: false, message: data.error || 'Could not send the reset email. Please try again shortly.' };
      }
      return { sent: true, message: data.message || 'If an account exists for this address, a reset link is on its way.' };
    } catch (_e) {
      return { sent: false, message: 'Cannot reach LegalConnect servers. Check your connection and retry.' };
    }
  },

  async resetPassword(token, newPassword) {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data.error || 'Reset failed.' };
      this.clearSession();
      if (window.Store) Store.resetLocal();
      return { success: true };
    } catch (_e) {
      return { success: false, error: 'Network error while resetting password.' };
    }
  },

  /* --------------------------------------------------------
     DEVICE MANAGEMENT (server-tracked, keyed by browser device id)
     -------------------------------------------------------- */
  getDeviceId() {
    let deviceId = localStorage.getItem(this.DEVICE_KEY);
    if (!deviceId) {
      deviceId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(this.DEVICE_KEY, deviceId);
    }
    return deviceId;
  },

  getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'Desktop';
    let browser = 'Unknown';
    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';

    let os = navigator.platform || 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';

    return {
      deviceId: this.getDeviceId(),
      deviceType,
      browser,
      os,
      timestamp: new Date().toISOString(),
      location: 'India (approx.)'
    };
  },

  /** Server is the source of truth; cached flag used only for pre-2FA UI hints. */
  async fetchTrustedDevices() {
    try {
      const res = await fetch('/api/auth/devices', { headers: { Authorization: `Bearer ${this.getToken()}` } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.devices || [];
    } catch {
      return [];
    }
  },

  async removeTrustedDevice(deviceRowId) {
    try {
      await fetch(`/api/auth/devices/${deviceRowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.getToken()}` }
      });
      return true;
    } catch {
      return false;
    }
  },

  /* Legacy no-op shims retained so existing call sites keep working */
  isNewDevice() { return !!this._deviceConfirmationRequired; },
  addTrustedDevice() { /* handled server-side via /auth/device-confirm */ },

  async confirmThisDevice() {
    try {
      const res = await fetch('/api/auth/device-confirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken()}` }
      });
      this._deviceConfirmationRequired = false;
      return res.ok;
    } catch {
      return false;
    }
  },

  /* --------------------------------------------------------
     ACTIVITY / SESSIONS / INCIDENTS (server-backed)
     -------------------------------------------------------- */
  async getLoginActivity() {
    try {
      const res = await fetch('/api/auth/activity', { headers: { Authorization: `Bearer ${this.getToken()}` } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.activity || [];
    } catch {
      return [];
    }
  },

  async getActiveSessions() {
    try {
      const res = await fetch('/api/auth/sessions', { headers: { Authorization: `Bearer ${this.getToken()}` } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.sessions || [];
    } catch {
      return [];
    }
  },

  async terminateSession(sessionId) {
    if (sessionId === this.getSession()?.sessionId) { this.logout(); return true; }
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.getToken()}` }
      });
      return res.ok;
    } catch { return false; }
  },

  async reportUnrecognizedLogin() {
    try {
      const res = await fetch('/api/auth/incident/unrecognized-login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken()}` }
      });
      const data = await res.json();
      this.clearSession();
      if (window.Store) Store.resetLocal();
      return { ok: res.ok, message: data.message || 'All sessions were terminated for your safety.' };
    } catch {
      this.clearSession();
      return { ok: false, message: 'Sessions cleared locally. Reconnect to finish securing your account.' };
    }
  },

  async changePassword(currentPassword, newPassword) {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.getToken()}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true, revokedSessions: data.revokedSessions };
    } catch {
      return { success: false, error: 'Network error while changing password.' };
    }
  },

  /* --------------------------------------------------------
     LOGOUT
     -------------------------------------------------------- */
  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${this.getToken()}` } });
    } catch { /* best-effort */ }
    this.logLocalLogout();
    this.clearSession();
    this._pendingOTPChallenge = null;
    this._deviceConfirmationRequired = false;
    if (window.Store) Store.resetLocal();
    window.location.hash = '#/login';
  },

  logLocalLogout() { /* activity recorded server-side on logout endpoint */ },

  /* --------------------------------------------------------
     HELPERS
     -------------------------------------------------------- */
  maskPhone(phone) {
    if (!phone || phone.length < 4) return '••••••••';
    return '••••••' + phone.slice(-4);
  },

  maskEmail(email) {
    if (!email || !email.includes('@')) return '•••••@•••••';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}••@${domain}`;
    return `${user[0]}${'•'.repeat(Math.min(user.length - 2, 4))}${user[user.length - 1]}@${domain}`;
  },

  /** Current lawyer record — live profile from server, falling back to session snapshot. */
  currentLawyer() {
    if (window.Store && Store.getState('lawyerProfile')) return Store.getState('lawyerProfile');
    return this.getSession() || {};
  },

  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
