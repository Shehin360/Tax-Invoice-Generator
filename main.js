const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database/db');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  db.initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Auto-backup on close if enabled
  try {
    const autoBackup = db.getSetting('auto_backup');
    const backupPath = db.getSetting('backup_path');
    if (autoBackup === 'true' && backupPath) {
      const dbPath = db.getDbPath();
      if (fs.existsSync(backupPath) && fs.statSync(backupPath).isDirectory()) {
        const date = new Date().toISOString().split('T')[0];
        const dest = path.join(backupPath, `invoices_backup_${date}.db`);
        fs.copyFileSync(dbPath, dest);
      } else {
        console.error('Auto-backup skipped: backup path does not exist or is not a directory:', backupPath);
      }
    }
  } catch (e) {
    console.error('Auto-backup failed:', e);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── IPC Handlers ───

// Seller
ipcMain.handle('save-seller', async (event, data) => {
  try {
    return { success: true, id: db.saveSeller(data) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-seller', async () => {
  try {
    return { success: true, data: db.getSeller() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Buyers
ipcMain.handle('save-buyer', async (event, data) => {
  try {
    return { success: true, id: db.saveBuyer(data) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-buyer', async (event, id, data) => {
  try {
    db.updateBuyer(id, data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-buyer', async (event, id) => {
  try {
    db.deleteBuyer(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-buyers', async () => {
  try {
    return { success: true, data: db.getBuyers() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-buyer-by-id', async (event, id) => {
  try {
    return { success: true, data: db.getBuyerById(id) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Invoices
ipcMain.handle('save-invoice', async (event, data) => {
  try {
    return { success: true, id: db.saveInvoice(data) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-invoice', async (event, id, data) => {
  try {
    db.updateInvoice(id, data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-invoice', async (event, id) => {
  try {
    db.deleteInvoice(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-invoices', async (event, filters) => {
  try {
    return { success: true, data: db.getInvoices(filters) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-invoice-by-id', async (event, id) => {
  try {
    return { success: true, data: db.getInvoiceById(id) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-next-invoice-number', async () => {
  try {
    return { success: true, data: db.getNextInvoiceNumber() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Dashboard
ipcMain.handle('get-dashboard-stats', async () => {
  try {
    return { success: true, data: db.getDashboardStats() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Settings
ipcMain.handle('save-setting', async (event, key, value) => {
  try {
    db.saveSetting(key, value);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-setting', async (event, key) => {
  try {
    return { success: true, data: db.getSetting(key) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-all-settings', async () => {
  try {
    return { success: true, data: db.getAllSettings() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// PDF Generation
ipcMain.handle('generate-pdf', async (event, invoiceId) => {
  let pdfWindow = null;
  try {
    const invoice = db.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    // Read template
    const templatePath = path.join(__dirname, 'templates', 'invoice.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders with invoice data
    html = populateTemplate(html, invoice);

    // Create hidden window for PDF generation
    pdfWindow = new BrowserWindow({
      width: 794,  // A4 width at 96 DPI
      height: 1123, // A4 height at 96 DPI
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Wait for fonts and content to render without a fixed delay
    await pdfWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)');

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: false,
      margins: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2 },
    });

    // Show save dialog — filename format: Invoice_no.INV-XXXX.pdf
    const safeInvoiceNo = (invoice.invoice_no || 'unknown').replace(/[<>:"/\\|?*]/g, '_');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice PDF',
      defaultPath: path.join(app.getPath('documents'), `Invoice_no.${safeInvoiceNo}.pdf`),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    fs.writeFileSync(filePath, pdfBuffer);
    shell.openPath(filePath);

    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    // Always close the PDF window to prevent leaked BrowserWindows
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
  }
});

// Backup
ipcMain.handle('backup-database', async () => {
  try {
    const backupPathSetting = db.getSetting('backup_path');
    let targetDir = backupPathSetting;

    if (!targetDir) {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Backup Folder',
        properties: ['openDirectory'],
      });
      if (canceled || filePaths.length === 0) {
        return { success: false, error: 'No folder selected' };
      }
      targetDir = filePaths[0];
    }

    // Validate backup path
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return { success: false, error: 'Backup path does not exist or is not a directory' };
    }

    const dbPath = db.getDbPath();
    const date = new Date().toISOString().split('T')[0];
    const dest = path.join(targetDir, `invoices_backup_${date}.db`);

    // Verify destination is within the target directory (prevent path traversal)
    const resolvedDest = path.resolve(dest);
    const resolvedDir = path.resolve(targetDir);
    if (!resolvedDest.startsWith(resolvedDir)) {
      return { success: false, error: 'Invalid backup path' };
    }

    fs.copyFileSync(dbPath, dest);

    return { success: true, path: dest };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Select backup folder
ipcMain.handle('select-backup-folder', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Folder',
      properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'No folder selected' };
    }
    return { success: true, data: filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Preview invoice HTML
ipcMain.handle('preview-invoice', async (event, invoiceId) => {
  try {
    const invoice = db.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const templatePath = path.join(__dirname, 'templates', 'invoice.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = populateTemplate(html, invoice);

    return { success: true, data: html };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Template Population ───

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatIndianNumber(num) {
  if (num === null || num === undefined) return '0';
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  // Format in Indian number system: x,xx,xxx
  const parts = n.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];
  const isNeg = intPart.startsWith('-');
  if (isNeg) intPart = intPart.substring(1);

  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = formatted + ',' + last3;
  }

  const result = intPart + (decPart && decPart !== '00' ? '.' + decPart : '');
  return (isNeg ? '-' : '') + result;
}

function numberToIndianWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
                 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
                 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
                'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function threeDigits(n) {
    if (n >= 100) {
      return ones[Math.floor(n / 100)] + ' Hundred' +
             (n % 100 ? ' ' + twoDigits(n % 100) : '');
    }
    return twoDigits(n);
  }

  if (amount === 0) return 'INR Zero Only';

  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  let parts = [];
  let n = rupees;

  if (Math.floor(n / 10000000) > 0) {
    parts.push(threeDigits(Math.floor(n / 10000000)) + ' Crore');
    n %= 10000000;
  }
  if (Math.floor(n / 100000) > 0) {
    parts.push(twoDigits(Math.floor(n / 100000)) + ' Lakh');
    n %= 100000;
  }
  if (Math.floor(n / 1000) > 0) {
    parts.push(twoDigits(Math.floor(n / 1000)) + ' Thousand');
    n %= 1000;
  }
  if (n > 0) {
    parts.push(threeDigits(n));
  }

  let result = 'INR ' + parts.join(' ');
  if (paise > 0) result += ' and ' + twoDigits(paise) + ' Paise';
  result += ' Only';
  return result;
}

function nlToBr(str) {
  return str ? str.replace(/\n/g, '<br>') : '';
}

function populateTemplate(html, invoice) {
  const replacements = {
    '{{SELLER_NAME}}': invoice.seller_name || '',
    '{{SELLER_ADDRESS}}': nlToBr(invoice.seller_address),
    '{{SELLER_GSTIN}}': invoice.seller_gstin || '',
    '{{SELLER_STATE}}': invoice.seller_state_name || '',
    '{{SELLER_STATE_CODE}}': invoice.seller_state_code || '',
    '{{INVOICE_NO}}': invoice.invoice_no || '',
    '{{DATE}}': invoice.date || '',
    '{{DELIVERY_NOTE}}': invoice.delivery_note || '',
    '{{REFERENCE_NO}}': invoice.reference_no || '',
    '{{BUYER_ORDER_NO}}': invoice.buyer_order_no || '',
    '{{DISPATCH_DOC_NO}}': invoice.dispatch_doc_no || '',
    '{{DISPATCHED_THROUGH}}': invoice.dispatched_through || '',
    '{{DESTINATION}}': invoice.destination || '',
    '{{VEHICLE_NO}}': invoice.vehicle_no || '',
    '{{TERMS_OF_DELIVERY}}': invoice.terms_of_delivery || '',
    '{{BUYER_NAME}}': invoice.buyer_name || '',
    '{{BUYER_ADDRESS}}': nlToBr(invoice.buyer_address),
    '{{BUYER_GSTIN}}': invoice.buyer_gstin || '',
    '{{BUYER_STATE}}': invoice.buyer_state_name || '',
    '{{BUYER_STATE_CODE}}': invoice.buyer_state_code || '',
    '{{TAXABLE_VALUE}}': formatIndianNumber(invoice.taxable_value),
    '{{TOTAL_AMOUNT}}': formatIndianNumber(invoice.total_amount),
    '{{AMOUNT_IN_WORDS}}': numberToIndianWords(invoice.total_amount || 0),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  // Build line items rows
  let itemRows = '';
  let totalQty = 0;
  let totalQtyUnit = 'kgs';
  const hsnMap = {}; // { hsn: { taxable, gst_rate } }

  // Group tax amounts by GST rate for the tax rows and HSN table
  const gstRateGroups = {}; // { rate: { cgst, sgst } }

  if (invoice.items && invoice.items.length > 0) {
    for (const item of invoice.items) {
      const gstRate = item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : 5;
      const halfRate = (gstRate / 2);

      itemRows += `
        <tr>
          <td class="center">${item.sl_no}</td>
          <td>${escapeHtml(item.description || '')}</td>
          <td class="center">${escapeHtml(item.hsn_sac || '')}</td>
          <td class="right">${item.quantity || ''} ${escapeHtml(item.unit || '')}</td>
          <td class="right">${formatIndianNumber(item.rate)}</td>
          <td class="right">${formatIndianNumber(item.amount)}</td>
        </tr>
      `;
      totalQty += (item.quantity || 0);
      totalQtyUnit = item.unit || 'kgs';

      // Collect GST by rate
      if (!gstRateGroups[gstRate]) {
        gstRateGroups[gstRate] = { cgst: 0, sgst: 0 };
      }
      gstRateGroups[gstRate].cgst += (item.amount || 0) * halfRate / 100;
      gstRateGroups[gstRate].sgst += (item.amount || 0) * halfRate / 100;

      // Collect HSN data for tax table
      if (item.hsn_sac) {
        const hsnKey = `${item.hsn_sac}_${gstRate}`;
        if (!hsnMap[hsnKey]) {
          hsnMap[hsnKey] = { hsn: item.hsn_sac, taxable: 0, gst_rate: gstRate };
        }
        hsnMap[hsnKey].taxable += (item.amount || 0);
      }
    }
  }

  // Add tax rows for each GST rate group (sorted by rate)
  const sortedRates = Object.keys(gstRateGroups).sort((a, b) => parseFloat(a) - parseFloat(b));
  for (const rate of sortedRates) {
    const r = parseFloat(rate);
    if (r === 0) continue; // No tax rows for 0% GST
    const halfRate = (r / 2).toFixed(1).replace(/\.0$/, '');
    itemRows += `
      <tr class="tax-row">
        <td class="center"></td>
        <td class="right"><em>CGST @ ${halfRate}%</em></td>
        <td class="center"></td>
        <td class="right"></td>
        <td class="right"></td>
        <td class="right">${formatIndianNumber(gstRateGroups[rate].cgst)}</td>
      </tr>
      <tr class="tax-row">
        <td class="center"></td>
        <td class="right"><em>SGST @ ${halfRate}%</em></td>
        <td class="center"></td>
        <td class="right"></td>
        <td class="right"></td>
        <td class="right">${formatIndianNumber(gstRateGroups[rate].sgst)}</td>
      </tr>
    `;
  }

  html = html.replace('{{ITEM_ROWS}}', itemRows);
  html = html.replace('{{TOTAL_QTY}}', `${totalQty} ${totalQtyUnit}`);

  // Calculate totals for template
  let totalCgst = 0, totalSgst = 0;
  for (const grp of Object.values(gstRateGroups)) {
    totalCgst += grp.cgst;
    totalSgst += grp.sgst;
  }
  const totalTaxAmt = totalCgst + totalSgst;

  html = html.split('{{CGST_AMOUNT}}').join(formatIndianNumber(totalCgst));
  html = html.split('{{SGST_AMOUNT}}').join(formatIndianNumber(totalSgst));
  html = html.split('{{TOTAL_TAX}}').join(formatIndianNumber(totalTaxAmt));
  html = html.split('{{TAX_IN_WORDS}}').join(numberToIndianWords(totalTaxAmt));

  // Build HSN tax breakdown table
  let hsnRows = '';
  for (const entry of Object.values(hsnMap)) {
    const halfRate = (entry.gst_rate / 2).toFixed(1).replace(/\.0$/, '');
    const cgst = entry.taxable * (entry.gst_rate / 200);
    const sgst = entry.taxable * (entry.gst_rate / 200);
    const totalTax = cgst + sgst;
    hsnRows += `
      <tr>
        <td class="center">${entry.hsn}</td>
        <td class="right">${formatIndianNumber(entry.taxable)}</td>
        <td class="center">${halfRate}%</td>
        <td class="right">${formatIndianNumber(cgst)}</td>
        <td class="center">${halfRate}%</td>
        <td class="right">${formatIndianNumber(sgst)}</td>
        <td class="right">${formatIndianNumber(totalTax)}</td>
      </tr>
    `;
  }

  // Totals row
  const totalTaxable = invoice.taxable_value || 0;
  hsnRows += `
    <tr class="hsn-total">
      <td class="center"><strong>Total</strong></td>
      <td class="right"><strong>${formatIndianNumber(totalTaxable)}</strong></td>
      <td class="center"></td>
      <td class="right"><strong>${formatIndianNumber(totalCgst)}</strong></td>
      <td class="center"></td>
      <td class="right"><strong>${formatIndianNumber(totalSgst)}</strong></td>
      <td class="right"><strong>${formatIndianNumber(totalTaxAmt)}</strong></td>
    </tr>
  `;

  html = html.replace('{{HSN_ROWS}}', hsnRows);

  return html;
}
