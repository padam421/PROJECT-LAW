const db = require('../config/dbConfig');

const OWNER_EMAIL = 'padamkishore90@gmail.com';
const VERSION = 1;

function buildSampleWorkspace(now = new Date()) {
  const base = now.getTime();
  const day = 86400000;
  const iso = offset => new Date(base + offset).toISOString();
  const names = ['Aarav Mehta', 'Nisha Verma', 'Kabir Sethi', 'Isha Rao', 'Rohan Malhotra',
    'Tara Kapoor', 'Aditya Shah', 'Meera Nair', 'Vivaan Joshi', 'Ananya Bhat',
    'Arjun Das', 'Diya Menon', 'Samar Jain', 'Kavya Singh', 'Dev Khanna',
    'Riya Bose', 'Ishaan Sen', 'Aditi Kulkarni', 'Neel Gupta', 'Sara Dutta'];
  const matters = ['Tenancy Dispute', 'Consumer Complaint', 'Employment Dispute',
    'Property Dispute', 'Cheque Bounce', 'Family Mediation', 'Cyber Fraud', 'Contract Review'];
  const topics = [
    'Please review the agreement and help me understand the next steps.',
    'I have gathered the payment receipts and a dated summary of the incident.',
    'Can we arrange a consultation to discuss the documents?',
    'Please confirm the preparation checklist for our next meeting.'
  ];
  const sample = record => ({ ...record, isSample: true });
  const clients = names.map((name, i) => sample({
    id: `showcase_v1_client_${i + 1}`, name, email: `client${i + 1}@example.invalid`, phone: '',
    city: ['Jaipur', 'Delhi', 'Pune', 'Bengaluru'][i % 4],
    state: ['Rajasthan', 'Delhi', 'Maharashtra', 'Karnataka'][i % 4],
    avatar: null, caseCategory: matters[i % matters.length],
    briefProblem: `Fictional sample enquiry: ${topics[i % topics.length]}`,
    preferredDate: iso((1 + i % 7) * day).slice(0, 10), preferredTime: ['10:00 AM', '2:00 PM', '4:30 PM'][i % 3],
    consultationType: ['Video Call', 'Audio Call', 'In-Person'][i % 3], estimatedFee: 750 + i % 5 * 250,
    documents: [], status: i < 8 ? 'pending' : i < 18 ? 'accepted' : 'completed',
    createdAt: iso(-(i + 1) * 3 * 3600000)
  }));
  const cases = clients.slice(8).map((client, i) => sample({
    id: `showcase_v1_case_${i + 1}`, caseNumber: `SAMPLE/${now.getFullYear()}/${String(i + 1).padStart(4, '0')}`,
    clientId: client.id, clientName: client.name, caseType: client.caseCategory,
    legalCategory: client.caseCategory, court: ['District Court, Jaipur', 'Delhi District Court', 'Consumer Commission'][i % 3],
    filingDate: iso(-(18 + i * 4) * day), nextHearing: iso((i % 9 + 1) * day).slice(0, 10),
    status: ['Ongoing', 'Hearing Scheduled', 'Documents Pending', 'Under Review', 'Filed', 'Resolved'][i % 6],
    description: `Fictional practice file: ${client.briefProblem}`, documents: [],
    notes: [{ id: `showcase_v1_note_${i}`, text: 'Sample preparation note: review the supplied chronology and document checklist.', isPrivate: true, createdAt: iso(-day) }],
    createdAt: iso(-(20 + i * 4) * day)
  }));
  const appointments = clients.slice(8, 15).map((client, i) => sample({
    id: `showcase_v1_appt_${i + 1}`, clientId: client.id, clientName: client.name, caseType: client.caseCategory,
    date: iso(i * day + (45 + i * 30) * 60000), duration: 30 + i % 2 * 30,
    type: i % 2 ? 'Audio Call' : 'Video Call', status: i % 3 ? 'upcoming' : 'confirmed',
    fee: 1000 + i * 250, reminders: { h24Sent: true, m30Sent: true }
  }));
  const transactions = Array.from({ length: 36 }, (_, i) => {
    const amount = [750, 1200, 2000, 3500, 5000, 2500][i % 6];
    return sample({ id: `showcase_v1_txn_${i + 1}`, clientName: names[i % names.length],
      service: 'Sample · ' + ['Consultation', 'Document Review', 'Case Preparation', 'Court Appearance'][i % 4],
      date: iso(-Math.floor(i / 2) * day - i % 2 * 1800000), amount,
      platformFee: Math.round(amount * 0.1), netEarnings: amount - Math.round(amount * 0.1),
      paymentStatus: i % 9 < 6 ? 'completed' : i % 9 < 8 ? 'pending' : 'processing',
      paymentMethod: ['UPI', 'Card', 'Net Banking'][i % 3]
    });
  });
  const feedback = ['Clear explanation of the preparation checklist.', 'Helpful and well organised consultation.',
    'Prompt updates about the next steps.', 'The document review was explained patiently.'];
  const reviews = Array.from({ length: 14 }, (_, i) => sample({
    id: `showcase_v1_review_${i + 1}`, clientName: names[(i + 4) % names.length], rating: [5, 4, 5, 4, 5, 3, 5][i % 7],
    review: 'Fictional sample review: ' + feedback[i % feedback.length], wouldRecommend: true, date: iso(-(i + 1) * day)
  }));
  const conversations = clients.slice(0, 14).map((client, i) => {
    const messages = Array.from({ length: 12 }, (_, j) => sample({
      id: `showcase_v1_msg_${i}_${j}`, sender: j % 2 ? 'lawyer' : 'client',
      text: j % 2 ? ['Thank you. Please keep the dated records together for our sample consultation.',
        'I will review the chronology with you during the meeting.', 'The fictional case checklist is ready for discussion.'][Math.floor(j / 2) % 3]
        : topics[Math.floor(j / 2) % topics.length],
      time: iso(-((14 - i) * 12 + 12 - j) * 3600000)
    }));
    return sample({ id: `showcase_v1_conv_${i + 1}`, clientId: client.id, clientName: client.name,
      category: client.caseCategory, messages, lastMessage: messages.at(-1).text,
      lastMessageTime: messages.at(-1).time, unreadCount: i < 4 ? 2 + i % 2 : 0 });
  });
  const notifications = [
    sample({ id: 'showcase_v1_notif_1', type: 'client', title: 'Sample consultation requests', message: 'Eight fictional client enquiries are ready to explore.', read: false, time: iso(-1800000), link: '/clients' }),
    sample({ id: 'showcase_v1_notif_2', type: 'case', title: 'Sample hearing preparation', message: 'Open the sample case files to review their notes and timelines.', read: false, time: iso(-3600000), link: '/cases' })
  ];
  return { clients, cases, appointments, transactions, reviews, conversations, notifications };
}

function ensureOwnerSampleWorkspace(user, now = new Date()) {
  if (!user?.id || user.isVerified !== true || String(user.email || '').trim().toLowerCase() !== OWNER_EMAIL) return false;
  const ws = db.workspaceFor(user.id);
  if (ws.sampleDataset?.version >= VERSION) return false;
  const generated = buildSampleWorkspace(now);
  for (const [key, records] of Object.entries(generated)) {
    const existing = Array.isArray(ws[key]) ? ws[key] : [];
    const ids = new Set(existing.map(record => record.id));
    ws[key] = existing.concat(records.filter(record => !ids.has(record.id)));
  }
  ws.sampleDataset = { version: VERSION, createdAt: now.toISOString(), label: 'Private sample workspace',
    description: 'Fictional clients, messages, cases, payments and reviews for demonstration.' };
  db.save();
  return true;
}

module.exports = { buildSampleWorkspace, ensureOwnerSampleWorkspace };
