/* ============================================================
   Nyay Setu — CENTRAL STATE STORE
   store.js — Server-hydrated state, optimistic local writes,
   debounced persistence, computed selectors
   ------------------------------------------------------------
   Data lives on the Nyay Setu API (per-lawyer workspace).
   This store keeps an in-memory mirror for instant rendering,
   persists a cache to localStorage for fast boot, and syncs
   every mutation back to the server automatically.
   ============================================================ */

const Store = {
  _state: {},
  _listeners: {},
  STORAGE_KEY: 'lc_store_cache',
  _pendingSync: {},       // collection -> timer
  _syncing: {},
  _online: false,
  _owner: null,

  storageKey() {
    const owner = typeof AuthManager !== 'undefined' ? AuthManager.getSession()?.id : null;
    return this.STORAGE_KEY + '_' + encodeURIComponent(owner || 'signed-out');
  },

  /* --------------------------------------------------------
     STATE MANAGEMENT
     -------------------------------------------------------- */
  getState(key) {
    if (key) return this._state[key];
    return { ...this._state };
  },

  /**
   * Write a collection locally (instant UI) then debounce-sync to server.
   * Internal keys (not synced): lawyerProfile, registeredLawyers.
   */
  setState(key, value) {
    this._state[key] = value;
    this.persistCache();
    this.notify(key);
    this.queueServerSync(key);
  },

  updateState(key, updater) {
    const current = this._state[key];
    const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    this.setState(key, next);
  },

  /* --------------------------------------------------------
     EVENT SYSTEM
     -------------------------------------------------------- */
  subscribe(key, callback) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(callback);
    return () => {
      this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
    };
  },

  notify(key) {
    if (this._listeners[key]) {
      this._listeners[key].forEach(cb => cb(this._state[key]));
    }
    if (this._listeners['*']) {
      this._listeners['*'].forEach(cb => cb(key, this._state[key]));
    }
  },

  /* --------------------------------------------------------
     SERVER SYNC
     -------------------------------------------------------- */
  SYNCED_COLLECTIONS: [
    'clients', 'cases', 'appointments', 'transactions', 'reviews',
    'notifications', 'conversations', 'experience', 'caseExperience',
    'certificates', 'pricing', 'availability', 'settings'
  ],

  queueServerSync(collection) {
    if (!this.SYNCED_COLLECTIONS.includes(collection)) return;
    if (typeof AuthManager === 'undefined' || !AuthManager.isLoggedIn()) return;
    this._state.__pendingSync = [...new Set([...(this._state.__pendingSync || []), collection])];
    this.persistCache();
    clearTimeout(this._pendingSync[collection]);
    this._pendingSync[collection] = setTimeout(() => this.syncCollection(collection), 600);
  },

  async syncCollection(collection) {
    const owner = this._owner;
    if (!owner || AuthManager.getSession()?.id !== owner) return false;
    if (this._syncing[collection]) await this._syncing[collection];
    if (AuthManager.getSession()?.id !== owner || this._owner !== owner) return false;
    const value = JSON.stringify(this._state[collection]);
    const pending = (async () => {
      try {
        const url = AuthManager.getApiUrl(`/api/state/${collection}`);
        const res = await fetch(url, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{"value":' + value + '}'
        });
        if (AuthManager.getSession()?.id !== owner || this._owner !== owner) return false;
        if (res.status === 401) AuthManager.clearSession();
        this._online = res.ok;
        if (res.ok && JSON.stringify(this._state[collection]) === value) {
          this._state.__pendingSync = (this._state.__pendingSync || []).filter(key => key !== collection);
          this.persistCache();
        }
        return res.ok;
      } catch (_e) {
        this._online = false; // offline — will retry on next mutation
        return false;
      }
    })();
    this._syncing[collection] = pending;
    try { return await pending; }
    finally { if (this._syncing[collection] === pending) delete this._syncing[collection]; }
  },

  async flushPendingSync() {
    Object.values(this._pendingSync).forEach(clearTimeout);
    this._pendingSync = {};
    await Promise.all(Object.values(this._syncing));
    await Promise.all((this._state.__pendingSync || []).filter(key => this.SYNCED_COLLECTIONS.includes(key))
      .map(key => this.syncCollection(key)));
    this.persistCache();
  },

  /** Boot-time hydration: cached paint first, then authoritative server fetch. */
  async init() {
    // 1. Instant paint from cache
    try {
      const cached = localStorage.getItem(this.storageKey());
      this._state = cached ? JSON.parse(cached) : {};
      this._owner = typeof AuthManager !== 'undefined' ? AuthManager.getSession()?.id : null;
    } catch (_e) { this._state = {}; }

    // 2. Authoritative refresh from API
    if (typeof AuthManager !== 'undefined' && AuthManager.isLoggedIn()) {
      await this.refreshFromServer().catch(() => {});
    }

    // 3. Guarantee collections exist (first-run / brand-new accounts)
    const defaults = {
      clients: [], cases: [], appointments: [], transactions: [], reviews: [],
      notifications: [], conversations: [], experience: [], caseExperience: [],
      certificates: [],
      pricing: [
        { id: 'price_1', service: 'Initial Consultation', fee: 500, duration: '30 min', type: 'fixed' },
        { id: 'price_2', service: 'Detailed Consultation', fee: 1000, duration: '60 min', type: 'fixed' },
        { id: 'price_3', service: 'Document Review', fee: 750, duration: 'Per Document', type: 'fixed' },
        { id: 'price_4', service: 'Case Representation', fee: 5000, duration: 'Per Case', type: 'starting' }
      ],
      availability: {
        monday: [{ start: '10:00', end: '13:00' }], tuesday: [{ start: '10:00', end: '13:00' }],
        wednesday: [], thursday: [{ start: '10:00', end: '13:00' }], friday: [{ start: '10:00', end: '13:00' }],
        saturday: [], sunday: []
      },
      settings: {
        notifications: { clientRequests: true, payments: true, appointments: true, securityAlerts: true, caseUpdates: true, marketing: false },
        privacy: { profileVisibility: 'public', showEmail: false, showPhone: false, allowReviews: true, shareDocuments: 'with_permission' },
        security: { twoFactorEnabled: true, loginAlerts: true, sessionTimeout: 24 }
      }
    };
    let changed = false;
    for (const [key, val] of Object.entries(defaults)) {
      if (this._state[key] === undefined) { this._state[key] = val; changed = true; }
    }
    if (changed) this.persistCache();
  },

  /** Pull the authoritative workspace after sign-in or major actions. */
  async refreshFromServer() {
    const owner = typeof AuthManager !== 'undefined' ? AuthManager.getSession()?.id : null;
    if (!owner) throw new Error('Sign in to load your workspace.');
    const url = AuthManager.getApiUrl('/api/state');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let data;
    try {
      const res = await fetch(url, { credentials: 'include', signal: controller.signal });
      if (!res.ok) throw new Error(`State fetch failed (${res.status})`);
      data = await res.json();
    } finally { clearTimeout(timeout); }
    if (AuthManager.getSession()?.id !== owner) return false;
    if (data.lawyer?.id !== owner) throw new Error('Workspace account did not match the signed-in account.');
    if (this._owner !== owner) {
      this._state = Object.fromEntries(this.SYNCED_COLLECTIONS.map(key => [key, ['availability','settings'].includes(key) ? {} : []]));
      this._owner = owner;
    }
    this._online = true;

    this._state.lawyerProfile = data.lawyer;
    for (const [key, val] of Object.entries(data.workspace || {})) {
      if (!(this._state.__pendingSync || []).includes(key)) this._state[key] = val;
    }
    // Merge seeded demo workspace ONLY for the demo advocate (server already provides it)
    this.persistCache();
    for (const key of this._state.__pendingSync || []) this.queueServerSync(key);
    this.notify('*');
    return true;
  },

  isOnline() { return this._online; },

  persistCache() {
    if (this._owner && AuthManager.getSession()?.id !== this._owner) return;
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this._state));
    } catch (e) {
      console.warn('[Store] Cache persist failed:', e);
    }
  },

  /** Sign-out hygiene: drop cached workspace so the next account starts clean. */
  resetLocal() {
    const owner = this._owner || (typeof AuthManager !== 'undefined' ? AuthManager.getSession()?.id : null);
    localStorage.removeItem(this.STORAGE_KEY + '_' + encodeURIComponent(owner || 'signed-out'));
    this.detach();
  },

  /** Leave private saved work under its account key; clear only the current view. */
  detach() {
    Object.values(this._pendingSync).forEach(clearTimeout);
    this._pendingSync = {};
    this._syncing = {};
    this._state = {};
    this._owner = null;
    this._online = false;
  },

  /* --------------------------------------------------------
     COMPUTED SELECTORS
     -------------------------------------------------------- */
  getPendingRequests() {
    return (this._state.clients || []).filter(c => c.status === 'pending');
  },

  getActiveClients() {
    return (this._state.clients || []).filter(c => c.status === 'accepted');
  },

  getTodayAppointments() {
    const today = new Date().toDateString();
    return (this._state.appointments || []).filter(a =>
      a.date && new Date(a.date).toDateString() === today &&
      ['upcoming', 'confirmed'].includes(a.status)
    );
  },

  getUpcomingAppointments() {
    const now = Date.now();
    return (this._state.appointments || [])
      .filter(a => a.date && new Date(a.date).getTime() >= now && ['upcoming', 'confirmed'].includes(a.status))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  getUnreadNotifications() {
    return (this._state.notifications || []).filter(n => !n.read);
  },

  getMonthlyEarnings() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return (this._state.transactions || [])
      .filter(t => new Date(t.date) >= startOfMonth && t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.netEarnings, 0);
  },

  getTotalEarnings() {
    return (this._state.transactions || [])
      .filter(t => t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.netEarnings, 0);
  },

  getAverageRating() {
    const reviews = this._state.reviews || [];
    if (reviews.length === 0) return null;
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  },

  getWeeklyEarnings() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return (this._state.transactions || [])
      .filter(t => new Date(t.date) >= startOfWeek && t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.netEarnings, 0);
  },

  getTodayEarnings() {
    const today = new Date().toDateString();
    return (this._state.transactions || [])
      .filter(t => new Date(t.date).toDateString() === today && t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.netEarnings, 0);
  }
};
