/* ============================================================
   Nyay Setu — VERIFICATION & DOCUMENT CONTROLLER
   ============================================================ */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config/envConfig');
const db = require('../config/dbConfig');
const verificationService = require('../services/verificationService');
const authService = require('../services/authService');

/* -------- Uploads (type & size validated; stored under data/uploads) -------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    cb(null, `${Date.now()}_${require('../config/dbConfig').uid('f')}${path.extname(safe).toLowerCase()}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!config.allowedUploadMime.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, PNG or WEBP files are accepted.'));
    }
    cb(null, true);
  }
});
exports.uploadMiddleware = upload.single('document');

exports.lookupBarCouncil = (req, res) => {
  const { barNumber, stateCouncil } = req.body || {};
  const result = verificationService.lookupBarCouncil(req.user, barNumber, stateCouncil);
  res.json(result);
};

exports.uploadDocument = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No document received.' });

  // Duplicate-content detection (same lawyer, same checksum)
  const checksum = require('crypto').createHash('sha256')
    .update(fs.readFileSync(req.file.path)).digest('hex').slice(0, 16);
  if (verificationService.isDuplicateUpload(req.user.id, checksum)) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(409).json({ error: 'This exact document was already uploaded previously.' });
  }

  const doc = verificationService.saveUploadedDocument(req.user, req.file, {
    category: req.body.category,
    label: req.body.label
  });
  authService.logActivity('document_uploaded', `Credential document uploaded (${doc.category})`, req.user, req);
  const { storedName, ...safeDoc } = doc;
  res.status(201).json({ ok: true, document: safeDoc });
};

exports.listDocuments = (req, res) => {
  res.json({ documents: verificationService.listDocuments(req.user.id) });
};

exports.downloadDocument = (req, res) => {
  const doc = verificationService.findDocument(req.params.docId, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const filePath = path.join(config.uploadsDir, doc.storedName);
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'Stored file is missing.' });
  res.download(filePath, doc.originalName);
};

exports.deleteDocument = (req, res) => {
  const doc = verificationService.findDocument(req.params.docId, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  try { fs.unlinkSync(path.join(config.uploadsDir, doc.storedName)); } catch (_) {}
  const data = db.get();
  data.documents = data.documents.filter(d => d.id !== doc.id);
  db.save();
  res.json({ ok: true });
};

exports.submitIdentityCheck = (req, res) => {
  const identity = verificationService.submitIdentityCheck(req.user, req.body || {});
  res.json({ ok: true, identity });
};

exports.summary = (req, res) => {
  res.json(verificationService.getVerificationSummary(req.user));
};

/* -------- Admin review console (role-guarded) -------- */
exports.adminQueue = (req, res) => {
  const data = db.get();
  const queue = data.users
    // Only fully registered advocates enter the review queue — accounts
    // still mid-signup (email verified, profile not yet submitted) are
    // excluded. Restricted/investigation accounts remain visible with
    // their accountStatus flag so the desk can act on them.
    .filter(u => u.role === 'lawyer' &&
                 u.verificationStatus !== 'verified' &&
                 u.registrationStage === 'complete')
    .map(u => {
      const record = data.verificationRecords.find(v => v.lawyerId === u.id);
      return {
        id: u.id,
        name: u.fullName,
        email: u.email,
        barCouncil: u.barCouncil,
        stateBarCouncil: u.stateBarCouncil,
        city: `${u.city}, ${u.state}`,
        enrollmentDate: u.enrollmentDate,
        qualification: `${u.qualification} • ${u.university}`,
        yearsOfPractice: u.yearsOfPractice,
        verificationStatus: u.verificationStatus,
        accountStatus: u.accountStatus,
        pipeline: record ? {
          overall: record.overallStatus,
          fraudStatus: record.fraudStatus,
          stages: record.stages
        } : null,
        documents: data.documents.filter(d => d.lawyerId === u.id)
          .map(({ storedName, ...d }) => d),
        createdAt: u.createdAt
      };
    });
  res.json({ queue });
};

exports.adminDecide = (req, res) => {
  const { decision, reason } = req.body || {};
  if (!['approve', 'reject', 'request_documents'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be approve, reject or request_documents.' });
  }
  const result = verificationService.adminDecide(req.user, {
    lawyerId: req.params.lawyerId,
    decision,
    reason
  });
  res.status(result.ok ? 200 : result.code).json(result.ok ? result : { error: result.error });
};
