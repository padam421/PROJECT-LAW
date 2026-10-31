const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(portal) {
  const local = new Map(), renders = [], calls = [];
  let configuration, host;
  const makeHost = () => ({ isConnected: true, replaceChildren() {}, getBoundingClientRect: () => ({ width: 360 }) });
  host = makeHost();
  const id = {
    initialize: value => { configuration = value; },
    renderButton: (element, options) => renders.push({ element, options }),
    prompt: () => { throw new Error('Explicit sign-in must not depend on optional One Tap'); }
  };
  const context = vm.createContext({ console, AbortController, AbortSignal, setTimeout, clearTimeout,
    window: { google: { accounts: { id } }, location: { pathname: '/frontend/' + portal + '/index.html' } },
    document: { getElementById: () => host },
    localStorage: { getItem: key => local.get(key), setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
    fetch: async () => ({ ok: true, json: async () => ({ googleClientId: 'synthetic-client' }) })
  });
  vm.runInContext(fs.readFileSync('frontend/shared/js/auth.js', 'utf8') + '\nthis.auth = AuthManager;', context);
  context.auth.handleGoogleSignIn = (...args) => calls.push(args);
  return { auth: context.auth, context, renders, calls, config: () => configuration, replaceHost: () => { host.isConnected = false; host = makeHost(); } };
}

test('both portals render the explicit Google chooser without auto-selecting an account or requiring One Tap', async () => {
  for (const portal of ['user', 'lawyer']) {
    const f = fixture(portal);
    await f.auth.mountGoogleSignIn();
    assert.equal(f.renders.length, 1);
    assert.equal(f.renders[0].options.text, 'continue_with');
    assert.equal(f.config().ux_mode, 'popup');
    assert.equal(f.config().auto_select, false);
    assert.equal(f.config().button_auto_select, false);
    const credential = { credential: 'synthetic-response-not-an-actual-token' };
    f.config().callback(credential);
    assert.equal(f.calls[0][0], credential);
    assert.equal(f.calls[0][1], portal);
    f.replaceHost();
    await f.auth.mountGoogleSignIn();
    assert.equal(f.renders.length, 2);
  }
});

test('an async Google configuration response cannot render into a departed page', async () => {
  const f = fixture('user');
  let resolve;
  f.context.fetch = () => new Promise(done => { resolve = done; });
  const pending = f.auth.mountGoogleSignIn();
  f.replaceHost();
  resolve({ ok: true, json: async () => ({ googleClientId: 'synthetic-client' }) });
  await pending;
  assert.equal(f.renders.length, 0);
});
