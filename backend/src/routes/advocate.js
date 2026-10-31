/* Separate, authenticated advocate research transport. No citizen AI routes are changed. */
const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middlewares/authMiddleware');
const router = express.Router();
const base = process.env.AI_SERVICE_URL || 'http://localhost:5000';
// Research/practice is available to every signed-in account. History stays owner-scoped.
router.use(authenticate);
// The shared persistence implementation derives a separate namespace from this mount.
router.use('/assistant', require('./assistant'));
for (const action of ['chat', 'rehearsal']) {
  router.post('/' + action, require('../middlewares/aiCapacity'), async (req, res) => {
    try {
      const response = await fetch(`${base}/api/ai/advocate/${action}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(req.body), signal: AbortSignal.timeout(230000)
      });
      if (response.headers.get('retry-after')) res.set('Retry-After', response.headers.get('retry-after'));
      res.status(response.status).json(await response.json());
    } catch (_) {
      res.status(503).json({ok:false,error:'Advocate AI is temporarily unavailable. Your brief and hearing remain saved; retry.'});
    }
  });
}
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:0}}).single('file');
router.post('/documents', (req, res) => {
  upload(req, res, async error => {
    if (error || !req.file) return res.status(400).json({ok:false,error:'Choose one PDF, DOCX, TXT or CSV file up to 10 MB.'});
    try {
      const form = new FormData();
      form.append('file',new Blob([req.file.buffer]),req.file.originalname);
      const response = await fetch(`${base}/api/ai/advocate/documents`,{method:'POST',body:form,signal:AbortSignal.timeout(45000)});
      res.status(response.status).json(await response.json());
    } catch (_) { res.status(503).json({ok:false,error:'Document extraction is unavailable. Your selected documents are retained; retry or paste the text.'}); }
  });
});
module.exports = router;
