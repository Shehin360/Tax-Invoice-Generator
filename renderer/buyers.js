// ─── Buyers Page ───
async function renderBuyers(container) {
  const res = await window.electronAPI.getBuyers();
  const buyers = res.success ? res.data : [];

  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Buyers</h1><p class="page-subtitle">Manage your saved buyer profiles</p></div>
      <button class="btn btn-primary" id="buyers-add">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Add Buyer
      </button>
    </div>
    <div class="card">
      <div class="table-wrapper" style="padding:0 24px 24px;">
        <table>
          <thead><tr><th>Name</th><th>GSTIN</th><th>State</th><th>Code</th><th>Actions</th></tr></thead>
          <tbody id="buyers-list">
            ${buyers.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-secondary);">No buyers saved yet</td></tr>' : buyers.map(b => `
              <tr>
                <td><strong>${b.name}</strong><br><small style="color:var(--text-secondary);">${b.address || ''}</small></td>
                <td>${b.gstin || '—'}</td>
                <td>${b.state_name || '—'}</td>
                <td>${b.state_code || '—'}</td>
                <td><div class="actions-cell">
                  <button class="btn btn-icon btn-sm" onclick="editBuyer(${b.id})" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="btn btn-icon btn-sm btn-danger" onclick="deleteBuyerConfirm(${b.id})" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-overlay" id="buyer-modal" style="display:none;">
      <div class="modal-content buyer-modal-content">
        <div class="modal-header"><h3 id="buyer-modal-title">Add Buyer</h3><button class="modal-close" id="buyer-modal-close">&times;</button></div>
        <div class="modal-body" style="padding:24px;">
          <div class="form-group"><label class="form-label">Name *</label><input type="text" class="form-input" id="bm-name"></div>
          <div class="form-group"><label class="form-label">Address</label><textarea class="form-textarea" id="bm-address" rows="2"></textarea></div>
          <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-input" id="bm-gstin"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">State</label><input type="text" class="form-input" id="bm-state"></div>
            <div class="form-group"><label class="form-label">State Code</label><input type="text" class="form-input" id="bm-code"></div>
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
            <button class="btn btn-secondary" id="bm-cancel">Cancel</button>
            <button class="btn btn-primary" id="bm-save">Save Buyer</button>
          </div>
        </div>
      </div>
    </div>`;

  let editId = null;
  const modal = document.getElementById('buyer-modal');
  const openModal = (id) => { editId = id; modal.style.display = 'flex'; };
  const closeModal = () => { editId = null; modal.style.display = 'none'; ['bm-name','bm-address','bm-gstin','bm-state','bm-code'].forEach(f => document.getElementById(f).value = ''); };

  document.getElementById('buyers-add').addEventListener('click', () => {
    document.getElementById('buyer-modal-title').textContent = 'Add Buyer';
    openModal(null);
  });
  document.getElementById('buyer-modal-close').addEventListener('click', closeModal);
  document.getElementById('bm-cancel').addEventListener('click', closeModal);

  document.getElementById('bm-save').addEventListener('click', async () => {
    const data = { name: document.getElementById('bm-name').value, address: document.getElementById('bm-address').value, gstin: document.getElementById('bm-gstin').value, state_name: document.getElementById('bm-state').value, state_code: document.getElementById('bm-code').value };
    if (!data.name) return showToast('Name is required', 'error');
    const res = editId ? await window.electronAPI.updateBuyer(editId, data) : await window.electronAPI.saveBuyer(data);
    if (res.success) { showToast(editId ? 'Buyer updated!' : 'Buyer added!'); closeModal(); navigateTo('buyers'); }
    else showToast(res.error, 'error');
  });

  window.editBuyer = async (id) => {
    const r = await window.electronAPI.getBuyerById(id);
    if (!r.success) return;
    document.getElementById('buyer-modal-title').textContent = 'Edit Buyer';
    document.getElementById('bm-name').value = r.data.name || '';
    document.getElementById('bm-address').value = r.data.address || '';
    document.getElementById('bm-gstin').value = r.data.gstin || '';
    document.getElementById('bm-state').value = r.data.state_name || '';
    document.getElementById('bm-code').value = r.data.state_code || '';
    openModal(id);
  };
  window.deleteBuyerConfirm = async (id) => {
    if (!confirm('Delete this buyer?')) return;
    const r = await window.electronAPI.deleteBuyer(id);
    if (r.success) { showToast('Buyer deleted'); navigateTo('buyers'); }
    else showToast(r.error, 'error');
  };
}
