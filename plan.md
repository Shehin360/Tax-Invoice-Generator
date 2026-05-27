# GST Tax Invoice Generator — Project Plan
> Cross-platform desktop app · Electron.js · SQLite · Plain HTML/CSS/JS  
> Reference: M A P SPICES invoice format (Kerala, India)

---

## 1. Project Overview

A real-business desktop application for generating, storing, and printing GST-compliant Tax Invoices. Modelled exactly after the M A P SPICES invoice format. Runs on Windows, macOS, and Linux via Electron. Data stored locally in SQLite. PDF export via Electron's built-in Chromium print engine.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Desktop shell | Electron v30+ | Cross-platform, one codebase |
| UI | Plain HTML + CSS + JS | No build step, Antigravity-friendly |
| Database | SQLite via `better-sqlite3` | Local, file-based, production-grade |
| PDF export | `webContents.printToPDF` | Zero extra deps, uses Chromium |
| Packaging | `electron-builder` | Produces `.exe`, `.dmg`, `.AppImage` |
| Auto-update (future) | `electron-updater` | Ship updates without reinstall |

---

## 3. Project Structure

```
invoice-app/
├── main.js                  # Electron main process
├── preload.js               # Secure IPC bridge (contextBridge)
├── package.json
├── database/
│   └── db.js                # SQLite schema + query helpers
├── renderer/
│   ├── index.html           # App shell / entry point
│   ├── style.css            # Global styles (navy + gold theme)
│   └── renderer.js          # Page routing + shared UI logic
├── pages/
│   ├── dashboard.html       # Invoice list, search, summary cards
│   ├── new-invoice.html     # Invoice creation form
│   └── settings.html        # Seller profile + backup config
└── templates/
    └── invoice.html         # Print-exact A4 GST invoice layout
```

---

## 4. Database Schema (SQLite)

### `sellers`
Stores your own business profile (typically one row).
```sql
CREATE TABLE sellers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  address     TEXT,
  gstin       TEXT,
  state_name  TEXT,
  state_code  TEXT
);
```

### `buyers`
Saved buyer/consignee profiles for reuse across invoices.
```sql
CREATE TABLE buyers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  address     TEXT,
  gstin       TEXT,
  state_name  TEXT,
  state_code  TEXT
);
```

### `invoices`
One row per invoice (header-level data).
```sql
CREATE TABLE invoices (
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
```

### `invoice_items`
Line items for each invoice (many-to-one with invoices).
```sql
CREATE TABLE invoice_items (
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
```

---

## 5. Pages & Features

### 5.1 Dashboard (`dashboard.html`)
- Invoice list table: Invoice No. | Date | Buyer | Total | Actions
- Actions per row: View PDF, Edit, Delete
- Search/filter: by invoice number, buyer name, date range
- Top summary cards: Total Invoices | This Month Revenue | Total GST Collected
- "New Invoice" CTA button (top right)

### 5.2 New Invoice Form (`new-invoice.html`)

**Seller Section**
- Auto-filled from saved seller profile
- Editable inline

**Buyer / Consignee Section**
- Dropdown: select saved buyer OR enter new details
- "Save this buyer" checkbox for new buyers
- Separate "Consignee (Ship to)" and "Buyer (Bill to)" — can be same or different

**Invoice Meta Fields**
- Invoice No. (auto-incremented, editable)
- Date (date picker)
- Delivery Note No.
- Reference No. & Date
- Buyer's Order No.
- Dispatch Doc No.
- Dispatched Through
- Destination
- Motor Vehicle No.
- Terms of Delivery

**Line Items Table**
- Dynamic rows: Add Row / Remove Row
- Columns: Sl. No. | Description | HSN/SAC | Quantity | Unit | Rate | Amount
- Amount = Quantity × Rate (auto-calculated live)

**GST Calculation (live, automatic)**
- Taxable Value = sum of all item amounts
- CGST = 2.5% of taxable value
- SGST = 2.5% of taxable value
- Total = Taxable Value + CGST + SGST

**Amount in Words**
- Auto-generated in Indian number system (lakhs/crores)
- Two fields: Total Amount in words + Tax Amount in words
- Format: "INR [Words] Only"

**Action Buttons**
- Save Invoice (to SQLite)
- Preview Invoice (opens rendered template in modal/window)
- Save & Generate PDF (saves + exports A4 PDF)

### 5.3 Settings (`settings.html`)
- Seller profile form → saved to `sellers` table + localStorage
- Backup folder path selector
- "Backup Now" button → copies `.db` file as `invoices_backup_YYYY-MM-DD.db`
- Auto-backup on app close toggle
- Invoice number prefix/start config (e.g. start from 10, or prefix "INV-")

