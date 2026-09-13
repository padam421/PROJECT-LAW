/* ============================================================
   Nyay Setu — CASE FILE MANAGEMENT
   cases_page.js — Case list, litigation pipeline, confidential
   notes, exhibits (real upload/download), case creation.
   ============================================================ */

const CasesPage = {
  _uploadingCaseId: null,

  render(params = {}) {
    if (params && params.id) return this.renderCaseDetail(params.id);

    const cases = Store.getState('cases') || [];
    const q = (params && params.q ? String(params.q) : '').toLowerCase();
    const visible = q
      ? cases.filter(c =>
          [c.caseNumber, c.clientName, c.caseType, c.court, c.status]
            .join(' ').toLowerCase().includes(q))
      : cases;

    const contentHtml = `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">Case Files</h2>
          <p class="page-subtitle">${q ? `Filtered by “${Utils.escapeHtml(params.q)}” — ${visible.length} match${visible.length === 1 ? '' : 'es'}` : 'Litigation pipeline, hearings & confidential counsel notes'}</p>
        </div>
        <button class="btn btn-primary" onclick="Router.navigate('/cases/new')">
          <span class="material-symbols-rounded">add</span> New Case File
        </button>
      </div>

      ${visible.length === 0 ? Components.emptyState(
        'folder_off',
        q ? 'No matching case files' : 'No case files yet',
        q ? 'Try a different client name or case number.' : 'Accept a consultation request or create a file manually.',
        q ? null : 'Create Case File',
        "Router.navigate('/cases/new')"
      ) : `
      <div class="cases-grid">
        ${visible.map(c => `
          <div class="case-card" onclick="Router.navigate('/cases/id/${c.id}')" role="link" tabindex="0"
               onkeydown="if(event.key==='Enter')Router.navigate('/cases/id/${c.id}')">
            <div class="case-card-header">
              <span class="case-number font-mono">${Utils.escapeHtml(c.caseNumber)}</span>
              <span class="badge ${this.statusBadgeClass(c.status)}">${Utils.escapeHtml(c.status)}</span>
            </div>

            <h3 class="case-client-name truncate">${Utils.escapeHtml(c.clientName)} — ${Utils.escapeHtml(c.caseType)}</h3>
            <div class="case-category-badge truncate">${Utils.escapeHtml(c.court || '')}</div>

            <div class="case-card-body">
              <div class="case-meta-row"><span class="material-symbols-rounded">calendar_month</span> Filed: ${Utils.formatDate(c.filingDate)}</div>
              ${c.nextHearing ? `<div class="case-meta-row"><span class="material-symbols-rounded">event</span> Next hearing: <strong>${Utils.escapeHtml(String(c.nextHearing))}</strong></div>` : ''}
              <div class="case-meta-row"><span class="material-symbols-rounded">lock</span> ${(c.notes || []).length} counsel note${(c.notes || []).length === 1 ? '' : 's'}</div>
            </div>

            <div class="case-card-footer">
              <span class="text-body-sm text-muted">${(c.documents || []).length} exhibit${(c.documents || []).length === 1 ? '' : 's'}</span>
              <button class="btn btn-ghost btn-sm" tabindex="-1">Open →</button>
            </div>
          </div>
        `).join('')}
      </div>`}
    `;

    return Components.AppLayout(contentHtml, 'cases', 'Case Management', ['Cases']);
  },

  renderCaseDetail(caseId) {
    const allCases = Store.getState('cases') || [];
    const caseItem = allCases.find(c => c.id === caseId) || allCases[0];
    if (!caseItem) {
      return Components.AppLayout(Components.emptyState('folder_off', 'Case not found', 'This case file may have been removed.', 'All Cases', "Router.navigate('/cases')"), 'cases', 'Case File', ['Cases']);
    }

    const statuses = ['New', 'Under Review', 'Consultation Completed', 'Documents Pending', 'Filed', 'Hearing Scheduled', 'Ongoing', 'Resolved', 'Closed'];
    const currentIdx = statuses.indexOf(caseItem.status);

    const contentHtml = `
      <div class="case-detail-hero">
        <div class="d-flex justify-between items-start mb-4 flex-wrap gap-3">
          <div class="min-w-0">
            <span class="case-number font-mono">${Utils.escapeHtml(caseItem.caseNumber)}</span>
            <h2 class="page-title mt-2 truncate">${Utils.escapeHtml(caseItem.clientName)} — ${Utils.escapeHtml(caseItem.caseType)}</h2>
            <div class="text-body-md text-muted">${Utils.escapeHtml(caseItem.court || '')} • Filed ${Utils.formatDate(caseItem.filingDate, 'long')}</div>
          </div>

          <div class="d-flex gap-3 flex-wrap">
            <a class="btn btn-secondary" href="#/cases"><span class="material-symbols-rounded">arrow_back</span> All Cases</a>
            <button class="btn btn-primary" onclick="CasesPage.handleStatusModal('${caseItem.id}')">Update Stage</button>
          </div>
        </div>

        <!-- Pipeline -->
        <h4 class="card-title mt-6 mb-3">Litigation Pipeline</h4>
        <div class="case-status-stepper">
          ${statuses.map((st, i) => `
            <div class="status-step ${i < currentIdx ? 'completed' : ''} ${i === currentIdx ? 'current' : ''}">
              ${i < statuses.length - 1 ? '<div class="status-step-connector"></div>' : ''}
              <div class="status-step-node">${i < currentIdx ? '✓' : i + 1}</div>
              <div class="status-step-label">${st}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Notes + Exhibits -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title d-flex items-center gap-2">
                <span class="material-symbols-rounded text-accent">lock</span> Counsel Notes
              </h3>
              <span class="private-note-badge mt-1">Private — never visible to the client</span>
            </div>
          </div>

          <div class="notes-container">
            <form onsubmit="CasesPage.handleAddNote(event, '${caseItem.id}')" class="mb-4">
              <div class="form-group">
                <label class="form-label" for="new-note-text">Add a private note</label>
                <textarea id="new-note-text" class="form-textarea" rows="3" placeholder="Strategy points, hearing prep, reminders…" required maxlength="2000"></textarea>
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Save Note</button>
            </form>

            ${(caseItem.notes || []).length === 0
              ? '<p class="text-body-sm text-muted">No notes yet.</p>'
              : caseItem.notes.map(n => `
                <div class="note-card private">
                  <div class="note-header">
                    <span class="private-note-badge">Counsel only</span>
                    <span class="note-date">${Utils.timeAgo(n.createdAt)}</span>
                  </div>
                  <div class="note-content">${Utils.escapeHtml(n.text)}</div>
                </div>
              `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Exhibits & Documents</h3>
            <input type="file" id="exhibit-input-${caseItem.id}" accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx" style="display:none" onchange="CasesPage.handleExhibitUpload('${caseItem.id}', this)">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('exhibit-input-${caseItem.id}').click()" ${this._uploadingCaseId === caseItem.id ? 'disabled' : ''}>
              ${this._uploadingCaseId === caseItem.id ? 'Uploading…' : '<span class="material-symbols-rounded icon-sm align-middle">upload</span> Add Exhibit'}
            </button>
          </div>

          <div class="client-docs-list">
            ${(caseItem.documents || []).length === 0 ? '<p class="text-body-sm text-muted">No exhibits yet.</p>' : caseItem.documents.map(doc => `
              <div class="client-doc-item">
                <span class="material-symbols-rounded client-doc-icon">picture_as_pdf</span>
                <div class="client-doc-info min-w-0">
                  <div class="client-doc-name truncate">${Utils.escapeHtml(doc.name)}</div>
                  <div class="client-doc-size">${Utils.escapeHtml(doc.type || 'Document')}${doc.size ? ' • ' + Utils.escapeHtml(doc.size) : ''}${doc.uploaded ? ' • uploaded' : ''}</div>
                </div>
                ${doc.docId
                  ? `<a class="btn-icon btn-icon-sm" href="${ApiClient.documentDownloadUrl(doc.docId)}" target="_blank" rel="noopener" title="Download"><span class="material-symbols-rounded">download</span></a>`
                  : `<button class="btn-icon btn-icon-sm" title="Demo dataset file" onclick="Utils.showToast('Sample document from the demo dataset — no binary stored.', 'info')"><span class="material-symbols-rounded">visibility</span></button>`}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'cases', 'Case File', ['Cases', caseItem.caseNumber]);
  },

  renderCreateCaseModal() {
    const clients = Store.getState('clients') || [];
    const acceptedClients = clients.filter(c => ['accepted', 'completed'].includes(c.status));

    const contentHtml = `
      <div class="card" style="max-width:680px;margin:0 auto">
        <div class="card-header">
          <h2 class="page-title">New Case File</h2>
          <a class="btn-icon" href="#/cases" aria-label="Close and go back to cases"><span class="material-symbols-rounded">close</span></a>
        </div>

        <form onsubmit="CasesPage.handleCreateSubmit(event)">
          <div class="form-group">
            <label class="form-label" for="newcase-client">Client <span class="required">*</span></label>
            <select id="newcase-client" class="form-select" required>
              ${acceptedClients.length
                ? acceptedClients.map(c => `<option value="${c.id}" data-name="${Utils.escapeHtml(c.name)}">${Utils.escapeHtml(c.name)}</option>`).join('')
                : '<option value="" data-name="">Walk-in / manual entry…</option>'}
            </select>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="newcase-type">Legal Category <span class="required">*</span></label>
              <select id="newcase-type" class="form-select" required>
                <option>Property Dispute</option><option>Criminal Defense</option><option>Corporate Litigation</option>
                <option>Cyber Crime</option><option>Family Law</option><option>Consumer Complaint</option><option>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="newcase-court">Court <span class="required">*</span></label>
              <select id="newcase-court" class="form-select" required>
                <option>Supreme Court of India</option><option>High Court of Delhi</option><option>District & Sessions Court</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="newcase-filing">Filing Date</label>
              <input type="date" id="newcase-filing" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label class="form-label" for="newcase-hearing">Next Hearing</label>
              <input type="date" id="newcase-hearing" class="form-input" min="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="newcase-desc">Initial Brief</label>
            <textarea id="newcase-desc" class="form-textarea" rows="3" placeholder="Summary of the matter…" maxlength="2000"></textarea>
          </div>

          <div class="d-flex justify-end gap-3 mt-6">
            <a class="btn btn-secondary" href="#/cases">Cancel</a>
            <button type="submit" class="btn btn-primary btn-lg">Create Case File</button>
          </div>
        </form>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'cases', 'New Case File', ['Cases', 'New']);
  },

  handleCreateSubmit(e) {
    e.preventDefault();
    const selectEl = document.getElementById('newcase-client');
    const chosenOption = selectEl.options[selectEl.selectedIndex];
    const clientId = chosenOption.value;
    const clientName = chosenOption.dataset.name || chosenOption.text;

    const cases = Store.getState('cases') || [];
    const newCase = {
      id: `case_${Date.now()}`,
      caseNumber: `LC/${new Date().getFullYear()}/${String(cases.length + 1).padStart(4, '0')}`,
      clientId: clientId || null,
      clientName,
      caseType: document.getElementById('newcase-type').value,
      legalCategory: document.getElementById('newcase-type').value,
      court: document.getElementById('newcase-court').value,
      filingDate: (document.getElementById('newcase-filing').value || new Date().toISOString()) ,
      status: 'New',
      nextHearing: document.getElementById('newcase-hearing').value,
      documents: [],
      notes: [{ id: `n_${Date.now()}`, text: 'Case file opened.', isPrivate: true, createdAt: new Date().toISOString() }],
      description: document.getElementById('newcase-desc').value,
      createdAt: new Date().toISOString()
    };

    // Validation: hearing must not precede filing
    if (newCase.nextHearing && new Date(newCase.nextHearing) < new Date(newCase.filingDate)) {
      Utils.showToast('Next hearing cannot be before the filing date.', 'warning');
      return;
    }

    cases.unshift(newCase);
    Store.setState('cases', cases);
    Utils.showToast(`Case ${newCase.caseNumber} created.`, 'success');
    Router.navigate('/cases/id/' + newCase.id);
  },

  async handleAddNote(e, caseId) {
    e.preventDefault();
    const input = document.getElementById('new-note-text');
    const text = (input.value || '').trim();
    if (!text) return;
    await ApiClient.addCaseNote(caseId, text);
    Utils.showToast('Confidential note saved.', 'success');
    Router.transitionPage('/cases/id/' + caseId);
  },

  async handleExhibitUpload(caseId, inputEl) {
    const file = inputEl.files[0];
    inputEl.value = '';
    if (!file) return;
    this._uploadingCaseId = caseId;
    try {
      Utils.showToast('Uploading exhibit…', 'info');
      const doc = await ApiClient.uploadDocument(file, 'case_document', `Exhibit for ${caseId}`);
      ApiClient.attachDocumentToCase(caseId, {
        name: doc.originalName,
        type: doc.category,
        size: `${(doc.sizeBytes / 1024).toFixed(0)} KB`,
        docId: doc.id,
        uploaded: true
      });
      Utils.showToast('Exhibit added to the case vault.', 'success');
    } catch (err) {
      Utils.showToast(err.message || 'Upload failed.', 'error');
    }
    this._uploadingCaseId = null;
    Router.transitionPage('/cases/id/' + caseId);
  },

  async handleStatusModal(caseId) {
    const statuses = ['New', 'Under Review', 'Consultation Completed', 'Documents Pending', 'Filed', 'Hearing Scheduled', 'Ongoing', 'Resolved', 'Closed'];
    const current = (Store.getState('cases') || []).find(c => c.id === caseId);
    Utils.showModal(`
      <div class="form-group">
        <label class="form-label" for="update-stage-select">Litigation stage</label>
        <select id="update-stage-select" class="form-select">
          ${statuses.map(s => `<option ${current && current.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span class="form-hint">Clients see an appropriate summary of stage changes; your private notes stay hidden.</span>
      </div>
    `, {
      title: 'Update Case Stage',
      actions: [
        { text: 'Cancel', class: 'btn btn-secondary', onclick: 'Utils.hideModal()' },
        {
          text: 'Update Stage',
          class: 'btn btn-primary',
          onclick: `(async () => {
            const val = document.getElementById('update-stage-select').value;
            await ApiClient.updateCaseStatus('${caseId}', val);
            Utils.hideModal();
            Utils.showToast('Stage updated to “' + val + '”.', 'success');
            Router.transitionPage('/cases/id/${caseId}');
          })()`
        }
      ]
    });
  },

  statusBadgeClass(status) {
    if (['Resolved', 'Closed'].includes(status)) return 'badge-success';
    if (['Hearing Scheduled', 'Ongoing', 'Filed'].includes(status)) return 'badge-accent';
    if (['Documents Pending', 'Under Review'].includes(status)) return 'badge-warning';
    return 'badge-neutral';
  }
};
