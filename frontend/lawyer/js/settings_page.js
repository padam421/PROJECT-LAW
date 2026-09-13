/* ============================================================
   Nyay Setu — SETTINGS & SECURITY CENTER
   settings_page.js — Verification record, security (2FA,
   devices, sessions, incidents), notifications, privacy,
   account, support, deactivation.
   ============================================================ */

const SettingsPage = {
  _activeTab: 'verification-center',
  _securityData: null,

  render(params = {}) {
    if (params.tab) this._activeTab = params.tab;

    const lawyer = Store.getState('lawyerProfile') || {};
    const notifs = Store.getState('notifications') || [];
    const isVerified = lawyer.verificationStatus === 'verified';
    const unread = notifs.filter(n => !n.read).length;

    const tabs = [
      { id: 'account', label: 'Account', icon: 'person' },
      { id: 'professional', label: 'Professional', icon: 'workspace_premium' },
      { id: 'security', label: 'Security', icon: 'shield' },
      { id: 'privacy', label: 'Privacy', icon: 'lock' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications', badge: unread || null },
      { id: 'support', label: 'Support', icon: 'help' },
      { id: 'deactivate', label: 'Pause Profile', icon: 'pause_circle', danger: true }
    ];

    const contentHtml = `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">Settings & Security</h2>
          <p class="page-subtitle">Manage your account, credentials, devices and alerts</p>
        </div>
        ${isVerified ? '<span class="badge badge-verified"><span class="material-symbols-rounded icon-sm">verified</span> Verified Advocate</span>' : `<span class="badge badge-warning"><span class="material-symbols-rounded icon-sm">hourglass_top</span> Verification ${Utils.escapeHtml(lawyer.verificationStatus || 'pending')}</span>`}
      </div>

      <div class="settings-layout">
        <nav class="settings-nav" aria-label="Settings sections">
          ${tabs.map(t => `
            <button type="button" class="settings-nav-item ${this._activeTab === t.id ? 'active' : ''} ${t.danger ? 'danger' : ''}" onclick="SettingsPage.setTab('${t.id}')">
              <span class="material-symbols-rounded">${t.icon}</span> ${t.label}
              ${t.badge ? `<span class="sidebar-item-badge">${t.badge}</span>` : ''}
            </button>
          `).join('')}
          <!-- Verification record lives here too -->
          <button type="button" class="settings-nav-item ${this._activeTab === 'verification-center' ? 'active' : ''}" onclick="SettingsPage.setTab('verification-center')">
            <span class="material-symbols-rounded">verified_user</span> Verification Record
          </button>
        </nav>

        <div class="settings-content">
          ${this.renderPane(this._activeTab)}
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'settings', 'Settings & Security', ['Settings']);
  },

  renderPane(tab) {
    switch (tab) {
      case 'security': return this.securityPanePlaceholder();
      case 'notifications': return this.notificationsPane();
      case 'privacy': return this.privacyPane();
      case 'account': return this.accountPane();
      case 'professional': return this.professionalPane();
      case 'support': return this.supportPane();
      case 'deactivate': return this.deactivatePane();
      default: return this.verificationPane();
    }
  },

  /* ---------------- Verification record ---------------- */
  verificationPane() {
    const lawyer = Store.getState('lawyerProfile') || {};
    const isVerified = lawyer.verificationStatus === 'verified';
    return `
      <div class="settings-pane active">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title">Verification Record</h3>
          <p class="settings-pane-desc">Your permanent accreditation status on Nyay Setu</p>
        </div>

        ${isVerified ? `
          <div class="grid-2 mb-6">
            ${[
              ['Identity', 'Government ID + selfie compared by reviewer'],
              ['Bar Council', `Roll ${Utils.escapeHtml(lawyer.barCouncil || '')} • Active standing`],
              ['Education', `${Utils.escapeHtml((Store.getState('lawyerProfile') || {}).qualification || 'LLB')} confirmed`],
              ['Practice Profile', 'Public portfolio complete']
            ].map(([title, desc]) => `
              <div class="card p-4" style="background:var(--color-success-light);border:1px solid rgba(16,185,129,0.3)">
                <div class="d-flex items-center gap-3">
                  <span class="material-symbols-rounded icon-lg text-success">verified</span>
                  <div>
                    <div class="font-bold text-title-md text-success-dark">${title} — Verified</div>
                    <div class="text-body-sm text-muted">${desc}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="data-table">
            <table><tbody>
              <tr><td><strong>Lawyer Verification ID</strong></td><td class="font-mono text-accent"><strong>${Utils.escapeHtml(lawyer.verificationId || '—')}</strong></td></tr>
              <tr><td><strong>Verification Date</strong></td><td>${lawyer.verificationDate ? Utils.formatDate(lawyer.verificationDate, 'long') : '—'}</td></tr>
              <tr><td><strong>Public Badge</strong></td><td><span class="badge badge-success">Active</span></td></tr>
            </tbody></table>
          </div>

          <p class="text-body-sm text-muted mt-3">Changing statutory credentials (e.g., Bar registration number) pauses the badge until re-verification completes.</p>
        ` : `
          <div class="card p-6" style="text-align:center;max-width:520px;margin:0 auto">
            <span class="material-symbols-rounded icon-xl" style="color:var(--color-gold-dark)">hourglass_top</span>
            <h4 class="card-title mt-2 mb-2">Verification In Progress</h4>
            <p class="text-body-sm text-muted mb-4">Status: <strong>${Utils.escapeHtml(lawyer.verificationStatus || 'pending')}</strong>. The verification desk is reviewing your credentials — you'll be notified of the outcome.</p>
            <button class="btn btn-primary" onclick="Router.navigate('/verification')">Open Verification Wizard</button>
          </div>
        `}
      </div>
    `;
  },

  securityPanePlaceholder() {
    // Rendered immediately with skeletons, then hydrated by onEnter
    return `
      <div class="settings-pane active" id="security-pane">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title">Security Center</h3>
          <p class="settings-pane-desc">Two-factor authentication, devices, sessions and alerts</p>
        </div>
        ${Components.skeletonRows(4)}
      </div>
    `;
  },

  async hydrateSecurityPane() {
    const pane = document.getElementById('security-pane');
    if (!pane) return;
    const [devices, sessions, activity, summary] = await Promise.all([
      AuthManager.fetchTrustedDevices(),
      AuthManager.getActiveSessions(),
      AuthManager.getLoginActivity(),
      ApiClient.fetchVerificationSummary().catch(() => null)
    ]);
    const lawyer = Store.getState('lawyerProfile') || {};
    const settings = (Store.getState('settings') || {}).security || {};

    const typeIcon = { login: 'login', login_failed: 'error', login_blocked: 'block', login_new_device: 'phonelink_setup', logout: 'logout', device_trusted: 'verified_user', device_revoked: 'device_off', otp_locked: 'lock_reset', document_uploaded: 'upload_file' };

    pane.innerHTML = `
      <div class="settings-pane-header">
        <h3 class="settings-pane-title">Security Center</h3>
        <p class="settings-pane-desc">Two-factor authentication, devices, sessions and incident response</p>
      </div>

      ${(summary && summary.sensitiveActionsLockedUntil && new Date(summary.sensitiveActionsLockedUntil) > new Date()) ? `
        <div class="security-alert-box mb-6" style="border-color:var(--color-error)">
          <span class="material-symbols-rounded">gpp_maybe</span>
          <div class="flex-1">
            <div class="security-alert-title">Sensitive actions temporarily locked</div>
            <div class="security-alert-text">Following a reported incident, lock remains until ${new Date(summary.sensitiveActionsLockedUntil).toLocaleTimeString()} or until you change your password.</div>
            <button class="btn btn-danger btn-sm mt-2" onclick="SettingsPage.openChangePassword()">Change Password Now</button>
          </div>
        </div>` : ''}

      <!-- 2FA -->
      <h4 class="card-title mb-3 d-flex items-center gap-2">Two-Factor Authentication</h4>
      <div class="setting-toggle-row">
        <div class="setting-toggle-info">
          <span class="setting-toggle-label">OTP at every sign-in</span>
          <span class="setting-toggle-desc">A 6-digit code is required after your password. Delivery is simulated in this environment (no SMS/email gateway connected).</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${settings.twoFactorEnabled !== false ? 'checked' : ''} disabled title="Enforced platform-wide in this build">
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Trusted devices -->
      <h4 class="card-title mt-6 mb-3">Trusted Devices</h4>
      ${devices.length === 0 ? '<p class="text-body-sm text-muted">No devices marked trusted yet.</p>' : devices.map(d => `
        <div class="device-item-card">
          <div class="device-item-left">
            <div class="device-item-icon"><span class="material-symbols-rounded">devices</span></div>
            <div>
              <div class="font-semibold text-body-md">${Utils.escapeHtml(d.deviceType)} — ${Utils.escapeHtml(d.browser)} on ${Utils.escapeHtml(d.os)}</div>
              <div class="text-body-sm text-muted">Added ${d.addedAt ? Utils.formatDate(d.addedAt) : 'recently'} &bull; ${Utils.escapeHtml(d.location || '')}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="SettingsPage.revokeDevice('${d.id}')">Revoke</button>
        </div>
      `).join('')}

      <!-- Active sessions -->
      <h4 class="card-title mt-8 mb-3">Active Sessions</h4>
      ${(sessions || []).filter(s => !s.expired).map(s => `
        <div class="device-item-card">
          <div class="device-item-left">
            <div class="device-item-icon"><span class="material-symbols-rounded">${s.current ? 'smartphone' : 'history'}</span></div>
            <div>
              <div class="font-semibold text-body-md">${Utils.escapeHtml(s.device.browser)} on ${Utils.escapeHtml(s.device.os)} ${s.current ? '<span class="badge badge-success" style="margin-left:6px">This device</span>' : ''}</div>
              <div class="text-body-sm text-muted">Started ${Utils.formatDateTime(s.createdAt)} &bull; last seen ${Utils.timeAgo(s.lastSeenAt)}</div>
            </div>
          </div>
          ${s.current ? '' : `<button class="btn btn-secondary btn-sm" onclick="SettingsPage.terminateSession('${s.id}')">Sign Out</button>`}
        </div>
      `).join('')}

      <!-- Activity log -->
      <h4 class="card-title mt-8 mb-3">Recent Security Activity</h4>
      <div class="data-table">
        <table>
          <thead><tr><th>Event</th><th>Device</th><th>When</th><th>Result</th></tr></thead>
          <tbody>
            ${(activity || []).slice(0, 8).map(a => {
              const failed = ['login_failed', 'login_blocked', 'otp_locked'].includes(a.type);
              return `
              <tr>
                <td><strong>${(typeIcon[a.type] || 'shield')} ${Utils.escapeHtml(a.type.replace(/_/g, ' '))}</strong></td>
                <td>${a.device ? Utils.escapeHtml(`${a.device.browser} · ${a.device.os}`) : ''}</td>
                <td>${Utils.formatDateTime(a.timestamp)}</td>
                <td><span class="badge ${failed ? 'badge-danger' : 'badge-success'}">${failed ? 'Failed' : 'OK'}</span></td>
              </tr>`;
            }).join('')}
            ${(activity || []).length === 0 ? '<tr><td colspan="4" class="text-muted">No recorded activity yet.</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <!-- Password -->
      <h4 class="card-title mt-8 mb-3">Password</h4>
      <button class="btn btn-primary" onclick="SettingsPage.openChangePassword()">Change Password</button>

      <!-- Report incident -->
      <h4 class="card-title mt-8 mb-3">Report a Problem</h4>
      <p class="text-body-sm text-muted mb-3">Received an alert about a sign-in you don't recognise? Reporting it terminates every session immediately, locks sensitive actions, and flags the account for the security desk.</p>
      <button class="btn btn-danger" onclick="SettingsPage.reportIncident()">
        <span class="material-symbols-rounded icon-sm">report</span> This wasn't me
      </button>
    `;
  },

  openChangePassword() {
    Utils.showModal(`
      <div class="form-group">
        <label class="form-label" for="cp-current">Current Password</label>
        <input type="password" id="cp-current" class="form-input" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-new">New Password</label>
        <input type="password" id="cp-new" class="form-input" autocomplete="new-password" placeholder="Min 8 chars, letters + numbers">
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-confirm">Confirm New Password</label>
        <input type="password" id="cp-confirm" class="form-input" autocomplete="new-password">
      </div>
    `, {
      title: 'Change Password',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Update Password',
          class: 'btn btn-primary',
          onclick: `(async () => {
            const current = document.getElementById('cp-current').value;
            const next = document.getElementById('cp-new').value;
            const confirm = document.getElementById('cp-confirm').value;
            if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\\d/.test(next)) { Utils.showToast('New password needs 8+ characters with letters and numbers.', 'warning'); return; }
            if (next !== confirm) { Utils.showToast('Passwords do not match.', 'warning'); return; }
            const res = await AuthManager.changePassword(current, next);
            if (res.success) {
              Utils.hideModal();
              Utils.showToast('Password updated. Other sessions were signed out.', 'success');
              SettingsPage.hydrateSecurityPane();
            } else {
              Utils.showToast(res.error || 'Could not change password.', 'error');
            }
          })()`
        }
      ]
    });
  },

  async revokeDevice(id) {
    await AuthManager.removeTrustedDevice(id);
    Utils.showToast('Device revoked. It will need fresh verification at next sign-in.', 'info');
    this.hydrateSecurityPane();
  },

  async terminateSession(id) {
    await AuthManager.terminateSession(id);
    Utils.showToast('Session terminated.', 'info');
    this.hydrateSecurityPane();
  },

  async reportIncident() {
    const ok = await Utils.showConfirm(
      'Report Unrecognized Sign-In',
      'Every active session (including this one) will be terminated immediately. Sensitive actions stay locked for 1 hour or until your password is changed, and our security desk is notified.',
      { confirmText: 'Secure My Account', type: 'danger' }
    );
    if (!ok) return;
    ApiClient.stopReminderEngine();
    await AuthManager.reportUnrecognizedLogin();
    window.location.hash = '#/login';
    setTimeout(() => Utils.showToast('All sessions terminated. Sign in again and change your password when prompted.', 'warning'), 400);
  },

  /* ---------------- Notifications ---------------- */
  notificationsPane() {
    const notifs = Store.getState('notifications') || [];
    const unread = notifs.filter(n => !n.read).length;
    const icons = { client: 'person_add', appointment: 'calendar_today', payment: 'payments', verification: 'verified', security: 'shield', case: 'folder_open' };

    return `
      <div class="settings-pane active">
        <div class="settings-pane-header" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 class="settings-pane-title">Notifications</h3>
            <p class="settings-pane-desc">${unread} unread of ${notifs.length}</p>
          </div>
          ${notifs.length ? `<button class="btn btn-secondary btn-sm" onclick="SettingsPage.markAllRead()" ${unread === 0 ? 'disabled' : ''}>Mark all read</button>` : ''}
        </div>

        ${notifs.length === 0 ? Components.emptyState('notifications_off', 'All caught up', 'Requests, payments, hearings and security alerts will appear here.') : `
          <div class="notif-list">
            ${notifs.map(n => `
              <div class="client-doc-item notif-item ${n.read ? '' : 'unread'}" onclick="SettingsPage.openNotification('${n.id}')" role="button" tabindex="0" aria-label="${Utils.escapeHtml(n.title)}${n.read ? '' : ', unread'}">
                <span class="material-symbols-rounded ${n.read ? 'text-muted' : 'text-accent'}">${icons[n.type] || 'notifications'}</span>
                <div class="client-doc-info">
                  <div class="client-doc-name">${Utils.escapeHtml(n.title)} ${n.read ? '' : '<span class="unread-dot" aria-label="unread"></span>'}</div>
                  <div class="client-doc-size">${Utils.escapeHtml(n.message)}</div>
                  <div class="text-label-sm text-muted mt-1">${Utils.timeAgo(n.time)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  openNotification(id) {
    const notifs = Store.getState('notifications') || [];
    const n = notifs.find(x => x.id === id);
    if (!n) return;
    if (!n.read) {
      n.read = true;
      Store.setState('notifications', notifs);
      fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
      Router.transitionPage('/settings', { tab: 'notifications' });
    }
    if (n.link) Router.navigate(n.link);
  },

  markAllRead() {
    const notifs = (Store.getState('notifications') || []).map(n => ({ ...n, read: true }));
    Store.setState('notifications', notifs);
    fetch('/api/notifications/read-all', { method: 'PATCH', credentials: 'include' }).catch(() => {});
    Utils.showToast('All notifications marked as read.', 'info');
    Router.transitionPage('/settings', { tab: 'notifications' });
  },

  /* ---------------- Privacy ---------------- */
  privacyPane() {
    const settings = (Store.getState('settings') || {}).privacy || {};
    return `
      <div class="settings-pane active">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title">Privacy & Client Privilege</h3>
          <p class="settings-pane-desc">Control visibility and data handling</p>
        </div>

        ${this.toggleRow('profileVisibility', settings.profileVisibility !== 'hidden', 'Public profile discoverability', 'Let prospective clients find and book you via search', false)}
        ${this.toggleRow('showEmail', !!settings.showEmail, 'Show email on public profile', 'Displays your registered email to signed-in clients', true)}
        ${this.toggleRow('showPhone', !!settings.showPhone, 'Show mobile on public profile', 'Displays your number to signed-in clients', true)}
        ${this.toggleRow('allowReviews', settings.allowReviews !== false, 'Accept client reviews', 'Clients may rate and review you after consultations', true)}
        ${this.toggleRow('shareDocuments', settings.shareDocuments !== 'lawyer_only', 'Share case documents with client', 'When off, documents stay counsel-only until you share them', true)}

        <p class="text-body-sm text-muted mt-4">Private advocate notes are always restricted to you — this is a platform guarantee, not a setting.</p>
      </div>
    `;
  },

  toggleRow(key, checked, label, desc, persist = true) {
    return `
      <div class="setting-toggle-row">
        <div class="setting-toggle-info">
          <span class="setting-toggle-label">${label}</span>
          <span class="setting-toggle-desc">${desc}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="SettingsPage.setPrivacy('${key}', this.checked)" ${persist ? '' : 'data-visibility'}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  },

  setPrivacy(key, value) {
    if (key === 'profileVisibility') {
      // Special case: pausing discovery equals deactivation toggle
      ApiClient.setProfileDeactivated(!value).then(ok => {
        Utils.showToast(value ? 'Profile visible for new bookings.' : 'Profile hidden from new bookings.', ok ? 'success' : 'error');
        if (Store.getState('lawyerProfile')) {
          const lp = Store.getState('lawyerProfile');
          lp.profileDeactivated = !value;
          Store.setState('lawyerProfile', lp);
        }
      });
      return;
    }
    const root = Store.getState('settings') || {};
    root.privacy = root.privacy || {};
    if (key === 'shareDocuments') {
      root.privacy.shareDocuments = value ? 'with_permission' : 'lawyer_only';
    } else {
      root.privacy[key] = value;
    }
    Store.setState('settings', root);
    Utils.showToast('Preference saved.', 'success');
  },

  /* ---------------- Account ---------------- */
  accountPane() {
    const lawyer = Store.getState('lawyerProfile') || {};
    return `
      <div class="settings-pane active">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title">Account & Contact</h3>
          <p class="settings-pane-desc">Your registered identity details</p>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Full Legal Name</label>
            <input type="text" class="form-input" value="${Utils.escapeHtml(lawyer.fullName || '')}" disabled title="Fixed — matches official records; changes require re-registration">
          </div>
          <div class="form-group">
            <label class="form-label">Bar Registration</label>
            <input type="text" class="form-input font-mono" value="${Utils.escapeHtml(lawyer.barCouncil || '')}" disabled title="Statutory credential — managed through the verification wizard">
          </div>
          <div class="form-group">
            <label class="form-label" for="acc-email">Registered Email</label>
            <input type="email" id="acc-email" class="form-input" value="${Utils.escapeHtml(lawyer.email || '')}">
            <span class="form-hint">Used for sign-in codes. Changes apply after confirmation.</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="acc-phone">Mobile Number</label>
            <input type="tel" id="acc-phone" class="form-input" maxlength="10" value="${Utils.escapeHtml(lawyer.phone || '')}">
            <span class="form-hint">10-digit number for OTP delivery.</span>
          </div>
        </div>

        <button class="btn btn-primary mt-4" onclick="SettingsPage.saveAccount()">Save Contact Details</button>
        <p class="text-body-sm text-muted mt-3">Legal name and Bar registration are locked to protect integrity. To correct them, contact support@nyaysetu.in with official proof.</p>
      </div>
    `;
  },

  async saveAccount() {
    const email = document.getElementById('acc-email').value.trim();
    const phoneRaw = document.getElementById('acc-phone').value.replace(/\D/g, '');
    if (!Utils.validateEmail(email)) { Utils.showToast('Enter a valid email address.', 'warning'); return; }
    if (!Utils.validatePhone(phoneRaw)) { Utils.showToast('Enter a valid 10-digit Indian mobile.', 'warning'); return; }
    try {
      await ApiClient.updateProfile({}); // touch profile endpoint to confirm connectivity
      Utils.showToast('Contact details validated. Email/mobile swaps require OTP re-confirmation once the messaging gateway is connected.', 'info');
    } catch (err) {
      Utils.showToast(err.message || 'Could not save right now.', 'error');
    }
  },

  /* ---------------- Professional shortcut pane ---------------- */
  professionalPane() {
    const lawyer = Store.getState('lawyerProfile') || {};
    const pricingCount = (Store.getState('pricing') || []).length;
    const availability = Store.getState('availability') || {};
    const slots = Object.values(availability).reduce((n, arr) => n + (arr || []).length, 0);
    return `
      <div class="settings-pane active">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title">Professional Settings</h3>
          <p class="settings-pane-desc">Specializations, experience, pricing and availability live in your portfolio workspace</p>
        </div>

        <div class="grid-2">
          <div class="card card-glass p-4 cursor-pointer" onclick="Router.navigate('/profile')" role="link" tabindex="0">
            <span class="material-symbols-rounded icon-lg text-accent">badge</span>
            <h4 class="card-title mt-2 mb-1">Portfolio & Profile</h4>
            <p class="text-body-sm text-muted">Bio, specializations, experience timeline and case record.</p>
          </div>
          <div class="card card-glass p-4 cursor-pointer" onclick="Router.navigate('/profile/tab/pricing')" role="link" tabindex="0">
            <span class="material-symbols-rounded icon-lg text-accent">payments</span>
            <h4 class="card-title mt-2 mb-1">Service Pricing</h4>
            <p class="text-body-sm text-muted">${pricingCount} service${pricingCount === 1 ? '' : 's'} currently priced.</p>
          </div>
          <div class="card card-glass p-4 cursor-pointer" onclick="Router.navigate('/profile/tab/availability')" role="link" tabindex="0">
            <span class="material-symbols-rounded icon-lg text-accent">schedule</span>
            <h4 class="card-title mt-2 mb-1">Availability Slots</h4>
            <p class="text-body-sm text-muted">${slots} weekly slot${slots === 1 ? '' : 's'} open for bookings.</p>
          </div>
          <div class="card card-glass p-4 cursor-pointer" onclick="SettingsPage.setTab('verification-center')" role="link" tabindex="0">
            <span class="material-symbols-rounded icon-lg text-accent">verified_user</span>
            <h4 class="card-title mt-2 mb-1">Credentials</h4>
            <p class="text-body-sm text-muted">Verification record for ${Utils.escapeHtml(lawyer.stateBarCouncil || 'your State Bar Council')}.</p>
          </div>
        </div>
      </div>
    `;
  },

  /* ---------------- Support ---------------- */
  supportPane() {
    return `
      <div class="settings-pane active">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title">Help & Support</h3>
          <p class="settings-pane-desc">Assistance with the platform, verification and account issues</p>
        </div>

        <div class="grid-2">
          <div class="card card-glass">
            <h4 class="card-title mb-2">Help Center</h4>
            <p class="text-body-md text-muted mb-4">Guides on verification, consultations, payments and profile setup.</p>
            <button class="btn btn-secondary btn-sm" onclick="Utils.showModal('<p>The full knowledge base ships with the public launch. For now, write to us and we will respond within one working day.</p>', { title: 'Help Center' })">Browse Articles</button>
          </div>
          <div class="card card-glass">
            <h4 class="card-title mb-2">Contact Support</h4>
            <p class="text-body-md text-muted mb-2">Email: <strong>support@nyaysetu.in</strong></p>
            <p class="text-body-md text-muted mb-4">Verification desk: <strong>verification@nyaysetu.in</strong></p>
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.openReportProblem()">Report a Problem</button>
          </div>
        </div>
      </div>
    `;
  },

  openReportProblem() {
    Utils.showModal(`
      <div class="form-group">
        <label class="form-label" for="rp-subject">Subject</label>
        <input type="text" id="rp-subject" class="form-input" placeholder="Brief summary of the issue" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="rp-detail">Details</label>
        <textarea id="rp-detail" class="form-textarea" rows="4" placeholder="What happened? Include steps to reproduce if relevant." required></textarea>
      </div>
      <div class="ai-disclaimer">
        <span class="material-symbols-rounded icon-sm">info</span>
        <span>Tickets are stored locally in this build; the ticketing service connects at deployment.</span>
      </div>
    `, {
      title: 'Report a Problem',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Submit Report',
          class: 'btn btn-primary',
          onclick: `(() => {
            const subject = document.getElementById('rp-subject').value.trim();
            const detail = document.getElementById('rp-detail').value.trim();
            if (subject.length < 4) { Utils.showToast('Add a brief subject.', 'warning'); return; }
            const reports = JSON.parse(localStorage.getItem('lc_support_tickets') || '[]');
            reports.unshift({ id: 'tkt_' + Date.now(), subject, detail, time: new Date().toISOString(), status: 'open' });
            localStorage.setItem('lc_support_tickets', JSON.stringify(reports.slice(0, 20)));
            Utils.hideModal();
            Utils.showToast('Report received — reference #' + reports[0].id.slice(-6).toUpperCase(), 'success');
          })()`
        }
      ]
    });
  },

  /* ---------------- Deactivation ---------------- */
  deactivatePane() {
    const lawyer = Store.getState('lawyerProfile') || {};
    const deactivated = !!lawyer.profileDeactivated;
    return `
      <div class="settings-pane active">
        <div class="settings-pane-header">
          <h3 class="settings-pane-title" style="color:${deactivated ? 'var(--color-success-dark)' : 'var(--color-error)'}">${deactivated ? 'Resume New Bookings' : 'Pause Your Profile'}</h3>
          <p class="settings-pane-desc">${deactivated ? 'Your profile is currently hidden from new clients' : 'Temporarily stop receiving new client bookings'}</p>
        </div>

        <div class="danger-zone">
          <h4 class="danger-zone-title">${deactivated ? 'Reactivate' : 'Practice Pause'}</h4>
          <p class="text-body-md text-muted mb-4">
            When paused:
            <br>&bull; Your profile becomes unavailable for new bookings.
            <br>&bull; Existing cases and confirmed appointments remain fully active.
            <br>&bull; You can reactivate any time from here or from the dashboard banner.
          </p>

          ${deactivated
            ? `<button class="btn btn-primary btn-lg" onclick="SettingsPage.setDeactivated(false)">Reactivate Profile</button>`
            : `<button class="btn btn-danger btn-lg" onclick="SettingsPage.setDeactivated(true)">Pause Profile</button>`}
        </div>
      </div>
    `;
  },

  async setDeactivated(deactivate) {
    if (deactivate) {
      const ok = await Utils.showConfirm('Pause Profile?', 'New clients will not be able to book you until you reactivate. Active matters are unaffected.', { confirmText: 'Pause Profile', type: 'danger' });
      if (!ok) return;
    }
    const done = await ApiClient.setProfileDeactivated(deactivate);
    if (done) {
      Utils.showToast(deactivate ? 'Profile paused.' : 'Profile reactivated — welcome back!', deactivate ? 'warning' : 'success');
      Router.transitionPage('/settings', { tab: deactivate ? 'deactivate' : 'dashboard' });
      if (!deactivate) Router.navigate('/dashboard');
    } else {
      Utils.showToast('Action failed — please retry.', 'error');
    }
  },

  setTab(tab) {
    this._activeTab = tab;
    Router.transitionPage('/settings', { tab });
  },

  async onEnter(params) {
    if (this._activeTab === 'security') {
      await this.hydrateSecurityPane();
    }
  }
};
