const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PDFDocument } = require('pdf-lib');
const db = require('./database/db');
const logger = require('./logger');

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

  let isAppClosing = false;
  mainWindow.on('close', async (e) => {
    if (isAppClosing) return;
    e.preventDefault();
    try {
      const isDirty = await mainWindow.webContents.executeJavaScript('window._formDirty');
      if (isDirty) {
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'question',
          buttons: ['Quit and Lose Changes', 'Cancel'],
          title: 'Unsaved Changes',
          message: 'You have an unsaved invoice draft. Are you sure you want to quit?'
        });
        if (choice !== 0) return; // Cancelled
      }
    } catch (err) {
      console.error('Error checking dirty state', err);
    }
    isAppClosing = true;
    mainWindow.close();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logger.info('Application starting...');
  db.initDatabase();
  createWindow();

  // Create native menu
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: async () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About',
              message: 'GST Invoice Generator',
              detail: 'Version 1.0.0\nDeveloped by the coolest developer: Shehin LOL😜'
            });
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  try {
    db.closeDatabase();
  } catch (e) {
    console.error('Error closing database:', e);
  }
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

function ipcHandler(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await fn(...args);
      return { success: true, data: result !== undefined ? result : null, id: result };
    } catch (err) {
      logger.error(`IPC error [${channel}]:`, err);
      return { success: false, error: err.message };
    }
  });
}

// Seller
ipcHandler('save-seller', (data) => db.saveSeller(data));
ipcHandler('get-seller', () => db.getSeller());

// Buyers
ipcHandler('save-buyer', (data) => db.saveBuyer(data));
ipcHandler('update-buyer', (id, data) => { db.updateBuyer(id, data); });
ipcHandler('delete-buyer', (id) => { db.deleteBuyer(id); });
ipcHandler('get-buyers', () => db.getBuyers());
ipcHandler('get-buyer-by-id', (id) => db.getBuyerById(id));

// Products
ipcHandler('save-product', (data) => db.saveProduct(data));
ipcHandler('update-product', (id, data) => { db.updateProduct(id, data); });
ipcHandler('delete-product', (id) => { db.deleteProduct(id); });
ipcHandler('get-products', () => db.getProducts());

// Invoices
ipcHandler('save-invoice', (data) => db.saveInvoice(data));
ipcHandler('update-invoice', (id, data) => { db.updateInvoice(id, data); });
ipcHandler('delete-invoice', (id) => { db.deleteInvoice(id); });
ipcHandler('get-invoices', (filters) => db.getInvoices(filters));
ipcHandler('get-invoice-by-id', (id) => db.getInvoiceById(id));
ipcHandler('get-next-invoice-number', () => db.getNextInvoiceNumber());
ipcHandler('check-duplicate-invoice', (invoiceNo, excludeId) => db.checkDuplicateInvoice(invoiceNo, excludeId));

// Dashboard
ipcHandler('get-dashboard-stats', () => db.getDashboardStats());

// Reports
ipcHandler('get-gstr1-summary', (month) => db.getGstr1Summary(month));

// Settings
ipcHandler('save-setting', (key, value) => { db.saveSetting(key, value); });
ipcHandler('get-setting', (key) => db.getSetting(key));
ipcHandler('get-all-settings', () => db.getAllSettings());

async function waitForPdfRender(webContents) {
  await webContents.executeJavaScript(`
    new Promise((resolve) => {
      const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(done);
      } else {
        done();
      }
    })
  `);
}

async function normalizePdfForSharing(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.save({ useObjectStreams: false });
}

async function renderInvoicePdf(html) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-pdf-'));
  const htmlPath = path.join(tmpDir, 'invoice.html');
  let pdfWindow = null;

  try {
    fs.writeFileSync(htmlPath, html, 'utf-8');

    pdfWindow = new BrowserWindow({
      width: 794,  // A4 width at 96 DPI
      height: 1123, // A4 height at 96 DPI
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    await pdfWindow.loadFile(htmlPath);
    await waitForPdfRender(pdfWindow.webContents);

    const rawPdf = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      generateTaggedPDF: false,
      margins: { marginType: 'none' },
    });

    if (!rawPdf || rawPdf.length < 5 || rawPdf.slice(0, 4).toString() !== '%PDF') {
      throw new Error('PDF generation produced an invalid file');
    }

    return normalizePdfForSharing(rawPdf);
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// PDF Generation
ipcMain.handle('generate-pdf', async (event, invoiceId) => {
  try {
    const invoice = db.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const templatePath = path.join(__dirname, 'templates', 'invoice.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = populateTemplate(html, invoice);

    const pdfBuffer = await renderInvoicePdf(html);

    const safeInvoiceNo = (invoice.invoice_no || 'unknown').replace(/[<>:"/\\|?*]/g, '_');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice PDF',
      defaultPath: path.join(app.getPath('documents'), `Invoice_${safeInvoiceNo}.pdf`),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
    shell.openPath(filePath);

    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
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
    const cr = Math.floor(n / 10000000);
    parts.push(threeDigits(cr) + (cr > 1 ? ' Crores' : ' Crore'));
    n %= 10000000;
  }
  if (Math.floor(n / 100000) > 0) {
    const l = Math.floor(n / 100000);
    parts.push(twoDigits(l) + (l > 1 ? ' Lakhs' : ' Lakh'));
    n %= 100000;
  }
  if (Math.floor(n / 1000) > 0) {
    parts.push(twoDigits(Math.floor(n / 1000)) + ' Thousand');
    n %= 1000;
  }
  if (n > 0) {
    parts.push(threeDigits(n));
  }

  let result = 'INR';
  if (parts.length > 0) {
    result += ' ' + parts.join(' ');
  } else if (paise === 0) {
    result += ' Zero';
  }
  if (paise > 0) {
    result += (parts.length > 0 ? ' and ' : ' ') + twoDigits(paise) + ' Paise';
  }
  result += ' Only';
  return result;
}

function nlToBr(str) {
  return str ? str.replace(/\n/g, '<br>') : '';
}

function formatIndianDate(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDate;
}

function populateTemplate(html, invoice) {
  const replacements = {
    '{{SELLER_NAME}}': invoice.seller_name || '',
    '{{SELLER_ADDRESS}}': nlToBr(invoice.seller_address),
    '{{SELLER_GSTIN}}': invoice.seller_gstin || '',
    '{{SELLER_STATE}}': invoice.seller_state_name || '',
    '{{SELLER_STATE_CODE}}': invoice.seller_state_code || '',
    '{{INVOICE_NO}}': invoice.invoice_no || '',
    '{{DATE}}': formatIndianDate(invoice.date),
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
