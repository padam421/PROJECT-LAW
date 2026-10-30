/* ============================================================
   Nyay Setu — CREDENTIAL VERIFICATION PIPELINE
   verification_page.js — Registry check → Document intake →
   Identity confirmation → Risk screening → Outcome.
   ------------------------------------------------------------
   Honesty model: this build has NO official Bar Council feed,
   OCR/AI engine, or biometric liveness provider connected.
   Every stage therefore produces truthful states:
     Verified | Information Mismatch | Unable to Verify |
     Manual Verification Required | Submitted - Awaiting Review.
   Nothing is auto-badged as authentic without a reviewer.
   ============================================================ */

const VerificationPage = {
  _stage: 1,
  _docs: [],
  _barResult: null,
  _summary: null,
  _busy: { bar: false, upload: null, identity: false, stage: false },
  _owner: null,
  _active: false,
  _generation: 0,
  _controller: null,
  _loading: false,
  _error: '',
  _barNumber: '',

  _slots: [
    { key: 'bar_enrollment', name: 'Bar Council Enrollment Certificate', required: true },
    { key: 'cop', name: 'Certificate of Practice', required: true },
    { key: 'llb_degree', name: 'LLB Degree Certificate', required: true },
    { key: 'govt_id', name: 'Government Identity Proof (Aadhaar / Passport / Voter ID)', required: true },
    { key: 'llm', name: 'LLM Certificate', required: false },
    { key: 'other_cert', name: 'Additional Certification (Mediation / Arbitration / Cyber Law)', required: false }
  ],

  reset() {
    this.onLeave();
    this._owner = null;
    this._stage = 1;
    this._docs = [];
    this._barResult = null;
    this._summary = null;
    this._barNumber = '';
    this._error = '';
    this._identitySubmitted = false;
    sessionStorage.removeItem('lc_selfie_captured');
    this._busy = { bar: false, upload: null, identity: false, stage: false };
  },

  async onEnter() {
    const account = AuthManager.getSession();
    if (!account || !AuthManager.isLoggedIn() || account.role !== 'lawyer') {
      Router.navigate('/login');
      return;
    }
    if (account.registrationStage !== 'complete') {
      Router.navigate('/register');
      return;
    }
    if (this._owner !== account.id) this.reset();
    this._owner = account.id;
    this._active = true;
    this._controller?.abort();
    this._controller = new AbortController();
    const generation = ++this._generation;
    this._loading = true;
    this.refresh();
    try {
      const [documents, summary] = await Promise.all([
        ApiClient.listDocuments(this.options()), ApiClient.fetchVerificationSummary(this.options())
      ]);
      if (!this.isCurrent(generation)) return;
      this._docs = documents;
      this._summary = summary;
      this._barNumber = summary.pipeline?.stages.barCouncil.registrationNumber || account.barCouncil || '';
      const barStatus = summary.pipeline?.stages.barCouncil.status;
      if (barStatus && barStatus !== 'pending') {
        this._barResult = {status: this.isDemo() ? 'demo' : barStatus === 'verified' ? 'verified' : barStatus === 'manual_verification_required' ? 'manual_review' : barStatus === 'information_mismatch' ? 'mismatch' : 'unable',
          message: 'Saved registration check loaded.', blocking: barStatus === 'information_mismatch'};
      }
      const saved = Number(sessionStorage.getItem(this.stageKey())) || 1;
      this._stage = Math.min(Math.max(saved, 1), this.maximumStage());
      this._error = '';
    } catch (error) {
      if (this.isCurrent(generation) && error.name !== 'AbortError') this._error = error.message;
    } finally {
      if (this.isCurrent(generation)) { this._loading = false; this.refresh(); }
    }
  },

  onLeave() {
    this._active = false;
    ++this._generation;
    this._controller?.abort();
    this._controller = null;
    this._loading = false;
    this._busy = { bar: false, upload: null, identity: false, stage: false };
  },

  options() { return { signal: this._controller?.signal }; },
  isCurrent(generation) { return this._active && generation === this._generation && AuthManager.getSession()?.id === this._owner; },
  stageKey() { return 'nyay_verification_stage_' + encodeURIComponent(this._owner); },
  requiredDone() { return this._slots.filter(s => s.required).every(s => this._docs.some(d => d.category === s.key)); },
  isDemo() { return AuthManager.getSession()?.demoMode === true; },
  selfieDone() { return this._docs.some(d => d.category === 'identity_selfie'); },
  maximumStage() {
    if (this.isDemo()) return 5;
    if (!this._barResult || !['verified', 'manual_review'].includes(this._barResult.status)) return 1;
    if (!this.requiredDone()) return 2;
    return this._summary?.pipeline?.stages.identity.submittedAt ? 5 : 3;
  },

  async loadDocs() {
    const generation = this._generation;
    const documents = await ApiClient.listDocuments(this.options());
    if (this.isCurrent(generation)) this._docs = documents;
  },

  refresh() {
    if (!this._active) return;
    const host = document.getElementById('verification-stage-content');
    if (!host) return;
    const scroll = host.closest('.fullscreen-card')?.scrollTop || 0;
    host.innerHTML = this.renderStage(this._stage, AuthManager.currentLawyer());
    document.querySelectorAll('.verification-progress .register-step').forEach((step, index) => {
      step.classList.toggle('active', this._stage >= index + 1);
      step.classList.toggle('completed', this._stage > index + 1);
      step.querySelector('.register-step-circle').textContent = this._stage > index + 1 ? '✓' : String(index + 1);
    });
    const feedback = document.getElementById('verification-feedback');
    if (feedback) { feedback.hidden = !this._error; feedback.textContent = this._error; }
    const retry = document.getElementById('verification-retry');
    if (retry) retry.hidden = !this._error || this._loading;
    const loading = document.getElementById('verification-loading');
    if (loading) loading.hidden = !this._loading;
    host.querySelectorAll('button, input').forEach(el => { if (this._loading || this._busy.stage) el.disabled = true; });
    if (host.closest('.fullscreen-card')) host.closest('.fullscreen-card').scrollTop = scroll;
  },

  fail(error) {
    if (error.name === 'AbortError') return;
    this._error = error.message || 'This step could not be completed. Please retry.';
    this.refresh();
    document.getElementById('verification-feedback')?.scrollIntoView({ block: 'nearest' });
  },

  render() {
    const lawyer = AuthManager.currentLawyer();
    const steps = ['Bar Registry', 'Documents', 'Identity', 'Screening', 'Outcome'];
    return `
      <div class="fullscreen-page" id="credential-verification">
        <div class="fullscreen-card fullscreen-card-xl">
          <div class="page-header" style="margin-bottom:var(--space-4)">
            <div>
              <h2 class="register-title">Credential Verification</h2>
              <p class="register-subtitle">${this.isDemo() ? 'Demo account — credentials, document uploads and selfie are optional. No professional verification is granted.' : 'Confirm your credentials to earn the Verified Badge clients trust'}</p>
            </div>
          </div>

          ${this.isDemo() ? '' : '<div class="register-feedback mb-4"><p>Using sample details for the hackathon? Demo mode lets you skip professional details, documents and selfie.</p><button type="button" id="start-lawyer-demo" class="btn btn-secondary" onclick="RegisterPage.startDemo()">Switch to Demo — Optional Fields</button></div>'}

          <div class="verification-progress">
            <div class="register-stepper" role="list" aria-label="Verification progress">
              ${steps.map((label, i) => `
                ${i > 0 ? '<div class="register-step-line"></div>' : ''}
                <div class="register-step ${this._stage >= i + 1 ? 'active' : ''} ${this._stage > i + 1 ? 'completed' : ''}" role="listitem">
                  <div class="register-step-circle">${this._stage > i + 1 ? '✓' : (i + 1)}</div>
                  <div class="register-step-label">${label}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <p id="verification-loading" role="status" hidden>Loading your saved verification record…</p>
          <div id="verification-feedback" class="register-feedback" role="alert" hidden></div>
          <button id="verification-retry" class="btn btn-secondary mb-3" onclick="VerificationPage.onEnter()" hidden>Reload saved verification record</button>
          <div id="verification-stage-content">
            ${this.renderStage(this._stage, lawyer)}
          </div>
        </div>
      </div>
    `;
  },

  renderStage(stage, lawyer) {
    if (stage === 1) return this.renderStage1(lawyer);
    if (stage === 2) return this.renderStage2(lawyer);
    if (stage === 3) return this.renderStage3(lawyer);
    if (stage === 4) return this.renderStage4(lawyer);
    return this.renderStage5(lawyer);
  },

  /* ---------------- Stage 1 · Bar registry check ---------------- */
  renderStage1(lawyer) {
    const r = this._barResult;
    return `
      <div class="barcouncil-verify">
        <h3 class="card-title">State Bar Council Registration Check</h3>
        <p class="text-body-sm text-muted mb-4">
          ${this.isDemo() ? 'This step is optional. Type any sample registration number, or continue without a registry check. No professional eligibility is verified in demo mode.' : 'We validate your enrollment number format and cross-check it against duplicate profiles on Nyay Setu. Confirmation of active standing is completed by our verification desk; an official Bar Council data feed is not yet connected to this platform.'}
        </p>

        <div class="form-group">
          <label class="form-label" for="bc-num-input">Registration Number</label>
          <div class="verify-input-group">
            <input type="text" id="bc-num-input" class="form-input font-mono" value="${Utils.escapeHtml(this._barNumber || lawyer.barCouncil || '')}" placeholder="e.g. DL/1234/2010" aria-describedby="bc-hint" oninput="VerificationPage._barNumber=this.value; VerificationPage._barResult=null; document.getElementById('verification-next-docs').disabled=!VerificationPage.isDemo();">
            <button class="btn btn-primary" id="btn-verify-bc" onclick="VerificationPage.handleVerifyBarCouncil()" ${this._busy.bar ? 'disabled' : ''}>
              ${this._busy.bar ? '<div class="loading-dots"><span></span><span></span><span></span></div> Checking' : '<span class="material-symbols-rounded">verified</span> Check Registration'}
            </button>
          </div>
          <span class="form-hint" id="bc-hint">Checks: format &bull; state code &bull; year &bull; duplicate profiles</span>
        </div>

        <div id="bc-result-box">
          ${r ? this.barResultHtml(r) : `
            <div class="verify-result info">
              <span class="material-symbols-rounded">info</span>
              <div>
                <div class="verify-result-text">Ready when you are</div>
                <div class="text-body-sm">${this.isDemo() ? 'The sample registration check is optional. You can continue below.' : 'Run the registration check to continue.'}</div>
              </div>
            </div>`}
        </div>

        <div class="d-flex justify-between mt-8">
          <button class="btn btn-ghost" onclick="Router.navigate('/login')">&larr; Back to sign-in</button>
          <button class="btn btn-primary btn-lg" id="verification-next-docs" onclick="VerificationPage.setStage(2)" ${!this.isDemo() && (this._busy.bar || !r || !['verified','manual_review'].includes(r.status)) ? 'disabled title="Complete the registration check first"' : ''}>
            Next: Upload Credentials &rarr;
          </button>
        </div>
      </div>
    `;
  },

  barResultHtml(r) {
    const map = {
      verified: { cls: 'success', icon: 'verified', title: 'Registry match confirmed', sub: 'Active standing confirmed by the verification desk.' },
      manual_review: { cls: 'info', icon: 'hourglass_top', title: 'Submitted for desk confirmation', sub: r.message },
      mismatch: { cls: 'error', icon: 'report', title: 'Information mismatch', sub: r.message },
      unable: { cls: 'warning', icon: 'help', title: 'Unable to verify', sub: r.message },
      error: { cls: 'error', icon: 'wifi_off', title: 'Lookup failed', sub: r.message },
      demo: { cls: 'info', icon: 'science', title: 'Demo sample — not verified', sub: r.message }
    };
    const m = map[r.status] || map.unable;
    return `
      <div class="verify-result ${m.cls}">
        <span class="material-symbols-rounded">${m.icon}</span>
        <div>
          <div class="verify-result-text">${m.title}</div>
          <div class="text-body-sm">${Utils.escapeHtml(m.sub || '')}${r.source ? `<br><span style="opacity:.75;font-size:.72rem">${Utils.escapeHtml(r.source)}</span>` : ''}</div>
        </div>
      </div>`;
  },

  /* ---------------- Stage 2 · Credential documents ---------------- */
  renderStage2(_lawyer) {
    const uploadedKeys = new Set(this._docs.map(d => d.category));
    const requiredDone = this.isDemo() || this._slots.filter(s => s.required).every(s => uploadedKeys.has(s.key));
    return `
      <div>
        <h3 class="card-title">Upload Your Credentials</h3>
        <p class="text-body-sm text-muted mb-3">
          ${this.isDemo() ? 'All uploads are optional. Use sample PDF, JPG, PNG or WEBP files up to 10 MB, or continue without any files. Demo documents do not enter the real advocate review queue.' : 'PDF, JPG, PNG or WEBP up to 10 MB. Files are stored securely and reviewed by the verification desk. Automated document reading is not yet enabled on this platform, so uploads remain <strong>&ldquo;Awaiting Review&rdquo;</strong> until a human reviewer confirms them.'}
        </p>

        <div class="doc-upload-grid">
          ${this._slots.map(originalSlot => {
            const slot = this.isDemo() ? { ...originalSlot, required: false } : originalSlot;
            const docs = this._docs.filter(d => d.category === slot.key);
            const latest = docs[0];
            const busy = this._busy.upload === slot.key;
            return `
            <div class="doc-upload-card ${slot.required ? 'required' : 'optional'} ${latest ? 'uploaded' : ''}">
              <div class="doc-upload-icon">
                <span class="material-symbols-rounded">${latest ? 'task_alt' : 'cloud_upload'}</span>
              </div>
              <div class="doc-upload-name">${slot.name}${slot.required ? ' <span class="required">*</span>' : ''}</div>
              ${latest ? `
                <div class="doc-upload-hint truncate" title="${Utils.escapeHtml(latest.originalName)}">${Utils.escapeHtml(latest.originalName)} &middot; ${(latest.sizeBytes / 1024).toFixed(0)} KB</div>
                <span class="doc-verification-badge awaiting">${this.isDemo() ? 'Demo sample — not verified' : 'Awaiting Review'}</span>
                <div class="d-flex gap-2 mt-2">
                  <a class="btn btn-ghost btn-sm" href="${ApiClient.documentDownloadUrl(latest.id)}" target="_blank" rel="noopener">View</a>
                  <button class="btn btn-ghost btn-sm" style="color:var(--color-error)" onclick="VerificationPage.deleteDoc('${latest.id}')">Remove</button>
                </div>
              ` : `
                <div class="doc-upload-hint">${slot.required ? 'Required for verification' : 'Optional'}</div>
                <span class="doc-verification-badge pending">Pending upload</span>
                <button class="btn btn-secondary btn-sm mt-2" onclick="document.getElementById('file-${slot.key}').click()" ${busy ? 'disabled' : ''}>
                  ${busy ? '<div class="loading-dots"><span></span><span></span><span></span></div> Uploading' : 'Choose File'}
                </button>
              `}
              <input type="file" id="file-${slot.key}" accept=".pdf,image/jpeg,image/png,image/webp" style="display:none"
                     onchange="VerificationPage.uploadDoc('${slot.key}', this)">
            </div>`;
          }).join('')}
        </div>

        <div class="d-flex justify-between mt-8">
          <button class="btn btn-secondary" onclick="VerificationPage.setStage(1)">&larr; Back</button>
          <button class="btn btn-primary btn-lg" onclick="VerificationPage.setStage(3)" ${requiredDone ? '' : 'disabled title="Upload all required documents first"'}>
            Next: Identity Check &rarr;
          </button>
        </div>
      </div>
    `;
  },

  /* ---------------- Stage 3 · Identity confirmation ---------------- */
  renderStage3(_lawyer) {
    const idUploaded = this._docs.some(d => d.category === 'govt_id');
    const selfieDone = this.selfieDone();
    return `
      <div class="identity-verify">
        <h3 class="card-title">Identity Confirmation</h3>
        <p class="text-body-sm text-muted mb-4">
          ${this.isDemo() ? 'This entire step is optional. You can upload a sample selfie or continue without an ID or selfie. No identity verification runs for a demo account.' : 'Confirm that the government ID you uploaded belongs to you. This build does not include an automated face-match or liveness service, so submissions are checked manually by the verification desk.'}
        </p>

        <div class="liveness-steps">
          <div class="liveness-step ${idUploaded ? 'completed' : ''}" id="live-step-1">
            <div class="liveness-step-icon"><span class="material-symbols-rounded">${idUploaded ? 'check' : 'close'}</span></div>
            <div class="liveness-step-text">${idUploaded ? 'Government ID document received' : this.isDemo() ? 'Sample government ID — optional' : 'Government ID document missing'}</div>
          </div>
          <div class="liveness-step ${selfieDone ? 'completed' : ''}" id="live-step-2">
            <div class="liveness-step-icon"><span class="material-symbols-rounded">${selfieDone ? 'check' : 'photo_camera'}</span></div>
            <div class="liveness-step-text">${selfieDone ? (this.isDemo() ? 'Sample selfie received' : 'Selfie file received for manual review') : this.isDemo() ? 'Sample selfie — optional' : 'Take or upload a selfie'}</div>
          </div>
          <div class="liveness-step pending-manual" id="live-step-3">
            <div class="liveness-step-icon"><span class="material-symbols-rounded">hourglass_top</span></div>
            <div class="liveness-step-text">${this.isDemo() ? 'Demo profile — identity not verified' : 'Manual face comparison by verification desk'}</div>
          </div>
        </div>

        <div class="ai-disclaimer mt-3">
          <span class="material-symbols-rounded icon-sm">info</span>
          <span>${this.isDemo() ? 'Sample uploads do not verify a real identity and will not grant a Verified Badge.' : 'No biometric matching runs in this environment. Your selfie and ID are compared by a human reviewer; the status stays &ldquo;Manual Review Required&rdquo; until then.'}</span>
        </div>

        <div class="d-flex justify-between mt-6">
          <button class="btn btn-secondary" onclick="VerificationPage.setStage(2)">&larr; Back to Documents</button>
          <button class="btn btn-primary btn-lg" onclick="${selfieDone ? "VerificationPage.submitIdentity()" : "document.getElementById('selfie-input').click()"}" ${this._busy.identity || this._busy.upload ? 'disabled' : ''}>
            ${this._busy.identity ? 'Submitting…' : this._busy.upload === 'identity_selfie' ? 'Uploading selfie…' : (selfieDone ? 'Submit Identity Confirmation &rarr;' : 'Take or Upload Selfie')}
          </button>
        </div>
        <input type="file" id="selfie-input" accept="image/jpeg,image/png,image/webp" capture="user" hidden onchange="VerificationPage.handleSelfie(event)">
        ${this.isDemo() ? '<button class="btn btn-secondary mt-3" onclick="VerificationPage.submitIdentity()">Skip Optional Identity Check — Demo</button>' : ''}
        ${selfieDone ? '<button class="btn btn-ghost mt-3" onclick="document.getElementById(\'selfie-input\').click()">Replace selfie</button>' : ''}
      </div>
    `;
  },

  /* ---------------- Stage 4 · Screening summary ---------------- */
  async loadScreeningSummary() {
    const generation = this._generation;
    const summary = await ApiClient.fetchVerificationSummary(this.options());
    if (this.isCurrent(generation)) this._summary = summary;
  },

  renderStage4(_lawyer) {
    if (this.isDemo()) return '<h3 class="card-title">Demo walkthrough</h3><p>Sample details are saved. No real identity, Bar registration or documents have been verified.</p><button class="btn btn-primary mt-4" onclick="VerificationPage.setStage(5)">See Demo Outcome →</button>';
    const p = (this._summary && this._summary.pipeline) || {};
    const stages = p.stages || {};
    const fraudStatus = p.fraudStatus || 'low_risk';

    const stageRows = [
      ['Bar Council check', stages.barCouncil ? stages.barCouncil.status : 'pending'],
      ['Credential documents (' + ((stages.documents && stages.documents.docsSubmitted) || 0) + ' submitted)', stages.documents ? stages.documents.status : 'pending'],
      ['Identity confirmation', stages.identity ? stages.identity.status : 'not_started'],
      ['Duplicate profile scan', stages.duplicate ? stages.duplicate.status : 'clear']
    ];

    const statusBadge = (status) => {
      const map = {
        verified: ['badge-success', 'Verified'],
        clear: ['badge-success', 'Clear'],
        manual_verification_required: ['badge-warning', 'Manual review'],
        submitted_awaiting_review: ['badge-warning', 'Awaiting review'],
        pending: ['badge-warning', 'Pending'],
        not_started: ['badge-neutral', 'Not started'],
        information_mismatch: ['badge-danger', 'Mismatch'],
        collision_found: ['badge-danger', 'Collision found'],
        completed: ['badge-success', 'Completed'],
        required: ['badge-warning', 'Required']
      };
      const m = map[status] || ['badge-neutral', Utils.escapeHtml(status)];
      return `<span class="badge ${m[0]}">${m[1]}</span>`;
    };

    const fraudLabel = fraudStatus === 'high_risk_verification_failed'
      ? ['High Risk — Verification Failed', 'var(--color-error)']
      : fraudStatus === 'medium_risk_manual_review'
        ? ['Medium Risk — Manual Review', 'var(--color-gold-dark)']
        : ['Low Risk', 'var(--color-success-dark)'];

    return `
      <div>
        <h3 class="card-title">Fraud Prevention Screening</h3>
        <p class="text-body-sm text-muted mb-4">
          Every application passes through layered checks before a Verified Badge is granted.
          Internal risk details are intentionally summarised here; sensitive signals are visible only to the security desk.
        </p>

        <div class="grid-2 mb-6">
          <div class="card">
            <h4 class="card-title mb-3 d-flex items-center gap-2">
              <span class="material-symbols-rounded text-success">fingerprint</span> Duplicate &amp; Integrity Checks
            </h4>
            <div class="data-table">
              <table><tbody>
                ${stageRows.map(([label, status]) => `
                  <tr><td>${label}</td><td style="text-align:right">${statusBadge(status)}</td></tr>
                `).join('')}
              </tbody></table>
            </div>
          </div>

          <div class="card">
            <h4 class="card-title mb-3 d-flex items-center gap-2">
              <span class="material-symbols-rounded text-accent">shield</span> Application Assessment
            </h4>
            <div class="p-4" style="background:var(--color-gray-50);border-radius:var(--radius-lg)">
              <div class="d-flex justify-between items-center mb-2">
                <span class="font-semibold text-body-md">Internal risk rating:</span>
                <strong style="color:${fraudLabel[1]}">${fraudLabel[0]}</strong>
              </div>
              <p class="text-body-sm text-muted">
                Applications rated medium or high are reviewed personally by the verification desk before any badge is issued.
                Automatic approval never applies when a duplicate registration number is detected.
              </p>
            </div>
          </div>
        </div>

        <div class="d-flex justify-between mt-8">
          <button class="btn btn-secondary" onclick="VerificationPage.setStage(3)">&larr; Back</button>
          <button class="btn btn-primary btn-lg" onclick="VerificationPage.setStage(5)">See Outcome &rarr;</button>
        </div>
      </div>
    `;
  },

  /* ---------------- Stage 5 · Outcome ---------------- */
  renderStage5(_lawyer) {
    if (this.isDemo()) return '<div class="verification-result"><h2 class="result-title">Demo Profile Ready</h2><p>Your sample advocate profile is ready for the hackathon. Documents and selfie were optional. This account is clearly unverified and is excluded from the real advocate review queue.</p><button class="btn btn-primary btn-lg mt-5" onclick="Router.navigate(\'/dashboard\')">Open Demo Dashboard →</button></div>';
    const lawyer = { ...AuthManager.currentLawyer() };
    if (this._summary) {
      lawyer.verificationId = this._summary.verificationId;
      lawyer.verificationDate = this._summary.verificationDate;
    }
    const status = this._summary?.lawyerStatus || lawyer.verificationStatus || 'pending';
    const summary = this._summary;

    if (status === 'verified') return this.verifiedOutcome(lawyer);

    if (status === 'rejected' || status === 'info_mismatch') {
      return `
        <div class="verification-result">
          <div class="result-icon error"><span class="material-symbols-rounded">report</span></div>
          <h2 class="result-title" style="color:var(--color-error)">Verification Not Approved</h2>
          <p class="text-body-sm text-muted mb-4">
            For major discrepancies, please wait for manual review
            or contact support@nyaysetu.in for assistance.
          </p>
          <div class="d-flex justify-center gap-4 mt-6 flex-wrap">
            <button class="btn btn-secondary btn-lg" onclick="VerificationPage.setStage(2)">Upload Corrected Documents</button>
            <button class="btn btn-primary btn-lg" onclick="Router.navigate('/dashboard')">Continue to Dashboard</button>
          </div>
        </div>`;
    }

    const docsCount = this._slots.filter(s => s.required && this._docs.some(d => d.category === s.key)).length;
    const requiredCount = this._slots.filter(s => s.required).length;
    return `
      <div class="verification-result">
        <div class="result-icon" style="background:rgba(245,158,11,.12);color:var(--color-gold-dark)">
          <span class="material-symbols-rounded">hourglass_top</span>
        </div>
        <h2 class="result-title" style="color:var(--color-gold-dark)">Verification In Progress</h2>
        <p class="text-body-md text-muted mb-4">
          Your submission is queued with the verification desk. You'll receive a notification the moment your badge is decided.
        </p>

        <div class="result-details">
          <div class="result-detail-row">
            <span class="result-detail-label">Advocate Name</span>
            <span class="result-detail-value">${Utils.escapeHtml(lawyer.fullName || '')}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Bar Council Registration</span>
            <span class="result-detail-value font-mono">${Utils.escapeHtml(lawyer.barCouncil || '')}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Documents Submitted</span>
            <span class="result-detail-value">${docsCount} of ${requiredCount} required</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Current Status</span>
            <span class="result-detail-value"><span class="badge badge-warning">${status === 'pending' ? 'Pending Review' : 'Action Required'}</span></span>
          </div>
        </div>

        <div class="ai-disclaimer mt-3">
          <span class="material-symbols-rounded icon-sm">info</span>
          <span>You can continue building your profile while verification is in progress. The public Verified Badge appears only after approval.</span>
        </div>

        <div class="d-flex justify-center gap-4 mt-6 flex-wrap">
          <button class="btn btn-secondary btn-lg" onclick="VerificationPage.setStage(2)">Manage Documents</button>
          <button class="btn btn-primary btn-lg" onclick="Router.navigate('/profile')">Complete Portfolio &rarr;</button>
        </div>
      </div>`;
  },

  verifiedOutcome(lawyer) {
    return `
      <div class="verification-result">
        <div class="result-icon success"><span class="material-symbols-rounded">verified</span></div>
        <h2 class="result-title success" style="color:var(--color-success-dark)">Verified Advocate</h2>
        <p class="text-body-md text-muted mb-4">
          Your profile is verified and discoverable to clients with the Verified Badge.
        </p>

        <div class="result-details">
          <div class="result-detail-row">
            <span class="result-detail-label">Advocate Name</span>
            <span class="result-detail-value">${Utils.escapeHtml(lawyer.fullName || '')}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Bar Council Registration</span>
            <span class="result-detail-value font-mono">${Utils.escapeHtml(lawyer.barCouncil || '')}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Lawyer Verification ID</span>
            <span class="result-detail-value font-mono" style="color:var(--color-accent)">${Utils.escapeHtml(lawyer.verificationId || '—')}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Verified On</span>
            <span class="result-detail-value">${lawyer.verificationDate ? Utils.formatDate(lawyer.verificationDate, 'long') : '—'}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Public Badge Status</span>
            <span class="result-detail-value"><span class="badge badge-success">Active &amp; Verified</span></span>
          </div>
        </div>

        <div class="d-flex justify-center gap-4 mt-6 flex-wrap">
          <button class="btn btn-secondary btn-lg" onclick="Router.navigate('/settings/tab/notifications')">View Verification Record</button>
          <button class="btn btn-primary btn-lg" onclick="Router.navigate('/dashboard')">Enter Dashboard &rarr;</button>
        </div>
      </div>`;
  },

  /* ---------------- Handlers ---------------- */
  async handleVerifyBarCouncil() {
    if (this._loading || this._busy.bar) return;
    const input = document.getElementById('bc-num-input');
    const num = (input ? input.value : '').trim().toUpperCase();
    this._barNumber = num;
    if (!this.isDemo() && !Utils.validateBarNumber(num)) {
      this.fail(new Error('Enter a valid registration number, for example DL/1234/2020.'));
      return;
    }
    const generation = this._generation;
    this._error = '';
    this._busy.bar = true;
    this.refresh();
    try {
      const res = await ApiClient.lookupBarCouncil(num, AuthManager.currentLawyer().stateBarCouncil, this.options());
      if (!this.isCurrent(generation)) return;
      res.blocking = res.status === 'mismatch';
      this._barResult = res;
      if (res.status === 'error') throw new Error(res.message);
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
    finally { if (this.isCurrent(generation)) { this._busy.bar = false; this.refresh(); } }
  },

  async uploadDoc(slotKey, inputEl) {
    if (this._loading || this._busy.upload) return;
    const file = inputEl.files[0];
    if (!file) return;
    const slot = this._slots.find(s => s.key === slotKey);
    if (!slot) return;
    if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)) {
      this.fail(new Error('Choose a PDF, JPG, PNG or WEBP document.'));
      inputEl.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.fail(new Error('File exceeds the 10 MB limit.'));
      inputEl.value = '';
      return;
    }
    const generation = this._generation;
    this._error = '';
    this._busy.upload = slotKey;
    this.refresh();
    try {
      await ApiClient.uploadDocument(file, slotKey, slot.name, this.options());
      await this.loadDocs();
      if (!this.isCurrent(generation)) return;
      Utils.showToast(`${slot.name}: uploaded and queued for review.`, 'success');
    } catch (err) {
      if (this.isCurrent(generation)) this.fail(err);
    }
    finally { if (this.isCurrent(generation)) { this._busy.upload = null; this.refresh(); } }
  },

  async deleteDoc(docId) {
    if (this._busy.upload) return;
    const ok = await Utils.showConfirm('Remove Document', 'This uploaded file will be removed from your verification record.', { confirmText: 'Remove', type: 'danger' });
    if (!ok || !this._active) return;
    const generation = this._generation;
    this._busy.upload = 'delete';
    try {
      const done = await ApiClient.deleteDocument(docId, this.options());
      if (!done) throw new Error('Could not remove the document. Please retry.');
      await this.loadDocs();
      if (this.isCurrent(generation)) { this._error = ''; Utils.showToast('Document removed.', 'info'); }
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
    finally { if (this.isCurrent(generation)) { this._busy.upload = null; this.refresh(); } }
  },

  async handleSelfie(event) {
    if (this._busy.upload || this._busy.identity) return;
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      this.fail(new Error('Choose a JPG, PNG or WEBP selfie under 10 MB.'));
      event.target.value = '';
      return;
    }
    const generation = this._generation;
    this._error = '';
    this._busy.upload = 'identity_selfie';
    this.refresh();
    try {
      await ApiClient.uploadDocument(file, 'identity_selfie', 'Identity selfie for manual review', this.options());
      await this.loadDocs();
      if (this.isCurrent(generation)) Utils.showToast('Selfie uploaded for manual comparison with your ID.', 'success');
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
    finally { if (this.isCurrent(generation)) { this._busy.upload = null; this.refresh(); } }
  },

  async submitIdentity() {
    if (this._busy.identity || this._busy.upload) return;
    if (!this.isDemo() && (!this.requiredDone() || !this.selfieDone())) {
      this.fail(new Error('Upload all required credentials and your selfie before submitting identity confirmation.'));
      return;
    }
    const generation = this._generation;
    this._error = '';
    this._busy.identity = true;
    this.refresh();
    try {
      await ApiClient.submitIdentityCheck(this.selfieDone(), this._docs.some(d => d.category === 'govt_id'), this.options());
      await this.loadScreeningSummary();
      if (!this.isCurrent(generation)) return;
      this._stage = 4;
      sessionStorage.setItem(this.stageKey(), '4');
      Utils.showToast(this.isDemo() ? 'Optional identity step skipped for this demo.' : 'Identity confirmation submitted for manual review.', 'success');
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
    finally { if (this.isCurrent(generation)) { this._busy.identity = false; this.refresh(); } }
  },

  async setStage(stage) {
    if (this._loading || this._busy.stage || this._busy.upload || this._busy.identity || this._busy.bar) return;
    if (!Number.isInteger(stage) || stage < 1 || stage > 5) return;
    if (stage > this.maximumStage()) { this.fail(new Error('Complete the earlier verification steps before continuing.')); return; }
    const generation = this._generation;
    this._busy.stage = true;
    this._error = '';
    try {
      if (stage >= 4) await this.loadScreeningSummary();
      if (!this.isCurrent(generation)) return;
      this._stage = stage;
      sessionStorage.setItem(this.stageKey(), String(stage));
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
    finally { if (this.isCurrent(generation)) { this._busy.stage = false; this.refresh(); } }
  },

  completeAndGoDashboard() {
    Router.navigate('/profile');
  }
};
