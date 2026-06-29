// renderer/products.js

let allProducts = [];
let editingProductId = null;

async function renderProducts(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Products / HSN Master</h2>
        <p class="page-subtitle">Manage your product catalog</p>
      </div>
      <button class="btn btn-primary" id="btn-add-product">
        + Add Product
      </button>
    </div>

    <div class="card">
      <div style="overflow-x:auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th>GST Rate (%)</th>
              <th style="width:100px;">Actions</th>
            </tr>
          </thead>
          <tbody id="products-table-body">
            <tr><td colspan="4" style="text-align:center;">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Product Modal -->
    <div class="modal-overlay" id="product-modal" style="display:none;">
      <div class="modal-content" style="max-width:500px;">
        <div class="modal-header">
          <h3 id="product-modal-title">Add Product</h3>
          <button class="modal-close" id="product-modal-close">&times;</button>
        </div>
        <div class="modal-body" style="padding:24px;">
          <form id="product-form">
            <div class="form-group">
              <label class="form-label">Description*</label>
              <input type="text" id="prod-desc" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">HSN/SAC</label>
              <input type="text" id="prod-hsn" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">GST Rate (%)</label>
              <select id="prod-gst" class="form-select">
                <option value="0">0%</option>
                <option value="5" selected>5% (2.5+2.5)</option>
                <option value="12">12% (6+6)</option>
                <option value="18">18% (9+9)</option>
                <option value="28">28% (14+14)</option>
              </select>
            </div>
            <div style="margin-top:24px;display:flex;justify-content:flex-end;gap:12px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-product">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  await loadProductsList();

  // Events
  document.getElementById('btn-add-product').addEventListener('click', () => {
    editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-modal').style.display = 'flex';
  });

  document.getElementById('product-modal-close').addEventListener('click', () => {
    document.getElementById('product-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-product').addEventListener('click', () => {
    document.getElementById('product-modal').style.display = 'none';
  });

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      description: document.getElementById('prod-desc').value.trim(),
      hsn_sac: document.getElementById('prod-hsn').value.trim(),
      rate: 0,
      gst_rate: parseFloat(document.getElementById('prod-gst').value) || 5
    };

    if (!data.description) return showToast('Description is required', 'error');

    let res;
    if (editingProductId) {
      res = await window.electronAPI.updateProduct(editingProductId, data);
    } else {
      res = await window.electronAPI.saveProduct(data);
    }

    if (res.success) {
      showToast(editingProductId ? 'Product updated' : 'Product saved');
      document.getElementById('product-modal').style.display = 'none';
      await loadProductsList();
    } else {
      showToast(res.error, 'error');
    }
  });
}

async function loadProductsList() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  const res = await window.electronAPI.getProducts();
  if (!res.success) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger)">Error: ${res.error}</td></tr>`;
    return;
  }
  allProducts = res.data;
  if (allProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted);">No products found. Add one to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = allProducts.map(p => `
    <tr>
      <td>${escapeHtml(p.description)}</td>
      <td>${escapeHtml(p.hsn_sac || '-')}</td>
      <td>${p.gst_rate}%</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editProduct(${p.id})" style="padding:4px 8px;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})" style="padding:4px 8px;margin-left:4px;">Del</button>
      </td>
    </tr>
  `).join('');
}

function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('prod-desc').value = p.description || '';
  document.getElementById('prod-hsn').value = p.hsn_sac || '';
  document.getElementById('prod-gst').value = p.gst_rate || '5';
  document.getElementById('product-modal').style.display = 'flex';
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  const res = await window.electronAPI.deleteProduct(id);
  if (res.success) {
    showToast('Product deleted');
    await loadProductsList();
  } else {
    showToast(res.error, 'error');
  }
}
