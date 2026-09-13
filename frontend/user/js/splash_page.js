/* ============================================================
   Nyay Setu USER — SPLASH SCREEN
   splash_page.js — Cinematic intro + session routing
   ============================================================ */

const UserSplashPage = {
  render() {
    return `
      <div class="u-splash">
        <div class="u-splash-particles">
          ${Array.from({length: 10}, () => '<div class="u-splash-particle"></div>').join('')}
        </div>
        <div class="u-splash-lines">
          <div class="u-splash-line"></div>
          <div class="u-splash-line"></div>
          <div class="u-splash-line"></div>
        </div>
        <div class="u-splash-content">
          <div class="u-splash-logo">
            <span class="material-symbols-rounded">balance</span>
          </div>
          <h1 class="u-splash-title">Legal<span>Connect</span></h1>
          <p class="u-splash-subtitle">AI-Powered Legal Assistant & Virtual Court Simulator</p>
          <p class="u-splash-tagline">"Understand Your Case. Prepare With Confidence."</p>
          <div class="u-splash-progress">
            <div class="u-splash-progress-bar" id="u-splash-bar"></div>
          </div>
        </div>
      </div>
    `;
  },

  onEnter() {
    const bar = document.getElementById('u-splash-bar');
    if (bar) setTimeout(() => bar.classList.add('loading'), 150);

    setTimeout(() => {
      if (AuthManager.isLoggedIn()) {
        Router.navigate('/home');
      } else if (UserStore.getLanguage() && UserStore.getLanguage() !== 'en') {
        Router.navigate('/login');
      } else {
        Router.navigate('/language');
      }
    }, 2800);
  }
};
