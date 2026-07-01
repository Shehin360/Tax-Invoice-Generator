// renderer/reports.js

async function renderReports(container) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">GSTR-1 Summary</h2>
        <p class="page-subtitle">View taxable value and GST breakdown</p>
      </div>
      <div>
        <input type="month" id="report-month" class="form-input" style="width:200px; display:inline-block;" value="${defaultMonth}">
        <button class="btn btn-primary" id="btn-fetch-report" style="margin-left:8px;">Generate</button>
      </div>
    </div>

    <div class="card">
      <div style="overflow-x:auto;">
        <table class="table">
          <thead>
            <tr>
              <th>GST Rate</th>
              <th style="text-align:right;">Taxable Value</th>
              <th style="text-align:right;">Total GST</th>
              <th style="text-align:right;">Total Amount</th>
            </tr>
          </thead>
          <tbody id="report-table-body">
            <tr><td colspan="4" style="text-align:center;">Select a month and click Generate</td></tr>
          </tbody>
          <tfoot id="report-table-foot" style="display:none; font-weight:bold; background:var(--primary-light);">
            <tr>
              <td>Total</td>
              <td id="rpt-total-taxable" style="text-align:right;"></td>
              <td id="rpt-total-gst" style="text-align:right;"></td>
              <td id="rpt-total-amt" style="text-align:right;"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-fetch-report').addEventListener('click', loadReport);
  // Auto load
  loadReport();
}

async function loadReport() {
  const month = document.getElementById('report-month').value;
  const tbody = document.getElementById('report-table-body');
  const tfoot = document.getElementById('report-table-foot');

  if (!month) {
    showToast('Please select a month', 'error');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
  tfoot.style.display = 'none';

  const res = await window.electronAPI.getGstr1Summary(month);
  if (!res.success) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger)">Error: ${res.error}</td></tr>`;
    return;
  }

  const data = res.data;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted);">No data found for the selected month.</td></tr>';
    return;
  }

  let totTax = 0;
  let totGst = 0;

  tbody.innerHTML = data.map(r => {
    totTax += r.taxable_value || 0;
    totGst += r.total_gst || 0;
    const totalAmt = (r.taxable_value || 0) + (r.total_gst || 0);
    return `
      <tr>
        <td>${r.gst_rate}%</td>
        <td style="text-align:right;">₹${(r.taxable_value || 0).toFixed(2)}</td>
        <td style="text-align:right;">₹${(r.total_gst || 0).toFixed(2)}</td>
        <td style="text-align:right;">₹${totalAmt.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('rpt-total-taxable').textContent = `₹${totTax.toFixed(2)}`;
  document.getElementById('rpt-total-gst').textContent = `₹${totGst.toFixed(2)}`;
  document.getElementById('rpt-total-amt').textContent = `₹${(totTax + totGst).toFixed(2)}`;
  tfoot.style.display = '';
}
