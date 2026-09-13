/* ============================================================
   Nyay Setu USER — COURT PREPARATION & SIMULATOR
   court_page.js — Hearing Prep, Checklists, Virtual Court,
   Hearing Day Hub, Post-Hearing Outcomes
   ============================================================ */

const UserCourtPage = {

  /* ==================== 1. HEARING PREPARATION (STEPS 35-38) ==================== */
  renderPrep(caseId) {
    const activeCase = UserStore.getActiveCase();
    const hearing = UserStore.getUpcomingHearing();

    const content = `
      <div style="max-width:760px;margin:0 auto">
        <div class="u-prep-header">
          <div class="u-prep-header-icon">
            <span class="material-symbols-rounded">gavel</span>
          </div>
          <h2>Court Hearing Preparation</h2>
          <p>Everything you need to know, carry, and practice before your next hearing on <strong>${hearing ? new Date(hearing.date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : 'Upcoming Date'}</strong>.</p>
        </div>

        <!-- Step-by-step explainer -->
        <div class="u-card" style="margin-bottom:24px">
          <h3 class="u-section-title">What Happens In Court (In Plain Language)</h3>
          <div class="u-explainer">
            <div class="u-explainer-step">
              <div class="u-explainer-num">1</div>
              <div class="u-explainer-content">
                <div class="u-explainer-title">Case Calling & Roll Call</div>
                <div class="u-explainer-text">The court clerk will call out your case title and item number. Your advocate will answer and present your presence before the bench.</div>
              </div>
            </div>
            <div class="u-explainer-step">
              <div class="u-explainer-num">2</div>
              <div class="u-explainer-content">
                <div class="u-explainer-title">Advocate Arguments</div>
                <div class="u-explainer-text">Your lawyer Adv. Rahul Sharma will address the Judge, present your property deed, and petition for necessary injunctions. You will stand quietly beside your lawyer unless specifically asked a question by the Judge.</div>
              </div>
            </div>
            <div class="u-explainer-step">
              <div class="u-explainer-num">3</div>
              <div class="u-explainer-content">
                <div class="u-explainer-title">Order / Next Date Allotment</div>
                <div class="u-explainer-text">The Judge will issue an interim order or grant the opposing party time to file a reply, and assign the next hearing date.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Hearing Day Checklist -->
        <div class="u-card" style="margin-bottom:24px">
          <h3 class="u-section-title">Essential Hearing Day Checklist</h3>
          <div class="u-checklist">
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">Carry original Aadhaar Card and 2 recent passport-size photos</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">Keep original Property Sale Deed and Registry Copies in a waterproof folder</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">Dress in formal/modest attire (plain collared shirt, trousers)</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">Arrive at Court Complex Hall No. 4 by 09:45 AM (30 mins before session)</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">Turn off mobile phone or set to silent before stepping inside Courtroom</div>
            </div>
          </div>
        </div>

        <!-- Action CTAs -->
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="u-btn u-btn-primary u-btn-lg u-btn-pill" style="flex:1"
                  onclick="Router.navigate('/court/simulate')">
            <span class="material-symbols-rounded" style="font-size:20px">sports_esports</span>
            Practice in Virtual Court Simulator
          </button>
          <button class="u-btn u-btn-secondary u-btn-lg u-btn-pill" onclick="Router.navigate('/hearing/today')">
            <span class="material-symbols-rounded" style="font-size:20px">today</span>
            Hearing Day Mode
          </button>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'court', 'Hearing Prep');
  },

  /* ==================== 2. VIRTUAL COURTROOM SIMULATOR (STEP 39) ==================== */
  renderSimulator() {
    const content = `
      <div class="u-court-sim">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <h2 style="font-size:1.5rem;font-weight:800">Virtual Court Simulator ⚖️</h2>
            <p style="font-size:0.85rem;color:var(--u-text-tertiary)">Interactive walkthrough of how your courtroom is arranged and where to stand</p>
          </div>
          <button class="u-btn-icon" onclick="Router.navigate('/court')">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <!-- Courtroom visual interactive arena -->
        <div class="u-courtroom">
          <!-- Judge Bench -->
          <div class="u-court-judge">
            <div class="u-court-judge-bench">
              <div class="u-court-judge-avatar">
                <span class="material-symbols-rounded" style="font-size:28px">gavel</span>
              </div>
              <div class="u-court-judge-label">Honorable Judge Bench</div>
              <p style="font-size:0.75rem;color:var(--u-text-tertiary);margin-top:2px">Presiding Magistrate / Civil Judge</p>
            </div>
          </div>

          <!-- Podium / Advocate & Client Areas -->
          <div class="u-court-areas">
            <!-- Petitioner Side (You) -->
            <div class="u-court-area" style="border-color:rgba(26,39,68,0.25);background:rgba(26,39,68,0.03)">
              <div class="u-court-area-icon you">
                <span class="material-symbols-rounded">person</span>
              </div>
              <div class="u-court-area-label" style="color:var(--u-primary)">You & Your Advocate (Petitioner)</div>
              <div class="u-court-area-desc">Advocate stands in front of the microphone. You stand respectfully 1 step behind.</div>
              <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" style="margin-top:12px"
                      onclick="Utils.showToast('You step up to the petitioner podium with Advocate Rahul.', 'info')">
                View Your Position
              </button>
            </div>

            <!-- Respondent Side -->
            <div class="u-court-area">
              <div class="u-court-area-icon lawyer">
                <span class="material-symbols-rounded">group</span>
              </div>
              <div class="u-court-area-label">Opposing Party & Counsel</div>
              <div class="u-court-area-desc">Respondent advocate stands across the central aisle facing the Judge.</div>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" style="margin-top:12px"
                      onclick="Utils.showToast('Opposing counsel is represented across the aisle.', 'info')">
                View Opposing Side
              </button>
            </div>
          </div>
        </div>

        <!-- Courtroom Etiquette Tips -->
        <div class="u-court-tips">
          <div class="u-court-tip">
            <div class="u-court-tip-icon"><span class="material-symbols-rounded">record_voice_over</span></div>
            <div class="u-court-tip-text"><strong>Addressing Judge:</strong> Always address the Judge as <em>"Your Honour"</em> or <em>"My Lord"</em>.</div>
          </div>
          <div class="u-court-tip">
            <div class="u-court-tip-icon"><span class="material-symbols-rounded">volume_off</span></div>
            <div class="u-court-tip-text"><strong>Maintain Silence:</strong> Do not speak out of turn. Let your appointed advocate represent your statements.</div>
          </div>
          <div class="u-court-tip">
            <div class="u-court-tip-icon"><span class="material-symbols-rounded">front_hand</span></div>
            <div class="u-court-tip-text"><strong>Body Language:</strong> Stand straight, no hands in pockets, no folding arms across chest.</div>
          </div>
        </div>
      </div>
    `;

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
          </div>

          <div class="u-input-group">
            <label class="u-input-label">Next Hearing Date (if assigned)</label>
            <input type="date" class="u-input" id="post-hearing-next-date">
          </div>

          <div class="u-input-group">
            <label class="u-input-label">Next Hearing Purpose</label>
            <input type="text" class="u-input" placeholder="e.g. Filing of Counter Affidavit by Respondent" id="post-hearing-purpose">
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
