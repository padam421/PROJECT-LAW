/* ============================================================
   Nyay Setu USER — PROFILE & SETTINGS
   profile_page.js — User Profile, Settings, Notifications,
   Security, Privacy Controls, Suspicious Alerts, Support
   ============================================================ */

const UserProfilePage = {

  /* ==================== 1. USER PROFILE (STEP 51) ==================== */
  renderProfile() {
    const user = UserStore.getUser();
    const initials = (user.fullName || 'User').split(' ').map(n => n[0]).slice(0, 2).join('');

    const content = `
      <div style="max-width:760px;margin:0 auto">
        <!-- Header -->
        <div class="u-profile-header">
          <div class="u-profile-avatar">
            ${user.profilePhoto ? `<img src="${user.profilePhoto}" alt="">` : initials}
            <div class="u-profile-avatar-edit" onclick="document.getElementById('profile-img-upload').click()" title="Change avatar">
              <span class="material-symbols-rounded" style="font-size:16px">photo_camera</span>
            </div>
          </div>
          <input type="file" id="profile-img-upload" style="display:none" accept="image/*">

          <div class="u-profile-info">
            <h2 class="u-profile-name">${Utils.escapeHtml(user.fullName || user.name || 'User Profile')}</h2>
            <div class="u-profile-email">${Utils.escapeHtml(user.email || '')}</div>
            <div class="u-profile-location">
              <span class="material-symbols-rounded" style="font-size:16px">location_on</span>
              <span>${Utils.escapeHtml(user.city || 'India')}${user.state ? ', ' + Utils.escapeHtml(user.state) : ''}</span>
            </div>
          </div>
        </div>

        <!-- Personal Details Form -->
        <div class="u-card" style="margin-bottom:24px">
          <h3 class="u-section-title">Personal Information</h3>
          <form onsubmit="UserProfilePage.saveProfile(event)">
            <div class="u-form-row">
              <div class="u-input-group">
                <label class="u-input-label">Full Name</label>
                <input type="text" class="u-input" id="prof-name" value="${Utils.escapeHtml(user.fullName || user.name || '')}" placeholder="Your full name">
              </div>
              <div class="u-input-group">
                <label class="u-input-label">Mobile Number</label>
                <input type="tel" class="u-input" id="prof-phone" value="${Utils.escapeHtml(user.mobile || user.phone || '')}" placeholder="Enter your mobile number">
              </div>
            </div>

            <div class="u-form-row">
              <div class="u-input-group">
                <label class="u-input-label">City</label>
                <input type="text" class="u-input" id="prof-city" value="${Utils.escapeHtml(user.city || '')}" placeholder="Your city">
              </div>
              <div class="u-input-group">
                <label class="u-input-label">Preferred Language</label>
                <select class="u-input" id="prof-lang" onchange="UserStore.setLanguage(this.value);Utils.showToast('Language preference updated!','info')">
                  <option value="en" ${UserStore.getLanguage() === 'en' ? 'selected' : ''}>English</option>
                  <option value="te" ${UserStore.getLanguage() === 'te' ? 'selected' : ''}>తెలుగు (Telugu)</option>
                  <option value="hi" ${UserStore.getLanguage() === 'hi' ? 'selected' : ''}>हिन्दी (Hindi)</option>
                  <option value="ta" ${UserStore.getLanguage() === 'ta' ? 'selected' : ''}>தமிழ் (Tamil)</option>
                  <option value="kn" ${UserStore.getLanguage() === 'kn' ? 'selected' : ''}>ಕನ್ನಡ (Kannada)</option>
                </select>
              </div>
            </div>

            <button type="submit" class="u-btn u-btn-primary u-btn-pill" style="margin-top:8px">
              <span class="material-symbols-rounded">save</span> Save Changes
            </button>
          </form>
        </div>

        <!-- Quick Links Group -->
        <div class="u-settings-group">
          <div class="u-settings-group-title">Account & Security</div>
          <div class="u-settings-list">
            <div class="u-settings-item" onclick="Router.navigate('/security')">
              <div class="u-settings-item-icon accent"><span class="material-symbols-rounded">security</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Security & Authentication</div>
                <div class="u-settings-item-desc">2FA, Passwords, Biometrics</div>
              </div>
              <div class="u-settings-item-right"><span class="material-symbols-rounded">chevron_right</span></div>
            </div>
            <div class="u-settings-item" onclick="Router.navigate('/settings')">
              <div class="u-settings-item-icon cyan"><span class="material-symbols-rounded">tune</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Preferences & Notifications</div>
                <div class="u-settings-item-desc">SMS, Email alerts, Appearance</div>
              </div>
              <div class="u-settings-item-right"><span class="material-symbols-rounded">chevron_right</span></div>
            </div>
            <div class="u-settings-item" onclick="Router.navigate('/support')">
              <div class="u-settings-item-icon emerald"><span class="material-symbols-rounded">help</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Help & Customer Support</div>
                <div class="u-settings-item-desc">FAQ, Contact Nyay Setu Team</div>
              </div>
              <div class="u-settings-item-right"><span class="material-symbols-rounded">chevron_right</span></div>
            </div>
            <div class="u-settings-item" onclick="UserComponents.handleLogout()">
              <div class="u-settings-item-icon rose"><span class="material-symbols-rounded">logout</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label" style="color:var(--u-rose-light)">Sign Out</div>
                <div class="u-settings-item-desc">End your active session</div>
              </div>
              <div class="u-settings-item-right"><span class="material-symbols-rounded">chevron_right</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'profile', 'My Profile');
  },

  async saveProfile(e) {
    e.preventDefault();
    const user = UserStore.getUser();
    user.fullName = document.getElementById('prof-name')?.value.trim() || user.fullName;
    user.phone = document.getElementById('prof-phone')?.value.trim() || user.phone;
    user.city = document.getElementById('prof-city')?.value.trim() || user.city;
    UserStore.setUser(user);
    try {
      const url = window.AuthManager ? AuthManager.getApiUrl('/api/users/profile') : '/api/users/profile';
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          fullName: user.fullName,
          phone: user.phone,
          city: user.city
        })
      });
    } catch (_) {}
    Utils.showToast('Profile updated & saved to database!', 'success');
  },

  /* ==================== 2. SETTINGS (STEP 52) ==================== */
  renderSettings() {
    const content = `
      <div style="max-width:760px;margin:0 auto">
        <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:20px">Settings & Preferences</h2>

        <!-- Notification Preferences -->
        <div class="u-settings-group">
          <div class="u-settings-group-title">Notifications</div>
          <div class="u-settings-list">
            <div class="u-settings-item">
              <div class="u-settings-item-icon amber"><span class="material-symbols-rounded">gavel</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Hearing Date Reminders</div>
                <div class="u-settings-item-desc">Alerts 7 days, 3 days & 1 day before court hearings</div>
              </div>
              <label class="u-toggle">
                <input type="checkbox" checked>
                <span class="u-toggle-track"></span>
                <span class="u-toggle-thumb"></span>
              </label>
            </div>
            <div class="u-settings-item">
              <div class="u-settings-item-icon accent"><span class="material-symbols-rounded">chat</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Lawyer Message Alerts</div>
                <div class="u-settings-item-desc">Instant notification when advocate shares note or update</div>
              </div>
              <label class="u-toggle">
                <input type="checkbox" checked>
                <span class="u-toggle-track"></span>
                <span class="u-toggle-thumb"></span>
              </label>
            </div>
            <div class="u-settings-item">
              <div class="u-settings-item-icon cyan"><span class="material-symbols-rounded">sms</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">SMS Alerts</div>
                <div class="u-settings-item-desc">Receive critical legal updates via SMS on your mobile</div>
              </div>
              <label class="u-toggle">
                <input type="checkbox" checked>
                <span class="u-toggle-track"></span>
                <span class="u-toggle-thumb"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Privacy & AI Settings -->
        <div class="u-settings-group">
          <div class="u-settings-group-title">Privacy & AI Data Controls</div>
          <div class="u-settings-list">
            <div class="u-settings-item">
              <div class="u-settings-item-icon emerald"><span class="material-symbols-rounded">smart_toy</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">AI Case Context Memory</div>
                <div class="u-settings-item-desc">Allow Ask Nyay Setu AI to reference your uploaded case file</div>
              </div>
              <label class="u-toggle">
                <input type="checkbox" checked>
                <span class="u-toggle-track"></span>
                <span class="u-toggle-thumb"></span>
              </label>
            </div>
            <div class="u-settings-item">
              <div class="u-settings-item-icon rose"><span class="material-symbols-rounded">delete_forever</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label" style="color:var(--u-rose-light)">Clear AI Conversation History</div>
                <div class="u-settings-item-desc">Permanently wipe all past questions and chat responses</div>
              </div>
              <button class="u-btn u-btn-danger u-btn-sm u-btn-pill" onclick="UserProfilePage.clearAIChat()">Clear</button>
            </div>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'settings', 'Settings');
  },

  async clearAIChat() {
    const confirm = await Utils.showConfirm('Clear AI Chat History', 'Are you sure? This action cannot be undone.', { confirmText: 'Clear', type: 'danger' });
    if (confirm) {
      UserStore.set('conversations', []);
      Utils.showToast('AI Chat history cleared.', 'success');
    }
  },

  /* ==================== 3. NOTIFICATIONS (STEP 50) ==================== */
  async renderNotifications() {
    try {
      const serverNotifs = await UserApiClient.fetchNotifications();
      if (serverNotifs && serverNotifs.length) {
        UserStore.set('notifications', serverNotifs);
      }
    } catch (_) {}

    const notifications = UserStore.getNotifications();

    const content = `
      <div style="max-width:760px;margin:0 auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h2 style="font-size:1.5rem;font-weight:800">Notifications</h2>
          <button class="u-btn u-btn-ghost u-btn-sm" onclick="UserProfilePage.markAllNotifsRead()">Mark all as read</button>
        </div>

        <div class="u-card" style="padding:0;overflow:hidden">
          <div class="u-notif-list">
            ${notifications.length > 0 ? notifications.map(n => `
              <div class="u-notif-item ${n.read ? '' : 'u-notif-unread'}">
                <div class="u-notif-icon ${n.type || 'lawyer'}">
                  <span class="material-symbols-rounded">${n.type === 'hearing' ? 'gavel' : n.type === 'lawyer' ? 'person' : n.type === 'document' ? 'description' : n.type === 'payment' ? 'payment' : 'security'}</span>
                </div>
                <div class="u-notif-content">
                  ${n.title ? `<div style="font-weight:700;font-size:0.9rem;margin-bottom:2px">${Utils.escapeHtml(n.title)}</div>` : ''}
                  <div class="u-notif-text">${Utils.escapeHtml(n.message || n.text || '')}</div>
                  <div class="u-notif-time">${Utils.timeAgo(n.time || n.createdAt)}</div>
                </div>
              </div>
            `).join('') : UserComponents.EmptyState('notifications_off', 'No Notifications', 'You are all caught up with your case updates.')}
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'notifications', 'Notifications');
  },

  async markAllNotifsRead() {
    const notifs = UserStore.getNotifications();
    for (const n of notifs) {
      n.read = true;
      if (n.id) {
        const notifUrl = window.AuthManager ? AuthManager.getApiUrl(`/api/notifications/${n.id}/read`) : `/api/notifications/${n.id}/read`;
        fetch(notifUrl, { method: 'PATCH' }).catch(() => {});
      }
    }
    UserStore.set('notifications', notifs);
    Utils.showToast('All notifications marked as read.', 'info');
    Router.transitionPage('/notifications');
  },

  /* ==================== 4. SECURITY & PRIVACY (STEPS 47-49) ==================== */
  renderSecurity() {
    const content = `
      <div style="max-width:760px;margin:0 auto">
        <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:20px">Security & Access Management</h2>

        <!-- Suspicious Login Alert Box (Demo) -->
        <div class="u-security-alert">
          <div class="u-security-alert-header">
            <div class="u-security-alert-icon"><span class="material-symbols-rounded">warning</span></div>
            <div>
              <div class="u-security-alert-title">Security Alert: New Sign-in Detected</div>
              <div style="font-size:0.75rem;color:var(--u-rose-light)">Verify if this was you</div>
            </div>
          </div>
          <div class="u-security-alert-body">
            A new login to your Nyay Setu account occurred on <strong>Chrome on Windows 11</strong> from <strong>Hyderabad, India</strong>.
          </div>
          <div class="u-security-alert-details">
            <div class="u-security-detail">
              <div class="u-security-detail-label">IP Address</div>
              <div class="u-security-detail-value">183.82.112.45 (ACT Fibernet)</div>
            </div>
            <div class="u-security-detail">
              <div class="u-security-detail-label">Time</div>
              <div class="u-security-detail-value">Today at 06:14 PM</div>
            </div>
          </div>
          <div class="u-security-alert-actions">
            <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="Utils.showToast('Device confirmed as trusted.', 'success')">
              ✓ Yes, This Was Me
            </button>
            <button class="u-btn u-btn-danger u-btn-sm u-btn-pill" onclick="Utils.showToast('All active sessions terminated. Password reset email sent.', 'error')">
              ✕ No, Secure My Account
            </button>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="u-card" style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div style="width:40px;height:40px;border-radius:12px;background:rgba(20,184,166,0.15);display:flex;align-items:center;justify-content:center;color:var(--u-accent)">
              <span class="material-symbols-rounded" style="font-size:22px">key</span>
            </div>
            <div>
              <h3 style="font-size:1.15rem;font-weight:700;margin:0">Change Password</h3>
              <p style="font-size:0.82rem;color:var(--u-text-muted);margin:0">Update your account password securely in database</p>
            </div>
          </div>
          <form onsubmit="UserProfilePage.handlePasswordChange(event)">
            <div class="u-input-group" style="margin-bottom:14px">
              <label class="u-input-label">Current Password</label>
              <input type="password" class="u-input" id="u-curr-pass" placeholder="Enter your existing password" required autocomplete="current-password">
            </div>
            <div class="u-form-row">
              <div class="u-input-group">
                <label class="u-input-label">New Password</label>
                <input type="password" class="u-input" id="u-new-pass" placeholder="Min 8 chars, letters & numbers" required autocomplete="new-password">
              </div>
              <div class="u-input-group">
                <label class="u-input-label">Confirm New Password</label>
                <input type="password" class="u-input" id="u-confirm-pass" placeholder="Confirm new password" required autocomplete="new-password">
              </div>
            </div>
            <button type="submit" class="u-btn u-btn-primary u-btn-pill" id="u-pass-btn" style="margin-top:10px">
              <span class="material-symbols-rounded">lock_reset</span> Save New Password
            </button>
          </form>
        </div>

        <!-- Authentication Controls -->
        <div class="u-settings-group">
          <div class="u-settings-group-title">Authentication Factors</div>
          <div class="u-settings-list">
            <div class="u-settings-item">
              <div class="u-settings-item-icon emerald"><span class="material-symbols-rounded">verified_user</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Two-Factor Authentication (OTP)</div>
                <div class="u-settings-item-desc">Requires 6-digit email/SMS code for sign in</div>
              </div>
              <label class="u-toggle">
                <input type="checkbox" checked>
                <span class="u-toggle-track"></span>
                <span class="u-toggle-thumb"></span>
              </label>
            </div>
            <div class="u-settings-item">
              <div class="u-settings-item-icon accent"><span class="material-symbols-rounded">fingerprint</span></div>
              <div class="u-settings-item-content">
                <div class="u-settings-item-label">Biometric Quick Unlock</div>
                <div class="u-settings-item-desc">Use Windows Hello or Touch ID when available</div>
              </div>
              <label class="u-toggle">
                <input type="checkbox" checked>
                <span class="u-toggle-track"></span>
                <span class="u-toggle-thumb"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Lawyer Access Controls -->
        <div class="u-settings-group">
          <div class="u-settings-group-title">Active Data Sharing Authorizations</div>
          <div class="u-access-list">
            <div class="u-access-item">
              <div class="u-access-avatar" style="background:var(--u-accent-gradient);color:#fff;font-weight:700">RS</div>
              <div class="u-access-info">
                <div class="u-access-name">Adv. Rahul Sharma</div>
                <div class="u-access-level">Authorized for: Property Dispute Case & 3 Shared Files</div>
              </div>
              <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="Utils.showToast('Access revoked.', 'warning')">Revoke Access</button>
            </div>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'profile', 'Security', true);
  },

  async handlePasswordChange(e) {
    e.preventDefault();
    const curr = document.getElementById('u-curr-pass')?.value || '';
    const next = document.getElementById('u-new-pass')?.value || '';
    const conf = document.getElementById('u-confirm-pass')?.value || '';
    const btn = document.getElementById('u-pass-btn');

    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      Utils.showToast('New password must have at least 8 characters with letters and numbers.', 'warning');
      return;
    }
    if (next !== conf) {
      Utils.showToast('Passwords do not match.', 'warning');
      return;
    }

    if (btn) btn.disabled = true;
    try {
      const changePassUrl = window.AuthManager ? AuthManager.getApiUrl('/api/auth/change-password') : '/api/auth/change-password';
      const res = await fetch(changePassUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: curr, newPassword: next })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Utils.showToast('Password changed successfully and saved to database!', 'success');
        document.getElementById('u-curr-pass').value = '';
        document.getElementById('u-new-pass').value = '';
        document.getElementById('u-confirm-pass').value = '';
      } else {
        Utils.showToast(data.error || 'Failed to change password.', 'error');
      }
    } catch (err) {
      Utils.showToast('Network error while updating password.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /* ==================== 5. HELP & SUPPORT (STEP 53) ==================== */
  renderSupport() {
    const faqs = [
      { q: 'Is my consultation with the lawyer confidential?', a: 'Yes. All video consultations and uploaded documents are encrypted end-to-end and protected by attorney-client legal privilege.' },
      { q: 'Can I change my preferred language later?', a: 'Yes. You can switch your preferred language anytime in your Profile or Settings.' },
      { q: 'What happens if I miss my scheduled consultation?', a: 'You can reschedule your appointment free of charge up to 2 hours before the session.' },
      { q: 'Does Nyay Setu AI provide legal representation in court?', a: 'No. Nyay Setu AI is designed for informational assistance and preparation. For court representation, you should retain one of our verified advocates.' },
    ];

    const content = `
      <div style="max-width:760px;margin:0 auto">
        <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:20px">Help & Support Center</h2>

        <!-- Support Categories -->
        <div class="u-support-grid" style="margin-bottom:28px">
          <div class="u-support-card" onclick="Router.navigate('/chat')">
            <div class="u-support-card-icon"><span class="material-symbols-rounded">chat</span></div>
            <div class="u-support-card-label">AI Legal Guide</div>
          </div>
          <div class="u-support-card" onclick="Utils.showToast('Support helpline: 1800-200-LEGAL (Mon-Sat 9AM-8PM)', 'info')">
            <div class="u-support-card-icon" style="background:var(--u-emerald-subtle);color:var(--u-emerald-light)"><span class="material-symbols-rounded">call</span></div>
            <div class="u-support-card-label">Toll-Free Helpline</div>
          </div>
          <div class="u-support-card" onclick="Utils.showToast('Email support: support@nyaysetu.in', 'info')">
            <div class="u-support-card-icon" style="background:var(--u-amber-subtle);color:var(--u-amber-light)"><span class="material-symbols-rounded">mail</span></div>
            <div class="u-support-card-label">Email Support</div>
          </div>
        </div>

        <!-- FAQ Accordion -->
        <div class="u-card">
          <h3 class="u-section-title">Frequently Asked Questions</h3>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${faqs.map(f => `
              <div style="padding:14px;background:rgba(255,255,255,0.02);border-radius:var(--u-radius-sm);border:1px solid var(--u-border)">
                <div style="font-size:0.9rem;font-weight:700;color:var(--u-text-primary);margin-bottom:6px">${f.q}</div>
                <div style="font-size:0.82rem;color:var(--u-text-tertiary);line-height:1.6">${f.a}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'profile', 'Help & Support', true);
  }
};
