/* ============================================================
   Nyay Setu — ADVOCATE REGISTRATION
   register_page.js — Real-world signup flow, wired end-to-end:
     Phase 1  Email + password  → /api/auth/register-initiate
     Phase 2  6-digit email OTP (separate /otp screen)
     Phase 3  Personal + professional profile →
              /api/auth/register-complete → verification pipeline
   ============================================================ */

const RegisterPage = {
  /* Staged profile data (phase 3) */
  _data: {
    fullName: '',
    professionalName: '',
    dob: '',
    gender: 'Male',
    phone: '',
    address: '',
    city: '',
    state: 'Delhi',
    profilePhotoData: null,
    barCouncil: '',
    stateBarCouncil: 'Bar Council of Delhi',
    enrollmentDate: '',
    qualification: '',
    university: '',
    yearsOfPractice: null,
    practiceType: 'Independent Advocate & Litigation Counsel',
    primarySpecialization: 'Criminal Law',
    additionalSpecializations: [],
    courts: [],
    languages: []
  },
  _fieldErrors: {},
  _submitting: false,
  _draftOwner: null,

  /* ---------------- Route entry ---------------- */
  onEnter() {
    // Signed-in advocates with finished profiles don't belong here.
    const session = AuthManager.getSession();
    if (AuthManager.isLoggedIn() && session && (session.role !== 'lawyer' || session.registrationStage === 'complete')) {
      Router.navigate('/dashboard');
    }
  },

  /** Which phase renders? */
  currentPhase() {
    if (AuthManager.isLoggedIn()) {
      const s = AuthManager.getSession();
      if (s?.role !== 'lawyer') return 'done';
      return (s && s.registrationStage && s.registrationStage !== 'complete') ? 'profile' : 'done';
    }
    // Mid-signup: an email verification is pending → point at the OTP screen.
    const pending = AuthManager._pendingOTPChallenge;
    if (pending && pending.purpose === 'registration') return 'awaiting_otp';
    return 'credentials';
  },

  render() {
    this._defaults ||= JSON.parse(JSON.stringify(this._data));
    const phase = this.currentPhase();
    if (phase === 'done') {
      setTimeout(() => Router.navigate('/dashboard'), 0);
      return `<div class="fullscreen-page"><div class="fullscreen-card">
        <p class="login-subtitle" style="text-align:center">Your account is already set up — taking you to the dashboard…</p>
      </div></div>`;
    }
    if (phase === 'awaiting_otp') return this.renderAwaitingOtp();
    if (phase === 'profile') { this.restoreDraft(); return this.renderProfileForm(); }
    return this.renderCredentials();
  },

  shell(inner) {
    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card fullscreen-card-wide">
          <div class="register-container">
            <div class="register-header">
              <div class="login-logo mb-2">
                <div class="login-logo-icon">
                  <span class="material-symbols-rounded">gavel</span>
                </div>
                <div class="login-logo-text">Nyay Setu</div>
              </div>
              ${inner.header}
            </div>
            ${inner.body}
          </div>
        </div>
      </div>
    `;
  },

  stepper(step) {
    // step 1 = Account credentials, step 2 = Profile details
    return `
      <div class="register-stepper" role="list" aria-label="Registration progress">
        <div class="register-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}" role="listitem">
          <div class="register-step-circle">${step > 1 ? '✓' : '1'}</div>
          <div class="register-step-label">Account Security</div>
        </div>
        <div class="register-step-line"></div>
        <div class="register-step ${step >= 2 ? 'active' : ''}" role="listitem">
          <div class="register-step-circle">2</div>
          <div class="register-step-label">Professional Details (optional)</div>
        </div>
      </div>
    `;
  },

  fieldError(id) {
    const msg = this._fieldErrors[id];
    return msg ? `<span class="form-error-text" data-registration-error="${id}"><span class="material-symbols-rounded icon-sm">error</span> ${Utils.escapeHtml(msg)}</span>` : '';
  },

  /* ============================================================
     PHASE 1 — Email + Password (spec Step 1 screen)
     ============================================================ */
  renderCredentials() {
    return this.shell({
      header: `
        <h2 class="register-title">Advocate Registration</h2>
        <p class="register-subtitle">Create your account with email &amp; password — we'll verify your email with a secure 6-digit code</p>`,
      body: `
        ${this.stepper(1)}
        <div class="doc-comparison-banner">
          <span class="material-symbols-rounded">science</span>
          <div><strong>Hackathon demo — sample data is welcome.</strong><br>No real lawyer, email code, Bar certificate or selfie needed. This creates an unverified demo profile.</div>
          <button type="button" class="btn btn-accent" id="start-lawyer-demo" onclick="RegisterPage.startDemo()">Start Demo — No OTP</button>
        </div>
        <form id="register-form" onsubmit="RegisterPage.handleCredentialsSubmit(event); return false;" novalidate>
          <div class="form-grid">
            <div class="form-group form-grid-full">
              <label class="form-label" for="reg-email">Email Address <span class="required">*</span></label>
              <div class="input-icon-wrapper">
                <input type="email" id="reg-email" class="form-input ${this._fieldErrors.email ? 'input-error' : ''}"
                       placeholder="advocate@example.com" autocomplete="email" required>
                <span class="material-symbols-rounded input-icon">mail</span>
              </div>
              <span class="form-hint">Verification codes and case updates arrive here</span>
              ${this.fieldError('email')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-password">Password <span class="required">*</span></label>
              <div class="input-icon-wrapper">
                <input type="password" id="reg-password" class="form-input ${this._fieldErrors.password ? 'input-error' : ''}"
                       placeholder="Minimum 8 characters" minlength="8" required autocomplete="new-password">
                <span class="material-symbols-rounded input-icon">key</span>
              </div>
              <span class="form-hint">At least 8 characters, including letters and numbers</span>
              ${this.fieldError('password')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-confirm-password">Confirm Password <span class="required">*</span></label>
              <div class="input-icon-wrapper">
                <input type="password" id="reg-confirm-password" class="form-input ${this._fieldErrors.confirmPassword ? 'input-error' : ''}"
                       placeholder="Re-enter password" minlength="8" required autocomplete="new-password"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();RegisterPage.handleCredentialsSubmit(event);}">
                <span class="material-symbols-rounded input-icon">key</span>
              </div>
              ${this.fieldError('confirmPassword')}
            </div>
          </div>

          <div class="doc-comparison-banner">
            <span class="material-symbols-rounded">lock</span>
            <span><strong>Your credentials are protected:</strong> passwords are hashed with bcrypt and never stored in plain text. The next step confirms you own this email address.</span>
          </div>

          <div id="credentials-feedback" class="register-feedback" role="alert" hidden></div>
          <div class="register-nav">
            <button type="button" class="btn btn-ghost" onclick="Router.navigate('/login')">
              Already registered? Sign in
            </button>
            <button type="submit" class="btn btn-primary btn-lg" ${this._submitting ? 'disabled' : ''}>
              ${this._submitting ? '<div class="loading-dots"><span></span><span></span><span></span></div>' : 'Continue → Email Verification'}
            </button>
          </div>
        </form>`
    });
  },

  async handleCredentialsSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;
    this._fieldErrors = {};

    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm-password').value;

    if (!Utils.validateEmail(email)) this._fieldErrors.email = 'Enter a valid email address';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      this._fieldErrors.password = 'At least 8 characters with letters and numbers';
    }
    if (password !== confirm) this._fieldErrors.confirmPassword = 'Passwords do not match';

    if (Object.keys(this._fieldErrors).length) {
      this.showCredentialsFeedback('Please correct the highlighted fields.', this._fieldErrors);
      return;
    }

    this.showCredentialsFeedback('', {});
    this._submitting = true;
    const submitBtn = document.querySelector('#register-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span> Sending code...';
    }

    try {
      const result = await AuthManager.registerInitiate(email, password, 'lawyer');
      if (result.success) {
        Utils.showToast('Verification code sent — check your inbox.', 'success');
        Router.navigate('/otp');
      } else {
        this._fieldErrors = result.fieldErrors || {};
        this.showCredentialsFeedback(result.error || 'Registration could not be started. Please retry.', this._fieldErrors);
      }
    } catch (_error) {
      this.showCredentialsFeedback('Registration could not be started. Please retry.', {});
    } finally {
      this._submitting = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Continue → Email Verification'; }
    }
  },

  /* ============================================================
     PHASE INTERSTITIAL — waiting for the emailed code
     ============================================================ */
  renderAwaitingOtp() {
    const masked = AuthManager.maskEmail(AuthManager._pendingOTPChallenge?.maskedEmail || '');
    return this.shell({
      header: `
        <h2 class="register-title">Confirm Your Email</h2>
        <p class="register-subtitle">One quick check before we build your advocate profile</p>`,
      body: `
        <div class="forgot-success">
          <div class="forgot-success-icon">
            <span class="material-symbols-rounded">mark_email_read</span>
          </div>
          <h3 class="login-title" style="font-size:var(--text-title)">Check Your Inbox</h3>
          <p class="login-subtitle">We sent a 6-digit security code${masked ? ` to <strong>${Utils.escapeHtml(masked)}</strong>` : ''}.
          Enter it to activate your account.</p>
          <button class="btn btn-primary btn-block mt-6" onclick="Router.navigate('/otp')">Enter Verification Code</button>
        </div>`
    });
  },

  /* ============================================================
     PHASE 3 — Profile details (after email verified)
     ============================================================ */
  renderProfileForm() {
    const d = this._data;
    const demo = AuthManager.getSession()?.demoMode === true;
    const states = ['Delhi', 'Maharashtra', 'Karnataka', 'Uttar Pradesh', 'Tamil Nadu', 'Telangana', 'Gujarat', 'West Bengal', 'Rajasthan', 'Kerala', 'Punjab', 'Haryana', 'Madhya Pradesh', 'Bihar', 'Odisha', 'Assam', 'Andhra Pradesh', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'Himachal Pradesh', 'Goa'];
    const specializationsList = ['Criminal Law', 'Civil Law', 'Cyber Law', 'Corporate Law', 'Family & Matrimonial', 'Constitutional Law', 'Taxation Law', 'Consumer Disputes', 'Arbitration & Mediation'];
    const courtsList = ['Supreme Court of India', 'High Court of Delhi', 'District & Sessions Court', 'NCLT / NCLAT', 'Consumer Disputes Redressal Commission', 'Debt Recovery Tribunal (DRT)', 'Family Court', 'Sessions Court'];
    const languagesList = ['English', 'Hindi', 'Telugu', 'Tamil', 'Punjabi', 'Bengali', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Odia', 'Urdu'];
    const councils = ['Bar Council of Delhi', 'Bar Council of Maharashtra & Goa', 'Bar Council of Karnataka', 'Bar Council of Uttar Pradesh', 'Bar Council of Tamil Nadu & Puducherry', 'Bar Council of Telangana', 'Bar Council of Gujarat', 'Bar Council of West Bengal', 'Bar Council of Rajasthan', 'Bar Council of Kerala', 'Bar Council of Punjab & Haryana', 'Bar Council of Madhya Pradesh', 'Bar Council of Bihar', 'Bar Council of Odisha', 'Bar Council of Andhra Pradesh', 'Bar Council of Assam', 'Bar Council of Jharkhand', 'Bar Council of Chhattisgarh', 'Bar Council of Uttarakhand', 'Bar Council of Himachal Pradesh'];

    const html = this.shell({
      header: `
        <h2 class="register-title">${demo ? 'Demo Advocate Profile' : 'Complete Your Advocate Profile'}</h2>
        <p class="register-subtitle">${demo ? 'All professional fields are optional. Use sample or random details; this is not a professionally verified account.' : 'Email verified ✓ — add your professional credentials for Bar Council verification'}</p>`,
      body: `
        ${this.stepper(2)}
        <div class="doc-comparison-banner">
          <span class="material-symbols-rounded">${demo ? 'science' : 'verified_user'}</span>
          <span>${demo ? '<strong>Demo mode:</strong> no credentials or documents are required. Sample details will not earn a Verified Advocate badge.' : '<strong>Official Document Match:</strong> the legal name, enrollment number and dates entered here will be compared with your Bar Council certificate and government ID during verification.'}</span>
        </div>
        <button type="button" class="btn btn-secondary mb-3" ${demo ? '' : 'id="start-lawyer-demo"'} onclick="${demo ? 'RegisterPage.fillSampleProfile()' : 'RegisterPage.startDemo()'}">${demo ? 'Fill Sample Details (optional)' : 'Use Demo Mode Instead'}</button>

        <form id="register-form" onsubmit="RegisterPage.handleProfileSubmit(event); return false;" oninput="RegisterPage.cacheDraft()" onchange="RegisterPage.cacheDraft()" novalidate>
          <!-- Personal details -->
          <h4 class="card-title mt-4 mb-3 d-flex items-center gap-2">
            <span class="material-symbols-rounded text-accent">person</span> Personal Details
          </h4>
          <div class="form-grid">
            <div class="photo-upload">
              <div class="photo-preview ${d.profilePhotoData ? 'has-photo' : ''}" onclick="document.getElementById('profile-photo-input').click()" title="Upload profile photograph" role="button" tabindex="0" aria-label="Upload profile photograph">
                ${d.profilePhotoData
                  ? `<img src="${d.profilePhotoData}" alt="Profile photo preview">`
                  : '<span class="material-symbols-rounded">add_a_photo</span><span style="font-size:11px;color:var(--color-gray-500);margin-top:2px">Upload Photo</span>'}
              </div>
              <input type="file" id="profile-photo-input" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="RegisterPage.handlePhotoUpload(event)">
              <span class="photo-label">Profile Photograph <span style="color:var(--color-gray-400)">(optional)</span></span>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-fullname">Full Legal Name <span class="required">*</span></label>
              <input type="text" id="reg-fullname" class="form-input ${this._fieldErrors.fullName ? 'input-error' : ''}" placeholder="Exactly as on your enrollment certificate" value="${Utils.escapeHtml(d.fullName)}" required>
              <span class="form-hint">Must match your official Bar Council Enrollment Certificate</span>
              ${this.fieldError('fullName')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-profname">Professional Display Name</label>
              <input type="text" id="reg-profname" class="form-input" placeholder="e.g. Adv. R.K. Sharma" value="${Utils.escapeHtml(d.professionalName)}">
              <span class="form-hint">Shown to clients. Your legal name stays authoritative.</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-dob">Date of Birth <span class="required">*</span></label>
              <input type="date" id="reg-dob" class="form-input ${this._fieldErrors.dob ? 'input-error' : ''}" value="${d.dob}" max="${new Date().toISOString().split('T')[0]}" required>
              ${this.fieldError('dob')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-gender">Gender <span class="required">*</span></label>
              <select id="reg-gender" class="form-select" required>
                <option value="Male" ${d.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${d.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${d.gender === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-phone">Mobile Number <span class="required">*</span></label>
              <input type="tel" id="reg-phone" inputmode="numeric" class="form-input ${this._fieldErrors.phone ? 'input-error' : ''}" placeholder="10-digit number" maxlength="10" value="${Utils.escapeHtml(d.phone)}" required>
              <span class="form-hint">Used for secure sign-in alerts</span>
              ${this.fieldError('phone')}
            </div>

            <div class="form-group form-grid-full">
              <label class="form-label" for="reg-address">Chamber / Office Address <span class="required">*</span></label>
              <input type="text" id="reg-address" class="form-input ${this._fieldErrors.address ? 'input-error' : ''}" placeholder="Chamber No., Court Complex / office address" value="${Utils.escapeHtml(d.address)}" required>
              ${this.fieldError('address')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-city">City <span class="required">*</span></label>
              <input type="text" id="reg-city" class="form-input ${this._fieldErrors.city ? 'input-error' : ''}" placeholder="e.g. New Delhi" value="${Utils.escapeHtml(d.city)}" required>
              ${this.fieldError('city')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-state">State <span class="required">*</span></label>
              <select id="reg-state" class="form-select" required>
                ${states.map(s => `<option value="${s}" ${d.state === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Professional credentials -->
          <h4 class="card-title mt-5 mb-3 d-flex items-center gap-2">
            <span class="material-symbols-rounded text-accent">workspace_premium</span> Professional Credentials
          </h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="reg-barcouncil">Bar Council Registration Number <span class="required">*</span></label>
              <input type="text" id="reg-barcouncil" class="form-input font-mono ${this._fieldErrors.barCouncil ? 'input-error' : ''}" placeholder="e.g. DL/1234/2010" value="${Utils.escapeHtml(d.barCouncil)}" required>
              <span class="form-hint">Format: State Code / Enrollment No. / Year</span>
              ${this.fieldError('barCouncil')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-statebar">State Bar Council <span class="required">*</span></label>
              <select id="reg-statebar" class="form-select" required>
                ${councils.map(c => `<option value="${c}" ${d.stateBarCouncil === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-enrolldate">Enrollment Date <span class="required">*</span></label>
              <input type="date" id="reg-enrolldate" class="form-input ${this._fieldErrors.enrollmentDate ? 'input-error' : ''}" value="${d.enrollmentDate}" max="${new Date().toISOString().split('T')[0]}" required>
              ${this.fieldError('enrollmentDate')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-experience">Years of Active Practice <span class="required">*</span></label>
              <input type="number" id="reg-experience" class="form-input ${this._fieldErrors.yearsOfPractice ? 'input-error' : ''}" min="0" max="60" value="${d.yearsOfPractice ?? ''}" required>
              ${this.fieldError('yearsOfPractice')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-qualification">LLB Qualification <span class="required">*</span></label>
              <input type="text" id="reg-qualification" class="form-input ${this._fieldErrors.qualification ? 'input-error' : ''}" placeholder="e.g. LLB (3 Years) or BA LLB (5 Years)" value="${Utils.escapeHtml(d.qualification)}" required>
              ${this.fieldError('qualification')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-university">University / Law College <span class="required">*</span></label>
              <input type="text" id="reg-university" class="form-input ${this._fieldErrors.university ? 'input-error' : ''}" placeholder="e.g. Faculty of Law, Delhi University" value="${Utils.escapeHtml(d.university)}" required>
              ${this.fieldError('university')}
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-practicetype">Current Practice Type <span class="required">*</span></label>
              <select id="reg-practicetype" class="form-select" required>
                ${['Independent Advocate & Litigation Counsel', 'Law Firm Partner / Senior Associate', 'Designated Senior Advocate', 'Corporate Legal Consultant', 'Legal Aid / Public Prosecutor'].map(type => `<option ${d.practiceType === type ? 'selected' : ''}>${Utils.escapeHtml(type)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-primaryspec">Primary Specialization <span class="required">*</span></label>
              <select id="reg-primaryspec" class="form-select" required>
                ${specializationsList.map(s => `<option ${d.primarySpecialization === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>

            <div class="form-group form-grid-full">
              <label class="form-label">Additional Specializations <span style="font-weight:400;color:var(--color-gray-400)">(tap to select)</span></label>
              <div class="selectable-chips-group" id="chips-specializations">
                ${specializationsList.map(spec => `
                  <button type="button" class="selectable-chip ${d.additionalSpecializations.includes(spec) ? 'selected' : ''}" onclick="RegisterPage.toggleChip(this, 'additionalSpecializations')" aria-pressed="${d.additionalSpecializations.includes(spec)}">${spec}</button>
                `).join('')}
              </div>
            </div>

            <div class="form-group form-grid-full">
              <label class="form-label">Courts Practiced In <span class="required">*</span> <span style="font-weight:400;color:var(--color-gray-400)">(select at least one)</span></label>
              <div class="selectable-chips-group" id="chips-courts">
                ${courtsList.map(court => `
                  <button type="button" class="selectable-chip ${d.courts.includes(court) ? 'selected' : ''}" onclick="RegisterPage.toggleChip(this, 'courts')" aria-pressed="${d.courts.includes(court)}">${court}</button>
                `).join('')}
              </div>
              ${this._fieldErrors.courts ? this.fieldError('courts') : ''}
            </div>

            <div class="form-group form-grid-full">
              <label class="form-label">Languages Known <span style="font-weight:400;color:var(--color-gray-400)">(tap to select)</span></label>
              <div class="selectable-chips-group" id="chips-languages">
                ${languagesList.map(lang => `
                  <button type="button" class="selectable-chip ${d.languages.includes(lang) ? 'selected' : ''}" onclick="RegisterPage.toggleChip(this, 'languages')" aria-pressed="${d.languages.includes(lang)}">${lang}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <div id="register-feedback" class="register-feedback" role="alert" hidden></div>
          <div class="register-nav">
            <a class="btn btn-ghost" href="#/logout-note" onclick="RegisterPage.signOutInstead(event)" style="cursor:pointer">
              Cancel registration
            </a>
            <button type="submit" class="btn btn-primary btn-lg" ${this._submitting ? 'disabled' : ''}>
              ${this._submitting ? '<div class="loading-dots"><span></span><span></span><span></span></div>' : 'Submit Registration'}
            </button>
          </div>
        </form>`
    });
    return demo ? html.replace(/<span class="required">\*<\/span>/g, '').replace(/\srequired(?=[\s>])/g, '').replace('(select at least one)', '(optional in demo)') : html;
  },

  /* ---------------- Interactions ---------------- */
  async startDemo() {
    if (this._submitting) return;
    const hasProfile = !!document.getElementById('reg-fullname');
    if (hasProfile) this.collectProfileFields();
    const draft = hasProfile ? { ...this._data } : null;
    this._submitting = true;
    const button = document.getElementById('start-lawyer-demo');
    const buttonLabel = button?.textContent;
    const showError = message => {
      if (hasProfile) this.showProfileFeedback(message, {});
      else if (document.getElementById('credentials-feedback')) this.showCredentialsFeedback(message, {});
      else if (typeof VerificationPage !== 'undefined') VerificationPage.fail(new Error(message));
      else Utils.showToast(message, 'error');
    };
    if (button) { button.disabled = true; button.textContent = 'Starting demo…'; }
    try {
      const result = await AuthManager.startLawyerDemo();
      if (!result.success) {
        showError(result.error);
        return;
      }
      this._data = JSON.parse(JSON.stringify({ ...(this._defaults || this._data), ...(draft || {}) }));
      this._draftOwner = AuthManager.getSession().id;
      this._fieldErrors = {};
      Router.navigate('/register');
    } catch (_error) {
      showError('The demo could not be opened. Please retry.');
    } finally {
      this._submitting = false;
      if (button) { button.disabled = false; button.textContent = buttonLabel; }
    }
  },

  fillSampleProfile() {
    Object.assign(this._data, { fullName: 'Demo Advocate', professionalName: 'Adv. Demo', city: 'Demo City',
      barCouncil: 'DEMO/001', qualification: 'Sample LLB', university: 'Sample Law College',
      courts: ['District & Sessions Court'], languages: ['English', 'Hindi'], yearsOfPractice: 0 });
    try { sessionStorage.setItem(this.draftKey(), JSON.stringify(this._data)); } catch {}
    Router.transitionPage('/register');
  },
  toggleChip(chipEl, group) {
    chipEl.classList.toggle('selected');
    const selectedText = chipEl.textContent.trim();
    const list = this._data[group];
    const idx = list.indexOf(selectedText);
    if (idx >= 0) list.splice(idx, 1); else list.push(selectedText);
    chipEl.setAttribute('aria-pressed', String(idx < 0));
    this.cacheDraft();
  },

  draftKey() { return 'nyay_advocate_profile_' + encodeURIComponent(AuthManager.getSession()?.id || 'signed-out'); },
  restoreDraft() {
    const owner = AuthManager.getSession()?.id;
    if (!owner || owner === this._draftOwner) return;
    this._draftOwner = owner;
    this._data = JSON.parse(JSON.stringify(this._defaults));
    this._fieldErrors = {};
    try {
      const draft = JSON.parse(sessionStorage.getItem(this.draftKey()) || '{}');
      for (const key of Object.keys(this._data)) if (key in draft && key !== 'profilePhotoData') this._data[key] = draft[key];
    } catch { /* Keep a clean form if a cached draft is unreadable. */ }
  },
  cacheDraft() {
    if (!document.getElementById('reg-fullname')) return;
    this.collectProfileFields();
    const { profilePhotoData, ...draft } = this._data;
    try { sessionStorage.setItem(this.draftKey(), JSON.stringify(draft)); } catch { /* Form remains editable. */ }
  },

  handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      Utils.showToast('Please choose an image under 1 MB.', 'warning');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    this.collectProfileFields();
    reader.onload = (event) => {
      this._data.profilePhotoData = event.target.result;
      Router.transitionPage('/register');
    };
    reader.readAsDataURL(file);
  },

  signOutInstead(e) {
    e.preventDefault();
    Utils.showModal(
      '<p>Cancel this registration and sign out? Your unverified account will be removed the next time someone tries to register with this email.</p>',
      { title: 'Cancel Registration?',
        actions: [
          { text: 'Keep Editing', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
          { text: 'Sign Out', class: 'btn btn-danger', onclick: 'Utils.hideModal(); AuthManager.logout();' }
        ] }
    );
  },

  collectProfileFields() {
    const d = this._data;
    d.fullName = document.getElementById('reg-fullname').value.trim();
    d.professionalName = document.getElementById('reg-profname').value.trim();
    d.dob = document.getElementById('reg-dob').value;
    d.gender = document.getElementById('reg-gender').value;
    d.phone = document.getElementById('reg-phone').value.replace(/\D/g, '');
    d.address = document.getElementById('reg-address').value.trim();
    d.city = document.getElementById('reg-city').value.trim();
    d.state = document.getElementById('reg-state').value;
    d.barCouncil = document.getElementById('reg-barcouncil').value.toUpperCase().trim();
    d.stateBarCouncil = document.getElementById('reg-statebar').value;
    d.enrollmentDate = document.getElementById('reg-enrolldate').value;
    d.qualification = document.getElementById('reg-qualification').value.trim();
    d.university = document.getElementById('reg-university').value.trim();
    d.yearsOfPractice = parseInt(document.getElementById('reg-experience').value, 10);
    d.practiceType = document.getElementById('reg-practicetype').value;
    d.primarySpecialization = document.getElementById('reg-primaryspec').value;
  },

  validateProfile() {
    if (AuthManager.getSession()?.demoMode === true) return {};
    const d = this._data;
    const errors = {};
    if (!d.fullName || d.fullName.trim().length < 3) errors.fullName = 'Enter your full legal name';
    if (!d.dob) errors.dob = 'Select your date of birth';
    else if (new Date(d.dob).getFullYear() > new Date().getFullYear() - 21) errors.dob = 'Advocates must be at least 21 years old';
    if (!Utils.validatePhone(d.phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!d.address || d.address.trim().length < 6) errors.address = 'Enter your chamber / office address';
    if (!d.city || d.city.trim().length < 2) errors.city = 'Enter your city';
    if (!Utils.validateBarNumber(d.barCouncil)) {
      errors.barCouncil = !d.barCouncil
        ? 'Enter your registration number'
        : 'Use the format StateCode/Number/Year, e.g. DL/1234/2010';
    }
    if (!d.enrollmentDate) errors.enrollmentDate = 'Select your enrollment date';
    if (isNaN(d.yearsOfPractice) || d.yearsOfPractice < 0 || d.yearsOfPractice > 60) {
      errors.yearsOfPractice = 'Enter between 0 and 60';
    } else if (d.enrollmentDate) {
      const practiced = (Date.now() - new Date(d.enrollmentDate).getTime()) / (365.25 * 86400000);
      if (d.yearsOfPractice > Math.floor(practiced) + 1) {
        errors.yearsOfPractice = 'Cannot exceed time since enrollment';
      }
    }
    if (!d.qualification || d.qualification.trim().length < 3) errors.qualification = 'Enter your LLB qualification';
    if (!d.university || d.university.trim().length < 4) errors.university = 'Enter your university / college';
    if (d.courts.length === 0) errors.courts = 'Select at least one court';
    return errors;
  },

  async handleProfileSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;
    const form = document.getElementById('register-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    this._submitting = true;
    try {
      this.showProfileFeedback('', {});
      this.collectProfileFields();
      this.cacheDraft();
      this._fieldErrors = this.validateProfile();
      if (Object.keys(this._fieldErrors).length) {
        this.showProfileFeedback('Please correct the highlighted fields before submitting.', this._fieldErrors);
        return;
      }

      form.setAttribute('aria-busy', 'true');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving registration…';
      const result = await AuthManager.registerComplete({ ...this._data });

      if (result.success) {
        sessionStorage.removeItem(this.draftKey());
        AuthManager._pendingRegistrant = null;
        Utils.showToast('Registration received — starting credential verification.', 'success');
        VerificationPage.reset();
        Router.navigate('/verification');
      } else if (result.underInvestigation) {
        Utils.showModal(`
        <p>This Bar Council registration is already linked to another verified advocate profile on Nyay Setu.</p>
        <p>Your submission has been routed to our investigation desk. Until it is resolved you cannot continue with this application.</p>
        <p>If you believe this is an error, contact <strong>verification@nyaysetu.in</strong> with proof of identity.</p>
        `, {
          title: 'Duplicate Registration Detected',
          actions: [{ text: 'Back to Home', class: 'btn btn-primary', onclick: 'Utils.hideModal(); Router.navigate("/splash");' }]
        });
      } else {
        this._fieldErrors = result.fieldErrors || {};
        this.showProfileFeedback(result.error || 'Registration failed. Please review your details.', this._fieldErrors);
      }
    } catch (_error) {
      this.showProfileFeedback('Registration could not be submitted. Your details are retained. Please try again.', {});
    } finally {
      this._submitting = false;
      form.removeAttribute('aria-busy');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Registration';
    }
  },

  showProfileFeedback(message, errors) {
    const ids = {fullName:'reg-fullname',dob:'reg-dob',gender:'reg-gender',phone:'reg-phone',address:'reg-address',
      city:'reg-city',state:'reg-state',barCouncil:'reg-barcouncil',stateBarCouncil:'reg-statebar',
      enrollmentDate:'reg-enrolldate',yearsOfPractice:'reg-experience',qualification:'reg-qualification',
      university:'reg-university',practiceType:'reg-practicetype',primarySpecialization:'reg-primaryspec',courts:'chips-courts'};
    this.showFieldFeedback('register-feedback', ids, message, errors);
  },

  showCredentialsFeedback(message, errors) {
    this.showFieldFeedback('credentials-feedback', {email:'reg-email',password:'reg-password',confirmPassword:'reg-confirm-password'}, message, errors);
  },

  showFieldFeedback(feedbackId, ids, message, errors) {
    const form = document.getElementById('register-form');
    form.querySelectorAll('[data-registration-error]').forEach(el => el.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach(el => {
      el.removeAttribute('aria-invalid');
      el.classList.remove('input-error');
      el.removeAttribute('aria-describedby');
    });
    const feedback = document.getElementById(feedbackId);
    feedback.textContent = message;
    feedback.hidden = !message;
    let first;
    for (const [key, text] of Object.entries(errors)) {
      const field = document.getElementById(ids[key]);
      if (!field) continue;
      const error = document.createElement('span');
      error.className = 'form-error-text';
      error.dataset.registrationError = key;
      error.id = 'registration-error-' + key;
      error.textContent = text;
      field.closest('.form-group').appendChild(error);
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', error.id);
      field.classList.add('input-error');
      first ||= field.querySelector('button') || field;
    }
    if (message) {
      const target = first || feedback;
      if (first) first.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }
};
