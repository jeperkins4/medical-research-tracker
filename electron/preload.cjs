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
    updateMedication: (id, data) => ipcRenderer.invoke('db:update-medication', id, data),
    deleteMedication: (id) => ipcRenderer.invoke('db:delete-medication', id),
    getMedicationResearch: (medicationId) => ipcRenderer.invoke('db:get-medication-research', medicationId),
    addMedicationResearch: (data)   => ipcRenderer.invoke('db:add-medication-research', data),
    deleteMedicationResearch: (id)  => ipcRenderer.invoke('db:delete-medication-research', id),
    getVitals: (limit) => ipcRenderer.invoke('db:get-vitals', limit),
    addVitals: (data) => ipcRenderer.invoke('db:add-vitals', data),
    logout: () => ipcRenderer.invoke('db:logout')
  },
  
  // Vault operations (portal credentials encryption)
  vault: {
    getStatus: () => ipcRenderer.invoke('vault:status'),
    setup: (password) => ipcRenderer.invoke('vault:setup', password),
    unlock: (password) => ipcRenderer.invoke('vault:unlock', password),
    lock: () => ipcRenderer.invoke('vault:lock'),
    getCredentials: () => ipcRenderer.invoke('vault:get-credentials'),
    saveCredential: (data) => ipcRenderer.invoke('vault:save-credential', data),
    deleteCredential: (id) => ipcRenderer.invoke('vault:delete-credential', id)
  },
  
  // Portal sync operations
  portal: {
    sync: (credentialId) => ipcRenderer.invoke('portal:sync', credentialId)
  },
  
  // Genomics operations
  genomics: {
    getDashboard:       ()                    => ipcRenderer.invoke('genomics:get-dashboard'),
    getMutation:        (mutationId)           => ipcRenderer.invoke('genomics:get-mutation', mutationId),
    addMutation:        (data)                 => ipcRenderer.invoke('genomics:add-mutation', data),
    addTherapy:         (data)                 => ipcRenderer.invoke('genomics:add-therapy', data),
    parseFoundationOne: (filePath)             => ipcRenderer.invoke('genomics:parse-foundation-one', filePath),
    importMutations:    (mutations, replace)   => ipcRenderer.invoke('genomics:import-mutations', mutations, replace),
    getMutationNetwork:  ()                     => ipcRenderer.invoke('genomics:get-mutation-network'),
    getClinicalTrials:   ()                     => ipcRenderer.invoke('genomics:get-clinical-trials'),
    searchTrials:        (mutations)            => ipcRenderer.invoke('genomics:search-trials', mutations),
    openFile:            (opts)                 => ipcRenderer.invoke('dialog:open-file', opts),
  },

  // Lab Results operations
  labs: {
    getResults:    ()                          => ipcRenderer.invoke('labs:get-results'),
    parsePDF:      (filePath)                  => ipcRenderer.invoke('labs:parse-pdf', filePath),
    importResults: (results, replace)          => ipcRenderer.invoke('labs:import-results', results, replace),
    openFile:      (opts)                      => ipcRenderer.invoke('dialog:open-file', opts),
  },

  // Medical Documents (radiology reports, doctor's notes)
  docs: {
    parseDocument:  (filePath, docType)   => ipcRenderer.invoke('docs:parse-document', filePath, docType),
    saveDocument:   (data)                => ipcRenderer.invoke('docs:save-document', data),
    getDocuments:   (docType)             => ipcRenderer.invoke('docs:get-documents', docType),
    deleteDocument: (id)                  => ipcRenderer.invoke('docs:delete-document', id),
    updateMarkers:  (id, markers)         => ipcRenderer.invoke('docs:update-markers', id, markers),
    openFile:       (opts)                => ipcRenderer.invoke('dialog:open-file', opts),
  },

  // AI Analysis (healthcare summary + meal analysis) — works in packaged app without HTTP server
  ai: {
    generateHealthcareSummary: ()                              => ipcRenderer.invoke('ai:healthcare-summary'),
    analyzeMeal:               (description, mealData)         => ipcRenderer.invoke('ai:analyze-meal', description, mealData),
  },

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
