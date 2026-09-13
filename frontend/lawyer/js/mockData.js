/* ============================================================
   Nyay Setu LAWYER — DEMO DATA SEEDER
   mockData.js — Injects realistic demo data for presentation.
   ── Marked with _isDemo:true so it can be identified/removed.
   ── Only seeds if the store collections are empty.
   ============================================================ */

const LawyerDemoData = {
  DEMO_ACTIVE: true, // ← Flip to false to disable all demo data

  /** Call after Store.init() to seed empty collections */
  seed() {
    if (!this.DEMO_ACTIVE) return;
    console.log('[DemoData] 🎯 Seeding lawyer-side demo data for presentation...');

    this._seedClients();
    this._seedCases();
    this._seedAppointments();
    this._seedTransactions();
    this._seedReviews();
    this._seedNotifications();
    this._seedExperience();
    this._seedCaseExperience();
    this._seedCertificates();
  },

  /* ---- Demo Clients (Accepted + Pending) ---- */
  _seedClients() {
    if ((Store.getState('clients') || []).length > 0) return;
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
          { name: 'Mutation Application.pdf', type: 'legal' }
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
        briefProblem: 'Wrongfully accused in an FIR under IPC Section 420 (now BNS Section 316). Need immediate bail application and quashing petition in High Court. No prior criminal record.',
        preferredDate: this._futureDate(1).split('T')[0], preferredTime: '11:00 AM',
        consultationType: 'Video', estimatedFee: 2000,
        status: 'pending', createdAt: this._pastDate(1), _isDemo: true,
        documents: [
          { name: 'FIR Copy.pdf', type: 'legal' }
        ]
      },
      {
        id: 'demo_client_004', clientId: 'usr_sneha_reddy',
        name: 'Sneha Reddy', email: 'sneha.r@gmail.com', phone: '9988776655',
        city: 'Hyderabad', state: 'Telangana',
        caseCategory: 'Consumer Protection',
        briefProblem: 'Online purchase of laptop worth ₹89,000 from Amazon. Received defective product. Company refusing refund citing "no return" policy. Want to file consumer complaint under CPA 2019.',
        preferredDate: this._futureDate(3).split('T')[0], preferredTime: '3:30 PM',
        consultationType: 'Phone', estimatedFee: 900,
        status: 'pending', createdAt: this._pastDate(0), _isDemo: true,
        documents: [
          { name: 'Purchase Invoice.pdf', type: 'evidence' },
          { name: 'Complaint Screenshots.pdf', type: 'evidence' }
        ]
      },
      {
        id: 'demo_client_005', clientId: 'usr_vikash_singh',
        name: 'Vikash Singh', email: 'vikash.singh@live.com', phone: '9012345678',
        city: 'Lucknow', state: 'Uttar Pradesh',
        caseCategory: 'Corporate & Constitutional Law',
        briefProblem: 'Partnership firm dissolution dispute. Co-partner misappropriating funds and refusing to settle accounts. Need legal action for recovery of ₹12 lakh investment and dissolution decree.',
        preferredDate: this._futureDate(5).split('T')[0], preferredTime: '4:00 PM',
        consultationType: 'Video', estimatedFee: 1800,
        status: 'accepted', createdAt: this._pastDate(12), _isDemo: true,
        documents: [
          { name: 'Partnership Deed.pdf', type: 'legal' },
          { name: 'Bank Statements.pdf', type: 'financial' },
          { name: 'Notice to Partner.pdf', type: 'legal' }
        ]
      },
      {
        id: 'demo_client_006', clientId: 'usr_meena_kumari',
        name: 'Meena Kumari', email: 'meena.k@gmail.com', phone: '8899001122',
        city: 'Jodhpur', state: 'Rajasthan',
        caseCategory: 'Civil Matters',
        briefProblem: 'Landlord-tenant eviction dispute. Landlord served illegal eviction notice without court order. Tenant for 15 years. Need stay order and protection under Rajasthan Rent Control Act.',
        preferredDate: this._futureDate(6).split('T')[0], preferredTime: '10:00 AM',
        consultationType: 'Video', estimatedFee: 1000,
        status: 'pending', createdAt: this._pastDate(0), _isDemo: true,
        documents: [
          { name: 'Rent Agreement.pdf', type: 'legal' },
          { name: 'Eviction Notice.pdf', type: 'legal' }
        ]
      }
    ];
    Store.setState('clients', clients);
  },

  /* ---- Demo Cases ---- */
  _seedCases() {
    if ((Store.getState('cases') || []).length > 0) return;
    const cases = [
      {
        id: 'demo_case_001', caseNumber: 'LC/2026/0001',
        clientId: 'demo_client_001', clientName: 'Rahul Sharma',
        caseType: 'Property & Real Estate', legalCategory: 'Property & Real Estate',
        court: 'District Court, Jaipur', filingDate: this._pastDate(8),
        status: 'Ongoing', nextHearing: this._futureDate(7),
        documents: [
          { name: 'Title Deed Copy.pdf', type: 'legal' },
          { name: 'Court Filing Receipt.pdf', type: 'legal' }
        ],
        notes: [
          { id: 'note_001', text: 'Client informed about interim relief timeline. Mutation dispute needs SDM order review.', isPrivate: true, createdAt: this._pastDate(6) },
          { id: 'note_002', text: 'Case file opened automatically when the consultation request was accepted.', isPrivate: true, createdAt: this._pastDate(8) }
        ],
        description: 'Property partition suit for ancestral plot in Malviya Nagar.',
        createdAt: this._pastDate(8), _isDemo: true
      },
      {
        id: 'demo_case_002', caseNumber: 'LC/2026/0002',
        clientId: 'demo_client_002', clientName: 'Priya Patel',
        caseType: 'Family & Matrimonial', legalCategory: 'Family & Matrimonial',
        court: 'Family Court, Ahmedabad', filingDate: this._pastDate(5),
        status: 'Documents Pending', nextHearing: this._futureDate(14),
        documents: [
          { name: 'Marriage Certificate.pdf', type: 'legal' }
        ],
        notes: [
          { id: 'note_003', text: 'Mutual consent petition draft shared with both parties. Awaiting signed copies.', isPrivate: true, createdAt: this._pastDate(3) }
        ],
        description: 'Mutual consent divorce petition under Section 13-B, Hindu Marriage Act.',
        createdAt: this._pastDate(5), _isDemo: true
      },
      {
        id: 'demo_case_003', caseNumber: 'LC/2026/0003',
        clientId: 'demo_client_005', clientName: 'Vikash Singh',
        caseType: 'Corporate & Constitutional Law', legalCategory: 'Corporate & Constitutional Law',
        court: 'Commercial Court, Lucknow', filingDate: this._pastDate(12),
        status: 'Ongoing', nextHearing: this._futureDate(21),
        documents: [
          { name: 'Partnership Deed.pdf', type: 'legal' },
          { name: 'Financial Audit Report.pdf', type: 'financial' }
        ],
        notes: [
          { id: 'note_004', text: 'Recovery suit filed. Interim application for account freezing submitted.', isPrivate: true, createdAt: this._pastDate(10) }
        ],
        description: 'Partnership dissolution and fund recovery suit.',
        createdAt: this._pastDate(12), _isDemo: true
      }
    ];
    Store.setState('cases', cases);
  },

  /* ---- Demo Appointments ---- */
  _seedAppointments() {
    if ((Store.getState('appointments') || []).length > 0) return;
    const today = new Date();
    const appts = [
      {
        id: 'demo_appt_001', clientId: 'demo_client_001', clientName: 'Rahul Sharma',
        caseType: 'Property & Real Estate',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30).toISOString(),
        duration: 45, type: 'Video', status: 'confirmed', fee: 1200,
        reminders: { h24Sent: true, m30Sent: false }, caseId: 'demo_case_001', _isDemo: true
      },
      {
        id: 'demo_appt_002', clientId: 'demo_client_002', clientName: 'Priya Patel',
        caseType: 'Family & Matrimonial',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
        duration: 60, type: 'Video', status: 'confirmed', fee: 1500,
        reminders: { h24Sent: true, m30Sent: false }, caseId: 'demo_case_002', _isDemo: true
      },
      {
        id: 'demo_appt_003', clientId: 'demo_client_005', clientName: 'Vikash Singh',
        caseType: 'Corporate & Constitutional Law',
        date: this._futureDate(2),
        duration: 45, type: 'Video', status: 'upcoming', fee: 1800,
        reminders: { h24Sent: false, m30Sent: false }, caseId: 'demo_case_003', _isDemo: true
      }
    ];
    Store.setState('appointments', appts);
  },

  /* ---- Demo Transactions ---- */
  _seedTransactions() {
    if ((Store.getState('transactions') || []).length > 0) return;
    const txns = [
      {
        id: 'demo_txn_001', clientName: 'Rahul Sharma',
        service: 'Video Consultation', date: this._pastDate(2),
        amount: 1200, platformFee: 120, netEarnings: 1080,
        paymentStatus: 'completed', paymentMethod: 'Razorpay', _isDemo: true
      },
      {
        id: 'demo_txn_002', clientName: 'Priya Patel',
        service: 'Video Consultation', date: this._pastDate(5),
        amount: 1500, platformFee: 150, netEarnings: 1350,
        paymentStatus: 'completed', paymentMethod: 'Razorpay', _isDemo: true
      },
      {
        id: 'demo_txn_003', clientName: 'Vikash Singh',
        service: 'Video Consultation + Case Filing', date: this._pastDate(10),
        amount: 6800, platformFee: 680, netEarnings: 6120,
        paymentStatus: 'completed', paymentMethod: 'UPI', _isDemo: true
      },
      {
        id: 'demo_txn_004', clientName: 'Rahul Sharma',
        service: 'Document Review', date: this._pastDate(15),
        amount: 750, platformFee: 75, netEarnings: 675,
        paymentStatus: 'completed', paymentMethod: 'Platform', _isDemo: true
      },
      {
        id: 'demo_txn_005', clientName: 'Sneha Reddy',
        service: 'Phone Consultation', date: this._futureDate(3),
        amount: 900, platformFee: 90, netEarnings: 810,
        paymentStatus: 'pending', paymentMethod: 'Platform', _isDemo: true
      }
    ];
    Store.setState('transactions', txns);
  },

  /* ---- Demo Reviews ---- */
  _seedReviews() {
    if ((Store.getState('reviews') || []).length > 0) return;
    const reviews = [
      {
        id: 'demo_rev_001', clientName: 'Rahul Sharma', rating: 5,
        comment: 'Excellent guidance on property dispute. Very thorough and professional. Explained every legal step clearly in Hindi.',
        date: this._pastDate(3), _isDemo: true
      },
      {
        id: 'demo_rev_002', clientName: 'Vikash Singh', rating: 5,
        comment: 'Best corporate lawyer I\'ve consulted. Got my partnership dissolved with full fund recovery. Highly recommended!',
        date: this._pastDate(8), _isDemo: true
      },
      {
        id: 'demo_rev_003', clientName: 'Priya Patel', rating: 4,
        comment: 'Very empathetic and understanding. Handled my family matter with utmost confidentiality. Quick response time.',
        date: this._pastDate(10), _isDemo: true
      },
      {
        id: 'demo_rev_004', clientName: 'Anita Desai', rating: 5,
        comment: 'The AI case analysis feature before the consultation was amazing. Saved a lot of time. Advocate was well-prepared.',
        date: this._pastDate(20), _isDemo: true
      },
      {
        id: 'demo_rev_005', clientName: 'Rajesh Kumar', rating: 5,
        comment: 'Fought my consumer complaint and got full refund + compensation. Very knowledgeable about Consumer Protection Act 2019.',
        date: this._pastDate(30), _isDemo: true
      },
      {
        id: 'demo_rev_006', clientName: 'Sunita Agarwal', rating: 4,
        comment: 'Professional and punctual. The virtual courtroom practice session really helped me prepare for the hearing.',
        date: this._pastDate(45), _isDemo: true
      }
    ];
    Store.setState('reviews', reviews);
  },

  /* ---- Demo Notifications ---- */
  _seedNotifications() {
    if ((Store.getState('notifications') || []).length > 0) return;
    const notifs = [
      {
        id: 'demo_notif_001', type: 'client', title: 'New Consultation Request',
        message: 'Amit Verma has requested an urgent video consultation for a Criminal Defense matter. Review the case details.',
        read: false, link: '/clients', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_002', type: 'client', title: 'New Consultation Request',
        message: 'Sneha Reddy wants a phone consultation for a Consumer Protection complaint against Amazon.',
        read: false, link: '/clients', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_003', type: 'client', title: 'New Consultation Request',
        message: 'Meena Kumari from Jodhpur needs help with an eviction dispute. Landlord served illegal notice.',
        read: false, link: '/clients', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_004', type: 'appointment', title: 'Appointment Today',
        message: 'Rahul Sharma — Video consultation at 10:30 AM for Property & Real Estate case.',
        read: false, link: '/consultation', time: this._pastDate(0), _isDemo: true
      },
      {
        id: 'demo_notif_005', type: 'payment', title: 'Payment Received',
        message: '₹1,200 received from Rahul Sharma for Video Consultation. Net earnings: ₹1,080.',
        read: true, link: '/payments', time: this._pastDate(2), _isDemo: true
      },
      {
        id: 'demo_notif_006', type: 'case', title: 'Hearing Reminder',
        message: 'Rahul Sharma\'s property dispute hearing is scheduled in 7 days at District Court, Jaipur.',
        read: true, link: '/cases', time: this._pastDate(1), _isDemo: true
      },
      {
        id: 'demo_notif_007', type: 'review', title: 'New Client Review',
        message: 'Vikash Singh gave you ★★★★★ (5.0) — "Best corporate lawyer I\'ve consulted."',
        read: true, link: '/reviews', time: this._pastDate(8), _isDemo: true
      }
    ];
    Store.setState('notifications', notifs);
  },

  /* ---- Demo Experience (Profile) ---- */
  _seedExperience() {
    if ((Store.getState('experience') || []).length > 0) return;
    Store.setState('experience', [
      { id: 'exp_001', title: 'Senior Associate', firm: 'Khaitan & Partners LLP', period: '2020 – Present', _isDemo: true },
      { id: 'exp_002', title: 'Associate Advocate', firm: 'Rajasthan High Court', period: '2016 – 2020', _isDemo: true },
      { id: 'exp_003', title: 'Junior Counsel', firm: 'District & Sessions Court, Jaipur', period: '2014 – 2016', _isDemo: true }
    ]);
  },

  /* ---- Demo Case Experience (Profile) ---- */
  _seedCaseExperience() {
    if ((Store.getState('caseExperience') || []).length > 0) return;
    Store.setState('caseExperience', [
      { id: 'caseexp_001', title: 'State of Rajasthan vs. Ramesh Kumar', outcome: 'Acquittal granted', court: 'Rajasthan High Court', year: 2024, _isDemo: true },
      { id: 'caseexp_002', title: 'ABC Builders vs. Homebuyers Association', outcome: 'Full refund + ₹5L compensation', court: 'NCDRC', year: 2023, _isDemo: true },
      { id: 'caseexp_003', title: 'Sharma Family Partition Suit', outcome: 'Equitable partition decree', court: 'District Court, Jaipur', year: 2022, _isDemo: true }
    ]);
  },

  /* ---- Demo Certificates ---- */
  _seedCertificates() {
    if ((Store.getState('certificates') || []).length > 0) return;
    Store.setState('certificates', [
      { id: 'cert_001', title: 'Advanced Mediation & Arbitration', issuer: 'Indian Institute of Arbitration & Mediation', year: 2023, _isDemo: true },
      { id: 'cert_002', title: 'Cyber Law & IT Act Certification', issuer: 'National Law University, Delhi', year: 2022, _isDemo: true }
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
    ['clients', 'cases', 'appointments', 'transactions', 'reviews', 'notifications',
     'experience', 'caseExperience', 'certificates'].forEach(key => {
      const items = Store.getState(key) || [];
      if (Array.isArray(items)) {
        Store.setState(key, items.filter(i => !i._isDemo));
      }
    });
    console.log('[DemoData] ✅ Lawyer demo data purged.');
  }
};
