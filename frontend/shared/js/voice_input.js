/* Voice typing only: recognised words remain editable and are never submitted automatically. */
const VoiceInput = {
  current: null,
  languages: {hi:['hi-IN','हिन्दी'],en:['en-IN','English'],mr:['mr-IN','मराठी'],gu:['gu-IN','ગુજરાતી'],bn:['bn-IN','বাংলা'],ta:['ta-IN','தமிழ்'],te:['te-IN','తెలుగు'],kn:['kn-IN','ಕನ್ನಡ'],ml:['ml-IN','മലയാളം'],pa:['pa-IN','ਪੰਜਾਬੀ'],ur:['ur-IN','اردو'],or:['or-IN','ଓଡ଼ିଆ'],as:['as-IN','অসমীয়া'],ne:['ne-NP','नेपाली'],sa:['sa-IN','संस्कृतम्']},
  controls(id, language = 'hi') {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return '';
    const selected = this.languages[language] ? language : 'hi';
    return '<span class="nyay-voice-controls"><select id="voice-language-' + id + '" aria-label="Voice typing language" title="Voice typing language" onchange="VoiceInput.stop()">' +
      Object.entries(this.languages).map(([key,value]) => '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + value[1] + '</option>').join('') +
      '</select><button type="button" class="nyay-voice-mic" id="voice-mic-' + id + '" aria-label="Start voice typing" aria-pressed="false" title="Start voice typing" onclick="VoiceInput.toggle(\'' + id + '\')"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button><span id="voice-status-' + id + '" class="nyay-voice-status" role="status" aria-live="polite"></span></span>';
  },
  owner() { return typeof AuthManager !== 'undefined' ? String(AuthManager.getSession()?.id || AuthManager.getSession()?.email || '') : ''; },
  thread() { return typeof AssistantThreads !== 'undefined' ? AssistantThreads.active(false)?.id : null; },
  valid(session) {
    return this.current === session && session.input.isConnected !== false && document.getElementById(session.id) === session.input &&
      !session.input.disabled && !session.input.readOnly && this.owner() === session.owner && this.thread() === session.thread;
  },
  status(session, text, warning = false) {
    if (session.status) session.status.textContent = text;
    if (warning && typeof Utils !== 'undefined') Utils.showToast?.(text, 'warning');
  },
  paint(session, active) {
    session.button?.classList.toggle('nyay-voice-active', active);
    session.button?.classList.toggle('recording', active);
    session.button?.setAttribute('aria-pressed', String(active));
    session.button?.setAttribute('aria-label', active ? 'Stop voice typing' : 'Start voice typing');
    if (session.button) session.button.title = active ? 'Stop voice typing' : 'Start voice typing';
    session.options.onState?.(active);
  },
  toggle(id, options = {}) {
    if (this.current?.id === id) this.stop();
    else this.start(id, options);
  },
  start(id, options = {}) {
    this.stop();
    const input = document.getElementById(id);
    if (!input || input.disabled || input.readOnly) return;
    let status = document.getElementById('voice-status-' + id);
    if (!status && options.statusContainerId) {
      const parent = document.getElementById(options.statusContainerId);
      if (parent) { status = document.createElement('span'); status.id = 'voice-status-' + id; status.className = 'nyay-voice-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); parent.appendChild(status); }
    }
    const session = {id,input,status,options,button:document.getElementById(options.buttonId || 'voice-mic-' + id),owner:this.owner(),thread:this.thread()};
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { this.status(session,'Voice typing is unavailable in this browser. Try Chrome or Edge.',true); return; }
    const language = document.getElementById(options.languageId || 'voice-language-' + id)?.value || 'hi';
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    session.before = input.value.slice(0,start); session.after = input.value.slice(end);
    this.current = session;
    try {
      const recognition = session.recognition = new Recognition();
      recognition.lang = this.languages[language]?.[0] || (language === 'auto' ? 'hi-IN' : language);
      recognition.continuous = true; recognition.interimResults = true;
      session.edit = () => { if (!session.writing) this.stop(); };
      input.addEventListener('input',session.edit);
      if (typeof MutationObserver !== 'undefined') {
        session.observer = new MutationObserver(() => { if (this.current === session && !this.valid(session)) this.stop(); });
        session.observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});
      }
      recognition.onstart = () => {
        if (!this.valid(session)) { if (this.current === session) this.stop(); else { try { recognition.abort(); } catch (_) {} } return; }
        this.status(session,'Listening… Click the mic to stop.');
      };
      recognition.onresult = event => {
        if (!this.valid(session)) { if (this.current === session) this.stop(); return; }
        // Each result event contains the whole session, including earlier final segments.
        let words = Array.from(event.results).map(result => result[0]?.transcript?.trim() || '').filter(Boolean).join(' ');
        if (!words) return;
        const left = session.before && !/\s$/.test(session.before) ? ' ' : '';
        const right = session.after && !/^\s/.test(session.after) ? ' ' : '';
        const maximum = input.maxLength >= 0 ? input.maxLength : Infinity;
        const available = Math.max(0,maximum - session.before.length - session.after.length - left.length - right.length);
        const limited = words.length > available;
        words = words.slice(0,available).replace(/[\uD800-\uDBFF]$/,'');
        if (words) {
          session.writing = true;
          try { input.value = session.before + left + words + right + session.after; input.dispatchEvent(new Event('input',{bubbles:true})); }
          finally { session.writing = false; }
        }
        if (limited) { this.stop(); this.status(session,'Text limit reached. Your words are kept.',true); }
      };
      recognition.onerror = event => {
        if (this.current !== session) return;
        const messages = {'not-allowed':'Microphone access was denied. Allow it in your browser to use voice typing.','service-not-allowed':'Voice typing is blocked by this browser.','audio-capture':'No microphone was found. Check your microphone connection.','network':'Voice typing could not connect. Check your connection and try again.','no-speech':'No speech was detected. Click the mic and try again.','language-not-supported':'This voice language is unavailable. Choose another language.'};
        this.stop();
        if (event.error !== 'aborted') this.status(session,messages[event.error] || 'Voice typing stopped. Your text is kept; try again.',true);
      };
      recognition.onend = () => { if (this.current === session) this.finish(session); };
      this.paint(session,true); this.status(session,'Starting microphone…');
      if (typeof NyaySetuTTS !== 'undefined') NyaySetuTTS.stop();
      else window.speechSynthesis?.cancel();
      recognition.start();
    } catch (_) { this.stop(); this.status(session,'Could not start the microphone. Check browser microphone access and try again.',true); }
  },
  finish(session) {
    if (this.current !== session) return;
    this.current = null;
    session.observer?.disconnect(); session.input.removeEventListener('input',session.edit);
    this.paint(session,false); this.status(session,'Voice typing stopped. Review your text before sending.');
  },
  stop(id = null) {
    const session = this.current;
    if (!session || id && session.id !== id) return;
    this.finish(session);
    // Ignore late results after Stop, navigation, submission or a chat/stage switch.
    try { session.recognition?.abort(); } catch (_) {}
  }
};
window.addEventListener('hashchange',() => VoiceInput.stop());
window.addEventListener('pagehide',() => VoiceInput.stop());
document.addEventListener('visibilitychange',() => { if (document.hidden) VoiceInput.stop(); });
document.addEventListener('submit',() => VoiceInput.stop(),true);
document.addEventListener('click',event => {
  const button = event.target.closest?.('button');
  if (button && VoiceInput.current && button !== VoiceInput.current.button) VoiceInput.stop();
},true);
