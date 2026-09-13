/* ============================================================
   Nyay Setu USER — SPA APPLICATION BOOTSTRAP
   app.js — Central Router configuration, route definitions,
   authentication guards, lifecycle hooks & startup logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize user store
  UserStore.init();

  // 2. Seed demo data for presentation (remove for production)
  if (typeof UserDemoData !== 'undefined') UserDemoData.seed();

  // 3. Register All SPA Routes with Router
  /* ---------------- Splash & Onboarding ---------------- */
  Router.register('/splash', () => UserSplashPage.render(), {
    title: 'Welcome',
    onEnter: () => UserSplashPage.onEnter()
  });

  Router.register('/language', () => UserAuthPage.renderLanguage(), {
    title: 'Choose Language'
  });

  Router.register('/welcome', () => UserAuthPage.renderWelcome(), {
    title: 'Welcome to Nyay Setu'
  });

  /* ---------------- Authentication Flow ---------------- */
  Router.register('/login', () => UserAuthPage.renderLogin(), {
    title: 'Sign In'
  });

  Router.register('/register', () => UserAuthPage.renderRegister(), {
    title: 'Create Account'
  });

  Router.register('/otp', () => UserAuthPage.renderOTP(), {
    title: 'Verify Account',
    onEnter: () => UserAuthPage.onOTPEnter()
  });

  Router.register('/security-setup', () => UserAuthPage.renderSecuritySetup(), {
    title: 'Secure Your Account'
  });

  Router.register('/privacy', () => UserAuthPage.renderPrivacy(), {
    title: 'Privacy & Data Consent'
  });

  Router.register('/forgot-password', () => UserAuthPage.renderForgotPassword(), {
    title: 'Forgot Password'
  });

  /* ---------------- Core Dashboard & Home ---------------- */
  Router.register('/home', () => UserHomePage.render(), {
    title: 'Home Dashboard',
    requiresAuth: true
  });

  /* ---------------- Case Management Journey ---------------- */
  Router.register('/tell-us', () => UserCasePage.renderTellUs(), {
    title: 'Tell Us What Happened',
    requiresAuth: true
  });

  Router.register('/case/new', () => UserCasePage.renderNewCase(), {
    title: 'AI Case Analysis',
    requiresAuth: true
  });

  Router.register('/case', () => UserCasePage.renderCaseList(), {
    title: 'My Cases',
    requiresAuth: true
  });

  Router.register('/case/:id', (params) => UserCasePage.renderCase(params.id), {
    title: 'Case Overview',
    requiresAuth: true
  });

  Router.register('/case/:id/documents', (params) => {
    const html = UserCasePage.renderCase(params.id);
    setTimeout(() => UserCasePage.switchTab('documents'), 50);
    return html;
  }, {
    title: 'Case Documents',
    requiresAuth: true
  });

  Router.register('/case/:id/vault', (params) => {
    const html = UserCasePage.renderCase(params.id);
    setTimeout(() => UserCasePage.switchTab('vault'), 50);
    return html;
  }, {
    title: 'Case Vault',
    requiresAuth: true
  });

  Router.register('/case/:id/share', (params) => {
    const html = UserCasePage.renderCase(params.id);
    setTimeout(() => UserCasePage.switchTab('sharing'), 50);
    return html;
  }, {
    title: 'Sharing Controls',
    requiresAuth: true
  });

  /* ---------------- Ask Nyay Setu AI ---------------- */
  Router.register('/chat', () => UserChatBot.render(), {
    title: 'Ask Nyay Setu',
    requiresAuth: true,
    onEnter: () => UserChatBot.onEnter()
  });

  /* ---------------- Lawyer Discovery & Consultation ---------------- */
  Router.register('/lawyers', () => UserLawyerPage.renderLawyers(), {
    title: 'Find Verified Lawyers',
    requiresAuth: true
  });

  Router.register('/lawyers/recommended', () => UserLawyerPage.renderRecommended(), {
    title: 'AI Recommended Lawyers',
    requiresAuth: true
  });

  Router.register('/lawyers/compare', () => UserLawyerPage.renderCompare(), {
    title: 'Compare Lawyers',
    requiresAuth: true
  });

  Router.register('/lawyer/:id', (params) => UserLawyerPage.renderLawyerProfile(params.id), {
    title: 'Advocate Profile',
    requiresAuth: true
  });

  Router.register('/consultation/book', () => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    return UserLawyerPage.renderBooking(urlParams.get('lawyerId'));
  }, {
    title: 'Book Consultation',
    requiresAuth: true
  });

  Router.register('/payment', () => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const amount = parseInt(urlParams.get('amount') || '550', 10);
    return UserLawyerPage.renderPayment(urlParams.get('lawyerId'), amount);
  }, {
    title: 'Secure Payment',
    requiresAuth: true
  });

  Router.register('/consultation/prep', () => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    return UserLawyerPage.renderPreConsultationPrep(urlParams.get('consultId'));
  }, {
    title: 'Consultation Questions',
    requiresAuth: true
  });

  Router.register('/consultation/:id', (params) => UserLawyerPage.renderConsultationRoom(params.id), {
    title: 'Consultation Room',
    requiresAuth: true
  });

  Router.register('/consultation/:id/summary', (params) => UserLawyerPage.renderConsultationSummary(params.id), {
    title: 'Consultation Summary',
    requiresAuth: true
  });

  Router.register('/my-lawyer', () => UserLawyerPage.renderMyLawyer(), {
    title: 'My Lawyer',
    requiresAuth: true
  });

  /* ---------------- Court Preparation & Virtual Simulator ---------------- */
  Router.register('/court', () => UserCourtPage.renderPrep(), {
    title: 'Court Preparation',
    requiresAuth: true
  });

  Router.register('/hearing/prepare', () => UserCourtPage.renderPrep(), {
    title: 'Hearing Prep Checklist',
    requiresAuth: true
  });

  Router.register('/court/simulate', () => UserCourtPage.renderSimulator(), {
    title: 'Virtual Courtroom Simulator',
    requiresAuth: true
  });

  Router.register('/hearing/today', () => UserCourtPage.renderHearingDay(), {
    title: 'Hearing Day Hub',
    requiresAuth: true
  });

  Router.register('/hearing/after', () => UserCourtPage.renderPostHearing(), {
    title: 'Post-Hearing Outcome',
    requiresAuth: true
  });

  /* ---------------- Profile, Settings, Security & Notifications ---------------- */
  Router.register('/profile', () => UserProfilePage.renderProfile(), {
    title: 'My Profile',
    requiresAuth: true
  });

  Router.register('/settings', () => UserProfilePage.renderSettings(), {
    title: 'Settings & Preferences',
    requiresAuth: true
  });

  Router.register('/notifications', () => UserProfilePage.renderNotifications(), {
    title: 'Notifications',
    requiresAuth: true
  });

  Router.register('/security', () => UserProfilePage.renderSecurity(), {
    title: 'Security & Access',
    requiresAuth: true
  });

  Router.register('/support', () => UserProfilePage.renderSupport(), {
    title: 'Help & Support',
    requiresAuth: true
  });

  // 4. Initialize Router
  Router.init();
});
