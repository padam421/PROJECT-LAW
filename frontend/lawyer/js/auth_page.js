/* ============================================================
   LEGALCONNECT — AUTHENTICATION PAGES
   auth_page.js — Role Selection, Login, and Forgot Password
   ============================================================ */

const AuthPage = {
  /* --------------------------------------------------------
     ROLE SELECTION (Point 2)
     -------------------------------------------------------- */
  renderRoleSelect() {
    return `
      <div class="fullscreen-page">
        <div class="role-selection">
          <div class="login-logo">
            <div class="login-logo-icon">
              <span class="material-symbols-rounded">balance</span>
            </div>
            <div class="login-logo-text" style="color:var(--color-white)">LegalConnect</div>
          </div>
          <h2 class="role-question">How would you like to use LegalConnect?</h2>
          <p class="role-hint">Select your role to access customized legal tools, workflows and simulated courtrooms</p>

          <div class="role-cards">
            <!-- User / Client Role -->
            <div class="role-card" onclick="Utils.showToast('Client Portal is under preparation. Please select Lawyer / Advocate to explore the portal.', 'info')">
              <div class="role-card-icon">
                <span class="material-symbols-rounded">person</span>
              </div>
              <h3 class="role-card-title">User / Client</h3>
              <p class="role-card-desc">Find top verified advocates, get AI legal assistance & book virtual consultations</p>
              <button class="btn btn-secondary btn-sm mt-4 w-full">I am a Client</button>
            </div>

            <!-- Lawyer / Advocate Role -->
            <div class="role-card" onclick="Router.navigate('/login')">
              <div class="role-card-icon">
                <span class="material-symbols-rounded">gavel</span>
              </div>
              <h3 class="role-card-title">Lawyer / Advocate</h3>
              <p class="role-card-desc">Manage clients, virtual court hearings, case dossiers, litigation pipelines & earnings</p>
              <button class="btn btn-accent btn-sm mt-4 w-full">I am a Lawyer / Advocate</button>
            </div>
          </div>

          <div class="mt-8 text-center" style="color:rgba(255,255,255,0.7);font-size:var(--text-body-sm)">
            New Advocate to LegalConnect? 
            <a onclick="Router.navigate('/register')" style="color:var(--color-accent-lighter);font-weight:600;cursor:pointer;text-decoration:underline">
              Start Advocate Registration →
            </a>
          </div>
        </div>
      </div>
    `;
  },

  /* --------------------------------------------------------
     LOGIN PAGE (Point 3)
     -------------------------------------------------------- */
  renderLogin() {
    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card">
          <div class="login-logo">
            <div class="login-logo-icon">
              <span class="material-symbols-rounded">gavel</span>
            </div>
            <div class="login-logo-text">LegalConnect</div>
          </div>

          <h2 class="login-title">Advocate Practice Portal</h2>
          <p class="login-subtitle">Sign in to manage your cases, hearings & clients</p>

          <form class="login-form" onsubmit="AuthPage.handleLogin(event)">
            <div class="form-group">
              <label class="form-label">Registered Email or Mobile Number</label>
              <div class="input-icon-wrapper">
                <input type="text" id="login-identifier" class="form-input" placeholder="you@example.com or 9876543210" autocomplete="username" required>
                <span class="material-symbols-rounded input-icon">mail</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="input-icon-wrapper">
                <input type="password" id="login-password" class="form-input" placeholder="Enter your password" autocomplete="current-password" required>
                <span class="material-symbols-rounded input-icon">lock</span>
              </div>
            </div>

            <div class="login-extras">
              <label class="login-remember">
                <input type="checkbox" id="login-remember" checked>
                Remember Me
              </label>
              <a class="login-forgot" onclick="Router.navigate('/forgot-password')">Forgot Password?</a>
            </div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block btn-lg">
              Sign In to Practice
            </button>
          </form>

          <div class="login-divider">
            <span>New to LegalConnect?</span>
          </div>

          <a class="btn btn-accent btn-block btn-lg" href="#/register" style="text-align:center">
            Create your Advocate Account
          </a>

          <div class="login-footer">
            Don't have an advocate account? 
            <a onclick="Router.navigate('/register')" style="font-weight:600">Register as Lawyer →</a>
          </div>
        </div>
      </div>
    `;
  },

  async handleLogin(e) {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;
    const submitBtn = document.getElementById('btn-login-submit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

    const result = await AuthManager.login(identifier, password, remember);

    if (result.success) {
      Utils.showToast('Credentials authenticated. Completing 2FA OTP verification...', 'info');
      Router.navigate('/otp');
    } else {
      Utils.showToast(result.error || 'Authentication failed', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In to Practice';
    }
  },

  /* --------------------------------------------------------
     FORGOT PASSWORD
     -------------------------------------------------------- */
  renderForgotPassword() {
    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card">
          <div class="forgot-back" onclick="Router.navigate('/login')">
            <span class="material-symbols-rounded">arrow_back</span> Back to Login
          </div>

          <div class="forgot-icon">
            <span class="material-symbols-rounded">lock_reset</span>
          </div>

          <h2 class="login-title">Reset Password</h2>
          <p class="login-subtitle">Enter your registered email to receive a password recovery link</p>

          <form id="forgot-form" onsubmit="AuthPage.handleForgotSubmit(event)">
            <div class="form-group">
              <label class="form-label">Registered Email</label>
              <div class="input-icon-wrapper">
                <input type="email" id="forgot-email" class="form-input" placeholder="you@example.com" autocomplete="email" required>
                <span class="material-symbols-rounded input-icon">mail</span>
              </div>
            </div>

            <button type="submit" id="btn-forgot-submit" class="btn btn-primary btn-block btn-lg">Send Reset Link</button>
          </form>
        </div>
      </div>
    `;
  },

  async handleForgotSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('btn-forgot-submit');
    if (!Utils.validateEmail(email)) {
      Utils.showToast('Enter a valid email address.', 'warning');
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    const res = await AuthManager.forgotPassword(email);
    btn.disabled = false;
    btn.innerHTML = 'Send Reset Link';

    if (!res.sent) {
      Utils.showToast(res.message || 'Could not send the reset email right now.', 'error');
      return;
    }
    const card = document.querySelector('.fullscreen-card');
    card.innerHTML = `
      <div class="forgot-success">
        <div class="forgot-success-icon">
          <span class="material-symbols-rounded">mark_email_read</span>
        </div>
        <h2 class="login-title">Check Your Inbox</h2>
        <p class="login-subtitle">${Utils.escapeHtml(res.message)}</p>
        <button class="btn btn-primary btn-block mt-6" onclick="Router.navigate('/login')">Return to Sign In</button>
      </div>
    `;
  },

  /* --------------------------------------------------------
     RESET PASSWORD (reached via emailed link)
     -------------------------------------------------------- */
  renderResetPassword() {
    const token = new URLSearchParams((window.location.hash.split('?')[1] || '')).get('token') || '';
    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card">
          <div class="forgot-back" onclick="Router.navigate('/login')">
            <span class="material-symbols-rounded">arrow_back</span> Back to Login
          </div>

          <div class="forgot-icon">
            <span class="material-symbols-rounded">lock_reset</span>
          </div>

          <h2 class="login-title">Set a New Password</h2>
          <p class="login-subtitle">Choose a strong password for your advocate account</p>

          ${!token ? `
            <div class="verify-result error">
              <span class="material-symbols-rounded">link_off</span>
              <div>
                <div class="verify-result-text">Reset link invalid</div>
                <div class="text-body-sm">This link is missing its security token. Please request a fresh reset email.</div>
              </div>
            </div>
            <button class="btn btn-primary btn-block mt-6" onclick="Router.navigate('/forgot-password')">Request New Link</button>
          ` : `
          <form id="reset-form" onsubmit="AuthPage.handleResetSubmit(event, '${encodeURIComponent(token)}')">
            <div class="form-group">
              <label class="form-label" for="reset-pass">New Password</label>
              <div class="input-icon-wrapper">
                <input type="password" id="reset-pass" class="form-input" placeholder="Min 8 characters with letters & numbers" autocomplete="new-password" minlength="8" required>
                <span class="material-symbols-rounded input-icon">key</span>
              </div>
              <span class="form-hint">At least 8 characters, including letters and numbers</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="reset-confirm">Confirm New Password</label>
              <div class="input-icon-wrapper">
                <input type="password" id="reset-confirm" class="form-input" placeholder="Re-enter new password" autocomplete="new-password" minlength="8" required>
                <span class="material-symbols-rounded input-icon">key</span>
              </div>
            </div>

            <button type="submit" id="btn-reset-submit" class="btn btn-primary btn-block btn-lg">Update Password</button>
          </form>`}
        </div>
      </div>
    `;
  },

  async handleResetSubmit(e, encodedToken) {
    e.preventDefault();
    const token = decodeURIComponent(encodedToken);
    const password = document.getElementById('reset-pass').value;
    const confirm = document.getElementById('reset-confirm').value;
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      Utils.showToast('Password needs 8+ characters with letters and numbers.', 'warning');
      return;
    }
    if (password !== confirm) {
      Utils.showToast('Passwords do not match.', 'warning');
      return;
    }
    const btn = document.getElementById('btn-reset-submit');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    const res = await AuthManager.resetPassword(token, password);
    if (res.success) {
      Utils.showModal(
        '<p>Your password has been updated and all previous sessions were signed out. Sign in with your new password to continue.</p>',
        { title: 'Password Updated',
          actions: [{ text: 'Sign In Now', class: 'btn btn-primary', onclick: 'Utils.hideModal(); Router.navigate("/login");' }] }
      );
    } else {
      btn.disabled = false;
      btn.innerHTML = 'Update Password';
      Utils.showToast(res.error || 'Could not reset the password.', 'error');
    }
  }
};
