/* ============================================================
   Nyay Setu — ERROR HANDLING MIDDLEWARE
   ============================================================ */

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  console.error('[error]', err.message);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack.split('\n').slice(0, 4).join('\n'));
  }
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  const message =
    err.name === 'MulterError'
      ? `Upload failed: ${err.message}`
      : err.message || 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = { notFoundHandler, errorMiddleware };
