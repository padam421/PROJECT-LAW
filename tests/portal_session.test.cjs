const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(path = '/frontend/lawyer/index.html') {
  const values = new Map(), feedback = [], rendered = [], requests = [];
  let reply = { status: 200, user: { id: 'lawyer', role: 'lawyer' }, sessionId: 'lawyer-session' };
  const location = { pathname: path, protocol: 'https:', hostname: 'nyay-setu-4aik.onrender.com', hash: '' };
  const app = { innerHTML: '' };
  const context = vm.createContext({ console, AbortController, AbortSignal, setTimeout, clearTimeout,
    window: { location }, localStorage: { getItem: k => values.get(k) || null,
      setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    document: { getElementById: () => app },
    Utils: { generateId: () => 'synthetic-id', showToast: (...args) => feedback.push(args), scrollToTop() {} },
    fetch: async (url, options) => { requests.push({ url, options }); return {
      status: reply.status, ok: reply.status === 200, json: async () => reply
    }; }
  });
  for (const file of ['auth', 'router']) vm.runInContext(fs.readFileSync('frontend/shared/js/' + file + '.js', 'utf8') +
    '\nthis.' + file + ' = ' + (file === 'auth' ? 'AuthManager' : 'Router') + ';', context);
  context.router.register('/dashboard', () => '', { requiresAuth: true });
  context.router.register('/login', () => '');
  context.router.transitionPage = async path => rendered.push(path);
  return { context, auth: context.auth, router: context.router, feedback, rendered, requests, app,
    reply: data => { reply = data; } };
}

test('the lawyer portal checks the cookie account instead of a stale locally cached lawyer role', async () => {
  const f = fixture();
  f.auth.setSession({ id: 'cached', role: 'lawyer' }, 'cached-session');
  f.reply({ status: 200, user: { id: 'actual-client', role: 'user' }, sessionId: 'client-session' });
  await f.router.navigate('/dashboard');
  assert.equal(f.auth.getSession().role, 'user');
  assert.deepEqual(f.rendered, ['/dashboard']);
  assert.equal(f.feedback.length, 0);
  assert.equal(f.requests[0].options.credentials, 'include');
  assert.equal(f.requests[0].url, '/api/auth/session');
});

test('a real lawyer cookie restores a missing browser snapshot and opens the dashboard', async () => {
  const f = fixture();
  await f.router.navigate('/dashboard');
  assert.equal(f.auth.getSession().id, 'lawyer');
  assert.deepEqual(f.rendered, ['/dashboard']);
});

test('an old browser snapshot does not end a valid persistent cookie session', async () => {
  const f = fixture();
  f.auth.setSession({ id: 'lawyer', role: 'lawyer', loginTime: 1 }, 'lawyer-session');
  const cached = f.auth.getSession();
  cached.loginTime = Date.now() - 10 * 86400000;
  f.context.localStorage.setItem(f.auth.SESSION_KEY, JSON.stringify(cached));
  assert.equal(f.auth.isLoggedIn(), true);
  await f.router.navigate('/dashboard');
  assert.deepEqual(f.rendered, ['/dashboard']);
});

test('Google/password session hydration restores each user cache before updating the current name', async () => {
  const f = fixture('/frontend/user/index.html');
  vm.runInContext(fs.readFileSync('frontend/user/js/api_client.js', 'utf8') + '\nthis.userStore = UserStore;', f.context);
  const original = { id: 'owner', email: 'owner@example.invalid', role: 'user', fullName: 'Verification Desk' };
  f.auth.setSession(original, 'old-session');
  f.context.userStore.init();
  f.context.userStore.set('cases', [{ id: 'saved-user-case' }]);
  f.context.userStore.set('conversations', [{ id: 'saved-user-chat' }]);
  assert.equal(await f.auth.logout(), true);
  assert.equal(f.auth.getSession(), null);
  assert.equal(f.context.userStore.getUser().id, undefined);
  const current = { ...original, googleName: 'Synthetic Owner', fullName: 'Synthetic Owner' };
  await f.auth.acceptSession(current, 'new-session');
  assert.equal(f.context.userStore.getCases()[0].id, 'saved-user-case');
  assert.equal(f.context.userStore.get('conversations')[0].id, 'saved-user-chat');
  assert.equal(f.auth.displayName(f.context.userStore.getUser()), 'Synthetic Owner');
  await f.auth.acceptSession({ id: 'other-owner', email: 'other@example.invalid', role: 'user' }, 'other-session');
  assert.equal(f.context.userStore.getCases().length, 0);
  await f.auth.acceptSession(current, 'returning-session');
  assert.equal(f.context.userStore.getCases()[0].id, 'saved-user-case');
});

test('an expired cookie goes to sign-in and a network failure retains cached work', async () => {
  const f = fixture();
  f.auth.setSession({ id: 'lawyer', role: 'lawyer' }, 'old');
  f.reply({ status: 401, error: 'Expired' });
  await f.router.navigate('/dashboard');
  assert.equal(f.auth.getSession(), null);
  assert.deepEqual(f.rendered, ['/login']);
  f.auth.setSession({ id: 'lawyer', role: 'lawyer' }, 'restored');
  f.context.fetch = async () => { throw new TypeError('Synthetic offline'); };
  await f.router.navigate('/dashboard');
  assert.equal(f.auth.getSession().sessionId, 'restored');
  assert.match(f.app.innerHTML, /saved work is retained/);
});

test('a late session check cannot replace a newly signed-in account or reopen an old route', async () => {
  const f = fixture();
  f.auth.setSession({ id: 'old', role: 'lawyer' }, 'old-session');
  let release;
  f.context.fetch = () => new Promise(resolve => { release = resolve; });
  const oldRoute = f.router.navigate('/dashboard');
  await f.router.navigate('/login');
  f.auth.setSession({ id: 'new', role: 'user' }, 'new-session');
  release({ status: 200, ok: true, json: async () => ({ user: { id: 'old', role: 'lawyer' }, sessionId: 'old-session' }) });
  await oldRoute;
  assert.equal(f.auth.getSession().id, 'new');
  assert.deepEqual(f.rendered, ['/login']);
});

test('both portals send the selected account role during password login', async () => {
  for (const [portal, role] of [['lawyer', 'lawyer'], ['user', 'user']]) {
    const f = fixture('/frontend/' + portal + '/index.html');
    f.reply({ status: 403, error: 'Wrong portal', reason: 'wrong_portal' });
    const result = await f.auth.login('synthetic@example.invalid', 'Synthetic123');
    assert.equal(result.reason, 'wrong_portal');
    assert.equal(JSON.parse(f.requests[0].options.body).role, role);
  }
});

test('an outdated local backend is diagnosed before another password or OTP request', async () => {
  const f = fixture();
  Object.assign(f.context.window.location, { hostname: '127.0.0.1', protocol: 'http:', port: '5501' });
  f.reply({ status: 404 });
  const result = await f.auth.login('synthetic@example.invalid', 'Synthetic123');
  assert.equal(result.reason, 'local_server_update_required');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, 'http://127.0.0.1:3000/api/public-config');
  assert.notEqual(f.requests[0].options.method, 'POST');
});

