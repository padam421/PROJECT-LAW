/* ============================================================
   Nyay Setu USER — COURT PREPARATION & SIMULATOR
   court_page.js — Hearing Prep, Checklists, Virtual Court,
   Hearing Day Hub, Post-Hearing Outcomes
   ============================================================ */

const UserCourtPage = {

  /* ==================== 1. VIRTUAL COURT LANDING HUB ==================== */
  renderPrep(caseId) {
    const content = typeof VirtualCourtSimulator !== 'undefined'
      ? VirtualCourtSimulator.renderLanding()
      : '<div style="padding:40px;text-align:center">Loading Virtual Court Simulator...</div>';
    const saved = typeof SavedCourtSessions !== 'undefined' ? SavedCourtSessions.render() : '';
    return UserComponents.AppLayout(saved + content, 'court', 'Virtual Court Hub');
  },

  /* ==================== 2. VIRTUAL COURTROOM SIMULATOR ==================== */
  renderSimulator() {
    const content = typeof VirtualCourtSimulator !== 'undefined'
      ? VirtualCourtSimulator.render()
      : '<div style="padding:40px;text-align:center">Loading Courtroom Simulation...</div>';

    setTimeout(() => {
      if (typeof VirtualCourtSimulator !== 'undefined') {
        VirtualCourtSimulator.startSimulation();
      }
    }, 350);

    return UserComponents.AppLayout(content, 'court', 'Court Simulator', true);
  },

  /* ==================== 3. HEARING DAY SCREEN (STEP 41) ==================== */
  renderHearingDay() {
    const hearing = UserStore.getUpcomingHearing() || {
      caseTitle: 'Property Dispute Partition Suit',
      court: 'District Court, Hyderabad - Hall 4',
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
              <div class="u-hearing-day-detail-value">Adv. Rahul Sharma</div>
            </div>
          </div>
        </div>

        <div class="u-hearing-day-actions">
          <button class="u-btn u-btn-primary u-btn-pill" onclick="Router.navigate('/chat')">
            <span class="material-symbols-rounded">chat</span> AI Assistance
          </button>
          <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/my-lawyer')">
            <span class="material-symbols-rounded">call</span> Call Lawyer
          </button>
          <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/hearing/after')">
            <span class="material-symbols-rounded">fact_check</span> Log Outcome
          </button>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'court', 'Hearing Day', true);
  },

  /* ==================== 4. POST-HEARING UPDATE (STEPS 42-43) ==================== */
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
                  onclick="UserCourtPage.saveHearingOutcome()">
            <span class="material-symbols-rounded">save</span> Update Case Timeline
          </button>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'court', 'Log Hearing Outcome', true);
  },

  saveHearingOutcome() {
    Utils.showToast('Case timeline and next hearing updated!', 'success');
    Router.navigate('/case');
  }
};