---

## 6. Invoice Template Layout (`templates/invoice.html`)

Pixel-accurate match to the M A P SPICES invoice format:

```
┌─────────────────────────────────────────────────────────┐
│                                    (ORIGINAL FOR RECIPIENT) │
│                      Tax Invoice                         │
├──────────────────────────┬──────────────────────────────┤
│ SELLER NAME (bold)       │ Invoice No.  │ Dated         │
│ Address line 1           │ [no]         │ [date]        │
│ Address line 2           │ Delivery Note│ Mode of Pmnt  │
│ City, State              │ Reference No.│ Other Refs    │
│ GSTIN: XXXXXXXXXX        │ Buyer Order  │ Dated         │
│ State: Kerala, Code: 32  │              │               │
├──────────────────────────┴──────────────────────────────┤
│ Consignee (Ship to)                                      │
│ BUYER NAME (bold), Address, GSTIN, State                 │
├──────────────────────────────────────────────────────────┤
│ Buyer (Bill to)                                          │
│ BUYER NAME (bold), Address, GSTIN, State                 │
├──────────────┬───────────────────────┬───────────────────┤
│ Dispatch Doc │ Dispatched Through    │ Destination (bold)│
│              │ Road                  │ Thoppumpady       │
│              │ Bill of Lading No.    │ Vehicle: KL35B... │
│ Terms of Delivery                                        │
├────┬──────────────────────┬────────┬──────┬──────┬───────┤
│ Sl │ Description of Goods │HSN/SAC │ Qty  │ Rate │  Amt  │
├────┼──────────────────────┼────────┼──────┼──────┼───────┤
│  1 │ Dry Ginger           │09101120│3500kg│ 240  │8,40,000│
│    │                 CGST │        │      │      │21,000 │
│    │                 SGST │        │      │      │21,000 │
├────┴──────────────────────┴────────┴──────┴──────┴───────┤
│ Total                               3,500 kgs  ₹8,82,000 │
│                                                   E. & O.E│
├──────────────────────────────────────────────────────────┤
│ Amount Chargeable (in words)                             │
│ INR Eight Lakh Eighty Two Thousand Only                  │
├──────────┬──────────┬───────────────┬────────────────────┤
│ HSN/SAC  │ Taxable  │ CGST          │ SGST/UTGST  │ Total│
│          │ Value    │ Rate │ Amount │ Rate │ Amount│ Tax  │
├──────────┼──────────┼──────┼────────┼──────┼───────┼──────┤
│ 09101120 │8,40,000  │ 2.5% │21,000  │ 2.5% │21,000 │42,000│
│ Total    │8,40,000  │      │21,000  │      │21,000 │42,000│
├──────────────────────────────────────────────────────────┤
│ Tax Amount (in words): INR Forty Two Thousand Only       │
│ Declaration: We declare that this invoice...    for MAP  │
│                                        Authorised Signatory│
│              This is a Computer Generated Invoice        │
└──────────────────────────────────────────────────────────┘
```

**Styling rules for template:**
- Pure black and white (no navy/gold — this is for printing)
- All table cells: 1px solid black border
- Font: Arial, 10-12pt base
- Page size: A4
- Seller name, buyer name, destination, vehicle no: bold
- Amounts: right-aligned
- "(ORIGINAL FOR RECIPIENT)": italic, top right

---

## 7. IPC Architecture (main ↔ renderer)

All communication through `preload.js` via `contextBridge`. Renderer never touches Node.js directly.

```
window.electronAPI.saveInvoice(data)       → INSERT into invoices + invoice_items
window.electronAPI.getInvoices(filters)    → SELECT with optional search
window.electronAPI.getInvoiceById(id)      → SELECT invoice + JOIN items
window.electronAPI.updateInvoice(id, data) → UPDATE
window.electronAPI.deleteInvoice(id)       → DELETE (cascades to items)
window.electronAPI.saveSeller(data)        → UPSERT sellers
window.electronAPI.getSeller()             → SELECT sellers LIMIT 1
window.electronAPI.saveBuyer(data)         → INSERT buyers
window.electronAPI.getBuyers()             → SELECT all buyers
window.electronAPI.generatePDF(id)         → render template → printToPDF → save
window.electronAPI.backupDatabase(path)    → fs.copyFileSync db to target path
```

---

## 8. PDF Generation Flow

