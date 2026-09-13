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
  _busy: { bar: false, upload: null, identity: false },

  _slots: [
    { key: 'bar_enrollment', name: 'Bar Council Enrollment Certificate', required: true },
    { key: 'cop', name: 'Certificate of Practice', required: true },
    { key: 'llb_degree', name: 'LLB Degree Certificate', required: true },
    { key: 'govt_id', name: 'Government Identity Proof (Aadhaar / Passport / Voter ID)', required: true },
    { key: 'llm', name: 'LLM Certificate', required: false },
    { key: 'other_cert', name: 'Additional Certification (Mediation / Arbitration / Cyber Law)', required: false }
  ],

  reset() {
    this._stage = 1;
    this._docs = [];
    this._barResult = null;
    this._identitySubmitted = false;
    sessionStorage.removeItem('lc_selfie_captured');
    this._busy = { bar: false, upload: null, identity: false };
  },

  async onEnter() {
    await this.loadDocs();
    Router.transitionPage('/verification');
  },

  async loadDocs() {
    try {
      this._docs = await ApiClient.listDocuments();
    } catch {
      this._docs = [];
    }
  },

  render() {
    const lawyer = AuthManager.currentLawyer();
    const steps = ['Bar Registry', 'Documents', 'Identity', 'Screening', 'Outcome'];
    return `
      <div class="fullscreen-page">
        <div class="fullscreen-card fullscreen-card-xl">
          <div class="page-header" style="margin-bottom:var(--space-4)">
            <div>
              <h2 class="register-title">Credential Verification</h2>
              <p class="register-subtitle">Confirm your credentials to earn the Verified Badge clients trust</p>
            </div>
          </div>

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
          We validate your enrollment number format and cross-check it against duplicate profiles on Nyay Setu.
          Confirmation of active standing is completed by our verification desk; an official Bar Council data feed is not yet connected to this platform.
        </p>

        <div class="form-group">
          <label class="form-label" for="bc-num-input">Registration Number</label>
          <div class="verify-input-group">
            <input type="text" id="bc-num-input" class="form-input font-mono" value="${Utils.escapeHtml(lawyer.barCouncil || '')}" placeholder="e.g. DL/1234/2010" aria-describedby="bc-hint">
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
                <div class="text-body-sm">Run the registration check to continue.</div>
              </div>
            </div>`}
        </div>

        <div class="d-flex justify-between mt-8">
          <button class="btn btn-ghost" onclick="Router.navigate('/login')">&larr; Back to sign-in</button>
          <button class="btn btn-primary btn-lg" onclick="VerificationPage.setStage(2)" ${(r && r.blocking) ? 'disabled title="Resolve the registration issue first"' : ''}>
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
      error: { cls: 'error', icon: 'wifi_off', title: 'Lookup failed', sub: r.message }
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
    const requiredDone = this._slots.filter(s => s.required).every(s => uploadedKeys.has(s.key));
    return `
      <div>
        <h3 class="card-title">Upload Your Credentials</h3>
        <p class="text-body-sm text-muted mb-3">
          PDF, JPG, PNG or WEBP up to 10 MB. Files are stored securely and reviewed by the verification desk.
          Automated document reading is not yet enabled on this platform, so uploads remain
          <strong>&ldquo;Awaiting Review&rdquo;</strong> until a human reviewer confirms them.
        </p>

        <div class="doc-upload-grid">
          ${this._slots.map(slot => {
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
                <span class="doc-verification-badge awaiting">Awaiting Review</span>
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
    const selfieDone = sessionStorage.getItem('lc_selfie_captured') === '1';
    return `
      <div class="identity-verify">
        <h3 class="card-title">Identity Confirmation</h3>
        <p class="text-body-sm text-muted mb-4">
          Confirm that the government ID you uploaded belongs to you. This build does not include an automated
          face-match or liveness service, so submissions are checked manually by the verification desk.
        </p>

        <div class="liveness-steps">
          <div class="liveness-step ${idUploaded ? 'completed' : ''}" id="live-step-1">
            <div class="liveness-step-icon"><span class="material-symbols-rounded">${idUploaded ? 'check' : 'close'}</span></div>
            <div class="liveness-step-text">${idUploaded ? 'Government ID document received' : 'Government ID document missing'}</div>
          </div>
          <div class="liveness-step ${selfieDone ? 'completed' : ''}" id="live-step-2">
            <div class="liveness-step-icon"><span class="material-symbols-rounded">${selfieDone ? 'check' : 'photo_camera'}</span></div>
            <div class="liveness-step-text">${selfieDone ? 'Selfie capture recorded' : 'Capture a quick selfie'}</div>
          </div>
          <div class="liveness-step pending-manual" id="live-step-3">
            <div class="liveness-step-icon"><span class="material-symbols-rounded">hourglass_top</span></div>
            <div class="liveness-step-text">Manual face comparison by verification desk</div>
          </div>
        </div>

        <div class="ai-disclaimer mt-3">
          <span class="material-symbols-rounded icon-sm">info</span>
          <span>No biometric matching runs in this environment. Your selfie and ID are compared by a human reviewer; the status stays &ldquo;Manual Review Required&rdquo; until then.</span>
        </div>

        <div class="d-flex justify-between mt-6">
          <button class="btn btn-secondary" onclick="VerificationPage.setStage(2)">&larr; Back to Documents</button>
          <button class="btn btn-primary btn-lg" onclick="${selfieDone ? "VerificationPage.submitIdentity()" : "document.getElementById('selfie-input').click()"}" ${this._busy.identity ? 'disabled' : ''}>
            ${this._busy.identity ? '<div class="loading-dots"><span></span><span></span><span></span></div> Submitting' : (selfieDone ? 'Submit Identity Confirmation &rarr;' : 'Capture Selfie')}
          </button>
        </div>
      </div>
    `;
  },

  /* ---------------- Stage 4 · Screening summary ---------------- */
  async loadScreeningSummary() {
    this._summary = await ApiClient.fetchVerificationSummary().catch(() => null);
  },

  renderStage4(_lawyer) {
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
    const lawyer = Store.getState('lawyerProfile') || AuthManager.currentLawyer();
    const status = lawyer.verificationStatus || 'pending';
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
            <button class="btn btn-secondary btn-lg" onclick="VerificationPage.reset(); VerificationPage.loadDocs().then(()=>Router.transitionPage('/verification'));">Upload Corrected Documents</button>
            <button class="btn btn-primary btn-lg" onclick="Router.navigate('/dashboard')">Continue to Dashboard</button>
          </div>
        </div>`;
    }

    const docsCount = (summary && summary.pipeline && summary.pipeline.stages.documents && summary.pipeline.stages.documents.docsSubmitted) || this._docs.length;
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
    const input = document.getElementById('bc-num-input');
    const num = (input ? input.value : '').trim();
    if (!num) {
      Utils.showToast('Enter your registration number first.', 'warning');
      return;
    }
    this._busy.bar = true;
    Router.transitionPage('/verification');

    const res = await ApiClient.lookupBarCouncil(num);
    this._busy.bar = false;
    res.blocking = (res.status === 'mismatch');
    this._barResult = res;

    if (res.status === 'verified') Utils.showToast('Registration check passed.', 'success');
    else if (res.status === 'manual_review') Utils.showToast('Submitted to the verification desk for confirmation.', 'info');
    else Utils.showToast(res.message || 'The check could not confirm this registration.', 'warning');

    Router.transitionPage('/verification');
  },

  async uploadDoc(slotKey, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      Utils.showToast('File exceeds the 10 MB limit.', 'error');
      inputEl.value = '';
      return;
    }
    const slot = this._slots.find(s => s.key === slotKey);
    this._busy.upload = slotKey;
    Router.transitionPage('/verification');
    try {
      await ApiClient.uploadDocument(file, slotKey, slot.name);
      await this.loadDocs();
      Utils.showToast(`${slot.name}: uploaded and queued for review.`, 'success');
    } catch (err) {
      Utils.showToast(err.message || 'Upload failed.', 'error');
    }
    this._busy.upload = null;
    Router.transitionPage('/verification');
  },

  async deleteDoc(docId) {
    const ok = await Utils.showConfirm('Remove Document', 'This uploaded file will be removed from your verification record.', { confirmText: 'Remove', type: 'danger' });
    if (!ok) return;
    const done = await ApiClient.deleteDocument(docId);
    if (done) {
      await this.loadDocs();
      Utils.showToast('Document removed.', 'info');
    } else {
      Utils.showToast('Could not remove the document.', 'error');
    }
    Router.transitionPage('/verification');
  },

  handleSelfie(event) {
    const file = event.target.files[0];
    if (!file) return;
    sessionStorage.setItem('lc_selfie_captured', '1');
    Utils.showToast('Selfie captured. It will be compared with your ID by a human reviewer.', 'success');
    Router.transitionPage('/verification');
  },

  async submitIdentity() {
    this._busy.identity = true;
    Router.transitionPage('/verification');
    const selfieDone = sessionStorage.getItem('lc_selfie_captured') === '1';
    const idUploaded = this._docs.some(d => d.category === 'govt_id');
    await ApiClient.submitIdentityCheck(selfieDone, idUploaded);
    this._busy.identity = false;
    Utils.showToast('Identity confirmation submitted for manual review.', 'success');
    this.setStage(4);
  },

  async setStage(stage) {
    if (stage === 4) await this.loadScreeningSummary();
    if (stage === 5) await this.loadScreeningSummary();
    // Refresh lawyer status from server so outcome reflects reality
    if (stage === 5) await Store.refreshFromServer().catch(() => {});
    this._stage = stage;
    Router.transitionPage('/verification');
  },

  completeAndGoDashboard() {
    Router.navigate('/profile');
  }
};
