/* ============================================================
   Nyay Setu — AI SERVICE SUPERVISOR
   aiSupervisor.js — Monitors and auto-starts the Python AI Service (port 5000)
   ============================================================ */

const { spawn } = require('child_process');
const path = require('path');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5000';
let isStarting = false;
let lastStartAttempt = 0;

async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${AI_SERVICE_URL}/api/ai/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      return { ok: true, data };
    }
  } catch (_) {}
  return { ok: false };
}

async function ensureAIServiceRunning() {
  const health = await checkHealth();
  if (health.ok) {
    console.log(
      `[AI Supervisor] Supreme Court AI Service is active on ${AI_SERVICE_URL} (${health.data?.total_vectors?.toLocaleString() || '1,000,000+'} vectors)`
    );
    isStarting = false;
    return true;
  }

  // Prevent multiple overlapping spawns (cooldown of 25 seconds while ChromaDB loads)
  const now = Date.now();
  if (isStarting && now - lastStartAttempt < 25000) {
    console.log(
      '[AI Supervisor] AI Service is currently booting up, awaiting vector load...'
    );
    return false;
  }

  isStarting = true;
  lastStartAttempt = now;
  console.log(
    '[AI Supervisor] Port 5000 offline. Auto-launching Python Supreme Court AI RAG Service...'
  );

  const aiServiceDir = path.resolve(__dirname, '../../../ai-service');
  try {
    const child = spawn('python', ['src/app.py'], {
      cwd: aiServiceDir,
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    child.unref();
    console.log(
      '[AI Supervisor] Python AI process spawned in background. Waiting for ChromaDB initialization...'
    );
  } catch (err) {
    console.error(
      '[AI Supervisor] Failed to auto-launch Python AI service:',
      err.message
    );
    isStarting = false;
    return false;
  }

  return true;
}

module.exports = {
  checkHealth,
  ensureAIServiceRunning,
  AI_SERVICE_URL,
};
