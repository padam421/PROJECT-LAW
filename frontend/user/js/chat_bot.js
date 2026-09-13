/* ============================================================
   Nyay Setu USER — AI CHATBOT
   chat_bot.js — Ask Nyay Setu conversational interface
   ============================================================ */

const UserChatBot = {

  render() {
    const conversations = UserStore.get('conversations') || [];
    const activeConv = conversations.find(c => c.type === 'ai') || { id: 'conv_ai', type: 'ai', name: 'Nyay Setu AI', messages: [] };

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

          <!-- Chat Input -->
          <div class="u-chat-input-area">
            <div class="u-chat-input-wrap">
              <div class="u-chat-toolbar">
                <button class="u-chat-tool" title="Attach file"><span class="material-symbols-rounded" style="font-size:20px">attach_file</span></button>
                <button class="u-chat-tool" title="Voice input"><span class="material-symbols-rounded" style="font-size:20px">mic</span></button>
              </div>
              <textarea class="u-chat-text-input" id="chat-input" placeholder="Ask Nyay Setu anything..." rows="1"
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
    return `
      <div class="u-msg ${isSent ? 'u-msg-sent' : 'u-msg-received'}">
        ${!isSent ? `<div class="u-msg-ai-label"><span class="material-symbols-rounded">auto_awesome</span> Nyay Setu AI</div>` : ''}
        <div class="u-msg-bubble">${this._formatText(msg.text)}</div>
        <div class="u-msg-time">${msg.time ? Utils.timeAgo(msg.time) : 'now'}</div>
      </div>
    `;
  },

  _formatText(text) {
    if (!text) return '';
    return Utils.escapeHtml(text)
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

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    // Hide quick questions after first message
    const qq = document.getElementById('quick-questions');
    if (qq) qq.style.display = 'none';

    // Add user message
    this._appendMessage({ sender: 'user', text, time: new Date().toISOString() });

    // Show typing indicator
    this._showTyping();

    // Get AI response
    const response = await UserApiClient.getAIResponse(text);

    // Remove typing and show response
    this._hideTyping();
    this._appendMessage({ sender: 'ai', text: response, time: new Date().toISOString() });

    // Save to store
    const conversations = UserStore.get('conversations') || [];
    let conv = conversations.find(c => c.type === 'ai');
    if (!conv) {
      conv = { id: 'conv_ai', type: 'ai', name: 'Nyay Setu AI', messages: [] };
      conversations.push(conv);
    }
    conv.messages.push({ sender: 'user', text, time: new Date().toISOString() });
    conv.messages.push({ sender: 'ai', text: response, time: new Date().toISOString() });
    UserStore.set('conversations', conversations);
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
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = this._emptyChat();
    const qq = document.getElementById('quick-questions');
    if (qq) qq.style.display = '';
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
