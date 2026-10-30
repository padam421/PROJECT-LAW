/* ============================================================
   Nyay Setu — VERIFICATION SERVICE
   verificationService.js — Bar registry lookup (simulated),
   credential document intake, identity/liveness status model,
   manual admin review actions.
   ------------------------------------------------------------
   HONESTY CONTRACT (important):
   • No live Bar Council of India API exists for public programmatic
     lookup. `lookupBarCouncil` performs FORMAT + INTERNAL RECORD
     checks only and is labelled "Internal Registry Simulation".
   • No OCR/AI engine is attached. Uploaded documents receive
     "Submitted — Awaiting Review" states, never fabricated
     authenticity scores.
   • No biometric liveness provider is attached. The identity stage
     records a structured submission and routes to manual review.
   ============================================================ */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/dbConfig');
const config = require('../config/envConfig');
const { sha256Short, validateBarNumber } = require('../utils/helpers');
const authService = require('./authService');

/* ---------------- Bar Council stage ---------------- */
function lookupBarCouncil(lawyer, barNumber, stateCouncil) {
  if (lawyer.demoMode) return { outcome: 'demo_not_verified', reason: 'Sample registration details accepted for practice only. No professional eligibility was verified.' };
  const data = db.get();
  const bar = String(barNumber || '').trim().toUpperCase();

  // Duplicate detection across all accounts
  const collision = data.users.find(u =>
    u.role === 'lawyer' && u.id !== lawyer.id && u.barNumberHash === sha256Short(bar)
  );

  let result = {
    checkedAt: new Date().toISOString(),
    registrationNumber: bar,
    stateCouncil: stateCouncil || lawyer.stateBarCouncil,
    checks: {
      formatValid: validateBarNumber(bar),
      nameOnRecord: null,
      stateMatch: null,
      activeStanding: null,
      duplicateInSystem: !!collision
    },
    source: 'Internal Registry Simulation — official Bar Council API integration pending',
    outcome: 'pending'
  };

  if (!result.checks.formatValid) {
    result.outcome = 'unable_to_verify';
    result.reason = 'Registration number does not match the standard State Code / Number / Year format.';
    applyStageResult(data, lawyer, 'barCouncil', 'unable_to_verify', result);
    return result;
  }

  if (collision) {
    result.outcome = 'information_mismatch';
    result.reason = 'This registration number is already associated with another advocate profile on Nyay Setu. Routed for investigation.';
    applyStageResult(data, lawyer, 'barCouncil', 'information_mismatch', result);
    return result;
  }

  if (bar !== String(lawyer.barCouncil || '').trim().toUpperCase()) {
    result.outcome = 'information_mismatch';
    result.reason = 'This number does not match your submitted advocate profile. Use your registered number, or update your professional profile first.';
    return result;
  }

  // Internal simulation: treat well-formed, non-colliding numbers as "manual verification required"
  // until an official integration or an admin reviewer confirms them.
  result.outcome = 'manual_verification_required';
  result.checks.stateMatch = true;
  result.checks.activeStanding = null;
  result.reason = 'Well-formed registration. Awaiting confirmation by the Nyay Setu verification desk (official Bar Council feed not yet connected).';

  applyStageResult(data, lawyer, 'barCouncil', 'manual_verification_required', result);

  // Demo convenience: the demo advocate's own number resolves as verified in the seeded record.
  return result;
}

function applyStageResult(data, lawyer, stageKey, status, detail) {
  let record = data.verificationRecords.find(v => v.lawyerId === lawyer.id);
  if (!record) {
    record = {
      id: db.uid('ver'),
      lawyerId: lawyer.id,
      stages: {
        barCouncil: { status: 'pending', checkedAt: null },
        documents: { status: 'pending', docsSubmitted: 0 },
        identity: { status: 'not_started', livenessAt: null },
        duplicate: { status: 'clear', checkedAt: new Date().toISOString(), collisionLawyerId: null },
        manualReview: { status: 'not_required', reviewerId: null, decidedAt: null }
      },
      overallStatus: 'pending',
      fraudStatus: 'low_risk',
      riskSignals: [],
      createdAt: new Date().toISOString()
    };
    data.verificationRecords.push(record);
  }
  record.stages[stageKey] = {
    ...record.stages[stageKey],
    status,
    detail,
    checkedAt: new Date().toISOString()
  };
  recomputeOverall(record);
  db.save();
}

function recomputeOverall(record) {
  const s = record.stages;
  const statuses = [s.barCouncil.status, s.documents.status, s.identity.status];
  const failed = statuses.includes('information_mismatch') || statuses.includes('failed') ||
    (s.duplicate && s.duplicate.status === 'collision_found' && s.manualReview.status !== 'cleared_after_review');
  const needsManual = statuses.includes('manual_verification_required') || s.manualReview.status === 'required';
  const allVerified = s.barCouncil.status === 'verified' && s.documents.status === 'verified' && s.identity.status === 'verified';

  if (allVerified) record.overallStatus = 'verified';
  else if (failed) record.overallStatus = 'action_required';
  else if (needsManual || statuses.includes('pending') || statuses.includes('not_started')) record.overallStatus = 'pending';
  else record.overallStatus = 'pending';

  record.lastUpdatedAt = new Date().toISOString();
}

