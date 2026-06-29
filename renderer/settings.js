// ─── Settings Page ───
async function renderSettings(container) {
  const sellerRes = await window.electronAPI.getSeller();
  const seller = sellerRes.success ? sellerRes.data : null;
  const settingsRes = await window.electronAPI.getAllSettings();
  const settings = settingsRes.success ? settingsRes.data : {};

  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Settings</h1><p class="page-subtitle">Configure your business profile and app preferences</p></div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3>🏢 Seller / Business Profile</h3></div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Business Name *</label><input type="text" class="form-input" id="set-name" value="${seller ? seller.name : ''}"></div>
          <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-input" id="set-gstin" value="${seller ? seller.gstin || '' : ''}"></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><textarea class="form-textarea" id="set-address" rows="2">${seller ? seller.address || '' : ''}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">State</label><input type="text" class="form-input" id="set-state" value="${seller ? seller.state_name || '' : ''}"></div>
          <div class="form-group"><label class="form-label">State Code</label><input type="text" class="form-input" id="set-code" value="${seller ? seller.state_code || '' : ''}"></div>
        </div>
        <button class="btn btn-primary" id="set-save-seller">Save Profile</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3>🎨 Appearance</h3></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <label class="form-label" style="margin:0;">Dark Mode (Futuristic)</label>
          <label class="toggle"><input type="checkbox" id="set-dark-mode" ${settings.theme === 'dark' ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3>🔢 Invoice Numbering</h3></div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Invoice Prefix</label><input type="text" class="form-input" id="set-prefix" value="${settings.invoice_prefix || 'INV-'}" placeholder="INV-"></div>
          <div class="form-group"><label class="form-label">Start Number</label><input type="number" class="form-input" id="set-start" value="${settings.invoice_start || '1'}" placeholder="1"></div>
        </div>
        <button class="btn btn-primary" id="set-save-numbering">Save Numbering</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>💾 Backup</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Backup Folder</label>
          <div style="display:flex;gap:12px;">
            <input type="text" class="form-input" id="set-backup-path" value="${settings.backup_path || ''}" placeholder="Select a folder..." readonly>
            <button class="btn btn-secondary" id="set-browse-backup">Browse</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <label class="form-label" style="margin:0;">Auto-backup on close</label>
          <label class="toggle"><input type="checkbox" id="set-auto-backup" ${settings.auto_backup === 'true' ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-primary" id="set-save-backup">Save Backup Settings</button>
          <button class="btn btn-secondary" id="set-backup-now">Backup Now</button>
        </div>
      </div>
    </div>`;

  document.getElementById('set-save-seller').addEventListener('click', async () => {
    const data = { name: document.getElementById('set-name').value, address: document.getElementById('set-address').value, gstin: document.getElementById('set-gstin').value, state_name: document.getElementById('set-state').value, state_code: document.getElementById('set-code').value };
    if (!data.name) return showToast('Business name is required', 'error');
    const r = await window.electronAPI.saveSeller(data);
    r.success ? showToast('Profile saved!') : showToast(r.error, 'error');
  });

  document.getElementById('set-dark-mode').addEventListener('change', async (e) => {
    const isDark = e.target.checked;
    await window.electronAPI.saveSetting('theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  });

  document.getElementById('set-save-numbering').addEventListener('click', async () => {
    await window.electronAPI.saveSetting('invoice_prefix', document.getElementById('set-prefix').value);
    await window.electronAPI.saveSetting('invoice_start', document.getElementById('set-start').value);
    showToast('Numbering settings saved!');
  });

  document.getElementById('set-browse-backup').addEventListener('click', async () => {
    const r = await window.electronAPI.selectBackupFolder();
    if (r.success) document.getElementById('set-backup-path').value = r.data;
  });

  document.getElementById('set-save-backup').addEventListener('click', async () => {
    await window.electronAPI.saveSetting('backup_path', document.getElementById('set-backup-path').value);
    await window.electronAPI.saveSetting('auto_backup', document.getElementById('set-auto-backup').checked ? 'true' : 'false');
    showToast('Backup settings saved!');
  });

  document.getElementById('set-backup-now').addEventListener('click', async () => {
    const r = await window.electronAPI.backupDatabase();
    r.success ? showToast('Backup created at: ' + r.path) : showToast(r.error || 'Backup failed', 'error');
  });
}
