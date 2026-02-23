const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // Platform detection
  platform: process.platform,
  
  // Environment
  isDev: process.env.NODE_ENV === 'development',
  
  // Database operations (IPC-based)
  db: {
    needsSetup: () => ipcRenderer.invoke('db:needs-setup'),
    createUser: (username, password) => ipcRenderer.invoke('db:create-user', username, password),
    verifyUser: (username, password) => ipcRenderer.invoke('db:verify-user', username, password),
    getProfile: () => ipcRenderer.invoke('db:get-profile'),
    updateProfile: (data) => ipcRenderer.invoke('db:update-profile', data),
    getConditions: () => ipcRenderer.invoke('db:get-conditions'),
    addCondition: (data) => ipcRenderer.invoke('db:add-condition', data),
    getMedications: () => ipcRenderer.invoke('db:get-medications'),
    addMedication: (data) => ipcRenderer.invoke('db:add-medication', data),
    getVitals: (limit) => ipcRenderer.invoke('db:get-vitals', limit),
    addVitals: (data) => ipcRenderer.invoke('db:add-vitals', data),
    logout: () => ipcRenderer.invoke('db:logout')
  }
});

// Expose API for future features (backup, updates, etc.)
contextBridge.exposeInMainWorld('api', {
  // Future: backup/restore
  // createBackup: () => ipcRenderer.invoke('create-backup'),
  // restoreBackup: (path) => ipcRenderer.invoke('restore-backup', path),
  
  // Future: auto-update
  // checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  // installUpdate: () => ipcRenderer.invoke('install-update')
});

console.log('[Preload] Context bridge initialized');