```
User clicks "Generate PDF"
        ↓
renderer.js calls window.electronAPI.generatePDF(invoiceId)
        ↓
main.js fetches invoice data from SQLite
        ↓
main.js reads templates/invoice.html
        ↓
main.js replaces all {{PLACEHOLDERS}} with real data
        ↓
main.js creates hidden BrowserWindow, loads populated HTML
        ↓
webContents.printToPDF({ pageSize: 'A4', printBackground: false })
        ↓
dialog.showSaveDialog → user picks save path
        ↓
fs.writeFileSync(path, pdfBuffer)
        ↓
Shell opens the saved PDF
```

---

## 9. Backup Strategy

| Type | Trigger | Output |
|---|---|---|
| Manual | "Backup Now" button in Settings | `invoices_backup_2026-05-11.db` |
| Auto | App close event (if toggle on) | Same format, same folder |
| Future | Scheduled (daily/weekly) | Can add `node-cron` later |

Backup is simply a **file copy** of the SQLite `.db` file. To restore: replace the current `.db` with the backup copy.

---

## 10. package.json

```json
{
  "name": "gst-invoice-generator",
  "version": "1.0.0",
  "description": "Cross-platform GST Tax Invoice Generator",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "rebuild": "electron-rebuild -f -w better-sqlite3",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "dependencies": {
    "electron": "^30.0.0",
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "electron-rebuild": "^3.2.9"
  },
  "build": {
    "appId": "com.mapspices.invoicegenerator",
    "productName": "Invoice Generator",
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" },
    "linux": { "target": "AppImage" }
  }
}
```

---

## 11. UI Design Spec

| Element | Value |
|---|---|
| Sidebar background | `#1a2744` (deep navy) |
| Primary button | `#f0a500` (gold) |
| App background | `#f4f6f9` (light grey) |
| Card background | `#ffffff` |
| Text primary | `#1a2744` |
| Text secondary | `#6b7280` |
| Font | Inter or system-ui |
| Invoice template | Black & white only (print-safe) |

**Sidebar navigation links:**
- 📋 Dashboard
- ➕ New Invoice
- 👥 Buyers
- ⚙️ Settings

---

## 12. Critical Setup Steps (after Antigravity generates the code)

```bash
# 1. Install dependencies
npm install

# 2. Rebuild native module for Electron
npm run rebuild

# 3. Run the app
npm start

# 4. Package for distribution (pick your OS)
npm run build:win
npm run build:mac
npm run build:linux
```

> ⚠️ **Step 2 is mandatory.** `better-sqlite3` is a native Node.js addon and must be compiled specifically for the Electron version you're using. If you skip this, the app will crash on launch.

---

## 13. Amount in Words — Indian Number System

The app must convert numbers like `882000` → `"INR Eight Lakh Eighty Two Thousand Only"` using the **Indian numbering system** (not Western millions/billions).

### JS Function

```javascript
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

  // Split into paise and rupees
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  // Indian system: crore / lakh / thousand / remainder
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

// Examples:
// numberToIndianWords(882000)  → "INR Eight Lakh Eighty Two Thousand Only"
// numberToIndianWords(42000)   → "INR Forty Two Thousand Only"
// numberToIndianWords(10000000)→ "INR One Crore Only"
// numberToIndianWords(5525.50) → "INR Five Thousand Five Hundred Twenty Five and Fifty Paise Only"
```

> ✅ Drop this function into `renderer.js` and call it on every total/tax value change. Works correctly for crores, lakhs, thousands, hundreds, and paise.

---

## 14. Future Enhancements (Backlog)

| Feature | Notes |
|---|---|
| Auto-update | `electron-updater` + GitHub Releases |
| Cloud backup | Sync SQLite to Google Drive API |
| Multi-device | Migrate DB to Supabase (Postgres), minimal schema change |
| E-way Bill | Add E-way Bill number field to invoice |
| Multiple GST rates | Extend items table with per-item GST rate |
| Email invoice | Send PDF via nodemailer directly from app |
| Excel export | Export invoice list to `.xlsx` for accounting |
| Duplicate invoice | Clone existing invoice as new draft |

---

## 15. Antigravity Prompt Tips

1. **Paste the full prompt** from Section 3–13 above into Antigravity in one go.
2. If the invoice template layout is off, say: *"Fix the invoice.html to exactly match a standard Indian GST Tax Invoice — CGST and SGST rows should appear inside the line items table, right-aligned, not in a separate section."*
3. If amount-in-words is wrong: *"Replace the number-to-words function with the Indian system using lakhs and crores, not millions and billions."*
4. If `better-sqlite3` crashes: *"Add electron-rebuild to package.json scripts and update main.js to handle the native module path correctly for both dev and packaged builds."*
5. If PDF margins are wrong: *"Set printToPDF margins to none/minimum and ensure the invoice.html has explicit A4 width (210mm) with @page CSS rules."*

---

*Generated for M A P SPICES Invoice Generator Project · May 2026*
