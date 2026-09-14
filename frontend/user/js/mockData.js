/* ============================================================
   Nyay Setu USER — DEMO DATA SEEDER
   mockData.js — Injects realistic demo data for presentation.
   ── Marked with _isDemo:true so it can be identified/removed.
   ── Only seeds if the store collections are empty.
   ============================================================ */

const UserDemoData = {
  DEMO_ACTIVE: false, // ← Set to false: cleans synthetic data for live production use

  /** Call after UserStore.init() to seed empty collections */
  seed() {
    if (!this.DEMO_ACTIVE) {
      this.purge();
      return;
    }
    console.log('[DemoData] 🎯 Seeding user-side demo data for presentation...');

    this._seedCases();
    this._seedConsultations();
    this._seedNotifications();
    this._seedMyLawyer();
    this._seedDocuments();
  },

  /* ---- Demo Cases ---- */
  _seedCases() {
    if ((UserStore.getCases() || []).length > 0) return;
    const cases = [
      {
        id: 'demo_case_001', title: 'Property Dispute — Malviya Nagar Plot',
        type: 'Property & Real Estate', court: 'District Court, Jaipur', 
        location: 'Jaipur', status: 'ongoing',
        description: 'Dispute regarding ownership of ancestral property in Malviya Nagar sector. Title deed irregularity found during mutation process.',
        nextHearing: { date: this._futureDate(7), time: '10:30 AM', court: 'District Court, Jaipur', purpose: 'Hearing on Interim Relief Application' },
        documents: [
          { name: 'Title Deed Copy.pdf', type: 'document', uploadedAt: new Date().toISOString() },
          { name: 'Mutation Application.pdf', type: 'document', uploadedAt: new Date().toISOString() }
        ],
        createdAt: this._pastDate(45),
        _isDemo: true
      },
      {
        id: 'demo_case_002', title: 'Consumer Complaint — E-Commerce Refund',
        type: 'Consumer Protection', court: 'Consumer Forum, Jaipur',
        location: 'Jaipur', status: 'ongoing',
        description: 'Filed complaint against Flipkart for non-refund of ₹47,500 for defective laptop delivered. NCDRC guidelines applicable.',
        nextHearing: { date: this._futureDate(14), time: '11:00 AM', court: 'Consumer Forum, Jaipur', purpose: 'Evidence Submission' },
        documents: [
          { name: 'Purchase Invoice.pdf', type: 'document', uploadedAt: new Date().toISOString() },
          { name: 'Complaint Letter.pdf', type: 'document', uploadedAt: new Date().toISOString() }
        ],
        createdAt: this._pastDate(20),
        _isDemo: true
      }
    ];
    UserStore.set('cases', cases);
  },

  /* ---- Demo Consultations ---- */
  _seedConsultations() {
    if ((UserStore.getConsultations() || []).length > 0) return;
    const consultations = [
      {
        id: 'demo_cst_001', lawyerId: 'law_adv_priya',
        lawyerName: 'Adv. Priya Deshmukh', specialization: 'Property & Real Estate Law',
        date: this._pastDate(5), time: '11:00 AM', mode: 'video',
        status: 'completed', fee: 900, total: 972,
        notes: 'Discussed title deed verification process and mutation timeline.',
        _isDemo: true
      },
      {
        id: 'demo_cst_002', lawyerId: 'law_adv_padam',
        lawyerName: 'Adv. Padam Kishore', specialization: 'Corporate & Constitutional Law',
        date: this._futureDate(3), time: '2:00 PM', mode: 'video',
        status: 'confirmed', fee: 1200, total: 1296,
        notes: 'Upcoming consultation for corporate agreement review.',
        _isDemo: true
      },
      {
        id: 'demo_cst_003', lawyerId: 'law_adv_ananya',
        lawyerName: 'Adv. Ananya Sengupta', specialization: 'Family, Matrimonial & Child Custody',
        date: this._pastDate(15), time: '3:30 PM', mode: 'phone',
        status: 'completed', fee: 750, total: 810,
        notes: 'Initial case assessment for matrimonial settlement discussion.',
        _isDemo: true
      }
    ];
    UserStore.set('consultations', consultations);
  },

  /* ---- Demo Notifications ---- */
  _seedNotifications() {
    if ((UserStore.getNotifications() || []).length > 0) return;
    const notifications = [
      {
        id: 'demo_notif_001', type: 'hearing', read: false,
        text: 'Hearing scheduled for your Property Dispute case on ' + new Date(this._futureDate(7)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        time: this._pastDate(1), _isDemo: true
      },
      {
        id: 'demo_notif_002', type: 'lawyer', read: false,
        text: 'Adv. Padam Kishore confirmed your consultation for ' + new Date(this._futureDate(3)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        time: this._pastDate(2), _isDemo: true
      },
      {
        id: 'demo_notif_003', type: 'document', read: true,
        text: 'Your Title Deed Copy has been reviewed and verified by your advocate.',
        time: this._pastDate(4), _isDemo: true
      },
      {
        id: 'demo_notif_004', type: 'payment', read: true,
        text: 'Payment of ₹972 confirmed for consultation with Adv. Priya Deshmukh.',
        time: this._pastDate(5), _isDemo: true
      },
      {
        id: 'demo_notif_005', type: 'security', read: true,
        text: 'Your profile has been verified successfully. You can now book consultations.',
        time: this._pastDate(10), _isDemo: true
      }
    ];
    UserStore.set('notifications', notifications);
  },

  /* ---- Demo Lawyer (assigned) ---- */
  _seedMyLawyer() {
    if (UserStore.getLawyer()) return;
    UserStore.set('myLawyer', {
      id: 'law_adv_priya',
      name: 'Adv. Priya Deshmukh',
      specialization: 'Property & Real Estate Law',
      experience: '14 Years',
      rating: 4.95,
      verified: true,
      city: 'Mumbai',
      available: true,
      _isDemo: true
    });
  },

  /* ---- Demo Documents ---- */
  _seedDocuments() {
    if ((UserStore.getDocuments() || []).length > 0) return;
    const documents = [
      { id: 'demo_doc_001', name: 'Aadhaar Card (Verified).pdf', type: 'identity', uploadedAt: this._pastDate(30), status: 'verified', _isDemo: true },
      { id: 'demo_doc_002', name: 'Property Title Deed.pdf', type: 'case', uploadedAt: this._pastDate(20), status: 'under_review', _isDemo: true },
      { id: 'demo_doc_003', name: 'Court Summons Copy.pdf', type: 'case', uploadedAt: this._pastDate(10), status: 'verified', _isDemo: true },
      { id: 'demo_doc_004', name: 'Power of Attorney Draft.pdf', type: 'legal', uploadedAt: this._pastDate(5), status: 'pending', _isDemo: true }
    ];
    UserStore.set('documents', documents);
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
    console.log('[DemoData] 🧹 Purging all user demo data...');
    ['cases', 'consultations', 'notifications', 'documents'].forEach(key => {
      const items = UserStore.get(key) || [];
      if (Array.isArray(items)) {
        UserStore.set(key, items.filter(i => !i._isDemo));
      }
    });
    // Purge old synthetic chat history so user starts completely fresh
    const convs = UserStore.get('conversations') || [];
    const hasStaleConv = convs.some(c => c.messages && c.messages.some(m => m.text && (m.text.includes('shhhh') || m.text.includes('relates directly to property'))));
    if (hasStaleConv) {
      UserStore.set('conversations', []);
    }
    const myLawyer = UserStore.getLawyer();
    if (myLawyer && myLawyer._isDemo) UserStore.set('myLawyer', null);
    console.log('[DemoData] ✅ User demo data purged.');
  }
};
