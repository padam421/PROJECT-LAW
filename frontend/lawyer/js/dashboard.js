/* ============================================================
   Nyay Setu — LAWYER DASHBOARD
   dashboard.js — Live workspace overview: stats, today's
   schedule, pending requests, AI-assisted case insights.
   ============================================================ */

const DashboardPage = {
  render() {
    const lawyer = Store.getState('lawyerProfile') || {};
    const activeClients = Store.getActiveClients().length;
    const pendingReqs = Store.getPendingRequests();
    const todayAppts = Store.getTodayAppointments();
    const monthlyEarnings = Store.getMonthlyEarnings();
    const rating = Store.getAverageRating();
    const greeting = Utils.getGreeting();
    const isVerified = lawyer.verificationStatus === 'verified';
    const deactivated = !!lawyer.profileDeactivated;

    const contentHtml = `
      ${deactivated ? this.deactivatedBanner() : ''}

      <!-- Greeting Banner -->
      <div class="dashboard-greeting">
        <div class="greeting-left">
          <h2 class="greeting-text">${greeting}, <span>${Utils.escapeHtml(lawyer.professionalName || lawyer.fullName || 'Advocate')}</span></h2>
          <div class="d-flex items-center gap-3 flex-wrap">
            <span class="greeting-badge ${isVerified ? '' : 'pending'}">
              ${lawyer.workspaceOnly ? 'Client &amp; Lawyer workspace access' : isVerified
                ? `<span class="verified-tick"><span class="material-symbols-rounded">check</span></span> Verified Advocate &bull; Bar ID ${Utils.escapeHtml(lawyer.barCouncil || '')}`
                : lawyer.demoMode ? 'Demo profile — not verified' : `<span class="material-symbols-rounded icon-sm">hourglass_top</span> Verification in progress`}
            </span>
            <span class="greeting-date">${Utils.formatDate(new Date(), 'full')}</span>
          </div>
        </div>

        <div class="d-flex gap-3 flex-wrap">
          <button class="btn btn-secondary" onclick="Router.navigate('/cases/new')">
            <span class="material-symbols-rounded">add_circle</span> New Case File
          </button>
          <button class="btn btn-primary" onclick="Router.navigate('/consultation')">
            <span class="material-symbols-rounded">video_call</span> Consultation Room
          </button>
        </div>
      </div>

      <!-- Advocate Virtual Court & AI Assistant Showcase (Task 3) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:20px;margin-bottom:24px">
        <!-- 1. Virtual Courtroom Simulator Card -->
        <div class="card" style="background:linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);border:1px solid rgba(245,158,11,0.35);box-shadow:var(--shadow-sm);position:relative;overflow:hidden">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#b45309);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 14px rgba(245,158,11,0.35)">
                <span class="material-symbols-rounded" style="font-size:26px">gavel</span>
              </div>
              <div>
                <div style="font-size:0.75rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px">Interactive 3D Practice</div>
                <h3 style="font-size:1.2rem;font-weight:800;color:var(--color-primary);margin:0">Court Preparation</h3>
              </div>
            </div>
            <span class="badge badge-accent" style="background:rgba(245,158,11,0.15);color:#d97706;border:1px solid rgba(245,158,11,0.3)">Advocate Mode</span>
          </div>
          <p style="font-size:0.88rem;color:var(--color-gray-600);line-height:1.5;margin-bottom:18px">
            Step into the virtual bench. Rehearse petitioner submissions, practice judicial bench etiquette, and prepare cross-examination before real courtroom appearances.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="Router.navigate('/court')">
              <span class="material-symbols-rounded">sports_esports</span> Enter Court Preparation
            </button>
            <button class="btn btn-secondary btn-sm" onclick="AdvocateCourtPage ? (AdvocateCourtPage.showProtocols ? AdvocateCourtPage.showProtocols() : Router.navigate('/court')) : Router.navigate('/court')">
              <span class="material-symbols-rounded">menu_book</span> Bench Protocols
            </button>
          </div>
        </div>

        <!-- 2. AI Legal Assistant & Query Card -->
        <div class="card" style="background:linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);border:1px solid rgba(13,148,136,0.3);box-shadow:var(--shadow-sm);position:relative;overflow:hidden">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#0d9488,#0f766e);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 14px rgba(13,148,136,0.35)">
                <span class="material-symbols-rounded" style="font-size:26px">auto_awesome</span>
              </div>
              <div>
                <div style="font-size:0.75rem;font-weight:700;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.5px">Instant Legal Intelligence</div>
                <h3 style="font-size:1.2rem;font-weight:800;color:var(--color-primary);margin:0">Ask Nyay Setu</h3>
              </div>
            </div>
            <span class="badge badge-accent">BNS / IPC / Precedents</span>
          </div>
          <p style="font-size:0.88rem;color:var(--color-gray-600);line-height:1.5;margin-bottom:14px">
            Search case law precedents, draft legal arguments for injunctions, translate IPC sections to BNS 2023, or summarize complex case briefs.
          </p>
          <div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto">
            <span class="badge badge-neutral" style="cursor:pointer;padding:4px 10px;font-size:0.75rem" onclick="Router.navigate('/ai-assistant')">
              📖 IPC to BNS Converter
            </span>
            <span class="badge badge-neutral" style="cursor:pointer;padding:4px 10px;font-size:0.75rem" onclick="Router.navigate('/ai-assistant')">
              ⚖️ Bail Precedents
            </span>
            <span class="badge badge-neutral" style="cursor:pointer;padding:4px 10px;font-size:0.75rem" onclick="Router.navigate('/ai-assistant')">
              📝 Petition Drafting
            </span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('/ai-assistant')">
            <span class="material-symbols-rounded">chat</span> Open Ask Nyay Setu
          </button>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stat-cards">
        ${Components.StatCard('Active Clients', String(activeClients), 'groups', null)}
        ${Components.StatCard('New Requests', String(pendingReqs.length), 'person_add', pendingReqs.length ? { text: 'Needs review', type: 'up' } : null)}
        ${Components.StatCard("Today's Appointments", String(todayAppts.length), 'calendar_today', null)}
        ${Components.StatCard('This Month', Utils.formatCurrency(monthlyEarnings), 'account_balance_wallet', null, false)}
        ${Components.StatCard('Client Rating', rating ? `${rating} ★` : '—', 'hotel_class', rating ? { text: `${(Store.getState('reviews') || []).length} reviews`, type: 'up' } : null)}
      </div>

      <!-- Main Grid -->
      <div class="dashboard-grid">
        <!-- Left column -->
        <div>
          <!-- Today's Schedule -->
          <div class="card mb-6">
            <div class="card-header">
              <h3 class="card-title d-flex items-center gap-2">
                <span class="material-symbols-rounded text-accent">today</span> Today's Schedule
              </h3>
              <a class="btn-ghost" href="#/consultation">Open Calendar</a>
            </div>

            ${todayAppts.length === 0 ? Components.emptyState(
              'event_busy',
              'Nothing scheduled for today',
              'Confirmed consultations appear here automatically.'
            ) : `
              <div class="schedule-list">
                ${todayAppts.map(appt => {
                  const timeStr = Utils.formatTime(appt.date);
                  const [hhmm, period] = timeStr.split(' ');
                  return `
                  <div class="schedule-item">
                    <div class="schedule-time">
                      <div class="schedule-time-hour">${hhmm}</div>
                      <div class="schedule-time-period">${(period || '').toUpperCase()}</div>
                    </div>
                    <div class="schedule-divider-line"></div>
                    <div class="schedule-info">
                      <div class="schedule-client">${Utils.escapeHtml(appt.clientName)} — ${Utils.escapeHtml(appt.caseType)}</div>
                      <div class="schedule-type">${Utils.escapeHtml(appt.type)} • ${appt.duration} Mins • ${Utils.formatCurrency(appt.fee)}</div>
                    </div>
                    <a class="btn btn-primary btn-sm" href="#/consultation">Join</a>
                  </div>`;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Pending Client Requests -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title d-flex items-center gap-2">
                <span class="material-symbols-rounded text-accent">person_search</span> Pending Consultation Requests
              </h3>
              <a class="btn-ghost" href="#/clients">View All (${pendingReqs.length})</a>
            </div>

            ${pendingReqs.length === 0 ? Components.emptyState(
              'inbox',
              'No pending requests',
              'New client consultation requests will land here.'
            ) : `
              <div class="request-mini">
                ${pendingReqs.slice(0, 3).map(req => `
                  <div class="request-mini-card" onclick="Router.navigate('/clients', { id: '${req.id}' })" role="button" tabindex="0" aria-label="Open request from ${Utils.escapeHtml(req.name)}">
                    <div class="avatar avatar-sm">${req.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    <div class="request-mini-info">
                      <div class="request-mini-name">${Utils.escapeHtml(req.name)}</div>
                      <div class="request-mini-case truncate">${Utils.escapeHtml(req.caseCategory)}: ${Utils.escapeHtml(req.briefProblem)}</div>
                    </div>
                    <div class="request-mini-time">${Utils.timeAgo(req.createdAt)}</div>
                    <span class="badge badge-accent">${Utils.formatCurrency(req.estimatedFee)}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Right column -->
        <div>
          <!-- AI Case Insights -->
          <div class="card mb-6">
            <div class="card-header">
              <h3 class="card-title d-flex items-center gap-2">
                <span class="material-symbols-rounded text-accent">psychology</span> AI Case Assistant
              </h3>
              <span class="badge badge-neutral">Preliminary</span>
            </div>

            ${this.buildAiInsights()}
          </div>

          <!-- Quick Actions -->
          <div class="card">
            <h4 class="card-title mb-4">Quick Actions</h4>
            <div class="quick-actions" style="margin-top:0">
              <div class="quick-action-btn" onclick="Router.navigate('/clients')" role="button" tabindex="0">
                <div class="quick-action-icon"><span class="material-symbols-rounded">inbox</span></div>
                <div class="quick-action-text">Requests</div>
              </div>
              <div class="quick-action-btn" onclick="Router.navigate('/chat')" role="button" tabindex="0">
                <div class="quick-action-icon"><span class="material-symbols-rounded">chat</span></div>
                <div class="quick-action-text">Chat</div>
              </div>
              <div class="quick-action-btn" onclick="Router.navigate('/payments')" role="button" tabindex="0">
                <div class="quick-action-icon"><span class="material-symbols-rounded">receipt_long</span></div>
                <div class="quick-action-text">Payments</div>
              </div>
              <div class="quick-action-btn" onclick="Router.navigate('/profile/tab/availability')" role="button" tabindex="0">
                <div class="quick-action-icon"><span class="material-symbols-rounded">schedule</span></div>
                <div class="quick-action-text">Slots</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'dashboard', 'Advocate Dashboard');
  },

  deactivatedBanner() {
    return `
      <div class="doc-comparison-banner warning-banner mb-6">
        <span class="material-symbols-rounded">pause_circle</span>
        <span><strong>Profile paused.</strong> New clients can't book you right now — existing cases stay fully active.</span>
        <button class="btn btn-primary btn-sm ml-auto" onclick="DashboardPage.reactivate()">Reactivate Profile</button>
      </div>
    `;
  },

  async reactivate() {
    await ApiClient.setProfileDeactivated(false);
    Utils.showToast('Welcome back! Your profile is open for new bookings.', 'success');
    Router.transitionPage('/dashboard');
  },

  /**
   * Derives insights from live workspace data using lightweight internal rules.
   * Clearly labelled as preliminary — never presented as legal advice or fake "AI scores".
   */
  buildAiInsights() {
    const insights = [];
    const cases = Store.getState('cases') || [];
    const clients = Store.getState('clients') || [];

    // 1. Cases with hearings within 7 days and missing documents flagged
    const soon = cases.filter(c => {
      if (!c.nextHearing || ['Resolved', 'Closed'].includes(c.status)) return false;
      const days = (new Date(c.nextHearing).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    });
    if (soon.length) {
      insights.push({
        badge: 'Hearing Ahead',
        title: soon[0].caseNumber,
        text: `${soon[0].clientName}'s matter has a hearing on ${Utils.formatDate(soon[0].nextHearing)}. Confirm exhibits and prep notes are current.`
      });
    }

    // 2. Requests waiting longer than 48 hours
    const staleReqs = Store.getPendingRequests().filter(r => Date.now() - new Date(r.createdAt).getTime() > 48 * 3600 * 1000);
    if (staleReqs.length) {
      insights.push({
        badge: 'Awaiting Action',
        title: `${staleReqs.length} request${staleReqs.length > 1 ? 's' : ''} pending review`,
        text: `${staleReqs[0].name} has been waiting since ${Utils.timeAgo(staleReqs[0].createdAt)}. Accept or decline to keep response times healthy.`
      });
    }

    // 3. Documents-pending cases
    const docsPending = cases.filter(c => c.status === 'Documents Pending');
    if (docsPending.length) {
      insights.push({
        badge: 'Follow-up',
        title: docsPending[0].caseNumber,
        text: `${docsPending.length} case${docsPending.length > 1 ? 's' : ''} tagged “Documents Pending”. A gentle chat reminder usually unblocks clients fastest.`
      });
    }

    // 4. New client without consultation history
    const freshAccepted = clients.filter(c => c.status === 'accepted' && !(Store.getState('appointments') || []).some(a => a.clientId === c.id));
    if (freshAccepted.length) {
      insights.push({
        badge: 'Scheduling',
        title: freshAccepted[0].name,
        text: 'Accepted but no appointment booked yet. Offer slots from your availability grid to lock the first consultation.'
      });
    }

    if (!insights.length) {
      return Components.emptyState('psychology', 'All caught up', 'Preliminary observations about your active matters will surface here.');
    }

    return `
      ${insights.slice(0, 3).map(ins => `
        <div class="ai-insight-card">
          <div class="ai-insight-header">
            <span class="ai-insight-badge">${ins.badge}</span>
            <span class="text-body-sm font-semibold truncate">${Utils.escapeHtml(ins.title)}</span>
          </div>
          <p class="ai-insight-text">${Utils.escapeHtml(ins.text)}</p>
        </div>
      `).join('')}
      <div class="ai-disclaimer mt-2">
        <span class="material-symbols-rounded icon-sm">info</span>
        <span>Preliminary, rule-based observations generated inside Nyay Setu. They support — never replace — your professional judgment.</span>
      </div>
    `;
  },

  /* ---------------- Real-time Live Sync ---------------- */
  async syncWithBackend() {
    try {
      if (typeof ApiClient === 'undefined') return;
      let hasChanges = false;

      // 1. Sync live consultations from MySQL
      const liveConsults = await ApiClient.fetchLiveConsultations();
      if (Array.isArray(liveConsults) && liveConsults.length) {
        const curClients = Store.getState('clients') || [];
        liveConsults.forEach(c => {
          const clientObj = {
            id: c.id,
            clientId: c.user_id,
            name: c.client_name || 'Padam Kishore',
            email: c.client_email || 'padamkishore90@gmail.com',
            phone: c.client_phone || '9876543210',
            city: c.client_city || 'Jaipur',
            state: c.client_state || 'Rajasthan',
            caseCategory: c.case_category || c.case_title || 'Legal Consultation',
            briefProblem: c.notes || 'Consultation requested via portal.',
            preferredDate: c.consult_date ? new Date(c.consult_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            preferredTime: c.consult_time || '10:00 AM',
            consultationType: (c.consult_mode || 'video').toUpperCase() === 'VIDEO' ? 'Video' : 'Phone',
            estimatedFee: parseFloat(c.fee || c.total_amount || 1000),
            status: c.status || 'pending',
            createdAt: c.created_at || new Date().toISOString(),
            isLiveVerified: true
          };

          const idx = curClients.findIndex(x => x.id === c.id || (x.clientId === c.user_id && x.status === c.status));
          if (idx >= 0) {
            if (curClients[idx].status !== clientObj.status) {
              curClients[idx] = { ...curClients[idx], ...clientObj };
              hasChanges = true;
            }
          } else {
            curClients.unshift(clientObj);
            hasChanges = true;
          }
        });
        if (hasChanges) {
          Store.setState('clients', curClients);
        }
      }

      // 2. Sync live notifications from MySQL
      const liveNotifs = await ApiClient.fetchLiveNotifications();
      if (Array.isArray(liveNotifs) && liveNotifs.length) {
        const curNotifs = Store.getState('notifications') || [];
        let notifChanges = false;
        liveNotifs.forEach(n => {
          const exists = curNotifs.some(x => x.id === n.id);
          if (!exists) {
            curNotifs.unshift({
              id: n.id,
              type: n.type || 'client',
              title: n.title,
              message: n.message,
              read: Boolean(n.read || n.is_read),
              link: '/clients',
              time: n.time || n.createdAt || new Date().toISOString()
            });
            notifChanges = true;
          }
        });
        if (notifChanges) {
          Store.setState('notifications', curNotifs);
          hasChanges = true;
        }
      }

      // 3. If new data arrived, re-render dashboard view smoothly
      if (hasChanges && window.location.hash.includes('/dashboard')) {
        Router.transitionPage('/dashboard');
      }
    } catch (err) {
      console.warn('[DashboardPage] sync error:', err);
    }
  },

  onEnter() {
    this.syncWithBackend();
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      if (window.location.hash.includes('/dashboard')) {
        this.syncWithBackend();
      }
    }, 12000);
  },

  onLeave() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
};
