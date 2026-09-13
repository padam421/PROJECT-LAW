/* ============================================================
   Nyay Setu USER — LAWYER DISCOVERY & CONSULTATION
   lawyer_page.js — Search, Recommended, Profiles, Compare,
   Booking, Payment, Consultation Room, Summary & My Lawyer
   ============================================================ */

const UserLawyerPage = {
  _currentFilter: 'all',
  _searchQuery: '',

  /* ==================== 1. FIND LAWYERS (CATALOG) ==================== */
  async renderLawyers() {
    const lawyers = await UserApiClient.searchLawyers();
    const activeCase = UserStore.getActiveCase();

    const filtered = lawyers.filter(l => {
      const matchCat = this._currentFilter === 'all' || 
        l.specialization.toLowerCase().includes(this._currentFilter.toLowerCase());
      const matchQuery = !this._searchQuery || 
        l.name.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
        l.specialization.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
        l.city.toLowerCase().includes(this._searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    const categories = [
      { id: 'all', label: 'All Specializations' },
      { id: 'property', label: 'Property & Land' },
      { id: 'civil', label: 'Civil Matters' },
      { id: 'family', label: 'Family & Matrimonial' },
      { id: 'criminal', label: 'Criminal Defense' },
      { id: 'corporate', label: 'Business & Corporate' },
    ];

    const content = `
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:8px">
          <h2 style="font-size:1.5rem;font-weight:800">Find Verified Lawyers</h2>
          <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="Router.navigate('/lawyers/compare')">
            <span class="material-symbols-rounded" style="font-size:16px">compare_arrows</span> Compare Lawyers
          </button>
        </div>
        <p style="font-size:0.85rem;color:var(--u-text-tertiary)">
          ${activeCase ? `Showing recommendations for your <strong>${Utils.escapeHtml(activeCase.title)}</strong> in ${Utils.escapeHtml(activeCase.location || 'India')}` : 'Browse verified advocates across district and high courts'}
        </p>
      </div>

      <!-- Search Bar -->
      <div class="u-lawyer-search">
        <div class="u-lawyer-search-input">
          <span class="material-symbols-rounded search-icon">search</span>
          <input type="text" class="u-input" placeholder="Search by name, specialization, or city..."
                 value="${Utils.escapeHtml(this._searchQuery)}"
                 oninput="UserLawyerPage.handleSearch(this.value)">
        </div>
        <button class="u-lawyer-filter-btn" onclick="Router.navigate('/lawyers/recommended')">
          <span class="material-symbols-rounded" style="font-size:18px;color:var(--u-accent-light)">auto_awesome</span>
          AI Recommended
        </button>
      </div>

      <!-- Filter Chips -->
      <div class="u-filter-chips">
        ${categories.map(c => `
          <div class="u-filter-chip ${this._currentFilter === c.id ? 'active' : ''}"
               onclick="UserLawyerPage.setFilter('${c.id}')">
            ${c.label}
          </div>
        `).join('')}
      </div>

      <!-- Grid -->
      <div class="u-lawyer-grid">
        ${filtered.length > 0 ? filtered.map(l => this._renderLawyerCard(l)).join('') : `
          <div style="grid-column:1/-1">
            ${UserComponents.EmptyState('person_search', 'No Lawyers Found', 'Try adjusting your search query or filters to find legal experts.')}
          </div>
        `}
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Find Lawyers');
  },

  handleSearch(query) {
    this._searchQuery = query;
    const grid = document.querySelector('.u-lawyer-grid');
    if (!grid) return;
    UserApiClient.searchLawyers().then(lawyers => {
      const filtered = lawyers.filter(l => {
        const matchCat = this._currentFilter === 'all' || 
          l.specialization.toLowerCase().includes(this._currentFilter.toLowerCase());
        const matchQuery = !this._searchQuery || 
          l.name.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
          l.specialization.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
          l.city.toLowerCase().includes(this._searchQuery.toLowerCase());
        return matchCat && matchQuery;
      });
      grid.innerHTML = filtered.length > 0 ? filtered.map(l => this._renderLawyerCard(l)).join('') : `
        <div style="grid-column:1/-1">
          ${UserComponents.EmptyState('person_search', 'No Lawyers Found', 'Try adjusting your search query or filters.')}
        </div>
      `;
    });
  },

  setFilter(filterId) {
    this._currentFilter = filterId;
    document.querySelectorAll('.u-filter-chip').forEach(el => {
      el.classList.toggle('active', el.textContent.trim().toLowerCase().includes(filterId) || (filterId === 'all' && el.textContent.includes('All')));
    });
    this.handleSearch(this._searchQuery);
  },

  _renderLawyerCard(l) {
    return `
      <div class="u-lawyer-card" onclick="Router.navigate('/lawyer/${l.id}')">
        <div class="u-lawyer-card-top">
          <div class="u-lawyer-avatar">
            ${l.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
            ${l.verified ? `<div class="u-lawyer-verified" title="Bar Council Verified"><span class="material-symbols-rounded">verified</span></div>` : ''}
          </div>
          <div class="u-lawyer-info">
            <div class="u-lawyer-name">
              ${Utils.escapeHtml(l.name)}
            </div>
            <div class="u-lawyer-specialization">${Utils.escapeHtml(l.specialization)}</div>
            <div class="u-lawyer-meta">
              <div class="u-lawyer-meta-item">
                <span class="material-symbols-rounded">history_edu</span>
                <span>${l.experience} exp</span>
              </div>
              <div class="u-lawyer-meta-item">
                <span class="material-symbols-rounded">location_on</span>
                <span>${Utils.escapeHtml(l.city)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="u-lawyer-card-tags">
          ${(l.languages || []).map(lang => `<span class="u-lawyer-tag">${lang}</span>`).join('')}
          ${(l.courts || []).map(c => `<span class="u-lawyer-tag" style="border-color:rgba(99,102,241,0.2);color:var(--u-accent-light)">${c}</span>`).join('')}
        </div>

        <div class="u-lawyer-card-footer">
          <div>
            <div class="u-lawyer-price">₹${l.fee} <span>/ ${l.feeDuration || '30 min'}</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="u-lawyer-rating">
              <span class="material-symbols-rounded" style="font-size:16px;color:var(--u-amber)">star</span>
              <span>${l.rating}</span>
              <span style="color:var(--u-text-disabled);font-size:0.7rem">(${l.reviews})</span>
            </div>
            <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="event.stopPropagation();Router.navigate('/consultation/book?lawyerId=${l.id}')">
              Book
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /* ==================== 2. AI RECOMMENDED LAWYERS ==================== */
  async renderRecommended() {
    const lawyers = await UserApiClient.searchLawyers();
    const activeCase = UserStore.getActiveCase();

    const content = `
      <div style="max-width:850px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <button class="u-btn-icon" onclick="Router.navigate('/lawyers')">
            <span class="material-symbols-rounded">arrow_back</span>
          </button>
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:var(--u-radius-full);background:var(--u-accent-subtle);color:var(--u-accent-light);font-size:0.75rem;font-weight:700;margin-bottom:4px">
              <span class="material-symbols-rounded" style="font-size:16px">auto_awesome</span> Smart AI Matching
            </div>
            <h2 style="font-size:1.5rem;font-weight:800">Top Matches For Your Case</h2>
            <p style="font-size:0.85rem;color:var(--u-text-tertiary)">
              Matched based on: <strong>${Utils.escapeHtml(activeCase?.title || 'Property Law')}</strong> in <strong>${Utils.escapeHtml(activeCase?.location || 'Hyderabad')}</strong>, court jurisdiction, and language preference.
            </p>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px">
          ${lawyers.map((l, index) => `
            <div class="u-card" style="padding:24px;border:1px solid ${index === 0 ? 'rgba(99,102,241,0.3)' : 'var(--u-glass-border)'};background:${index === 0 ? 'linear-gradient(135deg, rgba(99,102,241,0.06), var(--u-glass-bg))' : 'var(--u-glass-bg)'}">
              ${index === 0 ? `
                <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:var(--u-radius-full);background:var(--u-accent-gradient);color:#fff;font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px">
                  <span class="material-symbols-rounded" style="font-size:14px">military_tech</span> #1 Best Match (98% Compatibility)
                </div>
              ` : ''}

              <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
                <div class="u-lawyer-avatar" style="width:64px;height:64px;font-size:1.4rem">
                  ${l.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  ${l.verified ? `<div class="u-lawyer-verified"><span class="material-symbols-rounded">verified</span></div>` : ''}
                </div>
                <div style="flex:1;min-width:240px">
                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                    <h3 style="font-size:1.15rem;font-weight:800">${Utils.escapeHtml(l.name)}</h3>
                    <div class="u-lawyer-price" style="font-size:1.1rem">₹${l.fee} <span style="font-size:0.75rem">/ ${l.feeDuration || '30 min'}</span></div>
                  </div>
                  <div style="font-size:0.82rem;color:var(--u-accent-light);font-weight:600;margin-bottom:6px">${Utils.escapeHtml(l.specialization)}</div>
                  <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:0.75rem;color:var(--u-text-tertiary);margin-bottom:12px">
                    <span>⭐ <strong>${l.rating}</strong> (${l.reviews} reviews)</span>
                    <span>•</span>
                    <span>🏛️ ${l.experience} Exp</span>
                    <span>•</span>
                    <span>📍 ${Utils.escapeHtml(l.city)}</span>
                  </div>

                  <!-- Why this lawyer card -->
                  <div class="u-why-card">
                    <h4>
                      <span class="material-symbols-rounded" style="font-size:18px">psychology</span>
                      Why Nyay Setu Recommends This Lawyer
                    </h4>
                    <p>${Utils.escapeHtml(l.whyRecommend || 'Experienced advocate with relevant practice in your local jurisdiction.')}</p>
                  </div>

                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:16px">
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${(l.languages || []).map(lang => `<span class="u-lawyer-tag">${lang}</span>`).join('')}
                    </div>
                    <div style="display:flex;gap:10px">
                      <button class="u-btn u-btn-secondary u-btn-sm u-btn-pill" onclick="Router.navigate('/lawyer/${l.id}')">
                        View Profile
                      </button>
                      <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="Router.navigate('/consultation/book?lawyerId=${l.id}')">
                        <span class="material-symbols-rounded" style="font-size:16px">calendar_month</span> Book Consultation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Recommendations', true);
  },

  /* ==================== 3. LAWYER FULL PROFILE ==================== */
  async renderLawyerProfile(lawyerId) {
    const lawyers = await UserApiClient.searchLawyers();
    const l = lawyers.find(x => x.id === lawyerId) || lawyers[0];

    const content = `
      <div style="max-width:850px;margin:0 auto">
        <div style="margin-bottom:16px">
          <button class="u-btn-icon" onclick="Router.back()">
            <span class="material-symbols-rounded">arrow_back</span>
          </button>
        </div>

        <!-- Header Card -->
        <div class="u-lawyer-profile-header">
          <div class="u-lawyer-profile-avatar">
            ${l.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div class="u-lawyer-profile-info">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h2 class="u-lawyer-profile-name">${Utils.escapeHtml(l.name)}</h2>
              ${l.verified ? `<span class="u-badge u-badge-emerald"><span class="material-symbols-rounded" style="font-size:14px">verified</span> Bar Verified</span>` : ''}
            </div>
            <p style="font-size:0.9rem;color:var(--u-accent-light);font-weight:600">${Utils.escapeHtml(l.specialization)}</p>
            <p style="font-size:0.8rem;color:var(--u-text-tertiary);margin-top:2px">📍 Practicing at ${l.courts?.join(', ') || 'District Court'}, ${l.city}</p>

            <div class="u-lawyer-profile-stats">
              <div class="u-lawyer-stat">
                <div class="u-lawyer-stat-value">${l.experience}</div>
                <div class="u-lawyer-stat-label">Experience</div>
              </div>
              <div class="u-lawyer-stat">
                <div class="u-lawyer-stat-value">⭐ ${l.rating}</div>
                <div class="u-lawyer-stat-label">${l.reviews} Reviews</div>
              </div>
              <div class="u-lawyer-stat">
                <div class="u-lawyer-stat-value">94%</div>
                <div class="u-lawyer-stat-label">Resolution Rate</div>
              </div>
              <div class="u-lawyer-stat">
                <div class="u-lawyer-stat-value">₹${l.fee}</div>
                <div class="u-lawyer-stat-label">per consultation</div>
              </div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px" class="u-profile-content-grid">
          <!-- Left Details -->
          <div style="display:flex;flex-direction:column;gap:20px">
            <!-- About -->
            <div class="u-card">
              <h4 class="u-section-title">About Advocate</h4>
              <p style="font-size:0.85rem;color:var(--u-text-secondary);line-height:1.7;margin-bottom:12px">
                Advocate ${Utils.escapeHtml(l.name)} is an esteemed legal practitioner with over ${l.experience} of dedicated courtroom practice. Specializing extensively in ${Utils.escapeHtml(l.specialization)}, they have successfully represented hundreds of individual and corporate clients in civil, partition, title verification, and litigation matters.
              </p>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="u-badge u-badge-accent">Civil Procedure</span>
                <span class="u-badge u-badge-accent">Land Acquisition</span>
                <span class="u-badge u-badge-accent">Partition Suits</span>
                <span class="u-badge u-badge-accent">RERA Compliance</span>
              </div>
            </div>

            <!-- Bar Council Verification Details -->
            <div class="u-card">
              <h4 class="u-section-title">Credentials & Verification</h4>
              <div class="u-case-info-grid">
                <div class="u-case-info-item">
                  <div class="u-case-info-label">Bar Council Enrollment</div>
                  <div class="u-case-info-value" style="font-family:var(--u-font-mono);font-size:0.8rem">${Utils.escapeHtml(l.barCouncil || l.barCouncilId || 'DL/4521/2016')}</div>
                </div>
                <div class="u-case-info-item">
                  <div class="u-case-info-label">Verification Status</div>
                  <div class="u-case-info-value" style="color:var(--u-emerald-light)">✓ Certified & Active</div>
                </div>
                <div class="u-case-info-item">
                  <div class="u-case-info-label">Degree</div>
                  <div class="u-case-info-value">B.A. LL.B (Hons), LL.M</div>
                </div>
                <div class="u-case-info-item">
                  <div class="u-case-info-label">Languages Spoken</div>
                  <div class="u-case-info-value">${l.languages?.join(', ') || 'English, Hindi'}</div>
                </div>
              </div>
            </div>

            <!-- Client Reviews -->
            <div class="u-card">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <h4 class="u-section-title" style="margin-bottom:0">Verified Client Reviews</h4>
                <div style="font-size:0.85rem;color:var(--u-amber-light);font-weight:700">★ ${l.rating} out of 5</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px">
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:var(--u-radius-sm);border:1px solid var(--u-border)">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <strong style="font-size:0.85rem">Suresh K.</strong>
                    <span style="font-size:0.7rem;color:var(--u-text-disabled)">2 weeks ago</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--u-amber-light);margin-bottom:6px">★★★★★ Property Dispute Consultation</div>
                  <p style="font-size:0.8rem;color:var(--u-text-tertiary);line-height:1.5">
                    "Advocate Rahul explained the entire legal process in simple Telugu. He reviewed my property documents carefully and told me clearly what to expect in court."
                  </p>
                </div>
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:var(--u-radius-sm);border:1px solid var(--u-border)">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <strong style="font-size:0.85rem">Meera V.</strong>
                    <span style="font-size:0.7rem;color:var(--u-text-disabled)">1 month ago</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--u-amber-light);margin-bottom:6px">★★★★★ Title Verification</div>
                  <p style="font-size:0.8rem;color:var(--u-text-tertiary);line-height:1.5">
                    "Prompt, respectful and extremely knowledgeable. Saved us from a fraudulent real estate deal."
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Booking Card -->
          <div>
            <div class="u-card" style="position:sticky;top:84px">
              <h4 style="font-size:1.1rem;font-weight:800;margin-bottom:12px">Book Consultation</h4>
              <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:16px">
                <span style="font-size:1.8rem;font-weight:800;color:var(--u-accent-light)">₹${l.fee}</span>
                <span style="font-size:0.8rem;color:var(--u-text-tertiary)">/ 30 minutes</span>
              </div>

              <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
                <div style="display:flex;align-items:center;gap:10px;font-size:0.82rem;color:var(--u-text-secondary)">
                  <span class="material-symbols-rounded" style="color:var(--u-emerald-light);font-size:18px">check_circle</span>
                  <span>Direct 1-on-1 Encrypted Video Call</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;font-size:0.82rem;color:var(--u-text-secondary)">
                  <span class="material-symbols-rounded" style="color:var(--u-emerald-light);font-size:18px">check_circle</span>
                  <span>Document Pre-review Included</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;font-size:0.82rem;color:var(--u-text-secondary)">
                  <span class="material-symbols-rounded" style="color:var(--u-emerald-light);font-size:18px">check_circle</span>
                  <span>Written Advice Summary Post-Call</span>
                </div>
              </div>

              <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill"
                      onclick="Router.navigate('/consultation/book?lawyerId=${l.id}')">
                <span class="material-symbols-rounded" style="font-size:20px">event_available</span>
                Select Date & Time
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', l.name, true);
  },

  /* ==================== 4. COMPARE LAWYERS ==================== */
  async renderCompare() {
    const lawyers = await UserApiClient.searchLawyers();
    const l1 = lawyers[0];
    const l2 = lawyers[1];
    const l3 = lawyers[2];

    const content = `
      <div style="max-width:960px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <button class="u-btn-icon" onclick="Router.navigate('/lawyers')">
            <span class="material-symbols-rounded">arrow_back</span>
          </button>
          <div>
            <h2 style="font-size:1.5rem;font-weight:800">Compare Lawyers Side-by-Side</h2>
            <p style="font-size:0.85rem;color:var(--u-text-tertiary)">Compare fees, experience, jurisdictions, and client feedback to pick the right advocate.</p>
          </div>
        </div>

        <div class="u-card" style="padding:0;overflow:hidden">
          <div class="u-compare-table">
            <table>
              <thead>
                <tr>
                  <th style="width:25%">Feature</th>
                  <th style="width:25%">${l1.name}</th>
                  <th style="width:25%">${l2.name}</th>
                  <th style="width:25%">${l3.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Specialization</strong></td>
                  <td>${l1.specialization}</td>
                  <td>${l2.specialization}</td>
                  <td>${l3.specialization}</td>
                </tr>
                <tr>
                  <td><strong>Experience</strong></td>
                  <td><strong>${l1.experience}</strong></td>
                  <td><strong>${l2.experience}</strong></td>
                  <td><strong>${l3.experience}</strong></td>
                </tr>
                <tr>
                  <td><strong>Consultation Fee</strong></td>
                  <td><span class="u-text-accent" style="font-weight:700">₹${l1.fee}</span></td>
                  <td><span class="u-text-accent" style="font-weight:700">₹${l2.fee}</span></td>
                  <td><span class="u-text-accent" style="font-weight:700">₹${l3.fee}</span></td>
                </tr>
                <tr>
                  <td><strong>Rating & Reviews</strong></td>
                  <td>⭐ ${l1.rating} (${l1.reviews})</td>
                  <td>⭐ ${l2.rating} (${l2.reviews})</td>
                  <td>⭐ ${l3.rating} (${l3.reviews})</td>
                </tr>
                <tr>
                  <td><strong>Courts Practiced</strong></td>
                  <td>${l1.courts.join(', ')}</td>
                  <td>${l2.courts.join(', ')}</td>
                  <td>${l3.courts.join(', ')}</td>
                </tr>
                <tr>
                  <td><strong>Languages</strong></td>
                  <td>${l1.languages.join(', ')}</td>
                  <td>${l2.languages.join(', ')}</td>
                  <td>${l3.languages.join(', ')}</td>
                </tr>
                <tr>
                  <td><strong>Bar Verification</strong></td>
                  <td><span class="u-text-emerald">✓ Verified</span></td>
                  <td><span class="u-text-emerald">✓ Verified</span></td>
                  <td><span class="u-text-emerald">✓ Verified</span></td>
                </tr>
                <tr>
                  <td><strong>Action</strong></td>
                  <td>
                    <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="Router.navigate('/consultation/book?lawyerId=${l1.id}')">Book</button>
                  </td>
                  <td>
                    <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="Router.navigate('/consultation/book?lawyerId=${l2.id}')">Book</button>
                  </td>
                  <td>
                    <button class="u-btn u-btn-primary u-btn-sm u-btn-pill" onclick="Router.navigate('/consultation/book?lawyerId=${l3.id}')">Book</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Compare Lawyers', true);
  },

  _activeBooking: {
    lawyerId: null,
    date: null,
    slot: '10:00 AM',
    mode: 'video',
    caseId: null,
    fee: 1000
  },

  /* ==================== 5. BOOK CONSULTATION ==================== */
  async renderBooking(lawyerId) {
    const lawyers = await UserApiClient.searchLawyers();
    const l = lawyers.find(x => x.id === lawyerId) || lawyers[0];
    const activeCase = UserStore.getActiveCase();

    // Generate upcoming dates dynamically
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dates = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayLabel = i === 1 ? 'Tomorrow' : dayNames[d.getDay()];
      const dateLabel = `${monthNames[d.getMonth()]} ${d.getDate()}`;
      const full = d.toISOString().slice(0, 10);
      dates.push({ day: dayLabel, date: dateLabel, full });
    }

    const slots = ['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM'];

    this._activeBooking = {
      lawyerId: l.id,
      lawyerName: l.name,
      date: dates[0].full,
      slot: slots[0],
      mode: 'video',
      caseId: activeCase ? activeCase.id : null,
      fee: l.fee,
      platformFee: 50,
      total: l.fee + 50
    };
    try { sessionStorage.setItem('lc_active_booking', JSON.stringify(this._activeBooking)); } catch (_) {}

    const content = `
      <div style="max-width:640px;margin:0 auto">
        <div style="margin-bottom:16px">
          <button class="u-btn-icon" onclick="Router.back()">
            <span class="material-symbols-rounded">arrow_back</span>
          </button>
        </div>

        <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:4px">Schedule Consultation</h2>
        <p style="font-size:0.85rem;color:var(--u-text-tertiary);margin-bottom:24px">with <strong>${Utils.escapeHtml(l.name)}</strong> (${Utils.escapeHtml(l.specialization)})</p>

        <!-- 1. Select Case -->
        <div class="u-card" style="margin-bottom:20px">
          <label class="u-input-label" style="margin-bottom:8px;display:block">1. Select Case or Topic</label>
          <select class="u-input" id="book-case" onchange="UserLawyerPage._activeBooking.caseId = this.value; try { sessionStorage.setItem('lc_active_booking', JSON.stringify(UserLawyerPage._activeBooking)); } catch(_) {}">
            ${UserStore.getCases().map(c => `<option value="${c.id}">${Utils.escapeHtml(c.title)} (${c.type})</option>`).join('')}
            <option value="new">+ General Legal Advice</option>
          </select>
        </div>

        <!-- 2. Consultation Mode -->
        <div class="u-card" style="margin-bottom:20px">
          <label class="u-input-label" style="margin-bottom:12px;display:block">2. Choose Consultation Format</label>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px" id="consult-mode-group">
            <div class="u-lang-card selected" onclick="UserLawyerPage.selectMode(this, 'video')">
              <span class="material-symbols-rounded" style="font-size:24px;color:var(--u-accent-light)">videocam</span>
              <div style="font-size:0.8rem;font-weight:700">Video Call</div>
            </div>
            <div class="u-lang-card" onclick="UserLawyerPage.selectMode(this, 'audio')">
              <span class="material-symbols-rounded" style="font-size:24px;color:var(--u-emerald-light)">call</span>
              <div style="font-size:0.8rem;font-weight:700">Phone Call</div>
            </div>
            <div class="u-lang-card" onclick="UserLawyerPage.selectMode(this, 'inperson')">
              <span class="material-symbols-rounded" style="font-size:24px;color:var(--u-amber-light)">meeting_room</span>
              <div style="font-size:0.8rem;font-weight:700">In-Office</div>
            </div>
          </div>
        </div>

        <!-- 3. Pick Date -->
        <div class="u-card" style="margin-bottom:20px">
          <label class="u-input-label" style="margin-bottom:12px;display:block">3. Select Date</label>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px" id="book-date-group">
            ${dates.map((d, i) => `
              <div class="u-lang-card ${i === 0 ? 'selected' : ''}" onclick="UserLawyerPage.selectDate(this, '${d.full}')">
                <div style="font-size:0.7rem;color:var(--u-text-tertiary)">${d.day}</div>
                <div style="font-size:0.95rem;font-weight:800;color:var(--u-text-primary)">${d.date}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 4. Pick Time Slot -->
        <div class="u-card" style="margin-bottom:24px">
          <label class="u-input-label" style="margin-bottom:12px;display:block">4. Available Time Slots</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap" id="book-slot-group">
            ${slots.map((s, i) => `
              <button class="u-btn ${i === 0 ? 'u-btn-primary' : 'u-btn-secondary'} u-btn-sm u-btn-pill"
                      onclick="UserLawyerPage.selectSlot(this, '${s}')">
                ${s}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Price Summary -->
        <div class="u-booking-summary">
          <div class="u-booking-row">
            <span class="u-booking-row-label">Consultation Fee (30 mins)</span>
            <span class="u-booking-row-value">₹${l.fee}</span>
          </div>
          <div class="u-booking-row">
            <span class="u-booking-row-label">Platform & Encryption Fee</span>
            <span class="u-booking-row-value">₹50</span>
          </div>
          <div class="u-booking-total">
            <span>Total Payable</span>
            <span class="u-booking-total-value">₹${l.fee + 50}</span>
          </div>
        </div>

        <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" style="margin-top:20px"
                onclick="Router.navigate('/payment?lawyerId=${l.id}&amount=${l.fee + 50}')">
          Proceed to Payment (₹${l.fee + 50})
          <span class="material-symbols-rounded" style="font-size:20px">arrow_forward</span>
        </button>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Book Consultation', true);
  },

  selectMode(el, mode) {
    document.querySelectorAll('#consult-mode-group .u-lang-card').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    if (!this._activeBooking) this._activeBooking = {};
    this._activeBooking.mode = mode;
    try { sessionStorage.setItem('lc_active_booking', JSON.stringify(this._activeBooking)); } catch (_) {}
  },

  selectDate(el, date) {
    document.querySelectorAll('#book-date-group .u-lang-card').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    if (!this._activeBooking) this._activeBooking = {};
    this._activeBooking.date = date;
    try { sessionStorage.setItem('lc_active_booking', JSON.stringify(this._activeBooking)); } catch (_) {}
  },

  selectSlot(el, slot) {
    document.querySelectorAll('#book-slot-group button').forEach(x => {
      x.className = 'u-btn u-btn-secondary u-btn-sm u-btn-pill';
    });
    el.className = 'u-btn u-btn-primary u-btn-sm u-btn-pill';
    if (!this._activeBooking) this._activeBooking = {};
    this._activeBooking.slot = slot;
    try { sessionStorage.setItem('lc_active_booking', JSON.stringify(this._activeBooking)); } catch (_) {}
  },

  /* ==================== 6. PAYMENT SCREEN ==================== */
  renderPayment(lawyerId, amount = 550) {
    if (!this._activeBooking) {
      try {
        const stored = sessionStorage.getItem('lc_active_booking');
        if (stored) this._activeBooking = JSON.parse(stored);
      } catch (_) {}
    }
    const activeBooking = this._activeBooking || {};
    if (lawyerId) activeBooking.lawyerId = lawyerId;
    activeBooking.total = amount;
    this._activeBooking = activeBooking;
    try { sessionStorage.setItem('lc_active_booking', JSON.stringify(this._activeBooking)); } catch (_) {}

    const content = `
      <div style="max-width:520px;margin:0 auto">
        <div style="margin-bottom:16px">
          <button class="u-btn-icon" onclick="Router.back()">
            <span class="material-symbols-rounded">arrow_back</span>
          </button>
        </div>

        <div style="text-align:center;margin-bottom:28px">
          <div class="u-auth-logo" style="background:linear-gradient(135deg, var(--u-emerald), #059669)">
            <span class="material-symbols-rounded">lock</span>
          </div>
          <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:4px">Secure Checkout</h2>
          <p style="font-size:0.85rem;color:var(--u-text-tertiary)">256-bit encrypted legal consultation payment</p>
        </div>

        <!-- Payment Methods -->
        <div class="u-payment-methods" id="pay-methods">
          <div class="u-payment-method selected" onclick="UserLawyerPage.selectPayMethod(this, 'upi')">
            <span class="material-symbols-rounded" style="font-size:28px;color:var(--u-accent-light)">qr_code_2</span>
            <span>UPI / GPay / PhonePe</span>
          </div>
          <div class="u-payment-method" onclick="UserLawyerPage.selectPayMethod(this, 'card')">
            <span class="material-symbols-rounded" style="font-size:28px;color:var(--u-cyan-light)">credit_card</span>
            <span>Credit / Debit Card</span>
          </div>
          <div class="u-payment-method" onclick="UserLawyerPage.selectPayMethod(this, 'netbanking')">
            <span class="material-symbols-rounded" style="font-size:28px;color:var(--u-amber-light)">account_balance</span>
            <span>Net Banking</span>
          </div>
        </div>

        <!-- UPI Input (default) -->
        <div id="pay-upi-section" class="u-card" style="margin-bottom:24px">
          <label class="u-input-label">Enter UPI ID / VPA</label>
          <div class="u-input-icon-wrap" style="margin-top:6px">
            <span class="material-symbols-rounded input-icon">smartphone</span>
            <input type="text" class="u-input" id="upi-id" placeholder="yourname@okhdfcbank" value="user@okhdfcbank">
          </div>
        </div>

        <!-- Summary -->
        <div class="u-booking-summary" style="margin-bottom:24px">
          <div class="u-booking-row">
            <span class="u-booking-row-label">Consultation Fee</span>
            <span class="u-booking-row-value">₹${amount - 50}</span>
          </div>
          <div class="u-booking-row">
            <span class="u-booking-row-label">Platform Fee</span>
            <span class="u-booking-row-value">₹50</span>
          </div>
          <div class="u-booking-total">
            <span>Total Payable</span>
            <span class="u-booking-total-value">₹${amount}</span>
          </div>
        </div>

        <button class="u-btn u-btn-primary u-btn-block u-btn-lg u-btn-pill" id="pay-btn"
                onclick="UserLawyerPage.processPayment(${amount})">
          <span class="material-symbols-rounded" style="font-size:20px">verified_user</span>
          Pay ₹${amount} Securely
        </button>

        <div style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.75rem;color:var(--u-text-disabled);margin-top:16px">
          <span class="material-symbols-rounded" style="font-size:16px">shield</span>
          <span>100% Refund Guarantee if advocate misses appointment</span>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Payment', true);
  },

  selectPayMethod(el, method) {
    document.querySelectorAll('#pay-methods .u-payment-method').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
  },

  async processPayment(amount) {
    const btn = document.getElementById('pay-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner" style="width:20px;height:20px;border-width:2px"></span> Booking Consultation & Notifying Advocate...';
    }

    if (!this._activeBooking) {
      try {
        const stored = sessionStorage.getItem('lc_active_booking');
        if (stored) this._activeBooking = JSON.parse(stored);
      } catch (_) {}
    }

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const lawyerId = (this._activeBooking && this._activeBooking.lawyerId) || urlParams.get('lawyerId') || 'law_adv_padam';
    const lawyer = await UserApiClient.getLawyerById(lawyerId);
    const activeCase = UserStore.getActiveCase();
    const user = UserStore.getUser();

    const clientName = user.fullName || user.name || 'Padam Kishore';
    const clientEmail = user.email || 'padamkishore90@gmail.com';
    const clientPhone = user.mobile || user.phone || '9876543210';
    const clientCity = user.city || 'Jaipur';
    const clientState = user.state || 'Rajasthan';

    const bookingPayload = {
      userId: user.id || 'usr_mtlac008z0vvsq',
      email: clientEmail,
      clientName: clientName,
      clientPhone: clientPhone,
      clientCity: clientCity,
      clientState: clientState,
      lawyerId: lawyerId,
      caseId: (this._activeBooking && this._activeBooking.caseId) || (activeCase ? activeCase.id : null),
      date: (this._activeBooking && this._activeBooking.date) || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      time: (this._activeBooking && this._activeBooking.slot) || '10:00 AM',
      mode: (this._activeBooking && this._activeBooking.mode) || 'video',
      fee: amount - 50,
      platformFee: 50,
      total: amount,
      caseCategory: activeCase ? (activeCase.category || activeCase.type) : (lawyer ? lawyer.specialization : 'General Legal Consultation'),
      notes: activeCase ? (activeCase.description || activeCase.title) : 'Client requested consultation regarding legal advisory.',
      summary: {
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        clientCity: clientCity,
        clientState: clientState,
        category: activeCase ? (activeCase.category || activeCase.type) : (lawyer ? lawyer.specialization : 'General Legal Consultation'),
        notes: activeCase ? (activeCase.description || activeCase.title) : 'Client requested consultation regarding legal advisory.'
      }
    };

    const serverConsult = await UserApiClient.bookConsultation(bookingPayload);

    Utils.showToast(`Booking Confirmed! Notification dispatched to ${lawyer ? lawyer.name : 'Advocate'}.`, 'success');

    // Add consultation to store
    const consults = UserStore.getConsultations();
    const newConsult = {
      id: serverConsult.id,
      lawyerId: lawyerId,
      lawyerName: lawyer ? lawyer.name : 'Advocate',
      date: serverConsult.date || bookingPayload.date,
      time: serverConsult.time || bookingPayload.time,
      type: (serverConsult.mode || bookingPayload.mode || 'video').toUpperCase(),
      status: 'pending',
      fee: amount - 50,
      platformFee: 50,
      total: amount
    };
    consults.unshift(newConsult);
    UserStore.set('consultations', consults);

    // Save as My Lawyer
    if (lawyer) {
      UserStore.set('myLawyer', lawyer);
    }

    // Refresh notifications
    UserApiClient.fetchNotifications().then(notifs => {
      if (notifs && notifs.length) UserStore.set('notifications', notifs);
    });

    Router.navigate(`/consultation/prep?consultId=${newConsult.id}`);
  },

  /* ==================== 7. PRE-CONSULTATION QUESTIONS (STEP 31) ==================== */
  renderPreConsultationPrep(consultId) {
    const content = `
      <div style="max-width:700px;margin:0 auto">
        <div style="text-align:center;margin-bottom:28px">
          <div class="u-success-icon"><span class="material-symbols-rounded">check</span></div>
          <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:4px">Booking Confirmed!</h2>
          <p style="font-size:0.85rem;color:var(--u-text-tertiary)">Here are suggested questions to ask during your consultation to get the most value.</p>
        </div>

        <div class="u-card" style="margin-bottom:24px">
          <h3 class="u-section-title">
            <span class="material-symbols-rounded" style="color:var(--u-accent-light);font-size:20px;vertical-align:middle">psychology</span>
            Suggested Questions For Your Lawyer
          </h3>
          <div class="u-checklist">
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">What are the strongest points in my property dispute?</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">What additional documents should I retrieve from the revenue registry?</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">How long does a typical partition suit take in this district court?</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">Can we apply for an immediate injunction / stay order against construction?</div>
            </div>
            <div class="u-checklist-item" onclick="this.classList.toggle('checked')">
              <div class="u-checklist-check"><span class="material-symbols-rounded">check</span></div>
              <div class="u-checklist-text">What will be the total estimated fee for drafting and courtroom appearances?</div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="u-btn u-btn-primary u-btn-lg u-btn-pill" style="flex:1"
                  onclick="Router.navigate('/consultation/consult_1')">
            <span class="material-symbols-rounded" style="font-size:20px">videocam</span>
            Enter Virtual Meeting Room
          </button>
          <button class="u-btn u-btn-secondary u-btn-lg u-btn-pill" onclick="Router.navigate('/home')">
            Back to Home
          </button>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Consultation Prep', true);
  },

  /* ==================== 8. CONSULTATION ROOM (STEP 30) ==================== */
  renderConsultationRoom(consultId) {
    const myLawyer = UserStore.getLawyer() || { name: 'Adv. Padam Kishore', specialization: 'Corporate & Constitutional Law' };
    const initials = (myLawyer.name || 'Advocate').split(' ').map(n => n[0]).slice(0, 2).join('');

    const content = `
      <div class="u-consult-room">
        <!-- Main Video Screen -->
        <div class="u-consult-video">
          <div class="u-consult-video-placeholder">
            <div style="width:80px;height:80px;border-radius:50%;background:var(--u-accent-gradient);display:grid;place-items:center;margin:0 auto 16px;font-size:2rem;font-weight:800;color:#fff">
              ${initials}
            </div>
            <h3 style="font-size:1.2rem;font-weight:700;color:#fff">${Utils.escapeHtml(myLawyer.name)}</h3>
            <p style="font-size:0.85rem;color:var(--u-emerald-light);margin-top:4px">● Connected (Encrypted 1080p Stream)</p>
          </div>

          <!-- Video Controls -->
          <div class="u-consult-controls">
            <button class="u-consult-ctrl-btn" onclick="this.classList.toggle('active')" title="Mute/Unmute">
              <span class="material-symbols-rounded">mic</span>
            </button>
            <button class="u-consult-ctrl-btn" onclick="this.classList.toggle('active')" title="Camera">
              <span class="material-symbols-rounded">videocam</span>
            </button>
            <button class="u-consult-ctrl-btn" title="Share Screen">
              <span class="material-symbols-rounded">screen_share</span>
            </button>
            <button class="u-consult-ctrl-btn" title="Case Documents" onclick="document.getElementById('consult-doc-panel').classList.toggle('active')">
              <span class="material-symbols-rounded">folder</span>
            </button>
            <button class="u-consult-ctrl-btn danger" onclick="UserLawyerPage.endConsultation('${consultId}')" title="End Call">
              <span class="material-symbols-rounded">call_end</span>
            </button>
          </div>
        </div>

        <!-- Sidebar Notes & Case Details -->
        <div class="u-consult-sidebar">
          <div class="u-card" style="flex:1;display:flex;flex-direction:column">
            <h4 class="u-section-title">Consultation Notes</h4>
            <textarea class="u-textarea" style="flex:1;resize:none" placeholder="Take notes during your call here... (Automatically saved to your case vault)"></textarea>
          </div>

          <div class="u-card">
            <h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px">Case Shared: Legal Consultation</h4>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="u-badge u-badge-accent">Live Advisory</span>
              <span class="u-badge u-badge-emerald">256-Bit Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Consultation in Progress', true);
  },

  async endConsultation(consultId) {
    const confirm = await Utils.showConfirm('End Consultation', 'Are you sure you want to conclude the call? A consultation summary will be generated for your records.', { confirmText: 'End Call', type: 'danger' });
    if (confirm) {
      Router.navigate(`/consultation/${consultId}/summary`);
    }
  },

  /* ==================== 9. POST-CONSULTATION SUMMARY (STEP 32) ==================== */
  renderConsultationSummary(consultId) {
    const myLawyer = UserStore.getLawyer() || { name: 'Adv. Padam Kishore', specialization: 'Corporate & Constitutional Law' };
    const summary = {
      mainIssue: 'Contractual dispute, compliance review and civil partition advisement',
      importantDocs: 'Registered deeds, statutory notices, revenue land registry verification records',
      nextSteps: 'Advocate will draft formal legal notice and prepare courtroom submission within 3 working days',
      thingsToPrep: 'Collect Khata extract, stamp receipts, and prior correspondence',
      lawyerName: myLawyer.name
    };

    const content = `
      <div style="max-width:760px;margin:0 auto">
        <div style="text-align:center;margin-bottom:28px">
          <div class="u-success-icon"><span class="material-symbols-rounded">article</span></div>
          <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:4px">Post-Consultation Legal Summary</h2>
          <p style="font-size:0.85rem;color:var(--u-text-tertiary)">Recorded consultation with <strong>${Utils.escapeHtml(summary.lawyerName)}</strong></p>
        </div>

        <div class="u-card" style="margin-bottom:20px">
          <h4 class="u-section-title" style="color:var(--u-accent-light)">Key Discussion & Legal Opinion</h4>
          <p style="font-size:0.88rem;color:var(--u-text-secondary);line-height:1.6;margin-bottom:16px">
            ${Utils.escapeHtml(summary.mainIssue)}
          </p>

          <div style="display:flex;flex-direction:column;gap:14px">
            <div style="padding:12px;background:rgba(99,102,241,0.05);border-radius:var(--u-radius-sm);border:1px solid rgba(99,102,241,0.15)">
              <div style="font-size:0.75rem;font-weight:700;color:var(--u-accent-light);text-transform:uppercase;margin-bottom:4px">📋 Next Action Steps</div>
              <div style="font-size:0.85rem;color:var(--u-text-primary)">${Utils.escapeHtml(summary.nextSteps)}</div>
            </div>

            <div style="padding:12px;background:rgba(245,158,11,0.05);border-radius:var(--u-radius-sm);border:1px solid rgba(245,158,11,0.15)">
              <div style="font-size:0.75rem;font-weight:700;color:var(--u-amber-light);text-transform:uppercase;margin-bottom:4px">📑 Documents to Retrieve</div>
              <div style="font-size:0.85rem;color:var(--u-text-primary)">${Utils.escapeHtml(summary.importantDocs)}</div>
            </div>

            <div style="padding:12px;background:rgba(16,185,129,0.05);border-radius:var(--u-radius-sm);border:1px solid rgba(16,185,129,0.15)">
              <div style="font-size:0.75rem;font-weight:700;color:var(--u-emerald-light);text-transform:uppercase;margin-bottom:4px">💡 Client Preparation</div>
              <div style="font-size:0.85rem;color:var(--u-text-primary)">${Utils.escapeHtml(summary.thingsToPrep)}</div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="u-btn u-btn-primary u-btn-pill" onclick="Utils.showToast('Saved to Case Vault!', 'success');Router.navigate('/case')">
            <span class="material-symbols-rounded" style="font-size:18px">save</span> Save to Case Vault
          </button>
          <button class="u-btn u-btn-secondary u-btn-pill" onclick="Router.navigate('/my-lawyer')">
            <span class="material-symbols-rounded" style="font-size:18px">person</span> Go to My Lawyer
          </button>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'Consultation Summary', true);
  },

  /* ==================== 10. MY LAWYER (STEP 45) ==================== */
  renderMyLawyer() {
    const l = UserStore.getLawyer();
    if (!l) {
      return UserComponents.AppLayout(
        UserComponents.EmptyState('person_off', 'No Lawyer Assigned', 'Find and book a verified advocate for your case.', 'Find Lawyers', "Router.navigate('/lawyers')"),
        'lawyers', 'My Lawyer'
      );
    }

    const courtsDisplay = Array.isArray(l.courts) ? l.courts.join(', ') : (l.courts || 'District Court');
    const content = `
      <div style="max-width:760px;margin:0 auto">
        <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:20px">Your Retained Lawyer</h2>

        <div class="u-my-lawyer">
          <div class="u-lawyer-avatar" style="width:72px;height:72px;font-size:1.6rem;margin:0 auto 16px">
            ${(l.name || 'Advocate').split(' ').map(n => n[0]).slice(0, 2).join('')}
            <div class="u-lawyer-verified"><span class="material-symbols-rounded">verified</span></div>
          </div>
          <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:4px">${Utils.escapeHtml(l.name)}</h3>
          <p style="font-size:0.85rem;color:var(--u-accent-light);font-weight:600">${Utils.escapeHtml(l.specialization)}</p>
          <p style="font-size:0.78rem;color:var(--u-text-tertiary);margin-top:2px">📍 ${courtsDisplay}, ${Utils.escapeHtml(l.city || 'Jaipur')}</p>

          <div class="u-my-lawyer-actions">
            <div class="u-my-lawyer-action" onclick="Router.navigate('/chat')">
              <span class="material-symbols-rounded">chat</span>
              <span>Message</span>
            </div>
            <div class="u-my-lawyer-action" onclick="Router.navigate('/consultation/book?lawyerId=${l.id}')">
              <span class="material-symbols-rounded">videocam</span>
              <span>Schedule Call</span>
            </div>
            <div class="u-my-lawyer-action" onclick="Router.navigate('/case')">
              <span class="material-symbols-rounded">folder_shared</span>
              <span>Case Vault</span>
            </div>
          </div>
        </div>

        <div class="u-card" style="margin-top:24px">
          <h4 class="u-section-title">Recent Lawyer Updates</h4>
          <div class="u-notif-item">
            <div class="u-notif-icon lawyer"><span class="material-symbols-rounded">draw</span></div>
            <div class="u-notif-content">
              <div class="u-notif-text"><strong>${Utils.escapeHtml(l.name)}</strong> confirmed your consultation engagement.</div>
              <div class="u-notif-time">Recent</div>
            </div>
          </div>
          <div class="u-notif-item">
            <div class="u-notif-icon document"><span class="material-symbols-rounded">task_alt</span></div>
            <div class="u-notif-content">
              <div class="u-notif-text">Case file established and encrypted under advocate management.</div>
              <div class="u-notif-time">Recent</div>
            </div>
          </div>
        </div>
      </div>
    `;

    return UserComponents.AppLayout(content, 'lawyers', 'My Lawyer');
  }
};
