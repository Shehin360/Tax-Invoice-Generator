// ─── Dashboard Page ───
async function renderDashboard(container) {
  const statsRes = await window.electronAPI.getDashboardStats();
  const stats = statsRes.success ? statsRes.data : { totalInvoices: 0, monthRevenue: 0, totalGst: 0 };
  const invRes = await window.electronAPI.getInvoices({});
  const invoices = invRes.success ? invRes.data : [];

  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Dashboard</h1><p class="page-subtitle">Overview of your invoicing activity</p></div>
      <button class="btn btn-primary" id="dash-new-invoice">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        New Invoice
      </button>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Invoices</div>
        <div class="stat-value">${stats.totalInvoices}</div>
        <div class="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This Month Revenue</div>
        <div class="stat-value">${formatIndianNumber(stats.monthRevenue)}</div>
        <div class="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total GST Collected</div>
        <div class="stat-value">${formatIndianNumber(stats.totalGst)}</div>
        <div class="stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Recent Invoices</h3>
      </div>
      <div class="search-bar" style="padding:16px 24px 0;">
        <div class="search-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input" id="dash-search" placeholder="Search by invoice no. or buyer name...">
        </div>
        <input type="date" class="form-input" id="dash-date-from" style="width:160px" placeholder="From">
        <input type="date" class="form-input" id="dash-date-to" style="width:160px" placeholder="To">
        <button class="btn btn-secondary btn-sm" id="dash-filter">Filter</button>
      </div>
      <div class="table-wrapper" style="padding:0 24px 24px;">
        <table>
          <thead><tr><th>Invoice No.</th><th>Date</th><th>Buyer</th><th>Total</th><th>Actions</th></tr></thead>
          <tbody id="dash-invoice-list">
            ${invoices.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-secondary);">No invoices yet. Create your first invoice!</td></tr>' : invoices.map(inv => `
              <tr>
                <td><strong>${inv.invoice_no}</strong></td>
                <td>${inv.date}</td>
                <td>${inv.buyer_name || '—'}</td>
                <td>${formatIndianNumber(inv.total_amount)}</td>
                <td><div class="actions-cell">
                  <button class="btn btn-icon btn-sm" onclick="previewInvoice(${inv.id})" title="Preview"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                  <button class="btn btn-icon btn-sm" onclick="generatePdf(${inv.id})" title="PDF"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                  <button class="btn btn-icon btn-sm" onclick="editInvoice(${inv.id})" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="btn btn-icon btn-sm btn-danger" onclick="deleteInvoiceConfirm(${inv.id})" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                </div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('dash-new-invoice').addEventListener('click', () => navigateTo('new-invoice'));
  document.getElementById('dash-filter').addEventListener('click', async () => {
    const filters = {
      search: document.getElementById('dash-search').value,
      dateFrom: document.getElementById('dash-date-from').value,
      dateTo: document.getElementById('dash-date-to').value
    };
    const r = await window.electronAPI.getInvoices(filters);
    if (r.success) { navigateTo('dashboard'); }
  });
  document.getElementById('dash-search').addEventListener('keyup', async (e) => {
    if (e.key === 'Enter') document.getElementById('dash-filter').click();
  });
}

async function generatePdf(id) {
  showToast('Generating PDF...', 'info');
  const res = await window.electronAPI.generatePDF(id);
  if (res.success) showToast('PDF saved successfully!');
  else showToast(res.error || 'PDF generation failed', 'error');
}

function editInvoice(id) {
  editingInvoiceId = id;
  navigateTo('new-invoice', { editId: id });
}

async function deleteInvoiceConfirm(id) {
  if (!confirm('Are you sure you want to delete this invoice?')) return;
  const res = await window.electronAPI.deleteInvoice(id);
  if (res.success) { showToast('Invoice deleted'); navigateTo('dashboard'); }
  else showToast(res.error, 'error');
}
