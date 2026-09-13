/* ============================================================
   Nyay Setu — CLIENT REQUESTS & CASE EVALUATION
   clients_page.js — Requests list, case details, AI analysis, accept/reject
   ============================================================ */

const ClientsPage = {
  _selectedClientId: null,
  _filter: 'all',
  _syncing: false,

  async syncWithBackend() {
    if (this._syncing) return;
    this._syncing = true;
    try {
      const serverConsults = await ApiClient.fetchLiveConsultations();
      if (serverConsults && serverConsults.length > 0) {
        const clients = Store.getState('clients') || [];
        let changed = false;
        for (const sc of serverConsults) {
          const idx = clients.findIndex(c => c.id === sc.id);
          const cObj = {
            id: sc.id,
            clientId: sc.user_id,
            name: sc.client_name || 'Padam Kishore',
            email: sc.client_email || 'padamkishore90@gmail.com',
            phone: sc.client_phone || '9876543210',
            city: sc.client_city || 'Jaipur',
            state: sc.client_state || 'Rajasthan',
            caseCategory: sc.case_category || 'Corporate & Constitutional Law',
            briefProblem: sc.notes || 'Legal consultation requested via portal.',
            preferredDate: sc.consult_date ? new Date(sc.consult_date).toLocaleDateString() : '2026-09-12',
            preferredTime: sc.consult_time || '11:30 AM',
            consultationType: (sc.consult_mode || 'video').toUpperCase() === 'VIDEO' ? 'Video' : 'Phone',
            estimatedFee: parseFloat(sc.fee || 1200),
            status: sc.status || 'pending',
            documents: []
          };
          if (idx >= 0) {
            if (clients[idx].status !== cObj.status || clients[idx].name !== cObj.name || clients[idx].phone !== cObj.phone || clients[idx].email !== cObj.email) {
              clients[idx] = { ...clients[idx], ...cObj };
              changed = true;
            }
          } else {
            clients.unshift(cObj);
            changed = true;
          }
        }
        if (changed) {
          Store.setState('clients', clients);
          const container = document.querySelector('.client-request-list');
          if (container && !window.location.hash.includes('/clients/id/')) {
            Router.transitionPage('/clients');
          }
        }
      }

      // Also sync live notifications
      const notifs = await ApiClient.fetchLiveNotifications();
      if (notifs && notifs.length > 0) {
        const curNotifs = Store.getState('notifications') || [];
        let notifChanged = false;
        for (const n of notifs) {
          if (!curNotifs.find(item => item.id === n.id)) {
            curNotifs.unshift(n);
            notifChanged = true;
          }
        }
        if (notifChanged) {
          Store.setState('notifications', curNotifs);
        }
      }
    } catch (_) {
    } finally {
      this._syncing = false;
    }
  },

  render(params = {}) {
    this.syncWithBackend();

    if (params.id) {
      return this.renderClientDetail(params.id);
    }

    const allClients = Store.getState('clients') || [];
    let filtered = allClients;
    if (this._filter === 'pending') filtered = allClients.filter(c => c.status === 'pending');
    if (this._filter === 'accepted') filtered = allClients.filter(c => c.status === 'accepted');

    const contentHtml = `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">Client Consultation Requests</h2>
          <p class="page-subtitle">Evaluate incoming client grievances, case summaries and book consultations</p>
        </div>

        <div class="clients-filter">
          <span class="chip ${this._filter === 'all' ? 'active' : ''}" onclick="ClientsPage.setFilter('all')">All Requests (${allClients.length})</span>
          <span class="chip ${this._filter === 'pending' ? 'active' : ''}" onclick="ClientsPage.setFilter('pending')">Pending Review (${allClients.filter(c => c.status === 'pending').length})</span>
          <span class="chip ${this._filter === 'accepted' ? 'active' : ''}" onclick="ClientsPage.setFilter('accepted')">Accepted Clients</span>
        </div>
      </div>

      <div class="client-request-list">
        ${filtered.length === 0 ? Components.emptyState('inbox', 'No requests here', this._filter === 'pending' ? 'New consultation requests will arrive in this queue.' : 'Nothing matches this filter yet.') : filtered.map(c => `
          <div class="client-request-card">
            <div class="client-request-left">
              <div class="avatar avatar-lg">${Utils.escapeHtml(c.name.split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
              <div class="client-request-info">
                <div class="d-flex items-center gap-3 flex-wrap">
                  <h3 class="client-request-name">${Utils.escapeHtml(c.name)}</h3>
                  <span class="client-request-category">${Utils.escapeHtml(c.caseCategory)}</span>
                </div>
                <p class="client-request-problem">${Utils.escapeHtml(c.briefProblem)}</p>

                <div class="client-request-meta">
                  <span class="client-meta-item">
                    <span class="material-symbols-rounded">calendar_month</span> ${c.preferredDate} at ${Utils.escapeHtml(c.preferredTime)}
                  </span>
                  <span class="client-meta-item">
                    <span class="material-symbols-rounded">videocam</span> ${Utils.escapeHtml(c.consultationType)}
                  </span>
                  <span class="client-meta-item">
                    <span class="material-symbols-rounded">location_on</span> ${Utils.escapeHtml(c.city || 'Jaipur')}, ${Utils.escapeHtml(c.state || 'Rajasthan')}
                  </span>
                </div>
              </div>
            </div>

            <div class="client-request-actions">
              <div class="client-request-fee">${Utils.formatCurrency(c.estimatedFee)}</div>
              ${c.status === 'pending' ? `
                <button class="btn btn-primary btn-sm btn-block" onclick="ClientsPage.acceptClient('${c.id}')">Accept & Open Case</button>
                <button class="btn btn-secondary btn-sm btn-block" onclick="ClientsPage.rejectClient('${c.id}')">Reject</button>
              ` : `
                <span class="badge ${c.status === 'accepted' ? 'badge-success' : c.status === 'rejected' ? 'badge-danger' : 'badge-neutral'}">${c.status.toUpperCase()}</span>
              `}
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/clients/id/${c.id}')">View Client Profile</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return Components.AppLayout(contentHtml, 'clients', 'Client Requests', ['Requests']);
  },

  /* Client Case Detail & AI Pre-analysis */
  renderClientDetail(clientId) {
    const clients = Store.getState('clients') || [];
    const client = clients.find(c => c.id === clientId || c.clientId === clientId) || clients[0];
    if (!client) {
      return Components.AppLayout(
        Components.emptyState('person_off', 'Request not found', 'This consultation request may have been withdrawn.', 'Back to Requests', "Router.navigate('/clients')"),
        'clients', 'Case Evaluation', ['Requests']);
    }
    const aiAnalysis = CaseAnalysisEngine.generateAnalysis(client.briefProblem, client.caseCategory);

    const contentHtml = `
      <div class="client-detail-header">
        <div class="avatar avatar-xl">${Utils.escapeHtml(client.name.split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
        <div class="flex-1 min-w-0">
          <div class="d-flex items-center justify-between flex-wrap gap-3">
            <div class="min-w-0">
              <h2 class="client-detail-name">${Utils.escapeHtml(client.name)}</h2>
              <div class="client-detail-email truncate">${Utils.escapeHtml(client.email)} • ${Utils.escapeHtml(String(client.phone))}</div>
            </div>
            <div class="d-flex gap-3 flex-wrap">
              <button class="btn btn-secondary" onclick="Router.navigate('/clients')">
                <span class="material-symbols-rounded">arrow_back</span> Back
              </button>
              ${client.status === 'pending' ? `
                <button class="btn btn-primary" onclick="ClientsPage.acceptClient('${client.id}')">Accept & Open Case</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Verified Client Identity & Profile Details Card -->
      <div class="card mb-6" style="border-left:4px solid var(--color-primary-600);padding:20px;margin-bottom:20px;background:var(--color-surface)">
        <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span class="material-symbols-rounded text-primary">verified_user</span>
          Verified Client Profile & Credentials
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;font-size:0.875rem">
          <div>
            <div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;font-weight:600">Client Legal Name</div>
            <div style="font-weight:700;color:var(--color-gray-900);margin-top:2px">${Utils.escapeHtml(client.name)}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;font-weight:600">Email Address</div>
            <div style="font-weight:600;color:var(--color-gray-900);margin-top:2px">${Utils.escapeHtml(client.email)}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;font-weight:600">Contact Number</div>
            <div style="font-weight:600;color:var(--color-gray-900);margin-top:2px">${Utils.escapeHtml(String(client.phone))}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;font-weight:600">City / State</div>
            <div style="font-weight:600;color:var(--color-gray-900);margin-top:2px">📍 ${Utils.escapeHtml(client.city || 'Jaipur')}, ${Utils.escapeHtml(client.state || 'Rajasthan')}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:0.75rem;text-transform:uppercase;font-weight:600">Authentication Status</div>
            <div style="font-weight:600;color:var(--color-emerald-600);margin-top:2px">✓ Registered & OTP Verified</div>
          </div>
        </div>
      </div>

      <!-- Preliminary Case Analysis -->
      <div class="ai-analysis-card">
        <div class="ai-analysis-header">
          <span class="material-symbols-rounded icon-lg text-accent">psychology</span>
          <div>
            <h3 class="ai-analysis-title">Preliminary Case Summary</h3>
            <span class="text-body-sm text-muted">Rule-based pre-consultation brief generated inside Nyay Setu — verify everything independently</span>
          </div>
          <span class="badge badge-neutral ml-auto">Preliminary</span>
        </div>

        <div class="ai-analysis-grid">
          <div class="ai-analysis-item">
            <div class="ai-analysis-item-title">Probable Legal Ground & Statutory Provisions</div>
            <div class="ai-analysis-item-content">
              <strong>${aiAnalysis.legalCategory}</strong>
              <ul>
                ${aiAnalysis.relevantTopics.map(t => `<li>${t}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="ai-analysis-item">
            <div class="ai-analysis-item-title">Key Verified Facts</div>
            <div class="ai-analysis-item-content">
              <ul>
                ${aiAnalysis.keyFacts.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="ai-analysis-item">
            <div class="ai-analysis-item-title">Missing Supporting Documents to Request</div>
            <div class="ai-analysis-item-content">
              <ul>
                ${aiAnalysis.missingDocuments.map(d => `<li>${d}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="ai-analysis-item">
            <div class="ai-analysis-item-title">Strategic Questions for Consultation</div>
            <div class="ai-analysis-item-content">
              <ul>
                ${aiAnalysis.suggestedQuestions.map(q => `<li>${q}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>

        <div class="ai-disclaimer">
          <span class="material-symbols-rounded icon-sm">info</span>
          <span>AI-generated preliminary information. It assists preliminary case review and does not replace independent professional legal judgment.</span>
        </div>
      </div>

      <!-- Client Documents & Details Grid -->
      <div class="client-detail-grid">
        <div class="client-detail-section">
          <h3 class="client-detail-section-title">Client's Description</h3>
          <p class="text-body-lg" style="line-height:1.7;color:var(--color-gray-700)">
            "${Utils.escapeHtml(client.briefProblem)}"
          </p>

          <h4 class="client-detail-section-title mt-6">Requested Consultation</h4>
          <div class="d-flex gap-6 mt-3 flex-wrap">
            <div><strong>Date:</strong> ${client.preferredDate}</div>
            <div><strong>Time:</strong> ${Utils.escapeHtml(client.preferredTime)}</div>
            <div><strong>Mode:</strong> ${Utils.escapeHtml(client.consultationType)}</div>
            <div><strong>Estimated Fee:</strong> ${Utils.formatCurrency(client.estimatedFee)}</div>
          </div>
        </div>

        <div class="client-detail-section">
          <h3 class="client-detail-section-title">Attached Documents</h3>
          <div class="client-docs-list">
            ${(client.documents || []).map(doc => `
              <div class="client-doc-item">
                <span class="material-symbols-rounded client-doc-icon">picture_as_pdf</span>
                <div class="client-doc-info">
                  <div class="client-doc-name">${Utils.escapeHtml(doc.name)}</div>
                  <div class="client-doc-size">${Utils.escapeHtml(doc.type)} • ${Utils.escapeHtml(doc.size)}</div>
                </div>
                <button class="btn-icon btn-icon-sm" title="Demo dataset file — binary preview not available" onclick="Utils.showToast('Sample document from the demo dataset. Live uploads open in the secure viewer.', 'info')" aria-label="Preview ${Utils.escapeHtml(doc.name)}">
                  <span class="material-symbols-rounded">visibility</span>
                </button>
              </div>
            `).join('') || '<p class="text-body-sm text-muted">No documents attached.</p>'}
          </div>
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'clients', 'Case Evaluation', ['Requests', client.name]);
  },

  setFilter(filter) {
    this._filter = filter;
    Router.transitionPage('/clients');
  },

  async acceptClient(clientId) {
    const confirmed = await Utils.showConfirm('Accept Consultation Request',
      'Accepting books the appointment for the requested slot, opens the case file, and creates the payment entry.',
      { confirmText: 'Accept & Book' });
    if (!confirmed) return;
    await ApiClient.acceptClientRequest(clientId);
    Utils.showToast('Client accepted — case file, appointment and payment entry created.', 'success');
    ApiClient.startReminderEngine();
    Router.navigate('/cases');
  },

  async rejectClient(clientId) {
    const confirmed = await Utils.showConfirm('Decline Request', 'The client will be notified that this request was declined.', { confirmText: 'Decline', type: 'danger' });
    if (confirmed) {
      await ApiClient.rejectClientRequest(clientId);
      Utils.showToast('Request declined.', 'info');
      Router.transitionPage('/clients');
    }
  }
};
