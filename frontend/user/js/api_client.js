/* ============================================================
   Nyay Setu USER — STATE STORE & API CLIENT
   api_client.js — User-side state management + API helpers
   ============================================================ */

const UserStore = {
  _state: {},
  STORAGE_KEY: 'lc_user_store',

  /* ---- State ---- */
  get(key) {
    return key ? this._state[key] : { ...this._state };
  },

  set(key, val) {
    this._state[key] = val;
    this._persist();
  },

  update(key, updater) {
    const cur = this._state[key];
    this.set(
      key,
      typeof updater === 'function' ? updater(cur) : { ...cur, ...updater }
    );
  },

  /* ---- User ---- */
  getUser() {
    return this._state.userProfile || AuthManager.getSession() || {};
  },

  setUser(data) {
    this._state.userProfile = data;
    this._persist();
  },

  /* ---- Convenience ---- */
  getCases() {
    return this._state.cases || [];
  },
  getActiveCase() {
    return (
      this.getCases().find((c) => c.status === 'ongoing') ||
      this.getCases()[0] ||
      null
    );
  },

  getDocuments() {
    return this._state.documents || [];
  },

  getLawyer() {
    return this._state.myLawyer || null;
  },

  getNotifications() {
    return this._state.notifications || [];
  },
  getUnreadNotifications() {
    return this.getNotifications().filter((n) => !n.read);
  },

  getConsultations() {
    return this._state.consultations || [];
  },
  getUpcomingHearing() {
    const cases = this.getCases();
    for (const c of cases) {
      if (c.nextHearing)
        return { ...c.nextHearing, caseTitle: c.title, caseId: c.id };
    }
    return null;
  },

  getLanguage() {
    return this._state.language || 'en';
  },
  setLanguage(lang) {
    this.set('language', lang);
  },

  getStorageKey() {
    const session = AuthManager.getSession();
    const id = session ? session.email || session.id || 'default' : 'guest';
    return 'lc_user_store_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
  },

  /* ---- Persistence ---- */
  _persist() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this._state));
    } catch {}
  },

  reset() {
    try {
      localStorage.removeItem(this.getStorageKey());
    } catch {}
    this._state = {};
  },

  init() {
    try {
      const cached = localStorage.getItem(this.getStorageKey());
      if (cached) this._state = JSON.parse(cached);
      else this._state = {};
    } catch {
      this._state = {};
    }

    // Default clean collections for real users
    const defaults = {
      cases: [],
      documents: [],
      notifications: [],
      consultations: [],
      conversations: [],
      myLawyer: null,
      language: 'en',
      securitySetupDone: false,
      privacyConsentDone: false,
    };

    let changed = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (this._state[k] === undefined) {
        this._state[k] = v;
        changed = true;
      }
    }
    if (changed) this._persist();
  },
};

/* ============================================================
   USER API CLIENT — Live Nyay Setu API client
   ============================================================ */
