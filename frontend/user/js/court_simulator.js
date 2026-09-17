/* ============================================================
   Nyay Setu USER — VIRTUAL COURT SIMULATOR (V4 — 3-Avatar Debate)
   court_simulator.js — Three.js Scene, 3D Avatars, Camera Director
   ============================================================ */

const VirtualCourtSimulator = {
  _isPlaying: false,
  _isPaused: false,
  _currentStep: 0,
  _stepTimeout: null,

  // Camera Mode: 'WIDE' by default; stays on user's manual selection
  _cameraMode: 'WIDE',

  // Three.js Core
  _scene: null,
  _camera: null,
  _renderer: null,
  _animationFrameId: null,
  _clock: null,

  // Multi-Avatar System
  _mixers: {},   // { JUDGE: AnimationMixer, DEFENSE: AnimationMixer, PROSECUTION: AnimationMixer }
  _actions: {},  // { JUDGE: AnimationAction, DEFENSE: AnimationAction, PROSECUTION: AnimationAction }
  _avatarModels: {}, // 3D models for dynamic lawyer orientation
  _targetRotations: {
    JUDGE: 0,            // Faces straight forward toward both lawyers and court (+Z)
    DEFENSE: 0.35,       // Default angle facing courtroom/judge
    PROSECUTION: -0.35   // Default angle facing courtroom/judge
  },

  // Audio
  _audioContext: null,
  _activeSpeakerId: null,

  // Cinematic Camera
  _cameraTarget: null,
  _cameraPos: null,
  _currentLookAt: null,
  _cameraDriftTime: 0,

  // 3D Scene Objects
  _spotLight: null,
  _spotLightTarget: null,
  _speakerRings: {},
  _namePlates: {},

  // Avatar Model Files
  AVATAR_FILES: {
    DEFENSE: 'assets/Talking.fbx.glb',
    PROSECUTION: 'assets/female_talking.glb',
    JUDGE: 'assets/judge_talking.glb'
  },

  // Dynamic Case & Debate State
  _activeCaseTitle: 'Supreme Court Special Bench Hearing',
  _activeLanguage: 'auto',
  _script: [],

  /**
   * Parses Section 3 (🏛️ Courtroom Debate Simulation) from raw AI response text
   * into executable 3D avatar dialogue turns with dynamic facing, gavel, and pitch.
   */
  parseDebateFromText(fullText) {
    if (!fullText) return [];

    // 1. Locate Section 3: Courtroom Debate Simulation
    let sec3Content = '';
    const sec3Regex = /###\s*3\.\s*[^\n]*\n([\s\S]*?)(?=###\s*4\.|\n---\s*\n###\s*4\.|\n##\s*4\.|$)/i;
    const match = fullText.match(sec3Regex);
    if (match && match[1]) {
      sec3Content = match[1];
    } else {
      const emojiIndex = fullText.search(/(?:🏛️|🛡️|⚖️)/);
      if (emojiIndex !== -1) {
        sec3Content = fullText.substring(emojiIndex);
      } else {
        sec3Content = fullText;
      }
    }

    const lines = sec3Content.split('\n');
    const parsedSteps = [];
    let currentStep = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Match speaker turn: (🏛️|🛡️|⚖️) followed by role name and speech
      const turnMatch = line.match(/^[-*•]?\s*(🏛️|🛡️|⚖️)\s*(?:\*\*)?(.*?)(?:\*\*)?\s*:\s*(.*)$/);

      if (turnMatch) {
        if (currentStep && currentStep.text.trim()) {
          parsedSteps.push(currentStep);
        }

        const emoji = turnMatch[1];
        let role = (turnMatch[2] || '')
          .replace(/<\/?strong[^>]*>/gi, '')
          .replace(/\*\*/g, '')
          .trim();
        const speech = turnMatch[3] || '';

        let actor = 'JUDGE';
        let defaultName = 'माननीय न्यायाधीश (Hon\'ble Judge)';
        let pitch = 0.75;
        let rate = 0.92;
        let facing = { DEFENSE: 0.85, PROSECUTION: -0.85 };

        if (emoji === '🛡️') {
          actor = 'DEFENSE';
          defaultName = 'मेरा वकील (Defense Counsel)';
          pitch = 1.0;
          rate = 1.0;
          facing = { DEFENSE: 0.85, PROSECUTION: -1.4 };
        } else if (emoji === '⚖️') {
          actor = 'PROSECUTION';
          defaultName = 'विपक्षी वकील (Public Prosecutor)';
          pitch = 1.22;
          rate = 1.02;
          facing = { DEFENSE: 1.4, PROSECUTION: -0.85 };
        }

        currentStep = {
          actor: actor,
          name: role || defaultName,
          text: speech,
          pitch: pitch,
          rate: rate,
          gavel: false,
          facing: facing,
          _isDynamic: true
        };
      } else if (currentStep) {
        // Continuation line
        if (!line.startsWith('#') && !line.startsWith('---') && !line.includes('u-debate-scenario-badge')) {
          currentStep.text += ' ' + line;
        }
      }
    }

    if (currentStep && currentStep.text.trim()) {
      parsedSteps.push(currentStep);
    }

    // Set gavel strikes on Judge opening and final order
    if (parsedSteps.length > 0) {
      const judgeIndices = [];
      parsedSteps.forEach((s, idx) => {
        if (s.actor === 'JUDGE') judgeIndices.push(idx);
      });
      if (judgeIndices.length > 0) {
        parsedSteps[judgeIndices[0]].gavel = true;
        parsedSteps[judgeIndices[judgeIndices.length - 1]].gavel = true;
      }
    }

    return parsedSteps;
  },

  /**
   * Primary entrypoint when user clicks '🏛️ Virtual Court' from a chat message.
   * Dynamically extracts Section 3 dialogue, configures the 3D actors, and navigates.
   */
  launchFromChat(msgId) {
    let targetMsg = null;
    let userQuery = '';

    const conversations = (typeof UserStore !== 'undefined' && UserStore.get('conversations')) || [];
    const conv = conversations.find(c => c.type === 'ai');

    if (conv && conv.messages && conv.messages.length > 0) {
      if (msgId) {
        const idx = conv.messages.findIndex(m => m.id === msgId);
        if (idx !== -1) {
          targetMsg = conv.messages[idx];
          for (let j = idx - 1; j >= 0; j--) {
            if (conv.messages[j].sender === 'user') {
              userQuery = conv.messages[j].text;
              break;
            }
          }
        }
      }

      // If not found by msgId, pick the latest AI message with debate content
      if (!targetMsg) {
        for (let k = conv.messages.length - 1; k >= 0; k--) {
          if (conv.messages[k].sender === 'ai' && conv.messages[k].text && (conv.messages[k].text.includes('🏛️') || conv.messages[k].text.includes('Courtroom Debate'))) {
            targetMsg = conv.messages[k];
            for (let j = k - 1; j >= 0; j--) {
              if (conv.messages[j].sender === 'user') {
                userQuery = conv.messages[j].text;
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (!targetMsg || !targetMsg.text) {
      if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast('Pehle AI se case analysis karwayein taaki courtroom debate generate ho sake.', 'info');
      }
      Router.navigate('/chat');
      return;
    }

    const parsedScript = this.parseDebateFromText(targetMsg.text);

    if (!parsedScript || parsedScript.length === 0) {
      if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast('Is message mein courtroom debate nahi mili. Default debate chalayi ja rahi hai.', 'warning');
      }
      this._script = this._getDefaultFallbackScript();
    } else {
      this._script = parsedScript;
    }

    // Determine clean case title
    let caseTitle = 'Supreme Court Hearing';
    if (userQuery) {
      caseTitle = userQuery.substring(0, 65).trim();
      if (userQuery.length > 65) caseTitle += '...';
    } else {
      const sec1Match = targetMsg.text.match(/###\s*1\.\s*[^\n]*\n([\s\S]*?)(?=###\s*2\.|$)/);
      if (sec1Match) {
        const firstLine = sec1Match[1].trim().split('\n')[0].replace(/[*#]/g, '').trim();
        if (firstLine) caseTitle = firstLine.substring(0, 65);
      }
    }

    this._activeCaseTitle = caseTitle;
    this._activeLanguage = targetMsg.lang || 'auto';

    // Persist in session storage for persistence across reloads/routes
    try {
      sessionStorage.setItem('nyay_active_court_script', JSON.stringify({
        script: this._script,
        title: caseTitle,
        lang: this._activeLanguage
      }));
    } catch (_) {}

    if (window.Utils && typeof window.Utils.showToast === 'function') {
      window.Utils.showToast(`🏛️ ${this._script.length} अदालती दलीलों के साथ 3D Virtual Court शुरू हो रहा है...`, 'success');
    }

    if (typeof NyaySetuTTS !== 'undefined') {
      NyaySetuTTS.stop();
    }

    // Direct transition to 3D Virtual Courtroom Simulator
    Router.navigate('/court/simulate');
  },

  /**
   * Loads the active script from session storage or latest chat conversation.
   */
  loadActiveScript() {
    if (this._script && this._script.length > 0 && this._script[0]._isDynamic) {
      return;
    }

    // Check sessionStorage
    try {
      const cached = sessionStorage.getItem('nyay_active_court_script');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.script) && parsed.script.length > 0) {
          this._script = parsed.script.map(s => ({ ...s, _isDynamic: true }));
          this._activeCaseTitle = parsed.title || 'Supreme Court Special Bench';
          this._activeLanguage = parsed.lang || 'auto';
          return;
        }
      }
    } catch (_) {}

    // Fallback: check UserStore conversations
    const conversations = (typeof UserStore !== 'undefined' && UserStore.get('conversations')) || [];
    const conv = conversations.find(c => c.type === 'ai');
    if (conv && conv.messages) {
      for (let k = conv.messages.length - 1; k >= 0; k--) {
        const msg = conv.messages[k];
        if (msg.sender === 'ai' && msg.text && (msg.text.includes('🏛️') || msg.text.includes('Courtroom Debate'))) {
          const parsed = this.parseDebateFromText(msg.text);
          if (parsed.length > 0) {
            this._script = parsed.map(s => ({ ...s, _isDynamic: true }));
            this._activeCaseTitle = 'Live Case Debate';
            this._activeLanguage = msg.lang || 'auto';
            return;
          }
        }
      }
    }

    // Default fallback
    this._script = this._getDefaultFallbackScript();
  },

  _getDefaultFallbackScript() {
    return [
      {
        actor: 'JUDGE',
        name: 'Hon\'ble Chief Justice (Presiding)',
        text: 'Order, order in the Court. The Special Bench is now in session. Counsel for the Petitioner, proceed with your opening submissions.',
        pitch: 0.75, rate: 0.92, gavel: true,
        facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
      },
      {
        actor: 'DEFENSE',
        name: 'Adv. Defense Counsel (मेरा वकील)',
        text: 'Much obliged, Milord. We approach this Hon\'ble Bench challenging the grave procedural lapses and violations of constitutional safeguards under Article 21.',
        pitch: 1.0, rate: 1.0, gavel: false,
        facing: { DEFENSE: 0.85, PROSECUTION: -1.4 }
      },
      {
        actor: 'PROSECUTION',
        name: 'Adv. Public Prosecutor (विपक्षी वकील)',
        text: 'Objection, Milord! The prosecution has established a prima facie case based on cogent material on record. The petitioner cannot seek relief on mere procedural technicalities.',
        pitch: 1.22, rate: 1.02, gavel: false,
        facing: { DEFENSE: 1.4, PROSECUTION: -0.85 }
      },
      {
        actor: 'JUDGE',
        name: 'Hon\'ble Chief Justice (Presiding)',
        text: 'The Bench has noted the submissions. Procedural safeguards under the law are substantive rights. Both parties are directed to file their affidavits. The Court is adjourned.',
        pitch: 0.75, rate: 0.92, gavel: true,
        facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
      }
    ];
  },

  _cleanTextForVoice(text) {
    if (!text) return '';
    let cleaned = text;
    // Remove stage directions: *[Scrutinizing file]* or [Standing up]
    cleaned = cleaned.replace(/\*?\[.*?\]\*?/g, '');
    cleaned = cleaned.replace(/\*.*?\*/g, '');
    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    // Remove markdown symbols
    cleaned = cleaned.replace(/[*_#`~]/g, '');
    // Normalize spacing
    return cleaned.replace(/\s+/g, ' ').trim();
  },

  _detectIndianLanguage(text, hintLang = 'auto') {
    const str = (text || '').trim();
    const h = (hintLang || this._activeLanguage || 'auto').toLowerCase();

    // 1. Gujarati
    if (/[\u0A80-\u0AFF]/.test(str) || h === 'gu') {
      return { code: 'gu-IN', shortCode: 'gu', name: 'ગુજરાતી (Gujarati)', toneLabel: 'Indian Tone', displayBadge: 'ગુજરાતી (Indian Tone)' };
    }
    // 2. Telugu
    if (/[\u0C00-\u0C7F]/.test(str) || h === 'te') {
      return { code: 'te-IN', shortCode: 'te', name: 'తెలుగు (Telugu)', toneLabel: 'Indian Tone', displayBadge: 'తెలుగు (Indian Tone)' };
    }
    // 3. Tamil
    if (/[\u0B80-\u0BFF]/.test(str) || h === 'ta') {
      return { code: 'ta-IN', shortCode: 'ta', name: 'தமிழ் (Tamil)', toneLabel: 'Indian Tone', displayBadge: 'தமிழ் (Indian Tone)' };
    }
    // 4. Kannada
    if (/[\u0C80-\u0CFF]/.test(str) || h === 'kn') {
      return { code: 'kn-IN', shortCode: 'kn', name: 'ಕನ್ನಡ (Kannada)', toneLabel: 'Indian Tone', displayBadge: 'ಕನ್ನಡ (Indian Tone)' };
    }
    // 5. Malayalam
    if (/[\u0D00-\u0D7F]/.test(str) || h === 'ml') {
      return { code: 'ml-IN', shortCode: 'ml', name: 'മലയാളം (Malayalam)', toneLabel: 'Indian Tone', displayBadge: 'മലയാളം (Indian Tone)' };
    }
    // 6. Gurmukhi / Punjabi
    if (/[\u0A00-\u0A7F]/.test(str) || h === 'pa') {
      return { code: 'pa-IN', shortCode: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)', toneLabel: 'Indian Tone', displayBadge: 'ਪੰਜਾਬੀ (Indian Tone)' };
    }
    // 7. Bengali / Assamese
    if (/[\u0980-\u09FF]/.test(str) || h === 'bn' || h === 'as') {
      if (h === 'as' || /[ৰৱ]/.test(str)) {
        return { code: 'as-IN', shortCode: 'as', name: 'অসমীয়া (Assamese)', toneLabel: 'Indian Tone', displayBadge: 'অসমীয়া (Indian Tone)' };
      }
      return { code: 'bn-IN', shortCode: 'bn', name: 'বাংলা (Bengali)', toneLabel: 'Indian Tone', displayBadge: 'বাংলা (Indian Tone)' };
    }
    // 8. Odia
    if (/[\u0B00-\u0B7F]/.test(str) || h === 'or') {
      return { code: 'or-IN', shortCode: 'or', name: 'ଓଡ଼ିଆ (Odia)', toneLabel: 'Indian Tone', displayBadge: 'ଓଡ଼ିଆ (Indian Tone)' };
    }
    // 9. Perso-Arabic / Urdu
    if (/[\u0600-\u06FF]/.test(str) || h === 'ur') {
      return { code: 'ur-IN', shortCode: 'ur', name: 'اردو (Urdu)', toneLabel: 'Indian Tone', displayBadge: 'اردو (Indian Tone)' };
    }
    // 10. Devanagari (Marathi / Sanskrit / Nepali / Hindi)
    if (/[\u0900-\u097F]/.test(str)) {
      if (h === 'mr' || /(?:^|\s|[.,!?।])(आहे|नाही|झाले|केले|यांनी|दिले|म्हणून|असावे)(?:$|\s|[.,!?।])/.test(str)) {
        return { code: 'mr-IN', shortCode: 'mr', name: 'मराठी (Marathi)', toneLabel: 'Indian Tone', displayBadge: 'मराठी (Indian Tone)' };
      }
      if (h === 'sa' || /(?:^|\s|[.,!?।])(अस्ति|भवति|इति|च|तथा|न्यायालयम्|वादिः|प्रतिवादिः|धर्मो|रक्षति|कदापि)(?:$|\s|[.,!?।])/.test(str)) {
        return { code: 'sa-IN', shortCode: 'sa', name: 'संस्कृतम् (Sanskrit)', toneLabel: 'Indian Tone', displayBadge: 'संस्कृतम् (Indian Tone)' };
      }
      if (h === 'ne') {
        return { code: 'ne-NP', shortCode: 'ne', name: 'नेपाली (Nepali)', toneLabel: 'Indian Tone', displayBadge: 'नेपाली (Indian Tone)' };
      }
      return { code: 'hi-IN', shortCode: 'hi', name: 'हिन्दी (Hindi)', toneLabel: 'Indian Tone', displayBadge: 'हिन्दी (Indian Tone)' };
    }

    // 11. Latin Script: Hinglish vs Indian English
    if (h === 'hi' || /\b(mera|meri|zamin|zameen|padosi|kabza|farzi|vakeel|shikayat|karna|hoga|hai|hain|nahi|diya|tha|the|thi)\b/i.test(str)) {
      return { code: 'hi-IN', shortCode: 'hi', name: 'Hinglish (हिन्दी/English)', toneLabel: 'Indian Tone', displayBadge: 'Hinglish (Indian Tone)' };
    }

    // Default to Indian English Tone
    return { code: 'en-IN', shortCode: 'en', name: 'English (Indian)', toneLabel: 'Indian Tone', displayBadge: 'English (Indian Tone)' };
  },

  _getSpeechLanguageCode(text) {
    return this._detectIndianLanguage(text, this._activeLanguage).code;
  },

  // Camera Presets — default is WIDE; user can switch anytime
  CAMERAS: {
    WIDE:        { pos: [0, 3.5, 14.5],   target: [0, 1.4, 0] },
    JUDGE:       { pos: [0, 2.5, 3.5],    target: [0, 2.1, -1.8] },
    DEFENSE:     { pos: [-2.6, 3.2, 5.8], target: [-4.0, 2.9, 1.0] },
    PROSECUTION: { pos: [2.6, 3.2, 5.8],  target: [4.0, 2.9, 1.0] }
  },

  // Avatar Placement (world coordinates)
  SPEAKER_COORDS: {
    JUDGE:       { x: 0,  y: -0.45, z: -1.8 },  // Elevated so upper body, robes & head sit authoritatively behind bench = SEATED
    DEFENSE:     { x: -4, y: 0,     z: 1 },     // Standing behind advocate podium
    PROSECUTION: { x: 4,  y: 0,     z: 1 }      // Standing behind advocate podium
  },

  /* ==================== 1. UI RENDERING ==================== */
  renderLanding() {
    this.loadActiveScript();
    const hasActiveCase = this._script && this._script.length > 0 && this._script[0]._isDynamic;
    const caseTitle = this._activeCaseTitle || 'Supreme Court Special Bench Hearing';
    const totalTurns = (this._script && this._script.length) || 0;

    return `
      <div class="vc-hub-container" style="max-width:960px;margin:0 auto;padding:24px 20px;">
        <div class="vc-hero-banner" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:36px;color:#fff;border:1px solid rgba(255,255,255,0.1);box-shadow:0 10px 25px rgba(0,0,0,0.3);">
          <div class="vc-status-badge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:20px;font-size:0.75rem;font-weight:700;color:#818cf8;text-transform:uppercase;margin-bottom:16px;">
            <span class="material-symbols-rounded" style="font-size:16px">gavel</span>
            V4 WebGL Engine — 3-Avatar Courtroom Simulator
          </div>

          <h1 style="font-size:1.8rem;font-weight:800;margin-bottom:12px;color:#f8fafc;">3D Virtual Courtroom Simulator</h1>
          <p style="font-size:0.95rem;color:#94a3b8;max-width:680px;line-height:1.6;margin-bottom:24px;">
            Experience an immersive 3D courtroom hearing featuring real Supreme Court judge & advocate avatars, authentic gavel strikes, dynamic lawyer argument facing, and synchronized regional speech.
          </p>

          ${hasActiveCase ? `
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
              <div>
                <div style="font-size:0.72rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                  <span class="material-symbols-rounded" style="font-size:16px;color:#38bdf8">chat</span>
                  सक्रिय केस विश्लेषण (Active Case from Chat)
                </div>
                <div style="font-size:1.15rem;font-weight:700;color:#fff;">${Utils.escapeHtml(caseTitle)}</div>
                <div style="font-size:0.85rem;color:#cbd5e1;margin-top:4px;">🏛️ ${totalTurns} वास्तविक अदालती दलीलें (Judge, Defense & Prosecution Dialogue Exchanges) तैयार हैं</div>
                <div style="font-size:0.75rem;font-weight:700;color:#34d399;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);padding:3px 12px;border-radius:12px;display:inline-flex;align-items:center;gap:6px;margin-top:8px;">
                  <span class="material-symbols-rounded" style="font-size:15px;color:#10b981">translate</span>
                  <span>भाषा (Language & Tone): ${this._detectIndianLanguage((this._script && this._script[0] && this._script[0].text) || '', this._activeLanguage).displayBadge}</span>
                </div>
              </div>
              <button class="u-btn u-btn-primary u-btn-lg u-btn-pill" onclick="Router.navigate('/court/simulate')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;font-weight:700;box-shadow:0 4px 14px rgba(13,148,136,0.35);">
                <span class="material-symbols-rounded">play_arrow</span> Start 3D Court Debate
              </button>
            </div>
          ` : `
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
              <div>
                <div style="font-size:0.72rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">No Active Case Chat</div>
                <div style="font-size:1rem;font-weight:600;color:#fff;">Ask Nyay Setu चैट में अपना मामला दर्ज करें</div>
                <div style="font-size:0.82rem;color:#94a3b8;margin-top:4px;">AI आपकी समस्या के आधार पर 3-मिनट की वास्तविक अदालती बहस तैयार करेगा।</div>
              </div>
              <button class="u-btn u-btn-primary u-btn-pill" onclick="Router.navigate('/chat')" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;font-weight:700;">
                <span class="material-symbols-rounded">chat</span> Go to Ask Nyay Setu
              </button>
            </div>
          `}

          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/chat')" style="display:inline-flex;align-items:center;gap:6px;">
              <span class="material-symbols-rounded">arrow_back</span> Return to Chat
            </button>
            ${!hasActiveCase ? `
              <button class="u-btn u-btn-outline u-btn-pill" onclick="Router.navigate('/court/simulate')" style="display:inline-flex;align-items:center;gap:6px;border-color:rgba(255,255,255,0.25);color:#fff;">
                <span class="material-symbols-rounded">play_arrow</span> View Demo Simulation
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  render() {
    this.loadActiveScript();
    const caseTitle = this._activeCaseTitle || 'Supreme Court Special Bench Hearing';

    return `
      <div class="v3-simulation-wrapper" id="v3-wrapper">
        <div class="v3-loading-overlay" id="v3-loader">
          <div class="v3-spinner"></div>
          <div style="font-size:0.85rem;color:var(--u-text-tertiary);letter-spacing:1px;text-transform:uppercase;">Initializing 3D Courtroom...</div>
        </div>

        <!-- Gavel Strike Alert -->
        <div class="v3-gavel-alert" id="v3-gavel-alert">
          <span class="material-symbols-rounded">gavel</span>
          <span>Order in the Court</span>
        </div>

        <!-- Three.js mounts here -->
        <canvas class="v3-webgl-canvas" id="v3-canvas"></canvas>

        <div class="v3-hud-overlay">
          <div class="v3-hud-top">
            <div class="v3-hud-controls">
              <!-- Back to Chat Button -->
              <button class="v3-control-btn" onclick="VirtualCourtSimulator.exitToChat()" title="Return to Ask Nyay Setu Chat" style="background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.25);">
                <span class="material-symbols-rounded">arrow_back</span>
                <span>Chat</span>
              </button>

              <div class="v3-camera-controls" id="v3-cams">
                <button class="v3-cam-btn active" id="v3-cam-wide" onclick="VirtualCourtSimulator.setCamera('WIDE', true)" title="Wide Courtroom View (Default)">
                  <span class="material-symbols-rounded">panorama</span> WIDE
                </button>
                <button class="v3-cam-btn" id="v3-cam-judge" onclick="VirtualCourtSimulator.setCamera('JUDGE', true)" title="Judge Bench Camera">
                  <span class="material-symbols-rounded">gavel</span> JUDGE
                </button>
                <button class="v3-cam-btn" id="v3-cam-defense" onclick="VirtualCourtSimulator.setCamera('DEFENSE', true)" title="Defense Counsel Camera">
                  <span class="material-symbols-rounded">person</span> DEFENSE
                </button>
                <button class="v3-cam-btn" id="v3-cam-pros" onclick="VirtualCourtSimulator.setCamera('PROSECUTION', true)" title="Prosecution Counsel Camera">
                  <span class="material-symbols-rounded">person</span> PROS
                </button>
              </div>

              <!-- Pause / Resume Button -->
              <button class="v3-control-btn" id="v3-pause-btn" onclick="VirtualCourtSimulator.togglePause()" title="Pause / Resume Debate">
                <span class="material-symbols-rounded" id="v3-pause-icon">pause</span>
                <span id="v3-pause-text">PAUSE</span>
              </button>
            </div>

            <!-- Case Title & Exchange Progress in HUD -->
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="v3-case-title-badge" id="v3-case-title" style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(15,23,42,0.75);border:1px solid rgba(255,255,255,0.2);border-radius:20px;font-size:0.76rem;font-weight:600;color:#f8fafc;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.escapeHtml(caseTitle)}">
                <span class="material-symbols-rounded" style="font-size:15px;color:#f59e0b">balance</span>
                <span id="v3-case-title-text">${Utils.escapeHtml(caseTitle)}</span>
              </div>

              <!-- Active Language & Indian Tone Badge -->
              <div class="v3-lang-badge" id="v3-lang-badge" title="Active Courtroom Language & Tone">
                <span class="material-symbols-rounded">translate</span>
                <span id="v3-lang-badge-text">${this._detectIndianLanguage((this._script && this._script[0] && this._script[0].text) || '', this._activeLanguage).displayBadge}</span>
              </div>

              <span class="v3-exchange-badge" id="v3-exchange-badge" style="font-size:0.72rem;font-weight:700;color:#38bdf8;padding:3px 10px;background:rgba(56,189,248,0.15);border-radius:12px;border:1px solid rgba(56,189,248,0.35);">
                Turn 1 / ${this._script.length || 1}
              </span>
              <div class="v3-hud-status recording" id="v3-status">
                <span class="material-symbols-rounded" id="v3-status-icon">fiber_manual_record</span>
                <span id="v3-status-text">IN SESSION</span>
              </div>
            </div>
          </div>

          <div class="v3-hud-bottom">
            <div class="v3-subtitle-container" id="v3-subtitle">
              <span class="v3-speaker-name" id="v3-speaker">
                <span id="v3-speaker-text"></span>
                <span class="v3-audio-wave">
                  <span class="v3-audio-bar"></span>
                  <span class="v3-audio-bar"></span>
                  <span class="v3-audio-bar"></span>
                  <span class="v3-audio-bar"></span>
                </span>
              </span>
              <p class="v3-subtitle-text" id="v3-subtitle-text"></p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  exitToChat() {
    this.stopSimulation();
    Router.navigate('/chat');
  },

  /* ==================== 2. WEBGL INITIALIZATION ==================== */
  startSimulation() {
    if (this._isPlaying) {
      this.stopSimulation();
    }
    this.loadActiveScript();
    this._isPlaying = true;
    this._isPaused = false;
    this._currentStep = 0;
    this._cameraMode = 'WIDE';
    this._stepTimeout = null;
    this._mixers = {};
    this._actions = {};
    this._avatarModels = {};
    this._targetRotations = {
      JUDGE: 0,
      DEFENSE: 0.35,
      PROSECUTION: -0.35
    };
    this._speakerRings = {};

    // Preload speech synthesis voices (required in Chrome)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    setTimeout(() => {
      this._initThreeJS();
      this._buildEnvironment();
      this._initAudio();

      const loader = document.getElementById('v3-loader');
      if (loader) loader.classList.add('hidden');

      // Start render loop
      this._animate();

      // Start script after short delay for models to load
      setTimeout(() => this._playNextStep(), 2500);
    }, 400);
  },

  _initThreeJS() {
    const canvas = document.getElementById('v3-canvas');
    const wrapper = document.getElementById('v3-wrapper');
    if (!canvas || !wrapper) return;

    this._scene = new THREE.Scene();

    const aspect = wrapper.clientWidth / wrapper.clientHeight;
    this._camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 500);

    this._cameraPos = new THREE.Vector3(...this.CAMERAS.WIDE.pos);
    this._cameraTarget = new THREE.Vector3(...this.CAMERAS.WIDE.target);
    this._currentLookAt = this._cameraTarget.clone();
    this._camera.position.copy(this._cameraPos);
    this._camera.lookAt(this._currentLookAt);

    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 0.92;
    this._renderer.outputEncoding = THREE.sRGBEncoding;

    this._clock = new THREE.Clock();

    // Window resize handler
    this._resizeHandler = this._onWindowResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
  },

  _onWindowResize() {
    const wrapper = document.getElementById('v3-wrapper');
    if (!wrapper || !this._camera || !this._renderer) return;
    this._camera.aspect = wrapper.clientWidth / wrapper.clientHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  },

  // Generates authentic rich polished mahogany/teak wood texture
  _createWoodTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base deep mahogany wood color
    const baseColor = isDark ? '#2a1207' : '#3e1b0c';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Natural wood grain wavy lines
    for (let y = 0; y < 512; y += 2) {
      const alpha = 0.15 + Math.sin(y * 0.04 + Math.sin(y * 0.012) * 3) * 0.1;
      ctx.fillStyle = (y % 4 === 0) ? `rgba(10, 4, 1, ${alpha})` : `rgba(88, 38, 16, ${alpha * 0.8})`;
      ctx.fillRect(0, y, 512, 2);
    }

    // Wood vertical plank paneling seams
    for (let x = 64; x < 512; x += 128) {
      ctx.fillStyle = 'rgba(8, 3, 1, 0.45)';
      ctx.fillRect(x, 0, 3, 512);
      ctx.fillStyle = 'rgba(110, 52, 22, 0.25)';
      ctx.fillRect(x + 3, 0, 1, 512);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
  },

  /* ==================== 3. SCENE CONSTRUCTION ==================== */
  _buildEnvironment() {
    // === DARK COURTROOM ATMOSPHERE ===
    this._scene.background = new THREE.Color(0x060809);
    this._scene.fog = new THREE.FogExp2(0x060809, 0.008);

    // === BALANCED LIGHTING (Rich Wood Tones without Washout) ===

    // 1. Warm ambient fill light
    const ambient = new THREE.AmbientLight(0xffeedd, 0.22);
    this._scene.add(ambient);

    // 2. Hemisphere light (cool upper sky, warm hardwood reflections)
    const hemi = new THREE.HemisphereLight(0x8faab4, 0x3d2b1f, 0.25);
    hemi.position.set(0, 20, 0);
    this._scene.add(hemi);

    // 3. Overhead courtroom chandelier (focused warm directional)
    const mainLight = new THREE.DirectionalLight(0xfff4e8, 0.7);
    mainLight.position.set(0, 15, 6);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this._scene.add(mainLight);

    // 4. Active-speaker tracking spotlight
    this._spotLightTarget = new THREE.Object3D();
    this._spotLightTarget.position.set(0, 0, 0);
    this._scene.add(this._spotLightTarget);

    this._spotLight = new THREE.SpotLight(0xffedd0, 0.85, 35, Math.PI / 6, 0.5, 1.2);
    this._spotLight.position.set(0, 12, 10);
    this._spotLight.target = this._spotLightTarget;
    this._spotLight.castShadow = true;
    this._scene.add(this._spotLight);

    // 5. Window accent light (subtle daylight from court windows)
    const windowLight = new THREE.DirectionalLight(0x6699cc, 0.22);
    windowLight.position.set(-10, 8, 0);
    this._scene.add(windowLight);

    // Create authentic wood textures
    const darkWoodTex = this._createWoodTexture(true);
    const warmWoodTex = this._createWoodTexture(false);

    // === COURTROOM FLOOR ===
    const floorGeo = new THREE.PlaneGeometry(40, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a100a, // Dark polished courtroom parquet floor
      roughness: 0.65,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this._scene.add(floor);

    // === JUDGE'S BENCH (Rich Polished Mahogany & Teak Wood Desk) ===
    // 1. Main Bench Base with Wood Texture
    const benchGeo = new THREE.BoxGeometry(8.4, 2.0, 3.2);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x4a2212, // Rich dark polished mahogany
      map: darkWoodTex,
      roughness: 0.38,
      metalness: 0.08
    });
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(0, 1.0, -2);
    bench.castShadow = true;
    bench.receiveShadow = true;
    this._scene.add(bench);

    // 2. Bench Top Molding (Polished Teak Wood Counter Top)
    const benchTopGeo = new THREE.BoxGeometry(8.8, 0.16, 3.4);
    const benchTopMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d16, // Polished rich wood counter
      map: warmWoodTex,
      roughness: 0.3,
      metalness: 0.1
    });
    const benchTop = new THREE.Mesh(benchTopGeo, benchTopMat);
    benchTop.position.set(0, 2.05, -2);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    this._scene.add(benchTop);

    // 3. Front Carved Wood Panels with Insets and Golden Molding
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x623018, // Warm carved wood accent
      map: warmWoodTex,
      roughness: 0.42,
      metalness: 0.05
    });
    const panelInnerMat = new THREE.MeshStandardMaterial({
      color: 0x1c0c05, // Dark recessed wood inlay
      roughness: 0.7
    });

    [-2.7, 0, 2.7].forEach((xOffset, i) => {
      const w = i === 1 ? 2.6 : 2.2;
      // Outer raised frame
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 0.1), panelMat);
      p.position.set(xOffset, 1.1, -0.36);
      this._scene.add(p);
      // Inner recessed panel
      const pInner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 1.15, 0.08), panelInnerMat);
      pInner.position.set(xOffset, 1.1, -0.32);
      this._scene.add(pInner);
    });

    // 4. Executive Leather Desk Blotter Pad (Dark Forest Green with Gold Border)
    const blotter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.02, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x0f2b18, roughness: 0.75 })
    );
    blotter.position.set(0, 2.14, -1.2);
    this._scene.add(blotter);

    // 5. Wooden Gavel Sound Block & Gavel on Desk
    const soundBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.34, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: 0x542914, roughness: 0.38, metalness: 0.1 })
    );
    soundBlock.position.set(1.4, 2.16, -0.95);
    this._scene.add(soundBlock);

    const gavelHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.26, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a2d16, roughness: 0.35 })
    );
    gavelHead.rotation.z = Math.PI / 2;
    gavelHead.position.set(1.4, 2.22, -0.95);
    this._scene.add(gavelHead);

    const gavelHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: 0x482312, roughness: 0.4 })
    );
    gavelHandle.rotation.x = Math.PI / 2;
    gavelHandle.position.set(1.4, 2.22, -0.72);
    this._scene.add(gavelHandle);

    // 6. Legal Case Briefs / Law Books on Desk
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.5 }) // Red legal volume
    );
    book1.position.set(-2.5, 2.18, -1.1);
    this._scene.add(book1);

    const book2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.09, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }) // Blue legal volume
    );
    book2.position.set(-2.5, 2.27, -1.1);
    this._scene.add(book2);

    // 7. Judge's Executive High-Back Chair (Visible seated frame behind judge)
    const chairBack = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.4, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 0.55, metalness: 0.05 }) // Dark executive leather
    );
    chairBack.position.set(0, 2.1, -2.4);
    chairBack.castShadow = true;
    this._scene.add(chairBack);

    const chairHeadrest = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.5, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x18120e, roughness: 0.5 })
    );
    chairHeadrest.position.set(0, 3.2, -2.4);
    this._scene.add(chairHeadrest);

    const chairFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 2.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x482414, roughness: 0.4 }) // Mahogany wood frame
    );
    chairFrame.position.set(0, 2.2, -2.52);
    this._scene.add(chairFrame);

    // Ashoka Emblem (bronze gold medallion on court wall)
    const emblemGeo = new THREE.CircleGeometry(0.85, 32);
    const emblemMat = new THREE.MeshStandardMaterial({
      color: 0xc49b38,
      roughness: 0.35,
      metalness: 0.75,
      emissive: 0xc49b38,
      emissiveIntensity: 0.04
    });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0, 5.2, -3.4);
    this._scene.add(emblem);

    // === ADVOCATE PODIUMS (Matching Dark Mahogany Wood) ===
    const podiumGeo = new THREE.BoxGeometry(2.5, 1.2, 1.5);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x4a2212, // Matching rich dark mahogany
      map: darkWoodTex,
      roughness: 0.38,
      metalness: 0.08
    });
    const podiumTopMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d16,
      map: warmWoodTex,
      roughness: 0.3
    });

    [-4, 4].forEach(xPos => {
      const pod = new THREE.Mesh(podiumGeo, podiumMat.clone());
      pod.position.set(xPos, 0.6, 1);
      pod.castShadow = true;
      pod.receiveShadow = true;
      this._scene.add(pod);

      // Angled document reading slope
      const topSlope = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 1.2), podiumTopMat.clone());
      topSlope.position.set(xPos, 1.25, 0.95);
      topSlope.rotation.x = -0.18; // Angled toward advocate
      this._scene.add(topSlope);

      // Legal papers sheet
      const papers = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.02, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xf4eedb, roughness: 0.8 })
      );
      papers.position.set(xPos - 0.3, 1.28, 0.95);
      papers.rotation.x = -0.18;
      this._scene.add(papers);

      // Advocate microphone stand
      const micBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 })
      );
      micBase.position.set(xPos + 0.6, 1.28, 0.7);
      this._scene.add(micBase);

      const micStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 })
      );
      micStem.position.set(xPos + 0.6, 1.45, 0.75);
      micStem.rotation.x = 0.25;
      this._scene.add(micStem);
    });

    // === COURTROOM RAILING (Polished Mahogany Wood Bar) ===
    const railGeo = new THREE.BoxGeometry(20, 0.12, 0.18);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d16, // Polished mahogany bar
      map: warmWoodTex,
      roughness: 0.32,
      metalness: 0.08
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, 1.1, 4);
    this._scene.add(rail);

    // Rail Posts
    for (let x = -10; x <= 10; x += 2.5) {
      const postGeo = new THREE.CylinderGeometry(0.065, 0.065, 1.1, 12);
      const post = new THREE.Mesh(postGeo, railMat.clone());
      post.position.set(x, 0.55, 4);
      this._scene.add(post);
    }

    // === BACK WALL & WOOD WAINSCOTING ===
    const wallGeo = new THREE.PlaneGeometry(40, 15);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x140e0a,
      roughness: 0.9,
      metalness: 0
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 7, -3.5);
    this._scene.add(backWall);

    // Dark mahogany wood wainscot paneling on lower back wall
    const wainscotGeo = new THREE.PlaneGeometry(40, 5);
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0x3d1b0c,
      map: darkWoodTex,
      roughness: 0.45
    });
    const wainscot = new THREE.Mesh(wainscotGeo, wainscotMat);
    wainscot.position.set(0, 2.5, -3.48);
    this._scene.add(wainscot);

    // === SIDE WALLS ===
    const sideWallGeo = new THREE.PlaneGeometry(30, 15);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat.clone());
    leftWall.position.set(-20, 7, 0);
    leftWall.rotation.y = Math.PI / 2;
    this._scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat.clone());
    rightWall.position.set(20, 7, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this._scene.add(rightWall);

    // === 3D NAMEPLATE LABELS (HTML labels via 3D positioned objects — glow indicators) ===
    Object.keys(this.SPEAKER_COORDS).forEach(key => {
      const coord = this.SPEAKER_COORDS[key];

      // Glowing base ring for active speaker
      const ringGeo = new THREE.RingGeometry(0.8, 0.95, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: key === 'JUDGE' ? 0xd4a847 : 0x0d9488,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(coord.x, 0.02, coord.z);
      ring.rotation.x = -Math.PI / 2;
      this._scene.add(ring);
      this._speakerRings[key] = ring;
    });

    // === LOAD 3 AVATARS ===
    // Judge: rotY = 0 (Faces forward toward courtroom, lawyers, and audience)
    this._loadAvatar(this.AVATAR_FILES.JUDGE, 'JUDGE', 2.5, 0, 0);
    // Defense: rotY = 0.35 (Faces courtroom/judge, dynamically swivels to 0.85 for Judge and 1.42 for Opponent)
    this._loadAvatar(this.AVATAR_FILES.DEFENSE, 'DEFENSE', 2.5, 0.35, 0);
    // Prosecution: rotY = -0.35 (Faces courtroom/judge, dynamically swivels to -0.85 for Judge and -1.42 for Opponent)
    this._loadAvatar(this.AVATAR_FILES.PROSECUTION, 'PROSECUTION', 2.5, -0.35, 0);
  },

  _loadAvatar(url, actorKey, scale, rotY, adjustY) {
    if (!window.THREE || !window.THREE.GLTFLoader) {
      console.error('GLTFLoader not available');
      return;
    }
    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load(url, (gltf) => {
      const model = gltf.scene;
      const coord = this.SPEAKER_COORDS[actorKey];
      model.position.set(coord.x, coord.y + adjustY, coord.z);
      model.scale.set(scale, scale, scale);
      model.rotation.y = rotY;

      // Store model reference for dynamic rotation swivel
      this._avatarModels[actorKey] = model;

      // Enable shadows AND apply realistic skin tones + black court dress
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const mat = child.material.clone();
            const name = (child.name || '').toLowerCase();

            if (name.includes('head')) {
              // Natural warm human skin tone
              mat.color = new THREE.Color(0xdca88c);
              mat.roughness = 0.65;
              mat.metalness = 0.0;
            } else if (name.includes('eyeball') || name.includes('cornea')) {
              // Natural white sclera with dark iris
              mat.color = new THREE.Color(0xf2f2f2);
              mat.roughness = 0.2;
            } else if (name.includes('eyelash') || name.includes('hair')) {
              // Dark brown/black hair and eyelashes
              mat.color = new THREE.Color(0x1a1412);
              mat.roughness = 0.85;
            } else if (name.includes('teeth')) {
              mat.color = new THREE.Color(0xeee9dd);
            } else if (name.includes('body')) {
              // Neck and hands
              mat.color = new THREE.Color(0xdca88c);
              mat.roughness = 0.65;
            } else {
              // Professional attire
              if (actorKey === 'JUDGE') {
                // Judge black judicial robe
                mat.color = new THREE.Color(0x0e0e12);
                mat.roughness = 0.82;
                mat.metalness = 0.02;
              } else {
                // Advocate black coat & trousers
                mat.color = new THREE.Color(0x131318);
                mat.roughness = 0.78;
                mat.metalness = 0.04;
              }
            }
            child.material = mat;
          }
        }
      });

      // Per-avatar warm fill light (soft, non-overexposing)
      const avatarLight = new THREE.PointLight(
        actorKey === 'JUDGE' ? 0xffe8d0 : 0xffffff,
        0.28, 10
      );
      avatarLight.position.set(coord.x, coord.y + 3.8, coord.z + 2.0);
      this._scene.add(avatarLight);

      this._scene.add(model);

      // Set up animation
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        this._mixers[actorKey] = mixer;
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        action.paused = true; // Start paused until it's their turn to speak
        this._actions[actorKey] = action;
      }

      console.log(`Avatar loaded: ${actorKey}`);
    }, undefined, (error) => {
      console.error(`Failed to load avatar ${actorKey}:`, error);
    });
  },

  /* ==================== 4. AUDIO ==================== */
  _initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this._audioContext = new AudioCtx();
    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  },

  _playGavelSound() {
    if (!this._audioContext) return;
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }

    const now = this._audioContext.currentTime;

    // Show visual gavel alert badge
    const gavelAlert = document.getElementById('v3-gavel-alert');
    if (gavelAlert) {
      gavelAlert.classList.add('active');
      setTimeout(() => gavelAlert.classList.remove('active'), 1800);
    }

    // Double strike: Strike 1 at t=0, Strike 2 at t=0.22s
    [0, 0.22].forEach(delay => {
      const osc = this._audioContext.createOscillator();
      const gain = this._audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now + delay);
      osc.frequency.exponentialRampToValueAtTime(35, now + delay + 0.12);

      gain.gain.setValueAtTime(0.65, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);

      osc.connect(gain);
      gain.connect(this._audioContext.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.15);
    });
  },

  /* ==================== 5. ANIMATION LOOP ==================== */
  _animate() {
    this._animationFrameId = requestAnimationFrame(this._animate.bind(this));
    this._cameraDriftTime += 0.008;

    // Update all avatar animation mixers
    if (this._clock) {
      const delta = this._clock.getDelta();
      Object.values(this._mixers).forEach(mixer => mixer.update(delta));
    }

    // 1. Cinematic Camera Lerping
    if (this._camera && this._cameraPos && this._cameraTarget) {
      this._camera.position.lerp(this._cameraPos, 0.04);

      // Subtle handheld broadcast camera drift
      const driftX = Math.sin(this._cameraDriftTime * 0.7) * 0.08;
      const driftY = Math.cos(this._cameraDriftTime * 0.9) * 0.05;

      this._currentLookAt.lerp(this._cameraTarget, 0.05);
      const lookTarget = this._currentLookAt.clone().add(new THREE.Vector3(driftX, driftY, 0));
      this._camera.lookAt(lookTarget);
    }

    // 2. Spotlight tracks active speaker
    if (this._spotLightTarget && this._activeSpeakerId && this.SPEAKER_COORDS[this._activeSpeakerId]) {
      const targetCoord = this.SPEAKER_COORDS[this._activeSpeakerId];
      this._spotLightTarget.position.lerp(
        new THREE.Vector3(targetCoord.x, targetCoord.y + 1, targetCoord.z), 0.06
      );
    }

    // 3. Pulsing floor rings for active speaker
    Object.keys(this._speakerRings).forEach(id => {
      const ring = this._speakerRings[id];
      if (id === this._activeSpeakerId) {
        ring.material.opacity = 0.5 + Math.sin(this._cameraDriftTime * 6) * 0.3;
        const s = 1.0 + Math.sin(this._cameraDriftTime * 4) * 0.15;
        ring.scale.set(s, s, 1);
      } else {
        ring.material.opacity = Math.max(0, ring.material.opacity - 0.03);
      }
    });

    // 4. Smoothly swivel lawyers toward dynamic targets (Judge vs Opponent)
    if (this._avatarModels.DEFENSE) {
      this._avatarModels.DEFENSE.rotation.y = THREE.MathUtils.lerp(
        this._avatarModels.DEFENSE.rotation.y,
        this._targetRotations.DEFENSE,
        0.045
      );
    }
    if (this._avatarModels.PROSECUTION) {
      this._avatarModels.PROSECUTION.rotation.y = THREE.MathUtils.lerp(
        this._avatarModels.PROSECUTION.rotation.y,
        this._targetRotations.PROSECUTION,
        0.045
      );
    }

    // Render
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  },

  /* ==================== 6. ORCHESTRATION & CONTROLS ==================== */
  setCamera(presetId, isUserAction = false) {
    const preset = this.CAMERAS[presetId];
    if (!preset) return;

    if (isUserAction) {
      this._cameraMode = presetId;
    }

    this._cameraPos.set(...preset.pos);
    this._cameraTarget.set(...preset.target);

    // Update UI active buttons
    document.querySelectorAll('.v3-cam-btn').forEach(b => b.classList.remove('active'));
    const btnMap = {
      WIDE: 'v3-cam-wide',
      JUDGE: 'v3-cam-judge',
      DEFENSE: 'v3-cam-defense',
      PROSECUTION: 'v3-cam-pros'
    };
    const targetBtnId = btnMap[presetId];
    if (targetBtnId) {
      const el = document.getElementById(targetBtnId);
      if (el) el.classList.add('active');
    }
  },

  togglePause() {
    if (!this._isPlaying) return;
    this._isPaused = !this._isPaused;

    const pauseBtn = document.getElementById('v3-pause-btn');
    const pauseIcon = document.getElementById('v3-pause-icon');
    const pauseText = document.getElementById('v3-pause-text');
    const statusEl = document.getElementById('v3-status');
    const statusIcon = document.getElementById('v3-status-icon');
    const statusText = document.getElementById('v3-status-text');
    const subContainer = document.getElementById('v3-subtitle');

    if (this._isPaused) {
      // 1. Cancel speech cleanly
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // 2. Clear any pending step advance timer
      if (this._stepTimeout) {
        clearTimeout(this._stepTimeout);
        this._stepTimeout = null;
      }
      // 3. Pause all active avatar animations
      Object.values(this._actions).forEach(action => { action.paused = true; });

      // 4. Update UI to PAUSED state
      if (pauseBtn) pauseBtn.classList.add('v3-btn-paused');
      if (pauseIcon) pauseIcon.innerText = 'play_arrow';
      if (pauseText) pauseText.innerText = 'RESUME';

      if (statusEl) {
        statusEl.classList.remove('recording');
        statusEl.classList.add('paused');
      }
      if (statusIcon) statusIcon.innerText = 'pause_circle';
      if (statusText) statusText.innerText = 'PAUSED';

      if (subContainer) subContainer.classList.add('paused');
    } else {
      // RESUME
      if (pauseBtn) pauseBtn.classList.remove('v3-btn-paused');
      if (pauseIcon) pauseIcon.innerText = 'pause';
      if (pauseText) pauseText.innerText = 'PAUSE';

      if (statusEl) {
        statusEl.classList.remove('paused');
        statusEl.classList.add('recording');
      }
      if (statusIcon) statusIcon.innerText = 'fiber_manual_record';
      if (statusText) statusText.innerText = 'IN SESSION';

      if (subContainer) subContainer.classList.remove('paused');

      // Unpause active speaker avatar
      if (this._activeSpeakerId && this._actions[this._activeSpeakerId]) {
        this._actions[this._activeSpeakerId].paused = false;
      }

      // Resume playback from current step
      this._resumeCurrentStep();
    }
  },

  _resumeCurrentStep() {
    if (!this._isPlaying || this._isPaused) return;
    if (this._currentStep >= this._script.length) {
      this._endSimulation();
      return;
    }

    const step = this._script[this._currentStep];
    this._activeSpeakerId = step.actor;

    // Dynamic lawyer facing for current step
    if (step.facing) {
      if (step.facing.DEFENSE !== undefined) this._targetRotations.DEFENSE = step.facing.DEFENSE;
      if (step.facing.PROSECUTION !== undefined) this._targetRotations.PROSECUTION = step.facing.PROSECUTION;
    }

    if (this._actions[step.actor]) {
      this._actions[step.actor].paused = false;
    }

    const subContainer = document.getElementById('v3-subtitle');
    const speakerTextEl = document.getElementById('v3-speaker-text');
    const textEl = document.getElementById('v3-subtitle-text');

    if (speakerTextEl) speakerTextEl.innerText = step.name;
    if (textEl) textEl.innerHTML = this._highlightLegalPointsInText(step.text);
    if (subContainer) subContainer.classList.add('active');

    this._speakText(step.text, step.pitch, step.rate, () => {
      if (this._isPaused) return;
      if (subContainer) subContainer.classList.remove('active');
      this._activeSpeakerId = null;

      Object.values(this._actions).forEach(action => { action.paused = true; });

      this._currentStep++;
      this._stepTimeout = setTimeout(() => this._playNextStep(), 1200);
    });
  },

  _playNextStep() {
    if (!this._isPlaying || this._isPaused) return;
    if (this._currentStep >= this._script.length) {
      this._endSimulation();
      return;
    }

    const step = this._script[this._currentStep];
    this._activeSpeakerId = step.actor;

    // Update Turn Badge in HUD
    const exchangeBadge = document.getElementById('v3-exchange-badge');
    if (exchangeBadge) {
      exchangeBadge.style.display = 'inline-block';
      exchangeBadge.innerText = `Turn ${this._currentStep + 1} / ${this._script.length}`;
    }

    // Update Case Title in HUD
    const titleEl = document.getElementById('v3-case-title-text');
    if (titleEl && this._activeCaseTitle) {
      titleEl.innerText = this._activeCaseTitle;
    }

    // Update Active Language & Indian Tone Badge in HUD
    const langBadgeText = document.getElementById('v3-lang-badge-text');
    if (langBadgeText) {
      const stepLangInfo = this._detectIndianLanguage(step.text, this._activeLanguage);
      langBadgeText.innerText = stepLangInfo.displayBadge;
    }

    // 1. Dynamic Lawyer Orientation based on who is being addressed
    if (step.facing) {
      if (step.facing.DEFENSE !== undefined) {
        this._targetRotations.DEFENSE = step.facing.DEFENSE;
      }
      if (step.facing.PROSECUTION !== undefined) {
        this._targetRotations.PROSECUTION = step.facing.PROSECUTION;
      }
    }

    // 2. Play Gavel Strike if indicated
    if (step.gavel) {
      this._playGavelSound();
    }

    // 3. Show Subtitles & Audio Wave with Legal Highlighting
    const subContainer = document.getElementById('v3-subtitle');
    const speakerTextEl = document.getElementById('v3-speaker-text');
    const textEl = document.getElementById('v3-subtitle-text');

    if (speakerTextEl) speakerTextEl.innerText = step.name;
    if (textEl) textEl.innerHTML = this._highlightLegalPointsInText(step.text);
    if (subContainer) subContainer.classList.add('active');

    // 4. Sync Avatar Animation — only active speaker animates
    Object.keys(this._actions).forEach(actor => {
      const action = this._actions[actor];
      if (actor === step.actor) {
        action.paused = false;
      } else {
        action.paused = true;
      }
    });

    // 5. Speak text via Web Speech API with clean spoken text
    this._speakText(step.text, step.pitch, step.rate, () => {
      if (this._isPaused) return; // Do not advance if user paused while speaking
      if (subContainer) subContainer.classList.remove('active');
      this._activeSpeakerId = null;

      // Pause all avatars
      Object.values(this._actions).forEach(action => { action.paused = true; });

      this._currentStep++;
      this._stepTimeout = setTimeout(() => this._playNextStep(), 1200);
    });
  },

  // Highlighting of statutory sections, precedents, and critical arguments in subtitles
  _highlightLegalPointsInText(text) {
    if (!text) return '';
    let escaped = Utils.escapeHtml(text);

    // 1. Highlight Statutory Sections & Acts (Amber badge)
    escaped = escaped.replace(
      /(?:धारा|दफा|Section|Sec\.?)\s*\d+[\w\s\(\)]*|Order\s*\d+\s*Rule\s*\d+|ऑर्डर\s*\d+\s*रूल\s*\d+|आदेश\s*\d+\s*नियम\s*\d+|Article\s*\d+|अनुच्छेद\s*\d+|IPC|आईपीसी|CrPC|सीआरपीसी|CPC|सीपीसी|BNS|BNSS|NDPS|NI Act/gi,
      '<span class="v3-legal-badge-section">$&</span>'
    );

    // 2. Highlight Landmark Principles & Precedents (Cyan badge)
    escaped = escaped.replace(
      /Unbroken Chain of Circumstances|Due process of law|Civil Appeal[^\,\.\n\<]*|Supreme Court|High Court|साक्ष्यों की अटूट श्रृंखला|कानून की उचित प्रक्रिया|Interim Injunction|Stay Order|अस्थाई निषेधाज्ञा|Prima facie/gi,
      '<span class="v3-legal-badge-precedent">$&</span>'
    );

    // 3. Highlight Crucial Evidentiary & Statutory Arguments (Rose/Red badge)
    escaped = escaped.replace(
      /निर्ममता से हत्या|शव को छुपाया|हल्की धारा|अपराध स्वीकार|forged agreement|farzi agreement|illegal kabza|balpurvak kabza|Mandatory requirement|mandatory statutory safeguard|Fatal defect|Order, order/gi,
      '<span class="v3-legal-badge-critical">$&</span>'
    );

    return escaped;
  },

  // Voice preference per actor: Exactly 1 Female Voice (Prosecution) + 2 Distinct Male Voices (Judge & Defense)
  _voicePrefs: {
    JUDGE: { gender: 'male', preferredName: 'david', basePitch: 0.74, baseRate: 0.88 },
    DEFENSE: { gender: 'male', preferredName: 'mark', basePitch: 1.02, baseRate: 0.98 },
    PROSECUTION: { gender: 'female', preferredName: 'zira', basePitch: 1.16, baseRate: 1.02 }
  },

  _findVoice(actorKey, langCode = 'hi-IN') {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const shortLang = (langCode || 'hi').split('-')[0].toLowerCase();

    // 1. Identify Indian voices explicitly (marked with '-IN', 'India', 'Indian', or authentic Indian names)
    const isIndianVoice = (v) => {
      const l = (v.lang || '').toUpperCase();
      const n = (v.name || '').toLowerCase();
      return l.includes('-IN') || l.includes('_IN') ||
             n.includes('india') || n.includes('indian') ||
             n.includes('ravi') || n.includes('heera') || n.includes('hemant') ||
             n.includes('kalpana') || n.includes('madhav') || n.includes('valluvar') ||
             n.includes('swara') || n.includes('neerja') || n.includes('veena') ||
             n.includes('हिन्दी') || n.includes('বাংলা') || n.includes('తెలుగు') ||
             n.includes('தமிழ்') || n.includes('मराठी') || n.includes('ગુજરાતી');
    };

    const isFemale = (v) => {
      const n = (v.name || '').toLowerCase();
      return n.includes('female') || n.includes('woman') || n.includes('zira') ||
             n.includes('kalpana') || n.includes('heera') || n.includes('swara') ||
             n.includes('neerja') || n.includes('hazel') || n.includes('catherine') ||
             n.includes('fiona') || n.includes('veena') || n.includes('susan') ||
             n.includes('linda') || n.includes('samantha') || n.includes('victoria');
    };

    const isMale = (v) => !isFemale(v);

    // Exact regional language voices
    const langExactVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(shortLang));
    // Any Indian locale voice
    const indianVoices = voices.filter(isIndianVoice);

    if (actorKey === 'PROSECUTION') {
      // 1 FEMALE VOICE (Public Prosecutor)
      // Highest priority: exact language female Indian voice
      let female = langExactVoices.find(v => isFemale(v) && isIndianVoice(v));
      if (!female) female = langExactVoices.find(isFemale);
      if (!female) female = indianVoices.find(isFemale); // Fallback to Indian female voice
      if (!female) female = voices.find(isFemale);        // Global fallback (e.g. Zira)
      return female || voices[voices.length - 1];
    }

    if (actorKey === 'JUDGE') {
      // MALE VOICE 1: Senior Presiding Male (Deep baritone, authoritative)
      let judgeVoice = langExactVoices.find(v => isMale(v) && isIndianVoice(v));
      if (!judgeVoice) judgeVoice = langExactVoices.find(isMale);
      if (!judgeVoice) judgeVoice = indianVoices.find(isMale); // Fallback to Indian male voice
      if (!judgeVoice) {
        judgeVoice = voices.find(v => {
          const n = (v.name || '').toLowerCase();
          return isMale(v) && (n.includes('david') || n.includes('george') || n.includes('daniel') || n.includes('james'));
        }) || voices.find(isMale);
      }
      return judgeVoice || voices[0];
    }

    if (actorKey === 'DEFENSE') {
      // MALE VOICE 2: Distinct Male Voice (Defense Counsel, strictly different from Judge!)
      const judgeVoice = this._findVoice('JUDGE', langCode);
      const judgeName = judgeVoice ? judgeVoice.name : '';

      let defenseVoice = langExactVoices.find(v => isMale(v) && isIndianVoice(v) && v.name !== judgeName);
      if (!defenseVoice) defenseVoice = langExactVoices.find(v => isMale(v) && v.name !== judgeName);
      if (!defenseVoice) defenseVoice = indianVoices.find(v => isMale(v) && v.name !== judgeName);
      if (!defenseVoice) {
        defenseVoice = voices.find(v => {
          const n = (v.name || '').toLowerCase();
          return isMale(v) && v.name !== judgeName && (n.includes('mark') || n.includes('madhav') || n.includes('valluvar') || n.includes('richard') || n.includes('guy') || n.includes('brian'));
        }) || voices.find(v => isMale(v) && v.name !== judgeName);
      }
      return defenseVoice || judgeVoice || voices[0];
    }

    return voices[0] || null;
  },

  // Dynamic Cadence & Tone Modulation for Statutory Sections & Critical Arguments
  _analyzeSegmentTone(text, actorKey) {
    const isSection = /(?:धारा|दफा|Section|Sec\.?)\s*\d+[\w\s\(\)]*|Order\s*\d+\s*Rule\s*\d+|ऑर्डर\s*\d+\s*रूल\s*\d+|आदेश\s*\d+\s*नियम\s*\d+|Article\s*\d+|अनुच्छेद\s*\d+|IPC|आईपीसी|CrPC|सीआरपीसी|CPC|सीपीसी|BNS|BNSS|NDPS|NI Act/i.test(text);
    const isPrecedent = /Unbroken Chain of Circumstances|Due process of law|Civil Appeal[^\,\.\n]*|Supreme Court|High Court|साक्ष्यों की अटूट श्रृंखला|कानून की उचित प्रक्रिया|Interim Injunction|Stay Order|अस्थाई निषेधाज्ञा|Prima facie/i.test(text);
    const isCritical = /निर्ममता से हत्या|शव को छुपाया|हल्की धारा|अपराध स्वीकार|forged agreement|farzi agreement|illegal kabza|balpurvak kabza|Mandatory requirement|mandatory statutory safeguard|Fatal defect|Order, order/i.test(text);
    const isImportant = isSection || isPrecedent || isCritical;

    if (actorKey === 'JUDGE') {
      if (isImportant) {
        return {
          isImportant: true,
          pitch: isSection ? 0.62 : 0.78, // Deep, commanding judicial baritone on statutory provisions
          rate: 0.78, // Slower, grave, measured judicial pronouncement
          type: isSection ? 'section' : (isPrecedent ? 'precedent' : 'critical')
        };
      }
      return { isImportant: false, pitch: 0.74, rate: 0.88, type: 'normal' };
    }

    if (actorKey === 'DEFENSE') {
      if (isImportant) {
        return {
          isImportant: true,
          pitch: 1.22, // Elevated impassioned advocacy
          rate: 0.86, // Crisp, articulate emphasis on client's statutory rights
          type: isSection ? 'section' : (isPrecedent ? 'precedent' : 'critical')
        };
      }
      return { isImportant: false, pitch: 1.02, rate: 0.98, type: 'normal' };
    }

    if (actorKey === 'PROSECUTION') {
      if (isImportant) {
        return {
          isImportant: true,
          pitch: 1.38, // Sharp, piercing prosecutorial punch
          rate: 0.88, // Assertive, rhythmic emphasis driving the gravity of the crime
          type: isSection ? 'section' : (isPrecedent ? 'precedent' : 'critical')
        };
      }
      return { isImportant: false, pitch: 1.16, rate: 1.02, type: 'normal' };
    }

    return { isImportant: false, pitch: 1.0, rate: 1.0, type: 'normal' };
  },

  _segmentDialogue(text, actorKey) {
    if (!text) return [];
    // Protect abbreviations like No., Sec., Hon'ble before splitting
    let protectedText = text.replace(/\b(No|Sec|Art|Adv|vs|v|Dr|Mr|Mrs|AIR|Co|Ltd|i\.e|e\.g)\./gi, (m, g) => g + '___DOT___');

    const rawSentences = protectedText
      .split(/(?<=[.!?।;:\n])\s+/)
      .map(s => s.replace(/___DOT___/g, '.').trim())
      .filter(Boolean);

    if (rawSentences.length === 0) {
      return [{ text, ...this._analyzeSegmentTone(text, actorKey) }];
    }

    return rawSentences.map(sentence => {
      const analysis = this._analyzeSegmentTone(sentence, actorKey);
      return {
        text: sentence,
        ...analysis
      };
    });
  },

  _speakText(text, defaultPitch, defaultRate, onEnd) {
    if (!window.speechSynthesis) {
      this._stepTimeout = setTimeout(onEnd, 3500);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean spoken text: strip bracketed stage directions like *[Scrutinizing file]*
    const cleanedText = this._cleanTextForVoice(text);
    if (!cleanedText) {
      onEnd();
      return;
    }

    // Segment dialogue with tone modulation per sentence
    const segments = this._segmentDialogue(cleanedText, this._activeSpeakerId);
    if (!segments || segments.length === 0) {
      onEnd();
      return;
    }

    let segIndex = 0;
    const totalSegs = segments.length;

    const speakNextSegment = () => {
      if (!this._isPlaying || this._isPaused) return;
      if (segIndex >= totalSegs) {
        onEnd();
        return;
      }

      const seg = segments[segIndex];
      const utterance = new SpeechSynthesisUtterance(seg.text);
      utterance.pitch = seg.pitch;
      utterance.rate = seg.rate;
      utterance.volume = 1.0;

      const lang = this._getSpeechLanguageCode(seg.text);
      const voice = this._findVoice(this._activeSpeakerId, lang);
      if (voice) {
        utterance.voice = voice;
        if (voice.lang) utterance.lang = voice.lang;
      } else {
        utterance.lang = lang;
      }

      utterance.onend = () => {
        segIndex++;
        if (segIndex < totalSegs) {
          // Dramatic courtroom micro-pause before an important statutory section or precedent
          const pauseDelay = segments[segIndex].isImportant ? 110 : 35;
          this._stepTimeout = setTimeout(speakNextSegment, pauseDelay);
        } else {
          onEnd();
        }
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis notice:', e);
        segIndex++;
        if (segIndex < totalSegs) {
          speakNextSegment();
        } else {
          onEnd();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextSegment();
  },

  _endSimulation() {
    this.setCamera('WIDE');
    this._playGavelSound();

    const statusEl = document.getElementById('v3-status');
    const statusText = document.getElementById('v3-status-text');
    if (statusEl) {
      if (statusText) statusText.innerText = 'COURT ADJOURNED';
      statusEl.classList.remove('recording');
      statusEl.style.color = '#38bdf8';
      statusEl.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    }

    // Pause all avatars
    Object.values(this._actions).forEach(action => { action.paused = true; });

    // Show completion alert in subtitle bar with return to chat button
    const subContainer = document.getElementById('v3-subtitle');
    const speakerTextEl = document.getElementById('v3-speaker-text');
    const textEl = document.getElementById('v3-subtitle-text');

    if (speakerTextEl) speakerTextEl.innerText = '⚖️ सुनवाई समाप्त (Hearing Concluded)';
    if (textEl) {
      textEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%;">
          <span>माननीय पीठ द्वारा अंतरिम निर्देश दर्ज किए गए हैं।</span>
          <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="VirtualCourtSimulator.exitToChat()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;font-weight:700;">
            <span class="material-symbols-rounded" style="font-size:16px">chat</span>
            वापस चैट पर जाएं (Return to Chat)
          </button>
        </div>
      `;
    }
    if (subContainer) subContainer.classList.add('active');
  },

  stopSimulation() {
    this._isPlaying = false;
    this._isPaused = false;
    if (this._stepTimeout) {
      clearTimeout(this._stepTimeout);
      this._stepTimeout = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }
    this._mixers = {};
    this._actions = {};
    this._avatarModels = {};
    this._speakerRings = {};
  }
};
