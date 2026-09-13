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

          <!-- Input Bar -->
          <div style="padding:16px 20px;background:var(--surface-primary);border-top:1px solid var(--color-gray-200);display:flex;gap:12px;align-items:center">
            <input type="text" id="adv-chat-input" class="form-input" placeholder="Ask legal question, query BNS sections, or request petition draft..."
                   style="flex:1;background:var(--surface-secondary);border:1px solid var(--color-gray-300);color:var(--color-gray-900)"
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
    return `
      <div style="display:flex;gap:12px;align-items:flex-start;max-width:85%;${isAi ? '' : 'align-self:flex-end;flex-direction:row-reverse'}">
        <div style="width:34px;height:34px;border-radius:10px;background:${isAi ? 'linear-gradient(135deg,#0d9488,#0f766e)' : 'linear-gradient(135deg,#1a2744,#243b6a)'};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">
          <span class="material-symbols-rounded" style="font-size:18px">${isAi ? 'auto_awesome' : 'person'}</span>
        </div>
        <div style="background:${isAi ? 'var(--surface-secondary)' : '#1a2744'};border:1px solid ${isAi ? 'var(--color-gray-200)' : 'transparent'};border-radius:14px;padding:14px 18px;color:${isAi ? 'var(--color-gray-800)' : '#ffffff'};font-size:0.92rem;line-height:1.6">
          ${Utils.escapeHtml(m.text).replace(/\n/g, '<br>')}
          <div style="font-size:0.72rem;color:${isAi ? 'var(--color-gray-500)' : 'rgba(255,255,255,0.7)'};margin-top:6px;text-align:${isAi ? 'left' : 'right'}">
            ${Utils.timeAgo(m.time)}
          </div>
        </div>
      </div>
    `;
  },

  sendQuickPrompt(text) {
    const input = document.getElementById('adv-chat-input');
    if (input) {
      input.value = text;
      this.sendMessage();
    }
  },

  sendMessage() {
    const input = document.getElementById('adv-chat-input');
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    input.value = '';

    this._messages.push({
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: query,
      time: new Date().toISOString()
    });

    this._scrollChat();

    // Generate intelligent advocate legal response
    setTimeout(() => {
      const responseText = this._generateAdvocateResponse(query);
      this._messages.push({
        id: 'msg_ai_' + Date.now(),
        sender: 'ai',
        text: responseText,
        time: new Date().toISOString()
      });
      const container = document.getElementById('adv-chat-messages');
      if (container) {
        container.innerHTML = this._messages.map(m => this._renderMessage(m)).join('');
        this._scrollChat();
      }
    }, 600);
  },

  _generateAdvocateResponse(q) {
    const lower = q.toLowerCase();

    if (lower.includes('420') || lower.includes('cheating')) {
      return `Section 420 IPC corresponds to **Section 318(4) of the Bharatiya Nyaya Sanhita (BNS), 2023**.\n\n` +
             `• **Offence:** Cheating and dishonestly inducing delivery of property.\n` +
             `• **Punishment:** Imprisonment extending up to 7 years, along with fine.\n` +
             `• **Key Precedent:** *Hridaya Ranjan Prasad Verma v. State of Bihar (2000)* — distinction between mere breach of contract and cheating depends on fraudulent intention at the inception.\n` +
             `• **Advocate Tip:** Frame your petition demonstrating whether dishonest intention existed right from inception or if it constitutes a civil breach.`;
    }

    if (lower.includes('bail') || lower.includes('438') || lower.includes('anticipatory')) {
      return `Anticipatory Bail under **Section 438 CrPC (now Section 482 of BNSS, 2023)**:\n\n` +
             `• **Constitutional Bench Citation:** *Sushila Aggarwal v. State (NCT of Delhi) (2020)* — Protection of anticipatory bail is not automatically limited to a fixed time period and can continue till end of trial.\n` +
             `• **Pre-requisites for Pleading:**\n` +
             `  1. Clear apprehension of arrest based on specific allegations.\n` +
             `  2. Ready undertaking to cooperate with investigating agency.\n` +
             `  3. Showing no risk of witness tampering or flight.\n` +
             `• **Practice Tip:** File along with proof of deep societal roots and medical/family dependency.`;
    }

    if (lower.includes('order 39') || lower.includes('injunction') || lower.includes('stay')) {
      return `Key Legal Arguments for Interim Injunction (**Order 39 Rules 1 & 2 CPC**):\n\n` +
             `To secure an ad-interim injunction, you must establish the classic threefold test:\n` +
             `1. **Prima Facie Case:** A bona fide contention supported by registered deeds/documents.\n` +
             `2. **Balance of Convenience:** Greater hardship will be caused to the applicant if stay is refused.\n` +
             `3. **Irreparable Injury:** Damages would not adequately compensate for the loss.\n\n` +
             `• **Supreme Court Authority:** *Dalpat Kumar v. Prahlad Singh (1992)* — Judicial discretion must be exercised strictly on these three pillars.`;
    }

    if (lower.includes('482') || lower.includes('quash')) {
      return `Inherent Powers to Quash Criminal Proceedings (**Section 482 CrPC / Section 528 BNSS**):\n\n` +
             `• **Landmark Guidelines:** *State of Haryana v. Bhajan Lal (1992)* set out 7 illustrative categories where High Courts must quash FIRs (e.g., where allegations, taken at face value, do not constitute any cognizable offence).\n` +
             `• **Recent Ruling:** *Neeharika Infrastructure (2021)* — Courts must exercise restraint, but pure civil disputes dressed as criminal fraud must be quashed.`;
    }

    return `Under Indian jurisprudence and statutory provisions relevant to your query:\n\n` +
           `1. **Statutory Position:** The matter is governed by procedural safeguards under CPC/CrPC (and their corresponding provisions under BNSS 2023).\n` +
           `2. **Evidentiary Threshold:** The burden of proof rests on the applicant to establish jurisdictional facts before the competent bench.\n` +
           `3. **Recommended Next Step:** Prepare a chronological List of Dates and verify annexures before entering the courtroom.\n\n` +
           `Would you like me to draft a preliminary petition synopsis or look up specific High Court citations?`;
  },

  _scrollChat() {
    setTimeout(() => {
      const container = document.getElementById('adv-chat-messages');
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);
  },

  clearHistory() {
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
