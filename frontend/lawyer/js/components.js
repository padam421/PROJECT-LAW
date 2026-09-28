/* ============================================================
   Nyay Setu — UI COMPONENTS BUILDER
   components.js — Reusable HTML builders (Sidebar, TopBar,
   AppLayout, StatCard, EmptyState) + shared handlers
   ============================================================ */

const Components = {
  /* --------------------------------------------------------
     VERIFIED BADGE (honest — reflects real server status)
     -------------------------------------------------------- */
  VerifiedBadge(size = 'sm') {
    const lawyer = Store.getState('lawyerProfile') || {};
    if (lawyer.verificationStatus === 'verified') {
      return `<span class="verified-tick" title="Verified Advocate"><span class="material-symbols-rounded">check</span></span>`;
    }
    return `<span class="pending-tick" title="Verification in progress"><span class="material-symbols-rounded icon-sm">hourglass_top</span></span>`;
  },

  /* --------------------------------------------------------
     SIDEBAR
     -------------------------------------------------------- */
  Sidebar(activeItem = 'dashboard') {
    const unreadCount = Store.getUnreadNotifications().length;
    const pendingReqs = Store.getPendingRequests().length;
    const lawyer =
      Store.getState('lawyerProfile') || AuthManager.currentLawyer();
    const deactivated = !!lawyer.profileDeactivated;

    const navItems = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard',
      },
      {
        id: 'clients',
        label: 'Client Requests',
        icon: 'person_search',
        route: '/clients',
        badge: pendingReqs || null,
      },
      {
        id: 'court',
        label: 'Court Preparation',
        icon: 'gavel',
        route: '/court',
      },
      {
        id: 'ai-assistant',
        label: 'Ask Nyay Setu',
        icon: 'auto_awesome',
        route: '/ai-assistant',
      },
      {
        id: 'consultation',
        label: 'Consultation',
        icon: 'video_camera_front',
        route: '/consultation',
      },
      {
        id: 'chat',
        label: 'Client Chat',
        icon: 'chat',
        route: '/chat',
        badge: this.totalUnreadChats() || null,
      },
      {
        id: 'cases',
        label: 'Case Management',
        icon: 'folder_open',
        route: '/cases',
      },
      {
        id: 'payments',
        label: 'Earnings & Payments',
        icon: 'payments',
        route: '/payments',
      },
      {
        id: 'reviews',
        label: 'Client Reviews',
        icon: 'star',
        route: '/reviews',
      },
      {
        id: 'profile',
        label: 'Portfolio & Profile',
        icon: 'badge',
        route: '/profile',
      },
      {
        id: 'settings',
        label: 'Settings & Security',
        icon: 'settings',
        route: '/settings',
        badge: unreadCount || null,
      },
    ];

    const initials = (lawyer.fullName || 'Advocate')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('');
    const photo = lawyer.profilePhoto;

    return `
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <span class="material-symbols-rounded icon-filled">gavel</span>
          </div>
          <div class="sidebar-brand">
            <span class="sidebar-brand-name">Nyay Setu</span>
            <span class="sidebar-brand-tagline">Advocate Portal</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Primary">
          <div class="sidebar-section">
            <div class="sidebar-section-title">Practice</div>
            ${navItems
              .slice(0, 7)
              .map((item) => this.sidebarItem(item, activeItem))
              .join('')}
          </div>
          <div class="sidebar-section">
            <div class="sidebar-section-title">Account</div>
            ${navItems
              .slice(7)
              .map((item) => this.sidebarItem(item, activeItem))
              .join('')}
          </div>
        </nav>

        ${
          deactivated
            ? `
          <div class="sidebar-status-chip" title="Not receiving new bookings">
            <span class="material-symbols-rounded icon-sm">pause_circle</span> Paused
          </div>`
            : ''
        }

        <div class="sidebar-footer">
          <div class="sidebar-profile" onclick="Router.navigate('/profile')" role="button" tabindex="0" aria-label="Open profile">
            <div class="avatar avatar-sm">
              ${photo ? `<img src="${photo}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : initials}
            </div>
            <div class="sidebar-profile-info">
              <div class="sidebar-profile-name">
                <span class="truncate">${Utils.escapeHtml(lawyer.professionalName || lawyer.fullName || 'Advocate')}</span>
                ${this.VerifiedBadge()}
              </div>
              <div class="sidebar-profile-role">${Utils.escapeHtml(lawyer.primarySpecialization || 'Legal Practice')}</div>
            </div>
          </div>
        </div>
      </aside>
      <div class="sidebar-overlay" onclick="Components.toggleSidebar(false)"></div>
    `;
  },

  sidebarItem(item, activeItem) {
    return `
      <div class="sidebar-item ${activeItem === item.id ? 'active' : ''}" onclick="Router.navigate('${item.route}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')Router.navigate('${item.route}')"
           aria-current="${activeItem === item.id ? 'page' : 'false'}">
        <span class="material-symbols-rounded ${activeItem === item.id ? 'icon-filled' : ''}">${item.icon}</span>
        <span class="sidebar-item-text">${item.label}</span>
        ${item.badge ? `<span class="sidebar-item-badge">${item.badge}</span>` : ''}
      </div>`;
  },

  totalUnreadChats() {
    return (Store.getState('conversations') || []).reduce(
      (sum, c) => sum + (c.unreadCount || 0),
      0
    );
  },

  toggleSidebar(open) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!sidebar) return;
    const shouldOpen =
      open === undefined ? !sidebar.classList.contains('open') : open;
    sidebar.classList.toggle('open', shouldOpen);
    if (overlay) overlay.classList.toggle('active', shouldOpen);
  },

  /* --------------------------------------------------------
     TOPBAR
     -------------------------------------------------------- */
  TopBar(title = 'Dashboard', breadcrumbs = []) {
    const unread = Store.getUnreadNotifications().length;

    return `
      <header class="topbar">
        <div class="topbar-left">
          <button class="sidebar-toggle" onclick="Components.toggleSidebar()" aria-label="Toggle navigation menu">
            <span class="material-symbols-rounded">menu</span>
          </button>
          <div>
            <h1 class="topbar-title">${Utils.escapeHtml(title)}</h1>
            ${
              breadcrumbs.length > 0
                ? `
              <div class="topbar-breadcrumb">
                <a href="#/dashboard">Home</a>
                ${breadcrumbs.map((b) => `<span>/</span><span>${Utils.escapeHtml(b)}</span>`).join('')}
              </div>
            `
                : ''
            }
          </div>
        </div>

        <div class="topbar-right">
          <div class="topbar-search">
            <span class="material-symbols-rounded topbar-search-icon">search</span>
            <input type="search" class="topbar-search-input" placeholder="Search cases, clients…" onkeydown="Components.handleGlobalSearch(event)" aria-label="Search cases and clients">
          </div>

          <button class="btn-icon ${unread > 0 ? 'notification-dot' : ''}" onclick="Router.navigate('/settings/tab/notifications')" title="Notifications (${unread} unread)" aria-label="Notifications, ${unread} unread">
            <span class="material-symbols-rounded">notifications</span>
          </button>

          <button class="btn-icon" onclick="Router.navigate('/settings/tab/security')" title="Security Center" aria-label="Security Center">
            <span class="material-symbols-rounded">shield</span>
          </button>

          <button class="btn-icon" onclick="Components.handleLogout()" title="Sign out" aria-label="Sign out">
            <span class="material-symbols-rounded">logout</span>
          </button>
        </div>
      </header>
    `;
  },

  /* --------------------------------------------------------
     APP LAYOUT WRAPPER
     -------------------------------------------------------- */
  AppLayout(
    contentHtml,
    activeNav = 'dashboard',
    pageTitle = 'Dashboard',
    breadcrumbs = []
  ) {
    return `
      <div class="app-layout">
        ${this.Sidebar(activeNav)}
        <div class="app-main">
          ${this.TopBar(pageTitle, breadcrumbs)}
          <main class="app-content" id="main-content">
            ${contentHtml}
          </main>
        </div>
      </div>
    `;
  },

  /* --------------------------------------------------------
     STAT CARD
     -------------------------------------------------------- */
  StatCard(label, value, icon, trend = null) {
    return `
      <div class="stat-card">
        <div class="stat-card-icon">
          <span class="material-symbols-rounded">${icon}</span>
        </div>
        <div class="stat-card-value">${value}</div>
        <div class="stat-card-label">${label}</div>
        ${
          trend
            ? `
          <div class="stat-card-trend ${trend.type || 'up'}">
            <span class="material-symbols-rounded icon-sm">${trend.type === 'down' ? 'trending_down' : 'trending_up'}</span>
            ${Utils.escapeHtml(trend.text)}
          </div>
        `
            : ''
        }
      </div>
    `;
  },

  /* --------------------------------------------------------
     EMPTY STATE
     -------------------------------------------------------- */
  emptyState(icon, title, text, actionLabel = null, actionHandler = null) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><span class="material-symbols-rounded icon-xl">${icon}</span></div>
        <h3 class="empty-state-title">${Utils.escapeHtml(title)}</h3>
        <p class="empty-state-text">${Utils.escapeHtml(text)}</p>
        ${actionLabel && actionHandler ? `<button class="btn btn-primary mt-4" onclick="${actionHandler}">${Utils.escapeHtml(actionLabel)}</button>` : ''}
      </div>
    `;
  },

  /* --------------------------------------------------------
     SKELETON LOADER BLOCK
     -------------------------------------------------------- */
  skeletonRows(rows = 3) {
    return `<div class="skeleton-stack">${Array.from({ length: rows })
      .map(() => '<div class="skeleton-row"></div>')
      .join('')}</div>`;
  },

  /* --------------------------------------------------------
     HANDLERS
     -------------------------------------------------------- */
  handleGlobalSearch(e) {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (!q) return;
      // Route to case management filtered by query (client-side filter)
      Router.navigate('/cases', { q });
      Utils.showToast(`Showing results for “${q}” in Case Management.`, 'info');
    }
  },

  async handleLogout() {
    const confirmed = await Utils.showConfirm(
      'Confirm Sign Out',
      'Your session will be securely terminated on this device.',
      {
        confirmText: 'Sign Out',
        type: 'danger',
      }
    );
    if (confirmed) {
      ApiClient.stopReminderEngine();
      await AuthManager.logout();
      Utils.showToast('Session securely ended.', 'info');
    }
  },
};
