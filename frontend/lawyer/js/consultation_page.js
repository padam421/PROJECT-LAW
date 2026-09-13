/* ============================================================
   Nyay Setu — VIRTUAL CONSULTATION ROOM
   consultation_page.js — Session room with controls, in-call
   chat & exhibits panel, honest media status.
   ------------------------------------------------------------
   Media note: WebRTC video/audio is NOT connected in this
   build. Controls manage local state and the room is clearly
   labelled as a preview environment — no fake "encrypted call"
   claims.
   ============================================================ */

const ConsultationPage = {
  _isMicOn: true,
  _isCamOn: true,
  _activeSidebar: null,
  _timerSeconds: 0,
  _timerInterval: null,
  _sessionMessages: [],

  render() {
    // Pick the nearest upcoming appointment's client, else first accepted client
    const appts = Store.getUpcomingAppointments();
    const clients = Store.getState('clients') || [];
    const client = (appts[0] && clients.find(c => c.id === appts[0].clientId)) ||
                   clients.find(c => c.status === 'accepted') ||
                   { name: 'Demo Client', caseCategory: 'General Consultation' };

    const contentHtml = `
      <div class="consultation-container">
        <!-- Main stage -->
        <div class="consultation-main">
          <div class="video-stage">
            <div class="call-header-overlay">
              <span class="status-dot status-dot-online"></span>
              <span class="call-badge">Preview Room</span>
              <span class="call-timer" id="call-duration-timer">00:00</span>
            </div>

            <div class="remote-video-placeholder">
              <div class="remote-avatar">${Utils.escapeHtml((client.name || 'DC').split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
              <h3 class="remote-name">${Utils.escapeHtml(client.name)}</h3>
              <div class="remote-status">
                <span class="material-symbols-rounded icon-sm">mic</span> ${Utils.escapeHtml(client.caseCategory || '')}
              </div>
            </div>

            <div class="local-video-pip">
              <div class="local-pip-content">
                <div class="local-pip-avatar"><span class="material-symbols-rounded">person</span></div>
                <div class="local-pip-label">You (Advocate)</div>
              </div>
            </div>
          </div>

          <!-- In-call sidebar -->
          <div class="consultation-sidebar ${this._activeSidebar ? '' : 'hidden'}" id="call-sidebar">
            <div class="c-sidebar-header">
              <h4 id="c-sidebar-title">Session Chat</h4>
              <button class="btn-icon btn-icon-sm" onclick="ConsultationPage.toggleSidebar(null)" style="color:#fff" aria-label="Close panel">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
            <div class="c-sidebar-body" id="c-sidebar-content"></div>
          </div>
        </div>

        <!-- Media honesty notice -->
        <div class="ai-disclaimer mt-3">
          <span class="material-symbols-rounded icon-sm">info</span>
          <span>Video/audio transport is not connected in this environment — controls below manage your local device state and the session log. Chat and exhibit panels are fully functional.</span>
        </div>

        <!-- Controls -->
        <div class="consultation-controls">
          <button class="control-btn ${this._isMicOn ? '' : 'active-off'}" id="btn-toggle-mic" onclick="ConsultationPage.toggleMic()" title="${this._isMicOn ? 'Mute microphone' : 'Unmute microphone'}" aria-pressed="${this._isMicOn}">
            <span class="material-symbols-rounded">${this._isMicOn ? 'mic' : 'mic_off'}</span>
          </button>
          <button class="control-btn ${this._isCamOn ? '' : 'active-off'}" id="btn-toggle-cam" onclick="ConsultationPage.toggleCam()" title="${this._isCamOn ? 'Turn camera off' : 'Turn camera on'}" aria-pressed="${this._isCamOn}">
            <span class="material-symbols-rounded">${this._isCamOn ? 'videocam' : 'videocam_off'}</span>
          </button>
          <button class="control-btn" onclick="ConsultationPage.toggleScreenShare()" title="Screen share (not connected)">
            <span class="material-symbols-rounded">present_to_all</span>
          </button>
          <button class="control-btn" onclick="ConsultationPage.toggleSidebar('chat')" title="Session chat">
            <span class="material-symbols-rounded">chat</span>
          </button>
          <button class="control-btn" onclick="ConsultationPage.toggleSidebar('docs')" title="Case exhibits">
            <span class="material-symbols-rounded">description</span>
          </button>
          <button class="control-btn btn-end-call" onclick="ConsultationPage.endCall()" title="End consultation">
            <span class="material-symbols-rounded">call_end</span>
          </button>
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'consultation', 'Consultation Room', ['Consultation']);
  },

  onEnter() {
    this._timerSeconds = 0;
    clearInterval(this._timerInterval);
    this._sessionMessages = [];
    const timerEl = document.getElementById('call-duration-timer');
    this._timerInterval = setInterval(() => {
      this._timerSeconds++;
      if (!timerEl) return;
      const mins = String(Math.floor(this._timerSeconds / 60)).padStart(2, '0');
      const secs = String(this._timerSeconds % 60).padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  },

  onLeave() {
    clearInterval(this._timerInterval);
  },

  toggleMic() {
    this._isMicOn = !this._isMicOn;
    const btn = document.getElementById('btn-toggle-mic');
    if (btn) {
      btn.classList.toggle('active-off', !this._isMicOn);
      btn.querySelector('.material-symbols-rounded').textContent = this._isMicOn ? 'mic' : 'mic_off';
      btn.title = this._isMicOn ? 'Mute microphone' : 'Unmute microphone';
    }
    Utils.showToast(this._isMicOn ? 'Microphone on.' : 'Microphone muted.', 'info');
  },

  toggleCam() {
    this._isCamOn = !this._isCamOn;
    const btn = document.getElementById('btn-toggle-cam');
    if (btn) {
      btn.classList.toggle('active-off', !this._isCamOn);
      btn.querySelector('.material-symbols-rounded').textContent = this._isCamOn ? 'videocam' : 'videocam_off';
      btn.title = this._isCamOn ? 'Turn camera off' : 'Turn camera on';
    }
    Utils.showToast(this._isCamOn ? 'Camera state: on.' : 'Camera state: off.', 'info');
  },

  toggleScreenShare() {
    Utils.showToast('Screen sharing requires the WebRTC service, which is not connected yet.', 'warning');
  },

  toggleSidebar(type) {
    const sidebar = document.getElementById('call-sidebar');
    if (!type || (this._activeSidebar === type)) {
      this._activeSidebar = null;
      if (sidebar) sidebar.classList.add('hidden');
      return;
    }
    this._activeSidebar = type;
    if (sidebar) sidebar.classList.remove('hidden');

    if (type === 'chat') {
      document.getElementById('c-sidebar-title').textContent = 'Session Chat';
      this.renderChatPanel();
    } else if (type === 'docs') {
      document.getElementById('c-sidebar-title').textContent = 'Case Exhibits';
      this.renderDocsPanel();
    }
  },

  renderChatPanel() {
    const content = document.getElementById('c-sidebar-content');
    if (!content) return;
    content.innerHTML = `
      <div id="session-msgs" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;overflow-y:auto;flex:1">
        ${this._sessionMessages.length === 0 ? '<div style="color:rgba(255,255,255,.6);font-size:.8rem">In-call messages stay in this room only.</div>' :
          this._sessionMessages.map(m => `
            <div style="background:${m.sender === 'lawyer' ? 'rgba(13,148,136,.25)' : 'rgba(255,255,255,.08)'};padding:10px;border-radius:12px;color:#fff;font-size:.82rem">
              <strong>${m.sender === 'lawyer' ? 'You' : 'Client'}:</strong> ${Utils.escapeHtml(m.text)}
            </div>`).join('')}
      </div>
      <form onsubmit="ConsultationPage.sendSessionMessage(event)" style="display:flex;gap:8px">
        <input type="text" id="session-chat-input" class="form-input" placeholder="Type a message…" aria-label="Session chat message"
               style="background:rgba(255,255,255,.1);color:#fff;border-color:transparent">
        <button type="submit" class="btn btn-primary btn-sm">Send</button>
      </form>
    `;
    const box = document.getElementById('session-msgs');
    if (box) box.scrollTop = box.scrollHeight;
  },

  sendSessionMessage(e) {
    e.preventDefault();
    const input = document.getElementById('session-chat-input');
    const text = (input.value || '').trim();
    if (!text) return;
    this._sessionMessages.push({ sender: 'lawyer', text, time: Date.now() });
    input.value = '';
    // Simulated acknowledgement from the demo client so the exchange feels live
    setTimeout(() => {
      this._sessionMessages.push({ sender: 'client', text: '(preview) Noted, thank you.', time: Date.now() });
      if (this._activeSidebar === 'chat') this.renderChatPanel();
    }, 900);
    this.renderChatPanel();
  },

  renderDocsPanel() {
    const content = document.getElementById('c-sidebar-content');
    if (!content) return;
    const cases = Store.getState('cases') || [];
    const docs = (cases[0] && cases[0].documents) || [];
    content.innerHTML = docs.length ? `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${docs.slice(0, 6).map(d => `
          <div class="client-doc-item" style="background:rgba(255,255,255,.08);color:#fff">
            <span class="material-symbols-rounded text-accent">picture_as_pdf</span>
            <div class="flex-1 min-w-0">
              <div style="font-size:.82rem;color:#fff" class="truncate">${Utils.escapeHtml(d.name)}</div>
              <div style="font-size:.7rem;color:rgba(255,255,255,.55)">${Utils.escapeHtml(d.type)} • ${Utils.escapeHtml(d.size)}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="Utils.showToast('Exhibit sharing reaches the client screen once the media service is connected.', 'info')">Exhibit</button>
          </div>
        `).join('')}
      </div>
    ` : '<div style="color:rgba(255,255,255,.6);font-size:.82rem">No documents on the active case file.</div>';
  },

  async endCall() {
    const confirmed = await Utils.showConfirm('End Consultation', 'The session timer will stop and the appointment will be marked completed.', {
      confirmText: 'End Session',
      type: 'danger'
    });
    if (!confirmed) return;

    clearInterval(this._timerInterval);

    // Mark today's matching appointment completed + settle ledger entry
    const appts = Store.getState('appointments') || [];
    const txns = Store.getState('transactions') || [];
    const nowIso = new Date().toISOString();
    const activeAppt = [...appts].reverse().find(a => ['upcoming', 'confirmed'].includes(a.status));
    if (activeAppt) {
      activeAppt.status = 'completed';
      const txn = txns.find(t => t.clientName === activeAppt.clientName && t.paymentStatus === 'pending');
      if (txn) txn.paymentStatus = 'completed';
      Store.setState('appointments', appts);
      Store.setState('transactions', txns);
    }

    const notifs = Store.getState('notifications') || [];
    notifs.unshift({
      id: `notif_${Date.now()}`,
      type: 'appointment',
      title: 'Consultation Completed',
      message: `Session ended after ${Math.max(1, Math.round(this._timerSeconds / 60))} min. The appointment was marked completed.`,
      read: false, link: '/payments',
      time: nowIso
    });
    Store.setState('notifications', notifs);

    Utils.showToast('Consultation logged. Ledger updated.', 'success');
    Router.navigate('/dashboard');
  }
};
