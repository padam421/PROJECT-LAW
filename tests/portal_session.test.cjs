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
  assert.deepEqual(f.rendered, ['/login']);
  assert.match(f.feedback[0][0], /User \/ Client.*Lawyer \/ Advocate/);
  assert.equal(f.requests[0].options.credentials, 'include');
  assert.equal(f.requests[0].url, '/api/auth/session');
});

test('a real lawyer cookie restores a missing browser snapshot and opens the dashboard', async () => {
  const f = fixture();
  await f.router.navigate('/dashboard');
  assert.equal(f.auth.getSession().id, 'lawyer');
  assert.deepEqual(f.rendered, ['/dashboard']);
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

test('a client account does not make advocate registration appear already completed', () => {
  const f = fixture();
  f.auth.setSession({ id: 'client', role: 'user', registrationStage: 'complete' }, 'client-session');
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/register_page.js', 'utf8') + '\nthis.registration = RegisterPage;', f.context);
  assert.equal(f.context.registration.currentPhase(), 'credentials');
});
