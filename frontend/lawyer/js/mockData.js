/* ============================================================
   Nyay Setu LAWYER — DEMO DATA SEEDER
   mockData.js — Injects realistic demo data for presentation.
   ── Marked with _isDemo:true so it can be identified/removed.
   ── Provides rich, authentic prototype data for client requests,
      conversations, case files, earnings & verified reviews.
   ============================================================ */

const LawyerDemoData = {
  DEMO_ACTIVE: false, // New real accounts must not receive synthetic clients or earnings.

  /** Call after Store.init() to seed demo collections */
  seed() {
    if (!this.DEMO_ACTIVE) {
      this.purge();
      return;
    }
    console.log('[DemoData] 🎯 Seeding lawyer-side demo data for presentation...');

    this._seedClients();
    this._seedCases();
    this._seedConversations();
    this._seedAppointments();
    this._seedTransactions();
    this._seedReviews();
    this._seedNotifications();
    this._seedExperience();
    this._seedCaseExperience();
    this._seedCertificates();
  },

  /* ---- Demo Clients (Accepted + Pending Requests) ---- */
  _seedClients() {
    const existing = Store.getState('clients') || [];
    if (existing.length >= 6) return;

    const clients = [
      {
        id: 'demo_client_001', clientId: 'usr_rahul_sharma',
        name: 'Rahul Sharma', email: 'rahul.sharma@gmail.com', phone: '9876543210',
        city: 'Jaipur', state: 'Rajasthan', 
        caseCategory: 'Property & Real Estate',
        briefProblem: 'Dispute over ancestral property in Malviya Nagar. Title deed shows irregularity during SDM mutation process. Need help filing civil suit for partition and permanent injunction.',
        preferredDate: this._futureDate(2).split('T')[0], preferredTime: '10:30 AM',
        consultationType: 'Video', estimatedFee: 1200,
        status: 'accepted', createdAt: this._pastDate(8), _isDemo: true,
        documents: [
          { name: 'Title Deed Copy.pdf', type: 'legal' },
          { name: 'Mutation Application.pdf', type: 'legal' },
          { name: 'Municipal Tax Receipts.pdf', type: 'financial' }
        ]
      },
      {
        id: 'demo_client_002', clientId: 'usr_priya_patel',
        name: 'Priya Patel', email: 'priya.patel@outlook.com', phone: '8765432109',
        city: 'Ahmedabad', state: 'Gujarat',
        caseCategory: 'Family & Matrimonial',
        briefProblem: 'Filing for mutual consent divorce under Section 13-B Hindu Marriage Act. Both parties agree on alimony and child custody terms. Need advocate to draft petition and represent in Family Court.',
        preferredDate: this._futureDate(4).split('T')[0], preferredTime: '2:00 PM',
        consultationType: 'Video', estimatedFee: 1500,
        status: 'accepted', createdAt: this._pastDate(5), _isDemo: true,
        documents: [
          { name: 'Marriage Certificate.pdf', type: 'legal' },
          { name: 'Mutual Agreement Draft.pdf', type: 'legal' }
        ]
      },
      {
        id: 'demo_client_003', clientId: 'usr_amit_verma',
        name: 'Amit Verma', email: 'amit.verma@yahoo.com', phone: '7654321098',
        city: 'Delhi', state: 'Delhi',
        caseCategory: 'Criminal Defense',
        briefProblem: 'Wrongfully accused in an FIR under BNS Section 316 (earlier IPC 420). Need immediate anticipatory bail application and Section 482 quashing petition in High Court. Clean background.',
        preferredDate: this._futureDate(1).split('T')[0], preferredTime: '11:00 AM',
        consultationType: 'Video', estimatedFee: 2500,
        status: 'pending', createdAt: this._pastDate(1), _isDemo: true,
        documents: [
          { name: 'FIR Copy.pdf', type: 'legal' },
          { name: 'Notice 41A.pdf', type: 'legal' }
        ]
      },
      {
        id: 'demo_client_004', clientId: 'usr_sneha_reddy',
        name: 'Sneha Reddy', email: 'sneha.r@gmail.com', phone: '9988776655',
        city: 'Hyderabad', state: 'Telangana',
        caseCategory: 'Consumer Protection',
        briefProblem: 'Online purchase of defective high-end laptop worth ₹89,000 from e-commerce seller. Seller refusing refund citing return window expired. Want to file consumer grievance under CPA 2019.',
        preferredDate: this._futureDate(3).split('T')[0], preferredTime: '3:30 PM',
        consultationType: 'Phone', estimatedFee: 900,
        status: 'pending', createdAt: this._pastDate(0), _isDemo: true,
        documents: [
          { name: 'Purchase Invoice.pdf', type: 'evidence' },
          { name: 'Defect Report.pdf', type: 'evidence' },
          { name: 'Seller Chat Logs.pdf', type: 'evidence' }
        ]
      },
      {
        id: 'demo_client_005', clientId: 'usr_vikash_singh',
        name: 'Vikash Singh', email: 'vikash.singh@live.com', phone: '9012345678',
        city: 'Lucknow', state: 'Uttar Pradesh',
        caseCategory: 'Corporate & Constitutional Law',
        briefProblem: 'Partnership firm dissolution dispute. Co-partner misappropriated ₹12 Lakhs and refuses audit. Need urgent petition in Commercial Court for asset freezing and dissolution decree.',
        preferredDate: this._futureDate(5).split('T')[0], preferredTime: '4:00 PM',
        consultationType: 'Video', estimatedFee: 3500,
        status: 'accepted', createdAt: this._pastDate(12), _isDemo: true,
        documents: [
          { name: 'Partnership Deed.pdf', type: 'legal' },
          { name: 'Bank Statements.pdf', type: 'financial' },
          { name: 'Audit Report.pdf', type: 'financial' }
        ]
      },
      {
        id: 'demo_client_006', clientId: 'usr_meena_kumari',
        name: 'Meena Kumari', email: 'meena.k@gmail.com', phone: '8899001122',
        city: 'Jodhpur', state: 'Rajasthan',
        caseCategory: 'Civil Matters',
        briefProblem: 'Landlord-tenant eviction dispute. Landlord served arbitrary eviction notice without court order after 15 years tenancy. Need stay order under Rajasthan Rent Control Act.',
        preferredDate: this._futureDate(6).split('T')[0], preferredTime: '10:00 AM',
        consultationType: 'Video', estimatedFee: 1000,
        status: 'pending', createdAt: this._pastDate(0), _isDemo: true,
        documents: [
          { name: 'Rent Agreement.pdf', type: 'legal' },
          { name: 'Eviction Notice.pdf', type: 'legal' }
        ]
      },
      {
        id: 'demo_client_007', clientId: 'usr_arunava_sen',
        name: 'Arunava Sen', email: 'arunava.sen@gmail.com', phone: '9833445566',
        city: 'Kolkata', state: 'West Bengal',
        caseCategory: 'Cyber Crime & IT Act',
        briefProblem: 'Unauthorized digital transactions totaling ₹3.4 Lakhs via SIM swapping and forged banking credentials. Need legal advisory for cyber cell escalation and bank liability claim under RBI circular.',
        preferredDate: this._futureDate(3).split('T')[0], preferredTime: '12:00 PM',
        consultationType: 'Video', estimatedFee: 2000,
        status: 'pending', createdAt: this._pastDate(1), _isDemo: true,
        documents: [
          { name: 'Cyber Complaint Acknowledgement.pdf', type: 'legal' },
          { name: 'Bank Transaction Trail.pdf', type: 'financial' }
        ]
      }
    ];
    Store.setState('clients', clients);
  },

  /* ---- Demo Client Chats (5 Rich Multi-turn Conversation Threads) ---- */
  _seedConversations() {
    const existing = Store.getState('conversations') || [];
    if (existing.length >= 5) return;

    const convs = [
      {
        id: 'conv_001',
        clientId: 'demo_client_001',
        clientName: 'Rahul Sharma',
        category: 'Property & Real Estate',
        lastMessage: 'Ji advocate sahab, latest tax receipts and mutation copy attach kar di hain.',
        lastMessageTime: this._pastDate(0),
        unreadCount: 1,
        messages: [
          { sender: 'client', text: 'Namaste Advocate Sahab. Main apne Malviya Nagar wale ancestral plot ke partition ke bare mein guidance chahta hoon.', time: this._pastDate(2) },
          { sender: 'lawyer', text: 'Namaste Rahul ji. Maine aapka SDM mutation application aur title deed review kar liya hai. Dusra paksh bina bataye sale deed execute nahi kar sakta.', time: this._pastDate(2) },
          { sender: 'client', text: 'Kya humein civil court se permanent injunction mil sakta hai agar wo unauthorized construction shuru karein?', time: this._pastDate(1) },
          { sender: 'lawyer', text: 'Haan bilkul, Order 39 Rules 1 & 2 CPC ke tehat temporary injunction petition ready hai. Hearing par hum interim stay argue karenge.', time: this._pastDate(1) },
          { sender: 'client', text: 'Ji advocate sahab, latest tax receipts and mutation copy attach kar di hain.', time: this._pastDate(0) }
        ],
        documents: [
          { name: 'Title Deed Copy.pdf', type: 'legal', uploadedAt: this._pastDate(2) },
          { name: 'Mutation Application.pdf', type: 'legal', uploadedAt: this._pastDate(2) },
          { name: 'Municipal Tax Receipts.pdf', type: 'financial', uploadedAt: this._pastDate(0) }
        ],
        _isDemo: true
      },
      {
        id: 'conv_002',
        clientId: 'demo_client_002',
        clientName: 'Priya Patel',
        category: 'Family & Matrimonial',
        lastMessage: 'Signed affidavits courier kar diye hain, tracking number shared.',
        lastMessageTime: this._pastDate(1),
        unreadCount: 0,
        messages: [
          { sender: 'client', text: 'Hello Advocate sir, Section 13-B mutual consent divorce draft mil gaya. Alimony clause clear hai.', time: this._pastDate(4) },
          { sender: 'lawyer', text: 'Hello Priya ji. Dono parties ki consent affidavit notarize karwani hogi. Family Court registry mein Monday ko file karenge.', time: this._pastDate(4) },
          { sender: 'client', text: 'Ji sir, kya 6 months cooling period waiver ki application bhi sath mein submit hogi?', time: this._pastDate(3) },
          { sender: 'lawyer', text: 'Haan, Supreme Court ke landmark Amardeep Singh judgment ke precedent par cooling waiver petition sath mein lagayi hai.', time: this._pastDate(2) },
          { sender: 'client', text: 'Signed affidavits courier kar diye hain, tracking number shared.', time: this._pastDate(1) }
        ],
        documents: [
          { name: 'Marriage Certificate.pdf', type: 'legal', uploadedAt: this._pastDate(4) },
          { name: 'Mutual Agreement Draft.pdf', type: 'legal', uploadedAt: this._pastDate(4) }
        ],
        _isDemo: true
      },
      {
        id: 'conv_003',
        clientId: 'demo_client_005',
        clientName: 'Vikash Singh',
        category: 'Corporate & Constitutional Law',
        lastMessage: 'Commercial Court hearing date update mil gayi, ready for arguments.',
        lastMessageTime: this._pastDate(1),
        unreadCount: 2,
        messages: [
          { sender: 'client', text: 'Advocate Sahab, partner ne firm ke bank account se ₹6 Lakh unauthorized transfer kar liye hain.', time: this._pastDate(5) },
          { sender: 'lawyer', text: 'Vikash ji, humne Commercial Court mein urgent interim application move ki hai account freezing aur forensic audit ke liye.', time: this._pastDate(5) },
          { sender: 'client', text: 'Kya court preliminary hearing par accounts freeze karne ka direction de sakti hai?', time: this._pastDate(2) },
          { sender: 'lawyer', text: 'Haan, prima facie misappropriation proof attached hai. Judge sahab ne notices issue kar diye hain.', time: this._pastDate(1) },
          { sender: 'client', text: 'Commercial Court hearing date update mil gayi, ready for arguments.', time: this._pastDate(1) }
        ],
        documents: [
          { name: 'Partnership Deed.pdf', type: 'legal', uploadedAt: this._pastDate(5) },
          { name: 'Audit Report.pdf', type: 'financial', uploadedAt: this._pastDate(5) },
          { name: 'Bank Statements.pdf', type: 'financial', uploadedAt: this._pastDate(3) }
        ],
        _isDemo: true
      },
      {
        id: 'conv_004',
        clientId: 'demo_client_004',
        clientName: 'Sneha Reddy',
        category: 'Consumer Protection',
        lastMessage: 'Notice draft padh liya hai, looks very solid and authoritative.',
        lastMessageTime: this._pastDate(1),
        unreadCount: 0,
        messages: [
          { sender: 'client', text: 'Sir, seller support ne replace karne se mana kar diya. Bol rahe hain unki return policy 7 din ki hi thi.', time: this._pastDate(2) },
          { sender: 'lawyer', text: 'Sneha ji, Consumer Protection (E-Commerce) Rules 2020 ke mutabiq defective product par return policy restrict nahi ki ja sakti.', time: this._pastDate(2) },
          { sender: 'lawyer', text: 'Humne 15 din ka formal Legal Demand Notice draft kar diya hai with full refund & compensation demands.', time: this._pastDate(1) },
          { sender: 'client', text: 'Notice draft padh liya hai, looks very solid and authoritative.', time: this._pastDate(1) }
        ],
        documents: [
          { name: 'Purchase Invoice.pdf', type: 'evidence', uploadedAt: this._pastDate(2) },
          { name: 'Defect Report.pdf', type: 'evidence', uploadedAt: this._pastDate(2) }
        ],
        _isDemo: true
      },
      {
        id: 'conv_005',
        clientId: 'demo_client_003',
        clientName: 'Amit Verma',
        category: 'Criminal Defense',
        lastMessage: 'FIR copy aur Section 41A notice document drawer mein upload kar diya hai.',
        lastMessageTime: this._pastDate(0),
        unreadCount: 1,
        messages: [
          { sender: 'client', text: 'Sir, police se 41A notice aaya hai BNS Section 316 case mein. Kya mujhe turant arrest kar sakte hain?', time: this._pastDate(1) },
          { sender: 'lawyer', text: 'Amit ji, Arnesh Kumar vs State of Bihar landmark judgment ke tehat bina notice compliance ke direct arrest prohibited hai. Ghabraiye mat.', time: this._pastDate(1) },
          { sender: 'lawyer', text: 'Hum kal subah Sessions Court mein Section 482 BNSS Anticipatory Bail petition submit kar rahe hain.', time: this._pastDate(0) },
          { sender: 'client', text: 'FIR copy aur Section 41A notice document drawer mein upload kar diya hai.', time: this._pastDate(0) }
        ],
        documents: [
          { name: 'FIR Copy.pdf', type: 'legal', uploadedAt: this._pastDate(1) },
          { name: 'Notice 41A.pdf', type: 'legal', uploadedAt: this._pastDate(0) }
        ],
        _isDemo: true
      }
    ];
    Store.setState('conversations', convs);
  },

  /* ---- Demo Cases (5-6 Active Case Files) ---- */
  _seedCases() {
    const existing = Store.getState('cases') || [];
    if (existing.length >= 5) return;

    const cases = [
      {
        id: 'demo_case_001', caseNumber: 'LC/2026/0001',
        clientId: 'demo_client_001', clientName: 'Rahul Sharma',
        caseType: 'Property & Real Estate', legalCategory: 'Property & Real Estate',
        court: 'District Court, Jaipur', filingDate: this._pastDate(18),
        status: 'Ongoing', nextHearing: this._futureDate(7),
        documents: [
          { name: 'Title Deed Copy.pdf', type: 'legal' },
          { name: 'Court Filing Receipt.pdf', type: 'legal' },
          { name: 'Interim Injunction Petition.pdf', type: 'legal' }
        ],
        notes: [
          { id: 'note_001', text: 'Order 39 Rules 1 & 2 application listed before Bench No. 3. Arguments prepared on possession benchmark.', isPrivate: true, createdAt: this._pastDate(4) },
          { id: 'note_002', text: 'Certified copy of ancestral mutation order received from Revenue Board.', isPrivate: true, createdAt: this._pastDate(12) }
        ],
        description: 'Property partition suit and interim stay application for ancestral plot in Malviya Nagar sector.',
        createdAt: this._pastDate(18), _isDemo: true
      },
      {
        id: 'demo_case_002', caseNumber: 'LC/2026/0002',
        clientId: 'demo_client_002', clientName: 'Priya Patel',
        caseType: 'Family & Matrimonial', legalCategory: 'Family & Matrimonial',
        court: 'Family Court, Ahmedabad', filingDate: this._pastDate(14),
        status: 'Ongoing', nextHearing: this._futureDate(14),
        documents: [
          { name: 'Marriage Certificate.pdf', type: 'legal' },
          { name: 'First Motion Joint Petition.pdf', type: 'legal' }
        ],
        notes: [
          { id: 'note_003', text: 'First Motion recorded successfully. Application for waiver of 6-month statutory waiting period drafted under Amardeep Singh precedent.', isPrivate: true, createdAt: this._pastDate(3) }
        ],
        description: 'Mutual consent divorce petition under Section 13-B, Hindu Marriage Act with settlement agreement.',
        createdAt: this._pastDate(14), _isDemo: true
      },
      {
        id: 'demo_case_003', caseNumber: 'LC/2026/0003',
        clientId: 'demo_client_005', clientName: 'Vikash Singh',
        caseType: 'Corporate & Constitutional Law', legalCategory: 'Corporate & Constitutional Law',
        court: 'Commercial Court, Lucknow', filingDate: this._pastDate(25),
        status: 'Ongoing', nextHearing: this._futureDate(21),
        documents: [
          { name: 'Partnership Deed.pdf', type: 'legal' },
          { name: 'Financial Audit Report.pdf', type: 'financial' },
          { name: 'Bank Misappropriation Trail.pdf', type: 'financial' }
        ],
        notes: [
          { id: 'note_004', text: 'Notice to respondent partner served via Dasti. Interim direction for inspection of books obtained.', isPrivate: true, createdAt: this._pastDate(8) }
        ],
        description: 'Partnership dissolution, rendering of accounts and recovery of ₹12 Lakh capital investment.',
        createdAt: this._pastDate(25), _isDemo: true
      },
      {
        id: 'demo_case_004', caseNumber: 'LC/2026/0004',
        clientId: 'demo_client_003', clientName: 'Amit Verma',
        caseType: 'Criminal Defense', legalCategory: 'Criminal Defense',
        court: 'Sessions Court, New Delhi', filingDate: this._pastDate(2),
        status: 'Ongoing', nextHearing: this._futureDate(1),
        documents: [
          { name: 'Bail Application Draft.pdf', type: 'legal' },
          { name: 'FIR Certified Copy.pdf', type: 'legal' }
        ],
        notes: [
          { id: 'note_005', text: 'Anticipatory bail petition filed under Section 482 BNSS (Section 438 CrPC). Public prosecutor served.', isPrivate: true, createdAt: this._pastDate(1) }
        ],
        description: 'Anticipatory bail petition against unjustified criminal implication in commercial dispute.',
        createdAt: this._pastDate(2), _isDemo: true
      },
      {
        id: 'demo_case_005', caseNumber: 'LC/2026/0005',
        clientId: 'demo_client_004', clientName: 'Sneha Reddy',
        caseType: 'Consumer Protection', legalCategory: 'Consumer Protection',
        court: 'District Consumer Commission, Hyderabad', filingDate: this._pastDate(10),
        status: 'Ongoing', nextHearing: this._futureDate(12),
        documents: [
          { name: 'Consumer Grievance Petition.pdf', type: 'legal' },
          { name: 'Purchase Tax Invoice.pdf', type: 'evidence' }
        ],
        notes: [
          { id: 'note_006', text: 'Consumer complaint admitted under Section 35 CPA 2019. Formal notice issued to e-commerce marketplace.', isPrivate: true, createdAt: this._pastDate(5) }
        ],
        description: 'Complaint for unfair trade practice, product liability and refund with interest.',
        createdAt: this._pastDate(10), _isDemo: true
      }
    ];
    Store.setState('cases', cases);
  },

  /* ---- Demo Appointments (Today & Upcoming Schedule) ---- */
  _seedAppointments() {
    const existing = Store.getState('appointments') || [];
    if (existing.length >= 4) return;

    const today = new Date();
    const appts = [
      {
        id: 'demo_appt_001', clientId: 'demo_client_001', clientName: 'Rahul Sharma',
        caseType: 'Property & Real Estate',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30).toISOString(),
        duration: 45, type: 'Video', status: 'confirmed', fee: 1200,
        reminders: { h24Sent: true, m30Sent: true }, caseId: 'demo_case_001', _isDemo: true
      },
      {
        id: 'demo_appt_002', clientId: 'demo_client_002', clientName: 'Priya Patel',
        caseType: 'Family & Matrimonial',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
        duration: 60, type: 'Video', status: 'confirmed', fee: 1500,
        reminders: { h24Sent: true, m30Sent: false }, caseId: 'demo_case_002', _isDemo: true
      },
      {
        id: 'demo_appt_003', clientId: 'demo_client_003', clientName: 'Amit Verma',
        caseType: 'Criminal Defense',
        date: this._futureDate(1),
        duration: 45, type: 'Video', status: 'confirmed', fee: 2500,
        reminders: { h24Sent: false, m30Sent: false }, caseId: 'demo_case_004', _isDemo: true
      },
      {
        id: 'demo_appt_004', clientId: 'demo_client_005', clientName: 'Vikash Singh',
        caseType: 'Corporate & Constitutional Law',
        date: this._futureDate(4),
        duration: 45, type: 'Video', status: 'upcoming', fee: 3500,
        reminders: { h24Sent: false, m30Sent: false }, caseId: 'demo_case_003', _isDemo: true
      }
    ];
    Store.setState('appointments', appts);
  },

  /* ---- Demo Transactions (Rich Earnings Breakdown) ---- */
  _seedTransactions() {
    const existing = Store.getState('transactions') || [];
    if (existing.length >= 8) return;

    const txns = [
      {
        id: 'demo_txn_001', clientName: 'Vikash Singh',
        service: 'Corporate Retainer & Commercial Petition', date: this._pastDate(2),
        amount: 15000, platformFee: 1500, netEarnings: 13500,
        paymentStatus: 'completed', paymentMethod: 'Razorpay / Net Banking', _isDemo: true
      },
      {
        id: 'demo_txn_002', clientName: 'Amit Verma',
        service: 'Anticipatory Bail Representation', date: this._pastDate(3),
        amount: 7500, platformFee: 750, netEarnings: 6750,
        paymentStatus: 'completed', paymentMethod: 'UPI', _isDemo: true
      },
      {
        id: 'demo_txn_003', clientName: 'Rahul Sharma',
        service: 'Civil Injunction Petition Drafting', date: this._pastDate(5),
        amount: 5500, platformFee: 550, netEarnings: 4950,
        paymentStatus: 'completed', paymentMethod: 'Razorpay', _isDemo: true
      },
      {
        id: 'demo_txn_004', clientName: 'Priya Patel',
        service: 'First Motion Joint Petition Drafting', date: this._pastDate(8),
        amount: 4500, platformFee: 450, netEarnings: 4050,
        paymentStatus: 'completed', paymentMethod: 'UPI', _isDemo: true
      },
      {
        id: 'demo_txn_005', clientName: 'Vikramaditya Rao',
        service: 'Title Verification & Legal Search Opinion', date: this._pastDate(12),
        amount: 3500, platformFee: 350, netEarnings: 3150,
        paymentStatus: 'completed', paymentMethod: 'Razorpay', _isDemo: true
      },
      {
        id: 'demo_txn_006', clientName: 'Meena Kumari',
        service: 'Eviction Stay Application Filing', date: this._pastDate(15),
        amount: 2500, platformFee: 250, netEarnings: 2250,
        paymentStatus: 'completed', paymentMethod: 'UPI', _isDemo: true
      },
      {
        id: 'demo_txn_007', clientName: 'Rahul Sharma',
        service: 'Video Consultation', date: this._pastDate(18),
        amount: 1200, platformFee: 120, netEarnings: 1080,
        paymentStatus: 'completed', paymentMethod: 'Platform', _isDemo: true
      },
      {
        id: 'demo_txn_008', clientName: 'Priya Patel',
        service: 'Video Consultation', date: this._pastDate(20),
        amount: 1500, platformFee: 150, netEarnings: 1350,
        paymentStatus: 'completed', paymentMethod: 'Platform', _isDemo: true
      },
      {
        id: 'demo_txn_009', clientName: 'Sneha Reddy',
        service: 'Consumer Legal Notice Drafting', date: this._pastDate(22),
        amount: 900, platformFee: 90, netEarnings: 810,
        paymentStatus: 'completed', paymentMethod: 'Platform', _isDemo: true
      }
    ];
    Store.setState('transactions', txns);
  },

  /* ---- Demo Reviews (8 Verified Client Feedbacks) ---- */
  _seedReviews() {
    const existing = Store.getState('reviews') || [];
    if (existing.length >= 8) return;

    const reviews = [
      {
        id: 'demo_rev_001', clientName: 'Rahul Sharma', rating: 5,
        comment: 'Excellent guidance on property dispute in Jaipur. Very thorough and professional. Explained every legal step clearly in Hindi and obtained an immediate interim injunction.',
        date: this._pastDate(2), _isDemo: true
      },
      {
        id: 'demo_rev_002', clientName: 'Vikash Singh', rating: 5,
        comment: 'Best corporate advocate I\'ve consulted. Handled our complex partnership dissolution with full fund recovery. His courtroom preparation strategy was exceptional.',
        date: this._pastDate(6), _isDemo: true
      },
      {
        id: 'demo_rev_003', clientName: 'Priya Patel', rating: 5,
        comment: 'Very empathetic, discreet, and understanding. Handled my family matter with utmost dignity and got our mutual consent cooling period waiver allowed in record time.',
        date: this._pastDate(9), _isDemo: true
      },
      {
        id: 'demo_rev_004', clientName: 'Anita Desai', rating: 5,
        comment: 'The Nyay Setu AI research assistant and 3D virtual courtroom preparation feature were game changers. Advocate was exceptionally prepared for every objection.',
        date: this._pastDate(14), _isDemo: true
      },
      {
        id: 'demo_rev_005', clientName: 'Rajesh Kumar', rating: 5,
        comment: 'Fought my consumer grievance against an e-commerce giant and got complete refund plus compensation. Commendable knowledge of CPA 2019.',
        date: this._pastDate(20), _isDemo: true
      },
      {
        id: 'demo_rev_006', clientName: 'Amit Verma', rating: 5,
        comment: 'Saved me from wrongful arrest by getting prompt anticipatory bail under the new BNS provisions. Very honest and responsive counsel.',
        date: this._pastDate(25), _isDemo: true
      },
      {
        id: 'demo_rev_007', clientName: 'Sunita Agarwal', rating: 4,
        comment: 'Very punctual and transparent with fees. The virtual courtroom rehearsal made me feel confident before going to court.',
        date: this._pastDate(32), _isDemo: true
      },
      {
        id: 'demo_rev_008', clientName: 'Deepak Malhotra', rating: 5,
        comment: 'Brilliant civil advocate. Property title search and draftsmanship are top notch. Highly recommended for commercial contracts.',
        date: this._pastDate(40), _isDemo: true
      }
    ];
    Store.setState('reviews', reviews);
  },

  /* ---- Demo Notifications ---- */
  _seedNotifications() {
    const existing = Store.getState('notifications') || [];
    if (existing.length >= 7) return;

    const notifs = [
      {
        id: 'demo_notif_001', type: 'client', title: 'New Consultation Request',
        message: 'Amit Verma has requested an urgent video consultation for a Criminal Defense matter under BNS 316.',
        read: false, link: '/clients', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_002', type: 'client', title: 'New Consultation Request',
        message: 'Sneha Reddy wants a phone consultation regarding Consumer Protection against Amazon.',
        read: false, link: '/clients', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_003', type: 'client', title: 'New Consultation Request',
        message: 'Arunava Sen requested an advisory consultation regarding cyber identity theft & unauthorized transactions.',
        read: false, link: '/clients', time: this._pastDate(1), _isDemo: true
      },
      {
        id: 'demo_notif_004', type: 'appointment', title: 'Appointment Today',
        message: 'Rahul Sharma — Video consultation scheduled for 10:30 AM for Property & Real Estate suit.',
        read: false, link: '/consultation', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_005', type: 'payment', title: 'Payment Received',
        message: '₹15,000 received from Vikash Singh for Corporate Retainer. Net earnings: ₹13,500.',
        read: true, link: '/payments', time: this._pastDate(2), _isDemo: true
      },
      {
        id: 'demo_notif_006', type: 'case', title: 'Upcoming Hearing Reminder',
        message: 'Rahul Sharma\'s property dispute hearing is listed in 7 days before Bench No. 3 at District Court, Jaipur.',
        read: true, link: '/cases', time: this._pastDate(1), _isDemo: true
      },
      {
        id: 'demo_notif_007', type: 'review', title: 'New Verified Review',
        message: 'Vikash Singh rated you ★★★★★ (5.0) — "Best corporate advocate I\'ve consulted."',
        read: true, link: '/reviews', time: this._pastDate(6), _isDemo: true
      }
    ];
    Store.setState('notifications', notifs);
  },

  /* ---- Demo Experience (Profile) ---- */
  _seedExperience() {
    if ((Store.getState('experience') || []).length > 0) return;
    Store.setState('experience', [
      { id: 'exp_001', title: 'Senior Associate Counsel', firm: 'Khaitan & Partners LLP', period: '2020 – Present', _isDemo: true },
      { id: 'exp_002', title: 'Associate Advocate', firm: 'Rajasthan High Court Bar Association', period: '2016 – 2020', _isDemo: true },
      { id: 'exp_003', title: 'Junior Counsel', firm: 'District & Sessions Court, Jaipur', period: '2014 – 2016', _isDemo: true }
    ]);
  },

  /* ---- Demo Case Experience (Profile) ---- */
  _seedCaseExperience() {
    if ((Store.getState('caseExperience') || []).length > 0) return;
    Store.setState('caseExperience', [
      { id: 'caseexp_001', title: 'State of Rajasthan vs. Ramesh Kumar', outcome: 'Acquittal granted under Section 482', court: 'Rajasthan High Court', year: 2024, _isDemo: true },
      { id: 'caseexp_002', title: 'ABC Builders vs. Homebuyers Association', outcome: 'Full refund + ₹5L compensation', court: 'NCDRC', year: 2023, _isDemo: true },
      { id: 'caseexp_003', title: 'Sharma Family Partition Suit', outcome: 'Equitable partition decree and interim injunction', court: 'District Court, Jaipur', year: 2022, _isDemo: true }
    ]);
  },

  /* ---- Demo Certificates ---- */
  _seedCertificates() {
    if ((Store.getState('certificates') || []).length > 0) return;
    Store.setState('certificates', [
      { id: 'cert_001', title: 'Advanced Commercial Mediation & Arbitration', issuer: 'Indian Institute of Arbitration & Mediation', year: 2023, _isDemo: true },
      { id: 'cert_002', title: 'Cyber Law, Data Protection & IT Act Certification', issuer: 'National Law University, Delhi', year: 2022, _isDemo: true }
    ]);
  },

  /* ---- Helpers ---- */
  _futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  },
  _pastDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  },

  /** Remove all demo data */
  purge() {
    console.log('[DemoData] 🧹 Purging all lawyer demo data...');
    ['clients', 'cases', 'conversations', 'appointments', 'transactions', 'reviews', 'notifications',
     'experience', 'caseExperience', 'certificates'].forEach(key => {
      const items = Store.getState(key) || [];
      if (Array.isArray(items)) {
        Store.setState(key, items.filter(i => !i._isDemo));
      }
    });
    console.log('[DemoData] ✅ Lawyer demo data purged.');
  }
};
