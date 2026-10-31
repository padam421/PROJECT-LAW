const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.NODE_ENV = 'development';
process.env.DB_DISABLED = 'true';
process.env.DATA_DIR = path.resolve('.tmp-test', 'owner-samples-' + process.pid);
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
const db = require('../backend/src/config/dbConfig');
const { ensureOwnerSampleWorkspace, buildSampleWorkspace } = require('../backend/src/data/ownerSampleWorkspace');

test('sample rows are coherent fictional records with pending requests, conversations, live cases and payment states', () => {
  const sample = buildSampleWorkspace(new Date('2026-10-31T12:00:00Z'));
  assert.equal(sample.clients.length, 20);
  assert.equal(sample.clients.filter(c => c.status === 'pending').length, 8);
  assert.equal(sample.cases.length, 12);
  assert.equal(sample.conversations.length, 14);
  assert.ok(sample.conversations.every(c => c.messages.length === 12));
  assert.equal(sample.transactions.length, 36);
  assert.equal(sample.reviews.length, 14);
  const clients = new Set(sample.clients.map(c => c.id));
  for (const row of [...sample.cases, ...sample.appointments, ...sample.conversations]) assert.ok(clients.has(row.clientId));
  for (const row of sample.transactions) assert.equal(row.amount, row.platformFee + row.netEarnings);
  for (const rows of Object.values(sample)) {
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
    assert.ok(rows.every(row => row.isSample));
  }
  assert.ok(sample.clients.every(c => c.email.endsWith('@example.invalid') && c.phone === ''));
  assert.deepEqual([...new Set(sample.transactions.map(t => t.paymentStatus))].sort(), ['completed', 'pending', 'processing']);
});

test('only the exact verified owner is seeded, without replacing existing records or changing account privileges', () => {
  for (const email of ['friend@gmail.com', 'padamkishore90+other@gmail.com', 'padamkishore90@gmail.com.attacker.invalid']) {
    assert.equal(ensureOwnerSampleWorkspace({ id: email, email, isVerified: true }), false);
    assert.equal(db.get().workspace[email], undefined);
  }
  assert.equal(ensureOwnerSampleWorkspace({ id: 'unverified', email: 'padamkishore90@gmail.com', isVerified: false }), false);
  const owner = { id: 'owner', email: 'PadamKishore90@gmail.com', isVerified: true, role: 'admin',
    fullName: 'Owner Name', verificationStatus: 'not_applicable', passwordHash: 'existing-private-hash' };
  const before = JSON.stringify(owner);
  const ws = db.workspaceFor(owner.id);
  ws.clients = [{ id: 'existing-client', name: 'Existing private record' }];
  ws.cases = [{ id: 'existing-case', notes: ['Existing notes'] }];
  ws.settings = { personalPreference: true };
  ws.certificates = [{ id: 'existing-credential' }];
  assert.equal(ensureOwnerSampleWorkspace(owner), true);
  assert.equal(JSON.stringify(owner), before);
  assert.equal(ws.clients[0].id, 'existing-client');
  assert.equal(ws.cases[0].id, 'existing-case');
  assert.deepEqual(ws.settings, { personalPreference: true });
  assert.deepEqual(ws.certificates, [{ id: 'existing-credential' }]);
  assert.equal(ws.sampleDataset.version, 1);
  ws.clients.find(c => c.isSample).status = 'accepted';
  const count = ws.clients.length;
  assert.equal(ensureOwnerSampleWorkspace(owner), false);
  assert.equal(ws.clients.length, count);
  assert.equal(ws.clients.find(c => c.isSample).status, 'accepted');
});

test('the account-owned sample workspace persists through a fresh process without seeding another account', () => {
  db.flushNow();
  const result = require('node:child_process').spawnSync(process.execPath, ['-e', `
    const assert=require('node:assert/strict');
    const db=require('./backend/src/config/dbConfig');
    assert.equal(db.get().workspace.owner.sampleDataset.version,1);
    assert.equal(db.get().workspace.owner.conversations.length,14);
    assert.equal(db.get().workspace.owner.cases[0].id,'existing-case');
    assert.equal(db.get().workspace['friend@gmail.com'],undefined);
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
