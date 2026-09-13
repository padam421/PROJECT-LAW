/* ============================================================
   Nyay Setu — SPLASH SCREEN LOGIC
   splash.js — Splash animation and session routing
   ============================================================ */

const SplashPage = {
  _timer: null,

  render() {
    return `
      <div class="splash-screen" onclick="SplashPage.skip()" style="cursor:pointer">
        <div class="splash-particles">
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
          <div class="splash-particle"></div>
        </div>

        <div class="splash-content">
          <div class="splash-logo">
            <span class="material-symbols-rounded">balance</span>
          </div>
          <h1 class="splash-title">Legal<span>Connect</span></h1>
          <p class="splash-subtitle">AI-Powered Legal Assistant & Virtual Court Simulator</p>
          <p class="splash-tagline">“Empowering Justice with AI & Trust”</p>

          <div class="splash-loader">
            <div class="splash-loader-bar" id="splash-progress"></div>
          </div>
          <div style="margin-top:16px;font-size:12px;color:rgba(255,255,255,0.4)">Click anywhere to continue</div>
        </div>
      </div>
    `;
  },

  skip() {
    if (this._timer) clearTimeout(this._timer);
    if (AuthManager.isLoggedIn()) {
      Router.navigate('/dashboard');
    } else {
      Router.navigate('/role-select');
    }
  },

  onEnter() {
    const bar = document.getElementById('splash-progress');
    if (bar) {
      setTimeout(() => bar.classList.add('loading'), 50);
    }

    // Auto-advance after 1.8 seconds
    this._timer = setTimeout(() => {
      this.skip();
    }, 1800);
  }
};
