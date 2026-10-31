/* ============================================================
   Nyay Setu — DATABASE SEEDER
   seed.js — Demo advocate (rich workspace), admin reviewer,
   and empty-workspace defaults for fresh registrations.
   ============================================================ */

const bcrypt = require('bcryptjs');
const db = require('../config/dbConfig');
const config = require('../config/envConfig');
const { sha256Short } = require('../utils/helpers');

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildDemoWorkspace() {
  const clientNames = [
    'Rahul Verma', 'Priya Sharma', 'Amit Patel', 'Neha Gupta', 'Suresh Kumar',
    'Anita Desai', 'Vikram Singh', 'Kavita Reddy', 'Manoj Tiwari', 'Sunita Rao',
    'Deepak Joshi', 'Rina Mehta', 'Arun Nair', 'Pooja Saxena', 'Ravi Chopra'
  ];
  const caseTypes = [
    'Property Dispute', 'Criminal Defense', 'Divorce & Family', 'Cyber Crime',
    'Consumer Complaint', 'Bail Application', 'Cheque Bounce', 'Employment Dispute',
    'Land Acquisition', 'Insurance Claim', 'Contract Breach', 'Defamation'
  ];
  const courts = ['Supreme Court', 'High Court', 'District Court', 'Sessions Court', 'Family Court', 'Consumer Forum'];
  const statuses = ['New', 'Under Review', 'Consultation Completed', 'Documents Pending', 'Filed', 'Hearing Scheduled', 'Ongoing', 'Resolved'];
  const consultTypes = ['Video Call', 'Audio Call', 'In-Person', 'Chat'];

  const descriptions = {
    'Property Dispute': 'I have a dispute regarding property ownership. The other party is claiming rights over my ancestral property despite having no legal documents.',
    'Criminal Defense': 'I have been falsely accused in a criminal case and need legal representation for my defense.',
    'Divorce & Family': 'I am seeking legal help for divorce proceedings and custody matters.',
    'Cyber Crime': 'I am a victim of online fraud and need legal help to file a case and recover my losses.',
    'Consumer Complaint': 'I purchased a defective product and the company is refusing to provide a replacement or refund.',
    'Bail Application': 'My family member has been arrested and I need immediate help with the bail application.',
    'Cheque Bounce': 'A cheque issued to me bounced and I want to file a case under Section 138 of the NI Act.',
    'Employment Dispute': 'I was terminated from my job without proper notice and due process. I need legal advice.',
    'Land Acquisition': 'My agricultural land is being acquired by the government and I believe the compensation offered is inadequate.',
    'Insurance Claim': 'My insurance claim has been wrongfully rejected despite meeting all policy conditions.',
    'Contract Breach': 'The other party has breached the terms of our business contract and I want to seek damages.',
    'Defamation': 'False statements are being made against me publicly and I want to file a defamation case.'
  };

  const docPool = [
    { name: 'ID_Proof.pdf', type: 'ID Proof', size: '1.2 MB' },
    { name: 'Property_Document.pdf', type: 'Property Document', size: '3.5 MB' },
    { name: 'Agreement_Copy.pdf', type: 'Agreement', size: '2.1 MB' },
    { name: 'Evidence_Photos.zip', type: 'Evidence', size: '8.7 MB' },
    { name: 'Bank_Statements.pdf', type: 'Financial Document', size: '1.8 MB' },
    { name: 'Court_Notice.pdf', type: 'Court Document', size: '0.5 MB' }
  ];

  const clients = clientNames.map((name, i) => {
    const category = pick(caseTypes);
    return {
      id: `cli_${i + 1}`,
      name,
      email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      phone: `${rand(7, 9)}${String(rand(100000000, 999999999))}`,
      avatar: null,
      caseCategory: category,
      briefProblem: descriptions[category],
      preferredDate: futureDate(rand(1, 14)),
      preferredTime: pick(['10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']),
      consultationType: pick(consultTypes),
      estimatedFee: pick([500, 750, 1000, 1500, 2000]),
      documents: docPool.slice(0, rand(1, 4)).map(d => ({ ...d })),
      status: i < 3 ? 'pending' : pick(['accepted', 'rejected', 'pending', 'completed']),
      createdAt: new Date(Date.now() - rand(1, 40) * 86400000).toISOString()
    };
  });

  const cases = [];
  clients.filter(c => c.status === 'accepted' || c.status === 'completed').forEach((client, i) => {
    cases.push({
      id: `case_${i + 1}`,
      caseNumber: `LC/${new Date().getFullYear()}/${String(i + 1).padStart(4, '0')}`,
      clientId: client.id,
      clientName: client.name,
      caseType: client.caseCategory,
      legalCategory: client.caseCategory,
      court: pick(courts),
      filingDate: new Date(Date.now() - rand(20, 300) * 86400000).toISOString(),
      status: pick(statuses),
      nextHearing: futureDate(rand(3, 30)),
      documents: client.documents,
      notes: [
        { id: `note_${i}_1`, text: 'Initial consultation completed. Client has provided basic documents.', isPrivate: true, createdAt: new Date(Date.now() - rand(5, 30) * 86400000).toISOString() },
        { id: `note_${i}_2`, text: 'Need to review property documents in detail before the next hearing.', isPrivate: true, createdAt: new Date(Date.now() - rand(1, 15) * 86400000).toISOString() }
      ],
      description: client.briefProblem,
      createdAt: client.createdAt
    });
  });

  const appointments = [];
  for (let i = 0; i < 5; i++) {
    const apptDate = new Date();
    apptDate.setDate(apptDate.getDate() + i);
    apptDate.setHours(pick([9, 10, 11, 12, 14, 15, 16]), pick([0, 30]), 0, 0);
    appointments.push({
      id: `appt_${i + 1}`,
      clientId: clients[i] ? clients[i].id : null,
      clientName: clients[i] ? clients[i].name : 'Walk-in Client',
      caseType: clients[i] ? clients[i].caseCategory : 'General Consultation',
      date: apptDate.toISOString(),
      duration: pick([30, 45, 60]),
      type: pick(consultTypes),
      status: i === 0 ? 'confirmed' : pick(['upcoming', 'confirmed', 'completed']),
      fee: pick([500, 750, 1000, 1500]),
      reminders: { h24Sent: false, m30Sent: false }
    });
  }

  const transactions = [];
  for (let i = 0; i < 20; i++) {
    const amount = pick([500, 750, 1000, 1500, 2000, 3000, 5000]);
    const platformFee = Math.round(amount * config.platformFeePct);
    transactions.push({
      id: `txn_${i + 1}`,
      clientName: pick(clientNames),
      service: pick(['Initial Consultation', 'Detailed Consultation', 'Document Review', 'Court Appearance', 'Case Filing']),
      date: new Date(Date.now() - rand(0, 60) * 86400000).toISOString(),
      amount,
      platformFee,
      netEarnings: amount - platformFee,
      paymentStatus: pick(['completed', 'completed', 'completed', 'pending', 'processing']),
      paymentMethod: pick(['UPI', 'Card', 'Net Banking'])
    });
  }
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const reviewTexts = [
    'Excellent lawyer! Very knowledgeable and professional. Explained everything clearly.',
    'Very helpful in understanding my legal rights. Highly recommended.',
    'Provided great guidance on my property dispute case. Very patient and thorough.',
    'Outstanding legal advice. Resolved my case efficiently.',
    'Professional and responsive. Kept me informed throughout the process.',
    'Great experience. The lawyer understood my case immediately and provided practical solutions.',
    'Very competent and well-versed in criminal law. Won my case successfully.',
    'Highly professional. Worth every rupee spent on consultation.',
    'Knowledgeable and supportive. Made a complex legal process seem simple.',
    'Good consultation experience. Would definitely recommend to others.',
    'Exceptional lawyer with deep understanding of civil matters.',
    'Prompt responses and thorough case preparation. Very satisfied.'
  ];
  const reviews = reviewTexts.map((review, i) => ({
    id: `rev_${i + 1}`,
    clientName: pick(clientNames),
    rating: pick([4, 4, 4, 5, 5, 5, 5, 3, 5, 4]),
    review,
    wouldRecommend: pick([true, true, true, true, false]),
    date: new Date(Date.now() - rand(1, 200) * 86400000).toISOString()
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  const notifications = [
    { id: 'notif_1', type: 'client', title: 'New Consultation Request', message: `${clients[0].name} has requested a consultation for ${clients[0].caseCategory}.`, read: false, time: new Date(Date.now() - 1800000).toISOString(), link: '/clients' },
    { id: 'notif_2', type: 'appointment', title: 'Upcoming Appointment', message: `Your consultation with ${clients[0].name} starts soon.`, read: false, time: new Date(Date.now() - 3600000).toISOString(), link: '/consultation' },
    { id: 'notif_3', type: 'payment', title: 'Payment Received', message: `₹1,000 received for consultation with ${clients[2] ? clients[2].name : 'a client'}.`, read: true, time: new Date(Date.now() - 7200000).toISOString(), link: '/payments' },
    { id: 'notif_4', type: 'verification', title: 'Certificate Verified', message: 'Your LLB certificate has been successfully verified.', read: true, time: new Date(Date.now() - 86400000).toISOString(), link: '/settings/tab/notifications' },
    { id: 'notif_5', type: 'security', title: 'New Device Login', message: 'A new device logged into your account. Review it in Security settings.', read: false, time: new Date(Date.now() - 172800000).toISOString(), link: '/settings/tab/security' },
    { id: 'notif_6', type: 'case', title: 'Hearing Reminder', message: `Case LC/${new Date().getFullYear()}/0001 has a hearing scheduled for ${futureDate(3)}.`, read: false, time: new Date(Date.now() - 259200000).toISOString(), link: '/cases' }
  ];

  const conversations = clients.slice(0, 5).map((client, i) => ({
    id: `conv_${i + 1}`,
    clientId: client.id,
    clientName: client.name,
    lastMessage: pick([
      'Thank you for the consultation.',
      'I have uploaded the required documents.',
      'When is the next hearing?',
      'Please review the attached agreement.',
      'Can we schedule a follow-up?'
    ]),
    lastMessageTime: new Date(Date.now() - rand(1, 72) * 3600000).toISOString(),
    unreadCount: i < 2 ? rand(1, 3) : 0,
    category: client.caseCategory,
    messages: [
      { id: `m${i}_1`, sender: 'client', text: 'Hello, I need help with my case.', time: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: `m${i}_2`, sender: 'lawyer', text: `Hello ${client.name.split(' ')[0]}, I have reviewed your case details. Let me explain what I found.`, time: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString() },
      { id: `m${i}_3`, sender: 'lawyer', text: 'Based on the documents you shared, there is a strong case. We should proceed with filing.', time: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: `m${i}_4`, sender: 'client', text: 'Thank you. What documents do I need to submit next?', time: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString() },
      { id: `m${i}_5`, sender: 'lawyer', text: 'Please upload the original agreement copy and any correspondence you have with the other party.', time: new Date(Date.now() - 86400000).toISOString() },
      { id: `m${i}_6`, sender: 'client', text: 'I have uploaded the documents. Please review them.', time: new Date(Date.now() - 43200000).toISOString() }
    ]
  }));

  const experience = [
    { id: 'exp_1', organization: 'Sharma & Associates Law Firm', position: 'Senior Associate', startYear: 2019, endYear: 2024, role: 'Lead Counsel', area: 'Criminal & Civil Litigation' },
    { id: 'exp_2', organization: 'Kumar Legal Services', position: 'Associate', startYear: 2015, endYear: 2019, role: 'Counsel', area: 'Criminal Law' },
    { id: 'exp_3', organization: 'District Court Practice', position: 'Independent Advocate', startYear: 2010, endYear: 2015, role: 'Advocate', area: 'General Practice' }
  ];

  const caseExperience = [
    { id: 'cexp_1', type: 'Property Dispute', area: 'Civil Law', court: 'High Court', year: 2023, role: 'Lead Counsel', status: 'Completed', outcome: 'Successfully Resolved', description: 'Complex property dispute involving multiple parties. Obtained a favourable verdict for the client.' },
    { id: 'cexp_2', type: 'Criminal Defense', area: 'Criminal Law', court: 'Sessions Court', year: 2022, role: 'Defense Counsel', status: 'Completed', outcome: 'Acquitted', description: 'Defended client against serious criminal charges. Secured acquittal based on insufficient evidence.' },
    { id: 'cexp_3', type: 'Cyber Crime', area: 'Cyber Law', court: 'District Court', year: 2024, role: 'Counsel', status: 'Ongoing', outcome: 'In Progress', description: 'Representing a victim of online fraud and identity theft.' },
    { id: 'cexp_4', type: 'Bail Application', area: 'Criminal Law', court: 'High Court', year: 2023, role: 'Defense Counsel', status: 'Completed', outcome: 'Bail Granted', description: 'Successfully argued a bail application in an economic offence case.' }
  ];

  const certificates = [
    { id: 'cert_1', name: 'Bar Council Enrollment Certificate', type: 'required', status: 'verified', verifiedDate: '2024-01-15', fileId: null, fileLabel: 'bar_council_cert.pdf' },
    { id: 'cert_2', name: 'LLB Degree Certificate', type: 'required', status: 'verified', verifiedDate: '2024-01-15', fileId: null, fileLabel: 'llb_degree.pdf' },
    { id: 'cert_3', name: 'Government Identity Proof', type: 'required', status: 'verified', verifiedDate: '2024-01-15', fileId: null, fileLabel: 'aadhaar.pdf' },
    { id: 'cert_4', name: 'LLM Certificate', type: 'optional', status: 'verified', verifiedDate: '2024-02-20', fileId: null, fileLabel: 'llm_cert.pdf' },
    { id: 'cert_5', name: 'Cyber Law Certification', type: 'optional', status: 'verified', verifiedDate: '2024-03-10', fileId: null, fileLabel: 'cyber_law_cert.pdf' },
    { id: 'cert_6', name: 'Mediation Certification', type: 'optional', status: 'pending', verifiedDate: null, fileId: null, fileLabel: 'mediation_cert.pdf' }
  ];

  const pricing = [
    { id: 'price_1', service: 'Initial Consultation', fee: 500, duration: '30 min', type: 'fixed' },
    { id: 'price_2', service: 'Detailed Consultation', fee: 1000, duration: '60 min', type: 'fixed' },
    { id: 'price_3', service: 'Document Review', fee: 750, duration: 'Per Document', type: 'fixed' },
    { id: 'price_4', service: 'Case Representation', fee: 5000, duration: 'Per Case', type: 'starting' },
    { id: 'price_5', service: 'Court Appearance', fee: 3000, duration: 'Per Hearing', type: 'starting' },
    { id: 'price_6', service: 'Legal Notice Drafting', fee: 2000, duration: 'Per Notice', type: 'negotiable' }
  ];

  const availability = {
    monday: [{ start: '10:00', end: '13:00' }, { start: '16:00', end: '19:00' }],
    tuesday: [{ start: '10:00', end: '14:00' }],
    wednesday: [],
    thursday: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
    friday: [{ start: '10:00', end: '14:00' }, { start: '16:00', end: '19:00' }],
    saturday: [{ start: '10:00', end: '13:00' }],
    sunday: []
  };

  const settings = {
    notifications: { clientRequests: true, payments: true, appointments: true, securityAlerts: true, caseUpdates: true, marketing: false },
    privacy: { profileVisibility: 'public', showEmail: false, showPhone: false, allowReviews: true, shareDocuments: 'with_permission' },
    security: { twoFactorEnabled: true, loginAlerts: true, sessionTimeout: 24 }
  };

  const verification = {
    identity: { status: 'verified', date: '2024-01-15', method: 'Government ID + Selfie match' },
    barCouncil: { status: 'verified', date: '2024-01-15', registrationNumber: 'DL/1234/2010' },
    education: { status: 'verified', date: '2024-01-15', institution: 'Delhi University' },
    practiceCertificate: { status: 'verified', date: '2024-01-20', validUntil: '2026-12-31' },
    professionalProfile: { status: 'verified', date: '2024-01-20' },
    verificationId: 'LC-VER-2024-0001',
    overallStatus: 'verified',
    riskLevel: 'low',
    lastUpdated: '2024-01-20'
  };

  return {
    clients, cases, appointments, transactions, reviews, notifications,
    conversations, experience, caseExperience, certificates, pricing,
    availability, settings, verification
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

/* ------------------------------------------------------------
   Demo advocate (OPT-IN: SEED_DEMO_DATA=true) — rich sample
   workspace for evaluating the product. Never seeded in real
   deployments.
   ------------------------------------------------------------ */
async function seedDemoAdvocate(data) {
  const demoPasswordHash = await hashPassword(process.env.DEMO_PASSWORD || 'Demo@1234');

  data.users.push({
    id: 'law_demo_001',
    role: 'lawyer',
    fullName: 'Adv. Rajesh Kumar Sharma',
    professionalName: 'Adv. R.K. Sharma',
    email: 'demo@Nyay Setu.in',
    phone: '9876543210',
    phoneNormalized: '9876543210',
    emailHash: sha256Short('demo@Nyay Setu.in'),
    phoneHash: sha256Short('9876543210'),
    passwordHash: demoPasswordHash,
    gender: 'Male',
    dob: '1985-03-15',
    address: '42, Connaught Place, Central Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    profilePhoto: null,
    barCouncil: 'DL/1234/2010',
    barNumberHash: sha256Short('dl/1234/2010'),
    stateBarCouncil: 'Bar Council of Delhi',
    enrollmentDate: '2010-09-15',
    enrollmentYear: '2010',
    qualification: 'LLB (Hons), LLM',
    university: 'Faculty of Law, University of Delhi',
    yearsOfPractice: 14,
    practiceType: 'Independent Advocate & Litigation Counsel',
    primarySpecialization: 'Criminal Law',
    additionalSpecializations: ['Civil Law', 'Cyber Law', 'Constitutional Law'],
    courts: ['Supreme Court of India', 'High Court of Delhi', 'District & Sessions Courts'],
    languages: ['English', 'Hindi'],
    bio: 'A seasoned criminal law practitioner with over 14 years of experience handling complex criminal, civil, and cyber law matters. Successfully represented clients before the Supreme Court and various High Courts across India.',
    isVerified: true,
    registrationStage: 'complete',
    accountStatus: 'active',
    verificationStatus: 'verified',
    verificationId: 'LC-VER-2024-0001',
    verificationDate: '2024-01-20',
    rating: 4.8,
    totalReviews: 127,
    profileDeactivated: false,
    sensitiveActionsLockedUntil: null,
    createdAt: new Date().toISOString()
  });

  data.workspace['law_demo_001'] = buildDemoWorkspace();
  console.log('[seed] Demo advocate seeded (SEED_DEMO_DATA=true): demo@Nyay Setu.in');
}

/**
 * Boot-time provisioning.
 * • Verification-desk admin is ensured from ADMIN_EMAIL / ADMIN_PASSWORD
 *   so the review console always works (override in .env for production).
 * • Demo advocate + sample workspace seed ONLY when SEED_DEMO_DATA=true
 *   and no advocate exists yet. Real deployments stay clean by default.
 */
async function seedIfEmpty() {
  const data = db.get();
  let changed = false;

  if (!data.users.some(u => u.role === 'admin')) {
    const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@Nyay Setu.in').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    // Production requires an explicit ADMIN_PASSWORD (envConfig fail-fast
    // blocks boot otherwise). Development falls back to a known default so
    // the review console is usable out of the box.
    const plainAdminPassword = adminPassword || 'Admin@1234';
    data.users.push({
      id: db.uid('adm'),
      role: 'admin',
      fullName: 'Verification Desk',
      email: adminEmail,
      passwordHash: await hashPassword(plainAdminPassword),
      isVerified: true,
      registrationStage: 'complete',
      accountStatus: 'active',
      createdAt: new Date().toISOString()
    });
    changed = true;
    console.log(`[seed] Verification-desk admin ready: ${adminEmail}`);
    if (!adminPassword) {
      console.warn('[seed] WARNING: ADMIN_PASSWORD not set — using development default. Set it in .env before deploying.');
    }
  }

  const demoWanted = String(process.env.SEED_DEMO_DATA || '').toLowerCase() === 'true';
  if (demoWanted && !data.users.some(u => u.role === 'lawyer')) {
    await seedDemoAdvocate(data);
    changed = true;
  }

  // Explicit owner-requested samples are private to the named account's lawyer
  // workspace. They never enable global demo mode or alter professional status.
  for (const user of data.users) {
    if (require('./ownerSampleWorkspace').ensureOwnerSampleWorkspace(user)) changed = true;
  }

  if (changed) {
    db.save();
    db.flushNow();
  }
  return changed;
}

module.exports = { seedIfEmpty, buildDemoWorkspace, hashPassword };
