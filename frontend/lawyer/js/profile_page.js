/* ============================================================
   Nyay Setu — ADVOCATE PORTFOLIO & PRACTICE SETTINGS
   profile_page.js — Public profile, experience, case record,
   certificates, service pricing & weekly availability.
   ============================================================ */

const ProfilePage = {
  _activeTab: 'portfolio',

  render(params = {}) {
    if (params.tab) this._activeTab = params.tab;

    const lawyer = Store.getState('lawyerProfile') || {};
    const exp = Store.getState('experience') || [];
    const caseExp = Store.getState('caseExperience') || [];
    const certs = Store.getState('certificates') || [];
    const pricing = Store.getState('pricing') || [];
    const availability = Store.getState('availability') || {};
    const isVerified = lawyer.verificationStatus === 'verified';
    const rating = Store.getAverageRating();

    const tabs = [
      { id: 'portfolio', label: 'Public Portfolio' },
      { id: 'experience', label: `Experience (${exp.length})` },
      { id: 'cases', label: `Case Record (${caseExp.length})` },
      { id: 'certificates', label: `Certificates (${certs.length})` },
      { id: 'pricing', label: 'Service Pricing' },
      { id: 'availability', label: 'Availability' }
    ];

    const contentHtml = `
      <!-- Profile Hero -->
      <div class="profile-hero">
        <div class="profile-hero-main">
          <div class="profile-avatar-large" onclick="document.getElementById('profile-photo-input').click()" role="button" tabindex="0" aria-label="Change profile photo" title="Change photo">
            ${lawyer.profilePhoto
              ? `<img src="${lawyer.profilePhoto}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
              : (lawyer.fullName || 'ADV').split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <input type="file" id="profile-photo-input" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="ProfilePage.handlePhotoUpload(event)">
          <div class="profile-hero-info">
            <div class="profile-name-row">
              <h2 class="profile-hero-title">${Utils.escapeHtml(lawyer.fullName || 'Advocate')}</h2>
              ${lawyer.demoMode ? '<span class="badge badge-neutral">Demo profile — not verified</span>' : isVerified
                ? `<span class="badge badge-verified"><span class="material-symbols-rounded icon-sm">verified</span> Verified Advocate</span>`
                : `<span class="badge badge-warning"><span class="material-symbols-rounded icon-sm">hourglass_top</span> Verification in progress</span>`}
            </div>
            <div class="profile-hero-subtitle">
              ${Utils.escapeHtml(String(lawyer.yearsOfPractice ?? '—'))} years of practice &bull; ${Utils.escapeHtml(lawyer.stateBarCouncil || '')} <span class="font-mono">(${Utils.escapeHtml(lawyer.barCouncil || '')})</span>
            </div>
            <div class="profile-tags-row">
              ${(lawyer.primarySpecialization ? [lawyer.primarySpecialization] : []).concat(lawyer.additionalSpecializations || []).map(s => `<span class="chip">${Utils.escapeHtml(s)}</span>`).join('')}
              ${rating ? `<span class="chip font-mono" style="background:var(--color-gold-50);color:var(--color-gold-dark)">${rating} ★</span>` : ''}
            </div>
          </div>
        </div>

        <div class="d-flex gap-3">
          <button class="btn btn-secondary" onclick="ProfilePage.openEditPortfolioModal()">
            <span class="material-symbols-rounded">edit</span> Edit Portfolio
          </button>
        </div>
      </div>

      <!-- Section Tabs -->
      <div class="tabs mb-6" role="tablist">
        ${tabs.map(t => `
          <button type="button" role="tab" aria-selected="${this._activeTab === t.id}" class="tab-item ${this._activeTab === t.id ? 'active' : ''}" onclick="ProfilePage.setTab('${t.id}')">${t.label}</button>
        `).join('')}
      </div>

      <div id="profile-tab-content">
        ${this.renderTabContent(this._activeTab, lawyer, exp, caseExp, certs, pricing, availability)}
      </div>
    `;

    return Components.AppLayout(contentHtml, 'profile', 'Portfolio & Profile', ['Profile']);
  },

  renderTabContent(tab, lawyer, exp, caseExp, certs, pricing, availability) {
    if (tab === 'experience') return this.renderExperienceTab(exp);
    if (tab === 'cases') return this.renderCaseExperienceTab(caseExp);
    if (tab === 'certificates') return this.renderCertificatesTab(certs);
    if (tab === 'pricing') return this.renderPricingTab(pricing);
    if (tab === 'availability') return this.renderAvailabilityTab(availability);
    return this.renderPortfolioTab(lawyer, exp, caseExp, certs);
  },

  /* ---------------- Public portfolio ---------------- */
  renderPortfolioTab(lawyer, exp, caseExp, certs) {
    const verifiedCerts = (certs || []).filter(c => c.status === 'verified').length;
    return `
      <div class="grid-2 mb-6">
        <div class="card">
          <h3 class="card-title mb-3">Professional Bio</h3>
          <p class="text-body-md" style="line-height:1.8;color:var(--color-gray-700)">
            ${lawyer.bio ? Utils.escapeHtml(lawyer.bio) : '<em style="color:var(--color-gray-400)">Add a professional bio so clients understand your practice focus and approach.</em>'}
          </p>

          <h4 class="card-title mt-6 mb-2">Courts of Practice</h4>
          <div class="d-flex flex-wrap gap-2">
            ${(lawyer.courts && lawyer.courts.length ? lawyer.courts : []).map(c => `<span class="chip">${Utils.escapeHtml(c)}</span>`).join('') || '<span class="text-body-sm text-muted">Not listed yet</span>'}
          </div>

          <h4 class="card-title mt-6 mb-2">Languages</h4>
          <div class="d-flex flex-wrap gap-2">
            ${(lawyer.languages && lawyer.languages.length ? lawyer.languages : []).map(l => `<span class="chip">${Utils.escapeHtml(l)}</span>`).join('') || '<span class="text-body-sm text-muted">Not listed yet</span>'}
          </div>
        </div>

        <div class="card">
          <h3 class="card-title mb-3">Practice Snapshot</h3>
          <div class="data-table">
            <table><tbody>
              <tr><td><strong>Bar Registration:</strong></td><td class="font-mono">${Utils.escapeHtml(lawyer.barCouncil || '—')} ${lawyer.demoMode ? '(Demo sample — not verified)' : lawyer.verificationStatus === 'verified' ? '(Verified)' : '(Verification pending)'}</td></tr>
              <tr><td><strong>State Bar Council:</strong></td><td>${Utils.escapeHtml(lawyer.stateBarCouncil || '—')}</td></tr>
              <tr><td><strong>Primary Focus:</strong></td><td>${Utils.escapeHtml(lawyer.primarySpecialization || '—')}</td></tr>
              <tr><td><strong>Location:</strong></td><td>${Utils.escapeHtml([lawyer.city, lawyer.state].filter(Boolean).join(', ') || '—')}</td></tr>
              <tr><td><strong>Track Record:</strong></td><td>${(exp || []).length} positions • ${(caseExp || []).length} matters • ${verifiedCerts} verified credentials</td></tr>
            </tbody></table>
          </div>

          <div class="mt-4 p-3" style="background:${lawyer.verificationStatus === 'verified' ? 'var(--color-accent-50)' : 'rgba(245,158,11,0.08)'};border-radius:var(--radius-lg);border:1px solid ${lawyer.verificationStatus === 'verified' ? 'rgba(13,148,136,0.2)' : 'rgba(245,158,11,0.25)'}">
            <div class="d-flex items-center gap-2">
              <span class="material-symbols-rounded" style="color:${lawyer.verificationStatus === 'verified' ? 'var(--color-accent)' : 'var(--color-gold-dark)'}">${lawyer.verificationStatus === 'verified' ? 'verified' : 'hourglass_top'}</span>
              <strong style="color:${lawyer.verificationStatus === 'verified' ? 'var(--color-accent-dark)' : 'var(--color-gold-dark)'}">
                ${lawyer.demoMode ? 'Demo Profile — No Professional Verification' : lawyer.verificationStatus === 'verified' ? 'Trust Badge Active' : 'Badge Awaiting Verification'}
              </strong>
            </div>
            <span class="text-body-sm text-muted">
              ${lawyer.demoMode ? 'Sample information for the hackathon. This profile is excluded from the real advocate approval queue.' : lawyer.verificationStatus === 'verified'
                ? 'Your profile is publicly discoverable and open for consultation bookings.'
                : 'Clients can find you once credential verification completes. Check progress in the Verification wizard.'}
            </span>
          </div>
        </div>
      </div>
    `;
  },

  /* ---------------- Professional experience ---------------- */
  renderExperienceTab(exp) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Professional Experience</h3>
            <p class="text-body-sm text-muted">Firms, chambers and roles across your career</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="ProfilePage.openAddExperienceModal()">
            <span class="material-symbols-rounded">add</span> Add Position
          </button>
        </div>

        ${exp.length === 0 ? Components.emptyState('work_history', 'No experience added yet', 'Add your first firm or chamber position.') : `
        <div class="timeline-container">
          ${exp.map(e => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-card">
                <div class="d-flex justify-between items-start gap-3">
                  <div>
                    <div class="timeline-org">${Utils.escapeHtml(e.organization)}</div>
                    <div class="timeline-role">${Utils.escapeHtml(e.position)}${e.role ? ` • Role: ${Utils.escapeHtml(e.role)}` : ''}</div>
                    <div class="text-body-sm mt-1" style="color:var(--color-gray-600)">${e.area ? Utils.escapeHtml(e.area) : ''}</div>
                  </div>
                  <div style="text-align:right">
                    <span class="badge badge-neutral">${e.startYear} – ${e.endYear || 'Present'}</span>
                    <button class="btn btn-ghost btn-sm" style="display:block;margin:6px 0 0 auto;color:var(--color-error)" onclick="ProfilePage.deleteItem('experience','${e.id}')" aria-label="Delete experience">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>
    `;
  },

  /* ---------------- Case record ---------------- */
  renderCaseExperienceTab(caseExp) {
    const positive = ['Resolved', 'Acquitted', 'Granted', 'Won', 'Settled', 'Success'];
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Case Track Record</h3>
            <p class="text-body-sm text-muted">Judicial outcomes and roles — client identities stay confidential</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="ProfilePage.openAddCaseModal()">
            <span class="material-symbols-rounded">add</span> Add Case Record
          </button>
        </div>

        <div class="doc-comparison-banner mb-4">
          <span class="material-symbols-rounded">shield</span>
          <span><strong>Client Confidentiality:</strong> never include client names, case numbers or identifying details in public case records. Entries violating this may be removed.</span>
        </div>

        ${caseExp.length === 0 ? Components.emptyState('gavel', 'No case records yet', 'Summarised matters help clients understand your trial experience.') : `
        <div class="grid-2">
          ${caseExp.map(c => `
            <div class="card card-glass">
              <div class="d-flex justify-between items-start mb-2">
                <span class="font-semibold text-title-md text-primary">${Utils.escapeHtml(c.type)}</span>
                <div class="d-flex items-center gap-2">
                  <span class="badge ${positive.some(p => String(c.outcome).includes(p)) ? 'badge-success' : 'badge-accent'}">${Utils.escapeHtml(c.outcome)}</span>
                  <button class="btn-icon btn-icon-sm" style="color:var(--color-error)" onclick="ProfilePage.deleteItem('caseExperience','${c.id}')" aria-label="Delete case record">
                    <span class="material-symbols-rounded icon-sm">delete</span>
                  </button>
                </div>
              </div>
              <div class="text-body-sm text-muted mb-2">${Utils.escapeHtml(c.court)} &bull; ${Utils.escapeHtml(String(c.year))} &bull; ${Utils.escapeHtml(c.role)}</div>
              <p class="text-body-md text-gray-700 mb-3">${Utils.escapeHtml(c.description || '')}</p>
              <div class="d-flex justify-between items-center pt-2 border-t text-label-sm text-muted">
                <span>${Utils.escapeHtml(c.area)}</span>
                <span>Status: ${Utils.escapeHtml(c.status)}</span>
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>
    `;
  },

  /* ---------------- Certificates ---------------- */
  renderCertificatesTab(certs) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Legal Certifications</h3>
            <p class="text-body-sm text-muted">Specialist qualifications — each shows “Verified” only after desk approval</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="ProfilePage.openAddCertModal()">
            <span class="material-symbols-rounded">add</span> Add Certificate
          </button>
        </div>

        ${certs.length === 0 ? Components.emptyState('workspace_premium', 'No certificates listed', 'Add LLM, mediation, arbitration or other specialist certifications.') : `
        <div class="certificates-grid">
          ${certs.map(cert => `
            <div class="certificate-card">
              <div class="cert-icon-box">
                <span class="material-symbols-rounded">${cert.status === 'verified' ? 'verified' : 'hourglass_top'}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-body-md truncate">${Utils.escapeHtml(cert.name)}</div>
                <div class="text-body-sm text-muted truncate">${Utils.escapeHtml(cert.fileLabel || cert.file || 'Submitted to vault')}</div>
                <div class="d-flex items-center gap-2 mt-2 flex-wrap">
                  <span class="badge ${cert.status === 'verified' ? 'badge-success' : cert.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
                    ${cert.status === 'verified' ? 'Verified' : cert.status === 'rejected' ? 'Not approved' : 'Under Review'}
                  </span>
                  ${cert.verifiedDate ? `<span class="text-label-sm text-muted">Since ${Utils.escapeHtml(cert.verifiedDate)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>
    `;
  },

  /* ---------------- Pricing ---------------- */
  renderPricingTab(pricing) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Consultation Fee Structure</h3>
            <p class="text-body-sm text-muted">Fixed, starting-at, negotiable or complexity-based pricing per service</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="ProfilePage.openEditPricingModal()">
            <span class="material-symbols-rounded">tune</span> Edit Rate Card
          </button>
        </div>

        ${pricing.length === 0 ? Components.emptyState('payments', 'No services priced yet', 'Define consultation fees so clients know what to expect.', 'Add First Service', "ProfilePage.openEditPricingModal()") : `
        <div class="data-table">
          <table>
            <thead>
              <tr><th>Service</th><th>Unit</th><th>Fee</th><th>Model</th></tr>
            </thead>
            <tbody>
              ${pricing.map(p => `
                <tr>
                  <td><strong>${Utils.escapeHtml(p.service)}</strong></td>
                  <td>${Utils.escapeHtml(p.duration)}</td>
                  <td style="color:var(--color-accent);font-weight:700">${Utils.formatCurrency(p.fee)}</td>
                  <td>
                    <span class="badge ${p.type === 'fixed' ? 'badge-neutral' : p.type === 'starting' ? 'badge-accent' : p.type === 'negotiable' ? 'badge-warning' : 'badge-info'}">
                      ${{ fixed: 'Fixed Price', starting: 'Starting Price', negotiable: 'Negotiable', complexity: 'Depends on Complexity' }[p.type] || p.type}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
    `;
  },

  /* ---------------- Availability ---------------- */
  renderAvailabilityTab(availability) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const totalSlots = days.reduce((n, d) => n + ((availability[d.toLowerCase()] || []).length), 0);
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Weekly Availability</h3>
            <p class="text-body-sm text-muted">${totalSlots} slot${totalSlots === 1 ? '' : 's'} configured • consultations can only be booked inside these windows</p>
          </div>
        </div>

        <div class="availability-table">
          ${days.map(day => {
            const key = day.toLowerCase();
            const slots = availability[key] || [];
            return `
              <div class="availability-day-row">
                <div class="avail-day-name">${day}</div>
                <div class="avail-slots-list">
                  ${slots.length > 0 ? slots.map((s, i) => `
                    <span class="avail-slot-chip">${s.start} – ${s.end}
                      <button class="slot-remove" onclick="ProfilePage.removeSlot('${key}', ${i})" aria-label="Remove ${day} ${s.start}-${s.end} slot">&times;</button>
                    </span>
                  `).join('') : '<span class="avail-slot-none">Unavailable</span>'}
                </div>
                <button class="btn btn-ghost btn-sm" onclick="ProfilePage.openDayEditor('${day}')">+ Add Slot</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
  },

  /* ---------------- Data mutations ---------------- */
  async handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      Utils.showToast('Choose an image under 1 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await ApiClient.uploadProfilePhoto(e.target.result);
        Utils.showToast('Profile photo updated.', 'success');
        Router.transitionPage('/profile');
      } catch (err) {
        Utils.showToast(err.message || 'Could not update photo.', 'error');
      }
    };
    reader.readAsDataURL(file);
  },

  deleteItem(collection, id) {
    const list = Store.getState(collection) || [];
    const next = list.filter(item => item.id !== id);
    Store.setState(collection, next);
    Utils.showToast('Entry removed.', 'info');
    Router.transitionPage('/profile', { tab: this._activeTab });
  },

  removeSlot(dayKey, index) {
    const availability = { ...Store.getState('availability') };
    availability[dayKey] = (availability[dayKey] || []).filter((_, i) => i !== index);
    Store.setState('availability', availability);
    Router.transitionPage('/profile', { tab: 'availability' });
  },

  /* ---------------- Modals ---------------- */
  openEditPortfolioModal() {
    const lawyer = Store.getState('lawyerProfile') || {};
    const specializationsList = ['Criminal Law', 'Civil Law', 'Cyber Law', 'Corporate Law', 'Family & Matrimonial', 'Constitutional Law', 'Taxation Law', 'Consumer Disputes', 'Arbitration & Mediation'];
    const currentAdditional = lawyer.additionalSpecializations || [];
    Utils.showModal(`
      <div class="form-group">
        <label class="form-label" for="edit-profname">Professional Display Name</label>
        <input type="text" id="edit-profname" class="form-input" value="${Utils.escapeHtml(lawyer.professionalName || '')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-bio-text">Professional Bio</label>
        <textarea id="edit-bio-text" class="form-textarea" rows="4" maxlength="1200" placeholder="Your practice focus, approach and notable strengths…">${Utils.escapeHtml(lawyer.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-spec">Primary Specialization</label>
        <select id="edit-spec" class="form-select">
          ${specializationsList.map(s => `<option ${lawyer.primarySpecialization === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Additional Specializations</label>
        <div class="selectable-chips-group" id="chips-addl-spec">
          ${specializationsList.map(s => `
            <button type="button" class="selectable-chip ${currentAdditional.includes(s) ? 'selected' : ''}" onclick="this.classList.toggle('selected')" aria-pressed="${currentAdditional.includes(s)}">${s}</button>
          `).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="edit-city">City</label>
          <input type="text" id="edit-city" class="form-input" value="${Utils.escapeHtml(lawyer.city || '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-years">Years of Practice</label>
          <input type="number" id="edit-years" class="form-input" min="0" max="60" value="${lawyer.yearsOfPractice ?? ''}">
        </div>
      </div>
      <div class="doc-comparison-banner mt-2">
        <span class="material-symbols-rounded">gavel</span>
        <span><strong>Statutory credentials:</strong> your Bar Council Registration Number cannot be edited here like ordinary details. Changing it requires re-verification via the Credential Verification wizard.</span>
      </div>
    `, {
      title: 'Edit Portfolio',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Save Changes',
          class: 'btn btn-primary',
          onclick: `(() => {
            const selected = Array.from(document.querySelectorAll('#chips-addl-spec .selectable-chip.selected')).map(el => el.textContent.trim());
            ApiClient.updateProfile({
              professionalName: document.getElementById('edit-profname').value.trim(),
              bio: document.getElementById('edit-bio-text').value.trim(),
              city: document.getElementById('edit-city').value.trim(),
              yearsOfPractice: parseInt(document.getElementById('edit-years').value, 10),
              primarySpecialization: document.getElementById('edit-spec').value,
              additionalSpecializations: selected
            }).then(() => {
              Utils.hideModal();
              Utils.showToast('Portfolio updated.', 'success');
              Router.transitionPage('/profile');
            }).catch(err => Utils.showToast(err.message, 'error'));
          })()`
        }
      ]
    });
  },

  openAddExperienceModal() {
    Utils.showModal(`
      <div class="form-group">
        <label class="form-label" for="new-exp-org">Organization / Law Firm</label>
        <input type="text" id="new-exp-org" class="form-input" placeholder="e.g. Apex Law Chambers" required>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="new-exp-pos">Position</label>
          <input type="text" id="new-exp-pos" class="form-input" placeholder="e.g. Senior Associate" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-exp-role">Role</label>
          <input type="text" id="new-exp-role" class="form-input" placeholder="e.g. Lead Trial Counsel">
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="new-exp-start">Start Year</label>
          <input type="number" id="new-exp-start" class="form-input" min="1950" max="${new Date().getFullYear()}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-exp-end">End Year <span style="font-weight:400;color:var(--color-gray-400)">(blank = present)</span></label>
          <input type="number" id="new-exp-end" class="form-input" min="1950" max="${new Date().getFullYear()}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="new-exp-area">Area of Practice</label>
        <input type="text" id="new-exp-area" class="form-input" placeholder="e.g. Criminal & Civil Litigation" required>
      </div>
    `, {
      title: 'Add Professional Experience',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Save Position',
          class: 'btn btn-primary',
          onclick: `(() => {
            const org = document.getElementById('new-exp-org').value.trim();
            const start = parseInt(document.getElementById('new-exp-start').value, 10);
            const endRaw = document.getElementById('new-exp-end').value;
            const end = endRaw ? parseInt(endRaw, 10) : null;
            if (org.length < 2) { Utils.showToast('Enter the organization name.', 'warning'); return; }
            if (isNaN(start)) { Utils.showToast('Enter a valid start year.', 'warning'); return; }
            if (end && end < start) { Utils.showToast('End year cannot precede start year.', 'warning'); return; }
            const exp = Store.getState('experience') || [];
            exp.unshift({
              id: 'exp_' + Date.now(),
              organization: org,
              position: document.getElementById('new-exp-pos').value.trim() || 'Advocate',
              role: document.getElementById('new-exp-role').value.trim(),
              startYear: start,
              endYear: end,
              area: document.getElementById('new-exp-area').value.trim()
            });
            Store.setState('experience', exp);
            Utils.hideModal();
            Utils.showToast('Experience added to timeline.', 'success');
            Router.transitionPage('/profile', { tab: 'experience' });
          })()`
        }
      ]
    });
  },

  openAddCaseModal() {
    Utils.showModal(`
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="new-case-type">Case Type</label>
          <input type="text" id="new-case-type" class="form-input" placeholder="e.g. Commercial Dispute" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-case-area">Legal Area</label>
          <input type="text" id="new-case-area" class="form-input" placeholder="e.g. Corporate Law" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="new-case-court">Court</label>
          <input type="text" id="new-case-court" class="form-input" placeholder="e.g. High Court of Delhi" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-case-year">Year</label>
          <input type="number" id="new-case-year" class="form-input" min="1950" max="${new Date().getFullYear()}" value="${new Date().getFullYear() - 1}" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="new-case-role">Your Role</label>
          <input type="text" id="new-case-role" class="form-input" placeholder="e.g. Lead Counsel" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-case-status">Status</label>
          <select id="new-case-status" class="form-select">
            <option>Completed</option><option>Ongoing</option><option>Disposed</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="new-case-outcome">Outcome</label>
        <input type="text" id="new-case-outcome" class="form-input" placeholder="e.g. Favourable Settlement Secured" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="new-case-desc">Brief Description <span style="font-weight:400;color:var(--color-gray-400)">(no client names or identifiers)</span></label>
        <textarea id="new-case-desc" class="form-textarea" rows="3" maxlength="500" placeholder="Summary of the legal contention and resolution…"></textarea>
      </div>
    `, {
      title: 'Add Case Record',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Save Case Record',
          class: 'btn btn-primary',
          onclick: `(() => {
            const type = document.getElementById('new-case-type').value.trim();
            if (type.length < 3) { Utils.showToast('Enter the case type.', 'warning'); return; }
            // Confidentiality guard: block obvious personal names pattern "v." style entries
            const desc = document.getElementById('new-case-desc').value.trim();
            if (/\\bvs\\.?\\b|\\bin re:\\b/i.test(desc + ' ' + type)) {
              Utils.showToast('Remove party-name references — case records must stay anonymised.', 'warning');
              return;
            }
            const cases = Store.getState('caseExperience') || [];
            cases.unshift({
              id: 'cexp_' + Date.now(),
              type,
              area: document.getElementById('new-case-area').value.trim(),
              court: document.getElementById('new-case-court').value.trim(),
              year: parseInt(document.getElementById('new-case-year').value, 10),
              role: document.getElementById('new-case-role').value.trim(),
              status: document.getElementById('new-case-status').value,
              outcome: document.getElementById('new-case-outcome').value.trim(),
              description: desc
            });
            Store.setState('caseExperience', cases);
            Utils.hideModal();
            Utils.showToast('Case record added.', 'success');
            Router.transitionPage('/profile', { tab: 'cases' });
          })()`
        }
      ]
    });
  },

  openAddCertModal() {
    let chosenFile = null;
    Utils.showModal(`
      <div class="form-group">
        <label class="form-label" for="new-cert-name">Certification Title</label>
        <input type="text" id="new-cert-name" class="form-input" placeholder="e.g. International Arbitration Specialist" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="new-cert-file">Certificate Scan</label>
        <input type="file" id="new-cert-file" class="form-input" accept=".pdf,image/jpeg,image/png,image/webp">
        <span class="form-hint">PDF or image up to 10 MB</span>
      </div>
      <div class="ai-disclaimer">
        <span class="material-symbols-rounded icon-sm">hourglass_top</span>
        <span>New certificates enter review as “Under Review”. The Verified label appears only after the desk approves them.</span>
      </div>
    `, {
      title: 'Add Legal Certification',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Submit for Verification',
          class: 'btn btn-primary',
          onclick: `(async () => {
            const name = document.getElementById('new-cert-name').value.trim();
            const fileInput = document.getElementById('new-cert-file');
            if (name.length < 4) { Utils.showToast('Enter the certification title.', 'warning'); return; }
            try {
              let fileLabel = 'Submitted';
              if (fileInput.files[0]) {
                const doc = await ApiClient.uploadDocument(fileInput.files[0], 'other_cert', name);
                fileLabel = doc.originalName;
              }
              const certs = Store.getState('certificates') || [];
              certs.push({
                id: 'cert_' + Date.now(),
                name,
                type: 'optional',
                status: 'pending',
                verifiedDate: null,
                fileLabel
              });
              Store.setState('certificates', certs);
              Utils.hideModal();
              Utils.showToast('Certificate submitted for verification.', 'success');
              Router.transitionPage('/profile', { tab: 'certificates' });
            } catch (err) {
              Utils.showToast(err.message || 'Upload failed.', 'error');
            }
          })()`
        }
      ]
    });
  },

  openEditPricingModal() {
    const pricing = Store.getState('pricing') || [];
    const types = [
      ['fixed', 'Fixed Price'],
      ['starting', 'Starting Price'],
      ['negotiable', 'Negotiable'],
      ['complexity', 'Depends on Complexity']
    ];
    Utils.showModal(`
      <p class="text-body-sm text-muted mb-4">Set each service fee. Leave a row's fee blank to hide that service from clients.</p>
      ${['Initial Consultation', 'Detailed Consultation', 'Document Review', 'Case Representation', 'Court Appearance'].map(service => {
        const existing = pricing.find(p => p.service === service);
        const units = { 'Initial Consultation': '30 min', 'Detailed Consultation': '60 min', 'Document Review': 'Per Document', 'Case Representation': 'Per Case', 'Court Appearance': 'Per Hearing' };
        return `
        <div class="pricing-edit-row" data-service="${service}">
          <div class="d-flex justify-between items-center mb-1">
            <strong>${service}</strong>
            <select class="form-select pricing-type" style="width:auto;padding:6px 10px;font-size:.8rem" aria-label="Pricing model for ${service}">
              ${types.map(([val, label]) => `<option value="${val}" ${(existing ? existing.type : 'fixed') === val ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <input type="number" class="form-input pricing-fee" min="0" max="1000000"
                 placeholder="Fee in ₹ (e.g. 1000)" value="${existing ? existing.fee : ''}"
                 data-unit="${units[service]}" aria-label="Fee for ${service}">
        </div>`;
      }).join('')}
    `, {
      title: 'Service Rate Card',
      size: 'md',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Save Rate Card',
          class: 'btn btn-primary',
          onclick: `(() => {
            const next = [];
            document.querySelectorAll('.pricing-edit-row').forEach(row => {
              const service = row.dataset.service;
              const feeRaw = row.querySelector('.pricing-fee').value;
              const type = row.querySelector('.pricing-type').value;
              if (feeRaw === '') return;
              const fee = parseInt(feeRaw, 10);
              if (isNaN(fee) || fee < 0) return;
              next.push({ id: 'price_' + service.replace(/\\W/g,'_'), service, fee, duration: row.querySelector('.pricing-fee').dataset.unit, type });
            });
            if (!next.length) { Utils.showToast('Keep at least one service with a fee.', 'warning'); return; }
            Store.setState('pricing', next);
            Utils.hideModal();
            Utils.showToast('Rate card updated across your public profile.', 'success');
            Router.transitionPage('/profile', { tab: 'pricing' });
          })()`
        }
      ]
    });
  },

  openDayEditor(day) {
    Utils.showModal(`
      <p class="text-body-sm text-muted mb-3">Add a consultation window for <strong>${day}</strong>.</p>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="slot-start">From</label>
          <input type="time" id="slot-start" class="form-input" value="10:00" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="slot-end">To</label>
          <input type="time" id="slot-end" class="form-input" value="13:00" required>
        </div>
      </div>
    `, {
      title: `Availability — ${day}`,
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Add Slot',
          class: 'btn btn-primary',
          onclick: `(() => {
            const start = document.getElementById('slot-start').value;
            const end = document.getElementById('slot-end').value;
            if (!start || !end || start >= end) { Utils.showToast('End time must be after start time.', 'warning'); return; }
            const key = '${day.toLowerCase()}';
            const availability = JSON.parse(JSON.stringify(Store.getState('availability') || {}));
            availability[key] = availability[key] || [];
            availability[key].push({ start, end });
            availability[key].sort((a,b) => a.start.localeCompare(b.start));
            Store.setState('availability', availability);
            Utils.hideModal();
            Utils.showToast('${day} slot added.', 'success');
            Router.transitionPage('/profile', { tab: 'availability' });
          })()`
        }
      ]
    });
  },

  setTab(tab) {
    this._activeTab = tab;
    Router.transitionPage('/profile', { tab });
  }
};
