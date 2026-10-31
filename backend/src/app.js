/* ============================================================
   Nyay Setu — EXPRESS APPLICATION
   app.js — Middleware chain, static hosting, API mount
   ============================================================ */

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const apiRoutes = require('./routes');
const { notFoundHandler, errorMiddleware } = require('./middlewares/errorMiddleware');
const { validateForEnvironment } = require('./config/envConfig');

/* Production fail-fast: bad secrets / missing email config abort boot. */
validateForEnvironment();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const config = require('./config/envConfig');
const db = require('./config/dbConfig');

app.use(helmet({
  contentSecurityPolicy: false,      // SPA loads Google Fonts/Material Symbols
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!config.isProd || !origin || origin === new URL(config.appBaseUrl).origin) return callback(null, true);
    callback(null, false);
  },
  credentials: true                  // allow the HttpOnly session cookie
}));
app.use(express.json({ limit: '3mb' }));   // room for base64 profile photos
app.use(cookieParser());                   // parses the lc_session cookie for auth
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Refuse cross-site mutations even when a browser sends cookies with its request.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const origin = req.get('origin');
  if (config.isProd && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      ((origin && origin !== new URL(config.appBaseUrl).origin) || req.get('sec-fetch-site') === 'cross-site')) {
    return res.status(403).json({ error: 'This request must come from the website.' });
  }
  next();
});

// Never acknowledge a write while its authoritative state exists only in RAM.
app.use('/api', (req, res, next) => {
  if (!db.hosted) return next();
  const end = res.end;
  let ended = false;
  res.end = function (...args) {
    if (ended) return res;
    ended = true;
    db.flushDurable().then(() => end.apply(res, args)).catch(() => {
      if (res.headersSent) return res.destroy();
      res.statusCode = 503;
      res.removeHeader('Set-Cookie');
      res.removeHeader('Content-Length');
      res.setHeader('Content-Type', 'application/json');
      end.call(res, JSON.stringify({ ok: false, error: 'Your changes could not be saved. Please retry when storage is available.' }));
    });
    return res;
  };
  next();
});

/* API */
app.use('/api', apiRoutes);

/* Static SPA (lawyer portal + shared design system + admin console) */
const frontendRoot = path.join(__dirname, '..', '..', 'frontend');
app.use('/frontend', compression({
  filter: (req, res) => /\.(?:html?|js|css|json|svg|txt)$/i.test(req.path) && compression.filter(req, res)
}), express.static(frontendRoot, {
  maxAge: 0,
  setHeaders: (res, filePath) => {
    // Reuse large courtroom models and artwork while keeping application code fresh.
    if (config.isProd && /\.(?:glb|gltf|png|jpe?g|webp|gif|svg|ico|woff2?|mp3|wav)$/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=86400');
      return;
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

/* Convenience redirects */
app.get('/', (_req, res) => res.redirect('/frontend/index.html'));
app.get('/user', (_req, res) => res.redirect('/frontend/user/index.html'));
app.get('/client', (_req, res) => res.redirect('/frontend/user/index.html'));
app.get('/lawyer', (_req, res) => res.redirect('/frontend/lawyer/index.html'));
app.get('/advocate', (_req, res) => res.redirect('/frontend/lawyer/index.html'));
app.get('/admin', (_req, res) => res.sendFile(path.join(frontendRoot, 'admin', 'index.html')));

app.use(notFoundHandler);
app.use(errorMiddleware);

module.exports = app;