/* ---------------- Documents stage ---------------- */
function saveUploadedDocument(lawyer, file, meta) {
  const data = db.get();
  const docRecord = {
    id: db.uid('doc'),
    lawyerId: lawyer.id,
    category: meta.category || 'other',           // bar_enrollment | cop | llb_degree | govt_id | llm | other_cert
    label: meta.label || file.originalname,
    storedName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    checksumSha256_12: crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex').slice(0, 16),
    uploadedAt: new Date().toISOString(),
    // Honest review model — no fake OCR scores
    integrity: { readable: true, tamperingIndicators: 'not_scanned' },
    matchAgainstProfile: { nameMatches: null, regNumberMatches: null },
    reviewStatus: 'submitted_awaiting_review',    // submitted_awaiting_review | verified | information_mismatch | rejected
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: ''
  };
  data.documents.push(docRecord);

  const verRecord = data.verificationRecords.find(v => v.lawyerId === lawyer.id);
  if (verRecord) {
    verRecord.stages.documents.docsSubmitted = data.documents.filter(d => d.lawyerId === lawyer.id).length;
    verRecord.stages.documents.status = 'manual_verification_required';
    recomputeOverall(verRecord);
  }
  db.save();
  return docRecord;
}

function listDocuments(lawyerId) {
  return db.get().documents
    .filter(d => d.lawyerId === lawyerId)
    .map(({ checksumSha256_12, ...pub }) => ({ ...pub, checksum: undefined }));
}

function findDocument(docId, lawyerId) {
  return db.get().documents.find(d => d.id === docId && d.lawyerId === lawyerId) || null;
}

/** True when the same file content was already uploaded by this account. */
function isDuplicateUpload(lawyerId, checksum) {
  return db.get().documents.some(d => d.lawyerId === lawyerId && d.checksumSha256_12 === checksum);
}

/* ---------------- Identity / liveness stage ---------------- */
function submitIdentityCheck(lawyer, { selfieCaptured, idDocSubmitted }) {
  const data = db.get();
  if (lawyer.demoMode) {
    let record = data.verificationRecords.find(v => v.lawyerId === lawyer.id);
    if (!record) {
      record = { id: db.uid('ver'), lawyerId: lawyer.id, overallStatus: 'demo_not_verified', fraudStatus: 'not_assessed',
        stages: { barCouncil: {status:'demo_not_verified'},documents:{status:'optional',docsSubmitted:0},identity:{status:'not_started'},duplicate:{status:'not_assessed'},manualReview:{status:'not_required'} } };
      data.verificationRecords.push(record);
    }
    record.stages.identity = { status: 'demo_not_verified', selfieCaptured: false, idDocSubmitted: false, submittedAt: new Date().toISOString(), method: 'Demo only; no identity verification' };
    db.save();
    return record.stages.identity;
  }
  const documents = data.documents.filter(doc => doc.lawyerId === lawyer.id);
  const required = ['bar_enrollment', 'cop', 'llb_degree', 'govt_id', 'identity_selfie'];
  if (required.some(category => !documents.some(doc => doc.category === category))) {
    const error = new Error('Upload all four required credentials and a selfie before submitting identity confirmation.');
    error.status = 400;
    throw error;
  }
  const verRecord = data.verificationRecords.find(v => v.lawyerId === lawyer.id) ||
    (() => {
      const rec = { id: db.uid('ver'), lawyerId: lawyer.id, stages: { barCouncil: { status: 'pending' }, documents: { status: 'pending', docsSubmitted: 0 }, identity: { status: 'not_started' }, duplicate: { status: 'clear' }, manualReview: { status: 'not_required' } }, overallStatus: 'pending', fraudStatus: 'low_risk', createdAt: new Date().toISOString() };
      data.verificationRecords.push(rec);
      return rec;
    })();

  verRecord.stages.identity = {
    status: 'manual_verification_required', // honest: no biometric provider attached
    method: 'Uploaded government ID and selfie for manual review',
    selfieCaptured: true,
    idDocSubmitted: true,
    selfieDocumentId: documents.filter(doc => doc.category === 'identity_selfie').at(-1).id,
    idDocumentId: documents.find(doc => doc.category === 'govt_id').id,
    livenessProvider: 'none_connected',
    submittedAt: new Date().toISOString()
  };
  recomputeOverall(verRecord);
  db.save();
  return verRecord.stages.identity;
}

