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
  isDev: process.env.NODE_ENV === 'development'
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
