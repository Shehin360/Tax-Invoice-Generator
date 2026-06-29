// ─── Utility Functions ───
function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/**
 * Escape HTML special characters to prevent XSS when injecting user data into innerHTML.
 * Every user-supplied string MUST pass through this before innerHTML insertion.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatIndianNumber(num) {
  if (!num && num !== 0) return "0";
  const n = parseFloat(num);
  if (isNaN(n)) return "0";
  const parts = n.toFixed(2).split(".");
  let intPart = parts[0];
  const dec = parts[1];
  const neg = intPart.startsWith("-");
  if (neg) intPart = intPart.substring(1);
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    intPart = rest + "," + last3;
  }
  return (neg ? "-" : "") + "₹" + intPart + (dec !== "00" ? "." + dec : "");
}

function numberToIndianWords(amount) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  function tw(n) {
    return n < 20
      ? ones[n]
      : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }
  function th(n) {
    return n >= 100
      ? ones[Math.floor(n / 100)] +
          " Hundred" +
          (n % 100 ? " " + tw(n % 100) : "")
      : tw(n);
  }
  if (!amount) return "INR Zero Only";
  const r = Math.floor(amount),
    p = Math.round((amount - r) * 100);
  let parts = [],
    n = r;
  if (Math.floor(n / 10000000) > 0) {
    parts.push(th(Math.floor(n / 10000000)) + " Crore");
    n %= 10000000;
  }
  if (Math.floor(n / 100000) > 0) {
    parts.push(tw(Math.floor(n / 100000)) + " Lakh");
    n %= 100000;
  }
  if (Math.floor(n / 1000) > 0) {
    parts.push(tw(Math.floor(n / 1000)) + " Thousand");
    n %= 1000;
  }
  if (n > 0) parts.push(th(n));
  let res = "INR " + parts.join(" ");
  if (p > 0) res += " and " + tw(p) + " Paise";
  return res + " Only";
}

// ─── Draft Store (Persists across navigation and app restarts) ───
window._invoiceDraft = null;
window._formDirty = false;

function saveDraft(formData) {
  window._invoiceDraft = formData;
  localStorage.setItem('invoiceDraft', JSON.stringify(formData));
}

function loadDraft() {
  if (window._invoiceDraft) return window._invoiceDraft;
  const saved = localStorage.getItem('invoiceDraft');
  if (saved) {
    try {
      window._invoiceDraft = JSON.parse(saved);
    } catch (e) {
      window._invoiceDraft = null;
    }
  }
  return window._invoiceDraft;
}

function clearDraft() {
  window._invoiceDraft = null;
  window._formDirty = false;
  localStorage.removeItem('invoiceDraft');
}

function hasDraft() {
  return window._invoiceDraft !== null || localStorage.getItem('invoiceDraft') !== null;
}

// ─── Router ───
let currentPage = "dashboard";
let editingInvoiceId = null;

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
  });
});

function navigateTo(page, data) {
  // If leaving invoice form with unsaved changes, show draft dialog
  if (
    currentPage === "new-invoice" &&
    window._formDirty &&
    page !== "new-invoice"
  ) {
    showDraftDialog(page, data);
    return;
  }
  _doNavigate(page, data);
}

function _doNavigate(page, data) {
  currentPage = page;
  if (data && data.editId) editingInvoiceId = data.editId;
  else if (page !== "new-invoice") editingInvoiceId = null;
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => l.classList.remove("active"));
  const active = document.querySelector(`[data-page="${page}"]`);
  if (active) active.classList.add("active");
  loadPage(page);
}

function showDraftDialog(targetPage, targetData) {
  const modal = document.getElementById("draft-modal");
  modal.style.display = "flex";

  const saveDraftBtn = document.getElementById("draft-save");
  const discardBtn = document.getElementById("draft-discard");
  const cancelBtn = document.getElementById("draft-cancel");

  // Remove old listeners by cloning
  const newSave = saveDraftBtn.cloneNode(true);
  const newDiscard = discardBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  saveDraftBtn.replaceWith(newSave);
  discardBtn.replaceWith(newDiscard);
  cancelBtn.replaceWith(newCancel);

  newSave.addEventListener("click", () => {
    // Collect current form data and save as draft
    if (typeof collectInvoiceDraft === "function") {
      saveDraft(collectInvoiceDraft());
    }
    window._formDirty = false;
    modal.style.display = "none";
    showToast("Draft saved — you can continue later", "info");
    _doNavigate(targetPage, targetData);
  });

  newDiscard.addEventListener("click", () => {
    clearDraft();
    window._newInvoiceNumber = null;
    modal.style.display = "none";
    _doNavigate(targetPage, targetData);
  });

  newCancel.addEventListener("click", () => {
    modal.style.display = "none";
    // Stay on current page — do nothing
  });
}

async function loadPage(page) {
  const main = document.getElementById("main-content");
  switch (page) {
    case "dashboard":
      await renderDashboard(main);
      break;
    case "new-invoice":
      await renderNewInvoice(main);
      break;
    case "buyers":
      await renderBuyers(main);
      break;
    case "settings":
      await renderSettings(main);
      break;
  }
}

// ─── Preview Modal ───
document.getElementById("preview-close").addEventListener("click", () => {
  document.getElementById("preview-modal").style.display = "none";
  document.getElementById("preview-iframe").srcdoc = "";
});

async function previewInvoice(id) {
  const res = await window.electronAPI.previewInvoice(id);
  if (!res.success) return showToast(res.error, "error");
  const modal = document.getElementById("preview-modal");
  const iframe = document.getElementById("preview-iframe");
  iframe.srcdoc = res.data;
  modal.style.display = "flex";
}

// ─── Keyboard Shortcuts ───
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const previewModal = document.getElementById('preview-modal');
    if (previewModal && previewModal.style.display === 'flex') {
      previewModal.style.display = 'none';
      document.getElementById('preview-iframe').srcdoc = '';
    }
    const draftModal = document.getElementById('draft-modal');
    if (draftModal && draftModal.style.display === 'flex') {
      draftModal.style.display = 'none';
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    if (currentPage === 'new-invoice') {
      e.preventDefault();
      const saveBtn = document.getElementById('inv-save');
      if (saveBtn) saveBtn.click();
    }
  }
});

// ─── Init ───
navigateTo("dashboard");
