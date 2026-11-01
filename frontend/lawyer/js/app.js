/* ============================================================
   Nyay Setu — MAIN APPLICATION ENTRY POINT
   app.js — SPA route table, guards & boot sequence
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize state store (hydrates cache instantly, then server)
  await Store.init();

  // 2. Seed demo data for presentation (remove for production)
  if (typeof LawyerDemoData !== 'undefined') LawyerDemoData.seed();

  /* ---------------- Splash & Role selection ---------------- */
  Router.register('/splash', () => SplashPage.render(), {
    title: 'AI-Powered Legal Assistant',
    onEnter: () => SplashPage.onEnter()
  });

  Router.register('/role-select', () => AuthPage.renderRoleSelect(), {
    title: 'Select Your Role'
  });

  /* ---------------- Authentication flow ---------------- */
  Router.register('/login', () => AuthPage.renderLogin(), { title: 'Advocate Sign In', onEnter: () => AuthManager.enterLogin() });
  Router.register('/forgot-password', () => AuthPage.renderForgotPassword(), { title: 'Password Recovery' });
  Router.register('/reset-password', () => AuthPage.renderResetPassword(), { title: 'Set New Password' });
  Router.register('/otp', () => OTPPage.render(), {
    title: 'Email Verification',
    onEnter: () => OTPPage.onEnter(),
    onLeave: () => OTPPage.onLeave()
  });
  Router.register('/device-check', () => OTPPage.renderDeviceCheck(), { title: 'New Device Confirmation' });

  /* ---------------- Registration & verification ---------------- */
  Router.register('/register', () => RegisterPage.render(), {
    title: 'Advocate Registration',
    onEnter: () => RegisterPage.onEnter()
  });
  Router.register('/verification', () => VerificationPage.render(), {
    title: 'Credential Verification',
    requiresAuth: true,
    onEnter: () => VerificationPage.onEnter(),
    onLeave: () => VerificationPage.onLeave()
  });

  /* ---------------- Portal pages (auth-protected) ---------------- */
  Router.register('/dashboard', () => DashboardPage.render(), {
    title: 'Advocate Dashboard',
    requiresAuth: true,
    onEnter: () => DashboardPage.onEnter && DashboardPage.onEnter(),
    onLeave: () => DashboardPage.onLeave && DashboardPage.onLeave()
  });

  Router.register('/court', () => AdvocateCourtPage.renderPrep ? AdvocateCourtPage.renderPrep() : AdvocateCourtPage.render(), {
    title: 'Court Preparation',
    requiresAuth: true
  });

  Router.register('/hearing/prepare', () => AdvocateCourtPage.renderPrep ? AdvocateCourtPage.renderPrep() : AdvocateCourtPage.render(), {
    title: 'Hearing Prep Checklist',
    requiresAuth: true
  });

  Router.register('/court/simulate', () => AdvocateCourtPage.renderSimulator(), {
    title: 'Virtual Courtroom Simulator',
    requiresAuth: true
  });

  Router.register('/court/simulate/:msgId', (params) => {
    if (params && params.msgId) {
      AdvocateRehearsal.launch(params.msgId);
    }
    return AdvocateCourtPage.renderSimulator();
  }, {
    title: 'Virtual Courtroom Simulator',
    requiresAuth: true
  });

  Router.register('/hearing/today', () => AdvocateCourtPage.renderHearingDay ? AdvocateCourtPage.renderHearingDay() : AdvocateCourtPage.render(), {
    title: 'Hearing Day Hub',
    requiresAuth: true
  });

  Router.register('/hearing/after', () => AdvocateCourtPage.renderPostHearing ? AdvocateCourtPage.renderPostHearing() : AdvocateCourtPage.render(), {
    title: 'Post-Hearing Outcome',
    requiresAuth: true
  });

  Router.register('/ai-assistant', () => AdvocateChatBot.render(), {
    title: 'Ask Nyay Setu',
    requiresAuth: true,
    onEnter: () => AdvocateChatBot.onEnter && AdvocateChatBot.onEnter(),
    onLeave: () => AdvocateChatBot.onLeave && AdvocateChatBot.onLeave()
  });

  Router.register('/clients', (params) => ClientsPage.render(params), {
    title: 'Client Requests',
    requiresAuth: true
  });
  Router.register('/clients/id/:id', (params) => ClientsPage.render(params), {
    title: 'Case Evaluation',
    requiresAuth: true
  });

  Router.register('/consultation', () => ConsultationPage.render(), {
    title: 'Consultation Room',
    requiresAuth: true,
    onEnter: () => ConsultationPage.onEnter(),
    onLeave: () => ConsultationPage.onLeave()
  });

  Router.register('/chat', () => ChatPage.render(), {
    title: 'Secure Client Chat',
    requiresAuth: true,
    onEnter: () => ChatPage.onEnter()
  });
  Router.register('/chat/conv/:id', (params) => ChatPage.render(params), {
    title: 'Secure Client Chat',
    requiresAuth: true,
    onEnter: () => ChatPage.onEnter()
  });

  Router.register('/cases', (params) => CasesPage.render(params), {
    title: 'Case Management',
    requiresAuth: true
  });
  Router.register('/cases/id/:id', (params) => CasesPage.render(params), {
    title: 'Case File',
    requiresAuth: true
  });
  Router.register('/cases/new', () => CasesPage.renderCreateCaseModal ? CasesPage.renderCreateCaseModal() : '', {
    title: 'New Case File',
    requiresAuth: true
  });

  Router.register('/payments', () => PaymentsPage.render(), {
    title: 'Earnings & Payments',
    requiresAuth: true
  });

  Router.register('/reviews', () => ReviewsPage.render(), {
    title: 'Client Reviews',
    requiresAuth: true
  });

  const PROFILE_TABS = ['portfolio', 'experience', 'cases', 'certificates', 'pricing', 'availability'];
  Router.register('/profile', (params) => ProfilePage.render(params), {
    title: 'Portfolio & Profile',
    requiresAuth: true
  });
  PROFILE_TABS.forEach(tab => {
    Router.register(`/profile/tab/${tab}`, () => ProfilePage.render({ tab }), {
      title: 'Portfolio & Profile',
      requiresAuth: true
    });
  });

  const SETTINGS_TABS = ['account', 'professional', 'security', 'privacy', 'notifications', 'support', 'deactivate', 'verification-center'];
  Router.register('/settings', (params) => {
    const html = SettingsPage.render(params);
    if (!params || !params.tab || params.tab === 'security') setTimeout(() => SettingsPage.hydrateSecurityPane(), 60);
    return html;
  }, { title: 'Settings & Security', requiresAuth: true });
  SETTINGS_TABS.forEach(tab => {
    Router.register(`/settings/tab/${tab}`, () => {
      const html = SettingsPage.render({ tab });
      if (tab === 'security') setTimeout(() => SettingsPage.hydrateSecurityPane(), 60);
      return html;
    }, { title: 'Settings & Security', requiresAuth: true });
  });

  /* ---------------- Boot ---------------- */
  Router.init();

  // Start appointment reminder engine once signed in
  if (AuthManager.isLoggedIn()) {
    ApiClient.startReminderEngine();
  }
});
