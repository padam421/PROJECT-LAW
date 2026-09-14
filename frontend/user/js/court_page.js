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

        <!-- AI Live Courtroom Simulation Studio -->
        <div class="u-card" style="margin-top:24px;border:1px solid rgba(13,148,136,0.3);background:linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div style="width:36px;height:36px;border-radius:10px;background:var(--u-accent-gradient);display:grid;place-items:center;color:#fff">
              <span class="material-symbols-rounded" style="font-size:20px">smart_toy</span>
            </div>
            <div>
              <h3 style="font-size:1.1rem;font-weight:800;color:var(--u-primary);margin:0">AI Courtroom Argument Simulator</h3>
              <p style="font-size:0.8rem;color:var(--u-text-tertiary);margin:0">Simulate Judge, Defense Counsel, and Public Prosecutor arguing your case based on Supreme Court precedents</p>
            </div>
          </div>

          <div class="u-input-group" style="margin-bottom:12px">
            <label class="u-input-label" style="font-weight:700">Enter Your Case Summary / Legal Dispute:</label>
            <textarea id="court-sim-summary" class="u-textarea" rows="3" placeholder="e.g. My brother filed a false FIR under Section 420 IPC and Section 307 for an alleged family land dispute. We have registered sale deeds and eyewitness affidavits proving absence from the scene..."></textarea>
          </div>

          <!-- Quick Samples -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            <span style="font-size:0.75rem;color:var(--u-text-tertiary);align-self:center">Try Sample:</span>
            <button class="u-btn u-btn-secondary u-btn-sm" style="font-size:0.75rem;padding:4px 10px" onclick="UserCourtPage.fillSample(1)">UAPA Anticipatory Bail</button>
            <button class="u-btn u-btn-secondary u-btn-sm" style="font-size:0.75rem;padding:4px 10px" onclick="UserCourtPage.fillSample(2)">NDPS Search Non-Compliance</button>
            <button class="u-btn u-btn-secondary u-btn-sm" style="font-size:0.75rem;padding:4px 10px" onclick="UserCourtPage.fillSample(3)">Property Partition & Injunction</button>
          </div>

          <button id="court-sim-btn" class="u-btn u-btn-primary u-btn-pill" onclick="UserCourtPage.runSimulation()" style="width:100%;justify-content:center">
            <span class="material-symbols-rounded">gavel</span> Start Live AI Courtroom Simulation
          </button>

          <!-- Simulation Results Container -->
          <div id="court-sim-results" style="display:none;margin-top:20px;padding:18px;border-radius:12px;background:#ffffff;border:1px solid var(--u-border);line-height:1.7;font-size:0.9rem">
          </div>
        </div>

        <!-- Courtroom Etiquette Tips -->
        <div class="u-court-tips" style="margin-top:24px">
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

  fillSample(num) {
    const input = document.getElementById('court-sim-summary');
    if (!input) return;
    if (num === 1) {
      input.value = "Accused is charged under Section 43-D(5) of UAPA along with conspiracy charges. Investigation has been ongoing for 14 months without a supplementary chargesheet. We are seeking bail based on violation of Article 21 and Supreme Court right to speedy trial rulings.";
    } else if (num === 2) {
      input.value = "Client apprehended with alleged commercial quantity of contraband under NDPS Act. Police failed to give mandatory written notice under Section 50 regarding right to be searched before Gazetted Officer or Magistrate. Independent seizure witnesses turned hostile.";
    } else if (num === 3) {
      input.value = "Ancestral property partition suit. Defendant attempting to alienate joint Hindu family property and create third party rights using an unregistered gift deed. Plaintiff seeking interim injunction under Order 39 Rules 1 & 2 CPC.";
    }
  },

  async runSimulation() {
    const input = document.getElementById('court-sim-summary');
    const btn = document.getElementById('court-sim-btn');
    const resDiv = document.getElementById('court-sim-results');
    const summary = input?.value.trim();

    if (!summary) {
      Utils.showToast('Please enter your case summary first.', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s infinite linear">sync</span> Simulating Judge, Defense Counsel & Prosecutor Arguments...';
    }
    if (resDiv) {
      resDiv.style.display = 'block';
      resDiv.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--u-text-tertiary)">
          <div style="width:40px;height:40px;border:3px solid var(--u-accent-light);border-top-color:transparent;border-radius:50%;animation:spin 1s infinite linear;margin:0 auto 12px"></div>
          <strong style="color:var(--u-primary)">Analyzing Supreme Court Database & Convening Courtroom Bench...</strong>
          <p style="font-size:0.8rem;margin-top:6px">Reviewing precedents, testing maintainability, and generating multi-scenario arguments.</p>
        </div>
      `;
    }

    try {
      const simulation = await UserApiClient.simulateCourtroom(summary);
      if (resDiv) {
        // Convert markdown headings and bold to rich HTML
        let formatted = Utils.escapeHtml(simulation)
          .replace(/^### (.*$)/gim, '<h4 style="color:var(--u-primary);margin-top:18px;margin-bottom:8px;font-weight:800;font-size:1.05rem;border-bottom:1px solid #e2e8f0;padding-bottom:4px">$1</h4>')
          .replace(/^## (.*$)/gim, '<h3 style="color:var(--u-primary);margin-top:20px;margin-bottom:10px;font-weight:800;font-size:1.2rem">$1</h3>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n\n/g, '<br><br>')
          .replace(/\n/g, '<br>');

        resDiv.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
            <span style="font-weight:800;color:#0d9488;display:flex;align-items:center;gap:6px">
              <span class="material-symbols-rounded">verified</span> Authentic Supreme Court Simulation
            </span>
            <button class="u-btn u-btn-secondary u-btn-sm" onclick="window.print()">Print Dossier</button>
          </div>
          ${formatted}
        `;
      }
    } catch (err) {
      if (resDiv) {
        resDiv.innerHTML = `<div style="color:#ef4444;padding:12px">Failed to generate courtroom simulation. Please check connection.</div>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">gavel</span> Start Live AI Courtroom Simulation';
      }
    }
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
