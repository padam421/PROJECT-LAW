/* ============================================================
   Nyay Setu USER — VIRTUAL COURT SIMULATOR (V4 — 3-Avatar Debate)
   court_simulator.js — Three.js Scene, 3D Avatars, Camera Director
   ============================================================ */

const VirtualCourtSimulator = {
  _courtType: 'SUPREME',
  _avatarBuffers: new Map(),
  _actorRigs: {},
  _guided: true,
  _autoCamera: true,
  _quality: 'hd',
  _timeline: [],
  _timelineIndex: 0,
  _interactions: {},
  _awaiting: false,
  _stageElapsed: 0,
  _motionTime: 0,
  _speechDone: false,
  _speaking: false,
  _courtSessions: {},
  _sceneGeneration: 0,
  _speechGeneration: 0,
  _ready: false,
  _voiceEnabled: true,
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
    DEFENSE: '../user/assets/Talking.fbx.glb',
    PROSECUTION: '../user/assets/female_talking.glb',
    JUDGE: '../user/assets/judge_talking.glb'
  },

  // Dynamic Case & Debate State
  _activeCaseTitle: 'Courtroom Practice Hearing',
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
      const turnMatch = line.match(/^[-*•]?\s*(🏛️|🛡️|⚖️|👤)\s*(?:\*\*)?(.*?)(?:\*\*)?\s*:\s*(.*)$/)
        || (() => { const witness = line.match(/^[-*•]?\s*(?:\*\*)?((?:Defense witness|Prosecution witness|Witness|गवाह|साक्षी|సాక్షి)[^:：]*?)(?:\*\*)?\s*[:：]\s*(.*)$/i); return witness ? [witness[0], '👤', witness[1], witness[2]] : null; })();

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

        if (emoji === '👤') {
          actor = /prosecution|oppos|अभियोजन|विपक्ष|ప్రాసిక్యూషన్/i.test(role) ? 'WITNESS_PROSECUTION' : 'WITNESS_DEFENSE';
          defaultName = role || 'Witness'; pitch = 1; rate = 0.95;
        } else if (emoji === '🛡️') {
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
          this._activeCaseTitle = parsed.title || 'Courtroom Practice Hearing';
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
        name: 'Hon\'ble Presiding Judge',
        text: 'The court is now in session. Counsel for the Petitioner, proceed with your opening submissions.',
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
        name: 'Hon\'ble Presiding Judge',
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
    const explicit = {
      en:['en-IN','English (Indian)'],hi:['hi-IN','हिन्दी'],te:['te-IN','తెలుగు'],ta:['ta-IN','தமிழ்'],
      kn:['kn-IN','ಕನ್ನಡ'],ml:['ml-IN','മലയാളം'],gu:['gu-IN','ગુજરાતી'],mr:['mr-IN','मराठी'],
      bn:['bn-IN','বাংলা'],pa:['pa-IN','ਪੰਜਾਬੀ'],or:['or-IN','ଓଡ଼ିଆ'],as:['as-IN','অসমীয়া'],
      ur:['ur-IN','اردو'],ne:['ne-NP','नेपाली'],sa:['sa-IN','संस्कृतम्']
    };
    const chosen=h.split('-')[0];
    if(explicit[chosen]) {
      const [code,name]=explicit[chosen];
      return {code,shortCode:chosen,name,toneLabel:'Indian Tone',displayBadge:name+' (Indian Tone)'};
    }

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
    if (h === 'hi' || /\b(mera|meri|zamin|zameen|padosi|kabza|farzi|vakeel|shikayat|karna|hoga|hai|hain|nahi|diya|tha|thi)\b/i.test(str)) {
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
  _configureCourt() {
    if (!this._preferenceLoaded) {
      try { const saved = sessionStorage.getItem('nyay_court_type'); if (IndianCourtroom.types[saved]) this._courtType = saved; } catch (_) {}
      this._preferenceLoaded = true;
    }
    this._courtConfig = IndianCourtroom.layout(this._courtType);
    this.CAMERAS = this._courtConfig.cameras;
    this.SPEAKER_COORDS = this._courtConfig.actors;
    const caseKey = JSON.stringify([this._activeCaseTitle, this._activeLanguage, this._script.map(s => [s.actor, s.text])]);
    if (caseKey !== this._sessionCaseKey) { this._courtSessions = {}; this._interactions = {}; this._sessionCaseKey = caseKey; }
  },

  _saveCourtProgress() {
    if (!this._isPlaying || this._playingCaseKey !== this._sessionCaseKey) return;
    this._courtSessions[this._courtType] = { step: this._currentStep, timeline: this._timelineIndex, elapsed: this._stageElapsed, paused: this._isPaused, camera: this._cameraMode, autoCamera: this._autoCamera, interactions: this._interactions, plan: this._timeline };
  },

  selectCourt(type, enter = false) {
    if (!IndianCourtroom.types[type]) return;
    const mounted = document.getElementById('v3-wrapper');
    if (mounted && type === this._courtType) return;
    this.stopSimulation();
    this._courtType = type; this._preferenceLoaded = true;
    try { sessionStorage.setItem('nyay_court_type', type); } catch (_) {}
    if (mounted) {
      this._replaceRoomContents(mounted);
      this.startSimulation();
      document.querySelector('.v3-court-tabs [aria-pressed="true"]')?.focus();
    } else if (enter) Router.navigate('/court/simulate');
  },

  _replaceRoomContents(mounted) {
    const template = document.createElement('template'); template.innerHTML = this.render();
    const next = template.content.firstElementChild;
    mounted.replaceChildren(...next.childNodes); mounted.dataset.court = this._courtType;
    mounted.classList.remove('v3-tools-open');
  },

  async toggleFullscreen() {
    const room = document.getElementById('v3-wrapper'); if (!room) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (room.classList.contains('v3-expanded')) room.classList.remove('v3-expanded');
      else if (room.requestFullscreen) await room.requestFullscreen();
      else room.classList.add('v3-expanded');
    } catch (_) { room.classList.toggle('v3-expanded'); }
    this._syncFullscreen();
  },

  _syncFullscreen() {
    const room = document.getElementById('v3-wrapper');
    const expanded = Boolean(document.fullscreenElement || room?.classList.contains('v3-expanded'));
    const button = document.getElementById('v3-fullscreen-btn');
    if (button) { button.setAttribute('aria-pressed', String(expanded)); button.title = expanded ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'; button.querySelector('span').textContent = expanded ? 'fullscreen_exit' : 'fullscreen'; }
    this._onWindowResize();
  },

  setQuality(value) {
    if (!['auto','hd','ultra'].includes(value)) return;
    this._quality = value; this._onWindowResize();
  },

  toggleAutoCamera() {
    this._autoCamera = !this._autoCamera;
    document.getElementById('v3-auto-camera')?.setAttribute('aria-pressed', String(this._autoCamera));
    if (this._autoCamera) this._frameStage(this._timeline[this._timelineIndex]);
  },

  toggleMobileTools() {
    const room=document.getElementById('v3-wrapper'),button=document.getElementById('v3-mobile-tools');
    const open=room.classList.toggle('v3-tools-open');
    button.setAttribute('aria-expanded',String(open));button.textContent=open?'Fewer controls':'More controls';
  },

  togglePractice() {
    this._guided = !this._guided; this._courtSessions = {}; this.restartHearing();
  },

  toggleRecord() {
    const panel = document.getElementById('v3-record'); panel.hidden = !panel.hidden;
    if (!panel.hidden) document.getElementById('v3-room-guide').hidden = true;
    document.getElementById('v3-record-btn').setAttribute('aria-expanded', String(!panel.hidden));
  },

  nextStage(direction = 1) {
    if (!this._ready) return;
    if (direction > 0 && (this._awaiting || this._activeStage?.kind === 'answer' && !this._speechDone)) return;
    ++this._speechGeneration; window.speechSynthesis?.cancel(); clearTimeout(this._stepTimeout);
    this._timelineIndex = Math.max(0, Math.min(this._timeline.length, this._timelineIndex + direction));
    this._stageElapsed = 0; this._runStage(true);
  },

  _interactionWords() {
    const code = this._detectIndianLanguage(this._script.map(s=>s.text).join(' '),this._activeLanguage).shortCode;
    return CourtroomDirector.phrases(code) || CourtroomDirector.phrases('en');
  },

  saveInteractionDraft(value) {
    const stage=this._activeStage, key=stage?.answerKey || stage?.questionKey;
    if(!key)return;this._interactions[key] ||= {};this._interactions[key].draft=value;
  },

  submitWitnessAnswer() {
    const stage=this._activeStage,input=document.getElementById('v3-witness-input');
    if(stage?.kind!=='await-answer'||!input?.value.trim()||!input.reportValidity())return;
    this._interactions[stage.answerKey]={...this._interactions[stage.answerKey],answer:input.value.trim(),draft:''};
    this._isPaused=false;this._stageElapsed=0;this._runStage(false);
  },

  completeCaptionAnswer() {
    if(!this._captionCompletion || !this._isPlaying)return;
    this._captionCompletion=null;this._awaiting=false;
    document.getElementById('v3-interaction').hidden=true;
    this._isPaused=false;this._speechDone=true;this._speaking=false;
    document.getElementById('v3-pause-text').textContent='Pause';
    document.getElementById('v3-pause-icon').textContent='pause';
    document.getElementById('v3-status-text').textContent='IN SESSION';
  },

  resolveFollowUp(ask) {
    const stage=this._activeStage;
    if(!stage||!['choice','edit-question'].includes(stage.kind))return;
    if(!ask) {
      const target=this._timeline.findIndex(entry=>entry.id===stage.exitId);
      if(target<0)return;this._timelineIndex=target;
    }else{
      const input=document.getElementById('v3-witness-input');
      if(!input?.value.trim()||!input.reportValidity())return;
      const question=input.value.trim(),words=this._interactionWords();
      this._interactions[stage.questionKey]={question,draft:''};
      if(stage.repeat){
        const key=stage.questionKey+':'+this._timelineIndex+':'+this._timeline.length;
        this._interactions[key]={question};
        const base={sourceIndex:stage.sourceIndex,positions:stage.positions,camera:stage.camera,duration:0};
        const entries=[{...base,kind:'question',actor:stage.other,questionKey:key,text:question,lookAt:stage.witness},
          {...base,kind:'await-answer',actor:stage.witness,answerKey:key,text:words.waiting,silent:true,lookAt:stage.other,side:stage.side},
          {...stage,questionKey:key+':next'}];
        this._timeline.splice(this._timelineIndex,1,...entries);
      }else if(stage.kind==='edit-question'){
        this._timeline.splice(this._timelineIndex+1,0,{...stage,kind:'question',text:question,silent:false,lookAt:stage.witness});
        this._timelineIndex++;
      }else this._timelineIndex++;
    }
    this._isPaused=false;this._stageElapsed=0;this._runStage(true);
  },

  raiseObjection() {
    const stage=this._activeStage;
    if(stage?.kind!=='await-answer')return;
    const words=this._interactionWords(),asker=stage.lookAt,opponent=asker==='DEFENSE'?'PROSECUTION':'DEFENSE';
    const judges=Object.keys(this.SPEAKER_COORDS).filter(k=>k.startsWith('JUDGE'));
    const judge=judges[this._timelineIndex%judges.length];
    const base={sourceIndex:stage.sourceIndex,positions:stage.positions,duration:0};
    this._timeline.splice(this._timelineIndex,0,
      {...base,kind:'practice',actor:opponent,text:words.objection,cue:'objection',camera:opponent,gesture:'objection',lookAt:judge},
      {...base,kind:'practice',actor:judge,text:words.ruling,cue:'ruling',camera:'JUDGE'},
      {...base,kind:'edit-question',actor:asker,text:words.questionLabel,questionKey:stage.answerKey,witness:stage.actor,camera:stage.camera,silent:true});
    this._isPaused=false;this._stageElapsed=0;this._runStage(true);
  },

  _renderInteraction(stage) {
    const panel=document.getElementById('v3-interaction');if(!panel)return;
    const words=this._interactionWords(),answer=stage.kind==='await-answer';
    this._awaiting=answer||stage.kind==='choice'||stage.kind==='edit-question';
    panel.hidden=!this._awaiting;
    document.querySelector('[aria-label="Next stage"]')?.toggleAttribute('disabled',this._awaiting || stage.kind==='answer'&&!this._speechDone);
    if(!this._awaiting){panel.replaceChildren();return;}
    const key=stage.answerKey||stage.questionKey,label=answer?words.answerLabel:words.questionLabel;
    const draft=this._interactions[key]?.draft||'';
    panel.innerHTML='<label for="v3-witness-input">'+Utils.escapeHtml(label)+'</label><textarea id="v3-witness-input" dir="auto" required maxlength="4000" rows="2" aria-label="'+Utils.escapeHtml(label)+'" oninput="VirtualCourtSimulator.saveInteractionDraft(this.value)">'+Utils.escapeHtml(draft)+'</textarea><div class="v3-answer-actions">'
      +'<button class="v3-answer-submit" onclick="VirtualCourtSimulator.'+(answer?'submitWitnessAnswer()':'resolveFollowUp(true)')+'">'+Utils.escapeHtml(answer?words.submit:words.ask)+'</button>'
      +(stage.kind==='choice'?'<button onclick="VirtualCourtSimulator.resolveFollowUp(false)">'+Utils.escapeHtml(words.done)+'</button>':'')
      +(answer?'<button onclick="VirtualCourtSimulator.raiseObjection()">'+Utils.escapeHtml(words.object)+'</button>':'')+'</div>';
  },

  restartHearing() {
    const mounted = document.getElementById('v3-wrapper');
    if (!mounted) return;
    this.stopSimulation();
    delete this._courtSessions[this._courtType];
    this._replaceRoomContents(mounted); this.startSimulation();
  },

  toggleVoice() {
    this._voiceEnabled = !this._voiceEnabled;
    const button = document.getElementById('v3-voice-btn');
    if (button) { button.setAttribute('aria-pressed', String(this._voiceEnabled)); button.querySelector('span:last-child').textContent = this._voiceEnabled ? 'Voice on' : 'Voice off'; }
    if (this._isPlaying && !this._isPaused && this._ready) {
      clearTimeout(this._stepTimeout); this._resumeCurrentStep();
    }
  },

  toggleRoomGuide() {
    const guide = document.getElementById('v3-room-guide');
    if (!guide) return;
    guide.hidden = !guide.hidden;
    if (!guide.hidden) document.getElementById('v3-record').hidden = true;
    document.getElementById('v3-guide-btn').setAttribute('aria-expanded', String(!guide.hidden));
  },

  renderLanding() {
    this.loadActiveScript(); this._configureCourt();
    return `<div class="vc-hub-container vc-indian-hub">
      <div class="vc-court-intro"><span class="vc-eyebrow">NYAY SETU · COURTROOM PRACTICE</span>
        <h1>Step inside the courtroom.</h1><p>Choose a setting, explore the room and rehearse your case with spoken dialogue.</p></div>
      <div class="vc-court-cards">${Object.entries(IndianCourtroom.types).map(([id, c], i) => `
        <button class="vc-court-card vc-court-${id.toLowerCase()}" onclick="VirtualCourtSimulator.selectCourt('${id}', true)">
          <span class="vc-court-illustration" aria-hidden="true"><span class="vc-bench-crest">⚖</span><span class="vc-mini-judges">${c.judges.map(() => '<i></i>').join('')}</span><span class="vc-mini-bench"></span><span class="vc-mini-aisle"></span></span>
          <span class="vc-card-number">0${i + 1} / ${c.label}</span><strong>${c.title}</strong><span>${c.description}</span><b>Enter courtroom <span aria-hidden="true">↗</span></b>
        </button>`).join('')}</div>
      <div class="vc-case-context"><div><span class="vc-eyebrow">${this._script[0]?._isDynamic ? 'YOUR ACTIVE CASE' : 'DEMONSTRATION HEARING'}</span><h2>${Utils.escapeHtml(this._activeCaseTitle)}</h2><p>${this._script.length} dialogue turns · Each court keeps its own playback position while this page stays open.</p></div><button class="u-btn u-btn-primary" onclick="Router.navigate('/chat')">Ask Nyay Setu</button></div>
      <p class="vc-practice-note">Representative practice rooms. Actual court interiors, bench sizes and procedures vary. Changing the room changes the setting, not the legal content of your case.</p>
    </div>`;
  },

  render() {
    this.loadActiveScript(); this._configureCourt();
    const c = this._courtConfig, saved = this._courtSessions[this._courtType];
    const cameraIds = { WITNESS_OTHER: 'witness-other', WIDE: 'wide', JUDGE: 'judge', DEFENSE: 'defense', PROSECUTION: 'pros', GALLERY: 'gallery', STAFF: 'staff', WITNESS: 'witness' };
    return `<div class="v3-simulation-wrapper v3-indian-court" id="v3-wrapper" data-court="${this._courtType}">
      <canvas class="v3-webgl-canvas" id="v3-canvas" aria-label="${c.title} three-dimensional practice courtroom"></canvas>
      <div class="v3-loading-overlay" id="v3-loader" role="status"><div class="v3-spinner"></div><strong>Preparing ${c.title}</strong><span>Arranging the room and its participants…</span></div>
      <div class="v3-gavel-alert" id="v3-gavel-alert"><span class="material-symbols-rounded">account_balance</span><span>Hearing in session</span></div>
      <div class="v3-hud-overlay">
        <div class="v3-hud-top">
          <div class="v3-room-bar"><button class="v3-control-btn" onclick="VirtualCourtSimulator.exitToChat()" aria-label="Return to chat"><span class="material-symbols-rounded">arrow_back</span></button>
            <div class="v3-court-tabs" role="group" aria-label="Choose courtroom">${Object.entries(IndianCourtroom.types).map(([id, court]) => `<button onclick="VirtualCourtSimulator.selectCourt('${id}')" aria-pressed="${id === this._courtType}">${court.title}</button>`).join('')}</div>
            <button class="v3-control-btn" id="v3-fullscreen-btn" onclick="VirtualCourtSimulator.toggleFullscreen()" aria-label="Toggle fullscreen" aria-pressed="false" title="Enter fullscreen"><span class="material-symbols-rounded">fullscreen</span></button>
            <button class="v3-control-btn v3-guide-button" id="v3-guide-btn" onclick="VirtualCourtSimulator.toggleRoomGuide()" aria-expanded="false" aria-controls="v3-room-guide"><span class="material-symbols-rounded">info</span><span>Room guide</span></button>
          </div>
          <div class="v3-room-context"><div><span class="v3-practice-tag">PRACTICE ROOM</span><strong>${c.label}</strong></div><button class="v3-control-btn v3-mobile-tools" id="v3-mobile-tools" aria-expanded="false" onclick="VirtualCourtSimulator.toggleMobileTools()">More controls</button><span class="v3-hud-status paused" id="v3-status"><span class="material-symbols-rounded" id="v3-status-icon">pause_circle</span><span id="v3-status-text">READY</span></span></div>
          <div class="v3-toolbar"><div class="v3-camera-controls" id="v3-cams" role="group" aria-label="Camera views">${Object.entries(c.cameras).map(([id, cam]) => `<button class="v3-cam-btn ${id === (saved?.camera || 'WIDE') ? 'active' : ''}" id="v3-cam-${cameraIds[id]}" onclick="VirtualCourtSimulator.setCamera('${id}', true)" aria-pressed="${id === (saved?.camera || 'WIDE')}">${cam.label}</button>`).join('')}</div>
            <div class="v3-playback-controls"><button class="v3-control-btn" id="v3-pause-btn" disabled onclick="VirtualCourtSimulator.togglePause()"><span class="material-symbols-rounded" id="v3-pause-icon">play_arrow</span><span id="v3-pause-text">Begin hearing</span></button><button class="v3-control-btn" onclick="VirtualCourtSimulator.restartHearing()" title="Restart this court's hearing" aria-label="Restart hearing"><span class="material-symbols-rounded">replay</span></button><button class="v3-control-btn" id="v3-voice-btn" aria-pressed="${this._voiceEnabled}" onclick="VirtualCourtSimulator.toggleVoice()"><span class="material-symbols-rounded">volume_up</span><span>Voice ${this._voiceEnabled ? 'on' : 'off'}</span></button></div>
          </div>
          <div class="v3-direction-controls">
            <button class="v3-control-btn" id="v3-auto-camera" aria-pressed="${this._autoCamera}" onclick="VirtualCourtSimulator.toggleAutoCamera()">Auto camera</button>
            <button class="v3-control-btn" id="v3-practice-btn" aria-pressed="${this._guided}" onclick="VirtualCourtSimulator.togglePractice()">Witness practice</button>
            <button class="v3-control-btn" onclick="VirtualCourtSimulator.nextStage(-1)" aria-label="Previous stage"><span class="material-symbols-rounded">skip_previous</span></button>
            <button class="v3-control-btn" onclick="VirtualCourtSimulator.nextStage(1)" aria-label="Next stage"><span class="material-symbols-rounded">skip_next</span></button>
            <button class="v3-control-btn" id="v3-record-btn" onclick="VirtualCourtSimulator.toggleRecord()" aria-expanded="false" aria-controls="v3-record">Live record</button>
            <label class="v3-quality-label">Quality <select id="v3-quality" onchange="VirtualCourtSimulator.setQuality(this.value)" aria-label="Render quality"><option value="auto" ${this._quality==='auto'?'selected':''}>Auto</option><option value="hd" ${this._quality==='hd'?'selected':''}>Full HD</option><option value="ultra" ${this._quality==='ultra'?'selected':''}>Ultra HD</option></select></label>
          </div>
        </div>
        <aside class="v3-record" id="v3-record" hidden><span class="vc-eyebrow">LIVE COURT RECORD</span><h2 id="v3-record-speaker">Ready</h2><p id="v3-record-text" dir="auto"></p><small>Practice prompts are separate from case testimony.</small></aside>
        <aside class="v3-room-guide" id="v3-room-guide" hidden><span class="vc-eyebrow">INSIDE THIS ROOM</span><h2>${c.title}</h2><p>${c.description}</p><ul>${c.features.map(f => '<li>' + f + '</li>').join('')}</ul><p class="v3-guide-note">An inspired practice layout. Bench size and interior details vary between real courts. Bench members take turns speaking. Witness stations and inserted procedure are practice aids; witness examination is not part of every appellate hearing.</p></aside>
        <div class="v3-hud-bottom"><div class="v3-case-strip"><span class="v3-case-title-badge" id="v3-case-title" title="${Utils.escapeHtml(this._activeCaseTitle)}"><span id="v3-case-title-text">${Utils.escapeHtml(this._activeCaseTitle)}</span></span><span class="v3-lang-badge" id="v3-lang-badge"><span id="v3-lang-badge-text">${this._detectIndianLanguage(this._script[0]?.text || '', this._activeLanguage).displayBadge}</span></span><span id="v3-exchange-badge">Turn ${Math.min((saved?.step || 0) + 1, this._script.length)} / ${this._script.length}</span></div>
          <div class="v3-subtitle-container active paused" id="v3-subtitle"><span class="v3-speaker-name" id="v3-speaker"><span id="v3-speaker-text">${c.title} · Ready when you are</span><span class="v3-audio-wave"><span class="v3-audio-bar"></span><span class="v3-audio-bar"></span><span class="v3-audio-bar"></span></span></span><p class="v3-subtitle-text" id="v3-subtitle-text">Explore the camera views, then select Begin hearing to start the dialogue.</p></div>
          <div class="v3-interaction" id="v3-interaction" hidden></div><span id="v3-stage-label" class="v3-stage-label" role="status">Original case dialogue</span><span id="v3-voice-hint" class="v3-voice-hint" role="status"></span>
        </div>
      </div>
    </div>`;
  },

  exitToChat() {
    this.stopSimulation();
    Router.navigate('/chat');
  },

  /* ==================== 2. WEBGL INITIALIZATION ==================== */
  startSimulation() {
    if (this._isPlaying) this.stopSimulation();
    this.loadActiveScript(); this._configureCourt();
    const saved = this._courtSessions[this._courtType];
    this._isPlaying = true; this._isPaused = true; this._ready = false;
    this._playingCaseKey = this._sessionCaseKey;
    this._autoCamera = saved?.autoCamera ?? this._autoCamera;
    const language = this._detectIndianLanguage(this._script.map(s=>s.text).join(' '), this._activeLanguage).shortCode;
    this._timeline = CourtroomDirector.plan(this._script, this._courtConfig, language, this._guided);
    if(saved?.plan)this._timeline=saved.plan;
    this._interactions=saved?.interactions||{};this._awaiting=false;
    this._timelineIndex = saved?.timeline || 0; this._stageElapsed = saved?.elapsed || 0;
    this._actorRigs = {}; this._motionTime = 0; this._speechDone = false; this._speaking = false;
    this._currentStep = saved?.step || 0; this._cameraMode = saved?.camera || 'WIDE';
    this._mixers = {}; this._actions = {}; this._avatarModels = {}; this._speakerRings = {};
    this._targetRotations = { JUDGE: 0, DEFENSE: Math.PI - 0.22, PROSECUTION: Math.PI + 0.22 };
    const generation = ++this._sceneGeneration;
    window.speechSynthesis?.getVoices();
    try {
      if (!document.getElementById('v3-canvas')) { this.stopSimulation(); return; }
      this._initThreeJS();
      const loading = this._buildEnvironment(generation);
      this.setCamera(this._cameraMode);
      this._camera.position.copy(this._cameraPos); this._currentLookAt.copy(this._cameraTarget);
      this._animate();
      this._mountObserver = new MutationObserver(() => {
        if (!document.getElementById('v3-wrapper')) this.stopSimulation();
      });
      this._mountObserver.observe(document.body, { childList: true, subtree: true });
      loading.then(() => {
        if (generation !== this._sceneGeneration || !this._isPlaying) return;
        this._ready = true;
        document.getElementById('v3-loader')?.classList.add('hidden');
        document.getElementById('v3-loader')?.setAttribute('aria-hidden', 'true');
        const button = document.getElementById('v3-pause-btn'); if (button) button.disabled = false;
        this._runStage(true);
        document.getElementById('v3-auto-camera')?.setAttribute('aria-pressed', String(this._autoCamera));
        if (saved && !saved.paused && this._timelineIndex < this._timeline.length) this.togglePause();
        this._syncFullscreen();
      }).catch(error => this._showSceneError(error, generation));
    } catch (error) { this._showSceneError(error, generation); }
  },

  _showSceneError(error, generation) {
    if (generation !== this._sceneGeneration) return;
    console.error('Courtroom could not start:', error);
    this.stopSimulation();
    const loader = document.getElementById('v3-loader');
    if (loader) loader.innerHTML = '<strong>The 3D room could not load.</strong><span>Check WebGL support and your connection, then try again.</span><button class="v3-control-btn" onclick="VirtualCourtSimulator.restartHearing()">Retry courtroom</button>';
  },

  _initThreeJS() {
    const canvas = document.getElementById('v3-canvas');
    const wrapper = document.getElementById('v3-wrapper');
    if (!canvas || !wrapper) return;

    this._scene = new THREE.Scene();

    const aspect = wrapper.clientWidth / wrapper.clientHeight;
    this._camera = new THREE.PerspectiveCamera(49, aspect, 0.1, 80);

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
    this._renderer.toneMappingExposure = 1.0;
    this._renderer.outputEncoding = THREE.sRGBEncoding;

    this._clock = new THREE.Clock();

    // Window resize handler
    this._resizeHandler = this._onWindowResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
    this._resizeObserver = new ResizeObserver(this._resizeHandler); this._resizeObserver.observe(wrapper);
    this._fullscreenHandler = () => this._syncFullscreen();
    this._escapeHandler = event => { if (event.key === 'Escape' && wrapper.classList.contains('v3-expanded')) { wrapper.classList.remove('v3-expanded'); this._syncFullscreen(); } };
    document.addEventListener('fullscreenchange', this._fullscreenHandler); window.addEventListener('keydown', this._escapeHandler);
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  _onWindowResize() {
    const wrapper = document.getElementById('v3-wrapper');
    if (!wrapper || !wrapper.clientWidth || !wrapper.clientHeight || !this._camera || !this._renderer) return;
    this._camera.aspect = wrapper.clientWidth / wrapper.clientHeight;
    // Preserve a useful horizontal field of view on narrow portal panels and phones.
    this._camera.fov = Math.min(115, 2 * Math.atan(Math.tan(49 * Math.PI / 360) * Math.max(1, 1.45 / this._camera.aspect)) * 180 / Math.PI);
    this._camera.updateProjectionMatrix();
    const desired = this._quality === 'ultra' ? Math.min(3, 3840 / wrapper.clientWidth) : this._quality === 'hd' ? Math.min(2, Math.max(window.devicePixelRatio || 1, 1920 / wrapper.clientWidth)) : Math.min(window.devicePixelRatio || 1, 1.25);
    this._renderer.setPixelRatio(Math.min(desired, Math.sqrt(8294400 / (wrapper.clientWidth * wrapper.clientHeight))));
    this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  },

  _buildEnvironment(generation) {
    this._room = IndianCourtroom.build(this._scene, this._courtType, this._activeCaseTitle);
    return Promise.all(Object.keys(this.SPEAKER_COORDS).map(key => this._loadAvatar(
      this.AVATAR_FILES[key.startsWith('JUDGE') ? 'JUDGE' : key.includes('PROSECUTION') ? 'PROSECUTION' : 'DEFENSE'], key, generation
    )));
  },

  _loadAvatar(url, actorKey, generation) {
    return new Promise(resolve => {
      const coord = this.SPEAKER_COORDS[actorKey];
      const rotation = actorKey.startsWith('JUDGE') ? 0 : (this._targetRotations[actorKey] ?? Math.PI);
      const current = () => this._sceneGeneration === generation && this._isPlaying;
      let settled = false;
      const fallback = () => {
        if (settled) return; settled = true;
        if (current()) {
          const figure = IndianCourtroom.person(actorKey === 'DEFENSE' ? 1 : 2, true, true);
          figure.position.set(coord.x, coord.y, coord.z); figure.rotation.y = rotation;
          this._scene.add(figure); this._avatarModels[actorKey] = figure;
        }
        resolve();
      };
      // A failed or slow model must not block all controls indefinitely.
      const timeout = setTimeout(fallback, 18000);
      if (!THREE.GLTFLoader) { clearTimeout(timeout); fallback(); return; }
      this._loadCourtModel(url, gltf => {
        clearTimeout(timeout);
        if (settled || !current()) { IndianCourtroom.dispose(gltf.scene); resolve(); return; }
        settled = true;
        const model = gltf.scene, wrapper = new THREE.Group();
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
        const scale = 1.78 / Math.max(size.y, 0.001), centre = bounds.getCenter(new THREE.Vector3());
        model.scale.multiplyScalar(scale);
        model.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
        wrapper.add(model); wrapper.position.set(coord.x, coord.y, coord.z); wrapper.rotation.y = rotation;
        model.traverse(child => {
          if (!child.isMesh) return;
          child.castShadow = true; child.receiveShadow = true;
          const name = child.name.toLowerCase();
          const skin = actorKey === 'DEFENSE' ? '#ac7956' : actorKey === 'PROSECUTION' ? '#b78763' : '#bb9373';
          const tint = /head|body/.test(name) ? skin : /eyeball|cornea/.test(name) ? '#bdb6a7' : /teeth/.test(name) ? '#ddd4c0' : actorKey.startsWith('WITNESS') ? (actorKey.endsWith('DEFENSE') ? '#687b8b' : '#918277') : '#25272a';
          const tintMaterial = original => {
            const mat = original.clone(); mat.color.set(tint).convertSRGBToLinear(); mat.roughness = 0.83; mat.metalness = 0;
            original.dispose(); return mat;
          };
          child.material = Array.isArray(child.material) ? child.material.map(tintMaterial) : tintMaterial(child.material);
          if (name.includes('eyeball') && !Array.isArray(child.material)) {
            const positions=child.geometry.getAttribute('position');child.geometry.computeBoundingBox();
            const box=child.geometry.boundingBox,centre=box.getCenter(new THREE.Vector3());
            const radius=(box.max.y-box.min.y)*.27,colors=new Float32Array(positions.count*3);
            const sclera=new THREE.Color('#ddd8cd').convertSRGBToLinear(),iris=new THREE.Color('#564531').convertSRGBToLinear(),pupil=new THREE.Color('#171b1b').convertSRGBToLinear();
            for(let i=0;i<positions.count;i++){
              const distance=Math.hypot(positions.getX(i)-centre.x,positions.getY(i)-centre.y);
              const front=positions.getZ(i)>centre.z;
              const color=front&&distance<radius*.48?pupil:front&&distance<radius?iris:sclera;
              colors.set([color.r,color.g,color.b],i*3);
            }
            child.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
            child.material.color.set(0xffffff);child.material.vertexColors=true;child.material.roughness=.4;
          } else if(name.includes('cornea') && !Array.isArray(child.material)) {
            child.material.transparent=true;child.material.opacity=.07;child.material.depthWrite=false;child.material.roughness=.1;
          }
        });
        // White neck bands distinguish Indian court dress.
        const white = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f3eee1').convertSRGBToLinear(), roughness: 0.9 });
        const bands = [];
        for (const side of (actorKey.startsWith('WITNESS') ? [] : [-1, 1])) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.012), white);
          band.position.set(side * 0.03, 1.43, 0.13); band.rotation.z = side * 0.07; wrapper.add(band); bands.push(band);
        }
        this._scene.add(wrapper); this._avatarModels[actorKey] = wrapper;
        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(model); this._mixers[actorKey] = mixer;
          const action = mixer.clipAction(gltf.animations[0]); action.play();
          // Evaluate a neutral speaking pose before pausing, including the non-speaking bench members.
          mixer.update(0.1); action.paused = true; this._actions[actorKey] = action;
        }
        wrapper.updateMatrixWorld(true);
        // Attach simple groomed hair and neck bands to the rig, so they follow the speaking animation.
        const bones = [];
        model.traverse(o => { if (o.isBone) bones.push(o); });
        const head = bones.find(o => o.name.startsWith('mixamorigHead') && !o.name.includes('Top') && this._isPrimaryJoint(o));
        const chest = bones.find(o => o.name.startsWith('mixamorigSpine2') && this._isPrimaryJoint(o));
        if (chest) bands.forEach(band => chest.attach(band));
        if (head) {
          const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(actorKey.startsWith('JUDGE') ? '#65605a' : '#302820').convertSRGBToLinear(), roughness: 0.95 }));
          hair.scale.set(0.085, 0.097, 0.098); hair.position.set(0, 1.685, -0.007); hair.castShadow = true;
          wrapper.add(hair); wrapper.updateMatrixWorld(true); head.attach(hair);
        }
        this._actorRigs[actorKey] = bones.map(bone => ({ bone, rest: bone.quaternion.clone(), animate: this._isPrimaryJoint(bone) }));
        resolve();
      }, error => { clearTimeout(timeout); console.warn('Using fallback court participant:', actorKey, error.message); fallback(); });
    });
  },

  _loadCourtModel(url, onLoad, onError) {
    const absolute = new URL(url, document.baseURI).href;
    if (!this._avatarBuffers.has(absolute)) {
      this._avatarBuffers.set(absolute, fetch(absolute).then(response => {
        if (!response.ok) throw new Error('Character asset HTTP ' + response.status);
        return response.arrayBuffer();
      }).catch(error => { this._avatarBuffers.delete(absolute); throw error; }));
    }
    this._avatarBuffers.get(absolute).then(buffer => {
      new THREE.GLTFLoader().parse(buffer, new URL('.', absolute).href, onLoad, onError);
    }).catch(onError);
  },

  _isPrimaryJoint(bone) {
    // The supplied GLBs nest several identically named skin-proxy joints. Rotating
    // every proxy compounds the motion and separates the eyes/teeth from the face.
    const semantic=o=>(o.userData?.originalName||o.name||'').replace(/_\d+$/,'');
    for(let parent=bone.parent;parent;parent=parent.parent) {
      if(parent.isBone&&semantic(parent)===semantic(bone))return false;
    }
    return true;
  },

  _facingAngle(actor, original) {
    if (actor === 'DEFENSE') return original > 1 ? Math.PI / 2 : Math.PI - 0.22;
    return original < -1 ? -Math.PI / 2 : Math.PI + 0.22;
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
    // Retain the dialogue cue API, using a discreet hearing notice instead of a cinematic hammer strike.
    const alert = document.getElementById('v3-gavel-alert');
    if (!alert) return;
    clearTimeout(this._noticeTimeout); alert.classList.add('active');
    this._noticeTimeout = setTimeout(() => alert.classList.remove('active'), 1600);
  },

  /* ==================== 5. ANIMATION LOOP ==================== */
  _animate() {
    if (!this._isPlaying || !this._renderer) return;
    this._animationFrameId = requestAnimationFrame(this._animate.bind(this));
    const delta = Math.min(this._clock.getDelta(), 0.05);
    Object.values(this._actorRigs).forEach(rig => rig.forEach(({bone,rest}) => bone.quaternion.copy(rest)));
    Object.values(this._mixers).forEach(mixer => mixer.update(this._isPaused ? 0 : delta));
    if (this._ready && !this._isPaused) { this._motionTime += delta; this._stageElapsed += delta; }
    this._updateStageMotion();
    const blend = this._reducedMotion ? 1 : 1 - Math.exp(-delta * 4);
    this._camera.position.lerp(this._cameraPos, blend);
    this._currentLookAt.lerp(this._cameraTarget, blend); this._camera.lookAt(this._currentLookAt);
    if (!this._reducedMotion && !this._isPaused) this._room?.fans.forEach(fan => { fan.rotation.y += delta * 2.3; });
    this._renderer.render(this._scene, this._camera);
  },

  /* ==================== 6. ORCHESTRATION & CONTROLS ==================== */
  setCamera(presetId, isUserAction = false) {
    const preset = this.CAMERAS[presetId];
    if (!preset) return;

    if (isUserAction) {
      this._cameraMode = presetId; this._autoCamera = false;
      document.getElementById('v3-auto-camera')?.setAttribute('aria-pressed', 'false');
    }

    this._cameraMode = presetId;
    if (!this._cameraPos || !this._cameraTarget) return;
    this._cameraPos.set(...preset.pos);
    this._cameraTarget.set(...preset.target);

    // Update UI active buttons
    document.querySelectorAll('.v3-cam-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const btnMap = {
      WIDE: 'v3-cam-wide',
      JUDGE: 'v3-cam-judge',
      DEFENSE: 'v3-cam-defense',
      PROSECUTION: 'v3-cam-pros', GALLERY: 'v3-cam-gallery', STAFF: 'v3-cam-staff', WITNESS: 'v3-cam-witness', WITNESS_OTHER: 'v3-cam-witness-other'
    };
    const targetBtnId = btnMap[presetId];
    if (targetBtnId) {
      const el = document.getElementById(targetBtnId);
      if (el) { el.classList.add('active'); el.setAttribute('aria-pressed', 'true'); }
    }
  },

  togglePause() {
    if (!this._isPlaying || !this._ready || this._timelineIndex >= this._timeline.length) return;
    ++this._speechGeneration;
    this._cancelStreamAudio();
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

  _resumeCurrentStep() { this._runStage(false); },
  _playNextStep() { this._runStage(true); },

  _frameStage(stage) {
    if (!stage || !this._autoCamera) return;
    const id = this.CAMERAS[stage.camera] ? stage.camera : 'WIDE';
    this.setCamera(id);
    if (stage.actor.startsWith('JUDGE') && id === 'JUDGE') {
      const p = this.SPEAKER_COORDS[stage.actor];
      this._cameraTarget.set(p.x, p.y + 1.45, p.z);
      this._cameraPos.set(p.x * .65, 2.45, this._courtConfig.benchZ + 4.7);
    }
  },

  _runStage(restorePositions = false) {
    if (!this._ready) return;
    ++this._speechGeneration; this._speaking = false;
    this._captionCompletion=null;
    this._cancelStreamAudio();
    window.speechSynthesis?.cancel(); clearTimeout(this._stepTimeout);
    if (this._timelineIndex >= this._timeline.length) { this._endSimulation(); return; }
    const original = this._timeline[this._timelineIndex];
    const stage = original.kind==='await-answer'&&this._interactions[original.answerKey]?.answer
      ? {...original,kind:'answer',text:this._interactions[original.answerKey].answer,silent:false}
      : original.kind==='question' ? {...original,text:this._interactions[original.questionKey]?.question||original.text,silent:false} : original;
    this._activeStage = stage; this._speechDone = Boolean(stage.silent);
    this._renderInteraction(stage);
    this._currentStep = Math.max(0, stage.sourceIndex);
    this._activeSpeakerId = stage.silent ? null : stage.actor;
    if (restorePositions) Object.entries(stage.positions).forEach(([key, pos]) => {
      const model = this._avatarModels[key]; if(model) model.position.set(...pos);
    });
    if (!this._isPaused || this._timelineIndex > 0) this._frameStage(stage);
    const judgeNumber = Object.keys(this.SPEAKER_COORDS).filter(k=>k.startsWith('JUDGE')).indexOf(stage.actor) + 1;
    const language = this._detectIndianLanguage(stage.text, this._activeLanguage);
    const role = stage.actor.startsWith('JUDGE') ? (language.shortCode === 'hi' ? 'न्यायाधीश' : language.shortCode === 'te' ? 'న్యాయమూర్తి' : 'Judge') + ' ' + judgeNumber : stage.actor.startsWith('WITNESS') ? (language.shortCode === 'hi' ? 'गवाह' : language.shortCode === 'te' ? 'సాక్షి' : 'Witness') : stage.actor === 'DEFENSE' ? 'Your counsel' : 'Opposing counsel';
    const speaker = stage.kind === 'dialogue' && !stage.actor.startsWith('JUDGE') ? (stage.name || role) : role;
    document.getElementById('v3-speaker-text').textContent = speaker;
    const text = document.getElementById('v3-subtitle-text'); text.innerHTML = this._highlightLegalPointsInText(stage.text); text.dir = 'auto';
    document.getElementById('v3-subtitle').classList.add('active');
    document.getElementById('v3-subtitle').classList.toggle('paused', this._isPaused || stage.silent);
    document.getElementById('v3-stage-label').textContent = (stage.kind === 'dialogue' ? 'CASE DIALOGUE' : ['answer','question'].includes(stage.kind) ? 'PRACTICE Q & A' : 'PRACTICE DIRECTION') + ' · ' + (this._timelineIndex + 1) + ' / ' + this._timeline.length;
    document.getElementById('v3-exchange-badge').textContent = 'Case turn ' + (this._currentStep + 1) + ' / ' + this._script.length;
    document.getElementById('v3-lang-badge-text').textContent = language.displayBadge;
    document.getElementById('v3-record-speaker').textContent = speaker;
    this._recordCharacters = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(language.code,{granularity:'grapheme'}).segment(stage.text)].map(x=>x.segment) : Array.from(stage.text);
    Object.entries(this._actions).forEach(([actor,action])=>{action.paused = this._isPaused || stage.silent || actor !== stage.actor;});
    const pause = document.getElementById('v3-pause-btn'); pause.disabled = false;
    document.getElementById('v3-pause-text').textContent = this._isPaused ? (this._timelineIndex ? 'Resume' : 'Begin hearing') : 'Pause';
    document.getElementById('v3-status-text').textContent = this._isPaused ? 'PAUSED' : 'IN SESSION';
    document.getElementById('v3-pause-icon').textContent=this._isPaused?'play_arrow':'pause';
    document.getElementById('v3-status').classList.toggle('paused',this._isPaused);
    document.getElementById('v3-status').classList.toggle('recording',!this._isPaused);
    if (this._isPaused || stage.silent) return;
    this._speaking = true;
    const generation = this._sceneGeneration, index = this._timelineIndex;
    this._speakText(stage.text, stage.pitch || 1, stage.rate || 1, ()=>{
      if(generation!==this._sceneGeneration || index!==this._timelineIndex)return;
      this._speechDone = true; this._speaking = false;
      Object.values(this._actions).forEach(action=>{action.paused=true;});
    });
  },

  _updateStageMotion() {
    const stage = this._activeStage;
    if (!this._ready || !stage) return;
    const moving = new Set(Object.keys(stage.paths || {})), t = this._motionTime;
    for (const [actor, path] of Object.entries(stage.paths || {})) {
      const model=this._avatarModels[actor]; if(!model)continue;
      const result=CourtroomDirector.pointOnPath(path, this._reducedMotion ? 1 : this._stageElapsed / Math.max(stage.duration,.01));
      model.position.set(...result.point); model.rotation.y=result.angle;
      if(!this._reducedMotion && this._stageElapsed<stage.duration) model.position.y += Math.abs(Math.sin(t*6))*0.018;
    }
    for (const [actor,model] of Object.entries(this._avatarModels)) {
      const rig=this._actorRigs[actor] || [], walk=moving.has(actor) && this._stageElapsed<stage.duration && !this._reducedMotion;
      const talking=this._speaking && actor===stage.actor;
      const witnessFocus=stage.actor.startsWith('WITNESS')?stage.actor:stage.lookAt?.startsWith('WITNESS')?stage.lookAt:null;
      const lookActor=actor===stage.actor && stage.lookAt ? stage.lookAt : actor.startsWith('WITNESS') ? stage.actor : actor==='DEFENSE'||actor==='PROSECUTION' ? (witnessFocus||'JUDGE') : stage.actor;
      const target=this._avatarModels[lookActor];
      if(!moving.has(actor) && !actor.startsWith('JUDGE') && target && target!==model) {
        const desired=Math.atan2(target.position.x-model.position.x,target.position.z-model.position.z);
        const d=desired-model.rotation.y; model.rotation.y+=Math.atan2(Math.sin(d),Math.cos(d))*.08;
      }
      rig.forEach(({bone,animate})=>{
        if(!animate)return;
        const name=bone.name;
        if(walk) {
          const sign=/Left/.test(name)?1:-1;
          if(/UpLeg/.test(name)) bone.rotateX(Math.sin(t*6)*.36*sign);
          else if(/(Left|Right)Leg/.test(name)) bone.rotateX(Math.max(0,-Math.sin(t*6)*sign)*.5);
          else if(/(Left|Right)Arm/.test(name)) bone.rotateX(-Math.sin(t*6)*.18*sign);
        }
        if(/Head/.test(name) && !/Top/.test(name) && !this._reducedMotion) {
          bone.rotateX(Math.sin(t*(talking?3.1:.8))*(talking?.035:.008));
          if(target && target!==model) {
            const a=Math.atan2(target.position.x-model.position.x,target.position.z-model.position.z)-model.rotation.y;
            bone.rotateY(THREE.MathUtils.clamp(Math.atan2(Math.sin(a),Math.cos(a)),-.24,.24));
          }
        }
        if(stage.gesture==='objection' && actor===stage.actor && /RightArm/.test(name)) bone.rotateX(-.4);
      });
    }
    const active=this._avatarModels[stage.actor];
    if(!this._reducedMotion) {
      IndianCourtroom.animateParticipants(this._room.participants,t,active?.position,this._speaking,false);
      IndianCourtroom.updateParticipantBatches(this._room);
    }
    const record=document.getElementById('v3-record-text');
    if(record && !document.getElementById('v3-record').hidden) {
      const count=this._speechDone ? this._recordCharacters?.length : Math.ceil(this._stageElapsed*15);
      record.textContent=(this._recordCharacters||[]).slice(0,count).join('');
    }
    if(!this._isPaused && !this._awaiting && this._speechDone && this._stageElapsed >= Math.max(stage.duration, .65)) {
      this._timelineIndex++; this._stageElapsed=0; this._runStage(true);
    }
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
    const allVoices = window.speechSynthesis.getVoices();
    const voices = allVoices.filter(voice => voice.lang?.toLowerCase().split('-')[0] === langCode.toLowerCase().split('-')[0]);
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

    if (actorKey.startsWith('JUDGE')) {
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
    if(actorKey?.startsWith('JUDGE')) actorKey = 'JUDGE';
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
    const generation = this._sceneGeneration, speech = ++this._speechGeneration;
    const current = () => this._isPlaying && !this._isPaused && generation === this._sceneGeneration && speech === this._speechGeneration;
    const finish = onEnd; onEnd = () => { if (current()) finish(); };
    this._cancelStreamAudio();
    window.speechSynthesis?.cancel();
    if (!this._voiceEnabled) {
      this._stepTimeout = setTimeout(onEnd, Math.max(3500, Math.min(14000, text.length * 48)));
      return;
    }
    const language = this._getSpeechLanguageCode(text);
    if (!window.speechSynthesis || !this._findVoice(this._activeSpeakerId, language)) {
      // Only built-in public prompts may use the external speech proxy. Never send case text.
      const fixedPrompt = this._activeStage?.kind === 'practice'
        && Object.values(CourtroomDirector.cues).some(values => values.includes(text));
      if (fixedPrompt) { this._speakPracticePrompt(text, language, current, onEnd); return; }
      const hint=document.getElementById('v3-voice-hint');
      if(hint)hint.textContent='A matching browser voice is needed for this case language. Case text stays in the browser; captions continue.';
      if(this._activeSpeakerId?.startsWith('WITNESS')) {
        this._captionCompletion=onEnd;this._awaiting=true;this._speaking=false;
        Object.values(this._actions).forEach(action=>{action.paused=true;});
        const panel=document.getElementById('v3-interaction');panel.hidden=false;
        panel.innerHTML='<div class="v3-answer-actions"><button class="v3-answer-submit" onclick="VirtualCourtSimulator.completeCaptionAnswer()">'+Utils.escapeHtml(this._interactionWords().complete)+'</button></div>';
        document.querySelector('[aria-label="Next stage"]')?.setAttribute('disabled','');
        return;
      }
      this._stepTimeout=setTimeout(onEnd,Math.max(3500,Math.min(14000,text.length*48)));
      return;
    }

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
      if (!current()) return;
      if (segIndex >= totalSegs) {
        onEnd();
        return;
      }

      const seg = segments[segIndex];
      const utterance = new SpeechSynthesisUtterance(seg.text);
      utterance.pitch = seg.pitch + (this._activeSpeakerId === 'JUDGE_0' ? .08 : this._activeSpeakerId === 'JUDGE_1' ? .14 : 0);
      utterance.rate = seg.rate * (this._courtConfig?.voiceRate || 1);
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
        if (!current()) return;
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
        if (!current()) return;
        const hint = document.getElementById('v3-voice-hint');
        if (hint) hint.textContent = 'Speech is unavailable in this browser. Captions will continue; use Pause to read at your pace.';
        this._stepTimeout = setTimeout(onEnd, Math.max(3500, Math.min(14000, text.length * 48)));
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextSegment();
  },

  _cancelStreamAudio() {
    this._audioAbort?.abort(); this._audioAbort = null;
    clearTimeout(this._audioTimeout);
    if (this._streamAudio) { this._streamAudio.onended=null; this._streamAudio.onerror=null; this._streamAudio.pause(); this._streamAudio.src=''; this._streamAudio=null; }
    if (this._audioObjectUrl) { URL.revokeObjectURL(this._audioObjectUrl); this._audioObjectUrl=null; }
  },

  async _speakPracticePrompt(text, language, current, onEnd) {
    // Defence in depth: callers cannot use this method to send arbitrary testimony to the proxy.
    const locale = language.split('-')[0];
    if (!CourtroomDirector.cues[locale]?.includes(text)) return;
    try {
      const controller=new AbortController(); this._audioAbort=controller;
      this._audioTimeout=setTimeout(()=>controller.abort(),12000);
      const host=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'
        ? 'http://'+window.location.hostname+':5000' : window.location.origin;
      const response=await fetch(host+'/api/ai/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:locale}),signal:controller.signal});
      clearTimeout(this._audioTimeout);
      if(!response.ok||!response.headers.get('content-type')?.includes('audio/'))throw new Error('Practice speech unavailable');
      const blob=await response.blob(); if(!current())return;
      const url=URL.createObjectURL(blob); this._audioObjectUrl=url;
      const audio=new Audio(url); this._streamAudio=audio;
      audio.playbackRate = this._activeSpeakerId?.startsWith('JUDGE') ? 0.96 : 1;
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('Audio timeout')),45000);
        controller.signal.addEventListener('abort',()=>{clearTimeout(timeout);reject(new Error('Audio cancelled'));},{once:true});
        audio.onended=()=>{clearTimeout(timeout);resolve();}; audio.onerror=()=>{clearTimeout(timeout);reject(new Error('Audio failed'));};
        audio.play().catch(error=>{clearTimeout(timeout);reject(error);});
      });
      URL.revokeObjectURL(url); if(this._audioObjectUrl===url)this._audioObjectUrl=null;
      if(current())onEnd();
    }catch(error){
      if(!current())return;
      this._cancelStreamAudio();
      const hint=document.getElementById('v3-voice-hint'); if(hint)hint.textContent='Practice audio is unavailable. Captions continue; check the AI speech service.';
      this._stepTimeout=setTimeout(onEnd,Math.max(3500,Math.min(14000,text.length*48)));
    }
  },

  _endSimulation() {
    this._isPaused = true; this._activeSpeakerId = null; this._activeStage = null; this._speaking = false;
    const pause = document.getElementById('v3-pause-btn'); if (pause) pause.disabled = true;
    document.getElementById('v3-subtitle')?.classList.add('paused');
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

    const last = this._script[this._script.length - 1];
    if (speakerTextEl) speakerTextEl.textContent = last?.name || 'Hearing completed';
    if (textEl) textEl.innerHTML = this._highlightLegalPointsInText(last?.text || '');
    document.getElementById('v3-stage-label').textContent = 'PRACTICE COMPLETED · Restart to rehearse again';
    if (subContainer) subContainer.classList.add('active');
  },

  stopSimulation() {
    this._saveCourtProgress();
    this._isPlaying = false; this._isPaused = false; this._ready = false;
    ++this._sceneGeneration; ++this._speechGeneration; this._speaking = false; this._activeStage = null;
    this._captionCompletion=null;
    this._cancelStreamAudio();
    clearTimeout(this._stepTimeout); clearTimeout(this._noticeTimeout);
    this._stepTimeout = null;
    window.speechSynthesis?.cancel();
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
    this._animationFrameId = null;
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    document.removeEventListener('fullscreenchange', this._fullscreenHandler); window.removeEventListener('keydown', this._escapeHandler);
    this._resizeObserver?.disconnect(); this._mountObserver?.disconnect();
    this._resizeObserver = this._mountObserver = null;
    Object.values(this._mixers).forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
    IndianCourtroom.dispose(this._scene);
    this._renderer?.dispose(); this._renderer?.forceContextLoss();
    this._scene = this._renderer = this._room = null; this._actorRigs = {};
    this._cameraPos = this._cameraTarget = null;
    this._mixers = {}; this._actions = {}; this._avatarModels = {}; this._speakerRings = {};
  }


};
