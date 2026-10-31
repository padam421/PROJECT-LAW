/* Advocate-only NDPS case research. Citizen chat and simulation are independent. */
const AdvocateChatBot = {
  pending: new Set(), uploads: new Map(), files: [], _viewThread: null, _viewCount: 0,
  toggleConversations(close = null) {
    const layout = document.querySelector('.adv-workspace');
    if (!layout) return;
    const closed = close === null ? layout.classList.toggle('adv-conversations-hidden') : layout.classList.toggle('adv-conversations-hidden', close);
    document.getElementById('adv-conversations-toggle')?.setAttribute('aria-expanded', String(!closed));
  },
  e(value) { return Utils.escapeHtml(String(value ?? '')); },
  markdown(text) {
    const inline = s => this.e(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    return String(text || '').split(/\n\s*\n/).map(block => /^#{1,6}\s/.test(block)
      ? '<h3>' + inline(block.replace(/^#{1,6}\s+/, '')) + '</h3>'
      : '<p>' + block.split('\n').map(inline).join('<br>') + '</p>').join('');
  },
  _getMessages() { return AssistantThreads.active()?.messages || []; },
  sources(sources) {
    if (!sources?.length) return '';
    return '<details class="adv-sources"><summary>Read supporting sources (' + sources.length + ')</summary>' + sources.map(s =>
      '<article><strong>[' + this.e(s.id) + '] ' + this.e(s.title) + '</strong><small>' +
      this.e([s.year, s.citation, s.court, s.source_file].filter(Boolean).join(' · ')) + '</small>' +
      (s.kind === 'statute' ? '<p>Official text snapshot · retrieved ' + this.e(s.retrieved_at?.slice(0, 10)) + ' · document updated ' + this.e(s.document_last_update || 'unknown') + ' · later amendments require checking.</p>' :
        '<p>Indexed historical excerpt · ' + (s.metadata_complete ? 'later treatment requires checking.' : 'full case identity/citation requires checking.') + '</p>') +
      (s.url && (/^https:\/\/www\.indiacode\.nic\.in\//.test(s.url) || s.url === 'https://dor.gov.in/files/inline-documents/NDPS_1985.pdf') ? '<a href="' + this.e(s.url) + '" target="_blank" rel="noopener noreferrer">Open official source ↗</a>' : '') +
      '<blockquote dir="auto">' + this.e(s.excerpt || s.text) + '</blockquote></article>').join('') + '</details>';
  },
  _renderMessage(m) {
    const user = m.sender === 'user';
    return '<article class="adv-message ' + (user ? 'adv-message-user' : '') + '" id="msg-row-' + this.e(m.id) + '"><div class="adv-message-label">' +
      (user ? 'YOUR CASE RECORD' : m.error ? 'RESPONSE UNAVAILABLE' : m.validation?.mode === 'preparation_only' ? 'CASE PREPARATION · LEGAL VERIFICATION PENDING' : 'NYAY SETU · ADVOCATE RESEARCH') + '</div>' +
      (m.attachments?.length ? '<div class="adv-file-chips">' + m.attachments.map(f => '<span>📎 ' + this.e(f.name) + '</span>').join('') + '</div>' : '') +
      '<div class="adv-answer" dir="auto">' + this.markdown(m.text) + '</div>' + this.sources(m.sources) +
      (!user ? '<div class="adv-message-actions">' + (m.error ? '<button onclick="AdvocateChatBot.retry(\'' + m.id + '\')">Retry this question</button>' :
        '<button onclick="AdvocateChatBot.launchCourtSimulator(\'' + m.id + '\')">⚖ Rehearse this case</button><button onclick="AdvocateChatBot.retry(\'' + m.id + '\')">Deepen / recheck</button><button onclick="AdvocateChatBot.copy(\'' + m.id + '\')">Copy analysis</button>') + '</div>' : '') + '</article>';
  },
  _emptyChat() {
    return '<div class="adv-empty"><span class="adv-eyebrow">YOUR NDPS LITIGATION DESK</span><h2>Build the case.<br>Understand both sides.</h2><p>Describe the complete incident, add case papers, or use both. Research connects your facts with available provisions, historical decisions and the opposing case.</p><div class="adv-intake-grid"><div><b>01 · Case record</b><p>Incident date, state, alleged substance/weight, search, arrest, custody and current stage.</p></div><div><b>02 · Supporting papers</b><p>FIR, seizure memo, search record, FSL report, custody orders and charge sheet.</p></div><div><b>03 · Counsel preparation</b><p>State your side and relief. Get issue-wise submissions, adverse arguments and evidence tasks.</p></div></div><p class="adv-muted">NDPS research only at present. Sources have gaps; current amendments and later treatment are identified for checking.</p></div>';
  },
  sidebar() {
    const active = AssistantThreads.active(false);
    return '<button class="adv-primary" onclick="AdvocateChatBot.startNewChat()">＋ New case chat</button><h3>Case conversations</h3>' +
      AssistantThreads.list().map(t => '<div class="adv-thread ' + (t.id === active?.id ? 'active' : '') + '"><button onclick="AdvocateChatBot.selectConversation(\'' + t.id + '\')"><strong>' + this.e(t.title) + '</strong><small>' + t.messages.length + ' messages · ' + Object.keys(t.courtSessions || {}).length + ' rehearsals</small></button><button title="Export case" onclick="AssistantThreads.export(\'' + t.id + '\')">↓</button><button title="Delete chat, retain rehearsals" onclick="AdvocateChatBot.remove(\'' + t.id + '\')">×</button></div>').join('') +
      '<p class="adv-muted adv-storage-note">' + this.e(active?.conflict ? 'Save conflict — export your local copy.' : active?.dirty ? 'Saved on this device · account sync pending' : AssistantThreads._syncState === 'saved' ? 'Saved to your account' : 'Saved on this device') + '</p>';
  },
  render() {
    const t = AssistantThreads.active();
    return Components.AppLayout('<div class="adv-workspace"><aside class="adv-sidebar" id="adv-sidebar">' + this.sidebar() + '</aside><main class="adv-chat"><header class="adv-chat-header"><div class="adv-chat-heading"><button id="adv-conversations-toggle" type="button" aria-controls="adv-sidebar" aria-expanded="true" title="Show or hide case conversations" onclick="AdvocateChatBot.toggleConversations()"><span class="material-symbols-rounded" aria-hidden="true">view_sidebar</span><span>Chats</span></button><div><span class="adv-eyebrow">NDPS RESEARCH</span><h1>Case research & strategy</h1></div></div><button onclick="Router.navigate(\'/court\')">Hearing practice ↗</button></header><div id="chat-messages" class="adv-messages" aria-live="polite">' +
      (t.messages.length ? t.messages.map(m => this._renderMessage(m)).join('') : this._emptyChat()) + '</div><div id="adv-files" class="adv-file-chips"></div><form class="adv-composer" onsubmit="event.preventDefault();AdvocateChatBot.sendMessage()"><label class="adv-sr-only" for="chat-input">Case facts or follow-up question</label><textarea id="chat-input" rows="2" maxlength="60000" placeholder="Describe your NDPS case in detail, or ask a follow-up…" onkeydown="if(event.key===\'Enter\'&&(event.ctrlKey||event.metaKey)){event.preventDefault();AdvocateChatBot.sendMessage()}"></textarea><div class="adv-compose-tools"><input hidden multiple type="file" id="chat-file-input" accept=".pdf,.docx,.txt,.csv" onchange="AdvocateChatBot.handleFileAttach(event)"><button type="button" onclick="document.getElementById(\'chat-file-input\').click()">＋ Add case papers</button><span class="adv-language-note">Replies match your input language</span><button type="submit" class="adv-primary" id="chat-send-btn">Analyse case ↑</button></div><small>PDF / DOCX / TXT / CSV · up to 10 MB each · scanned documents need OCR · Ctrl + Enter to send</small></form></main></div>', 'ai-assistant', 'Advocate Research');
  },
  onEnter() {
    this.closeMobileConversations();
    this.refresh(); AssistantThreads.hydrate();
  },
  refresh() {
    const t = AssistantThreads.active(false), panel = document.getElementById('chat-messages');
    if (!panel || !t) return;
    const previousScroll = panel.scrollTop;
    const changedThread = this._viewThread !== t.id;
    const addedMessage = t.messages.length > this._viewCount;
    panel.innerHTML = t.messages.length ? t.messages.map(m => this._renderMessage(m)).join('') : this._emptyChat();
    if (this.pending.has(t.id)) panel.insertAdjacentHTML('beforeend', '<div class="adv-progress" role="status">Reading the case record, researching sources and checking the analysis…</div>');
    document.getElementById('adv-sidebar').innerHTML = this.sidebar();
    document.getElementById('chat-send-btn').disabled = this.pending.has(t.id) || !!this.uploads.get(t.id);
    this.renderFiles();
    if (changedThread || addedMessage) {
      const latest = t.messages.at(-1);
      const row = latest && document.getElementById('msg-row-' + latest.id);
      panel.scrollTop = row ? row.offsetTop : 0;
    } else panel.scrollTop = previousScroll;
    this._viewThread = t.id; this._viewCount = t.messages.length;
  },
  renderFiles() {
    const panel = document.getElementById('adv-files'); if (!panel) return;
    const id = AssistantThreads.active(false)?.id;
    panel.innerHTML = this.files.filter(f => f.threadId === id).map(f => '<span>📎 ' + this.e(f.name) + ' · ' + f.characters.toLocaleString() + ' chars <button title="Remove document" onclick="AdvocateChatBot.removeFile(\'' + f.id + '\')">×</button>' +
      (f.warnings?.length ? '<small>' + this.e(f.warnings.join(' ')) + '</small>' : '') + '</span>').join('') + (this.uploads.get(id) ? '<span role="status">Extracting document text…</span>' : '');
  },
  async handleFileAttach(event) {
    const selected = [...(event.target.files || [])], owner = AssistantThreads.owner(), t = AssistantThreads.active();
    if (this.uploads.get(t.id) || this.pending.has(t.id)) { AssistantThreads.notify('Wait for the current case request to finish.', 'info'); return; }
    this.uploads.set(t.id, true); this.refresh();
    try {
      for (const file of selected) {
        if (file.size > 10 * 1024 * 1024) throw Error(file.name + ' exceeds 10 MB.');
        const form = new FormData(); form.append('file', file);
        const response = await fetch(AuthManager.getApiUrl('/api/advocate/documents'), {method: 'POST', credentials: 'include', body: form, signal: AbortSignal.timeout(45000)});
        const result = await response.json(); if (!response.ok || !result.ok) throw Error(result.error || 'Document extraction failed.');
        if (AssistantThreads.owner() !== owner) return;
        this.files.push({...result.document, id: AssistantThreads.id('file'), threadId: t.id});
      }
    } catch (error) { if (AssistantThreads.owner() === owner) AssistantThreads.notify(error.message, 'error'); }
    finally { this.uploads.delete(t.id); event.target.value = ''; if (AssistantThreads.owner() === owner && AssistantThreads.active(false)?.id === t.id) this.refresh(); }
  },
  removeFile(id) { this.files = this.files.filter(f => f.id !== id); this.renderFiles(); },
  async sendMessage({retryMessage = null} = {}) {
    const t = AssistantThreads.active(), owner = AssistantThreads.owner(), input = document.getElementById('chat-input');
    if (this.pending.has(t.id) || this.uploads.get(t.id)) return;
    const files = this.files.filter(f => f.threadId === t.id), text = retryMessage?.text || input?.value?.trim() || (files.length ? 'Analyse the attached NDPS case papers in detail.' : '');
    if (!text) return;
    const context = retryMessage?.caseContext || files.map(f => 'DOCUMENT: ' + f.name + '\n' + f.text + (f.warnings?.length ? '\nEXTRACTION GAPS: ' + f.warnings.join(' ') : '')).join('\n\n');
    const lang = 'auto';
    const documentOnly = retryMessage ? !!retryMessage.documentOnly : !input?.value?.trim() && files.length > 0;
    const history = t.messages.filter(m => !m.error).map(m => ({sender: m.sender, text: m.text, caseContext: m.caseContext, documentOnly: !!m.documentOnly}));
    if (!retryMessage) {
      AssistantThreads.append(t.id, {id: AssistantThreads.id('msg'), sender: 'user', text, caseContext: context, documentOnly,
        attachments: files.map(f => ({name: f.name, characters: f.characters, warnings: f.warnings})), time: new Date().toISOString()});
      this.files = this.files.filter(f => f.threadId !== t.id); if (input) input.value = '';
    }
    AssistantThreads.change(t.id, t => { t.language = lang; }); this.pending.add(t.id); this.refresh();
    try {
      const result = await AssistantThreads.api('chat', {message: documentOnly ? '' : text, caseContext: context, chatHistory: history, language: lang, retry: !!retryMessage});
      if (AssistantThreads.owner() !== owner) return;
      AssistantThreads.append(t.id, {id: AssistantThreads.id('msg'), sender: 'ai', text: result.message, sources: result.sources, sections: result.sections,
        validation: result.validation, lang: result.detected_language?.detected_language_code || lang, time: new Date().toISOString()});
    } catch (error) {
      if (AssistantThreads.owner() === owner) AssistantThreads.append(t.id, {id: AssistantThreads.id('msg'), sender: 'ai', text: error.message, error: true, time: new Date().toISOString()});
    } finally { this.pending.delete(t.id); if (AssistantThreads.owner() === owner && AssistantThreads.active(false)?.id === t.id) this.refresh(); }
  },
  retry(id) {
    const t = AssistantThreads.active(), index = t.messages.findIndex(m => m.id === id);
    const user = t.messages.slice(0, index).reverse().find(m => m.sender === 'user');
    if (user) this.sendMessage({retryMessage: user});
  },
  closeMobileConversations() {
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches) this.toggleConversations(true);
  },
  startNewChat() { AssistantThreads.create(); this.refresh(); this.closeMobileConversations(); },
  selectConversation(id) { AssistantThreads.select(id); this.refresh(); this.closeMobileConversations(); },
  async remove(id) {
    if (this.pending.has(id) || this.uploads.get(id)) return;
    if (!confirm('Delete this case chat? Saved hearing rehearsals will remain available.')) return;
    await AssistantThreads.remove(id); AssistantThreads.active(); this.refresh();
  },
  async copy(id) { const m = this._getMessages().find(m => m.id === id); if (m) { try { await navigator.clipboard.writeText(m.text); AssistantThreads.notify('Analysis copied.', 'success'); } catch (_) { AssistantThreads.notify('Select the analysis text to copy it.', 'info'); } } },
  launchCourtSimulator(id) { AdvocateRehearsal.launch(id); }
};
