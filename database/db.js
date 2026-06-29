const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

/**
 * Initialize the database connection and create tables if they don't exist.
 * DB file is stored in the app's user data directory for persistence.
 */
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'invoices.db');
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sellers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      address     TEXT,
      gstin       TEXT,
      state_name  TEXT,
      state_code  TEXT
    );

    CREATE TABLE IF NOT EXISTS buyers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      address     TEXT,
      gstin       TEXT,
      state_name  TEXT,
      state_code  TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no          TEXT UNIQUE NOT NULL,
      date                TEXT NOT NULL,
      delivery_note       TEXT,
      reference_no        TEXT,
      buyer_order_no      TEXT,
      dispatch_doc_no     TEXT,
      dispatched_through  TEXT,
      destination         TEXT,
      vehicle_no          TEXT,
      terms_of_delivery   TEXT,
      seller_id           INTEGER REFERENCES sellers(id),
      buyer_id            INTEGER REFERENCES buyers(id),
      taxable_value       REAL,
      cgst_amount         REAL,
      sgst_amount         REAL,
      total_amount        REAL,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      sl_no       INTEGER,
      description TEXT,
      hsn_sac     TEXT,
      quantity    REAL,
      unit        TEXT DEFAULT 'kgs',
      rate        REAL,
      amount      REAL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice_sequence (
      id          INTEGER PRIMARY KEY CHECK(id = 1),
      last_number INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ─── Migrations ───

  // Migration: Add gst_rate column to invoice_items if not present
  const itemCols = db.prepare("PRAGMA table_info(invoice_items)").all();
  const hasGstRate = itemCols.some(c => c.name === 'gst_rate');
  if (!hasGstRate) {
    db.exec('ALTER TABLE invoice_items ADD COLUMN gst_rate REAL DEFAULT 5');
  }

  // Migration: Seed invoice_sequence if empty
  const seqRow = db.prepare('SELECT last_number FROM invoice_sequence WHERE id = 1').get();
  if (!seqRow) {
    // Derive initial sequence from existing data
    const lastInvoice = db.prepare('SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1').get();
    const prefixSetting = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get();
    const startSetting = db.prepare("SELECT value FROM settings WHERE key = 'invoice_start'").get();
    const prefix = prefixSetting ? prefixSetting.value : 'INV-';
    const startNum = startSetting ? parseInt(startSetting.value, 10) : 1;

    let seedNumber = startNum - 1; // Will be incremented on first use
    if (lastInvoice) {
      const numPart = lastInvoice.invoice_no.replace(prefix, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) {
        seedNumber = parsed;
      }
    }
    db.prepare('INSERT INTO invoice_sequence (id, last_number) VALUES (1, ?)').run(seedNumber);
  }

  return db;
}

/**
 * Get the database instance. Must call initDatabase() first.
 */
function getDb() {
  return db;
}

/**
 * Get the path to the database file.
 */
function getDbPath() {
  return path.join(app.getPath('userData'), 'invoices.db');
}

// ─── Seller Queries ───

function saveSeller(data) {
  const existing = db.prepare('SELECT id FROM sellers LIMIT 1').get();
  if (existing) {
    db.prepare(`
      UPDATE sellers SET name = ?, address = ?, gstin = ?, state_name = ?, state_code = ?
      WHERE id = ?
    `).run(data.name, data.address, data.gstin, data.state_name, data.state_code, existing.id);
    return existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO sellers (name, address, gstin, state_name, state_code)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.name, data.address, data.gstin, data.state_name, data.state_code);
    return result.lastInsertRowid;
  }
}

function getSeller() {
  return db.prepare('SELECT * FROM sellers LIMIT 1').get() || null;
}

// ─── Buyer Queries ───

