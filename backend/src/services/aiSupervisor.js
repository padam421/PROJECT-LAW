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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const resp = await fetch(`${AI_SERVICE_URL}/api/ai/health`, {
      signal: controller.signal,
    });
    if (resp.ok) {
      const data = await resp.json();
      return { ok: data.status === 'healthy', data };
    }
  } catch (_) {} finally { clearTimeout(timeoutId); }
  return { ok: false };
}

async function ensureAIServiceRunning() {
  const health = await checkHealth();
  if (health.ok) {
    console.log(
      `[AI Supervisor] AI service is active (${Number(health.data?.total_vectors || 0).toLocaleString()} indexed records)`
    );
    isStarting = false;
    return true;
  }
  // Production children are managed by start_hosted.py / the hosting platform.
  // Never spawn duplicate Python interpreters in response to incoming traffic.
  if (process.env.NODE_ENV === 'production' || process.env.AI_AUTOSTART === 'false') return false;

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
      windowsHide: true,
    });
    child.on('error', () => { isStarting = false; });
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
