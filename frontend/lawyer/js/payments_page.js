/* ============================================================
   Nyay Setu — EARNINGS & PAYMENTS
   payments_page.js — Fee split transparency, earnings summary,
   settlement ledger with real CSV export.
   ============================================================ */

const PaymentsPage = {
  render() {
    const txns = Store.getState('transactions') || [];
    const totalEarned = Store.getTotalEarnings();
    const monthlyEarned = Store.getMonthlyEarnings();
    const weeklyEarned = Store.getWeeklyEarnings();
    const todayEarned = Store.getTodayEarnings();

    const contentHtml = `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">Earnings & Settlements</h2>
          <p class="page-subtitle">Consultation fees, platform deductions and payout history</p>
        </div>
        <button class="btn btn-secondary" onclick="PaymentsPage.exportCsv()" ${txns.length === 0 ? 'disabled' : ''}>
          <span class="material-symbols-rounded">download</span> Export Statement
        </button>
      </div>

      <!-- Earnings overview -->
      <div class="earnings-overview">
        <div class="earnings-card">
          <div class="earnings-card-title">Today</div>
          <div class="earnings-card-value">${Utils.formatCurrency(todayEarned)}</div>
          <div class="earnings-card-trend"><span class="material-symbols-rounded icon-sm">today</span> Net of platform fee</div>
        </div>
        <div class="earnings-card">
          <div class="earnings-card-title">This Week</div>
          <div class="earnings-card-value">${Utils.formatCurrency(weeklyEarned)}</div>
          <div class="earnings-card-trend"><span class="material-symbols-rounded icon-sm">date_range</span> Net earnings</div>
        </div>
        <div class="earnings-card">
          <div class="earnings-card-title">This Month</div>
          <div class="earnings-card-value">${Utils.formatCurrency(monthlyEarned)}</div>
          <div class="earnings-card-trend"><span class="material-symbols-rounded icon-sm">calendar_month</span> Settled transactions</div>
        </div>
        <div class="earnings-card">
          <div class="earnings-card-title">Lifetime</div>
          <div class="earnings-card-value">${Utils.formatCurrency(totalEarned)}</div>
          <div class="earnings-card-trend"><span class="material-symbols-rounded icon-sm">verified</span> All completed payouts</div>
        </div>
      </div>

      <!-- Transparent fee model -->
      <div class="fee-breakdown-card">
        <h4 class="card-title mb-3">How the Fee Split Works</h4>
        <div class="breakdown-row"><span>Consultation fee paid by client</span><span>100%</span></div>
        <div class="breakdown-row"><span>Platform & virtual room infrastructure fee</span><span style="color:var(--color-error)">− 10%</span></div>
        <div class="breakdown-row total"><span>Your net earning per consultation</span><span style="color:var(--color-accent);font-size:18px">90%</span></div>
        <p class="text-body-sm text-muted mt-2">Payouts settle to your registered bank account. Payment gateway integration is pending deployment; entries below track the ledger.</p>
      </div>

      <!-- Transactions ledger -->
      <div class="transactions-container">
        <div class="transactions-header">
          <h3 class="card-title">Settlement History</h3>
          <span class="badge badge-accent">${txns.length} transaction${txns.length === 1 ? '' : 's'}</span>
        </div>

        ${txns.length === 0 ? Components.emptyState('receipt_long', 'No transactions yet', 'Completed consultations will create ledger entries here automatically.') : `
        <div class="data-table table-scroll-x">
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Service</th><th>Date</th><th>Gross</th><th>Platform Fee</th><th>Net Earning</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${txns.slice(0, 15).map(t => `
                <tr>
                  <td><strong>${Utils.escapeHtml(t.clientName)}</strong></td>
                  <td>${Utils.escapeHtml(t.service)}</td>
                  <td>${Utils.formatDate(t.date)}</td>
                  <td>${Utils.formatCurrency(t.amount)}</td>
                  <td style="color:var(--color-gray-500)">− ${Utils.formatCurrency(t.platformFee)}</td>
                  <td class="txn-amount-positive">${Utils.formatCurrency(t.netEarnings)}</td>
                  <td>
                    <span class="badge ${t.paymentStatus === 'completed' ? 'badge-success' : t.paymentStatus === 'pending' ? 'badge-warning' : 'badge-info'}">
                      ${t.paymentStatus.toUpperCase()}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
    `;

    return Components.AppLayout(contentHtml, 'payments', 'Earnings & Payments', ['Payments']);
  },

  async exportCsv() {
    try {
      await ApiClient.exportPaymentsCsv();
      Utils.showToast('Statement downloaded.', 'success');
    } catch (err) {
      Utils.showToast(err.message || 'Export failed.', 'error');
    }
  }
};
