/* ============================================================
   Nyay Setu USER — CASE MANAGEMENT
   case_page.js — Tell us, AI classification, follow-up,
   case dashboard, documents, vault, timeline
   ============================================================ */

const UserCasePage = {

  /* ==================== TELL US WHAT HAPPENED ==================== */
  renderTellUs() {
    const content = `
      <div class="u-tell-area">
        <div class="u-tell-header">
          <h2>Tell Us What Happened</h2>
          <p>In your own words, describe your situation. Don't worry about legal terms — just tell us like you'd tell a friend.</p>
        </div>

        <div class="u-tell-modes">
          <div class="u-tell-mode active" data-mode="text" onclick="UserCasePage.switchMode('text')">
            <span class="material-symbols-rounded" style="font-size:18px">edit</span> Type
          </div>
          <div class="u-tell-mode" data-mode="voice" onclick="UserCasePage.switchMode('voice')">
            <span class="material-symbols-rounded" style="font-size:18px">mic</span> Speak
          </div>
          <div class="u-tell-mode" data-mode="upload" onclick="UserCasePage.switchMode('upload')">
            <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Upload
          </div>
        </div>

        <!-- Text Mode -->
        <div id="tell-text-mode">
          <div class="u-tell-input-area">
            <textarea class="u-tell-textarea" id="tell-textarea"
                      placeholder="For example: My neighbor has been building a wall on my property land. I have the property registration document. I want to know what I can do about this..."
                      oninput="UserCasePage.updateCharCount(); UserCasePage.handleTextareaInput()"></textarea>
            <div class="u-tell-toolbar">
              <div class="u-tell-toolbar-left">
                <button class="u-tell-tool-btn" onclick="document.getElementById('doc-upload-input').click()" title="Attach document">
                  <span class="material-symbols-rounded">attach_file</span>
                </button>
                <button class="u-tell-tool-btn" title="Take photo">
                  <span class="material-symbols-rounded">photo_camera</span>
                </button>
              </div>
              <span id="char-count" style="font-size:0.72rem;color:var(--u-text-disabled)">0 / 2000</span>
            </div>
          </div>
          <input type="file" id="doc-upload-input" style="display:none" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                 onchange="UserCasePage.handleFileAttach(this.files)">
          <div id="attached-files" style="margin-bottom:16px"></div>
        </div>

        <!-- Voice Mode (hidden by default) -->
        <div id="tell-voice-mode" style="display:none">
          <div class="u-voice-recorder">
            <button class="u-voice-btn" id="voice-btn" onclick="UserCasePage.toggleRecording()">
              <span class="material-symbols-rounded">mic</span>
            </button>
            <p class="u-voice-text" id="voice-text">Tap to start speaking</p>
            <p id="voice-transcript" style="margin-top:16px;font-size:0.88rem;color:var(--u-text-secondary);min-height:40px"></p>
          </div>
        </div>

        <!-- Upload Mode (hidden by default) -->
        <div id="tell-upload-mode" style="display:none">
          <div class="u-doc-upload" onclick="document.getElementById('tell-file-upload').click()">
            <div class="u-doc-upload-icon"><span class="material-symbols-rounded" style="font-size:28px">cloud_upload</span></div>
            <div class="u-doc-upload-text">Upload a document or image</div>
            <div class="u-doc-upload-hint">PDF, JPG, PNG, DOC — Max 10MB each</div>
          </div>
          <input type="file" id="tell-file-upload" style="display:none" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
        </div>

        <div id="smart-lawyer-suggestions" style="display:none">
          <h4 style="font-size:0.85rem;color:var(--u-text-secondary);margin-bottom:12px;display:flex;align-items:center;gap:6px">
            <span class="material-symbols-rounded" style="font-size:16px;color:var(--u-accent-light)">search</span>
            Recommended Lawyers for Your Issue
          </h4>
          <div id="smart-lawyer-list"></div>
        </div>

        <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" style="margin-top:24px"
                id="tell-submit-btn" onclick="UserCasePage.submitDescription()">
          <span class="material-symbols-rounded" style="font-size:20px">auto_awesome</span>
          Analyze My Situation
        </button>
      </div>
    `;
    return UserComponents.AppLayout(content, 'case', 'Tell Us', true);
  },

  switchMode(mode) {
    document.querySelectorAll('.u-tell-mode').forEach(el => el.classList.toggle('active', el.dataset.mode === mode));
    document.getElementById('tell-text-mode').style.display = mode === 'text' ? '' : 'none';
    document.getElementById('tell-voice-mode').style.display = mode === 'voice' ? '' : 'none';
    document.getElementById('tell-upload-mode').style.display = mode === 'upload' ? '' : 'none';
  },

  updateCharCount() {
    const ta = document.getElementById('tell-textarea');
    const counter = document.getElementById('char-count');
    if (ta && counter) counter.textContent = `${ta.value.length} / 2000`;
  },

  _matchedLawyers: [],

  async handleTextareaInput() {
    const text = document.getElementById('tell-textarea')?.value || '';
    const container = document.getElementById('smart-lawyer-suggestions');
    const list = document.getElementById('smart-lawyer-list');
    
    if (text.length < 20) {
      if (container) container.style.display = 'none';
      return;
    }

    const keywords = {
      'property': ['property', 'real estate', 'land', 'encroachment', 'partition'],
      'civil': ['civil', 'injunction', 'dispute', 'money', 'consumer'],
      'criminal': ['criminal', 'police', 'fir', 'bail', 'fraud', 'arrest'],
      'family': ['family', 'divorce', 'marriage', 'custody', 'dowry'],
      'corporate': ['corporate', 'business', 'company', 'startup', 'contract'],
      'cyber': ['cyber', 'online', 'hack', 'data']
    };

    let matchedCategories = [];
    const lowerText = text.toLowerCase();
    
    for (const [cat, words] of Object.entries(keywords)) {
      if (words.some(w => lowerText.includes(w))) {
        matchedCategories.push(cat);
      }
    }

    if (matchedCategories.length > 0) {
      const allLawyers = await UserApiClient.searchLawyers();
      this._matchedLawyers = allLawyers.filter(l => {
        const spec = l.specialization.toLowerCase();
        return matchedCategories.some(cat => spec.includes(cat));
      }).slice(0, 3);

      if (this._matchedLawyers.length > 0 && container && list) {
        list.innerHTML = this._matchedLawyers.map(l => `
          <div class="u-suggest-lawyer-card">
            <div class="u-suggest-lawyer-info">
              <div class="u-suggest-lawyer-avatar">${l.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
              <div class="u-suggest-lawyer-details">
                <h4>${Utils.escapeHtml(l.name)}</h4>
                <p>${Utils.escapeHtml(l.specialization)} · ⭐ ${l.rating}</p>
              </div>
            </div>
            <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="Router.navigate('/lawyer/${l.id}')">View →</button>
          </div>
        `).join('');
        container.style.display = 'block';
      } else {
        if (container) container.style.display = 'none';
      }
    } else {
      if (container) container.style.display = 'none';
    }
  },

  handleFileAttach(files) {
    const container = document.getElementById('attached-files');
    if (!container) return;
    Array.from(files).forEach(f => {
      const el = document.createElement('div');
      el.className = 'u-doc-card';
      el.style.marginBottom = '8px';
      el.innerHTML = `
        <div class="u-doc-thumb"><span class="material-symbols-rounded">${f.type.includes('pdf') ? 'picture_as_pdf' : 'image'}</span></div>
        <div class="u-doc-info">
          <div class="u-doc-name">${Utils.escapeHtml(f.name)}</div>
          <div class="u-doc-meta">${(f.size / 1024).toFixed(0)} KB</div>
        </div>
      `;
      container.appendChild(el);
    });
  },

  _isRecording: false,
  toggleRecording() {
    this._isRecording = !this._isRecording;
    const btn = document.getElementById('voice-btn');
    const text = document.getElementById('voice-text');
    if (this._isRecording) {
      btn.classList.add('recording');
      btn.innerHTML = '<span class="material-symbols-rounded">stop</span>';
      text.textContent = 'Listening... Tap to stop';
    } else {
      btn.classList.remove('recording');
      btn.innerHTML = '<span class="material-symbols-rounded">mic</span>';
      text.textContent = 'Tap to speak again';
      document.getElementById('voice-transcript').textContent = '"My neighbor is building a wall on my property land and I need help to stop this..."';
    }
  },

  async submitDescription() {
    const textarea = document.getElementById('tell-textarea');
    const text = textarea?.value.trim();
    if (!text && !document.getElementById('voice-transcript')?.textContent) {
      Utils.showToast('Please describe your situation first.', 'warning');
      return;
    }

    const btn = document.getElementById('tell-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner" style="width:20px;height:20px;border-width:2px"></span> AI is analyzing...';

    await new Promise(r => setTimeout(r, 2000));
    Router.navigate('/case/new');
  },

  /* ==================== AI CLASSIFICATION RESULT ==================== */
  renderNewCase() {
    const content = `
      <div style="max-width:700px;margin:0 auto">
        <div class="u-ai-result">
          <div class="u-ai-result-header">
            <div class="u-ai-result-icon"><span class="material-symbols-rounded">auto_awesome</span></div>
            <div>
              <div class="u-ai-result-title">AI Case Analysis</div>
              <div class="u-ai-result-subtitle">Here's what we understood from your description</div>
            </div>
          </div>

          <div class="u-case-info-grid" style="margin-bottom:16px">
            <div class="u-case-info-item">
              <div class="u-case-info-label">Category</div>
              <div class="u-case-info-value">Property / Civil</div>
            </div>
            <div class="u-case-info-item">
              <div class="u-case-info-label">Issue Type</div>
              <div class="u-case-info-value">Property Dispute</div>
            </div>
            <div class="u-case-info-item">
              <div class="u-case-info-label">Sub-category</div>
              <div class="u-case-info-value">Encroachment</div>
            </div>
            <div class="u-case-info-item">
              <div class="u-case-info-label">Relevant Laws</div>
              <div class="u-case-info-value">IPC Sec. 441-443</div>
            </div>
            <div class="u-case-info-item">
              <div class="u-case-info-label">Severity</div>
              <div class="u-case-info-value" style="color:var(--u-amber-light)">Medium</div>
            </div>
            <div class="u-case-info-item">
              <div class="u-case-info-label">Court Type</div>
              <div class="u-case-info-value">District Court</div>
            </div>
          </div>

          <div class="u-ai-tags">
            <span class="u-ai-tag">Property Rights</span>
            <span class="u-ai-tag">Encroachment</span>
            <span class="u-ai-tag">Civil Suit</span>
            <span class="u-ai-tag">Injunction</span>
          </div>

          <div class="u-ai-disclaimer">
            ⚠ This is an AI-generated analysis for informational purposes only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation.
          </div>
        </div>

        ${UserComponents.SectionHeader('Follow-Up Questions')}
        <p style="font-size:0.85rem;color:var(--u-text-tertiary);margin-bottom:20px">
          Help us understand your case better by answering a few questions.
        </p>

        <div class="u-followup-list">
          <div class="u-followup-q">
            <div class="u-followup-q-text"><span class="q-num">1</span> Do you have any property registration documents?</div>
            <div style="display:flex;gap:8px">
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="this.classList.add('active');this.style.borderColor='var(--u-accent)';this.style.background='var(--u-accent-subtle)'">Yes</button>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">No</button>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">Not Sure</button>
            </div>
          </div>
          <div class="u-followup-q">
            <div class="u-followup-q-text"><span class="q-num">2</span> When did this issue start?</div>
            <input type="text" class="u-input" placeholder="e.g., 2 months ago, March 2024">
          </div>
          <div class="u-followup-q">
            <div class="u-followup-q-text"><span class="q-num">3</span> Have you spoken to the neighbor about this?</div>
            <div style="display:flex;gap:8px">
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">Yes</button>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">No</button>
            </div>
          </div>
          <div class="u-followup-q">
            <div class="u-followup-q-text"><span class="q-num">4</span> Is there a local panchayat or municipality involved?</div>
            <div style="display:flex;gap:8px">
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">Yes</button>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">No</button>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill">Not Sure</button>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:32px">
          <button class="u-btn u-btn-primary u-btn-lg u-btn-pill" style="flex:1" onclick="UserCasePage.createCase()">
            <span class="material-symbols-rounded" style="font-size:20px">folder_open</span>
            Create Case File
          </button>
        </div>
        
        ${this._matchedLawyers && this._matchedLawyers.length > 0 ? `
          <div style="margin-top: 32px">
            ${UserComponents.SectionHeader('Recommended Lawyers For You')}
            <div style="display:flex;flex-direction:column;gap:12px">
              ${this._matchedLawyers.map(l => `
                <div class="u-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="u-lawyer-avatar" style="width:48px;height:48px;font-size:1rem">${l.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                    <div>
                      <h4 style="font-size:1rem;font-weight:700;margin-bottom:2px">${Utils.escapeHtml(l.name)}</h4>
                      <div style="font-size:0.8rem;color:var(--u-text-tertiary)">${Utils.escapeHtml(l.specialization)} · ₹${l.fee}</div>
                    </div>
                  </div>
                  <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="Router.navigate('/consultation/book?lawyerId=${l.id}')">Book</button>
                </div>
              `).join('')}
            </div>
            <div style="text-align:center;margin-top:12px">
              <button class="u-btn btn-ghost u-btn-sm" onclick="Router.navigate('/lawyers/recommended')" style="color:var(--u-accent-light)">View All Recommendations</button>
            </div>
          </div>
        ` : `
          <div style="display:flex;margin-top:12px">
            <button class="u-btn u-btn-secondary u-btn-lg u-btn-pill" style="width:100%" onclick="Router.navigate('/lawyers/recommended')">
              <span class="material-symbols-rounded" style="font-size:20px">person_search</span>
              Find Lawyer
            </button>
          </div>
        `}
      </div>
    `;
    return UserComponents.AppLayout(content, 'case', 'AI Analysis', true);
  },

  createCase() {
    Utils.showToast('Case file created!', 'success');
    const cases = UserStore.getCases();
    if (cases.length > 0) Router.navigate(`/case/${cases[0].id}`);
    else Router.navigate('/home');
  },

  /* ==================== CASE DASHBOARD ==================== */
  renderCase(caseId) {
    const caseData = UserStore.getCases().find(c => c.id === caseId) || UserStore.getCases()[0];
    if (!caseData) {
      return UserComponents.AppLayout(
        UserComponents.EmptyState('folder_off', 'No Case Found', 'Start by telling us what happened.', 'Tell Us', "Router.navigate('/tell-us')"),
        'case', 'My Case'
      );
    }

    const content = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="font-size:1.4rem;font-weight:800;margin-bottom:4px">${Utils.escapeHtml(caseData.title)}</h2>
          <p style="font-size:0.82rem;color:var(--u-text-tertiary)">${Utils.escapeHtml(caseData.type || '')} · ${Utils.escapeHtml(caseData.court || caseData.location || '')}</p>
        </div>
        <div class="u-case-strip-status ${caseData.status}" style="font-size:0.78rem;padding:6px 16px">
          ${caseData.status === 'ongoing' ? 'Ongoing' : caseData.status === 'resolved' ? 'Resolved' : 'New'}
        </div>
      </div>

      <!-- Case Tabs -->
      <div class="u-case-tabs" id="case-tabs">
        <div class="u-case-tab active" data-tab="overview" onclick="UserCasePage.switchTab('overview')">Overview</div>
        <div class="u-case-tab" data-tab="timeline" onclick="UserCasePage.switchTab('timeline')">Timeline</div>
        <div class="u-case-tab" data-tab="documents" onclick="UserCasePage.switchTab('documents')">Documents</div>
        <div class="u-case-tab" data-tab="vault" onclick="UserCasePage.switchTab('vault')">Vault</div>
        <div class="u-case-tab" data-tab="sharing" onclick="UserCasePage.switchTab('sharing')">Sharing</div>
      </div>

      <!-- Tab: Overview -->
      <div id="tab-overview">
        <div class="u-case-info-grid" style="margin-bottom:24px">
          <div class="u-case-info-item">
            <div class="u-case-info-label">Case Type</div>
            <div class="u-case-info-value">${Utils.escapeHtml(caseData.type || '–')}</div>
          </div>
          <div class="u-case-info-item">
            <div class="u-case-info-label">Court</div>
            <div class="u-case-info-value">${Utils.escapeHtml(caseData.court || '–')}</div>
          </div>
          <div class="u-case-info-item">
            <div class="u-case-info-label">Location</div>
            <div class="u-case-info-value">${Utils.escapeHtml(caseData.location || '–')}</div>
          </div>
          <div class="u-case-info-item">
            <div class="u-case-info-label">People Involved</div>
            <div class="u-case-info-value">${Utils.escapeHtml(caseData.peopleInvolved || '–')}</div>
          </div>
          <div class="u-case-info-item">
            <div class="u-case-info-label">Started</div>
            <div class="u-case-info-value">${caseData.createdAt ? new Date(caseData.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '–'}</div>
          </div>
          <div class="u-case-info-item">
            <div class="u-case-info-label">Documents</div>
            <div class="u-case-info-value">${(caseData.documents || []).length} files</div>
          </div>
        </div>

        ${caseData.description ? `
          <div class="u-card" style="margin-bottom:24px">
            <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:8px;color:var(--u-text-secondary)">Description</h4>
            <p style="font-size:0.85rem;color:var(--u-text-tertiary);line-height:1.6">${Utils.escapeHtml(caseData.description)}</p>
          </div>
        ` : ''}

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="u-btn u-btn-primary u-btn-pill" onclick="Router.navigate('/chat')">
            <span class="material-symbols-rounded" style="font-size:18px">chat</span> Ask About This Case
          </button>
          <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/hearing/prepare')">
            <span class="material-symbols-rounded" style="font-size:18px">gavel</span> Prepare for Hearing
          </button>
        </div>
      </div>

      <!-- Tab: Timeline -->
      <div id="tab-timeline" style="display:none">
        ${(caseData.timeline || []).length > 0 ? `
          <div class="u-timeline">
            ${caseData.timeline.map(t => `
              <div class="u-timeline-item">
                <div class="u-timeline-dot ${t.status}"></div>
                <div class="u-timeline-title">${Utils.escapeHtml(t.title)}</div>
                <div class="u-timeline-date">${new Date(t.date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</div>
                ${t.desc ? `<div class="u-timeline-desc">${Utils.escapeHtml(t.desc)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : UserComponents.EmptyState('timeline', 'No Timeline Yet', 'Events will appear here as your case progresses.')}
      </div>

      <!-- Tab: Documents -->
      <div id="tab-documents" style="display:none">
        <div class="u-doc-upload" onclick="document.getElementById('case-doc-upload').click()" style="margin-bottom:20px">
          <div class="u-doc-upload-icon"><span class="material-symbols-rounded" style="font-size:28px">cloud_upload</span></div>
          <div class="u-doc-upload-text">Upload Documents</div>
          <div class="u-doc-upload-hint">PDF, JPG, PNG — Max 10MB each</div>
        </div>
        <input type="file" id="case-doc-upload" style="display:none" multiple>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${UserStore.getDocuments().map(d => `
            <div class="u-doc-card">
              <div class="u-doc-thumb"><span class="material-symbols-rounded">${d.name.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}</span></div>
              <div class="u-doc-info">
                <div class="u-doc-name">${Utils.escapeHtml(d.name)}</div>
                <div class="u-doc-meta">${d.size} · ${Utils.escapeHtml(d.category || '')}</div>
              </div>
              <div class="u-doc-privacy ${d.privacy}">${d.privacy === 'shared' ? '🔗 Shared' : '🔒 Private'}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Tab: Vault -->
      <div id="tab-vault" style="display:none">
        <div class="u-card" style="text-align:center;padding:40px">
          <div class="u-empty-icon" style="margin:0 auto 16px;background:var(--u-emerald-subtle);border-color:rgba(16,185,129,0.15)">
            <span class="material-symbols-rounded" style="color:var(--u-emerald-light)">enhanced_encryption</span>
          </div>
          <h3 style="font-size:1.1rem;margin-bottom:8px">Secure Case Vault</h3>
          <p style="font-size:0.82rem;color:var(--u-text-tertiary);max-width:360px;margin:0 auto 20px;line-height:1.6">
            Your case vault is a private, encrypted space. Only you decide who can access it.
          </p>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <span class="u-badge u-badge-emerald">🔒 End-to-end encrypted</span>
            <span class="u-badge u-badge-accent">📁 ${UserStore.getDocuments().length} documents</span>
          </div>
        </div>
      </div>

      <!-- Tab: Sharing -->
      <div id="tab-sharing" style="display:none">
        <p style="font-size:0.85rem;color:var(--u-text-tertiary);margin-bottom:20px">
          Control who can access your case information and documents.
        </p>
        <div class="u-card">
          <div class="u-share-item">
            <div class="u-share-item-left">
              <span class="material-symbols-rounded" style="color:var(--u-accent-light)">person</span>
              <span class="u-share-item-text">Adv. Rahul Sharma (Your Lawyer)</span>
            </div>
            <label class="u-toggle">
              <input type="checkbox" checked>
              <span class="u-toggle-track"></span>
              <span class="u-toggle-thumb"></span>
            </label>
          </div>
          <div class="u-share-item">
            <div class="u-share-item-left">
              <span class="material-symbols-rounded" style="color:var(--u-text-disabled)">smart_toy</span>
              <span class="u-share-item-text">Nyay Setu AI</span>
            </div>
            <label class="u-toggle">
              <input type="checkbox" checked>
              <span class="u-toggle-track"></span>
              <span class="u-toggle-thumb"></span>
            </label>
          </div>
        </div>
      </div>
    `;
    return UserComponents.AppLayout(content, 'case', 'My Case', true);
  },

  switchTab(tab) {
    document.querySelectorAll('.u-case-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    ['overview', 'timeline', 'documents', 'vault', 'sharing'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? '' : 'none';
    });
  },

  /* ==================== CASE LIST ==================== */
  renderCaseList() {
    const cases = UserStore.getCases();
    if (cases.length === 0) {
      return UserComponents.AppLayout(
        UserComponents.EmptyState('folder_off', 'No Cases Yet', 'Tell us about your legal situation to get started.', 'Tell Us What Happened', "Router.navigate('/tell-us')"),
        'case', 'My Cases'
      );
    }
    if (cases.length === 1) return this.renderCase(cases[0].id);

    const content = `
      ${UserComponents.SectionHeader('Your Cases')}
      ${cases.map(c => `
        <div class="u-case-strip" onclick="Router.navigate('/case/${c.id}')">
          <div class="u-case-strip-type"><span class="material-symbols-rounded">folder_open</span></div>
          <div class="u-case-strip-info">
            <div class="u-case-strip-title">${Utils.escapeHtml(c.title)}</div>
            <div class="u-case-strip-meta"><span>${Utils.escapeHtml(c.type || 'Case')}</span></div>
          </div>
          <div class="u-case-strip-status ${c.status}">${c.status}</div>
        </div>
      `).join('')}
    `;
    return UserComponents.AppLayout(content, 'case', 'My Cases');
  }
};
