/* ============================================================
   Nyay Setu USER — HOME DASHBOARD
   home_page.js — Greeting hero, quick actions, active cases,
   upcoming hearings, notifications
   ============================================================ */

const UserHomePage = {
  render() {
    const user = UserStore.getUser();
    const firstName = AuthManager.displayName(user).split(' ')[0];
    const activeCase = UserStore.getActiveCase();
    const hearing = UserStore.getUpcomingHearing();
    const myLawyer = UserStore.getLawyer();
    const notifications = UserStore.getNotifications().slice(0, 5);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    const quickActions = [
      { icon: 'edit_note', title: 'Tell Us What Happened', desc: 'Describe your issue', route: '/tell-us' },
      { icon: 'person_search', title: 'Find a Lawyer', desc: 'Search verified lawyers', route: '/lawyers' },
      { icon: 'chat', title: 'Ask Nyay Setu', desc: 'Chat with AI assistant', route: '/chat' },
      { icon: 'gavel', title: 'Court Preparation', desc: 'Prepare for your hearing', route: activeCase ? `/hearing/prepare?caseId=${activeCase.id}` : '/court' },
      { icon: 'folder_open', title: 'My Documents', desc: 'View uploaded documents', route: activeCase ? `/case/${activeCase.id}/documents` : '/case' },
    ];

    const content = `
      <!-- Hero Greeting -->
      <div class="u-hero">
        <h2 class="u-hero-greeting">
          ${greeting}, ${Utils.escapeHtml(firstName)}! <span class="wave">👋</span>
        </h2>
        <p class="u-hero-subtitle">
          ${activeCase
            ? `You have an active case: <strong>${Utils.escapeHtml(activeCase.title)}</strong>. ${hearing ? 'Next hearing in ' + this._daysUntil(hearing.date) + '.' : ''}`
            : 'Welcome to Nyay Setu. Tell us how we can help you today.'}
        </p>
      </div>

      <!-- Feature Spotlight: Virtual Court & AI Assistant -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:16px;margin-bottom:24px">
        <!-- Virtual Court Simulator Card -->
        <div class="u-card u-card-interactive" style="background:linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);border:1px solid rgba(245,158,11,0.35);position:relative;cursor:pointer" onclick="Router.navigate('/court/simulate')">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#b45309);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 8px rgba(245,158,11,0.3)">
              <span class="material-symbols-rounded" style="font-size:24px">gavel</span>
            </div>
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:var(--u-amber-light);text-transform:uppercase">Interactive 3D Practice</div>
              <h3 style="font-size:1.1rem;font-weight:800;color:var(--u-primary);margin:0">Virtual Courtroom Simulator</h3>
            </div>
          </div>
          <p style="font-size:0.85rem;color:var(--u-text-secondary);line-height:1.5;margin-bottom:14px">
            Practice before your hearing: see where your advocate stands, where the Judge sits, and understand court etiquette.
          </p>
          <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="event.stopPropagation();Router.navigate('/court/simulate')">
            <span class="material-symbols-rounded" style="font-size:16px">sports_esports</span> Practice Courtroom
          </button>
        </div>

        <!-- AI Assistant Card -->
        <div class="u-card u-card-interactive" style="background:linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);border:1px solid rgba(13,148,136,0.3);position:relative;cursor:pointer" onclick="Router.navigate('/chat')">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#0d9488,#0f766e);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 8px rgba(13,148,136,0.25)">
              <span class="material-symbols-rounded" style="font-size:24px">auto_awesome</span>
            </div>
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:var(--u-accent);text-transform:uppercase">24/7 Legal Help</div>
              <h3 style="font-size:1.1rem;font-weight:800;color:var(--u-primary);margin:0">Ask Nyay Setu AI</h3>
            </div>
          </div>
          <p style="font-size:0.85rem;color:var(--u-text-secondary);line-height:1.5;margin-bottom:14px">
            Ask legal questions, get case summaries, understand your legal rights, and know what documents you need.
          </p>
          <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="event.stopPropagation();Router.navigate('/chat')">
            <span class="material-symbols-rounded" style="font-size:16px">chat</span> Ask AI Assistant
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      ${UserComponents.SectionHeader('Quick Actions')}
      <div class="u-quick-actions">
        ${quickActions.map((a, i) => `
          <div class="u-quick-action u-card-interactive" onclick="Router.navigate('${a.route}')" data-idx="${i}">
            <div class="u-quick-action-icon">
              <span class="material-symbols-rounded">${a.icon}</span>
            </div>
            <div class="u-quick-action-info">
              <div class="u-quick-action-title">${a.title}</div>
              <div class="u-quick-action-desc">${a.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Upcoming Hearing -->
      ${hearing ? `
        ${UserComponents.SectionHeader('Upcoming Hearing', 'Prepare', '/hearing/prepare')}
        <div class="u-hearing-card">
          <div class="u-hearing-card-header">
            <div class="u-hearing-card-title">
              <span class="material-symbols-rounded" style="font-size:18px">gavel</span>
              ${Utils.escapeHtml(hearing.caseTitle || 'Hearing')}
            </div>
            <div class="u-hearing-card-date">${this._formatDate(hearing.date)}</div>
          </div>
          <div class="u-hearing-card-details">
            <div class="u-hearing-detail">
              <div class="u-hearing-detail-label">Time</div>
              <div class="u-hearing-detail-value">${hearing.time || 'TBD'}</div>
            </div>
            <div class="u-hearing-detail">
              <div class="u-hearing-detail-label">Court</div>
              <div class="u-hearing-detail-value">${Utils.escapeHtml(hearing.court || 'TBD')}</div>
            </div>
            <div class="u-hearing-detail">
              <div class="u-hearing-detail-label">Purpose</div>
              <div class="u-hearing-detail-value">${Utils.escapeHtml(hearing.purpose || 'Hearing')}</div>
            </div>
            <div class="u-hearing-detail">
              <div class="u-hearing-detail-label">Days Left</div>
              <div class="u-hearing-detail-value" style="color:var(--u-amber-light)">${this._daysUntil(hearing.date)}</div>
            </div>
          </div>
          <div class="u-hearing-card-actions">
            <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="Router.navigate('/hearing/prepare')">
              <span class="material-symbols-rounded" style="font-size:16px">checklist</span> Prepare
            </button>
            <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="Router.navigate('/court/simulate')">
              <span class="material-symbols-rounded" style="font-size:16px">gavel</span> Practice
            </button>
            <button class="u-btn u-btn-ghost u-btn-sm" onclick="Router.navigate('/chat')">
              <span class="material-symbols-rounded" style="font-size:16px">chat</span> Ask AI
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Active Cases -->
      ${UserStore.getCases().length > 0 ? `
        ${UserComponents.SectionHeader('Your Cases', 'View All', '/case')}
        ${UserStore.getCases().map(c => `
          <div class="u-case-strip" onclick="Router.navigate('/case/${c.id}')">
            <div class="u-case-strip-type">
              <span class="material-symbols-rounded">${c.type?.includes('Property') ? 'home' : c.type?.includes('Family') ? 'family_restroom' : c.type?.includes('Criminal') ? 'gavel' : 'folder_open'}</span>
            </div>
            <div class="u-case-strip-info">
              <div class="u-case-strip-title">${Utils.escapeHtml(c.title)}</div>
              <div class="u-case-strip-meta">
                <span>${Utils.escapeHtml(c.type || 'Case')}</span>
                <span>•</span>
                <span>${Utils.escapeHtml(c.court || c.location || '')}</span>
              </div>
            </div>
            <div class="u-case-strip-status ${c.status}">${c.status === 'ongoing' ? 'Ongoing' : c.status === 'resolved' ? 'Resolved' : 'New'}</div>
          </div>
        `).join('')}
      ` : `
        <div class="u-card" style="padding:28px 24px;text-align:center;background:linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.03));border:1px dashed var(--u-border);margin-top:20px">
          <div style="width:48px;height:48px;border-radius:14px;background:rgba(99,102,241,0.12);color:var(--u-primary-light);display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
            <span class="material-symbols-rounded" style="font-size:26px">gavel</span>
          </div>
          <h3 style="font-size:1.05rem;font-weight:700;color:var(--u-text-primary);margin-bottom:6px">No active legal cases yet</h3>
          <p style="font-size:0.85rem;color:var(--u-text-secondary);max-width:440px;margin:0 auto 18px;line-height:1.5">
            Describe your situation in your own words. Our AI assistant and verified advocates will guide you step by step.
          </p>
          <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">
            <button class="u-btn u-btn-primary u-btn-pill" onclick="Router.navigate('/tell-us')">
              <span class="material-symbols-rounded" style="font-size:18px">add</span> Describe My Case
            </button>
            <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/lawyers')">
              <span class="material-symbols-rounded" style="font-size:18px">person_search</span> Find an Advocate
            </button>
          </div>
        </div>
      `}

      <!-- My Lawyer -->
      ${myLawyer ? `
        ${UserComponents.SectionHeader('Your Lawyer', 'View Profile', '/my-lawyer')}
        <div class="u-case-strip" onclick="Router.navigate('/my-lawyer')">
          <div class="u-case-strip-type" style="background:var(--u-emerald-subtle);color:var(--u-emerald-light)">
            <span class="material-symbols-rounded">person</span>
          </div>
          <div class="u-case-strip-info">
            <div class="u-case-strip-title">${Utils.escapeHtml(myLawyer.name)}</div>
            <div class="u-case-strip-meta">
              <span>${Utils.escapeHtml(myLawyer.specialization)}</span>
              <span>•</span>
              <span>${myLawyer.experience}</span>
            </div>
          </div>
          <div class="u-lawyer-available">Available</div>
        </div>
      ` : ''}

      <!-- Recent Notifications -->
      ${notifications.length > 0 ? `
        ${UserComponents.SectionHeader('Recent Activity', 'View All', '/notifications')}
        <div class="u-card" style="padding:0">
          ${notifications.map(n => `
            <div class="u-notif-item ${n.read ? '' : 'u-notif-unread'}" style="padding:16px">
              <div class="u-notif-icon ${n.type}">
                <span class="material-symbols-rounded">${n.type === 'hearing' ? 'gavel' : n.type === 'lawyer' ? 'person' : n.type === 'document' ? 'description' : n.type === 'payment' ? 'payment' : 'security'}</span>
              </div>
              <div class="u-notif-content">
                <div class="u-notif-text">${Utils.escapeHtml(n.text)}</div>
                <div class="u-notif-time">${Utils.timeAgo(n.time)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    return UserComponents.AppLayout(content, 'home', 'Home');
  },

  _daysUntil(dateStr) {
    if (!dateStr) return '–';
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    if (diff < 0) return 'Passed';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days`;
  },

  _formatDate(dateStr) {
    if (!dateStr) return '–';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
};
