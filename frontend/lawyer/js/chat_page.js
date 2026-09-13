/* ============================================================
   Nyay Setu — SECURE CLIENT CHAT
   chat_page.js — Threads, messaging, document sharing,
   counsel-only notes, case document drawer.
   ============================================================ */

const ChatPage = {
  _activeConvId: null,

  render(params = {}) {
    if (params && params.id) this._activeConvId = params.id;
    const convs = Store.getState('conversations') || [];
    const activeConv = convs.find(c => c.id === this._activeConvId) || convs[0];
    if (activeConv) this._activeConvId = activeConv.id;

    const contentHtml = `
      <div class="chat-container">
        <!-- Conversations list -->
        <div class="chat-conversations">
          <div class="chat-conv-header">
            <input type="search" class="chat-search-input" placeholder="Search conversations…" oninput="ChatPage.filterConv(this.value)" aria-label="Filter conversations">
          </div>
          <div class="chat-conv-list" id="chat-conv-list">
            ${this.renderConvList(convs, activeConv ? activeConv.id : null)}
          </div>
        </div>

        ${!activeConv ? `
          <div class="chat-main" style="display:flex;align-items:center;justify-content:center">
            ${Components.emptyState('forum', 'No conversations yet', 'Threads open automatically once you start consulting with clients.')}
          </div>
        ` : `
        <!-- Messages -->
        <div class="chat-main">
          <div class="chat-header">
            <div class="chat-header-user">
              <div class="avatar avatar-sm">${Utils.escapeHtml(activeConv.clientName.split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
              <div>
                <h3 class="chat-header-name">${Utils.escapeHtml(activeConv.clientName)}</h3>
                <div class="chat-header-status">
                  <span class="status-dot status-dot-online"></span> Case channel • ${Utils.escapeHtml(activeConv.category || 'Consultation')}
                </div>
              </div>
            </div>
            <div class="chat-header-actions">
              <a class="btn btn-secondary btn-sm" href="#/consultation">
                <span class="material-symbols-rounded">videocam</span> Consultation
              </a>
              <button class="btn-icon" onclick="ChatPage.toggleDocsDrawer()" title="Case documents" aria-label="Toggle case documents panel">
                <span class="material-symbols-rounded">folder_open</span>
              </button>
            </div>
          </div>

          <div class="chat-messages" id="chat-messages-container">
            ${(activeConv.messages || []).map(m => this.bubble(m)).join('')}
          </div>

          <form class="chat-input-area" onsubmit="ChatPage.handleSendMessage(event)">
            <input type="file" id="chat-attach-input" accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx" style="display:none" onchange="ChatPage.handleAttachFile(this)">
            <button type="button" class="btn-icon" onclick="document.getElementById('chat-attach-input').click()" title="Attach a document" aria-label="Attach document">
              <span class="material-symbols-rounded">attach_file</span>
            </button>
            <input type="text" id="chat-message-input" class="chat-input" placeholder="Write a message…" autocomplete="off" aria-label="Message">
            <button type="submit" class="btn btn-primary btn-pill" aria-label="Send message">
              <span class="material-symbols-rounded">send</span> Send
            </button>
          </form>
        </div>

        <!-- Documents drawer -->
        <div class="chat-doc-drawer hidden" id="chat-doc-drawer">
          <h4 class="card-title mb-4">Case Documents</h4>
          ${this.renderDrawerDocuments(activeConv)}
        </div>
        `}
      </div>
    `;

    return Components.AppLayout(contentHtml, 'chat', 'Client Chat', ['Chat']);
  },

  renderConvList(convs, activeId) {
    if (!convs.length) return '<p class="text-body-sm text-muted p-4">No active threads.</p>';
    return convs.map(c => `
      <div class="chat-conv-item ${c.id === activeId ? 'active' : ''}" data-search="${Utils.escapeHtml((c.clientName + ' ' + (c.category || '')).toLowerCase())}"
           onclick="Router.navigate('/chat/conv/${c.id}')" role="button" tabindex="0" aria-label="Conversation with ${Utils.escapeHtml(c.clientName)}">
        <div class="avatar avatar-sm">${Utils.escapeHtml(c.clientName.split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
        <div class="chat-conv-info">
          <div class="chat-conv-top">
            <span class="chat-conv-name">${Utils.escapeHtml(c.clientName)}</span>
            <span class="chat-conv-time">${Utils.timeAgo(c.lastMessageTime)}</span>
          </div>
          <div class="chat-conv-msg truncate">${Utils.escapeHtml(c.lastMessage || '')}</div>
        </div>
        ${c.unreadCount ? `<span class="badge badge-accent">${c.unreadCount}</span>` : ''}
      </div>
    `).join('');
  },

  bubble(m) {
    if (m.attachment) {
      return `
        <div class="message-group ${m.sender === 'lawyer' ? 'outgoing' : 'incoming'}">
          <div class="message-bubble message-bubble-file">
            <span class="material-symbols-rounded">description</span>
            <div>
              <div>${Utils.escapeHtml(m.text)}</div>
              <div style="font-size:.68rem;opacity:.7;margin-top:2px">${m.attachment.uploaded ? 'Uploaded to case vault' : 'Demo attachment'}${m.attachment.size ? ' • ' + m.attachment.size : ''}</div>
            </div>
          </div>
          <div class="message-time">${Utils.formatTime(m.time)}</div>
        </div>`;
    }
    return `
      <div class="message-group ${m.sender === 'lawyer' ? 'outgoing' : 'incoming'}">
        <div class="message-bubble">${Utils.escapeHtml(m.text)}</div>
        <div class="message-time">${Utils.formatTime(m.time)}</div>
      </div>`;
  },

  onEnter() {
    // Clear unread for the active thread
    const convs = Store.getState('conversations') || [];
    const conv = convs.find(c => c.id === this._activeConvId);
    if (conv && conv.unreadCount) {
      conv.unreadCount = 0;
      Store.setState('conversations', convs);
    }
    this.scrollToBottom();
  },

  scrollToBottom() {
    requestAnimationFrame(() => {
      const el = document.getElementById('chat-messages-container');
      if (el) el.scrollTop = el.scrollHeight;
    });
  },

  handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-message-input');
    const text = (input.value || '').trim();
    if (!text) return;

    const convs = Store.getState('conversations') || [];
    const conv = convs.find(c => c.id === this._activeConvId);
    if (conv) {
      conv.messages.push({ id: `m_${Date.now()}`, sender: 'lawyer', text, time: new Date().toISOString() });
      conv.lastMessage = text;
      conv.lastMessageTime = new Date().toISOString();
      Store.setState('conversations', convs);
    }

    input.value = '';
    Router.transitionPage('/chat/conv/' + this._activeConvId);
  },

  async handleAttachFile(inputEl) {
    const file = inputEl.files[0];
    inputEl.value = '';
    if (!file) return;
    try {
      Utils.showToast('Uploading to the secure vault…', 'info');
      const doc = await ApiClient.uploadDocument(file, 'case_document', `Shared in chat with ${this._activeConvId}`);
      const convs = Store.getState('conversations') || [];
      const conv = convs.find(c => c.id === this._activeConvId);
      if (conv) {
        conv.messages.push({
          id: `m_${Date.now()}`,
          sender: 'lawyer',
          text: doc.originalName,
          attachment: { uploaded: true, size: `${(doc.sizeBytes / 1024).toFixed(0)} KB`, docId: doc.id },
          time: new Date().toISOString()
        });
        conv.lastMessage = `📄 ${doc.originalName}`;
        conv.lastMessageTime = new Date().toISOString();
        Store.setState('conversations', convs);
      }
      Utils.showToast('Document shared and stored in the case vault.', 'success');
      Router.transitionPage('/chat/conv/' + this._activeConvId);
    } catch (err) {
      Utils.showToast(err.message || 'Upload failed.', 'error');
    }
  },

  renderDrawerDocuments(conv) {
    const cases = Store.getState('cases') || [];
    const linkedCase = cases.find(c => c.clientId === conv.clientId);
    const docs = (linkedCase && linkedCase.documents) || [];

    return `
      <div class="client-docs-list">
        ${docs.length === 0 ? '<p class="text-body-sm text-muted">No documents on this case file yet.</p>' : docs.map(doc => `
          <div class="client-doc-item">
            <span class="material-symbols-rounded text-accent">picture_as_pdf</span>
            <div class="client-doc-info">
              <div class="client-doc-name truncate">${Utils.escapeHtml(doc.name)}</div>
              <div class="client-doc-size">${Utils.escapeHtml(doc.type)} • ${Utils.escapeHtml(doc.size)}</div>
            </div>
            ${doc.docId ? `<a class="btn-icon btn-icon-sm" href="${ApiClient.documentDownloadUrl(doc.docId)}" target="_blank" rel="noopener" title="Download" aria-label="Download ${Utils.escapeHtml(doc.name)}"><span class="material-symbols-rounded">download</span></a>`
                        : `<button class="btn-icon btn-icon-sm" title="Demo dataset file" onclick="Utils.showToast('Sample document from the demo dataset.', 'info')"><span class="material-symbols-rounded">visibility</span></button>`}
          </div>
        `).join('')}
      </div>
      <button class="btn btn-secondary btn-sm btn-block mt-4" onclick="document.getElementById('chat-attach-input').click()">
        <span class="material-symbols-rounded">upload</span> Upload to Case Vault
      </button>
      ${linkedCase ? `<a class="btn btn-ghost btn-sm btn-block mt-2" href="#/cases/id/${linkedCase.id}">Open Case File</a>` : ''}
    `;
  },

  toggleDocsDrawer() {
    const drawer = document.getElementById('chat-doc-drawer');
    if (drawer) drawer.classList.toggle('hidden');
  },

  filterConv(query) {
    const q = (query || '').trim().toLowerCase();
    document.querySelectorAll('#chat-conv-list .chat-conv-item').forEach(item => {
      const match = !q || (item.dataset.search || '').includes(q);
      item.style.display = match ? '' : 'none';
    });
  }
};
