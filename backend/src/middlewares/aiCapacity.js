/* Bound expensive AI work on the free instance. No automatic POST retries. */
const recent = new Map();
let active = 0;
module.exports = function aiCapacity(req, res, next) {
  const now = Date.now();
  for (const [key, entry] of recent) if (entry.until <= now) recent.delete(key);
  const key = req.user?.id || req.ip;
  const entry = recent.get(key) || { count: 0, until: now + 60000 };
  if (active >= 3 || entry.count >= 20 || (!recent.has(key) && recent.size >= 2000)) {
    res.set('Retry-After', '10');
    return res.status(429).json({ ok: false, retryable: true, retry_after: 10,
      error: 'AI capacity is busy. Your conversation is retained; retry this turn shortly.' });
  }
  entry.count += 1;
  recent.set(key, entry);
  active += 1;
  let released = false;
  const release = () => { if (!released) { released = true; active -= 1; } };
  res.once('finish', release);
  res.once('close', release);
  next();
};
