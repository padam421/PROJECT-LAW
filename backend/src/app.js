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

const apiRoutes = require('./routes');
const { notFoundHandler, errorMiddleware } = require('./middlewares/errorMiddleware');
const { validateForEnvironment } = require('./config/envConfig');

/* Production fail-fast: bad secrets / missing email config abort boot. */
validateForEnvironment();

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,      // SPA loads Google Fonts/Material Symbols
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: true,                      // reflect request origin (static SPA is same-origin in production)
  credentials: true                  // allow the HttpOnly session cookie
}));
app.use(express.json({ limit: '3mb' }));   // room for base64 profile photos
app.use(cookieParser());                   // parses the lc_session cookie for auth
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* API */
app.use('/api', apiRoutes);

/* Static SPA (lawyer portal + shared design system + admin console) */
const frontendRoot = path.join(__dirname, '..', '..', 'frontend');
app.use('/frontend', express.static(frontendRoot, {
  maxAge: 0,
  setHeaders: (res) => {
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