const UserApiClient = {
  getUrl(endpoint) {
    if (
      window.AuthManager &&
      typeof window.AuthManager.getApiUrl === 'function'
    ) {
      return window.AuthManager.getApiUrl(endpoint);
    }
    if (
      window.location.protocol === 'http:' ||
      window.location.protocol === 'https:'
    ) {
      if (
        window.location.port !== '3000' &&
        (window.location.hostname === '127.0.0.1' ||
          window.location.hostname === 'localhost')
      ) {
        return `${window.location.protocol}//${window.location.hostname}:3000${endpoint}`;
      }
    } else if (window.location.protocol === 'file:') {
      return 'http://localhost:3000' + endpoint;
    }
    return endpoint;
  },

  async searchLawyers(filters = {}) {
    try {
      const res = await fetch(this.getUrl('/api/lawyers'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.lawyers) && data.lawyers.length > 0) {
          return data.lawyers;
        }
      }
    } catch (e) {
      console.warn('[UserApiClient] Fallback to cached lawyers:', e.message);
    }

    // Demo fallback if backend is offline
    return [
      {
        id: 'law_adv_padam',
        name: 'Adv. Padam Kishore',
        specialization: 'Corporate & Constitutional Law',
        experience: '10 Years',
        experienceYears: 10,
        rating: 5.0,
        reviews: 142,
        fee: 1200,
        feeDuration: '30 min',
        languages: ['English', 'Hindi'],
        courts: ['High Court', 'Supreme Court'],
        barCouncil: 'DL/4521/2016',
        verified: true,
        available: true,
        city: 'Jaipur',
        state: 'Rajasthan',
        whyRecommend:
          'Top-rated corporate and constitutional advocate with extensive High Court practice.',
      },
      {
        id: 'law_adv_vikram',
        name: 'Adv. Vikramaditya Rathore',
        specialization: 'Criminal Defense & White Collar Crime',
        experience: '12 Years',
        experienceYears: 12,
        rating: 4.9,
        reviews: 184,
        fee: 1500,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Rajasthani'],
        courts: ['Session Court', 'High Court'],
        barCouncil: 'RJ/3102/2014',
        verified: true,
        available: true,
        city: 'Jaipur',
        state: 'Rajasthan',
        whyRecommend:
          'Senior criminal defense counsel handling critical bail, trial and appellate matters.',
      },
      {
        id: 'law_adv_priya',
        name: 'Adv. Priya Deshmukh',
        specialization: 'Property & Real Estate Law',
        experience: '14 Years',
        experienceYears: 14,
        rating: 4.95,
        reviews: 260,
        fee: 900,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Marathi'],
        courts: ['District Court', 'High Court'],
        barCouncil: 'MH/6541/2012',
        verified: true,
        available: true,
        city: 'Mumbai',
        state: 'Maharashtra',
        whyRecommend:
          'Distinguished land acquisition, property title verification and partition expert.',
      },
      {
        id: 'law_adv_ananya',
        name: 'Adv. Ananya Sengupta',
        specialization: 'Family, Matrimonial & Child Custody',
        experience: '9 Years',
        experienceYears: 9,
        rating: 4.85,
        reviews: 118,
        fee: 750,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Bengali'],
        courts: ['Family Court', 'District Court'],
        barCouncil: 'WB/2390/2017',
        verified: true,
        available: true,
        city: 'Kolkata',
        state: 'West Bengal',
        whyRecommend:
          'Empathetic and sharp matrimonial dispute counsel with mediation expertise.',
      },
      {
        id: 'law_adv_arjun',
        name: 'Adv. Arjun Mehta',
        specialization: 'Corporate & Business Law',
        experience: '16 Years',
        experienceYears: 16,
        rating: 4.92,
        reviews: 310,
        fee: 2000,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Gujarati'],
        courts: ['High Court', 'NCLT'],
        barCouncil: 'GJ/1890/2010',
        verified: true,
        available: true,
        city: 'Ahmedabad',
        state: 'Gujarat',
        whyRecommend:
          'Expert in M&A, partnership disputes and NCLT proceedings with 200+ successful resolutions.',
      },
      {
        id: 'law_adv_kavita',
        name: 'Adv. Kavita Sharma',
        specialization: 'Civil & Consumer Protection',
        experience: '8 Years',
        experienceYears: 8,
        rating: 4.8,
        reviews: 95,
        fee: 600,
        feeDuration: '30 min',
        languages: ['English', 'Hindi'],
        courts: ['Consumer Forum', 'District Court'],
        barCouncil: 'RJ/5612/2018',
        verified: true,
        available: true,
        city: 'Udaipur',
        state: 'Rajasthan',
        whyRecommend:
          'Specializes in consumer complaints, landlord-tenant disputes and civil injunctions.',
      },
      {
        id: 'law_adv_rohit',
        name: 'Adv. Rohit Saxena',
        specialization: 'Criminal Defense',
        experience: '20 Years',
        experienceYears: 20,
        rating: 4.98,
        reviews: 420,
        fee: 2500,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Urdu'],
        courts: ['Session Court', 'High Court', 'Supreme Court'],
        barCouncil: 'DL/0987/2006',
        verified: true,
        available: true,
        city: 'Delhi',
        state: 'Delhi',
        whyRecommend:
          'Senior criminal advocate with Supreme Court practice. Known for landmark bail and habeas corpus cases.',
      },
      {
        id: 'law_adv_neha',
        name: 'Adv. Neha Kulkarni',
        specialization: 'Property & Land Revenue',
        experience: '11 Years',
        experienceYears: 11,
        rating: 4.88,
        reviews: 178,
        fee: 1000,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Kannada'],
        courts: ['District Court', 'Revenue Tribunal'],
        barCouncil: 'KA/4320/2015',
        verified: true,
        available: true,
        city: 'Bangalore',
        state: 'Karnataka',
        whyRecommend:
          'Expert in land mutation, revenue records and property registration disputes across South India.',
      },
      {
        id: 'law_adv_sanjay',
        name: 'Adv. Sanjay Thakur',
        specialization: 'Family & Matrimonial Law',
        experience: '13 Years',
        experienceYears: 13,
        rating: 4.82,
        reviews: 156,
        fee: 850,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Punjabi'],
        courts: ['Family Court', 'High Court'],
        barCouncil: 'PB/2341/2013',
        verified: true,
        available: true,
        city: 'Chandigarh',
        state: 'Punjab',
        whyRecommend:
          'Handles complex divorce, alimony, child custody and domestic violence cases with compassion.',
      },
      {
        id: 'law_adv_deepika',
        name: 'Adv. Deepika Reddy',
        specialization: 'Cyber Law & IT Act',
        experience: '7 Years',
        experienceYears: 7,
        rating: 4.75,
        reviews: 72,
        fee: 1100,
        feeDuration: '30 min',
        languages: ['English', 'Hindi', 'Telugu'],
        courts: ['District Court', 'High Court'],
        barCouncil: 'TG/6789/2019',
        verified: true,
        available: false,
        city: 'Hyderabad',
        state: 'Telangana',
        whyRecommend:
          'Rising star in cyber crime defense, data privacy compliance and IT Act advisory.',
      },
    ];
  },

  async getLawyerById(id) {
    try {
      const res = await fetch(this.getUrl(`/api/lawyers/${id}`));
      if (res.ok) {
        const data = await res.json();
        if (data.lawyer) return data.lawyer;
      }
    } catch (_) {}
    const list = await this.searchLawyers();
    return list.find((l) => l.id === id) || list[0];
  },

  async bookConsultation(payload) {
    try {
      const res = await fetch(this.getUrl('/api/consultations/book'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.consultation;
      }
    } catch (e) {
      console.warn(
        '[UserApiClient] Real-time booking failed, fallback local:',
        e.message
      );
    }
    // Fallback object
    return {
      id: `cst_${Date.now()}`,
      userId: payload.userId || 'usr_mtlac008z0vvsq',
      lawyerId: payload.lawyerId,
      date: payload.date,
      time: payload.time,
      mode: payload.mode || 'video',
      status: 'pending',
      fee: payload.fee,
      total: payload.total,
    };
  },

  async fetchNotifications() {
    try {
      const res = await fetch(this.getUrl('/api/notifications'), {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return data.notifications || [];
      }
    } catch (_) {}
    return UserStore.getNotifications();
  },

  async fetchUserConsultations() {
    try {
      const res = await fetch(this.getUrl('/api/consultations/user'), {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return data.consultations || [];
      }
    } catch (_) {}
    return UserStore.getConsultations();
  },

  async getAIResponse(
    message,
    caseContext = null,
    language = 'auto',
    chatHistory = null
  ) {
    try {
      const url = this.getUrl('/api/ai/chat');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          role: 'user',
          caseContext: caseContext,
          language: language,
          chatHistory: chatHistory,
        }),
      });
      const data = await resp.json();
      if (data && data.ok && data.message) {
        const detectedCode =
          (data.detected_language &&
            (data.detected_language.detected_language_code ||
              data.detected_language.language_code)) ||
          language;
        return {
          message: data.message,
          detectedLang:
            detectedCode && detectedCode !== 'auto'
              ? detectedCode
              : language !== 'auto'
                ? language
                : 'hi',
        };
      }
      return {
        message:
          data.error ||
          'Unable to fetch legal precedent response. Please try again.',
        detectedLang: language !== 'auto' ? language : 'hi',
      };
    } catch (err) {
      console.warn(
        'Backend proxy unreachable, attempting direct AI service on port 5000:',
        err.message
      );
      try {
        const directResp = await fetch('http://127.0.0.1:5000/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            role: 'user',
            caseContext: caseContext,
            language: language,
            chatHistory: chatHistory,
          }),
        });
        const directData = await directResp.json();
        if (directData && directData.ok && directData.message) {
          const detectedCode =
            (directData.detected_language &&
              (directData.detected_language.detected_language_code ||
                directData.detected_language.language_code)) ||
            language;
          return {
            message: directData.message,
            detectedLang:
              detectedCode && detectedCode !== 'auto'
                ? detectedCode
                : language !== 'auto'
                  ? language
                  : 'hi',
          };
        }
      } catch (directErr) {
        console.error('Direct AI Service fetch failed:', directErr);
      }
      return {
        message:
          'Nyay Setu Supreme Court AI Service se connect karne mein samasya aa rahi hai. Kripya sunishchit karein ki backend (port 3000) ya AI service (port 5000) active hai.',
        detectedLang: language !== 'auto' ? language : 'hi',
      };
    }
  },

  async simulateCourtroom(summary, category = null, language = 'auto') {
    try {
      const url = this.getUrl('/api/ai/court');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summary,
          category: category,
          language: language,
        }),
      });
      const data = await resp.json();
      if (data && data.ok && data.simulation) {
        return data.simulation;
      }
      return data.error || 'Court simulation could not be generated.';
    } catch (err) {
      console.warn(
        'Backend proxy unreachable for simulation, attempting direct port 5000:',
        err.message
      );
      try {
        const directResp = await fetch('http://127.0.0.1:5000/api/ai/court', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: summary,
            category: category,
            language: language,
          }),
        });
        const directData = await directResp.json();
        if (directData && directData.ok && directData.simulation) {
          return directData.simulation;
        }
      } catch (directErr) {
        console.error('Direct Courtroom simulation failed:', directErr);
      }
      return 'Unable to connect to Courtroom Simulation Engine. Please ensure the AI service is running on port 5000.';
    }
  },
};
