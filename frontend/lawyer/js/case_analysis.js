/* ============================================================
   Nyay Setu — AI CASE ANALYSIS ENGINE
   case_analysis.js — Dynamic AI legal analysis simulator
   ============================================================ */

const CaseAnalysisEngine = {
  generateAnalysis(problemDescription, category = 'Civil Law') {
    const analysisTemplates = {
      'Property Dispute': {
        legalCategory: 'Property & Real Estate Law (Transfer of Property Act, 1882)',
        keyFacts: [
          'Possession claim disputed without registered deed verification',
          'Ancestral rights asserted against oral family partition',
          'Notice of eviction or encroachment threatened'
        ],
        relevantTopics: ['Section 54 (Sale)', 'Specific Relief Act (Injunction)', 'Indian Succession Act'],
        missingDocuments: [
          'Encumbrance Certificate (Last 30 years)',
          'Mutation Records / Jamabandi',
          'Original Partition Deed or Will if applicable'
        ],
        suggestedQuestions: [
          'Is the property currently under active physical possession by the client?',
          'Was any settlement or registered partition deed ever executed between parties?',
          'Are electricity/water and municipal tax receipts regularly paid under client name?'
        ],
        urgency: 'Medium — Injunction filing recommended within 15 days'
      },
      'Criminal Defense': {
        legalCategory: 'Criminal Defense (Code of Criminal Procedure / IPC / BNS)',
        keyFacts: [
          'Allegations under cognizable offenses requiring immediate defense strategy',
          'Apprehension of custodial interrogation or formal chargesheet',
          'Alibi or lack of direct corroborating witness evidence'
        ],
        relevantTopics: ['Section 438 CrPC (Anticipatory Bail)', 'Section 482 (Quashing of FIR)', 'Right to Fair Investigation'],
        missingDocuments: [
          'Certified Copy of FIR / Complaint',
          'Remand Application / Station Diary Extract',
          'Medical examination reports (if bodily injury involved)'
        ],
        suggestedQuestions: [
          'Has an FIR been formally registered at the local police station?',
          'Have notice under Section 41A CrPC been served on the accused?',
          'Is there any CCTV, digital trail, or CDR logs supporting defense alibi?'
        ],
        urgency: 'High — Immediate Anticipatory Bail Application recommended'
      }
    };

    const fallback = {
      legalCategory: `${category} (Under Relevant Indian Statutes)`,
      keyFacts: [
        'Client has presented legal conflict requiring prima-facie evaluation',
        'Preliminary grievance indicates grounds for civil or statutory remedy',
        'Direct parties involved with documented paper trail'
      ],
      relevantTopics: ['Section 73 (Contract Act)', 'Civil Procedure Code', 'Statutory Remedies'],
      missingDocuments: ['Original Agreements / Written correspondence', 'Payment vouchers / Bank receipts', 'Government ID verification'],
      suggestedQuestions: [
        'When did the cause of action first arise?',
        'Was any formal legal notice served prior to approaching counsel?',
        'What specific legal relief is sought (damages, injunction, specific performance)?'
      ],
      urgency: 'Normal — Scheduled for standard initial consultation'
    };

    return analysisTemplates[category] || fallback;
  }
};