test('obsolete public-portal login OTP drafts are cleared while signup verification remains available', () => {
  for (const portal of ['user', 'lawyer']) {
    const f = fixture('/frontend/' + portal + '/index.html');
    const draft = new Map();
    f.context.sessionStorage = { getItem: key => draft.get(key), setItem: (key, value) => draft.set(key, value), removeItem: key => draft.delete(key) };
    draft.set(f.auth.PENDING_OTP_KEY, JSON.stringify({ id: 'obsolete-login', purpose: 'login' }));
    f.auth.restorePendingOTP();
    assert.equal(f.auth._pendingOTPChallenge, null);
    draft.set(f.auth.PENDING_OTP_KEY, JSON.stringify({ id: 'signup-verification', purpose: 'registration' }));
    f.auth.restorePendingOTP();
    assert.equal(f.auth._pendingOTPChallenge.id, 'signup-verification');
  }
});

test('an existing client account can enter lawyer tools without registering another email', () => {
  const f = fixture();
  f.auth.setSession({ id: 'client', role: 'user', registrationStage: 'complete' }, 'client-session');
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/register_page.js', 'utf8') + '\nthis.registration = RegisterPage;', f.context);
  assert.equal(f.context.registration.currentPhase(), 'done');
});

test('one account can open either workspace while the admin portal stays role-restricted', async () => {
  for (const portal of ['user', 'lawyer']) for (const role of ['user', 'lawyer', 'admin']) {
    const f = fixture('/frontend/' + portal + '/index.html');
    f.reply({ status: 200, user: { id: 'same-account', role }, sessionId: 'same-session' });
    await f.router.navigate('/dashboard');
    assert.deepEqual(f.rendered, ['/dashboard']);
    assert.equal(f.auth.getSession().role, role);
  }
  const f = fixture('/frontend/admin/index.html');
  f.reply({ status: 200, user: { id: 'client', role: 'user' }, sessionId: 'client-session' });
  await f.router.navigate('/dashboard');
  assert.deepEqual(f.rendered, ['/login']);
});

test('verified new accounts reach lawyer tools without a mandatory professional-profile redirect', async () => {
  const f = fixture();
  f.auth.setSession({ id: 'lawyer', role: 'lawyer', registrationStage: 'awaiting_profile' }, 'lawyer-session');
  f.auth.verifyOTP = async () => ({ success: true, needsProfileCompletion: true });
  f.context.ApiClient = { startReminderEngine() {} };
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/otp_page.js', 'utf8') + '\nthis.otp = OTPPage;', f.context);
  Object.assign(f.context.otp, { _submitting: false, _locked: false, _deadline: Date.now() + 60000,
    readCode: () => '123456', setBusy() {}, onLeave() {} });
  const navigate = f.router.navigate.bind(f.router);
  let navigation;
  f.router.navigate = (...args) => (navigation = navigate(...args));
  await f.context.otp.handleVerify();
  await navigation;
  assert.deepEqual(f.rendered, ['/dashboard']);
});
