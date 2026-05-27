const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Seller
  saveSeller: (data) => ipcRenderer.invoke('save-seller', data),
  getSeller: () => ipcRenderer.invoke('get-seller'),

  // Buyers
  saveBuyer: (data) => ipcRenderer.invoke('save-buyer', data),
  updateBuyer: (id, data) => ipcRenderer.invoke('update-buyer', id, data),
  deleteBuyer: (id) => ipcRenderer.invoke('delete-buyer', id),
  getBuyers: () => ipcRenderer.invoke('get-buyers'),
  getBuyerById: (id) => ipcRenderer.invoke('get-buyer-by-id', id),

  // Invoices
  saveInvoice: (data) => ipcRenderer.invoke('save-invoice', data),
  updateInvoice: (id, data) => ipcRenderer.invoke('update-invoice', id, data),
  deleteInvoice: (id) => ipcRenderer.invoke('delete-invoice', id),
  getInvoices: (filters) => ipcRenderer.invoke('get-invoices', filters),
  getInvoiceById: (id) => ipcRenderer.invoke('get-invoice-by-id', id),
  getNextInvoiceNumber: () => ipcRenderer.invoke('get-next-invoice-number'),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),

  // Settings
  saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),

  // PDF & Preview
  generatePDF: (id) => ipcRenderer.invoke('generate-pdf', id),
  previewInvoice: (id) => ipcRenderer.invoke('preview-invoice', id),

  // Backup
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
});
