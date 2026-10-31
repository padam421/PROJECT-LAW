/* ============================================================
   Nyay Setu USER — UI COMPONENTS BUILDER
   components.js — Reusable HTML builders for user portal
   BottomNav, Sidebar, TopBar, AppLayout, Cards, EmptyState
   ============================================================ */

const UserComponents = {
  /* --------------------------------------------------------
     SIDEBAR (Desktop)
     -------------------------------------------------------- */
  Sidebar(activeItem = 'home') {
    const user = UserStore.getUser();
    const initials = (user.fullName || 'User')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('');
    const unreadNotifs = UserStore.getUnreadNotifications().length;

    const navItems = [
      { id: 'home', label: 'Home', icon: 'home', route: '/home' },
      { id: 'case', label: 'My Case', icon: 'folder_open', route: '/case' },
      { id: 'chat', label: 'Ask Nyay Setu', icon: 'chat', route: '/chat' },
      {
        id: 'lawyers',
        label: 'Find Lawyers',
        icon: 'person_search',
        route: '/lawyers',
      },
      { id: 'court', label: 'Court Prep', icon: 'gavel', route: '/court' },
    ];

    const accountItems = [
      {
        id: 'notifications',
        label: 'Notifications',
        icon: 'notifications',
        route: '/notifications',
        badge: unreadNotifs || null,
      },
      { id: 'profile', label: 'Profile', icon: 'person', route: '/profile' },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings',
        route: '/settings',
      },
    ];

    return `
      <aside class="u-sidebar" id="user-sidebar">
        <div class="u-sidebar-header">
          <div class="u-sidebar-logo">
            <span class="material-symbols-rounded">balance</span>
          </div>
          <div class="u-sidebar-brand">
            <span class="u-sidebar-brand-name">Nyay Setu</span>
            <span class="u-sidebar-brand-tag">Client Portal</span>
          </div>
        </div>

        <nav class="u-sidebar-nav">
          <div class="u-sidebar-section">
            <div class="u-sidebar-section-title">Main</div>
            ${navItems.map((i) => this._navItem(i, activeItem)).join('')}
          </div>
          <div class="u-sidebar-section">
            <div class="u-sidebar-section-title">Account</div>
            ${accountItems.map((i) => this._navItem(i, activeItem)).join('')}
          </div>
        </nav>

        <div class="u-sidebar-footer">
          <div class="u-sidebar-profile" onclick="Router.navigate('/profile')">
            <div class="u-sidebar-profile-avatar">
              ${user.profilePhoto ? `<img src="${user.profilePhoto}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : initials}
            </div>
            <div>
              <div class="u-sidebar-profile-name">${Utils.escapeHtml(user.fullName || 'User')}</div>
              <div class="u-sidebar-profile-sub">${Utils.escapeHtml(user.city || 'India')}</div>
            </div>
          </div>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--u-border)">
            <a href="../lawyer/index.html#/role-select" style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--u-accent);font-weight:600;text-decoration:none;padding:4px 8px;border-radius:6px">
              <span class="material-symbols-rounded" style="font-size:16px">account_balance</span>
              <span>Advocate Portal →</span>
            </a>
          </div>
        </div>
      </aside>
      <div class="u-sidebar-overlay" id="sidebar-overlay" onclick="UserComponents.toggleSidebar(false)"></div>
    `;
  },

  _navItem(item, activeItem) {
    return `
      <div class="u-nav-item ${activeItem === item.id ? 'active' : ''}"
           onclick="Router.navigate('${item.route}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')Router.navigate('${item.route}')">
        <span class="material-symbols-rounded ${activeItem === item.id ? 'icon-filled' : ''}">${item.icon}</span>
        <span class="u-nav-item-text">${item.label}</span>
        ${item.badge ? `<span class="u-nav-badge">${item.badge}</span>` : ''}
      </div>`;
  },

  toggleSidebar(open) {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    const shouldOpen =
      open === undefined ? !sidebar.classList.contains('open') : open;
    sidebar.classList.toggle('open', shouldOpen);
    if (overlay) overlay.classList.toggle('active', shouldOpen);
  },

  /* --------------------------------------------------------
     TOP BAR
     -------------------------------------------------------- */
  TopBar(title = 'Home', showBack = false) {
    const unread = UserStore.getUnreadNotifications().length;

    return `
      <header class="u-topbar">
        <div class="u-topbar-left">
          <button class="u-topbar-btn u-menu-toggle" onclick="UserComponents.toggleSidebar()" aria-label="Menu">
            <span class="material-symbols-rounded">menu</span>
          </button>
          ${
            showBack
              ? `
            <button class="u-topbar-btn" onclick="Router.back()" aria-label="Go back">
              <span class="material-symbols-rounded">arrow_back</span>
            </button>
          `
              : ''
          }
          <h1 class="u-topbar-title">${Utils.escapeHtml(title)}</h1>
        </div>
        <div class="u-topbar-right">
          <a href="../lawyer/index.html#/role-select" class="u-badge u-badge-accent" style="text-decoration:none;margin-right:6px" title="Switch to Advocate Portal">
            <span class="material-symbols-rounded" style="font-size:14px">account_balance</span>
            <span>Advocate Portal</span>
          </a>
          <button class="u-topbar-btn ${unread > 0 ? 'has-dot' : ''}" onclick="Router.navigate('/notifications')" title="Notifications" aria-label="Notifications">
            <span class="material-symbols-rounded">notifications</span>
          </button>
          <button class="u-topbar-btn" onclick="Router.navigate('/chat')" title="Ask Nyay Setu" aria-label="Chat">
            <span class="material-symbols-rounded">chat</span>
          </button>
        </div>
      </header>
    `;
  },

  /* --------------------------------------------------------
     BOTTOM NAVIGATION (Mobile)
     -------------------------------------------------------- */
  BottomNav(activeItem = 'home') {
    const items = [
      { id: 'home', label: 'Home', icon: 'home', route: '/home' },
      { id: 'case', label: 'My Case', icon: 'folder_open', route: '/case' },
      { id: 'chat', label: 'Ask AI', icon: 'chat', route: '/chat' },
      {
        id: 'lawyers',
        label: 'Lawyers',
        icon: 'person_search',
        route: '/lawyers',
      },
      { id: 'profile', label: 'Profile', icon: 'person', route: '/profile' },
    ];

    return `
      <nav class="u-bottomnav" id="bottom-nav">
        <div class="u-bottomnav-inner">
          ${items
            .map(
              (i) => `
            <div class="u-bottomnav-item ${activeItem === i.id ? 'active' : ''}"
                 onclick="Router.navigate('${i.route}')" role="link" tabindex="0">
              <div class="u-bottomnav-icon">
                <span class="material-symbols-rounded ${activeItem === i.id ? 'icon-filled' : ''}">${i.icon}</span>
              </div>
              <span class="u-bottomnav-label">${i.label}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </nav>
    `;
  },

  /* --------------------------------------------------------
     APP LAYOUT WRAPPER
     -------------------------------------------------------- */
  AppLayout(
    contentHtml,
    activeNav = 'home',
    pageTitle = 'Home',
    showBack = false
  ) {
    return `
      <div class="u-app">
        ${this.Sidebar(activeNav)}
        <div class="u-main">
          ${this.TopBar(pageTitle, showBack)}
          <main class="u-content" id="main-content">
            ${contentHtml}
          </main>
        </div>
        ${this.BottomNav(activeNav)}
      </div>
    `;
  },

  /* --------------------------------------------------------
     EMPTY STATE
     -------------------------------------------------------- */
  EmptyState(icon, title, text, btnLabel = null, btnAction = null) {
    return `
      <div class="u-empty">
        <div class="u-empty-icon"><span class="material-symbols-rounded">${icon}</span></div>
        <div class="u-empty-title">${Utils.escapeHtml(title)}</div>
        <p class="u-empty-text">${Utils.escapeHtml(text)}</p>
        ${btnLabel && btnAction ? `<button class="u-btn u-btn-primary u-btn-pill" style="margin-top:20px" onclick="${btnAction}">${Utils.escapeHtml(btnLabel)}</button>` : ''}
      </div>
    `;
  },

  /* --------------------------------------------------------
     SECTION HEADER
     -------------------------------------------------------- */
  SectionHeader(title, actionLabel = null, actionRoute = null) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 class="u-section-title" style="margin-bottom:0">${Utils.escapeHtml(title)}</h3>
        ${actionLabel ? `<button class="u-btn u-btn-ghost u-btn-sm" onclick="Router.navigate('${actionRoute}')">${actionLabel}</button>` : ''}
      </div>
    `;
  },

  /* --------------------------------------------------------
     LOGOUT HANDLER
     -------------------------------------------------------- */
  async handleLogout() {
    const confirmed = await Utils.showConfirm(
      'Sign Out',
      'Are you sure you want to log out? Your session will be securely ended.',
      { confirmText: 'Sign Out', type: 'danger' }
    );
    if (confirmed) {
      if (await AuthManager.logout()) Utils.showToast('Signed out. Your saved work stays in your account.', 'info');
    }
  },
};
