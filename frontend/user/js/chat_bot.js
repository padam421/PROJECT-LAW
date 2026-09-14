/* ============================================================
   Nyay Setu USER — AI CHATBOT
   chat_bot.js — Ask Nyay Setu conversational interface
   ============================================================ */

const UserChatBot = {

  render() {
    let conversations = UserStore.get('conversations') || [];
    // Clean stale synthetic/demo messages if present from old local sessions
    const aiConv = conversations.find(c => c.type === 'ai');
    if (aiConv && aiConv.messages && aiConv.messages.some(m => m.text && (m.text.includes('shhhh') || m.text.includes('relates directly to property')))) {
      aiConv.messages = [];
      UserStore.set('conversations', conversations);
    }
    const activeConv = aiConv || { id: 'conv_ai', type: 'ai', name: 'Nyay Setu AI', messages: [] };

    const content = `
      <div class="u-chat-layout">
        <!-- Chat List Sidebar -->
        <div class="u-chat-list" id="chat-list">
          <div class="u-chat-list-header">
            <h3 class="u-chat-list-title">Conversations</h3>
          </div>
          <div class="u-chat-list-items">
            <div class="u-chat-list-item active" data-conv="conv_ai" onclick="UserChatBot.selectConversation('conv_ai')">
              <div class="u-chat-item-avatar" style="background:var(--u-accent-gradient)">
                <span class="material-symbols-rounded" style="font-size:20px">auto_awesome</span>
              </div>
              <div class="u-chat-item-info">
                <div class="u-chat-item-name">Nyay Setu AI</div>
                <div class="u-chat-item-preview">${activeConv.messages.length > 0 ? Utils.escapeHtml(activeConv.messages[activeConv.messages.length - 1].text.substring(0, 50)) : 'Start a conversation...'}</div>
              </div>
              <div class="u-chat-item-time">${activeConv.messages.length > 0 ? Utils.timeAgo(activeConv.messages[activeConv.messages.length - 1].time) : ''}</div>
            </div>
          </div>
        </div>

        <!-- Main Chat Area -->
        <div class="u-chat-main">
          <div class="u-chat-header">
            <div class="u-chat-header-info">
              <button class="u-btn-icon" style="display:none" id="chat-back-btn" onclick="UserChatBot.showList()">
                <span class="material-symbols-rounded">arrow_back</span>
              </button>
              <div class="u-chat-item-avatar" style="width:36px;height:36px;background:var(--u-accent-gradient)">
                <span class="material-symbols-rounded" style="font-size:18px">auto_awesome</span>
              </div>
              <div>
                <div class="u-chat-header-name">Nyay Setu AI</div>
                <div class="u-chat-header-status">Online</div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="u-btn-icon" title="New Chat" onclick="UserChatBot.startNewChat()">
                <span class="material-symbols-rounded">edit_square</span>
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div class="u-chat-messages" id="chat-messages">
            ${activeConv.messages.length === 0 ? this._emptyChat() : activeConv.messages.map(m => this._renderMessage(m)).join('')}
          </div>

          <!-- Quick Questions -->
          <div class="u-quick-questions" id="quick-questions">
            <span class="u-quick-q" onclick="UserChatBot.sendQuickQ(this)">What are my legal rights?</span>
            <span class="u-quick-q" onclick="UserChatBot.sendQuickQ(this)">Explain my case in simple words</span>
            <span class="u-quick-q" onclick="UserChatBot.sendQuickQ(this)">What documents do I need?</span>
            <span class="u-quick-q" onclick="UserChatBot.sendQuickQ(this)">How long will my case take?</span>
            <span class="u-quick-q" onclick="UserChatBot.sendQuickQ(this)">Prepare me for court</span>
          </div>

          <!-- Attachment & Voice Status Container -->
          <div id="chat-status-container" style="padding: 0 var(--u-space-4);"></div>

          <!-- Chat Input -->
          <div class="u-chat-input-area">
            <input type="file" id="chat-file-input" style="display:none" accept=".pdf,.doc,.docx,.txt,.csv,image/*" onchange="UserChatBot.handleFileAttach(event)">
            <div class="u-chat-input-wrap">
              <div class="u-chat-toolbar">
                <select class="u-chat-lang-select" id="chat-lang-select" title="Select Query & Speech Language (22 Indian Languages)" onchange="UserChatBot.handleLanguageChange(event)">
                  <option value="auto" selected>🌐 Auto Detect (स्वचालित)</option>
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
                <button class="u-chat-tool" id="chat-attach-btn" title="Attach case brief / FIR copy (PDF, Doc, Image)" onclick="document.getElementById('chat-file-input').click()">
                  <span class="material-symbols-rounded" style="font-size:20px">attach_file</span>
                </button>
                <button class="u-chat-tool" id="chat-mic-btn" title="Voice Input (Speech to Text in selected language)" onclick="UserChatBot.toggleVoiceRecording()">
                  <span class="material-symbols-rounded" style="font-size:20px">mic</span>
                </button>
              </div>
              <textarea class="u-chat-text-input" id="chat-input" placeholder="Ask Nyay Setu anything, speak your query, or attach a document..." rows="1"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();UserChatBot.sendMessage()}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
              <button class="u-chat-send" onclick="UserChatBot.sendMessage()" title="Send" id="chat-send-btn">
                <span class="material-symbols-rounded">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    return UserComponents.AppLayout(content, 'chat', 'Ask Nyay Setu');
  },

  _emptyChat() {
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px">
        <div style="width:64px;height:64px;border-radius:var(--u-radius-lg);background:var(--u-accent-subtle);display:grid;place-items:center;margin-bottom:16px">
          <span class="material-symbols-rounded" style="font-size:30px;color:var(--u-accent-light)">auto_awesome</span>
        </div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px">Ask Nyay Setu AI</h3>
        <p style="font-size:0.85rem;color:var(--u-text-tertiary);max-width:360px;line-height:1.6">
          I can help you understand your legal rights, explain legal terms in simple language, and prepare you for court.
        </p>
      </div>
    `;
  },

  _renderMessage(msg) {
    const isSent = msg.sender === 'user';
    const msgId = msg.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    msg.id = msgId;

    const attachmentHtml = msg.attachment ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(255,255,255,0.15);border-radius:6px;margin-bottom:8px;font-size:0.8rem;border:1px solid rgba(255,255,255,0.25)">
        <span class="material-symbols-rounded" style="font-size:16px">attach_file</span>
        <span>${Utils.escapeHtml(msg.attachment.name)}</span>
        <span style="opacity:0.85">(${msg.attachment.sizeStr})</span>
      </div><br>
    ` : '';

    const isPlaying = (typeof NyaySetuTTS !== 'undefined') && NyaySetuTTS.isSpeaking(msgId);

    const ttsActionHtml = !isSent ? `
      <div class="u-msg-actions">
        <button type="button" class="u-tts-btn ${isPlaying ? 'playing' : ''}" id="tts-btn-${msgId}"
                onclick="UserChatBot.toggleSpeak('${msgId}')" title="${isPlaying ? 'Rokiye (Stop Listening)' : 'बोलकर सुनें (Listen to Answer)'}">
          <span class="material-symbols-rounded" id="tts-icon-${msgId}">${isPlaying ? 'stop_circle' : 'volume_up'}</span>
          <span class="u-tts-label" id="tts-label-${msgId}">${isPlaying ? 'रोकें (Stop)' : 'बोलकर सुनें (Listen)'}</span>
          <div class="u-tts-soundwave">
            <span></span><span></span><span></span><span></span>
          </div>
        </button>
      </div>
    ` : '';

    return `
      <div class="u-msg ${isSent ? 'u-msg-sent' : 'u-msg-received'}" id="msg-row-${msgId}">
        ${!isSent ? `<div class="u-msg-ai-label"><span class="material-symbols-rounded">auto_awesome</span> Nyay Setu AI</div>` : ''}
        <div class="u-msg-bubble">
          ${attachmentHtml}${this._formatText(msg.text)}
          ${ttsActionHtml}
        </div>
        <div class="u-msg-time">${msg.time ? Utils.timeAgo(msg.time) : 'now'}</div>
      </div>
    `;
  },

  _formatText(text) {
    if (!text) return '';
    let escaped = Utils.escapeHtml(text);

    // Markdown Headings
    escaped = escaped.replace(/^### (.*$)/gim, '<div style="font-size:1.02rem;font-weight:700;color:var(--u-accent-light);margin:14px 0 6px 0;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:6px;">$1</div>');
    escaped = escaped.replace(/^## (.*$)/gim, '<div style="font-size:1.1rem;font-weight:700;color:var(--u-text-primary);margin:16px 0 8px 0;">$1</div>');

    // Bold and Italics
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--u-text-primary);font-weight:600;">$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Horizontal divider
    escaped = escaped.replace(/^---$/gim, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:12px 0;">');

    // Role highlight badges for Courtroom Simulation
    escaped = escaped.replace(/(🛡️|⚖️|🏛️)\s*(.*?):/g, '<div style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;background:rgba(255,255,255,0.06);border-radius:6px;margin:8px 0 4px 0;font-size:0.85rem;font-weight:600;color:var(--u-accent-light);border:1px solid rgba(255,255,255,0.1);">$1 <span>$2:</span></div>');

    // Line breaks and list bullets
    return escaped
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/•/g, '<span style="color:var(--u-accent-light)">•</span>');
  },

  sendQuickQ(el) {
    const text = el?.textContent;
    if (text) {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = text;
        this.sendMessage();
      }
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
      const selectedLang = document.getElementById('chat-lang-select')?.value || this._selectedLanguage || 'auto';
      this._recognition.lang = this._getSpeechLangCode(selectedLang);

      const input = document.getElementById('chat-input');
      const micBtn = document.getElementById('chat-mic-btn');
      const statusContainer = document.getElementById('chat-status-container');
      const initialText = input ? input.value : '';

      this._recognition.onstart = () => {
        this._isRecording = true;
        if (micBtn) {
          micBtn.classList.add('recording');
          micBtn.title = 'Recording live... Click to stop';
        }
        if (statusContainer) {
          const langSelectEl = document.getElementById('chat-lang-select');
          const langLabel = langSelectEl ? langSelectEl.options[langSelectEl.selectedIndex].text : 'Selected Language';
          statusContainer.innerHTML = `
            <div class="u-voice-status-bar" id="voice-status-bar">
              <div class="u-voice-status-dot"></div>
              <span style="flex:1">🎙️ <strong>Sun raha hoon (${langLabel})...</strong> Bolte hi text type ho jayega. Click Stop when done.</span>
              <button type="button" onclick="UserChatBot.stopVoiceRecording()" style="background:none;border:none;color:#b91c1c;cursor:pointer;font-weight:700;font-size:0.8rem;text-decoration:underline">
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
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 120) + 'px';
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
          micBtn.classList.remove('recording');
          micBtn.title = 'Voice Input (Speech to Text)';
        }
        const statusBar = document.getElementById('voice-status-bar');
        if (statusBar) statusBar.remove();
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
    const micBtn = document.getElementById('chat-mic-btn');
    if (micBtn) {
      micBtn.classList.remove('recording');
      micBtn.title = 'Voice Input (Speech to Text)';
    }
    const statusBar = document.getElementById('voice-status-bar');
    if (statusBar) statusBar.remove();
  },

  handleFileAttach(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      if (window.Utils) window.Utils.showToast('File size 10 MB se kam honi chahiye.', 'warning');
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
      this._attachedFile.content = `[Attached Legal Document File: ${file.name} (${sizeStr})]`;
    }

    this._renderAttachmentPreview();
    if (window.Utils) window.Utils.showToast(`Document "${file.name}" attach ho gaya.`, 'success');
  },

  _renderAttachmentPreview() {
    const statusContainer = document.getElementById('chat-status-container');
    if (!statusContainer) return;

    if (!this._attachedFile) {
      const el = document.getElementById('chat-attachment-bar');
      if (el) el.remove();
      return;
    }

    const previewHtml = `
      <div class="u-attachment-preview-bar" id="chat-attachment-bar">
        <span class="material-symbols-rounded" style="font-size:18px;color:#166534">description</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <strong>${Utils.escapeHtml(this._attachedFile.name)}</strong> (${this._attachedFile.sizeStr})
        </span>
        <button type="button" onclick="UserChatBot.removeAttachedFile()" title="Remove file"
                style="background:none;border:none;color:#dc2626;cursor:pointer;display:grid;place-items:center;padding:2px">
          <span class="material-symbols-rounded" style="font-size:18px">close</span>
        </button>
      </div>
    `;

    const existing = document.getElementById('chat-attachment-bar');
    if (existing) {
      existing.outerHTML = previewHtml;
    } else {
      statusContainer.insertAdjacentHTML('beforeend', previewHtml);
    }
  },

  removeAttachedFile() {
    this._attachedFile = null;
    const el = document.getElementById('chat-attachment-bar');
    if (el) el.remove();
    const input = document.getElementById('chat-file-input');
    if (input) input.value = '';
  },

  async sendMessage() {
    if (this._isRecording) {
      this.stopVoiceRecording();
    }

    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text && !this._attachedFile) return;

    const queryText = text || `Kripya is attached document ko review karein: ${this._attachedFile.name}`;

    let caseContext = null;
    let attachedMeta = null;
    if (this._attachedFile) {
      attachedMeta = { name: this._attachedFile.name, sizeStr: this._attachedFile.sizeStr };
      caseContext = `ATTACHED DOCUMENT: ${this._attachedFile.name} (${this._attachedFile.sizeStr})\n${this._attachedFile.content || ''}`;
      this.removeAttachedFile();
    }

    input.value = '';
    input.style.height = 'auto';

    // Hide quick questions after first message
    const qq = document.getElementById('quick-questions');
    if (qq) qq.style.display = 'none';

    // Add user message with attachment if any
    const userMsgId = 'msg_user_' + Date.now();
    this._appendMessage({
      id: userMsgId,
      sender: 'user',
      text: queryText,
      attachment: attachedMeta,
      time: new Date().toISOString()
    });

    // Show typing indicator
    this._showTyping();

    // Get AI response with caseContext and selected regional language
    const selectedLang = document.getElementById('chat-lang-select')?.value || this._selectedLanguage || 'auto';
    const response = await UserApiClient.getAIResponse(queryText, caseContext, selectedLang);

    // Remove typing and show response
    this._hideTyping();
    const aiMsgId = 'msg_ai_' + Date.now();
    const aiMsgObj = {
      id: aiMsgId,
      sender: 'ai',
      text: response,
      lang: selectedLang,
      time: new Date().toISOString()
    };
    this._appendMessage(aiMsgObj);

    // Save to store
    const conversations = UserStore.get('conversations') || [];
    let conv = conversations.find(c => c.type === 'ai');
    if (!conv) {
      conv = { id: 'conv_ai', type: 'ai', name: 'Nyay Setu AI', messages: [] };
      conversations.push(conv);
    }
    conv.messages.push({ id: userMsgId, sender: 'user', text: queryText, attachment: attachedMeta, time: new Date().toISOString() });
    conv.messages.push(aiMsgObj);
    UserStore.set('conversations', conversations);
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

    // Stop previously playing message button if any
    const prevActiveId = NyaySetuTTS.getActiveMsgId();
    if (prevActiveId && prevActiveId !== msgId) {
      this._updateTTSButton(prevActiveId, false);
    }

    const conversations = UserStore.get('conversations') || [];
    const conv = conversations.find(c => c.type === 'ai');
    let targetMsg = null;
    if (conv && conv.messages) {
      targetMsg = conv.messages.find(m => m.id === msgId);
    }

    // Extract text from memory or DOM
    let textToSpeak = targetMsg ? targetMsg.text : '';
    if (!textToSpeak) {
      const bubbleEl = document.querySelector(`#msg-row-${msgId} .u-msg-bubble`);
      if (bubbleEl) {
        const clone = bubbleEl.cloneNode(true);
        const act = clone.querySelector('.u-msg-actions');
        if (act) act.remove();
        textToSpeak = clone.innerText || clone.textContent;
      }
    }

    const langCode = targetMsg?.lang || document.getElementById('chat-lang-select')?.value || this._selectedLanguage || 'auto';

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
    const btn = document.getElementById(`tts-btn-${msgId}`);
    const icon = document.getElementById(`tts-icon-${msgId}`);
    const label = document.getElementById(`tts-label-${msgId}`);

    if (btn) {
      if (isPlaying) {
        btn.classList.add('playing');
        btn.title = 'Rokiye (Stop Audio Readout)';
      } else {
        btn.classList.remove('playing');
        btn.title = 'बोलकर सुनें (Listen to Answer)';
      }
    }
    if (icon) {
      icon.textContent = isPlaying ? 'stop_circle' : 'volume_up';
    }
    if (label) {
      label.textContent = isPlaying ? 'रोकें (Stop)' : 'बोलकर सुनें (Listen)';
    }
  },

  _appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Clear empty state if present
    const emptyState = container.querySelector('.u-empty, div[style*="flex:1"]');
    if (emptyState && !emptyState.classList.contains('u-msg')) emptyState.remove();

    const div = document.createElement('div');
    div.innerHTML = this._renderMessage(msg);
    container.appendChild(div.firstElementChild);
    container.scrollTop = container.scrollHeight;
  },

  _showTyping() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const typing = document.createElement('div');
    typing.id = 'typing-indicator';
    typing.className = 'u-msg u-msg-received';
    typing.innerHTML = `
      <div class="u-msg-ai-label"><span class="material-symbols-rounded">auto_awesome</span> Nyay Setu AI</div>
      <div class="u-typing">
        <div class="u-typing-dots">
          <div class="u-typing-dot"></div>
          <div class="u-typing-dot"></div>
          <div class="u-typing-dot"></div>
        </div>
        <span class="u-typing-text">Thinking...</span>
      </div>
    `;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  },

  _hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  },

  startNewChat() {
    if (typeof NyaySetuTTS !== 'undefined') {
      NyaySetuTTS.stop();
    }
    const conversations = UserStore.get('conversations') || [];
    const conv = conversations.find(c => c.type === 'ai');
    if (conv) {
      conv.messages = [];
      UserStore.set('conversations', conversations);
    }
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = this._emptyChat();
    const preview = document.querySelector('.u-chat-item-preview');
    if (preview) preview.textContent = 'Start a conversation...';
    const timeEl = document.querySelector('.u-chat-item-time');
    if (timeEl) timeEl.textContent = '';
    const qq = document.getElementById('quick-questions');
    if (qq) qq.style.display = '';
    if (window.Utils && typeof window.Utils.showToast === 'function') {
      window.Utils.showToast('Clean chat session started', 'info');
    }
  },

  selectConversation(convId) {
    document.querySelectorAll('.u-chat-list-item').forEach(el => el.classList.toggle('active', el.dataset.conv === convId));
  },

  showList() {
    // For mobile: show conversation list
    const list = document.getElementById('chat-list');
    if (list) list.classList.toggle('hidden');
  },

  onEnter() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
};
