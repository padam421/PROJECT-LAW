/* ============================================================
   Nyay Setu — EMAIL OTP VERIFICATION & NEW DEVICE SECURITY
   otp_page.js — Server-issued 6-digit email code entry with
   auto-advancing inputs, clipboard paste support, a live expiry
   countdown synced to the server, and a resend control that
   respects the real 60-second cooldown / rate limits.
   ------------------------------------------------------------
   The code itself is ONLY ever delivered by email — it is never
   displayed in the UI or returned by the API.
   ============================================================ */

const OTPPage = {
  _timerInterval: null,
  _resendInterval: null,
  _deadline: 0,
  _resendAt: 0,
  _submitting: false,

  /* ---------------- Render ---------------- */
  render() {
    const challenge = AuthManager._pendingOTPChallenge || {};
    const isRegistration = challenge.purpose === 'registration';
    const title = isRegistration ? 'Verify Your Email' : 'Two-Factor Verification';
    const displayEmail = challenge.email || challenge.maskedEmail || 'your email';
    const subtitle = isRegistration
      ? `We emailed a 6-digit security code to <strong>${Utils.escapeHtml(displayEmail)}</strong>. Enter it below to activate your advocate account.`
      : `Enter the 6-digit code sent to your registered email <strong>${Utils.escapeHtml(displayEmail)}</strong>${challenge.maskedPhone ? ` and phone <strong>${Utils.escapeHtml(challenge.maskedPhone)}</strong>` : ''}.`;

    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card">
          <div class="otp-container">
            <div class="otp-icon">
              <span class="material-symbols-rounded">${isRegistration ? 'mark_email_read' : 'phonelink_lock'}</span>
            </div>

            <h2 class="otp-title">${title}</h2>
            <p class="otp-subtitle">${subtitle}</p>

            <div style="margin:16px 0;padding:12px 16px;background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.25);border-radius:12px;font-size:0.85rem;color:var(--color-primary);text-align:center;line-height:1.5">
              📬 <strong>Check your Inbox, Spam &amp; Promotions folders</strong><br>
              <span style="font-size:0.78rem;color:var(--color-gray-600)">A real 6-digit verification code was emailed. Enter it below to proceed.</span>
            </div>

            <div class="otp-alert hidden" id="otp-alert" role="alert"></div>

            <div class="otp-inputs" id="otp-boxes" role="group" aria-label="6-digit verification code">
              ${[0,1,2,3,4,5].map(i => `<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="1" class="otp-input" data-index="${i}" aria-label="Digit ${i+1}">`).join('')}
            </div>

            <div class="otp-timer">
              Code expires in: <span class="time" id="otp-countdown">05:00</span>
            </div>

            <div class="otp-resend">
              Didn't receive it?
              <button type="button" class="otp-resend-btn" id="btn-resend-otp" onclick="OTPPage.handleResend()" disabled>Resend Code</button>
            </div>

            <button id="btn-verify-otp" class="btn btn-primary btn-block btn-lg" onclick="OTPPage.handleVerify()">
              Verify Identity
            </button>
          </div>
        </div>
      </div>
    `;
  },

  onEnter() {
    if (!AuthManager._pendingOTPChallenge) {
      // Deep-linked without an active challenge — send them to sign in.
      Router.navigate('/login');
      return;
    }
    this._submitting = false;
    this.clearAlert();

    // Server-authoritative expiry (grace: fall back to a fresh 5 minutes)
    this._deadline = this.challengeExpiryMs();
    this._resendAt = this.challengeResendMs();
    this.setupInputs();
    this.startTimers();
  },

  onLeave() {
    clearInterval(this._timerInterval);
    clearInterval(this._resendInterval);
  },

  challengeExpiryMs() {
    const c = AuthManager._pendingOTPChallenge || {};
    const t = c.expiresAt ? new Date(c.expiresAt).getTime() : 0;
    return t > Date.now() ? t : Date.now() + 5 * 60 * 1000;
  },

  challengeResendMs() {
    const c = AuthManager._pendingOTPChallenge || {};
    const t = c.resendAvailableAt ? new Date(c.resendAvailableAt).getTime() : 0;
    return t > Date.now() ? t : Date.now(); // already eligible
  },

  /* ---------------- Inputs: auto-advance, paste, keyboard ---------------- */
  setupInputs() {
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 1);
        if (e.target.value) {
          input.classList.add('filled');
          if (index < inputs.length - 1) inputs[index + 1].focus();
          else if ([...inputs].every(i => i.value)) this.handleVerify(); // auto-submit
        } else {
          input.classList.remove('filled');
        }
        this.clearAlert();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) inputs[index - 1].focus();
        if (e.key === 'ArrowLeft' && index > 0) inputs[index - 1].focus();
        if (e.key === 'ArrowRight' && index < inputs.length - 1) inputs[index + 1].focus();
        if (e.key === 'Enter') this.handleVerify();
      });
      input.addEventListener('focus', (e) => e.target.select());
      // Pasting the full 6-digit code fills every box and submits.
      input.addEventListener('paste', (e) => {
        const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!text) return;
        e.preventDefault();
        text.split('').forEach((ch, i) => { if (inputs[i]) { inputs[i].value = ch; inputs[i].classList.add('filled'); } });
        const lastFilled = Math.min(text.length, inputs.length) - 1;
        if (lastFilled >= 0 && lastFilled < inputs.length - 1) inputs[lastFilled + 1].focus();
        if (text.length === 6) this.handleVerify();
      });
    });
    if (inputs[0]) inputs[0].focus();
  },

  /* ---------------- Timers: expiry + resend cooldown ---------------- */
  startTimers() {
    clearInterval(this._timerInterval);
    clearInterval(this._resendInterval);

    const el = document.getElementById('otp-countdown');
    const tickExpiry = () => {
      if (!el) return;
      const remaining = Math.max(0, Math.round((this._deadline - Date.now()) / 1000));
      const minutes = parseInt(remaining / 60, 10);
      const seconds = remaining % 60;
      el.textContent = `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
      if (remaining <= 0) {
        clearInterval(this._timerInterval);
        el.textContent = 'Expired';
        this.showAlert('This code has expired. Tap “Resend Code” to receive a fresh one.', 'warning');
        const inputs = document.querySelectorAll('.otp-input');
        inputs.forEach(i => { i.disabled = true; i.classList.remove('filled'); });
        const btn = document.getElementById('btn-verify-otp');
        if (btn) { btn.disabled = true; btn.innerHTML = 'Code Expired'; }
        const resend = document.getElementById('btn-resend-otp');
        if (resend) resend.focus();
      }
    };
    tickExpiry();
    this._timerInterval = setInterval(tickExpiry, 1000);

    const resendBtn = document.getElementById('btn-resend-otp');
    const tickResend = () => {
      if (!resendBtn) return;
      const remainingMs = this._resendAt - Date.now();
      if (remainingMs > 0) {
        resendBtn.disabled = true;
        const s = Math.ceil(remainingMs / 1000);
        resendBtn.textContent = `Resend available in 0:${s < 10 ? '0' + s : s}`;
      } else {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
        clearInterval(this._resendInterval);
      }
    };
    tickResend();
    if (this._resendAt > Date.now()) this._resendInterval = setInterval(tickResend, 1000);
  },

  /* ---------------- Alerts ---------------- */
  showAlert(message, kind = 'error') {
    const box = document.getElementById('otp-alert');
    if (!box) return;
    const icons = { error: 'error', warning: 'warning', info: 'info', success: 'check_circle' };
    box.className = `otp-alert otp-alert-${kind}`;
    box.innerHTML = `<span class="material-symbols-rounded icon-sm">${icons[kind] || 'error'}</span><span>${Utils.escapeHtml(message)}</span>`;
  },

  clearAlert() {
    const box = document.getElementById('otp-alert');
    if (box) { box.className = 'otp-alert hidden'; box.innerHTML = ''; }
  },

  /* ---------------- Verify ---------------- */
  readCode() {
    let code = '';
    document.querySelectorAll('.otp-input').forEach(i => code += i.value);
    return code;
  },

  setBusy(busy) {
    this._submitting = busy;
    const btn = document.getElementById('btn-verify-otp');
    if (btn) {
      btn.disabled = busy;
      btn.innerHTML = busy
        ? '<div class="loading-dots"><span></span><span></span><span></span></div>'
        : 'Verify Identity';
    }
    document.querySelectorAll('.otp-input').forEach(i => { i.disabled = busy; });
  },

  resetBoxes() {
    document.querySelectorAll('.otp-input').forEach(i => { i.disabled = false; i.value = ''; i.classList.remove('filled'); });
    const first = document.querySelector('.otp-input');
    if (first) first.focus();
  },

  async handleVerify() {
    if (this._submitting) return;
    const code = this.readCode();

    if (code.length < 6) {
      this.showAlert('Enter all six digits of the code from your email.', 'warning');
      Utils.showToast('Enter the complete 6-digit code.', 'warning');
      return;
    }

    this.setBusy(true);

    const res = await AuthManager.verifyOTP(code);

    if (res.success) {
      this.onLeave();
      if (res.requiresDeviceConfirmation) {
        Router.navigate('/device-check');
        return;
      }
      if (res.needsProfileCompletion) {
        // Registration (or resumed signup): email verified, profile still pending.
        Utils.showToast('Email verified successfully! Complete your advocate profile.', 'success');
        Router.navigate('/register');
        return;
      }
      ApiClient.startReminderEngine();
      Utils.showToast('Identity verified. Welcome back, Advocate!', 'success');
      Router.navigate('/dashboard');
      return;
    }

    // ---- Failure states (informative, actionable) ----
    document.querySelectorAll('.otp-input').forEach(i => {
      i.classList.add('error');
      setTimeout(() => i.classList.remove('error'), 600);
    });

    if (res.locked || res.expired) {
      this.showAlert(res.error, 'error');
      Utils.showToast(res.error, 'error');
      this.setBusy(false);
      this.resetBoxes();
      // A locked/expired code can only be replaced by a fresh send —
      // make the resend control immediately available when allowed.
      if (res.expired) this._resendAt = Date.now();
      this.startTimers();
      return;
    }

    const left = typeof res.attemptsRemaining === 'number'
      ? ` ${res.attemptsRemaining} attempt${res.attemptsRemaining === 1 ? '' : 's'} remaining before this code locks.`
      : '';
    this.showAlert(res.error + left, 'error');
    Utils.showToast(res.error, 'error');
    this.setBusy(false);
    this.resetBoxes();
  },

  /* ---------------- Resend (60s cooldown + flood limits) ---------------- */
  async handleResend() {
    const btn = document.getElementById('btn-resend-otp');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>'; }

    const res = await AuthManager.resendOTP();

    if (res.success) {
      this.clearAlert();
      Utils.showToast('A fresh 6-digit code is on its way to your inbox.', 'success');
      this._deadline = res.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + 5 * 60 * 1000;
      this._resendAt = res.resendAvailableAt ? new Date(res.resendAvailableAt).getTime() : Date.now() + 60 * 1000;
      this.resetBoxes();
      this.startTimers();
      return;
    }

    // Rate limited / too soon / provider issue
    const retrySecs = res.retryAfterMs ? Math.ceil(res.retryAfterMs / 1000) : null;
    this.showAlert(
      retrySecs
        ? `${res.message || 'Please wait before requesting another code.'} You can retry in ${retrySecs}s.`
        : (res.message || 'Could not resend the code right now.'),
      res.reason === 'rate_limited' ? 'warning' : 'error'
    );
    Utils.showToast(res.message || 'Could not resend.', 'error');

    if (retrySecs) {
      this._resendAt = Date.now() + res.retryAfterMs;
      this.startTimers();
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = 'Resend Code';
    }
  },

  /* --------------------------------------------------------
     NEW DEVICE CONFIRMATION
     -------------------------------------------------------- */
  renderDeviceCheck() {
    const dev = AuthManager.getDeviceInfo();
    const now = new Date();
    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card">
          <div class="device-check">
            <div class="device-check-icon">
              <span class="material-symbols-rounded">devices_other</span>
            </div>

            <h2 class="otp-title">New Device Detected</h2>
            <p class="otp-subtitle">This is the first sign-in from this device. Confirm below so future sign-ins here skip this extra check.</p>

            <div class="device-info-card">
              <div class="device-info-row">
                <span class="material-symbols-rounded">computer</span>
                <span class="device-info-label">Device:</span>
                <span class="device-info-value">${Utils.escapeHtml(dev.deviceType)} (${Utils.escapeHtml(dev.browser)} on ${Utils.escapeHtml(dev.os)})</span>
              </div>
              <div class="device-info-row">
                <span class="material-symbols-rounded">location_on</span>
                <span class="device-info-label">Approx. location:</span>
                <span class="device-info-value">${Utils.escapeHtml(dev.location)}</span>
              </div>
              <div class="device-info-row">
                <span class="material-symbols-rounded">schedule</span>
                <span class="device-info-label">Time:</span>
                <span class="device-info-value">${Utils.formatDateTime(now)}</span>
              </div>
            </div>

            <div class="d-flex justify-center gap-3 mt-6 flex-wrap">
              <button class="btn btn-danger" onclick="OTPPage.handleDenyDevice()">This wasn't me</button>
              <button class="btn btn-primary" onclick="OTPPage.handleApproveDevice()">Yes, this is me</button>
            </div>

            <p class="text-body-sm text-muted mt-4" style="text-align:center">
              Choosing “This wasn't me” immediately terminates all sessions, locks sensitive account actions,
              and alerts the security desk.
            </p>
          </div>
        </div>
      </div>
    `;
  },

  async handleApproveDevice() {
    await AuthManager.confirmThisDevice();
    ApiClient.startReminderEngine();
    Utils.showToast('Device confirmed and added to your trusted devices.', 'success');
    Router.navigate('/dashboard');
  },

  async handleDenyDevice() {
    ApiClient.stopReminderEngine();
    const res = await AuthManager.reportUnrecognizedLogin();
    window.location.hash = '#/login';
    setTimeout(() => Utils.showToast(res.message || 'All sessions terminated for your safety.', 'warning'), 500);
  }
};