/* ---------------- Verification summary + completion ---------------- */
function getVerificationSummary(lawyer) {
  const data = db.get();
  const record = data.verificationRecords.find(v => v.lawyerId === lawyer.id) || null;

  const summary = {
    demoMode: lawyer.demoMode === true,
    lawyerStatus: lawyer.verificationStatus,       // pending | verified | rejected ...
    verificationId: lawyer.verificationId,
    verificationDate: lawyer.verificationDate,
    sensitiveActionsLockedUntil: lawyer.sensitiveActionsLockedUntil,
    passwordChangeRequired: !!lawyer.passwordChangeRequired,
    pipeline: record ? {
      overall: record.overallStatus,
      fraudStatus: record.fraudStatus,
      stages: {
        barCouncil: { status: record.stages.barCouncil.status, checkedAt: record.stages.barCouncil.checkedAt,
          registrationNumber: record.stages.barCouncil.detail?.registrationNumber || lawyer.barCouncil || '' },
        documents: { status: record.stages.documents.status, docsSubmitted: record.stages.documents.docsSubmitted || 0 },
        identity: { status: record.stages.identity.status, submittedAt: record.stages.identity.submittedAt || null },
        duplicate: { status: record.stages.duplicate.status },
        manualReview: { status: record.stages.manualReview.status }
      }
    } : {
      overall: lawyer.verificationStatus === 'verified' ? 'verified' : 'pending',
      fraudStatus: 'low_risk',
      stages: {}
    },
    // Lawyer-visible verification centre cards (internal fraud signals deliberately omitted)
    center: {
      identity: { status: record ? mapStageToCenter(record.stages.identity.status) : (lawyer.verificationStatus === 'verified' ? 'verified' : 'pending'), note: 'Biometric provider not connected — submissions are reviewed manually.' },
      barCouncil: { status: record ? mapStageToCenter(record.stages.barCouncil.status) : (lawyer.verificationStatus === 'verified' ? 'verified' : 'pending'), note: 'Official Bar Council feed not connected — internal simulation + desk confirmation.' },
      education: { status: lawyer.verificationStatus === 'verified' ? 'verified' : 'pending' },
      practiceCertificate: { status: lawyer.verificationStatus === 'verified' ? 'verified' : 'pending' },
      professionalProfile: { status: lawyer.profileComplete ? 'verified' : 'pending' }
    }
  };
  return summary;
}

function mapStageToCenter(stageStatus) {
  switch (stageStatus) {
    case 'verified': return 'verified';
    case 'information_mismatch': case 'failed': return 'failed';
    case 'manual_verification_required': return 'manual_review';
    case 'not_started': return 'pending';
    default: return 'pending';
  }
}

/** Admin decision hook (used by the admin console). */
function adminDecide(reviewer, { lawyerId, decision, reason }) {
  const data = db.get();
  const lawyer = data.users.find(u => u.id === lawyerId && u.role === 'lawyer');
  if (!lawyer) return { ok: false, code: 404, error: 'Advocate not found' };
  if (lawyer.demoMode) return { ok: false, code: 400, error: 'Demo profiles cannot receive a professional verification badge.' };

  const record = data.verificationRecords.find(v => v.lawyerId === lawyerId);
  if (record) {
    record.stages.manualReview = {
      status: decision === 'request_documents' ? 'required' : 'completed',
      reviewerId: reviewer.id,
      decision,
      reason: reason || '',
      decidedAt: new Date().toISOString()
    };
    recomputeOverall(record);
  }

  if (decision === 'approve') {
    lawyer.verificationStatus = 'verified';
    lawyer.accountStatus = 'active';
    lawyer.verificationId = `LC-VER-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    lawyer.verificationDate = new Date().toISOString();
  } else if (decision === 'reject') {
    lawyer.verificationStatus = 'rejected';
  } else if (decision === 'request_documents') {
    lawyer.verificationStatus = 'pending';
  }

  data.adminActions.push({
    id: db.uid('adm'),
    type: 'verification_decision',
    lawyerId,
    reviewerId: reviewer.id,
    decision,
    reason: reason || '',
    createdAt: new Date().toISOString()
  });

  const messages = {
    approve: 'Your advocate profile is verified. Your Verified Badge is now active.',
    reject: `Verification could not be completed. ${reason || 'Please contact support for details.'}`,
    request_documents: 'Additional documents are required to complete your verification.'
  };
  authService.notifyUser(lawyerId, 'verification', 'Verification Update', messages[decision], '/settings/tab/notifications');

  db.save();
  return { ok: true, lawyer: { id: lawyer.id, verificationStatus: lawyer.verificationStatus, verificationId: lawyer.verificationId } };
}

module.exports = {
  lookupBarCouncil,
  saveUploadedDocument,
  listDocuments,
  findDocument,
  isDuplicateUpload,
  submitIdentityCheck,
  getVerificationSummary,
  adminDecide
};