function saveBuyer(data) {
  if (!data.name || !data.name.trim()) {
    throw new Error('Buyer name is required');
  }
  const result = db.prepare(`
    INSERT INTO buyers (name, address, gstin, state_name, state_code)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.name.trim(), data.address, data.gstin, data.state_name, data.state_code);
  return result.lastInsertRowid;
}

function updateBuyer(id, data) {
  if (!data.name || !data.name.trim()) {
    throw new Error('Buyer name is required');
  }
  db.prepare(`
    UPDATE buyers SET name = ?, address = ?, gstin = ?, state_name = ?, state_code = ?
    WHERE id = ?
  `).run(data.name.trim(), data.address, data.gstin, data.state_name, data.state_code, id);
}

function deleteBuyer(id) {
  db.prepare('DELETE FROM buyers WHERE id = ?').run(id);
}

function getBuyers() {
  return db.prepare('SELECT * FROM buyers ORDER BY name').all();
}

function getBuyerById(id) {
  return db.prepare('SELECT * FROM buyers WHERE id = ?').get(id);
}

// ─── Invoice Queries ───

/**
 * Validate invoice data before save/update.
 * Throws on critical errors, warns on soft issues.
 */
function validateInvoiceData(data) {
  if (!data.invoice_no || !data.invoice_no.trim()) {
    throw new Error('Invoice number is required');
  }
  if (!data.date || !data.date.trim()) {
    throw new Error('Invoice date is required');
  }
  if (data.taxable_value !== undefined && data.taxable_value !== null && data.taxable_value < 0) {
    throw new Error('Taxable value cannot be negative');
  }
  if (data.total_amount !== undefined && data.total_amount !== null && data.total_amount < 0) {
    throw new Error('Total amount cannot be negative');
  }
}

function saveInvoice(data) {
  validateInvoiceData(data);

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      invoice_no, date, delivery_note, reference_no, buyer_order_no,
      dispatch_doc_no, dispatched_through, destination, vehicle_no,
      terms_of_delivery, seller_id, buyer_id,
      taxable_value, cgst_amount, sgst_amount, total_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, sl_no, description, hsn_sac, quantity, unit, rate, amount, gst_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((invoiceData) => {
    const result = insertInvoice.run(
      invoiceData.invoice_no, invoiceData.date, invoiceData.delivery_note,
      invoiceData.reference_no, invoiceData.buyer_order_no, invoiceData.dispatch_doc_no,
      invoiceData.dispatched_through, invoiceData.destination, invoiceData.vehicle_no,
      invoiceData.terms_of_delivery, invoiceData.seller_id, invoiceData.buyer_id,
      invoiceData.taxable_value, invoiceData.cgst_amount, invoiceData.sgst_amount,
      invoiceData.total_amount
    );

    const invoiceId = result.lastInsertRowid;

    if (invoiceData.items && invoiceData.items.length > 0) {
      for (const item of invoiceData.items) {
        insertItem.run(
          invoiceId, item.sl_no, item.description, item.hsn_sac,
          item.quantity, item.unit, item.rate, item.amount,
          item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : 5
        );
      }
    }

    return invoiceId;
  });

  return transaction(data);
}

function updateInvoice(id, data) {
  validateInvoiceData(data);

  const updateInv = db.prepare(`
    UPDATE invoices SET
      invoice_no = ?, date = ?, delivery_note = ?, reference_no = ?,
      buyer_order_no = ?, dispatch_doc_no = ?, dispatched_through = ?,
      destination = ?, vehicle_no = ?, terms_of_delivery = ?,
      seller_id = ?, buyer_id = ?,
      taxable_value = ?, cgst_amount = ?, sgst_amount = ?, total_amount = ?
    WHERE id = ?
  `);

  const deleteItems = db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?');
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, sl_no, description, hsn_sac, quantity, unit, rate, amount, gst_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((invoiceData) => {
    updateInv.run(
      invoiceData.invoice_no, invoiceData.date, invoiceData.delivery_note,
      invoiceData.reference_no, invoiceData.buyer_order_no, invoiceData.dispatch_doc_no,
      invoiceData.dispatched_through, invoiceData.destination, invoiceData.vehicle_no,
      invoiceData.terms_of_delivery, invoiceData.seller_id, invoiceData.buyer_id,
      invoiceData.taxable_value, invoiceData.cgst_amount, invoiceData.sgst_amount,
      invoiceData.total_amount, id
    );

    deleteItems.run(id);

    if (invoiceData.items && invoiceData.items.length > 0) {
      for (const item of invoiceData.items) {
        insertItem.run(
          id, item.sl_no, item.description, item.hsn_sac,
          item.quantity, item.unit, item.rate, item.amount,
          item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : 5
        );
      }
    }
  });

  transaction(data);
}

function deleteInvoice(id) {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
}

function getInvoices(filters = {}) {
  let query = `
    SELECT i.*, b.name as buyer_name
    FROM invoices i
    LEFT JOIN buyers b ON i.buyer_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.search) {
    query += ` AND (i.invoice_no LIKE ? OR b.name LIKE ?)`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.dateFrom) {
    query += ` AND i.date >= ?`;
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    query += ` AND i.date <= ?`;
    params.push(filters.dateTo);
  }

  query += ' ORDER BY i.created_at DESC';

  return db.prepare(query).all(...params);
}

function getInvoiceById(id) {
  const invoice = db.prepare(`
    SELECT i.*, b.name as buyer_name, b.address as buyer_address,
           b.gstin as buyer_gstin, b.state_name as buyer_state_name,
           b.state_code as buyer_state_code,
           s.name as seller_name, s.address as seller_address,
           s.gstin as seller_gstin, s.state_name as seller_state_name,
           s.state_code as seller_state_code
    FROM invoices i
    LEFT JOIN buyers b ON i.buyer_id = b.id
    LEFT JOIN sellers s ON i.seller_id = s.id
    WHERE i.id = ?
  `).get(id);

  if (invoice) {
    invoice.items = db.prepare(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sl_no'
    ).all(id);
  }

  return invoice;
}

/**
 * Get next invoice number using the dedicated sequence table.
 * Atomically increments the counter — monotonically increasing, never reused even after deletes.
 */
function getNextInvoiceNumber() {
  const prefixSetting = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get();
  const prefix = prefixSetting ? prefixSetting.value : 'INV-';

  // Atomically increment and return in a transaction
  const nextNum = db.transaction(() => {
    db.prepare('UPDATE invoice_sequence SET last_number = last_number + 1 WHERE id = 1').run();
    const row = db.prepare('SELECT last_number FROM invoice_sequence WHERE id = 1').get();
    return row.last_number;
  })();

  return prefix + String(nextNum).padStart(4, '0');
}

// ─── Settings Queries ───

function saveSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ─── Dashboard Stats ───

function getDashboardStats() {
  const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthRevenue = db.prepare(
    'SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE date >= ?'
  ).get(firstOfMonth).total;

  const totalGst = db.prepare(
    'SELECT COALESCE(SUM(cgst_amount + sgst_amount), 0) as total FROM invoices'
  ).get().total;

  return { totalInvoices, monthRevenue, totalGst };
}

module.exports = {
  initDatabase,
  getDb,
  getDbPath,
  saveSeller,
  getSeller,
  saveBuyer,
  updateBuyer,
  deleteBuyer,
  getBuyers,
  getBuyerById,
  saveInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoices,
  getInvoiceById,
  getNextInvoiceNumber,
  saveSetting,
  getSetting,
  getAllSettings,
  getDashboardStats,
};
