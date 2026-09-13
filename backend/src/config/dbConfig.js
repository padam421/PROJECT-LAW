/* ============================================================
   Nyay Setu — DATA LAYER (file-backed JSON database)
   dbConfig.js — Atomic read/write, per-lawyer workspaces, indexes
   ------------------------------------------------------------
   Production note: this driver mirrors a relational model 1:1.
   See /database/schema/*.sql for the PostgreSQL/MySQL DDL used
   when swapping this layer for a real database server.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const config = require('./envConfig');

const DB_FILE = path.join(config.dataDir, 'db.json');

let _db = null;
let _writeQueued = false;

function ensureDirs() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

function emptyDb() {
  return {
    meta: { version: 2, createdAt: new Date().toISOString() },
    users: [],              // lawyers + admins (auth identity)
    otpChallenges: [],
    otpSends: [],           // per-email send log powering rate limits (auto-pruned)
    sessions: [],           // active JWT session records
    trustedDevices: [],
    loginActivity: [],
    verificationRecords: [],
    documents: [],          // uploaded credential documents metadata
    adminActions: [],
    fraudRiskRecords: [],
    workspace: {}           // lawyerId -> { clients, cases, appointments, ... }
  };
}

function load() {
  ensureDirs();
  if (_db) return _db;
  try {
    if (fs.existsSync(DB_FILE)) {
      _db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      // Forward-merge any missing collections
      const blank = emptyDb();
      for (const key of Object.keys(blank)) {
        if (_db[key] === undefined) _db[key] = blank[key];
      }
    } else {
      _db = emptyDb();
    }
  } catch (err) {
    console.error('[db] Failed to load database, starting fresh:', err.message);
    _db = emptyDb();
  }
  return _db;
}

/** Debounced atomic persist — batches rapid SPA syncs into one disk write. */
function save() {
  if (_writeQueued) return;
  _writeQueued = true;
  setTimeout(() => {
    _writeQueued = false;
    try {
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(_db, null, 1), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('[db] Persist failed:', err.message);
    }
  }, 120);
}

function flushNow() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_db, null, 1), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  } catch (_) { /* best effort */ }
}

/* ---------------- Accessors ---------------- */
const get = () => load();

function findUser(predicate) {
  return load().users.find(predicate) || null;
}

function workspaceFor(lawyerId) {
  const db = load();
  if (!db.workspace[lawyerId]) {
    db.workspace[lawyerId] = {};
    save();
  }
  return db.workspace[lawyerId];
}

const WORKSPACE_COLLECTIONS = [
  'clients', 'cases', 'appointments', 'transactions', 'reviews',
  'notifications', 'conversations', 'experience', 'caseExperience',
  'certificates', 'pricing', 'availability', 'settings'
];

function writeWorkspaceCollection(lawyerId, collection, value) {
  if (!WORKSPACE_COLLECTIONS.includes(collection)) return false;
  const ws = workspaceFor(lawyerId);
  ws[collection] = value;
  save();
  return true;
}

/* ---------------- IDs ---------------- */
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  get,
  save,
  flushNow,
  load,
  findUser,
  workspaceFor,
  writeWorkspaceCollection,
  WORKSPACE_COLLECTIONS,
  uid,
  DB_FILE
};
