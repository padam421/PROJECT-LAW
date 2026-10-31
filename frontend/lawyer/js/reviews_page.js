/* ============================================================
   Nyay Setu — CLIENT REVIEWS
   reviews_page.js — Read-only verified feedback with a real
   rating distribution computed from data.
   ============================================================ */

const ReviewsPage = {
  render() {
    const reviews = Store.getState('reviews') || [];
    const avgRating = Store.getAverageRating();
    const totalCount = reviews.length;

    // Compute the real distribution
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });
    const pct = n => totalCount ? Math.round((dist[n] / totalCount) * 100) : 0;

    const contentHtml = `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">Client Feedback</h2>
          <p class="page-subtitle">${Store.getState('sampleDataset') ? 'Includes clearly labelled fictional sample feedback for this private workspace.' : 'Verified post-consultation reviews — read-only, cannot be edited by advocates'}</p>
        </div>
      </div>

      ${totalCount === 0 ? Components.emptyState('reviews', 'No reviews yet', 'Clients can rate and review you after completed consultations.') : `
      <!-- Rating overview -->
      <div class="reviews-overview-card">
        <div class="reviews-score-block">
          <div class="reviews-big-score">${avgRating}</div>
          <div class="star-rating" aria-label="${avgRating} out of 5 stars">
            ${[1,2,3,4,5].map(s => `<span class="star ${avgRating >= s - 0.4 ? 'filled' : ''}">★</span>`).join('')}
          </div>
          <div class="reviews-total-count">${totalCount} client review${totalCount === 1 ? '' : 's'}</div>
        </div>

        <div class="reviews-breakdown">
          ${[5,4,3].map(star => `
            <div class="rating-bar-row">
              <span class="rating-bar-label">${star} Stars</span>
              <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct(star)}%"></div></div>
              <span class="rating-bar-count">${pct(star)}%</span>
            </div>
          `).join('')}
          ${(dist[2] + dist[1]) > 0 ? `
            <div class="rating-bar-row">
              <span class="rating-bar-label">≤ 2 Stars</span>
              <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct(2) + pct(1)}%"></div></div>
              <span class="rating-bar-count">${pct(2) + pct(1)}%</span>
            </div>` : ''}
        </div>
      </div>

      <!-- Review cards -->
      <div class="reviews-list">
        ${reviews.map(r => `
          <div class="review-card">
            <div class="review-card-header">
              <div class="review-client-info">
                <div class="avatar avatar-sm">${Utils.escapeHtml((r.clientName || '').split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
                <div>
                  <div class="review-client-name">${Utils.escapeHtml(r.clientName)}</div>
                  <div class="review-date">${r.isSample ? 'Fictional sample review' : 'Verified consultation'} • ${Utils.formatDate(r.date)}</div>
                </div>
              </div>
              <div class="star-rating" aria-label="${r.rating} stars">
                ${[1,2,3,4,5].map(star => `<span class="star ${star <= r.rating ? 'filled' : ''}">★</span>`).join('')}
              </div>
            </div>

            <p class="review-text">“${Utils.escapeHtml(r.review)}”</p>

            ${r.wouldRecommend ? `
              <span class="review-recommend-badge">
                <span class="material-symbols-rounded icon-sm">thumb_up</span> ${r.isSample ? 'Sample recommendation' : 'Recommends this advocate'}
              </span>` : ''}
          </div>
        `).join('')}
      </div>`}
    `;

    return Components.AppLayout(contentHtml, 'reviews', 'Client Reviews', ['Reviews']);
  }
};
