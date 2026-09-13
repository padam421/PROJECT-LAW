/* ============================================================
   Nyay Setu — API CLIENT
   api_client.js — Authenticated bridge between the SPA and the
   Nyay Setu API. Workspace mutations flow through Store
   (auto-synced server-side); credential/verification actions
   hit dedicated endpoints.
   ============================================================ */

const ApiClient = {
  apiUrl(endpoint) {
    return window.AuthManager ? AuthManager.getApiUrl(endpoint) : endpoint;
  },

  /**
   * Authentication rides on the HttpOnly session cookie issued by
   * /api/auth/otp/verify — fetch() sends it automatically for
   * same-origin requests. No tokens in JS-readable storage or URLs.
   */
  headers() {
    return {};
  },

  /** Central 401 guard — expired/terminated sessions bounce to login. */
  handleAuthFailure(res) {
    if (res && res.status === 401) {
      AuthManager.clearSession();
      window.location.hash = '#/login';
      Utils.showToast('Your session ended. Please sign in again.', 'warning');
      return true;
    }
    return false;
  },

  delay(ms = 250) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /* --------------------------------------------------------
     BAR COUNCIL REGISTRY CHECK (internal simulation, honestly labelled)
     -------------------------------------------------------- */
  async lookupBarCouncil(barNumber, stateCouncil) {
    await this.delay(700);
    try {
      const res = await fetch(this.apiUrl('/api/lawyer/verification/bar-lookup'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...this.headers() },
        body: JSON.stringify({ barNumber, stateCouncil })
      });
      const data = await res.json();
      if (!res.ok) return { status: 'error', message: data.error || 'Lookup failed.' };
      // Map backend outcome → UI states
      switch (data.outcome) {
        case 'verified':
          return { status: 'verified', message: 'Registry match confirmed.' };
        case 'manual_verification_required':
          return {
            status: 'manual_review',
            message: data.reason,
            checks: data.checks,
            source: data.source
          };
        case 'information_mismatch':
          return { status: 'mismatch', message: data.reason };
        default:
          return { status: 'unable', message: data.reason || 'Unable to verify right now.' };
      }
    } catch (_e) {
      return { status: 'error', message: 'Network error during registry lookup.' };
    }
  },

  /* --------------------------------------------------------
     CREDENTIAL DOCUMENTS (real uploads, honest review states)
     -------------------------------------------------------- */
  async uploadDocument(file, category, label) {
    const form = new FormData();
    form.append('document', file);
    form.append('category', category || 'other');
    form.append('label', label || file.name);
    const res = await fetch(this.apiUrl('/api/lawyer/documents/upload'), {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
      body: form
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data.document;
  },

  async listDocuments() {
    const res = await fetch(this.apiUrl('/api/lawyer/documents'), { credentials: 'include', headers: this.headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  },

  documentDownloadUrl(docId) {
    // The session cookie authorizes the download — no token in the URL.
    return this.apiUrl(`/api/lawyer/documents/${docId}/download`);
  },

  async deleteDocument(docId) {
    const res = await fetch(this.apiUrl(`/api/lawyer/documents/${docId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: this.headers()
    });
    return res.ok;
  },

  /* --------------------------------------------------------
     IDENTITY / LIVENESS SUBMISSION (structured, manual review)
     -------------------------------------------------------- */
  async submitIdentityCheck(selfieCaptured, idDocSubmitted) {
    await this.delay(600);
    const res = await fetch(this.apiUrl('/api/lawyer/identity-check'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...this.headers() },
      body: JSON.stringify({ selfieCaptured: !!selfieCaptured, idDocSubmitted: !!idDocSubmitted })
    });
    return res.ok;
  },

  async fetchVerificationSummary() {
    const res = await fetch(this.apiUrl('/api/lawyer/verification-summary'), { credentials: 'include', headers: this.headers() });
    if (!res.ok) return null;
    return res.json();
  },

  /* --------------------------------------------------------
     CLIENT REQUEST PIPELINE
     Accepting a request creates the case file AND books the
     appointment AND opens the payment ledger entry.
     -------------------------------------------------------- */
  async acceptClientRequest(clientId) {
    await this.delay(300);
    try {
      await fetch(this.apiUrl(`/api/consultations/${clientId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this.headers() },
        credentials: 'include',
        body: JSON.stringify({ status: 'accepted' })
      });
    } catch (e) {
      console.warn('[ApiClient] Consultation status update error:', e.message);
    }

    const clients = Store.getState('clients') || [];
    const client = clients.find(c => c.id === clientId);
    if (!client) return { success: false };

    client.status = 'accepted';
    Store.setState('clients', clients);

    // 1. Case file
    const cases = Store.getState('cases') || [];
    const newCase = {
      id: `case_${Date.now()}`,
      caseNumber: `LC/${new Date().getFullYear()}/${String(cases.length + 1).padStart(4, '0')}`,
      clientId: client.id,
      clientName: client.name,
      caseType: client.caseCategory,
      legalCategory: client.caseCategory,
      court: 'District Court',
      filingDate: new Date().toISOString(),
      status: 'New',
      nextHearing: Store.generateFutureDate ? Store.generateFutureDate(14) : '',
      documents: client.documents || [],
      notes: [{
        id: `note_${Date.now()}`,
        text: 'Case file opened automatically when the consultation request was accepted.',
        isPrivate: true,
        createdAt: new Date().toISOString()
      }],
      description: client.briefProblem,
      createdAt: new Date().toISOString()
    };
    cases.unshift(newCase);
    Store.setState('cases', cases);

    // 2. Appointment on the requested date/time
    const appointments = Store.getState('appointments') || [];
    const apptDate = this.parsePreferredSlot(client.preferredDate, client.preferredTime);
    appointments.push({
      id: `appt_${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      caseType: client.caseCategory,
      date: apptDate.toISOString(),
      duration: 45,
      type: client.consultationType,
      status: 'confirmed',
      fee: client.estimatedFee,
      reminders: { h24Sent: false, m30Sent: false },
      caseId: newCase.id
    });
    Store.setState('appointments', appointments);

    // 3. Payment ledger entry (pending until settlement)
    const transactions = Store.getState('transactions') || [];
    const platformFee = Math.round((client.estimatedFee || 0) * 0.10);
    transactions.unshift({
      id: `txn_${Date.now()}`,
      clientName: client.name,
      service: `${client.consultationType} Consultation`,
      date: apptDate.toISOString(),
      amount: client.estimatedFee || 0,
      platformFee,
      netEarnings: (client.estimatedFee || 0) - platformFee,
      paymentStatus: 'pending',
      paymentMethod: 'Platform'
    });
    Store.setState('transactions', transactions);

    // 4. Notifications (lawyer-facing confirmation)
    const notifs = Store.getState('notifications') || [];
    notifs.unshift({
      id: `notif_${Date.now()}`,
      type: 'client',
      title: 'Consultation Confirmed',
      message: `${client.name}'s request was accepted. Appointment booked for ${Utils.formatDateTime(apptDate)} and a payment entry was created.`,
      read: false,
      link: '/cases',
      time: new Date().toISOString()
    });
    Store.setState('notifications', notifs);

    return { success: true, caseId: newCase.id, appointmentId: appointments[appointments.length - 1].id };
  },

  parsePreferredSlot(dateStr, timeStr) {
    const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    if (isNaN(d.getTime())) return new Date(Date.now() + 24 * 3600 * 1000);
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(timeStr || '');
    if (m) {
      let hours = parseInt(m[1], 10);
      const minutes = parseInt(m[2], 10);
      const period = (m[3] || '').toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
    } else {
      d.setHours(10, 0, 0, 0);
    }
    return d;
  },

  async rejectClientRequest(clientId, reason = 'Schedule conflict') {
    await this.delay(250);
    try {
      await fetch(this.apiUrl(`/api/consultations/${clientId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this.headers() },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected' })
      });
    } catch (e) {
      console.warn('[ApiClient] Consultation rejection status error:', e.message);
    }

    const clients = Store.getState('clients') || [];
    const client = clients.find(c => c.id === clientId);
    if (client) {
      client.status = 'rejected';
      client.rejectionReason = reason;
      Store.setState('clients', clients);

      const notifs = Store.getState('notifications') || [];
      notifs.unshift({
        id: `notif_${Date.now()}`,
        type: 'client',
        title: 'Request Declined',
        message: `You declined ${client.name}'s consultation request (${reason}). The client has been informed.`,
        read: false,
        link: '/clients',
        time: new Date().toISOString()
      });
      Store.setState('notifications', notifs);
    }
    return { success: true };
  },

  async fetchLiveConsultations() {
    try {
      const res = await fetch(this.apiUrl('/api/consultations/lawyer'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.consultations || [];
      }
    } catch (_) {}
    return [];
  },

  async fetchLiveNotifications() {
    try {
      const res = await fetch(this.apiUrl('/api/notifications?role=lawyer'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.notifications || [];
      }
    } catch (_) {}
    return [];
  },

  /* --------------------------------------------------------
     CASE OPERATIONS (store-backed, auto-synced)
     -------------------------------------------------------- */
  async updateCaseStatus(caseId, newStatus) {
    await this.delay(150);
    const cases = Store.getState('cases') || [];
    const caseItem = cases.find(c => c.id === caseId);
    if (caseItem) {
      caseItem.status = newStatus;
      Store.setState('cases', cases);
      const notifs = Store.getState('notifications') || [];
      notifs.unshift({
        id: `notif_${Date.now()}`,
        type: 'case',
        title: 'Case Status Updated',
        message: `${caseItem.caseNumber} moved to “${newStatus}”. Client view updated.`,
        read: false,
        link: `/cases/id/${caseId}`,
        time: new Date().toISOString()
      });
      Store.setState('notifications', notifs);
    }
    return { success: true };
  },

  async addCaseNote(caseId, noteText) {
    await this.delay(150);
    const cases = Store.getState('cases') || [];
    const caseItem = cases.find(c => c.id === caseId);
    if (caseItem) {
      caseItem.notes.unshift({
        id: `note_${Date.now()}`,
        text: noteText,
        isPrivate: true,
        createdAt: new Date().toISOString()
      });
      Store.setState('cases', cases);
    }
    return { success: true };
  },

  attachDocumentToCase(caseId, docMeta) {
    const cases = Store.getState('cases') || [];
    const caseItem = cases.find(c => c.id === caseId);
    if (!caseItem) return;
    caseItem.documents = caseItem.documents || [];
    caseItem.documents.push(docMeta);
    Store.setState('cases', cases);
  },

  /* --------------------------------------------------------
     PROFILE
     -------------------------------------------------------- */
  async updateProfile(patch) {
    const res = await fetch('/api/lawyer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.headers() },
      body: JSON.stringify(patch)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Profile update failed.');
    if (data.lawyer) Store.setState('lawyerProfile', data.lawyer);
    return data;
  },

  uploadProfilePhoto(dataUrl) {
    return this.updateProfile({ profilePhotoData: dataUrl });
  },

  async setProfileDeactivated(deactivated) {
    const endpoint = deactivated ? '/api/lawyer/deactivate' : '/api/lawyer/reactivate';
    const res = await fetch(endpoint, { method: 'POST', headers: this.headers() });
    if (res.ok && Store.getState('lawyerProfile')) {
      const lp = Store.getState('lawyerProfile');
      lp.profileDeactivated = deactivated;
      Store.setState('lawyerProfile', lp);
    }
    return res.ok;
  },

  /* --------------------------------------------------------
     PAYMENTS EXPORT (real CSV from server)
     -------------------------------------------------------- */
  async exportPaymentsCsv() {
    const res = await fetch('/api/payments/export.csv', { headers: this.headers() });
    if (!res.ok) throw new Error('Export failed.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nyay Setu-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  /* --------------------------------------------------------
     APPOINTMENT REMINDER ENGINE (24h & 30min windows)
     Runs while the advocate is signed in.
     -------------------------------------------------------- */
  _reminderTimer: null,

  startReminderEngine() {
    clearInterval(this._reminderTimer);
    this._reminderTimer = setInterval(() => this.checkReminders(), 30000);
    this.checkReminders();
  },

  stopReminderEngine() {
    clearInterval(this._reminderTimer);
  },

  checkReminders() {
    const appointments = Store.getState('appointments') || [];
    if (!appointments.length) return;
    let changed = false;
    const notifs = Store.getState('notifications') || [];
    const now = Date.now();

    for (const appt of appointments) {
      if (!appt.date || !['upcoming', 'confirmed'].includes(appt.status)) continue;
      appt.reminders = appt.reminders || {};
      const t = new Date(appt.date).getTime();

      if (!appt.reminders.h24Sent && t - now <= 24 * 3600 * 1000 && t > now) {
        appt.reminders.h24Sent = true; changed = true;
        notifs.unshift({
          id: `notif_rem_h24_${appt.id}`,
          type: 'appointment',
          title: 'Appointment Tomorrow',
          message: `${appt.clientName} — ${appt.type} consultation at ${Utils.formatTime(appt.date)}.`,
          read: false, link: '/consultation',
          time: new Date().toISOString()
        });
      }
      if (!appt.reminders.m30Sent && t - now <= 30 * 60 * 1000 && t > now) {
        appt.reminders.m30Sent = true; changed = true;
        notifs.unshift({
          id: `notif_rem_m30_${appt.id}`,
          type: 'appointment',
          title: 'Starting Within 30 Minutes',
          message: `${appt.clientName} — your ${appt.type} consultation begins at ${Utils.formatTime(appt.date)}.`,
          read: false, link: '/consultation',
          time: new Date().toISOString()
        });
      }
    }

    if (changed) {
      Store.setState('appointments', appointments);
      Store.setState('notifications', notifs.slice(0, 100));
    }
  }
};
