const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function browserHarness({ sdkLoaded = true, configured = true } = {}) {
  let host;
  let configAvailable = configured;
  const initialized = [], rendered = [], credentials = [], events = new Map();
  let requests = 0;
  const sdk = {
    initialize: options => initialized.push(options),
    renderButton: (element, options) => rendered.push({ element, options }),
    prompt: () => { throw new Error('One Tap must not be required to sign in'); }
  };
  const script = {
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name)
  };
  const window = sdkLoaded ? { google: { accounts: { id: sdk } } } : {};
  const context = vm.createContext({
    window, AbortSignal, setTimeout, clearTimeout,
    document: { getElementById: () => host, querySelector: () => script },
    AuthManager: {
      getApiUrl: path => path,
      handleGoogleSignIn: (credential, role) => credentials.push({ credential, role })
    },
    fetch: async () => {
      requests++;
      return { ok: true, json: async () => ({ googleClientId: configAvailable ? 'synthetic-client' : '' }) };
    }
  });
  vm.runInContext(fs.readFileSync('frontend/user/js/auth_page.js', 'utf8') + '\nthis.page = UserAuthPage;', context);
  function newHost() {
    if (host) host.isConnected = false;
    host = { isConnected: true, innerHTML: '', replaceChildren() { this.innerHTML = ''; },
      getBoundingClientRect: () => ({ width: 350 }) };
    return host;
  }
  return {
    page: context.page, newHost, initialized, rendered, credentials,
    get requests() { return requests; },
    configure: () => { configAvailable = true; },
    loadSDK: () => { window.google = { accounts: { id: sdk } }; events.get('load')(); }
  };
}

test('login and registration mount a real Google button with one initialization and verified-server callback', async () => {
  const b = browserHarness();
  const login = b.newHost();
  await b.page.mountGoogleSignIn();
  const register = b.newHost();
  await b.page.mountGoogleSignIn();
  assert.equal(b.requests, 1);
  assert.equal(b.initialized.length, 1);
  assert.equal(b.initialized[0].ux_mode, 'popup');
  assert.equal(b.rendered.length, 2);
  assert.equal(b.rendered[0].element, login);
  assert.equal(b.rendered[1].element, register);
  assert.equal(b.rendered[1].options.width, '350');
  b.initialized[0].callback({ credential: 'synthetic-signed-credential' });
  assert.equal(b.credentials[0].role, 'user');
  assert.equal(b.credentials[0].credential.credential, 'synthetic-signed-credential');
});

test('a slow Google SDK renders on the current page after a login-to-register navigation', async () => {
  const b = browserHarness({ sdkLoaded: false });
  const oldHost = b.newHost();
  const first = b.page.mountGoogleSignIn();
  const newHost = b.newHost();
  const second = b.page.mountGoogleSignIn();
  assert.match(newHost.innerHTML, /Loading Google/);
  b.loadSDK();
  await Promise.all([first, second]);
  assert.equal(b.rendered.length, 1);
  assert.equal(b.rendered[0].element, newHost);
  assert.notEqual(b.rendered[0].element, oldHost);
});

test('unavailable configuration preserves email login and permits a successful retry', async () => {
  const b = browserHarness({ configured: false });
  const host = b.newHost();
  await b.page.mountGoogleSignIn();
  assert.match(host.innerHTML, /use email and password/);
  assert.match(host.innerHTML, /Retry Google sign-in/);
  assert.equal(b.initialized.length, 0);
  b.configure();
  await b.page.mountGoogleSignIn();
  assert.equal(b.rendered.length, 1);
  assert.equal(host.innerHTML, '');
});
