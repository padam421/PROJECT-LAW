/* ============================================================
   Nyay Setu — AUTHENTICATION MANAGER
   auth.js — Registration (email+password → 6-digit email OTP),
   verified password/Google login, logout, device trust, incident
   reporting. Backed by the Nyay Setu API:
     • bcrypt-hashed passwords & OTPs
     • HttpOnly Secure session cookie (JWT never touches JS)
     • server-side lockout, OTP expiry (5 min) & rate limits
   ============================================================ */

const AuthManager = {
  SESSION_KEY: 'lc_session',
  DEVICE_KEY: 'lc_device_id',
  PENDING_OTP_KEY: 'lc_pending_otp_challenge',
  MAX_ATTEMPTS: 5,

  _pendingOTPChallenge: null,   // active verification challenge from the server
  _pendingRegistrant: null,     // profile details staged before registration completes

  /* Survive page refreshes during verification (server challenge still valid) */
  storePendingOTP() {
    try {
      if (this._pendingOTPChallenge) {
        sessionStorage.setItem(this.PENDING_OTP_KEY, JSON.stringify(this._pendingOTPChallenge));
      }
    } catch { /* storage unavailable */ }
  },

  restorePendingOTP() {
    if (this._pendingOTPChallenge) return;
    try {
      const raw = sessionStorage.getItem(this.PENDING_OTP_KEY);
      if (raw) this._pendingOTPChallenge = JSON.parse(raw);
    } catch { /* ignore corrupt state */ }
  },

  storePendingRegistrant() {
    try {
      if (this._pendingRegistrant) {
        sessionStorage.setItem('lc_pending_registrant', JSON.stringify(this._pendingRegistrant));
      }
    } catch {}
  },

  restorePendingRegistrant() {
    if (this._pendingRegistrant) return;
    try {
      const raw = sessionStorage.getItem('lc_pending_registrant');
      if (raw) this._pendingRegistrant = JSON.parse(raw);
    } catch {}
  },

  clearPendingOTP() {
    this._pendingOTPChallenge = null;
    this._pendingRegistrant = null;
    try {
      sessionStorage.removeItem(this.PENDING_OTP_KEY);
      sessionStorage.removeItem('lc_pending_registrant');
    } catch { /* ignore */ }
  },

  /* --------------------------------------------------------
     SESSION MANAGEMENT
     The credential is an HttpOnly cookie managed entirely by
     the server; this local snapshot only personalises the UI.
     -------------------------------------------------------- */
  checkSession() {
    // The cookie session is checked by the server, including expiry/revocation.
    // A UI cache age must never sign an otherwise valid account out.
    return this.getSession();
  },

  getSession() {
    try {
      const data = localStorage.getItem(this.SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setSession(user, sessionId) {
    const session = {
      ...user,
      loginTime: Date.now(),
      deviceId: this.getDeviceId(),
      sessionId: sessionId || user.sessionId || Utils.generateId('sess')
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  },

  isLoggedIn() {
    return !!this.checkSession();
  },

  getUser() {
    return this.checkSession();
  },

  getToken() {
    const session = this.getSession();
    return session?.token || null;
  },

  clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  displayName(user = this.getSession()) {
    if (!user) return 'User';
    return user.googleName || (user.fullName && user.fullName !== 'Verification Desk' ? user.fullName : '') ||
      String(user.email || '').split('@')[0] || 'User';
  },

  async acceptSession(user, sessionId) {
    if (typeof Store !== 'undefined' && Store._owner && Store._owner !== user.id) Store.detach();
    this.clearPendingOTP();
    this.setSession(user, sessionId);
    if (typeof UserStore !== 'undefined') {
      UserStore.init();
      UserStore.setUser(user);
    }
    if (typeof Store !== 'undefined') await Store.init();
  },

  portalRole() {
    const path = window.location.pathname || window.location.href || '';
    if (/\/lawyer\//.test(path)) return 'lawyer';
    if (/\/user\//.test(path)) return 'user';
    if (/\/admin\//.test(path)) return 'admin';
    return null;
  },

  portalAccessMessage(role = this.getSession()?.role) {
    const labels = { user: 'User / Client', lawyer: 'Lawyer / Advocate', admin: 'Admin' };
    return 'This is a ' + (labels[role] || 'different') + ' account. Open its portal, or sign in with a ' +
      (labels[this.portalRole()] || 'matching') + ' account to use these tools.';
  },

  canUsePortal(role = this.getSession()?.role) {
    if (this.portalRole() === 'admin') return role === 'admin';
    return ['user', 'lawyer', 'admin'].includes(role);
  },

  async refreshSession() {
    const previousOwner = this.getSession()?.id;
    const previousSessionId = this.getSession()?.sessionId;
    const response = await fetch(this.getApiUrl('/api/auth/session'), {
      credentials: 'include', signal: AbortSignal.timeout(90000)
    });
    const data = await response.json().catch(() => ({}));
    if (this.getSession()?.sessionId !== previousSessionId) return this.getSession();
    if (response.status === 401 || response.status === 403) {
      this.clearSession();
      return null;
    }
    if (!response.ok || !data.user?.id || !data.sessionId) {
      throw new Error('Could not confirm your server session. Your saved work is retained; reload and retry.');
    }
    // The HttpOnly cookie identifies the account. A cached local role is never authoritative.
    this.setSession(data.user, data.sessionId);
    if (!this.portalRole() || this.canUsePortal(data.user.role)) {
      if (typeof UserStore !== 'undefined') {
        if (previousOwner !== data.user.id) UserStore.init();
        UserStore.setUser(data.user);
      }
      if (previousOwner !== data.user.id && typeof Store !== 'undefined') await Store.init();
    }
    return data.user;
  },

  GOOGLE_CLIENT_ID: '508760219507-8pn77gjn77ifanpno18tcaoa3qt7klv0.apps.googleusercontent.com',

  googleButtonMarkup() {
    return '<div id="google-signin" style="display:flex;justify-content:center;min-height:44px;max-width:100%"><span role="status">Loading Google sign-in…</span></div>';
  },

  async enterLogin() {
    this.mountGoogleSignIn();
    try {
      const user = await this.refreshSession();
      if (user && this.canUsePortal(user.role) && Router.getPathFromHash() === '/login') {
        Router.navigate(this.portalRole() === 'lawyer' ? '/dashboard' : '/home');
      }
    } catch (_) { /* A connection failure does not remove saved account state. */ }
  },

  async prepareGoogleSignIn() {
    if (!this._googleReady) this._googleReady = (async () => {
      const [response] = await Promise.all([
        fetch(this.getApiUrl('/api/public-config'), { signal: AbortSignal.timeout(90000) }),
        new Promise((resolve, reject) => {
          if (window.google?.accounts?.id) { resolve(); return; }
          const script = document.querySelector('script[src^="https://accounts.google.com/gsi/client"]');
          const finish = (error) => {
            clearTimeout(timer);
            script?.removeEventListener('load', loaded);
            script?.removeEventListener('error', failed);
            if (error) reject(error); else resolve();
          };
          const loaded = () => finish(window.google?.accounts?.id ? null : new Error('Google unavailable'));
          const failed = () => finish(new Error('Google could not load'));
          const timer = setTimeout(failed, 15000);
          if (!script) { failed(); return; }
          script.addEventListener('load', loaded, { once: true });
          script.addEventListener('error', failed, { once: true });
        })
      ]);
      if (!response.ok) throw new Error('Sign-in configuration unavailable');
      const { googleClientId } = await response.json();
      if (!googleClientId) throw new Error('Google sign-in is not configured');
      window.google.accounts.id.initialize({
        client_id: googleClientId, ux_mode: 'popup', auto_select: false,
        button_auto_select: false, use_fedcm_for_button: false,
        callback: credential => this.handleGoogleSignIn(credential, this.portalRole() === 'lawyer' ? 'lawyer' : 'user')
      });
    })();
    try { await this._googleReady; }
    catch (error) { this._googleReady = null; throw error; }
  },

  async mountGoogleSignIn() {
    const host = document.getElementById('google-signin');
    if (!host) return;
    try {
      await this.prepareGoogleSignIn();
      if (!host.isConnected || document.getElementById('google-signin') !== host) return;
      host.replaceChildren();
      window.google.accounts.id.renderButton(host, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
        shape: 'pill', width: String(Math.max(200, Math.min(400, Math.floor(host.getBoundingClientRect().width))))
      });
    } catch (_) {
      if (!host.isConnected || document.getElementById('google-signin') !== host) return;
      host.innerHTML = '<div role="status">Google could not load. Check your connection. ' +
        '<button type="button" onclick="AuthManager.mountGoogleSignIn()">Retry Google sign-in</button></div>';
    }
  },

  getApiUrl(endpoint) {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      if (window.location.port !== '3000' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
        return `${window.location.protocol}//${window.location.hostname}:3000${endpoint}`;
      }
    } else if (window.location.protocol === 'file:') {
      return 'http://localhost:3000' + endpoint;
    }
    return endpoint;
  },

  async authRequest(endpoint, payload, headers = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(this.getApiUrl(endpoint), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload), signal: controller.signal
      });
      const data = await response.json();
      return { response, data };
    } finally { clearTimeout(timeout); }
  },

  async startLawyerDemo() {
    try {
      const { response, data } = await this.authRequest('/api/auth/demo-lawyer', {});
      if (!response.ok || !data.demoMode || !data.user?.id) return { success: false, error: data.error || 'Demo session could not be started.' };
      if (typeof Store !== 'undefined') Store.resetLocal();
      this.clearPendingOTP();
      this.setSession(data.user, data.sessionId);
      return { success: true };
    } catch (_error) {
      return { success: false, error: 'Could not start the demo. Check that the backend is running, then retry.' };
    }
  },

  /* --------------------------------------------------------
     GOOGLE OAUTH 2.0 HANDLER
     -------------------------------------------------------- */
  async handleGoogleSignIn(googleResponse, role = 'user') {
    try {
      if (!googleResponse || !googleResponse.credential) {
        return { success: false, error: 'Google authentication failed.' };
      }

      const { response, data } = await this.authRequest('/api/auth/google', { credential: googleResponse.credential, role });
      if (!response.ok || !data.user) {
        Utils.showToast(data.error || 'Google sign-in failed.', 'error');
        return { success: false, error: data.error || 'Google sign-in failed.' };
      }
      const user = data.user;

      await this.acceptSession(user, data.sessionId);

      Utils.showToast(`Signed in as ${this.displayName(user)}.`, 'success');

      if (role === 'lawyer' || window.location.href.includes('/lawyer/')) {
        Router.navigate('/dashboard');
      } else {
        Router.navigate('/home');
      }

      return { success: true, user };
    } catch (err) {
      Utils.showToast('Google sign-in could not reach the server. Use email and password or retry.', 'error');
      return { success: false, error: 'Failed to process Google sign-in credentials.' };
    }
  },

  /* --------------------------------------------------------
     LOGIN (server round-trip) → direct login or OTP challenge
     -------------------------------------------------------- */
  async login(emailOrPhone, password, rememberMe = true) {
    try {
      const { response: res, data } = await this.authRequest('/api/auth/login',
        { identifier: emailOrPhone, email: emailOrPhone, password, rememberMe, role: this.portalRole() || undefined }, { 'X-LC-Device': this.getDeviceId() });

      if (!res.ok) {
        return { success: false, error: data.error || 'Sign-in failed. Please try again.', reason: data.reason, retryAfterMs: data.retryAfterMs };
      }

      // Direct login when verified and 2FA not required
      if (data.directLogin && data.user?.id && data.sessionId) {
        await this.acceptSession(data.user, data.sessionId);
        return {
          success: true,
          directLogin: true,
          requires2FA: false,
          user: data.user
        };
      }

      if (!data.challengeId) return { success: false, error: 'The server did not start email verification. Please retry.' };
      this._pendingOTPChallenge = {
        id: data.challengeId,
        email: data.email || (emailOrPhone.includes('@') ? emailOrPhone : ''),
        maskedEmail: data.maskedEmail,
        maskedPhone: data.maskedPhone,
        isNewDevice: data.isNewDevice,
        purpose: data.emailNotVerified ? 'registration' : 'login',
        expiresAt: data.expiresAt,
        resendAvailableAt: data.resendAvailableAt
      };
      this.storePendingOTP();

      return {
        success: true,
        directLogin: false,
        requires2FA: true,
        emailNotVerified: !!data.emailNotVerified,
        isNewDevice: data.isNewDevice,
        maskedPhone: data.maskedPhone,
        maskedEmail: data.maskedEmail
      };
    } catch (_e) {
      return { success: false, error: 'Could not connect to sign-in. Check that the backend is running, then retry.' };
    }
  },

  /** Registration phase 1 — email + password triggers the verification email. */
  async registerInitiate(email, password, role = 'user') {
    try {
      const { response: res, data } = await this.authRequest('/api/auth/register-initiate', { email, password, role });

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed.', fieldErrors: data.fieldErrors || {}, reason: data.reason, retryAfterMs: data.retryAfterMs };
      }

      if (!data.challengeId) return { success: false, error: 'The server did not start registration. Please retry.' };
      this._pendingOTPChallenge = {
        id: data.challengeId,
        email: data.email || email,
        maskedEmail: data.maskedEmail || this.maskEmail(email),
        maskedPhone: '',
        isNewDevice: false,
        purpose: 'registration',
        expiresAt: data.expiresAt,
        resendAvailableAt: data.resendAvailableAt
      };
      this.storePendingOTP();

      return { success: true, maskedEmail: data.maskedEmail, expiresAt: data.expiresAt };
    } catch (_e) {
      return { success: false, error: 'Could not start registration. Check the backend connection and retry; no verification code was confirmed as sent.' };
    }
  },

  /** Registration phase 2 — professional credentials after email verification. */
  async registerComplete(formData) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const payload = { ...formData };
      delete payload.confirmPassword;
      delete payload.password;         // set during register-initiate
      delete payload.email;            // immutable once verified

      const res = await fetch(this.getApiUrl('/api/auth/register-complete'), {
        method: 'POST',
        credentials: 'include', // Live Server (:5501) must send the OTP session to :3000.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: res.status === 401
            ? 'Your verification session has expired or is unavailable. Sign in again to finish registration. Your entered details are still on this form.'
            : data.error || 'Registration could not be saved. Please try again.',
          fieldErrors: data.fieldErrors || {}
        };
      }

      if (data.status === 'under_investigation') {
        return { success: false, underInvestigation: true, error: data.message };
      }

      if (data.status !== 'profile_complete' || !data.user) {
        return { success: false, error: 'The server did not confirm registration. Your details are retained; please retry.' };
      }

      // Refresh the local snapshot with the completed profile
      if (data.user) {
        const s = this.getSession();
        if (s) this.setSession(data.user, s.sessionId);
        if (typeof Store !== 'undefined') await Store.refreshFromServer().catch(() => {});
      }
      return { success: true, lawyerId: data.lawyerId, message: data.message };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError'
          ? 'Saving registration took too long. Your details are retained; please retry.'
          : 'Could not connect to the registration server. Check that the backend is running on port 3000, then retry. Your details are retained.'
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  /* --------------------------------------------------------
     OTP VERIFICATION (login 2FA or registration)
     On success the server sets the HttpOnly session cookie.
     -------------------------------------------------------- */
  async verifyOTP(code) {
    if (!this._pendingOTPChallenge) {
      return { success: false, error: 'No verification in progress. Please sign in again.' };
    }
    try {
      const payload = {
        challengeId: this._pendingOTPChallenge.id,
        email: this._pendingOTPChallenge.email,
        otp: code,
        code
      };
      const { response: res, data } = await this.authRequest('/api/auth/verify-otp', payload);

      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Verification failed.',
          attemptsRemaining: data.attemptsRemaining,
          locked: !!data.locked,
          expired: !!data.expired
        };
      }

      if (!data.user?.id || !data.sessionId) return { success: false, error: 'The server did not confirm verification. Please retry.' };
      this.clearPendingOTP();

      // Persist the UI snapshot (the real credential is the cookie).
      this.setSession(data.user, data.sessionId);
      this._deviceConfirmationRequired = !!data.requiresDeviceConfirmation;

      // Hydrate workspace for this account immediately
      if (typeof Store !== 'undefined') await Store.refreshFromServer().catch(() => {});

      return {
        success: true,
        session: this.getSession(),
        requiresDeviceConfirmation: !!data.requiresDeviceConfirmation,
        needsProfileCompletion: !!data.needsProfileCompletion,
        purpose: data.purpose
      };
    } catch (_e) {
      return { success: false, error: 'Verification could not reach the server. Your challenge is retained; check the connection and retry.' };
    }
  },

  async resendOTP() {
    if (!this._pendingOTPChallenge) return { success: false, message: 'No active verification session.' };
    try {
      const payload = {
        challengeId: this._pendingOTPChallenge.id,
        email: this._pendingOTPChallenge.email
      };
      const { response: res, data } = await this.authRequest('/api/auth/resend-otp', payload);
      if (!res.ok) {
        return { success: false, message: data.error || 'Could not resend code.', reason: data.reason, retryAfterMs: data.retryAfterMs };
      }
      this._pendingOTPChallenge.expiresAt = data.expiresAt;
      this._pendingOTPChallenge.resendAvailableAt = data.resendAvailableAt;
      this.storePendingOTP();
      return { success: true, message: 'A fresh 6-digit code was sent to your email.', expiresAt: data.expiresAt, resendAvailableAt: data.resendAvailableAt };
    } catch (_e) {
      return { success: false, message: 'Could not resend the verification code. Check your connection and retry.' };
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
      const res = await fetch(this.getApiUrl('/api/auth/forgot-password'), {
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
      return { sent: true, message: 'If an account exists for this address, a reset link is on its way.' };
    }
  },

  async resetPassword(token, newPassword) {
    try {
      const res = await fetch(this.getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data.error || 'Reset failed.' };
      this.clearSession();
      if (typeof Store !== 'undefined') Store.resetLocal();
      return { success: true };
    } catch (_e) {
      this.clearSession();
      return { success: true };
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

  async fetchTrustedDevices() {
    try {
      const res = await fetch(this.getApiUrl('/api/auth/devices'), { credentials: 'include' });
      if (this.handle401(res)) return [];
      if (!res.ok) return [];
      const data = await res.json();
      return data.devices || [];
    } catch {
      return [];
    }
  },

  async removeTrustedDevice(deviceRowId) {
    try {
      const res = await fetch(this.getApiUrl(`/api/auth/devices/${deviceRowId}`), { method: 'DELETE', credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    }
  },

  /** Central 401 guard for unauthenticated API responses. */
  handle401(res) {
    if (res && res.status === 401 && window.ApiClient && ApiClient.handleAuthFailure) {
      return ApiClient.handleAuthFailure(res);
    }
    return !!(res && res.status === 401);
  },

  /* Legacy no-op shims retained so existing call sites keep working */
  isNewDevice() { return !!this._deviceConfirmationRequired; },
  addTrustedDevice() { /* handled server-side via /auth/device-confirm */ },

  async confirmThisDevice() {
    try {
      const res = await fetch(this.getApiUrl('/api/auth/device-confirm'), { method: 'POST', credentials: 'include' });
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
      const res = await fetch(this.getApiUrl('/api/auth/activity'), { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.activity || [];
    } catch {
      return [];
    }
  },

  async getActiveSessions() {
    try {
      const res = await fetch(this.getApiUrl('/api/auth/sessions'), { credentials: 'include' });
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
      const res = await fetch(this.getApiUrl(`/api/auth/sessions/${sessionId}`), { method: 'DELETE', credentials: 'include' });
      return res.ok;
    } catch { return false; }
  },

  async reportUnrecognizedLogin() {
    try {
      const res = await fetch(this.getApiUrl('/api/auth/incident/unrecognized-login'), { method: 'POST', credentials: 'include' });
      const data = await res.json();
      this.clearSession();
      if (typeof Store !== 'undefined') Store.resetLocal();
      return { ok: res.ok, message: data.message || 'All sessions were terminated for your safety.' };
    } catch {
      this.clearSession();
      return { ok: false, message: 'Sessions cleared locally. Reconnect to finish securing your account.' };
    }
  },

  async changePassword(currentPassword, newPassword) {
    try {
      const res = await fetch(this.getApiUrl('/api/auth/change-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (ApiClient.handleAuthFailure && ApiClient.handleAuthFailure(res)) return { success: false, error: 'Your session ended.' };
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
    if (typeof Store !== 'undefined' && Store.flushPendingSync) await Store.flushPendingSync();
    try {
      const response = await fetch(this.getApiUrl('/api/auth/logout'), {
        method: 'POST', credentials: 'include', signal: AbortSignal.timeout(15000)
      });
      if (!response.ok && response.status !== 401) throw new Error('Sign-out failed');
    } catch {
      Utils.showToast('Could not finish signing out. Your saved work is retained; reconnect and retry.', 'error');
      return false;
    }
    window.google?.accounts?.id?.disableAutoSelect();
    if (typeof Store !== 'undefined') Store.detach();
    if (typeof UserStore !== 'undefined') UserStore._state = {};
    this.clearSession();
    this.clearPendingOTP();
    this._deviceConfirmationRequired = false;
    window.location.hash = '#/login';
    return true;
  },

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
    const session = this.getSession() || {};
    const profile = typeof Store !== 'undefined' ? Store.getState('lawyerProfile') : null;
    return profile?.id === session.id ? { ...session, ...profile } : session;
  }
};

/* Restore an in-progress verification after a page refresh */
AuthManager.restorePendingOTP();
