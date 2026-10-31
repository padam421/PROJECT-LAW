/* ============================================================
   Nyay Setu — WORKSPACE STATE CONTROLLER
   Bulk hydration + per-collection sync for the SPA store.
   ============================================================ */

const db = require('../config/dbConfig');

exports.getWorkspace = (req, res) => {
  const ws = db.workspaceFor(req.user.id);
  res.json({
    workspace: ws,
    lawyer: {
      id: req.user.id,
      role: req.user.role,
      workspaceOnly: req.user.role !== 'lawyer',
      demoMode: req.user.demoMode === true,
      registrationStage: req.user.registrationStage,
      fullName: req.user.fullName,
      professionalName: req.user.professionalName,
      email: req.user.email,
      phone: req.user.phone,
      city: req.user.city,
      state: req.user.state,
      barCouncil: req.user.barCouncil,
      stateBarCouncil: req.user.stateBarCouncil,
      primarySpecialization: req.user.primarySpecialization,
      additionalSpecializations: req.user.additionalSpecializations,
      courts: req.user.courts,
      languages: req.user.languages,
      yearsOfPractice: req.user.yearsOfPractice,
      qualification: req.user.qualification,
      university: req.user.university,
      bio: req.user.bio || '',
      profilePhoto: req.user.profilePhoto || null,
      verificationStatus: req.user.role === 'lawyer' ? req.user.verificationStatus : 'not_applicable',
      verificationId: req.user.verificationId,
      verificationDate: req.user.verificationDate,
      profileDeactivated: !!req.user.profileDeactivated,
      accountStatus: req.user.accountStatus,
      rating: req.user.rating
    }
  });
};

/** Replace a single whitelisted collection for this lawyer. */
exports.putCollection = (req, res) => {
  const { collection } = req.params;
  const value = req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : req.body;

  if (!db.WORKSPACE_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: `Unknown collection '${collection}'` });
  }
  if (value === undefined || value === null || typeof value !== 'object') {
    return res.status(400).json({ error: 'Payload must be an object or array.' });
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'Collection too large.' });
  }

  const ok = db.writeWorkspaceCollection(req.user.id, collection, value);
  res.status(ok ? 200 : 400).json(ok ? { saved: true } : { error: 'Write failed' });
};
