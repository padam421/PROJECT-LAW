/* ============================================================
   Nyay Setu — TEXT-TO-SPEECH (TTS) AUDIO READOUT CONTROLLER
   chat_tts.js — Cross-lingual speech synthesis for AI responses
   Supports 22 Indian regional languages with dual-engine reliability:
   Engine 1: Web Speech API (with Garbage Collection protection)
   Engine 2: AI Backend Audio Stream (/api/ai/tts on port 5000)
   ============================================================ */

const NyaySetuTTS = {
  _activeMsgId: null,
  _activeLangCode: 'hi',
  _activeCallbacks: null,
  _isPlaying: false,
  _audioElement: null,
  _queue: [],
  _queueIndex: 0,
  _currentMode: 'web_speech',

  // Map language codes to TTS codes
  _LANG_MAP: {
    'auto': 'hi',
    'hi': 'hi',
    'mr': 'mr',
    'gu': 'gu',
    'bn': 'bn',
    'ta': 'ta',
    'te': 'te',
    'kn': 'kn',
    'ml': 'ml',
    'pa': 'pa',
    'ur': 'ur',
    'or': 'or',
    'as': 'as',
    'ne': 'ne',
    'sa': 'sa',
    'en': 'en'
  },

  _BCP47_MAP: {
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
  },

  /**
   * Cleans raw Markdown legal output into natural, friendly spoken text.
   * Strips asterisks, hashes, horizontal dividers, URLs, and emojis.
   */
  cleanTextForSpeech(text) {
    if (!text) return '';
    let cleaned = text;

    // Remove markdown headers
    cleaned = cleaned.replace(/^#{1,6}\s*[\d\.]*\s*/gm, '');

    // Remove bold and italics
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

    // Remove code blocks and inline code
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Remove horizontal rules
    cleaned = cleaned.replace(/^-{3,}$/gm, '');

    // Remove markdown links
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove bullets and emojis
    cleaned = cleaned.replace(/^[\*\-•]\s+/gm, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // Normalize spacing
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  },

  /**
   * Splits long text into natural, digestible sentence chunks (max 180 chars).
   */
  splitIntoChunks(text, maxLen = 180) {
    if (!text) return [];
    const sentences = text.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [text];
    const chunks = [];

    for (let s of sentences) {
      s = s.trim();
      if (!s) continue;
      if (s.length <= maxLen) {
        chunks.push(s);
      } else {
        const words = s.split(' ');
        let cur = '';
        for (let w of words) {
          if ((cur + ' ' + w).trim().length <= maxLen) {
            cur = (cur + ' ' + w).trim();
          } else {
            if (cur) chunks.push(cur);
            cur = w;
          }
        }
        if (cur) chunks.push(cur);
      }
    }
    return chunks.filter(c => c.trim().length > 0);
  },

  /**
   * Finds the best matching voice on the device for the given language.
   */
  getBestVoice(bcp47Tag) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetPrefix = bcp47Tag.toLowerCase().split('-')[0];

    // 1. Exact BCP-47 match (e.g. 'hi-IN', 'mr-IN', 'ta-IN')
    let match = voices.find(v => v.lang && v.lang.toLowerCase() === bcp47Tag.toLowerCase());
    if (match) return match;

    // 2. Language prefix match (e.g. 'hi', 'mr', 'ta')
    match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(targetPrefix));
    if (match) return match;

    // 3. Indian Hindi voice for Indian regional languages
    match = voices.find(v => v.lang && (v.lang.toLowerCase().includes('hi-in') || v.name.toLowerCase().includes('hindi')));
    if (match) return match;

    // 4. Indian English fallback
    match = voices.find(v => v.lang && (v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india')));
    if (match) return match;

    // 5. Default browser voice
    return voices.find(v => v.default) || voices[0];
  },

  /**
   * Speaks the response text in the selected language.
   */
  speak(msgId, text, langCode = 'auto', callbacks = {}) {
    // If currently speaking this message, toggle stop
    if (this._isPlaying && this._activeMsgId === msgId) {
      this.stop();
      return false;
    }

    // Stop any other active speech
    this.stop();

    const cleaned = this.cleanTextForSpeech(text);
    if (!cleaned) return false;

    const chunks = this.splitIntoChunks(cleaned);
    if (chunks.length === 0) return false;

    let resolvedLang = langCode;
    if (!resolvedLang || resolvedLang === 'auto') {
      // Auto-detect based on text script
      const hasDevanagari = /[\u0900-\u097F]/.test(cleaned);
      const hasBengali = /[\u0980-\u09FF]/.test(cleaned);
      const hasTamil = /[\u0B80-\u0BFF]/.test(cleaned);
      const hasTelugu = /[\u0C00-\u0C7F]/.test(cleaned);
      const hasGujarati = /[\u0A80-\u0AFF]/.test(cleaned);
      const hasKannada = /[\u0C80-\u0CFF]/.test(cleaned);
      const hasMalayalam = /[\u0D00-\u0D7F]/.test(cleaned);
      const hasGurmukhi = /[\u0A00-\u0A7F]/.test(cleaned);
      if (hasDevanagari) resolvedLang = 'hi';
      else if (hasBengali) resolvedLang = 'bn';
      else if (hasTamil) resolvedLang = 'ta';
      else if (hasTelugu) resolvedLang = 'te';
      else if (hasGujarati) resolvedLang = 'gu';
      else if (hasKannada) resolvedLang = 'kn';
      else if (hasMalayalam) resolvedLang = 'ml';
      else if (hasGurmukhi) resolvedLang = 'pa';
      else if (/[a-zA-Z]{3,}/.test(cleaned)) resolvedLang = 'en';
      else resolvedLang = 'hi';
    }

    const shortLang = this._LANG_MAP[resolvedLang] || 'hi';
    const bcp47 = this._BCP47_MAP[resolvedLang] || 'hi-IN';

    this._activeMsgId = msgId;
    this._activeLangCode = shortLang;
    this._activeCallbacks = callbacks;
    this._isPlaying = true;
    this._queue = chunks;
    this._queueIndex = 0;

    // Detect if browser has native voices for this language
    const hasWebSpeech = ('speechSynthesis' in window);
    const voices = hasWebSpeech ? window.speechSynthesis.getVoices() : [];
    const hasMatchingVoice = voices.some(v => v.lang && (
      v.lang.toLowerCase().startsWith(shortLang) ||
      (shortLang === 'hi' && (v.lang.toLowerCase().includes('hi') || v.name.toLowerCase().includes('hindi')))
    ));

    // Use Web Speech only if matching native voice exists or language is English.
    // Otherwise, seamlessly use our high-fidelity AI Audio Stream (/api/ai/tts)
    // which speaks flawless native Hindi, Marathi, Gujarati, etc. with zero setup needed!
    if (hasWebSpeech && (hasMatchingVoice || shortLang === 'en')) {
      this._currentMode = 'web_speech';
    } else {
      this._currentMode = 'audio_stream';
    }

    if (callbacks.onStart) {
      try { callbacks.onStart(msgId); } catch (_) {}
    }

    this._playNextChunk();
    return true;
  },

  _playNextChunk() {
    if (!this._isPlaying) return;

    if (this._queueIndex >= this._queue.length) {
      this._handleComplete();
      return;
    }

    const chunk = this._queue[this._queueIndex];

    if (this._currentMode === 'web_speech' && ('speechSynthesis' in window)) {
      this._playWebSpeechChunk(chunk);
    } else {
      this._playAudioStreamChunk(chunk);
    }
  },

  _playWebSpeechChunk(chunk) {
    try {
      window.speechSynthesis.cancel();

      const bcp47 = this._BCP47_MAP[this._activeLangCode] || 'hi-IN';
      const voice = this.getBestVoice(bcp47);

      const utterance = new SpeechSynthesisUtterance(chunk);
      // Store in window to eliminate Chromium garbage collection bug!
      window._nyayActiveUtterance = utterance;

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || bcp47;
      } else {
        utterance.lang = bcp47;
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        window._nyayActiveUtterance = null;
        if (!this._isPlaying) return;
        this._queueIndex++;
        setTimeout(() => this._playNextChunk(), 100);
      };

      utterance.onerror = (e) => {
        window._nyayActiveUtterance = null;
        console.warn('Web Speech API error, switching to Backend Audio Stream:', e);
        // Seamlessly switch to audio stream for this and remaining chunks!
        this._currentMode = 'audio_stream';
        this._playAudioStreamChunk(chunk);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error, falling back to audio stream:', err);
      this._currentMode = 'audio_stream';
      this._playAudioStreamChunk(chunk);
    }
  },

  _playAudioStreamChunk(chunk) {
    if (!this._isPlaying) return;

    try {
      if (this._audioElement) {
        this._audioElement.pause();
        this._audioElement.src = '';
        this._audioElement = null;
      }

      const lang = this._activeLangCode || 'hi';
      const aiHost = (typeof window !== 'undefined' && window.location && window.location.hostname)
        ? `http://${window.location.hostname}:5000`
        : 'http://127.0.0.1:5000';
      const url = `${aiHost}/api/ai/tts?text=${encodeURIComponent(chunk)}&lang=${lang}`;

      const audio = new Audio(url);
      this._audioElement = audio;

      audio.onended = () => {
        if (!this._isPlaying) return;
        this._queueIndex++;
        setTimeout(() => this._playNextChunk(), 100);
      };

      audio.onerror = (e) => {
        console.warn('Audio stream error on chunk', this._queueIndex, e);
        // Fallback to Web Speech if audio stream errors
        if ('speechSynthesis' in window && this._currentMode !== 'web_speech') {
          this._currentMode = 'web_speech';
          this._playWebSpeechChunk(chunk);
        } else {
          this._queueIndex++;
          if (this._queueIndex < this._queue.length) {
            this._playNextChunk();
          } else {
            this._handleComplete();
          }
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Audio play error, falling back to Web Speech:', err);
          if ('speechSynthesis' in window) {
            this._currentMode = 'web_speech';
            this._playWebSpeechChunk(chunk);
          } else {
            this._handleComplete();
          }
        });
      }
    } catch (e) {
      console.error('Failed to create audio element:', e);
      this._handleComplete();
    }
  },

  _handleComplete() {
    const finishedMsgId = this._activeMsgId;
    const callbacks = this._activeCallbacks;

    this.stop();

    if (callbacks && callbacks.onEnd) {
      try { callbacks.onEnd(finishedMsgId); } catch (_) {}
    }
  },

  stop() {
    this._isPlaying = false;
    this._queue = [];
    this._queueIndex = 0;
    window._nyayActiveUtterance = null;

    if (this._audioElement) {
      try {
        this._audioElement.pause();
        this._audioElement.currentTime = 0;
      } catch (_) {}
      this._audioElement = null;
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    const msgId = this._activeMsgId;
    this._activeMsgId = null;

    if (this._activeCallbacks && this._activeCallbacks.onEnd && msgId) {
      try { this._activeCallbacks.onEnd(msgId); } catch (_) {}
    }
    this._activeCallbacks = null;
  },

  isSpeaking(msgId = null) {
    if (msgId) {
      return this._isPlaying && this._activeMsgId === msgId;
    }
    return this._isPlaying;
  },

  getActiveMsgId() {
    return this._activeMsgId;
  }
};

// Ensure voices are loaded into browser cache on startup
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
