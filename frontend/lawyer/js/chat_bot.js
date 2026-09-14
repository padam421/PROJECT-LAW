/* ============================================================
   Nyay Setu ADVOCATE — AI LEGAL RESEARCH & DRAFTING ASSISTANT
   chat_bot.js — IPC/BNS sections lookup, Supreme Court precedents,
   legal drafting arguments, case dossier summaries for lawyers
   ============================================================ */

const AdvocateChatBot = {
  _messages: [
    {
      id: 'msg_init',
      sender: 'ai',
      text: 'Good day, Counsel. I am your Nyay Setu AI Research Assistant. I can assist you with case law precedents, IPC to BNS section translations, draft rejoinders, or summarize complex case briefs. What legal issue are you handling today?',
      time: new Date(Date.now() - 60000).toISOString()
    }
  ],

  render() {
    const lawyer = Store.getState('lawyerProfile') || AuthManager.getSession() || {};

    const contentHtml = `
      <div style="max-width:1100px;margin:0 auto;height:calc(100vh - 120px);display:flex;flex-direction:column">
        <!-- Header -->
        <div class="card mb-4" style="padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:var(--surface-primary);border:1px solid var(--color-gray-200);box-shadow:var(--shadow-sm)">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#0d9488,#0f766e);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 14px rgba(13,148,136,0.25)">
              <span class="material-symbols-rounded">auto_awesome</span>
            </div>
            <div>
              <div style="font-weight:800;color:var(--color-primary);font-size:1.15rem;display:flex;align-items:center;gap:8px">
                AI Legal Research &amp; Drafting Assistant
                <span style="font-size:0.7rem;background:rgba(16,185,129,0.12);color:#059669;padding:2px 8px;border-radius:999px;font-weight:700">ONLINE</span>
              </div>
              <div style="font-size:0.8rem;color:var(--color-gray-600)">Indian Penal Code, BNS 2023, CPC &amp; Supreme Court Case Citations</div>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="AdvocateChatBot.clearHistory()">
              <span class="material-symbols-rounded icon-sm">delete</span> Clear Chat
            </button>
            <button class="btn btn-primary btn-sm" onclick="Router.navigate('/court')">
              <span class="material-symbols-rounded icon-sm">gavel</span> Test in Virtual Court
            </button>
          </div>
        </div>

        <!-- Chat Container -->
        <div class="card" style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0;background:var(--surface-primary);border:1px solid var(--color-gray-200);box-shadow:var(--shadow-sm)">
          <!-- Messages Scroll Area -->
          <div id="adv-chat-messages" style="flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px;background:var(--surface-primary)">
            ${this._messages.map(m => this._renderMessage(m)).join('')}
          </div>

          <!-- Quick Legal Questions Prompts -->
          <div style="padding:10px 20px;background:var(--surface-secondary);border-top:1px solid var(--color-gray-200);display:flex;gap:8px;overflow-x:auto;white-space:nowrap">
            <span class="badge badge-neutral" style="cursor:pointer;padding:6px 12px;font-size:0.78rem" onclick="AdvocateChatBot.sendQuickPrompt('BNS equivalent of IPC Section 420 (Cheating)?')">
              📖 IPC 420 in BNS 2023
            </span>
            <span class="badge badge-neutral" style="cursor:pointer;padding:6px 12px;font-size:0.78rem" onclick="AdvocateChatBot.sendQuickPrompt('Supreme Court landmark precedents on Anticipatory Bail under Section 438 CrPC')">
              ⚖️ Bail Precedents
            </span>
            <span class="badge badge-neutral" style="cursor:pointer;padding:6px 12px;font-size:0.78rem" onclick="AdvocateChatBot.sendQuickPrompt('Draft key legal arguments for interim injunction under Order 39 Rule 1 and 2 CPC')">
              📝 Order 39 Injunction Draft
            </span>
            <span class="badge badge-neutral" style="cursor:pointer;padding:6px 12px;font-size:0.78rem" onclick="AdvocateChatBot.sendQuickPrompt('Summarize essential ingredients for quashing FIR under Section 482 CrPC')">
              🛡️ Quash FIR Section 482
            </span>
          </div>

          <!-- Attachment & Voice Status Container -->
          <div id="adv-chat-status-container" style="padding: 0 20px;"></div>

          <!-- Input Bar -->
          <div style="padding:16px 20px;background:var(--surface-primary);border-top:1px solid var(--color-gray-200);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input type="file" id="adv-chat-file-input" style="display:none" accept=".pdf,.doc,.docx,.txt,.csv,image/*" onchange="AdvocateChatBot.handleFileAttach(event)">
            <select class="form-input" id="adv-chat-lang-select" title="Select Query & Speech Language (22 Indian Languages)"
                    style="width:auto;min-width:140px;padding:7px 10px;font-size:0.8rem;background:var(--surface-secondary);border:1px solid var(--color-gray-300);color:var(--color-gray-900);border-radius:8px;font-weight:600;cursor:pointer"
                    onchange="AdvocateChatBot.handleLanguageChange(event)">
              <option value="auto" selected>🌐 Auto (स्वचालित)</option>
              <option value="hi">🇮🇳 हिन्दी (Hindi)</option>
              <option value="mr">🇮🇳 मराठी (Marathi)</option>
              <option value="gu">🇮🇳 ગુજરાતી (Gujarati)</option>
              <option value="bn">🇮🇳 বাংলা (Bengali)</option>
              <option value="ta">🇮🇳 தமிழ் (Tamil)</option>
              <option value="te">🇮🇳 తెలుగు (Telugu)</option>
              <option value="kn">🇮🇳 ಕನ್ನಡ (Kannada)</option>
              <option value="ml">🇮🇳 മലയാളം (Malayalam)</option>
              <option value="pa">🇮🇳 ਪੰਜਾਬੀ (Punjabi)</option>
              <option value="ur">🇮🇳 اردو (Urdu)</option>
              <option value="or">🇮🇳 ଓଡ଼ିଆ (Odia)</option>
              <option value="as">🇮🇳 অসমীয়া (Assamese)</option>
              <option value="ne">🇮🇳 नेपाली (Nepali)</option>
              <option value="sa">🇮🇳 संस्कृतम् (Sanskrit)</option>
              <option value="en">🌐 English (India)</option>
            </select>
            <button class="btn btn-secondary" id="adv-chat-attach-btn" title="Attach case file / FIR (PDF, Doc, Image)" onclick="document.getElementById('adv-chat-file-input').click()" style="padding:9px 12px;display:flex;align-items:center;justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px">attach_file</span>
            </button>
            <button class="btn btn-secondary" id="adv-chat-mic-btn" title="Voice Input (Speech to Text in selected language)" onclick="AdvocateChatBot.toggleVoiceRecording()" style="padding:9px 12px;display:flex;align-items:center;justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px">mic</span>
            </button>
            <input type="text" id="adv-chat-input" class="form-input" placeholder="Ask legal question, speak case facts, or attach petition draft..."
                   style="flex:1;min-width:200px;background:var(--surface-secondary);border:1px solid var(--color-gray-300);color:var(--color-gray-900)"
                   onkeydown="if(event.key==='Enter') AdvocateChatBot.sendMessage()">
            <button class="btn btn-primary" onclick="AdvocateChatBot.sendMessage()" style="padding:10px 20px">
              <span class="material-symbols-rounded">send</span> Send
            </button>
          </div>
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'ai-assistant');
  },

  _renderMessage(m) {
    const isAi = m.sender === 'ai';
    const msgId = m.id || ('adv_msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    m.id = msgId;

    const attachmentHtml = m.attachment ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(0,0,0,0.06);border-radius:6px;margin-bottom:8px;font-size:0.8rem;border:1px solid rgba(0,0,0,0.1)">
        <span class="material-symbols-rounded" style="font-size:16px">attach_file</span>
        <span>${Utils.escapeHtml(m.attachment.name)}</span>
        <span style="opacity:0.85">(${m.attachment.sizeStr})</span>
      </div><br>
    ` : '';

    const isPlaying = (typeof NyaySetuTTS !== 'undefined') && NyaySetuTTS.isSpeaking(msgId);

    const ttsActionHtml = isAi ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-secondary btn-sm ${isPlaying ? 'playing' : ''}" id="adv-tts-btn-${msgId}"
                onclick="AdvocateChatBot.toggleSpeak('${msgId}')"
                style="border-radius:999px;padding:4px 12px;font-size:0.75rem;font-weight:600;display:inline-flex;align-items:center;gap:5px;${isPlaying ? 'background:#fef2f2;border-color:#fca5a5;color:#dc2626;' : 'background:#f0fdf4;border-color:#bbf7d0;color:#166534;'}"
                title="${isPlaying ? 'Stop Audio Readout' : 'Listen to response'}">
          <span class="material-symbols-rounded" id="adv-tts-icon-${msgId}" style="font-size:15px">${isPlaying ? 'stop_circle' : 'volume_up'}</span>
          <span id="adv-tts-label-${msgId}">${isPlaying ? 'रोकें (Stop)' : 'बोलकर सुनें (Listen)'}</span>
        </button>
      </div>
    ` : '';

    return `
      <div style="display:flex;gap:12px;align-items:flex-start;max-width:88%;${isAi ? '' : 'align-self:flex-end;flex-direction:row-reverse'}" id="adv-row-${msgId}">
        <div style="width:34px;height:34px;border-radius:10px;background:${isAi ? 'linear-gradient(135deg,#0d9488,#0f766e)' : 'linear-gradient(135deg,#1a2744,#243b6a)'};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">
          <span class="material-symbols-rounded" style="font-size:18px">${isAi ? 'auto_awesome' : 'person'}</span>
        </div>
        <div style="background:${isAi ? 'var(--surface-secondary)' : '#1a2744'};border:1px solid ${isAi ? 'var(--color-gray-200)' : 'transparent'};border-radius:14px;padding:14px 18px;color:${isAi ? 'var(--color-gray-800)' : '#ffffff'};font-size:0.92rem;line-height:1.6;width:100%">
          ${attachmentHtml}${this._formatAdvocateText(m.text)}
          ${ttsActionHtml}
          <div style="font-size:0.72rem;color:${isAi ? 'var(--color-gray-500)' : 'rgba(255,255,255,0.7)'};margin-top:8px;text-align:${isAi ? 'left' : 'right'}">
            ${Utils.timeAgo(m.time)}
          </div>
        </div>
      </div>
    `;
  },

  _formatAdvocateText(text) {
    if (!text) return '';
    let escaped = Utils.escapeHtml(text);

    // Markdown Headings
    escaped = escaped.replace(/^### (.*$)/gim, '<div style="font-size:1.02rem;font-weight:700;color:var(--color-primary-dark, #0d9488);margin:14px 0 6px 0;padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;gap:6px;">$1</div>');
    escaped = escaped.replace(/^## (.*$)/gim, '<div style="font-size:1.1rem;font-weight:700;color:var(--color-gray-900);margin:16px 0 8px 0;">$1</div>');

    // Bold and Italics
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--color-gray-900);font-weight:600;">$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Horizontal divider
    escaped = escaped.replace(/^---$/gim, '<hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:12px 0;">');

    // Role highlight badges for Courtroom Simulation
    escaped = escaped.replace(/(🛡️|⚖️|🏛️)\s*(.*?):/g, '<div style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;background:rgba(13,148,136,0.08);border-radius:6px;margin:8px 0 4px 0;font-size:0.85rem;font-weight:600;color:#0f766e;border:1px solid rgba(13,148,136,0.2);">$1 <span>$2:</span></div>');

    // Line breaks and list bullets
    return escaped
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/•/g, '<span style="color:#0d9488">•</span>');
  },

  sendQuickPrompt(text) {
    const input = document.getElementById('adv-chat-input');
    if (input) {
      input.value = text;
      this.sendMessage();
    }
  },

  _recognition: null,
  _isRecording: false,
  _attachedFile: null,
  _selectedLanguage: 'auto',

  handleLanguageChange(event) {
    this._selectedLanguage = event.target?.value || 'auto';
    if (this._recognition && this._isRecording) {
      this._recognition.lang = this._getSpeechLangCode(this._selectedLanguage);
    }
  },

  _getSpeechLangCode(lang) {
    const map = {
      'auto': 'hi-IN',
      'hi': 'hi-IN',
      'mr': 'mr-IN',
      'gu': 'gu-IN',
      'bn': 'bn-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'pa': 'pa-IN',
      'ur': 'ur-IN',
      'or': 'or-IN',
      'as': 'as-IN',
      'ne': 'ne-NP',
      'sa': 'sa-IN',
      'en': 'en-IN'
    };
    return map[lang] || 'hi-IN';
  },

  toggleVoiceRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast('Speech recognition is not supported in this browser. Please use Chrome or Edge.', 'warning');
      } else {
        alert('Speech recognition is not supported in your browser. Please use Google Chrome or Microsoft Edge.');
      }
      return;
    }

    if (this._isRecording) {
      this.stopVoiceRecording();
      return;
    }

    this.startVoiceRecording();
  },

  startVoiceRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      this._recognition = new SpeechRecognition();
      this._recognition.continuous = true;
      this._recognition.interimResults = true;
      const selectedLang = document.getElementById('adv-chat-lang-select')?.value || this._selectedLanguage || 'auto';
      this._recognition.lang = this._getSpeechLangCode(selectedLang);

      const input = document.getElementById('adv-chat-input');
      const micBtn = document.getElementById('adv-chat-mic-btn');
      const statusContainer = document.getElementById('adv-chat-status-container');
      const initialText = input ? input.value : '';

      this._recognition.onstart = () => {
        this._isRecording = true;
        if (micBtn) {
          micBtn.style.background = '#fee2e2';
          micBtn.style.borderColor = '#fca5a5';
          micBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:20px;color:#ef4444">mic</span>';
          micBtn.title = 'Recording live... Click to stop';
        }
        if (statusContainer) {
          statusContainer.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:8px;font-size:0.82rem;color:#b91c1c;">
              <span class="material-symbols-rounded" style="font-size:18px;color:#ef4444">mic</span>
              <span style="flex:1">🎙️ <strong>Listening live (Advocate Voice Mode)...</strong> Speak case brief or statutory query. Click Stop when done.</span>
              <button type="button" onclick="AdvocateChatBot.stopVoiceRecording()" style="background:none;border:none;color:#b91c1c;cursor:pointer;font-weight:700;font-size:0.8rem;text-decoration:underline">
                Stop Recording
              </button>
            </div>
          `;
        }
      };

      this._recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (input && transcript.trim()) {
          input.value = initialText ? `${initialText.trim()} ${transcript}` : transcript;
        }
      };

      this._recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          if (window.Utils) window.Utils.showToast('Microphone access blocked. Kripya browser mein microphone allow karein.', 'warning');
        }
        this.stopVoiceRecording();
      };

      this._recognition.onend = () => {
        this._isRecording = false;
        if (micBtn) {
          micBtn.style.background = '';
          micBtn.style.borderColor = '';
          micBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:20px">mic</span>';
          micBtn.title = 'Voice Input (Speech to Text)';
        }
        if (statusContainer) statusContainer.innerHTML = '';
        if (input) input.focus();
      };

      this._recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      this._isRecording = false;
    }
  },

  stopVoiceRecording() {
    if (this._recognition && this._isRecording) {
      try {
        this._recognition.stop();
      } catch (_) {}
    }
    this._isRecording = false;
    const micBtn = document.getElementById('adv-chat-mic-btn');
    if (micBtn) {
      micBtn.style.background = '';
      micBtn.style.borderColor = '';
      micBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:20px">mic</span>';
    }
    const statusContainer = document.getElementById('adv-chat-status-container');
    if (statusContainer) statusContainer.innerHTML = '';
  },

  handleFileAttach(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      if (window.Utils) window.Utils.showToast('File size must be under 10 MB.', 'warning');
      return;
    }

    const sizeStr = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    this._attachedFile = {
      name: file.name,
      size: file.size,
      sizeStr: sizeStr,
      type: file.type,
      content: ''
    };

    const reader = new FileReader();
    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      reader.onload = (e) => {
        this._attachedFile.content = e.target.result || '';
      };
      reader.readAsText(file);
    } else {
      this._attachedFile.content = `[Attached Case Record: ${file.name} (${sizeStr})]`;
    }

    this._renderAttachmentPreview();
    if (window.Utils) window.Utils.showToast(`Document "${file.name}" attached.`, 'success');
  },

  _renderAttachmentPreview() {
    const statusContainer = document.getElementById('adv-chat-status-container');
    if (!statusContainer) return;

    if (!this._attachedFile) {
      const el = document.getElementById('adv-attachment-bar');
      if (el) el.remove();
      return;
    }

    const previewHtml = `
      <div id="adv-attachment-bar" style="display:flex;align-items:center;gap:8px;padding:6px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:8px;font-size:0.82rem;color:#166534;">
        <span class="material-symbols-rounded" style="font-size:18px;color:#166534">description</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <strong>${Utils.escapeHtml(this._attachedFile.name)}</strong> (${this._attachedFile.sizeStr})
        </span>
        <button type="button" onclick="AdvocateChatBot.removeAttachedFile()" title="Remove file"
                style="background:none;border:none;color:#dc2626;cursor:pointer;display:grid;place-items:center;padding:2px">
          <span class="material-symbols-rounded" style="font-size:18px">close</span>
        </button>
      </div>
    `;

    const existing = document.getElementById('adv-attachment-bar');
    if (existing) {
      existing.outerHTML = previewHtml;
    } else {
      statusContainer.insertAdjacentHTML('beforeend', previewHtml);
    }
  },

  removeAttachedFile() {
    this._attachedFile = null;
    const el = document.getElementById('adv-attachment-bar');
    if (el) el.remove();
    const input = document.getElementById('adv-chat-file-input');
    if (input) input.value = '';
  },

  async sendMessage() {
    if (this._isRecording) {
      this.stopVoiceRecording();
    }

    const input = document.getElementById('adv-chat-input');
    if (!input) return;

    const query = input.value.trim();
    if (!query && !this._attachedFile) return;

    const queryText = query || `Review Case Brief: ${this._attachedFile.name}`;

    let caseContext = null;
    let attachedMeta = null;
    if (this._attachedFile) {
      attachedMeta = { name: this._attachedFile.name, sizeStr: this._attachedFile.sizeStr };
      caseContext = `ATTACHED CASE BRIEF: ${this._attachedFile.name} (${this._attachedFile.sizeStr})\n${this._attachedFile.content || ''}`;
      this.removeAttachedFile();
    }

    input.value = '';

    this._messages.push({
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: queryText,
      attachment: attachedMeta,
      time: new Date().toISOString()
    });

    // Add temporary thinking indicator
    const thinkingId = 'msg_thinking_' + Date.now();
    this._messages.push({
      id: thinkingId,
      sender: 'ai',
      text: 'Searching 1,000,000+ Supreme Court precedent vectors and formulating zero-hallucination legal analysis...',
      time: new Date().toISOString()
    });

    const container = document.getElementById('adv-chat-messages');
    if (container) {
      container.innerHTML = this._messages.map(m => this._renderMessage(m)).join('');
      this._scrollChat();
    }

    let responseText = null;

    const selectedLang = document.getElementById('adv-chat-lang-select')?.value || this._selectedLanguage || 'auto';

    try {
      const url = (window.ApiClient && typeof ApiClient.apiUrl === 'function')
        ? ApiClient.apiUrl('/api/ai/chat')
        : ((window.location.port !== '3000' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'))
            ? `${window.location.protocol}//${window.location.hostname}:3000/api/ai/chat`
            : '/api/ai/chat');

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: queryText,
            role: 'lawyer',
            caseContext: caseContext,
            language: selectedLang
          })
        });
        const data = await resp.json();
        if (data && data.ok && data.message) {
          responseText = data.message;
        } else if (data && data.error) {
          responseText = data.error;
        }
      } catch (proxyErr) {
        console.warn('Backend proxy call failed, attempting direct AI engine on port 5000:', proxyErr.message);
        // Direct fallback to AI Service port 5000
        const directResp = await fetch('http://127.0.0.1:5000/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: queryText,
            role: 'lawyer',
            caseContext: caseContext,
            language: selectedLang
          })
        });
        const directData = await directResp.json();
        if (directData && directData.ok && directData.message) {
          responseText = directData.message;
        }
      }
    } catch (err) {
      console.error('AI Service connection failure:', err);
    }

    if (!responseText) {
      responseText = 'Nyay Setu Supreme Court AI Service se connect karne mein samasya aa rahi hai. Kripya sunishchit karein ki AI service (port 5000) ya backend (port 3000) active hai.';
    }

    // Replace thinking with actual response
    this._messages = this._messages.filter(m => m.id !== thinkingId);
    this._messages.push({
      id: 'msg_ai_' + Date.now(),
      sender: 'ai',
      text: responseText,
      lang: selectedLang,
      time: new Date().toISOString()
    });

    if (container) {
      container.innerHTML = this._messages.map(m => this._renderMessage(m)).join('');
      this._scrollChat();
    }
  },

  toggleSpeak(msgId) {
    if (typeof NyaySetuTTS === 'undefined') {
      if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast('Audio Readout engine is initializing, please try again.', 'info');
      }
      return;
    }

    if (NyaySetuTTS.isSpeaking(msgId)) {
      NyaySetuTTS.stop();
      this._updateTTSButton(msgId, false);
      return;
    }

    const prevActiveId = NyaySetuTTS.getActiveMsgId();
    if (prevActiveId && prevActiveId !== msgId) {
      this._updateTTSButton(prevActiveId, false);
    }

    const targetMsg = this._messages.find(m => m.id === msgId);
    let textToSpeak = targetMsg ? targetMsg.text : '';
    if (!textToSpeak) {
      const rowEl = document.getElementById(`adv-row-${msgId}`);
      if (rowEl) {
        textToSpeak = rowEl.innerText || rowEl.textContent;
      }
    }

    const langCode = targetMsg?.lang || document.getElementById('adv-chat-lang-select')?.value || this._selectedLanguage || 'auto';

    NyaySetuTTS.speak(msgId, textToSpeak, langCode, {
      onStart: (id) => {
        this._updateTTSButton(id, true);
      },
      onEnd: (id) => {
        this._updateTTSButton(id, false);
      },
      onError: (id) => {
        this._updateTTSButton(id, false);
      }
    });
  },

  _updateTTSButton(msgId, isPlaying) {
    const btn = document.getElementById(`adv-tts-btn-${msgId}`);
    const icon = document.getElementById(`adv-tts-icon-${msgId}`);
    const label = document.getElementById(`adv-tts-label-${msgId}`);

    if (btn) {
      btn.style.background = isPlaying ? '#fef2f2' : '#f0fdf4';
      btn.style.borderColor = isPlaying ? '#fca5a5' : '#bbf7d0';
      btn.style.color = isPlaying ? '#dc2626' : '#166534';
      btn.title = isPlaying ? 'Rokiye (Stop Listening)' : 'बोलकर सुनें (Listen to Answer)';
    }
    if (icon) {
      icon.textContent = isPlaying ? 'stop_circle' : 'volume_up';
    }
    if (label) {
      label.textContent = isPlaying ? 'रोकें (Stop)' : 'बोलकर सुनें (Listen)';
    }
  },

  _scrollChat() {
    setTimeout(() => {
      const container = document.getElementById('adv-chat-messages');
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);
  },

  clearHistory() {
    if (typeof NyaySetuTTS !== 'undefined') {
      NyaySetuTTS.stop();
    }
    this._messages = [
      {
        id: 'msg_init',
        sender: 'ai',
        text: 'Chat history cleared. How may I assist your legal research or drafting today, Counsel?',
        time: new Date().toISOString()
      }
    ];
    const container = document.getElementById('adv-chat-messages');
    if (container) container.innerHTML = this._messages.map(m => this._renderMessage(m)).join('');
    Utils.showToast('Chat history reset.', 'info');
  }
};
