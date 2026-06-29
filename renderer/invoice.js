// ─── New Invoice / Edit Invoice Page ───

// GST rate options: [display label, total rate value]
const GST_RATE_OPTIONS = [
  { label: "0%", value: 0 },
  { label: "5% (2.5+2.5)", value: 5 },
  { label: "12% (6+6)", value: 12 },
  { label: "18% (9+9)", value: 18 },
  { label: "28% (14+14)", value: 28 },
];
const DEFAULT_GST_RATE = 5;

async function renderNewInvoice(container) {
  const buyersRes = await window.electronAPI.getBuyers();
  const buyers = buyersRes.success ? buyersRes.data : [];
  const sellerRes = await window.electronAPI.getSeller();
  const seller = sellerRes.success ? sellerRes.data : null;
  const today = new Date().toISOString().split("T")[0];

  let invoice = null;
  if (editingInvoiceId) {
    const r = await window.electronAPI.getInvoiceById(editingInvoiceId);
    if (r.success) invoice = r.data;
  }

  // Check for a saved draft (only for new invoices, not editing)
  const draft = !editingInvoiceId && hasDraft() ? loadDraft() : null;

  const isEdit = !!invoice;
  const title = isEdit
    ? `Edit Invoice: ${escapeHtml(invoice.invoice_no)}`
    : "Create New Invoice";

  const buyerOptions = buyers
    .map(
      (b) =>
        `<option value="${b.id}" ${invoice && invoice.buyer_id == b.id ? "selected" : ""} ${draft && draft.buyer_id == b.id ? "selected" : ""}>${escapeHtml(b.name)} - ${escapeHtml(b.gstin) || "No GSTIN"}</option>`,
    )
    .join("");

  // Determine initial values: draft > invoice (edit) > defaults
  const v = draft || invoice || {};
  let invNo = v.invoice_no;
  if (isEdit) {
    invNo = invoice.invoice_no;
  } else if (!invNo) {
    if (!window._newInvoiceNumber) {
      const nextNoRes = await window.electronAPI.getNextInvoiceNumber();
      window._newInvoiceNumber = nextNoRes.success
        ? nextNoRes.data
        : "INV-0001";
    }
    invNo = window._newInvoiceNumber;
  }
  const invDate = v.date || today;

  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">${title}</h1><p class="page-subtitle">${isEdit ? "Update invoice details" : draft ? "📝 Draft restored — continue where you left off" : "Fill in the details below"}</p></div>
    </div>
    <div class="card"><div class="card-body">
      <div class="form-section">
        <div class="form-section-title">📋 Invoice Details</div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Invoice No.</label><input type="text" class="form-input inv-track" id="inv-no" value="${escapeHtml(invNo)}"></div>
          <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input inv-track" id="inv-date" value="${escapeHtml(invDate)}"></div>
          <div class="form-group"><label class="form-label">Delivery Note</label><input type="text" class="form-input inv-track" id="inv-delivery-note" value="${escapeHtml(v.delivery_note || "")}"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Reference No.</label><input type="text" class="form-input inv-track" id="inv-ref-no" value="${escapeHtml(v.reference_no || "")}"></div>
          <div class="form-group"><label class="form-label">Buyer's Order No.</label><input type="text" class="form-input inv-track" id="inv-buyer-order" value="${escapeHtml(v.buyer_order_no || "")}"></div>
          <div class="form-group"><label class="form-label">Dispatch Doc No.</label><input type="text" class="form-input inv-track" id="inv-dispatch-doc" value="${escapeHtml(v.dispatch_doc_no || "")}"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Dispatched Through</label><input type="text" class="form-input inv-track" id="inv-dispatched-through" value="${escapeHtml(v.dispatched_through || "")}"></div>
          <div class="form-group"><label class="form-label">Destination</label><input type="text" class="form-input inv-track" id="inv-destination" value="${escapeHtml(v.destination || "")}"></div>
          <div class="form-group"><label class="form-label">Vehicle No.</label><input type="text" class="form-input inv-track" id="inv-vehicle" value="${escapeHtml(v.vehicle_no || "")}"></div>
        </div>
        <div class="form-group"><label class="form-label">Terms of Delivery</label><input type="text" class="form-input inv-track" id="inv-terms" value="${escapeHtml(v.terms_of_delivery || "")}"></div>
      </div>

      <div class="form-section">
        <div class="form-section-title">👤 Buyer / Consignee</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Select Buyer</label>
            <select class="form-select inv-track" id="inv-buyer-select"><option value="">— Enter new buyer —</option>${buyerOptions}</select>
          </div>
          <div class="form-group" style="display:flex;align-items:end;gap:8px;">
            <label class="checkbox-wrapper"><input type="checkbox" id="inv-save-buyer"> <span style="font-size:13px;">Save this buyer for future use</span></label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Buyer Name</label><input type="text" class="form-input inv-track" id="inv-buyer-name" value="${escapeHtml(v.buyer_name || "")}"></div>
          <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-input inv-track" id="inv-buyer-gstin" value="${escapeHtml(v.buyer_gstin || "")}" maxlength="15"></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><textarea class="form-textarea inv-track" id="inv-buyer-address" rows="2">${escapeHtml(v.buyer_address || "")}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">State</label><input type="text" class="form-input inv-track" id="inv-buyer-state" value="${escapeHtml(v.buyer_state_name || "")}"></div>
          <div class="form-group"><label class="form-label">State Code</label><input type="text" class="form-input inv-track" id="inv-buyer-state-code" value="${escapeHtml(v.buyer_state_code || "")}"></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">📦 Line Items</div>
        <table class="items-table">
          <thead><tr><th class="col-sl">Sl.</th><th class="col-desc">Description</th><th class="col-hsn">HSN/SAC</th><th class="col-qty">Qty</th><th class="col-unit">Unit</th><th class="col-rate">Rate</th><th class="col-gst">GST %</th><th class="col-amt">Amount</th><th class="col-action"></th></tr></thead>
          <tbody id="inv-items-body"></tbody>
        </table>
        <button class="btn btn-secondary btn-sm" id="inv-add-row" style="margin-top:12px;">+ Add Row</button>
      </div>

      <div class="gst-summary">
        <table class="gst-summary-table">
          <tr><td>Taxable Value</td><td id="inv-taxable">₹0</td></tr>
          <tbody id="inv-gst-breakdown"></tbody>
          <tr class="total-row"><td>Total Amount</td><td id="inv-total">₹0</td></tr>
        </table>
      </div>
      <div class="amount-words"><div class="amount-words-label">Amount in Words</div><div class="amount-words-value" id="inv-words">INR Zero Only</div></div>
      <div class="amount-words" style="margin-top:8px;"><div class="amount-words-label">Tax Amount in Words</div><div class="amount-words-value" id="inv-tax-words">INR Zero Only</div></div>

      <div class="invoice-actions">
        <button class="btn btn-secondary" id="inv-cancel">Cancel</button>
        <button class="btn btn-primary" id="inv-save">${isEdit ? "Update Invoice" : "Save Invoice"}</button>
        ${isEdit ? `<button class="btn btn-primary" id="inv-pdf" style="background:#2563eb;color:#fff;">Generate PDF</button>` : '<button class="btn btn-primary" id="inv-save-pdf" style="background:#16a34a;color:#fff;">Save & Generate PDF</button>'}
      </div>
    </div></div>`;

  // ─── Buyer select handler ───
  const buyerSelect = document.getElementById("inv-buyer-select");
  const saveBuyerCheckbox = document.getElementById("inv-save-buyer");

  function updateSaveBuyerCheckbox() {
    if (buyerSelect.value) {
      // Existing buyer selected — checkbox not needed
      saveBuyerCheckbox.checked = false;
      saveBuyerCheckbox.disabled = true;
    } else {
      // New buyer — enable checkbox
      saveBuyerCheckbox.disabled = false;
    }
  }

  buyerSelect.addEventListener("change", async (e) => {
    const id = e.target.value;
    updateSaveBuyerCheckbox();
    window._formDirty = true;
    if (!id) {
      [
        "inv-buyer-name",
        "inv-buyer-gstin",
        "inv-buyer-address",
        "inv-buyer-state",
        "inv-buyer-state-code",
      ].forEach((f) => (document.getElementById(f).value = ""));
      return;
    }
    const r = await window.electronAPI.getBuyerById(parseInt(id));
    if (r.success && r.data) {
      document.getElementById("inv-buyer-name").value = r.data.name || "";
      document.getElementById("inv-buyer-gstin").value = r.data.gstin || "";
      document.getElementById("inv-buyer-address").value = r.data.address || "";
      document.getElementById("inv-buyer-state").value =
        r.data.state_name || "";
      document.getElementById("inv-buyer-state-code").value =
        r.data.state_code || "";
    }
  });

  // Initialize checkbox state
  updateSaveBuyerCheckbox();

  // ─── Line items ───
  let itemCount = 0;

  function buildGstRateSelect(selectedRate) {
    const rate =
      selectedRate !== undefined && selectedRate !== null
        ? selectedRate
        : DEFAULT_GST_RATE;
    return GST_RATE_OPTIONS.map(
      (opt) =>
        `<option value="${opt.value}" ${opt.value === rate ? "selected" : ""}>${opt.label}</option>`,
    ).join("");
  }

  function addItemRow(item) {
    itemCount++;
    const tr = document.createElement("tr");
    const gstRate = item
      ? item.gst_rate !== undefined && item.gst_rate !== null
        ? item.gst_rate
        : DEFAULT_GST_RATE
      : DEFAULT_GST_RATE;
    tr.innerHTML = `
      <td><input type="text" value="${item ? item.sl_no : itemCount}" class="item-sl" readonly style="background:#f0f2f5;text-align:center;"></td>
      <td><input type="text" value="${item ? escapeHtml(item.description || "") : ""}" class="item-desc" placeholder="Description"></td>
      <td><input type="text" value="${item ? escapeHtml(item.hsn_sac || "") : ""}" class="item-hsn" placeholder="HSN/SAC"></td>
      <td><input type="number" value="${item ? item.quantity || "" : ""}" class="item-qty" step="any" placeholder="0"></td>
      <td><input type="text" value="${item ? escapeHtml(item.unit || "kgs") : "kgs"}" class="item-unit"></td>
      <td><input type="number" value="${item ? item.rate || "" : ""}" class="item-rate" step="any" placeholder="0"></td>
      <td><select class="item-gst-rate">${buildGstRateSelect(gstRate)}</select></td>
      <td><input type="text" value="${item ? formatAmtPlain(item.amount) : ""}" class="item-amt" readonly style="background:#f0f2f5;font-weight:600;"></td>
      <td><button class="btn btn-danger btn-sm remove-row" style="padding:4px 8px;">&times;</button></td>`;
    document.getElementById("inv-items-body").appendChild(tr);
    tr.querySelector(".item-qty").addEventListener("input", () => {
      calcRow(tr);
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    tr.querySelector(".item-rate").addEventListener("input", () => {
      calcRow(tr);
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    tr.querySelector(".item-gst-rate").addEventListener("change", () => {
      calcTotals();
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    tr.querySelector(".item-desc").addEventListener("input", () => {
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    tr.querySelector(".item-hsn").addEventListener("input", () => {
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    tr.querySelector(".item-unit").addEventListener("input", () => {
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    tr.querySelector(".remove-row").addEventListener("click", () => {
      tr.remove();
      reNumber();
      calcTotals();
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
  }

  function formatAmtPlain(n) {
    return n ? parseFloat(n).toFixed(2) : "";
  }

  function calcRow(tr) {
    const qty = parseFloat(tr.querySelector(".item-qty").value) || 0;
    const rate = parseFloat(tr.querySelector(".item-rate").value) || 0;
    tr.querySelector(".item-amt").value = (qty * rate).toFixed(2);
    calcTotals();
  }

  function reNumber() {
    document.querySelectorAll("#inv-items-body tr").forEach((tr, i) => {
      tr.querySelector(".item-sl").value = i + 1;
    });
    itemCount = document.querySelectorAll("#inv-items-body tr").length;
  }

  function calcTotals() {
    let taxable = 0;
    // Group tax amounts by GST rate
    const gstBreakdown = {}; // { rate: { taxable, cgst, sgst } }

    document.querySelectorAll("#inv-items-body tr").forEach((tr) => {
      const amt = parseFloat(tr.querySelector(".item-amt").value) || 0;
      const gstRate = parseFloat(tr.querySelector(".item-gst-rate").value) || 0;
      taxable += amt;

      if (!gstBreakdown[gstRate]) {
        gstBreakdown[gstRate] = { taxable: 0, cgst: 0, sgst: 0 };
      }
      gstBreakdown[gstRate].taxable += amt;
      gstBreakdown[gstRate].cgst += amt * (gstRate / 200);
      gstBreakdown[gstRate].sgst += amt * (gstRate / 200);
    });

    // Calculate total GST
    let totalCgst = 0,
      totalSgst = 0;
    for (const rate of Object.keys(gstBreakdown)) {
      totalCgst += gstBreakdown[rate].cgst;
      totalSgst += gstBreakdown[rate].sgst;
    }
    const total = taxable + totalCgst + totalSgst;

    // Update taxable value
    document.getElementById("inv-taxable").textContent =
      formatIndianNumber(taxable);

    // Build GST breakdown rows dynamically
    const breakdownBody = document.getElementById("inv-gst-breakdown");
    let breakdownHtml = "";
    const sortedRates = Object.keys(gstBreakdown).sort(
      (a, b) => parseFloat(a) - parseFloat(b),
    );
    for (const rate of sortedRates) {
      const r = parseFloat(rate);
      if (r === 0) continue; // No tax row for 0%
      const halfRate = (r / 2).toFixed(1).replace(/\.0$/, "");
      breakdownHtml += `<tr><td>CGST @ ${halfRate}%</td><td>${formatIndianNumber(gstBreakdown[rate].cgst)}</td></tr>`;
      breakdownHtml += `<tr><td>SGST @ ${halfRate}%</td><td>${formatIndianNumber(gstBreakdown[rate].sgst)}</td></tr>`;
    }
    breakdownBody.innerHTML = breakdownHtml;

    // Update total
    document.getElementById("inv-total").textContent =
      formatIndianNumber(total);
    document.getElementById("inv-words").textContent =
      numberToIndianWords(total);
    document.getElementById("inv-tax-words").textContent = numberToIndianWords(
      totalCgst + totalSgst,
    );
  }

  document.getElementById("inv-add-row").addEventListener("click", () => {
    addItemRow(null);
    window._formDirty = true;
  });

  // Load existing items, draft items, or add one empty row
  if (invoice && invoice.items) {
    invoice.items.forEach((item) => addItemRow(item));
    calcTotals();
  } else if (draft && draft.items && draft.items.length > 0) {
    draft.items.forEach((item) => addItemRow(item));
    calcTotals();
    showToast("Draft restored — continue where you left off", "info");
  } else {
    addItemRow(null);
  }

  // ─── Track form dirty state & Auto-Save ───
  // All inputs with class 'inv-track' set dirty on change and auto-save the draft
  container.querySelectorAll(".inv-track").forEach((el) => {
    el.addEventListener("input", () => {
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
    el.addEventListener("change", () => {
      window._formDirty = true;
      if (!editingInvoiceId) saveDraft(collectData());
    });
  });

  // ─── Collect form data ───
  function collectData() {
    const items = [];
    document.querySelectorAll("#inv-items-body tr").forEach((tr) => {
      items.push({
        sl_no: parseInt(tr.querySelector(".item-sl").value) || 0,
        description: tr.querySelector(".item-desc").value,
        hsn_sac: tr.querySelector(".item-hsn").value,
        quantity: parseFloat(tr.querySelector(".item-qty").value) || 0,
        unit: tr.querySelector(".item-unit").value,
        rate: parseFloat(tr.querySelector(".item-rate").value) || 0,
        amount: parseFloat(tr.querySelector(".item-amt").value) || 0,
        gst_rate: parseFloat(tr.querySelector(".item-gst-rate").value) || 0,
      });
    });

    let taxable = items.reduce((s, i) => s + i.amount, 0);
    let totalCgst = 0,
      totalSgst = 0;
    for (const item of items) {
      totalCgst += item.amount * (item.gst_rate / 200);
      totalSgst += item.amount * (item.gst_rate / 200);
    }

    return {
      invoice_no: document.getElementById("inv-no").value,
      date: document.getElementById("inv-date").value,
      delivery_note: document.getElementById("inv-delivery-note").value,
      reference_no: document.getElementById("inv-ref-no").value,
      buyer_order_no: document.getElementById("inv-buyer-order").value,
      dispatch_doc_no: document.getElementById("inv-dispatch-doc").value,
      dispatched_through: document.getElementById("inv-dispatched-through")
        .value,
      destination: document.getElementById("inv-destination").value,
      vehicle_no: document.getElementById("inv-vehicle").value,
      terms_of_delivery: document.getElementById("inv-terms").value,
      seller_id: seller ? seller.id : null,
      buyer_id: document.getElementById("inv-buyer-select").value
        ? parseInt(document.getElementById("inv-buyer-select").value)
        : null,
      buyer_name: document.getElementById("inv-buyer-name").value,
      buyer_gstin: document.getElementById("inv-buyer-gstin").value,
      buyer_address: document.getElementById("inv-buyer-address").value,
      buyer_state_name: document.getElementById("inv-buyer-state").value,
      buyer_state_code: document.getElementById("inv-buyer-state-code").value,
      taxable_value: taxable,
      cgst_amount: totalCgst,
      sgst_amount: totalSgst,
      total_amount: taxable + totalCgst + totalSgst,
      items: items,
    };
  }

  /**
   * Expose a function for the draft system to collect current form state.
   * This is called by renderer.js showDraftDialog when user clicks "Save as Draft".
   */
  window.collectInvoiceDraft = collectData;

  async function saveBuyerIfNeeded(data) {
    const saveBuyerChecked = document.getElementById("inv-save-buyer").checked;
    const buyerName = document.getElementById("inv-buyer-name").value.trim();

    // Only save buyer if checkbox is explicitly checked AND no existing buyer is selected
    if (saveBuyerChecked && buyerName && !data.buyer_id) {
      const bRes = await window.electronAPI.saveBuyer({
        name: buyerName,
        address: document.getElementById("inv-buyer-address").value,
        gstin: document.getElementById("inv-buyer-gstin").value,
        state_name: document.getElementById("inv-buyer-state").value,
        state_code: document.getElementById("inv-buyer-state-code").value,
      });
      if (bRes.success) data.buyer_id = bRes.id;
    }
    return data;
  }

  // ─── Save ───
  document.getElementById("inv-save").addEventListener("click", async () => {
    let data = collectData();
    if (!data.invoice_no || !data.date)
      return showToast("Invoice No. and Date are required", "error");
    data = await saveBuyerIfNeeded(data);
    const res = isEdit
      ? await window.electronAPI.updateInvoice(editingInvoiceId, data)
      : await window.electronAPI.saveInvoice(data);
    if (res.success) {
      showToast(isEdit ? "Invoice updated!" : "Invoice saved!");
      clearDraft();
      window._newInvoiceNumber = null;
      window._formDirty = false;
      editingInvoiceId = null;
      _doNavigate("dashboard");
    } else {
      showToast(res.error, "error");
    }
  });

  // ─── Save & PDF (new only) ───
  const savePdfBtn = document.getElementById("inv-save-pdf");
  if (savePdfBtn)
    savePdfBtn.addEventListener("click", async () => {
      let data = collectData();
      if (!data.invoice_no || !data.date)
        return showToast("Invoice No. and Date are required", "error");
      data = await saveBuyerIfNeeded(data);
      const res = await window.electronAPI.saveInvoice(data);
      if (res.success) {
        showToast("Invoice saved!");
        clearDraft();
        window._newInvoiceNumber = null;
        window._formDirty = false;
        await generatePdf(res.id);
        editingInvoiceId = null;
        _doNavigate("dashboard");
      } else {
        showToast(res.error, "error");
      }
    });

  // ─── PDF (edit only) ───
  const pdfBtn = document.getElementById("inv-pdf");
  if (pdfBtn)
    pdfBtn.addEventListener("click", () => generatePdf(editingInvoiceId));

  // ─── Cancel ───
  document.getElementById("inv-cancel").addEventListener("click", () => {
    if (window._formDirty) {
      // Let navigateTo handle the draft dialog
      navigateTo("dashboard");
    } else {
      editingInvoiceId = null;
      clearDraft();
      window._newInvoiceNumber = null;
      _doNavigate("dashboard");
    }
  });

  // Reset dirty flag — form just loaded, nothing changed yet
  // (unless we loaded a draft, which doesn't count as "dirty" — it's restored state)
  if (!draft) {
    window._formDirty = false;
  }
}
