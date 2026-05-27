// ─── New Invoice / Edit Invoice Page ───
async function renderNewInvoice(container) {
  const buyersRes = await window.electronAPI.getBuyers();
  const buyers = buyersRes.success ? buyersRes.data : [];
  const sellerRes = await window.electronAPI.getSeller();
  const seller = sellerRes.success ? sellerRes.data : null;
  const nextNoRes = await window.electronAPI.getNextInvoiceNumber();
  const nextNo = nextNoRes.success ? nextNoRes.data : 'INV-0001';
  const today = new Date().toISOString().split('T')[0];

  let invoice = null;
  if (editingInvoiceId) {
    const r = await window.electronAPI.getInvoiceById(editingInvoiceId);
    if (r.success) invoice = r.data;
  }

  const isEdit = !!invoice;
  const title = isEdit ? `Edit Invoice: ${invoice.invoice_no}` : 'Create New Invoice';

  const buyerOptions = buyers.map(b => `<option value="${b.id}" ${invoice && invoice.buyer_id == b.id ? 'selected' : ''}>${b.name} - ${b.gstin || 'No GSTIN'}</option>`).join('');

  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">${title}</h1><p class="page-subtitle">${isEdit ? 'Update invoice details' : 'Fill in the details below'}</p></div>
    </div>
    <div class="card"><div class="card-body">
      <div class="form-section">
        <div class="form-section-title">📋 Invoice Details</div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Invoice No.</label><input type="text" class="form-input" id="inv-no" value="${invoice ? invoice.invoice_no : nextNo}"></div>
          <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="inv-date" value="${invoice ? invoice.date : today}"></div>
          <div class="form-group"><label class="form-label">Delivery Note</label><input type="text" class="form-input" id="inv-delivery-note" value="${invoice ? invoice.delivery_note || '' : ''}"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Reference No.</label><input type="text" class="form-input" id="inv-ref-no" value="${invoice ? invoice.reference_no || '' : ''}"></div>
          <div class="form-group"><label class="form-label">Buyer's Order No.</label><input type="text" class="form-input" id="inv-buyer-order" value="${invoice ? invoice.buyer_order_no || '' : ''}"></div>
          <div class="form-group"><label class="form-label">Dispatch Doc No.</label><input type="text" class="form-input" id="inv-dispatch-doc" value="${invoice ? invoice.dispatch_doc_no || '' : ''}"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Dispatched Through</label><input type="text" class="form-input" id="inv-dispatched-through" value="${invoice ? invoice.dispatched_through || '' : ''}"></div>
          <div class="form-group"><label class="form-label">Destination</label><input type="text" class="form-input" id="inv-destination" value="${invoice ? invoice.destination || '' : ''}"></div>
          <div class="form-group"><label class="form-label">Vehicle No.</label><input type="text" class="form-input" id="inv-vehicle" value="${invoice ? invoice.vehicle_no || '' : ''}"></div>
        </div>
        <div class="form-group"><label class="form-label">Terms of Delivery</label><input type="text" class="form-input" id="inv-terms" value="${invoice ? invoice.terms_of_delivery || '' : ''}"></div>
      </div>

      <div class="form-section">
        <div class="form-section-title">👤 Buyer / Consignee</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Select Buyer</label>
            <select class="form-select" id="inv-buyer-select"><option value="">— Enter new buyer —</option>${buyerOptions}</select>
          </div>
          <div class="form-group" style="display:flex;align-items:end;gap:8px;">
            <label class="checkbox-wrapper"><input type="checkbox" id="inv-save-buyer"> <span style="font-size:13px;">Save this buyer for future use</span></label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Buyer Name</label><input type="text" class="form-input" id="inv-buyer-name" value="${invoice ? invoice.buyer_name || '' : ''}"></div>
          <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-input" id="inv-buyer-gstin" value="${invoice ? invoice.buyer_gstin || '' : ''}"></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><textarea class="form-textarea" id="inv-buyer-address" rows="2">${invoice ? invoice.buyer_address || '' : ''}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">State</label><input type="text" class="form-input" id="inv-buyer-state" value="${invoice ? invoice.buyer_state_name || '' : ''}"></div>
          <div class="form-group"><label class="form-label">State Code</label><input type="text" class="form-input" id="inv-buyer-state-code" value="${invoice ? invoice.buyer_state_code || '' : ''}"></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">📦 Line Items</div>
        <table class="items-table">
          <thead><tr><th class="col-sl">Sl.</th><th class="col-desc">Description</th><th class="col-hsn">HSN/SAC</th><th class="col-qty">Qty</th><th class="col-unit">Unit</th><th class="col-rate">Rate</th><th class="col-amt">Amount</th><th class="col-action"></th></tr></thead>
          <tbody id="inv-items-body"></tbody>
        </table>
        <button class="btn btn-secondary btn-sm" id="inv-add-row" style="margin-top:12px;">+ Add Row</button>
      </div>

      <div class="gst-summary">
        <table class="gst-summary-table">
          <tr><td>Taxable Value</td><td id="inv-taxable">₹0</td></tr>
          <tr><td>CGST @ 2.5%</td><td id="inv-cgst">₹0</td></tr>
          <tr><td>SGST @ 2.5%</td><td id="inv-sgst">₹0</td></tr>
          <tr class="total-row"><td>Total Amount</td><td id="inv-total">₹0</td></tr>
        </table>
      </div>
      <div class="amount-words"><div class="amount-words-label">Amount in Words</div><div class="amount-words-value" id="inv-words">INR Zero Only</div></div>
      <div class="amount-words" style="margin-top:8px;"><div class="amount-words-label">Tax Amount in Words</div><div class="amount-words-value" id="inv-tax-words">INR Zero Only</div></div>

      <div class="invoice-actions">
        <button class="btn btn-secondary" id="inv-cancel">Cancel</button>
        <button class="btn btn-primary" id="inv-save">${isEdit ? 'Update Invoice' : 'Save Invoice'}</button>
        ${isEdit ? `<button class="btn btn-primary" id="inv-pdf" style="background:#2563eb;color:#fff;">Generate PDF</button>` : '<button class="btn btn-primary" id="inv-save-pdf" style="background:#16a34a;color:#fff;">Save & Generate PDF</button>'}
      </div>
    </div></div>`;

  // Buyer select handler
  document.getElementById('inv-buyer-select').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) { ['inv-buyer-name','inv-buyer-gstin','inv-buyer-address','inv-buyer-state','inv-buyer-state-code'].forEach(f => document.getElementById(f).value = ''); return; }
    const r = await window.electronAPI.getBuyerById(parseInt(id));
    if (r.success && r.data) {
      document.getElementById('inv-buyer-name').value = r.data.name || '';
      document.getElementById('inv-buyer-gstin').value = r.data.gstin || '';
      document.getElementById('inv-buyer-address').value = r.data.address || '';
      document.getElementById('inv-buyer-state').value = r.data.state_name || '';
      document.getElementById('inv-buyer-state-code').value = r.data.state_code || '';
    }
  });

  // Line items
  let itemCount = 0;
  function addItemRow(item) {
    itemCount++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${item ? item.sl_no : itemCount}" class="item-sl" readonly style="background:#f0f2f5;text-align:center;"></td>
      <td><input type="text" value="${item ? item.description || '' : ''}" class="item-desc" placeholder="Description"></td>
      <td><input type="text" value="${item ? item.hsn_sac || '' : ''}" class="item-hsn" placeholder="HSN/SAC"></td>
      <td><input type="number" value="${item ? item.quantity || '' : ''}" class="item-qty" step="any" placeholder="0"></td>
      <td><input type="text" value="${item ? item.unit || 'kgs' : 'kgs'}" class="item-unit"></td>
      <td><input type="number" value="${item ? item.rate || '' : ''}" class="item-rate" step="any" placeholder="0"></td>
      <td><input type="text" value="${item ? formatAmtPlain(item.amount) : ''}" class="item-amt" readonly style="background:#f0f2f5;font-weight:600;"></td>
      <td><button class="btn btn-danger btn-sm remove-row" style="padding:4px 8px;">&times;</button></td>`;
    document.getElementById('inv-items-body').appendChild(tr);
    tr.querySelector('.item-qty').addEventListener('input', () => calcRow(tr));
    tr.querySelector('.item-rate').addEventListener('input', () => calcRow(tr));
    tr.querySelector('.remove-row').addEventListener('click', () => { tr.remove(); reNumber(); calcTotals(); });
  }

  function formatAmtPlain(n) { return n ? parseFloat(n).toFixed(2) : ''; }

  function calcRow(tr) {
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(tr.querySelector('.item-rate').value) || 0;
    tr.querySelector('.item-amt').value = (qty * rate).toFixed(2);
    calcTotals();
  }

  function reNumber() {
    document.querySelectorAll('#inv-items-body tr').forEach((tr, i) => { tr.querySelector('.item-sl').value = i + 1; });
    itemCount = document.querySelectorAll('#inv-items-body tr').length;
  }

  function calcTotals() {
    let taxable = 0;
    document.querySelectorAll('#inv-items-body tr').forEach(tr => { taxable += parseFloat(tr.querySelector('.item-amt').value) || 0; });
    const cgst = taxable * 0.025;
    const sgst = taxable * 0.025;
    const total = taxable + cgst + sgst;
    document.getElementById('inv-taxable').textContent = formatIndianNumber(taxable);
    document.getElementById('inv-cgst').textContent = formatIndianNumber(cgst);
    document.getElementById('inv-sgst').textContent = formatIndianNumber(sgst);
    document.getElementById('inv-total').textContent = formatIndianNumber(total);
    document.getElementById('inv-words').textContent = numberToIndianWords(total);
    document.getElementById('inv-tax-words').textContent = numberToIndianWords(cgst + sgst);
  }

  document.getElementById('inv-add-row').addEventListener('click', () => addItemRow(null));

  // Load existing items or add one empty row
  if (invoice && invoice.items) { invoice.items.forEach(item => addItemRow(item)); calcTotals(); }
  else addItemRow(null);

  // Collect form data
  function collectData() {
    const items = [];
    document.querySelectorAll('#inv-items-body tr').forEach(tr => {
      items.push({
        sl_no: parseInt(tr.querySelector('.item-sl').value) || 0,
        description: tr.querySelector('.item-desc').value,
        hsn_sac: tr.querySelector('.item-hsn').value,
        quantity: parseFloat(tr.querySelector('.item-qty').value) || 0,
        unit: tr.querySelector('.item-unit').value,
        rate: parseFloat(tr.querySelector('.item-rate').value) || 0,
        amount: parseFloat(tr.querySelector('.item-amt').value) || 0,
      });
    });
    let taxable = items.reduce((s, i) => s + i.amount, 0);
    const cgst = taxable * 0.025, sgst = taxable * 0.025;
    return {
      invoice_no: document.getElementById('inv-no').value,
      date: document.getElementById('inv-date').value,
      delivery_note: document.getElementById('inv-delivery-note').value,
      reference_no: document.getElementById('inv-ref-no').value,
      buyer_order_no: document.getElementById('inv-buyer-order').value,
      dispatch_doc_no: document.getElementById('inv-dispatch-doc').value,
      dispatched_through: document.getElementById('inv-dispatched-through').value,
      destination: document.getElementById('inv-destination').value,
      vehicle_no: document.getElementById('inv-vehicle').value,
      terms_of_delivery: document.getElementById('inv-terms').value,
      seller_id: seller ? seller.id : null,
      buyer_id: document.getElementById('inv-buyer-select').value ? parseInt(document.getElementById('inv-buyer-select').value) : null,
      taxable_value: taxable, cgst_amount: cgst, sgst_amount: sgst, total_amount: taxable + cgst + sgst,
      items: items,
    };
  }

  async function saveBuyerIfNeeded(data) {
    const buyerName = document.getElementById('inv-buyer-name').value.trim();
    // Always save buyer if name is filled and no existing buyer selected
    if (buyerName && !data.buyer_id) {
      const bRes = await window.electronAPI.saveBuyer({
        name: buyerName,
        address: document.getElementById('inv-buyer-address').value,
        gstin: document.getElementById('inv-buyer-gstin').value,
        state_name: document.getElementById('inv-buyer-state').value,
        state_code: document.getElementById('inv-buyer-state-code').value,
      });
      if (bRes.success) data.buyer_id = bRes.id;
    }
    return data;
  }

  // Save
  document.getElementById('inv-save').addEventListener('click', async () => {
    let data = collectData();
    if (!data.invoice_no || !data.date) return showToast('Invoice No. and Date are required', 'error');
    data = await saveBuyerIfNeeded(data);
    const res = isEdit
      ? await window.electronAPI.updateInvoice(editingInvoiceId, data)
      : await window.electronAPI.saveInvoice(data);
    if (res.success) { showToast(isEdit ? 'Invoice updated!' : 'Invoice saved!'); editingInvoiceId = null; navigateTo('dashboard'); }
    else showToast(res.error, 'error');
  });

  // Save & PDF (new only)
  const savePdfBtn = document.getElementById('inv-save-pdf');
  if (savePdfBtn) savePdfBtn.addEventListener('click', async () => {
    let data = collectData();
    if (!data.invoice_no || !data.date) return showToast('Invoice No. and Date are required', 'error');
    data = await saveBuyerIfNeeded(data);
    const res = await window.electronAPI.saveInvoice(data);
    if (res.success) { showToast('Invoice saved!'); await generatePdf(res.id); editingInvoiceId = null; navigateTo('dashboard'); }
    else showToast(res.error, 'error');
  });

  // PDF (edit only)
  const pdfBtn = document.getElementById('inv-pdf');
  if (pdfBtn) pdfBtn.addEventListener('click', () => generatePdf(editingInvoiceId));

  document.getElementById('inv-cancel').addEventListener('click', () => { editingInvoiceId = null; navigateTo('dashboard'); });
}
