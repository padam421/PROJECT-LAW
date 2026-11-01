/* ============================================================
   Nyay Setu ADVOCATE — COURT PREPARATION & SIMULATOR
   court_page.js — Advocate research-linked counsel rehearsal,
   Hearing Day Hub, Post-Hearing Outcomes
   Separate from the citizen courtroom demonstration
   ============================================================ */

const AdvocateCourtPage = {

  /* ==================== 1. VIRTUAL COURT LANDING HUB ==================== */
  render(caseId) {
    return this.renderPrep(caseId);
  },

  renderPrep(caseId) {
    AssistantThreads.hydrate();
    return Components.AppLayout(AdvocateRehearsal.library(), 'court', 'Advocate Hearing Lab');
  },

  /* ==================== 2. VIRTUAL COURTROOM SIMULATOR ==================== */
  renderSimulator() {
    return Components.AppLayout(AdvocateRehearsal.render(), 'court', 'Counsel Rehearsal');
  },

  /* ==================== 3. HEARING DAY SCREEN ==================== */
  renderHearingDay() {
    const hearing = {
      caseTitle: 'Property Dispute Partition Suit',
      court: 'District Court Complex - Hall 4',
      time: '10:30 AM',
      itemNumber: 'Item #14'
    };

    const content = `
      <div class="u-hearing-day">
        <div class="u-hearing-day-hero">
          <div class="u-hearing-day-badge">
            <span class="material-symbols-rounded" style="font-size:16px">event_upcoming</span>
            Hearing Day Active Hub
          </div>
          <h2 class="u-hearing-day-case">${Utils.escapeHtml(hearing.caseTitle)}</h2>
          <p style="font-size:0.85rem;color:var(--u-text-tertiary);margin-bottom:20px">${Utils.escapeHtml(hearing.court)}</p>

          <div class="u-hearing-day-details">
            <div class="u-hearing-day-detail">
              <div class="u-hearing-day-detail-label">Listing Item</div>
              <div class="u-hearing-day-detail-value" style="color:var(--u-amber-light)">Item #14</div>
            </div>
            <div class="u-hearing-day-detail">
              <div class="u-hearing-day-detail-label">Expected Time</div>
              <div class="u-hearing-day-detail-value">${hearing.time || '10:30 AM'}</div>
            </div>
            <div class="u-hearing-day-detail">
              <div class="u-hearing-day-detail-label">Advocate on Record</div>
              <div class="u-hearing-day-detail-value">Advocate Practice</div>
            </div>
          </div>
        </div>

        <div class="u-hearing-day-actions">
          <button class="u-btn u-btn-primary u-btn-pill" onclick="Router.navigate('/ai-assistant')">
            <span class="material-symbols-rounded">chat</span> Ask Nyay Setu AI
          </button>
          <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/court/simulate')">
            <span class="material-symbols-rounded">play_arrow</span> Rehearse Simulation
          </button>
          <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/hearing/after')">
            <span class="material-symbols-rounded">fact_check</span> Log Outcome
          </button>
        </div>
      </div>
    `;

    return Components.AppLayout(content, 'court', 'Hearing Day');
  },

  /* ==================== 4. POST-HEARING UPDATE ==================== */
  renderPostHearing() {
    const content = `
      <div class="u-post-hearing">
        <div style="text-align:center;margin-bottom:24px">
          <div class="u-success-icon"><span class="material-symbols-rounded">fact_check</span></div>
          <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:4px">Record Hearing Outcome</h2>
          <p style="font-size:0.85rem;color:var(--u-text-tertiary)">Keep your case timeline updated with the Judge's orders and next dates.</p>
        </div>

        <div class="u-card" style="margin-bottom:20px">
          <div class="u-input-group">
            <label class="u-input-label">What happened in court today?</label>
            <textarea class="u-textarea" placeholder="e.g. Judge issued notice to respondents, next date fixed for counter affidavit..." id="post-hearing-notes"></textarea>
            ${typeof VoiceInput !== 'undefined' ? VoiceInput.controls('post-hearing-notes') : ''}
          </div>

          <div class="u-input-group">
            <label class="u-input-label">Next Hearing Date (if assigned)</label>
            <input type="date" class="u-input" id="post-hearing-next-date">
          </div>

          <div class="u-input-group">
            <label class="u-input-label">Next Hearing Purpose</label>
            <input type="text" class="u-input" placeholder="e.g. Filing of Counter Affidavit by Respondent" id="post-hearing-purpose">
            ${typeof VoiceInput !== 'undefined' ? VoiceInput.controls('post-hearing-purpose') : ''}
          </div>

          <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" style="margin-top:12px"
                  onclick="AdvocateCourtPage.saveHearingOutcome()">
            <span class="material-symbols-rounded">save</span> Update Case Timeline
          </button>
        </div>
      </div>
    `;

    return Components.AppLayout(content, 'court', 'Log Hearing Outcome');
  },

  saveHearingOutcome() {
    Utils.showToast('Case timeline and next hearing updated!', 'success');
    Router.navigate('/cases');
  },

  showProtocols() {
    Router.navigate('/court');
  }
};
