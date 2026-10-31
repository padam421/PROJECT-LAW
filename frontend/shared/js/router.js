/* ============================================================
   Nyay Setu — SPA ROUTER
   router.js — Hash routing with auth guards, dynamic ':param'
   segments, page transitions and lifecycle hooks
   ============================================================ */

const Router = {
  routes: {},
  currentRoute: null,
  previousRoute: null,
  _guards: [],
  _onNavigate: [],
  _navigationId: 0,

  /* --------------------------------------------------------
     REGISTRATION
     -------------------------------------------------------- */
  register(path, handler, options = {}) {
    this.routes[path] = {
      path,
      handler,
      requiresAuth: options.requiresAuth || false,
      title: options.title || 'Nyay Setu',
      onEnter: options.onEnter || null,
      onLeave: options.onLeave || null,
      pattern: this.compilePattern(path)
    };
  },

  compilePattern(path) {
    if (!path.includes(':')) return null;
    const regex = new RegExp('^' + path.replace(/:[^/]+/g, '([^/]+)') + '$');
    const names = (path.match(/:[^/]+/g) || []).map(n => n.slice(1));
    return { regex, names };
  },

  /** Finds route for a literal hash path, extracting dynamic params. */
  resolve(path) {
    // Exact match first
    if (this.routes[path]) return { route: this.routes[path], params: {} };
    // Dynamic segments
    for (const key of Object.keys(this.routes)) {
      const r = this.routes[key];
      if (!r.pattern) continue;
      const m = r.pattern.regex.exec(path);
      if (m) {
        const params = {};
        r.pattern.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
    }
    return null;
  },

  /* --------------------------------------------------------
     GUARDS
     -------------------------------------------------------- */
  addGuard(guardFn) { this._guards.push(guardFn); },
  onNavigate(callback) { this._onNavigate.push(callback); },

  /* --------------------------------------------------------
     NAVIGATION
     -------------------------------------------------------- */
  async navigate(rawPath, params = {}) {
    const navigationId = ++this._navigationId;
    let full = String(rawPath || '').replace(/^#/, '').trim();
    let query = '';
    let path = full;
    if (full.includes('?')) {
      const parts = full.split('?');
      path = parts[0];
      query = '?' + parts.slice(1).join('?');
    }
    if (!path.startsWith('/')) path = '/' + path;

    for (const guard of this._guards) {
      const result = guard(path, this.currentRoute);
      if (result === false) return;
      if (typeof result === 'string') { path = result; break; }
    }

    let resolved = this.resolve(path);
    if (!resolved) {
      console.warn(`[Router] Route not found: ${path}`);
      const defaultAuthRoute = this.routes['/home'] ? '/home' : '/dashboard';
      resolved = this.resolve(AuthManager.isLoggedIn() ? defaultAuthRoute : '/login');
      if (!resolved) return;
    }

    const target = resolved.route;
    const mergedParams = Object.keys(params || {}).length ? params : resolved.params;

    if (target.requiresAuth) {
      try {
        if (typeof AuthManager.refreshSession === 'function') await AuthManager.refreshSession();
      } catch (_) {
        if (navigationId !== this._navigationId) return;
        const app = document.getElementById('app');
        if (app) app.innerHTML = '<div class="fullscreen-page"><div class="fullscreen-card"><h2>Connection interrupted</h2>' +
          '<p>Could not confirm your account with the server. Your saved work is retained.</p>' +
          '<button type="button" class="btn btn-primary" onclick="window.location.reload()">Reload and retry</button></div></div>';
        return;
      }
      if (navigationId !== this._navigationId) return;
      if (!AuthManager.isLoggedIn()) return this.navigate('/login');
      const requiredRole = typeof AuthManager.portalRole === 'function' ? AuthManager.portalRole() : null;
      if (requiredRole && AuthManager.getSession()?.role !== requiredRole) {
        Utils.showToast(AuthManager.portalAccessMessage(), 'warning');
        return this.navigate('/login');
      }
    }

    // Leave hook of current page
    if (this.currentRoute) {
      const current = this.resolve(this.currentRoute);
      if (current && current.route.onLeave) await current.route.onLeave();
    }

    this.previousRoute = this.currentRoute;
    this.currentRoute = target.path;

    const cleanHash = '#' + path + query;
    if (window.location.hash !== cleanHash) {
      window.location.hash = cleanHash;
    }

    document.title = `${target.title} — Nyay Setu`;

    await this.transitionPage(path, mergedParams);

    this._onNavigate.forEach(cb => cb(path, mergedParams));
    Utils.scrollToTop(false);
  },

  /* --------------------------------------------------------
     PAGE TRANSITIONS
     -------------------------------------------------------- */
  async transitionPage(_path, params) {
    const app = document.getElementById('app');
    if (!app) return;

    const resolved = this.resolve(this.currentRoute || _path);
    if (!resolved) return;
    const route = resolved.route;
    const renderParams = (params && Object.keys(params).length) ? params : resolved.params;

    app.style.opacity = '0';
    app.style.transform = 'translateY(8px)';
    await new Promise(resolve => setTimeout(resolve, 120));

    try {
      const content = await route.handler(renderParams);
      if (typeof content === 'string') app.innerHTML = content;
    } catch (err) {
      console.error(`[Router] Error rendering ${this.currentRoute}:`, err);
      app.innerHTML = `
        <div class="empty-state min-h-screen">
          <div class="empty-state-icon"><span class="material-symbols-rounded icon-xl">error</span></div>
          <h3 class="empty-state-title">Something went wrong</h3>
          <p class="empty-state-text">${Utils.escapeHtml(err.message)}</p>
          <button class="btn btn-primary" onclick="Router.navigate('/dashboard')">Go to Dashboard</button>
        </div>`;
    }

    requestAnimationFrame(() => {
      app.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
    });

    if (route.onEnter) setTimeout(() => route.onEnter(renderParams), 50);
  },

  /* --------------------------------------------------------
     INIT
     -------------------------------------------------------- */
  init() {
    window.addEventListener('hashchange', () => {
      const full = window.location.hash.replace(/^#/, '').trim();
      const path = this.getPathFromHash();
      if (path !== this.currentRoute) this.navigate(full);
    });

    const initial = window.location.hash.replace(/^#/, '').trim();
    this.navigate(initial || '/splash');
  },

  getPathFromHash() {
    let raw = window.location.hash.replace(/^#/, '').trim();
    if (raw.includes('?')) raw = raw.split('?')[0];
    if (!raw) return '/splash';
    if (!raw.startsWith('/')) raw = '/' + raw;
    return raw;
  },

  back() {
    if (this.previousRoute) this.navigate(this.previousRoute);
    else window.history.back();
  },

  getCurrentRoute() { return this.currentRoute; },
  isActive(path) { return this.currentRoute === path; }
};
