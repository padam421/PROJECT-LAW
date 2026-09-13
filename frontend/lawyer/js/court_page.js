/* ============================================================
   Nyay Setu ADVOCATE — VIRTUAL COURTROOM & TRIAL SIMULATOR
   court_page.js — 3D Virtual Courtroom layout, Bench Etiquette,
   Mock Hearing Rehearsal, Argument Drills for Advocates
   ============================================================ */

const AdvocateCourtPage = {
  render() {
    const lawyer = Store.getState('lawyerProfile') || AuthManager.getSession() || {};
    const lawyerName = lawyer.fullName || lawyer.professionalName || 'Advocate';

    const contentHtml = `
      <div style="max-width:1100px;margin:0 auto">
        <!-- Top Banner -->
        <div class="card mb-6" style="background:linear-gradient(135deg, #ffffff, #f8fafc);border:1px solid var(--color-gray-200);box-shadow:var(--shadow-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
            <div>
              <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.25);padding:4px 12px;border-radius:999px;font-size:0.75rem;color:var(--color-accent);font-weight:700;margin-bottom:8px">
                <span class="material-symbols-rounded icon-sm">gavel</span> VIRTUAL COURTROOM SIMULATOR 2.0
              </div>
              <h2 style="font-size:1.75rem;font-weight:800;color:var(--color-primary);margin-bottom:6px">Advocate Courtroom &amp; Trial Simulator</h2>
              <p style="color:var(--color-gray-600);font-size:0.95rem;max-width:650px">
                Step inside the virtual courtroom. Rehearse petitioner &amp; respondent submissions, cross-examine simulated witnesses, and master judicial courtroom decorum.
              </p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-primary btn-lg" onclick="AdvocateCourtPage.startSimSession('petitioner')">
                <span class="material-symbols-rounded">play_arrow</span> Start Trial Simulation
              </button>
              <button class="btn btn-secondary btn-lg" onclick="AdvocateCourtPage.showProtocols()">
                <span class="material-symbols-rounded">menu_book</span> Bench Protocol Rules
              </button>
            </div>
          </div>
        </div>

        <!-- Interactive Virtual Court Arena -->
        <div class="card mb-6" style="padding:28px;background:var(--surface-primary);border:1px solid var(--color-gray-200);box-shadow:var(--shadow-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <h3 style="font-size:1.2rem;font-weight:700;color:var(--color-primary);display:flex;align-items:center;gap:8px">
              <span class="material-symbols-rounded" style="color:var(--color-accent)">account_balance</span>
              Simulated Bench Layout — Courtroom Hall No. 3
            </h3>
            <span style="font-size:0.8rem;color:var(--color-text-muted);display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:#10b981"></span> Live Session Ready
            </span>
          </div>

          <div style="display:flex;flex-direction:column;gap:20px">
            <!-- 1. The Bench -->
            <div style="background:#fffbeb;border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:20px;text-align:center;box-shadow:var(--shadow-sm)">
              <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;box-shadow:0 4px 12px rgba(245,158,11,0.25)">
                <span class="material-symbols-rounded" style="font-size:32px;color:#fff">gavel</span>
              </div>
              <div style="font-weight:800;color:#92400e;font-size:1.1rem">Hon'ble Presiding Judge Bench</div>
              <p style="font-size:0.8rem;color:var(--color-gray-600);margin-top:2px">Senior Civil &amp; Sessions Judge • District Court Complex</p>
              <div style="display:inline-flex;gap:8px;margin-top:10px">
                <button class="btn btn-secondary btn-sm" onclick="Utils.showToast('Addressing the Bench: Rise, bow slightly, and state: \'May it please Your Honour...\'', 'info')">
                  🗣️ Rehearse Bench Address
                </button>
                <button class="btn btn-ghost btn-sm" onclick="Utils.showToast('Bench Query: \'Counsel, what is the precise cause of action under Order VII Rule 11?\'', 'warning')">
                  ❓ Practice Bench Question
                </button>
              </div>
            </div>

            <!-- 2. Dual Podiums: Petitioner & Respondent -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px">
              <!-- Petitioner Side -->
              <div style="background:rgba(13,148,136,0.05);border:1px solid rgba(13,148,136,0.25);border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:space-between">
                <div>
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <div style="width:40px;height:40px;border-radius:10px;background:rgba(13,148,136,0.12);display:flex;align-items:center;justify-content:center;color:var(--color-accent)">
                      <span class="material-symbols-rounded">record_voice_over</span>
                    </div>
                    <div>
                      <div style="font-weight:700;color:var(--color-primary);font-size:1rem">Petitioner Counsel Podium (You)</div>
                      <div style="font-size:0.75rem;color:var(--color-accent);font-weight:600">${Utils.escapeHtml(lawyerName)}</div>
                    </div>
                  </div>
                  <p style="font-size:0.85rem;color:var(--color-gray-600);line-height:1.5">
                    Lead arguments, submit evidentiary annexures, and request ad-interim ex-parte injunctions before the opposing counsel responds.
                  </p>
                </div>
                <div style="margin-top:16px;display:flex;gap:8px">
                  <button class="btn btn-primary btn-sm btn-block" onclick="AdvocateCourtPage.simulateArgument('petitioner')">
                    🎙️ Practice Opening Submission
                  </button>
                </div>
              </div>

              <!-- Respondent Side -->
              <div style="background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:space-between">
                <div>
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <div style="width:40px;height:40px;border-radius:10px;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;color:#4f46e5">
                      <span class="material-symbols-rounded">group</span>
                    </div>
                    <div>
                      <div style="font-weight:700;color:var(--color-primary);font-size:1rem">Respondent Counsel Table</div>
                      <div style="font-size:0.75rem;color:#4f46e5;font-weight:600">Opposing Senior Counsel</div>
                    </div>
                  </div>
                  <p style="font-size:0.85rem;color:var(--color-gray-600);line-height:1.5">
                    Simulate objections, counter-affidavits, and rebuttal strategy against procedural delays or admissibility contentions.
                  </p>
                </div>
                <div style="margin-top:16px;display:flex;gap:8px">
                  <button class="btn btn-secondary btn-sm btn-block" onclick="AdvocateCourtPage.simulateArgument('objection')">
                    ⚡ Raise Objection Simulation
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. Witness Box & Stenographer -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px">
              <div style="background:var(--surface-secondary);border:1px solid var(--color-gray-200);border-radius:14px;padding:16px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                  <span class="material-symbols-rounded" style="color:#d97706">person</span>
                  <div style="font-weight:700;color:var(--color-primary)">Witness Stand (Katghara)</div>
                </div>
                <p style="font-size:0.82rem;color:var(--color-gray-600);margin-bottom:12px">Practice chief examination and leading questions under Section 141-143 Indian Evidence Act / BSA.</p>
                <button class="btn btn-ghost btn-sm" onclick="Utils.showToast('Simulating witness cross-examination questions...', 'info')">
                  Cross-Examination Drill
                </button>
              </div>

              <div style="background:var(--surface-secondary);border:1px solid var(--color-gray-200);border-radius:14px;padding:16px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                  <span class="material-symbols-rounded" style="color:var(--color-accent)">keyboard</span>
                  <div style="font-weight:700;color:var(--color-primary)">Court Stenographer &amp; Order Sheet</div>
                </div>
                <p style="font-size:0.82rem;color:var(--color-gray-600);margin-bottom:12px">Real-time transcription recorder of oral dictations and daily order sheets.</p>
                <button class="btn btn-ghost btn-sm" onclick="Utils.showToast('Order sheet recorder active.', 'info')">
                  View Daily Order Draft
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Advocate Judicial Etiquette & Strategy Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px">
          <div class="card">
            <div class="card-header">
              <h4 class="card-title d-flex items-center gap-2">
                <span class="material-symbols-rounded text-accent">verified_user</span> Courtroom Etiquette Protocol
              </h4>
            </div>
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px;font-size:0.85rem;color:var(--color-text-secondary)">
              <li style="display:flex;gap:10px"><span style="color:#10b981">✓</span> Always address the Judge as <em>"Your Honour"</em> or <em>"My Lord"</em>.</li>
              <li style="display:flex;gap:10px"><span style="color:#10b981">✓</span> Never interrupt opposing counsel while they are reading documentary evidence.</li>
              <li style="display:flex;gap:10px"><span style="color:#10b981">✓</span> Keep pagination of case file index synchronized with the Judge's dossier copy.</li>
              <li style="display:flex;gap:10px"><span style="color:#10b981">✓</span> Always stand when addressing the Bench and bow slightly before leaving the podium.</li>
            </ul>
          </div>

          <div class="card">
            <div class="card-header">
              <h4 class="card-title d-flex items-center gap-2">
                <span class="material-symbols-rounded" style="color:#f59e0b">bolt</span> Quick Hearing Actions
              </h4>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button class="btn btn-secondary btn-block" onclick="Router.navigate('/ai-assistant')">
                <span class="material-symbols-rounded">auto_awesome</span> Open AI Legal Assistant for Arguments
              </button>
              <button class="btn btn-secondary btn-block" onclick="Router.navigate('/cases')">
                <span class="material-symbols-rounded">folder</span> Load Case Brief into Simulator
              </button>
              <button class="btn btn-primary btn-block" onclick="Router.navigate('/dashboard')">
                <span class="material-symbols-rounded">dashboard</span> Return to Advocate Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    return Components.AppLayout(contentHtml, 'court');
  },

  startSimSession(role) {
    Utils.showToast(`Virtual Trial Session Activated as ${role.toUpperCase()}. Voice & Dossier synced.`, 'success');
  },

  showProtocols() {
    Utils.showModal(`
      <div style="padding:10px">
        <h4 style="color:var(--color-primary);margin-bottom:12px">Bar Council &amp; High Court Hearing Standards</h4>
        <p style="font-size:0.9rem;color:var(--color-text-secondary);line-height:1.6;margin-bottom:12px">
          1. <strong>Robes &amp; Bands:</strong> Advocates must adhere to the prescribed dress code (Black Coat, White Neckband, Gown in High Court).
        </p>
        <p style="font-size:0.9rem;color:var(--color-text-secondary);line-height:1.6;margin-bottom:12px">
          2. <strong>Case Synopsis:</strong> Maintain a 2-page chronological list of events with corresponding page numbers for instant bench reference.
        </p>
        <p style="font-size:0.9rem;color:var(--color-text-secondary);line-height:1.6">
          3. <strong>Statutory Precedents:</strong> Cite headnotes accurately with relevant Supreme Court / High Court citations (e.g., AIR / SCC).
        </p>
      </div>
    `, { title: 'Judicial Bench Standards & Court Protocol' });
  },

  simulateArgument(type) {
    if (type === 'objection') {
      Utils.showToast('Objection Raised: "Your Honour, counsel is introducing hearsay outside the pleadings!"', 'warning');
    } else {
      Utils.showToast('Opening Submission: "May it please Your Honour, this petition arises under Article 226 for enforcement of legal rights..."', 'info');
    }
  }
};
