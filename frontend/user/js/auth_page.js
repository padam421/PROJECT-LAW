/* ============================================================
   Nyay Setu USER — LANGUAGE + WELCOME + AUTH PAGES
   auth_page.js — Language selection, Welcome screen, Login,
   Register, OTP, Security Setup, Privacy Consent
   ============================================================ */

const UserAuthPage = {

  /* ==================== LANGUAGE SELECTION ==================== */
  renderLanguage() {
    const languages = [
      { code: 'en', native: 'English', name: 'English' },
      { code: 'te', native: 'తెలుగు', name: 'Telugu' },
      { code: 'hi', native: 'हिन्दी', name: 'Hindi' },
      { code: 'ta', native: 'தமிழ்', name: 'Tamil' },
      { code: 'kn', native: 'ಕನ್ನಡ', name: 'Kannada' },
      { code: 'ml', native: 'മലയാളം', name: 'Malayalam' },
      { code: 'mr', native: 'मराठी', name: 'Marathi' },
      { code: 'bn', native: 'বাংলা', name: 'Bengali' },
      { code: 'gu', native: 'ગુજરાતી', name: 'Gujarati' },
      { code: 'or', native: 'ଓଡ଼ିଆ', name: 'Odia' },
      { code: 'pa', native: 'ਪੰਜਾਬੀ', name: 'Punjabi' },
      { code: 'ur', native: 'اردو', name: 'Urdu' },
    ];

    const currentLang = UserStore.getLanguage() || 'en';

    return `
      <div class="u-ambient">
        <div class="u-ambient-orb u-ambient-orb-1"></div>
        <div class="u-ambient-orb u-ambient-orb-2"></div>
      </div>
      <div class="u-fullscreen">
        <div class="u-auth-card" style="max-width:640px">
          <div class="u-auth-logo">
            <span class="material-symbols-rounded">translate</span>
          </div>
          <h2 class="u-auth-title">Choose Your Language</h2>
          <p class="u-auth-subtitle">Which language would you like to use?</p>

          <div class="u-lang-grid" id="lang-grid">
            ${languages.map(l => `
              <div class="u-lang-card ${l.code === currentLang ? 'selected' : ''}"
                   onclick="UserAuthPage.selectLanguage('${l.code}')" data-lang="${l.code}">
                <div class="u-lang-native">${l.native}</div>
                <div class="u-lang-name">${l.name}</div>
                <div class="u-lang-check"><span class="material-symbols-rounded">check</span></div>
              </div>
            `).join('')}
          </div>

          <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" style="margin-top:32px"
                  onclick="UserAuthPage.confirmLanguage()">
            Continue
            <span class="material-symbols-rounded" style="font-size:20px">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  },

  selectLanguage(code) {
    UserStore.setLanguage(code);
    document.querySelectorAll('.u-lang-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.lang === code);
    });
  },

  confirmLanguage() {
    Router.navigate('/welcome');
  },

  /* ==================== WELCOME SCREEN ==================== */
  renderWelcome() {
    return `
      <div class="u-ambient">
        <div class="u-ambient-orb u-ambient-orb-1"></div>
        <div class="u-ambient-orb u-ambient-orb-2"></div>
        <div class="u-ambient-orb u-ambient-orb-3"></div>
      </div>
      <div class="u-fullscreen">
        <div class="u-auth-card" style="max-width:540px">
          <div class="u-auth-logo">
            <span class="material-symbols-rounded">balance</span>
          </div>
          <h2 class="u-auth-title">Welcome to Nyay Setu</h2>
          <p class="u-auth-subtitle">You don't need to know legal terms.<br>Just tell us what happened.</p>

          <div class="u-welcome-cards">
            <div class="u-welcome-card" onclick="Router.navigate('/login')">
              <div class="u-welcome-card-icon"><span class="material-symbols-rounded">edit_note</span></div>
              <div class="u-welcome-card-info">
                <div class="u-welcome-card-title">I Have a Legal Problem</div>
                <div class="u-welcome-card-desc">Tell us what happened in your own words.</div>
              </div>
              <span class="material-symbols-rounded u-welcome-card-arrow">chevron_right</span>
            </div>

            <div class="u-welcome-card" onclick="Router.navigate('/login')">
              <div class="u-welcome-card-icon"><span class="material-symbols-rounded">person_search</span></div>
              <div class="u-welcome-card-info">
                <div class="u-welcome-card-title">I Need a Lawyer</div>
                <div class="u-welcome-card-desc">Find a verified lawyer suitable for your case.</div>
              </div>
              <span class="material-symbols-rounded u-welcome-card-arrow">chevron_right</span>
            </div>

            <div class="u-welcome-card" onclick="Router.navigate('/login')">
              <div class="u-welcome-card-icon"><span class="material-symbols-rounded">folder_open</span></div>
              <div class="u-welcome-card-info">
                <div class="u-welcome-card-title">I Already Have a Case</div>
                <div class="u-welcome-card-desc">Understand and prepare for your ongoing case.</div>
              </div>
              <span class="material-symbols-rounded u-welcome-card-arrow">chevron_right</span>
            </div>
          </div>

          <div class="u-auth-link" style="margin-top:28px">
            Already have an account? <a onclick="Router.navigate('/login')">Sign In</a>
          </div>
        </div>
      </div>
    `;
  },

  /* ==================== LOGIN ==================== */
  renderLogin() {
    return `
      <div class="u-ambient">
        <div class="u-ambient-orb u-ambient-orb-1"></div>
        <div class="u-ambient-orb u-ambient-orb-2"></div>
      </div>
      <div class="u-fullscreen">
        <div class="u-auth-card">
          <div class="u-auth-logo">
            <span class="material-symbols-rounded">lock</span>
          </div>
          <h2 class="u-auth-title">Welcome Back</h2>
          <p class="u-auth-subtitle">Sign in to continue to your case.</p>

          <form id="login-form" autocomplete="on" onsubmit="UserAuthPage.handleLogin(event); return false;">
            <div class="u-input-group">
              <label class="u-input-label">Mobile Number / Email</label>
              <div class="u-input-icon-wrap">
                <span class="material-symbols-rounded input-icon">mail</span>
                <input type="text" class="u-input" id="login-email" name="email" placeholder="Enter your email or phone" autocomplete="username">
              </div>
            </div>

            <div class="u-input-group">
              <label class="u-input-label">Password</label>
              <div class="u-input-icon-wrap">
                <span class="material-symbols-rounded input-icon">lock</span>
                <input type="password" class="u-input" id="login-password" name="password" placeholder="Enter your password" autocomplete="current-password"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();UserAuthPage.handleLogin(event);}">
              </div>
            </div>

            <p style="font-size:0.85rem;color:var(--u-text-secondary)">Use your Nyay Setu password, or choose your Gmail account below.</p>
            <div class="u-auth-options">
              <label class="u-check">
                <input type="checkbox" id="remember-me" checked>
                <span class="u-check-label">Remember Me</span>
              </label>
              <span class="u-forgot-link" onclick="Router.navigate('/forgot-password')">Forgot Password?</span>
            </div>

            <button type="submit" class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" id="login-btn">
              <span class="material-symbols-rounded" style="font-size:20px">login</span>
              Sign In
            </button>
          </form>

          <div style="display:flex;align-items:center;gap:12px;margin:18px 0 14px">
            <div style="flex:1;height:1px;background:var(--u-border)"></div>
            <span style="font-size:0.75rem;color:var(--u-text-disabled)">OR</span>
            <div style="flex:1;height:1px;background:var(--u-border)"></div>
          </div>

          ${AuthManager.googleButtonMarkup()}

          <div class="u-auth-link">
            Don't have an account? <a onclick="Router.navigate('/register')">Create Account</a>
          </div>
        </div>
      </div>
    `;
  },

  async handleLogin(e) {
    if (e) { try { e.preventDefault(); } catch(_){} }
    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const btn = document.getElementById('login-btn');

    if (!email || !password) { Utils.showToast('Please fill in all fields.', 'warning'); return; }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner" style="width:20px;height:20px;border-width:2px"></span> Signing in...';
    }

    try {
      const result = await AuthManager.login(email, password, document.getElementById('remember-me')?.checked !== false);

      if (result.success) {
        if (result.directLogin) {
          await UserStore.init();
          Utils.showToast('Welcome back!', 'success');
          Router.navigate('/home');
        } else if (result.requires2FA) {
          // ── DIRECT RENDER OTP screen ──
          const app = document.getElementById('app');
          if (app) {
            const otpHtml = this.renderOTP();
            app.innerHTML = otpHtml;
            Router.currentRoute = '/otp';
            Router.previousRoute = '/login';
            window.history.replaceState(null, '', '#/otp');
            document.title = 'Verify Account — Nyay Setu';
            setTimeout(() => {
              const first = document.getElementById('otp-1');
              if (first) first.focus();
            }, 200);
          }
        }
      } else {
        Utils.showToast(result.error || 'Sign-in failed.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:20px">login</span> Sign In';
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      Utils.showToast('Could not connect to server.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:20px">login</span> Sign In';
      }
    }
  },

  /* ==================== REGISTER ==================== */
  renderRegister() {
    const states = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Gujarat', 'Rajasthan', 'Delhi', 'Uttar Pradesh', 'West Bengal', 'Bihar', 'Punjab', 'Haryana', 'Madhya Pradesh', 'Other'];

    return `
      <div class="u-fullscreen">
        <div class="u-auth-card" style="max-width:500px">
          <div class="u-auth-logo">
            <span class="material-symbols-rounded">person_add</span>
          </div>
          <h2 class="u-auth-title">Create Your Account</h2>
          <p class="u-auth-subtitle">Set up your account to get started.</p>

          <form id="register-form" autocomplete="on" onsubmit="UserAuthPage.handleRegister(event); return false;">
            <div class="u-form-row">
              <div class="u-input-group">
                <label class="u-input-label">Full Name <span class="required">*</span></label>
                <input type="text" class="u-input" id="reg-name" placeholder="Your full name">
              </div>
              <div class="u-input-group">
                <label class="u-input-label">Mobile Number <span class="required">*</span></label>
                <input type="tel" class="u-input" id="reg-phone" placeholder="10-digit mobile">
              </div>
            </div>

            <div class="u-input-group">
              <label class="u-input-label">Email Address <span class="required">*</span></label>
              <input type="email" class="u-input" id="reg-email" name="email" placeholder="your@email.com" autocomplete="username">
            </div>

            <div class="u-form-row">
              <div class="u-input-group">
                <label class="u-input-label">Date of Birth</label>
                <input type="date" class="u-input" id="reg-dob">
              </div>
              <div class="u-input-group">
                <label class="u-input-label">State</label>
                <select class="u-input" id="reg-state">
                  <option value="">Select State</option>
                  ${states.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="u-input-group">
              <label class="u-input-label">City</label>
              <input type="text" class="u-input" id="reg-city" placeholder="Your city">
            </div>

            <div class="u-input-group">
              <label class="u-input-label">Password <span class="required">*</span></label>
              <input type="password" class="u-input" id="reg-password" name="password" placeholder="Create a strong password" autocomplete="new-password"
                     oninput="UserAuthPage.checkPasswordStrength(this.value)">
              <div class="u-pwd-strength" id="pwd-strength">
                <div class="u-pwd-bar" id="pwd-bar-1"></div>
                <div class="u-pwd-bar" id="pwd-bar-2"></div>
                <div class="u-pwd-bar" id="pwd-bar-3"></div>
                <div class="u-pwd-bar" id="pwd-bar-4"></div>
              </div>
              <div class="u-pwd-text" id="pwd-text"></div>
            </div>

            <div class="u-input-group">
              <label class="u-input-label">Confirm Password <span class="required">*</span></label>
              <input type="password" class="u-input" id="reg-confirm" name="confirm-password" placeholder="Confirm your password" autocomplete="new-password"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();UserAuthPage.handleRegister(event);}">
            </div>

            <button type="submit" class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" id="register-btn" style="margin-top:8px">
              Create Account
              <span class="material-symbols-rounded" style="font-size:20px">arrow_forward</span>
            </button>
          </form>

          <div style="display:flex;align-items:center;gap:12px;margin:18px 0 14px">
            <div style="flex:1;height:1px;background:var(--u-border)"></div>
            <span style="font-size:0.75rem;color:var(--u-text-disabled)">OR</span>
            <div style="flex:1;height:1px;background:var(--u-border)"></div>
          </div>

          ${AuthManager.googleButtonMarkup()}

          <div class="u-auth-link">
            Already have an account? <a onclick="Router.navigate('/login')">Sign In</a>
          </div>
        </div>
      </div>
    `;
  },

  checkPasswordStrength(pwd) {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;

    const bars = [1,2,3,4].map(i => document.getElementById(`pwd-bar-${i}`));
    const textEl = document.getElementById('pwd-text');
    const levels = ['', 'weak', 'medium', 'medium', 'strong'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

    bars.forEach((b, i) => {
      b.className = 'u-pwd-bar';
      if (i < score) b.classList.add(levels[score]);
    });

    if (textEl) {
      textEl.className = `u-pwd-text ${levels[score]}`;
      textEl.textContent = labels[score] || '';
    }
  },

  async handleRegister(e) {
    // Block any form submission
    if (e) {
      try { e.preventDefault(); } catch(_){}
      try { e.stopPropagation(); } catch(_){}
    }

    const name = document.getElementById('reg-name')?.value.trim() || '';
    const email = document.getElementById('reg-email')?.value.trim() || '';
    const phone = document.getElementById('reg-phone')?.value.trim() || '';
    const password = document.getElementById('reg-password')?.value || '';
    const confirm = document.getElementById('reg-confirm')?.value || '';
    const btn = document.getElementById('register-btn');

    if (!name || !email || !phone || !password) {
      Utils.showToast('Please fill in all required fields.', 'warning'); return false;
    }
    if (password !== confirm) {
      Utils.showToast('Passwords do not match.', 'error'); return false;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      Utils.showToast('Password must be at least 8 characters with letters & numbers.', 'error'); return false;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner" style="width:20px;height:20px;border-width:2px"></span> Creating...';
    }

    AuthManager._pendingRegistrant = {
      fullName: name,
      phone,
      city: document.getElementById('reg-city')?.value.trim() || '',
      state: document.getElementById('reg-state')?.value || '',
      dob: document.getElementById('reg-dob')?.value || '',
    };
    AuthManager.storePendingRegistrant();

    try {
      const result = await AuthManager.registerInitiate(email, password, 'user');

      if (result.success) {
        Utils.showToast('Verification code sent to your email!', 'success');

        // ── DIRECT RENDER: bypass Router to guarantee OTP screen shows ──
        const app = document.getElementById('app');
        if (app) {
          const otpHtml = this.renderOTP();
          app.innerHTML = otpHtml;
          // Update URL hash silently
          Router.currentRoute = '/otp';
          Router.previousRoute = '/register';
          window.history.replaceState(null, '', '#/otp');
          document.title = 'Verify Account — Nyay Setu';
          // Focus first OTP input
          setTimeout(() => {
            const first = document.getElementById('otp-1');
            if (first) first.focus();
          }, 200);
        }
      } else {
        Utils.showToast(result.error || 'Registration failed.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Create Account <span class="material-symbols-rounded" style="font-size:20px">arrow_forward</span>';
        }
      }
    } catch (err) {
      console.error('Registration initiate error:', err);
      Utils.showToast('Could not connect to server. Please try again.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Create Account <span class="material-symbols-rounded" style="font-size:20px">arrow_forward</span>';
      }
    }
    return false;
  },

  /* ==================== OTP VERIFICATION ==================== */
  renderOTP() {
    AuthManager.restorePendingOTP();
    AuthManager.restorePendingRegistrant();
    const challenge = AuthManager._pendingOTPChallenge || {};
    const masked = challenge.maskedEmail || challenge.email || 'your email';

    return `
      <div class="u-fullscreen">
        <div class="u-auth-card">
          <div class="u-auth-logo">
            <span class="material-symbols-rounded">verified</span>
          </div>
          <h2 class="u-auth-title">Verify Your Account</h2>
          <p class="u-auth-subtitle">We sent a 6-digit verification code to<br><strong style="color:var(--u-primary)">${Utils.escapeHtml(masked)}</strong></p>

          <div style="margin:16px 0;padding:12px 16px;background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.25);border-radius:12px;font-size:0.85rem;color:var(--u-primary);text-align:center;line-height:1.5">
            📬 <strong>Check your Inbox, Spam &amp; Promotions folders</strong><br>
            <span style="font-size:0.78rem;color:var(--u-text-secondary)">A real 6-digit verification code was emailed. Enter it below to proceed.</span>
          </div>

          <div class="u-otp-group" id="otp-group">
            ${[1,2,3,4,5,6].map(i => `
              <input type="text" class="u-otp-input" maxlength="1" id="otp-${i}"
                     oninput="UserAuthPage.handleOTPInput(${i})"
                     onkeydown="UserAuthPage.handleOTPKeydown(event, ${i})"
                     autocomplete="off">
            `).join('')}
          </div>

          <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" id="otp-btn"
                  onclick="UserAuthPage.verifyOTP()">
            <span class="material-symbols-rounded" style="font-size:20px">check_circle</span>
            Verify
          </button>

          <div class="u-otp-timer" style="margin-top:20px">
            Didn't receive a code?
            <a onclick="UserAuthPage.resendOTP()" style="cursor:pointer;font-weight:600">Resend OTP</a>
          </div>
        </div>
      </div>
    `;
  },

  onOTPEnter() {
    if (!AuthManager._pendingOTPChallenge?.id) { Router.navigate('/login'); return; }
    const first = document.getElementById('otp-1');
    if (first) setTimeout(() => first.focus(), 200);
  },

  handleOTPInput(index) {
    const input = document.getElementById(`otp-${index}`);
    if (!input) return;
    input.value = input.value.replace(/\D/g, '').slice(0, 1);
    if (input.value && index < 6) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
    // Auto-verify when all filled
    if (index === 6 && input.value) {
      const code = [1,2,3,4,5,6].map(i => document.getElementById(`otp-${i}`).value).join('');
      if (code.length === 6) this.verifyOTP();
    }
    // Update visual states
    input.classList.toggle('filled', !!input.value);
  },

  handleOTPKeydown(e, index) {
    if (e.key === 'Backspace' && !e.target.value && index > 1) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  },

  async verifyOTP() {
    const code = [1,2,3,4,5,6].map(i => document.getElementById(`otp-${i}`).value).join('');
    if (code.length !== 6) { Utils.showToast('Enter all 6 digits.', 'warning'); return; }

    const btn = document.getElementById('otp-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner" style="width:20px;height:20px;border-width:2px"></span> Verifying...';

    const result = await AuthManager.verifyOTP(code);

    if (result.success) {
      AuthManager.restorePendingRegistrant();
      if (AuthManager._pendingRegistrant) {
        await AuthManager.registerComplete(AuthManager._pendingRegistrant).catch(() => {});
        AuthManager._pendingRegistrant = null;
        try { sessionStorage.removeItem('lc_pending_registrant'); } catch {}
      }
      await UserStore.init();
      Utils.showToast('Account verified successfully!', 'success');
      Router.navigate('/home');
    } else {
      Utils.showToast(result.error || 'Verification failed.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:20px">check_circle</span> Verify';
    }
  },

  async resendOTP() {
    const r = await AuthManager.resendOTP();
    Utils.showToast(r.message || (r.success ? 'Code resent!' : 'Could not resend.'), r.success ? 'success' : 'error');
  },

  /* ==================== SECURITY SETUP ==================== */
  renderSecuritySetup() {
    return `
      <div class="u-fullscreen">
        <div class="u-auth-card" style="max-width:480px">
          <div class="u-auth-logo" style="background:linear-gradient(135deg, var(--u-emerald), #059669)">
            <span class="material-symbols-rounded">shield</span>
          </div>
          <h2 class="u-auth-title">Secure Your Account 🔐</h2>
          <p class="u-auth-subtitle">Your case information and documents are private. Add extra security to protect your account.</p>

          <div class="u-security-options">
            <div class="u-security-option active" onclick="this.classList.toggle('active')">
              <div class="u-security-option-icon"><span class="material-symbols-rounded">security</span></div>
              <div class="u-security-option-info">
                <div class="u-security-option-title">Two-Factor Authentication</div>
                <div class="u-security-option-desc">Verify with OTP every time you sign in</div>
              </div>
            </div>
            <div class="u-security-option" onclick="this.classList.toggle('active')">
              <div class="u-security-option-icon"><span class="material-symbols-rounded">fingerprint</span></div>
              <div class="u-security-option-info">
                <div class="u-security-option-title">Biometric Login</div>
                <div class="u-security-option-desc">Use fingerprint or face ID if supported</div>
              </div>
            </div>
            <div class="u-security-option" onclick="this.classList.toggle('active')">
              <div class="u-security-option-icon"><span class="material-symbols-rounded">mail</span></div>
              <div class="u-security-option-info">
                <div class="u-security-option-title">Recovery Email</div>
                <div class="u-security-option-desc">Add a backup email for account recovery</div>
              </div>
            </div>
            <div class="u-security-option" onclick="this.classList.toggle('active')">
              <div class="u-security-option-icon"><span class="material-symbols-rounded">smartphone</span></div>
              <div class="u-security-option-info">
                <div class="u-security-option-title">Recovery Mobile</div>
                <div class="u-security-option-desc">Add a backup phone number</div>
              </div>
            </div>
          </div>

          <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" style="margin-top:24px"
                  onclick="UserAuthPage.completeSecuritySetup()">
            Continue
            <span class="material-symbols-rounded" style="font-size:20px">arrow_forward</span>
          </button>

          <button class="u-btn u-btn-ghost u-btn-block" style="margin-top:8px"
                  onclick="UserAuthPage.completeSecuritySetup()">
            Skip for now
          </button>
        </div>
      </div>
    `;
  },

  completeSecuritySetup() {
    UserStore.set('securitySetupDone', true);
    if (!UserStore.get('privacyConsentDone')) {
      Router.navigate('/privacy');
    } else {
      Router.navigate('/home');
    }
  },

  /* ==================== PRIVACY & CONSENT ==================== */
  renderPrivacy() {
    return `
      <div class="u-ambient">
        <div class="u-ambient-orb u-ambient-orb-1"></div>
        <div class="u-ambient-orb u-ambient-orb-2"></div>
      </div>
      <div class="u-fullscreen">
        <div class="u-auth-card" style="max-width:500px">
          <div class="u-auth-logo" style="background:linear-gradient(135deg, var(--u-accent), var(--u-cyan))">
            <span class="material-symbols-rounded">privacy_tip</span>
          </div>
          <h2 class="u-auth-title">Your Information Is Private</h2>
          <p class="u-auth-subtitle">Your personal information, case details, documents and conversations are protected.</p>

          <div class="u-privacy-card">
            <h4><span class="material-symbols-rounded" style="font-size:18px;color:var(--u-emerald-light)">lock</span> Your Data Is Secure</h4>
            <p>Information is shared with a lawyer only when you choose to do so. You have full control over what gets shared.</p>
          </div>

          <div class="u-privacy-card">
            <h4><span class="material-symbols-rounded" style="font-size:18px;color:var(--u-accent-light)">smart_toy</span> AI Processing</h4>
            <p>Nyay Setu AI processes your information to help you understand your case. It does not replace professional legal advice.</p>
          </div>

          <div class="u-privacy-links">
            <span class="u-privacy-link" onclick="Utils.showToast('Privacy Policy details will be available soon.', 'info')">Privacy Policy</span>
            <span class="u-privacy-link" onclick="Utils.showToast('Data Usage details will be available soon.', 'info')">Data Usage</span>
            <span class="u-privacy-link" onclick="Utils.showToast('AI Processing details will be available soon.', 'info')">AI Processing Info</span>
            <span class="u-privacy-link" onclick="Utils.showToast('Lawyer Data Access details will be available soon.', 'info')">Lawyer Data Access</span>
          </div>

          <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" style="margin-top:28px"
                  onclick="UserAuthPage.acceptPrivacy()">
            <span class="material-symbols-rounded" style="font-size:20px">check</span>
            I Understand & Continue
          </button>
        </div>
      </div>
    `;
  },

  acceptPrivacy() {
    UserStore.set('privacyConsentDone', true);
    Utils.showToast('Welcome to Nyay Setu!', 'success');
    Router.navigate('/home');
  },

  /* ==================== FORGOT PASSWORD ==================== */
  renderForgotPassword() {
    return `
      <div class="u-ambient">
        <div class="u-ambient-orb u-ambient-orb-1"></div>
      </div>
      <div class="u-fullscreen">
        <div class="u-auth-card">
          <div class="u-auth-logo">
            <span class="material-symbols-rounded">key</span>
          </div>
          <h2 class="u-auth-title">Forgot Password?</h2>
          <p class="u-auth-subtitle">Enter your email and we'll send you a reset link.</p>

          <div class="u-input-group">
            <label class="u-input-label">Email Address</label>
            <input type="email" class="u-input" id="forgot-email" placeholder="your@email.com">
          </div>

          <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill"
                  onclick="UserAuthPage.sendResetLink()">
            Send Reset Link
          </button>

          <div class="u-auth-link">
            <a onclick="Router.navigate('/login')">← Back to Sign In</a>
          </div>
        </div>
      </div>
    `;
  },

  async sendResetLink() {
    const email = document.getElementById('forgot-email')?.value.trim();
    if (!email) { Utils.showToast('Enter your email.', 'warning'); return; }
    const r = await AuthManager.forgotPassword(email);
    Utils.showToast(r.message, r.sent ? 'success' : 'error');
  }
};
