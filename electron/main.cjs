const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load .env — works in dev mode and from extraResources in packaged app
try {
  const dotenv = require('dotenv');
  const envPaths = [
    path.join(__dirname, '../.env'),                  // dev: project root
    path.join(process.resourcesPath || '', '.env'),   // packaged: extraResources
    path.join(app.getPath('userData'), '.env'),        // user-writable config
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) { dotenv.config({ path: p }); break; }
  }
} catch {}
const db = require('./db-ipc.cjs');
const vault = require('./vault-ipc.cjs');
// Use app.isPackaged (not NODE_ENV) — .env bundled in extraResources sets NODE_ENV=development
// which would cause the packaged app to load localhost:5173 instead of its own UI.
const isDev = !app.isPackaged;

let mainWindow;
let currentUserId = null;
let currentSessionPassword = null; // In-memory only, cleared on logout
const VITE_PORT = 5173;

// Get or generate app secrets
function getAppSecrets() {
  const userDataPath = app.getPath('userData');
  const secretsPath = path.join(userDataPath, '.app-secrets.json');
  
  // Try to load existing secrets
  if (fs.existsSync(secretsPath)) {
    try {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      console.log('[Electron] Loaded existing app secrets');
      return secrets;
    } catch (err) {
      console.error('[Electron] Failed to load secrets, generating new ones:', err);
    }
  }
  
  // Generate new secrets
  console.log('[Electron] Generating new app secrets');
  const secrets = {
    JWT_SECRET: crypto.randomBytes(64).toString('base64'),
    DB_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    BACKUP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex')
  };
  
  // Save for future runs
  try {
    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    console.log('[Electron] Saved app secrets to:', secretsPath);
  } catch (err) {
    console.error('[Electron] Failed to save secrets:', err);
  }
  
  return secrets;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../build/icon.png')
  });

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);

  // Load the app
  if (isDev) {
    // Development: use Vite dev server
    mainWindow.loadURL(`http://localhost:${VITE_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files from the app resources
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('[Electron] Failed to load frontend:', err);
      dialog.showErrorBox(
        'Frontend Load Error',
        `Failed to load UI: ${err.message}\n\nPath: ${indexPath}`
      );
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database
function initializeDatabase() {
  const userDataPath = app.getPath('userData');
  console.log('[Electron] Initializing database at:', userDataPath);
  
  try {
    db.initDatabase(userDataPath);
    console.log('[Electron] Database initialized successfully');
    return true;
  } catch (err) {
    console.error('[Electron] Database initialization failed:', err);
    dialog.showErrorBox(
      'Database Error',
      `Failed to initialize database: ${err.message}`
    );
    return false;
  }
}

// App lifecycle
app.whenReady().then(async () => {
  if (!initializeDatabase()) {
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  db.closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  db.closeDatabase();
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// Database IPC handlers
ipcMain.handle('db:needs-setup', () => {
  return db.needsSetup();
});

ipcMain.handle('db:create-user', async (event, username, password) => {
  const result = db.createUser(username, password);
  if (result.success) {
    currentUserId = result.userId;
    currentSessionPassword = password; // Store for vault auto-unlock retries
    const unlockResult = vault.autoUnlockVault(password);
    console.log('[Main] Vault auto-unlock on create-user:', unlockResult);
  }
  return result;
});

ipcMain.handle('db:verify-user', async (event, username, password) => {
  const result = db.verifyUser(username, password);
  if (result.success) {
    currentUserId = result.userId;
    currentSessionPassword = password; // Store for vault auto-unlock retries
    const unlockResult = vault.autoUnlockVault(password);
    console.log('[Main] Vault auto-unlock on verify-user:', unlockResult);
  }
  return result;
});

ipcMain.handle('db:get-profile', () => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.getProfile(currentUserId);
});

ipcMain.handle('db:update-profile', (event, data) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.updateProfile(currentUserId, data);
});

ipcMain.handle('db:get-conditions', () => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.getConditions(currentUserId);
});

ipcMain.handle('db:add-condition', (event, data) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.addCondition(currentUserId, data);
});

ipcMain.handle('db:get-medications', () => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.getMedications(currentUserId);
});

ipcMain.handle('db:add-medication', (event, data) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.addMedication(currentUserId, data);
});

ipcMain.handle('db:update-medication', (event, id, data) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.updateMedication(id, data);
});

ipcMain.handle('db:delete-medication', (event, id) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.deleteMedication(id);
});

ipcMain.handle('db:get-medication-research', (event, medicationId) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.getMedicationResearch(medicationId);
});

ipcMain.handle('db:add-medication-research', (event, data) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.addMedicationResearch(data);
});

ipcMain.handle('db:delete-medication-research', (event, id) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.deleteMedicationResearch(id);
});

ipcMain.handle('db:get-vitals', (event, limit) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.getVitals(currentUserId, limit || 10);
});

ipcMain.handle('db:add-vitals', (event, data) => {
  if (!currentUserId) return { success: false, error: 'Not authenticated' };
  return db.addVitals(currentUserId, data);
});

ipcMain.handle('db:logout', () => {
  currentUserId = null;
  currentSessionPassword = null; // Clear session password
  vault.lockVault();             // Lock vault on logout
  return { success: true };
});

// Vault IPC handlers
ipcMain.handle('vault:status', () => {
  return vault.getVaultStatus();
});

ipcMain.handle('vault:setup', async (event, password) => {
  return vault.setupMasterPassword(password);
});

ipcMain.handle('vault:unlock', async (event, password) => {
  return vault.unlockVault(password);
});

ipcMain.handle('vault:lock', () => {
  return vault.lockVault();
});

ipcMain.handle('vault:get-credentials', () => {
  // If vault is locked but we have a session password, try to auto-unlock first
  if (!vault.isVaultUnlocked() && currentSessionPassword) {
    console.log('[Main] vault:get-credentials — vault locked, attempting auto-unlock with session password');
    const unlockResult = vault.autoUnlockVault(currentSessionPassword);
    console.log('[Main] Retry auto-unlock result:', unlockResult);
  }
  return vault.getPortalCredentials();
});

ipcMain.handle('vault:save-credential', (event, data) => {
  return vault.savePortalCredential(data);
});

ipcMain.handle('vault:delete-credential', (event, id) => {
  return vault.deletePortalCredential(id);
});

// Portal sync IPC handlers
const portalSync = require('./portal-sync-ipc.cjs');

ipcMain.handle('portal:sync', async (event, credentialId) => {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'data', 'health-secure.db');
    const result = await portalSync.syncPortal(credentialId, dbPath);
    return result;
  } catch (error) {
    console.error('[Electron] Portal sync error:', error);
    return {
      success: false,
      recordsImported: 0,
      summary: {
        connector: 'Portal Sync',
        status: 'Failed',
        message: error.message,
        details: {},
        errors: [error.message]
      }
    };
  }
});

// AI-powered genomic report parser (lazy-loaded to prevent startup crash if module fails)
ipcMain.handle('genomics:parse-foundation-one', async (event, filePath) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'ANTHROPIC_API_KEY not configured. Add it to your .env file.' };
    }
    const { parseGenomicReportWithAI } = require('./ai-genomics-parser.cjs');
    const result = await parseGenomicReportWithAI(filePath, apiKey);
    return {
      success:      true,
      mutations:    result.mutations,
      reportSource: result.reportSource,
      reportDate:   result.mutations[0]?.report_date || new Date().toISOString().split('T')[0],
      rawTextLen:   result.rawText.length,
    };
  } catch (err) {
    console.error('[Main] AI genomic parse failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('genomics:import-mutations', (event, mutations, replaceExisting) => {
  return db.importFoundationOneMutations(mutations, replaceExisting || false);
});

// ── Analytics dashboard ───────────────────────────────────────────────────

ipcMain.handle('analytics:dashboard', (_event) => {
  try {
    const db_ = db._rawDb();
    if (!db_) return { enabled: false, message: 'Database not ready' };

    const run = (sql, params = []) => {
      try { return db_.prepare(sql).all(...params); } catch { return []; }
    };

    // Check if analytics tables exist
    const tableCheck = run(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'analytics_%'`);
    if (tableCheck.length === 0) {
      return {
        enabled: false,
        message: 'Analytics tables not created yet.',
        userMetrics: {}, diagnoses: [], mutations: [], treatments: [], demographics: {}
      };
    }

    const userMetricsRows = run(`SELECT * FROM analytics_user_metrics ORDER BY metric_date DESC LIMIT 1`);
    const userMetrics     = userMetricsRows[0] || {};
    const MIN_CELL        = 1; // single-user app — no k-anonymity needed
    const diagnoses       = run(`SELECT * FROM analytics_diagnosis_aggregates WHERE patient_count >= ? ORDER BY patient_count DESC`, [MIN_CELL]);
    const mutations       = run(`SELECT * FROM analytics_mutation_aggregates  WHERE patient_count >= ? ORDER BY patient_count DESC`, [MIN_CELL]);
    const treatments      = run(`SELECT * FROM analytics_treatment_aggregates WHERE patient_count >= ? ORDER BY patient_count DESC`, [MIN_CELL]);
    const demogRows       = run(`SELECT * FROM analytics_demographics ORDER BY snapshot_date DESC LIMIT 1`);
    const demographics    = demogRows[0] || {};

    return {
      enabled: true,
      userMetrics, diagnoses, mutations, treatments, demographics,
      lastUpdated: userMetrics.metric_date || new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Main] analytics:dashboard failed:', err.message);
    return { error: err.message };
  }
});

// ── AI Analysis (healthcare summary + meal analysis) ──────────────────────
// Lazy-loaded so startup never fails if the module has an issue.

ipcMain.handle('ai:healthcare-summary', async (_event) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { error: 'ANTHROPIC_API_KEY not configured', message: 'Add ANTHROPIC_API_KEY to your .env file.' };
    }
    const { generateHealthcareSummary } = require('./ai-analysis-ipc.cjs');
    return await generateHealthcareSummary(apiKey);
  } catch (err) {
    console.error('[Main] ai:healthcare-summary failed:', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('ai:analyze-meal', async (_event, mealDescription, mealData = {}) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { error: 'ANTHROPIC_API_KEY not configured', message: 'Add ANTHROPIC_API_KEY to your .env file.' };
    }
    const { analyzeMeal } = require('./ai-analysis-ipc.cjs');
    return await analyzeMeal(apiKey, mealDescription, mealData);
  } catch (err) {
    console.error('[Main] ai:analyze-meal failed:', err.message);
    return { error: err.message };
  }
});

// Print-to-PDF (for Healthcare Strategy Summary and any printable content)
ipcMain.handle('dialog:save-pdf', async (event, htmlContent, filename) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title:       'Save as PDF',
      defaultPath: filename || 'HealthcareStrategySummary.pdf',
      filters:     [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    // Create a hidden window, load the HTML, then print to PDF
    const pdfWin = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });

    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      marginsType:        1,          // 1 = minimum margins
      pageSize:           'Letter',
      printBackground:    true,
      printSelectionOnly: false,
      landscape:          false,
    });

    pdfWin.destroy();

    const fs = require('fs');
    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, filePath };
  } catch (err) {
    console.error('[Main] dialog:save-pdf failed:', err.message);
    return { success: false, error: err.message };
  }
});

// File dialog for report upload
ipcMain.handle('dialog:open-file', async (event, options) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, options || {
    title: 'Open Foundation One Report',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  return result;
});

// Subscription IPC handlers

// Genomics IPC handlers (authentication gated at UI login, not IPC level)
ipcMain.handle('genomics:get-dashboard', () => {
  return db.getGenomicDashboard();
});

ipcMain.handle('genomics:get-mutation', (event, mutationId) => {
  return db.getMutationDetails(mutationId);
});

ipcMain.handle('genomics:add-mutation', (event, data) => {
  return db.addGenomicMutation(data);
});

ipcMain.handle('genomics:add-therapy', (event, data) => {
  return db.addMutationTherapy(data);
});

// Genomics: clinical trials linked to mutations
ipcMain.handle('genomics:get-clinical-trials', () => {
  return db.getClinicalTrialsForMutations();
});

// Lab Results: get all test results
ipcMain.handle('labs:get-results', () => {
  return db.getTestResults();
});

// Lab Results: import parsed results
ipcMain.handle('labs:import-results', (event, results, replaceExisting) => {
  return db.importLabResults(results, replaceExisting || false);
});

// Lab Results: parse PDF with Claude AI
ipcMain.handle('labs:parse-pdf', async (event, filePath) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
    const { parseLabReportWithAI } = require('./lab-pdf-parser.cjs');
    const result = await parseLabReportWithAI(filePath, apiKey);
    return { success: true, ...result };
  } catch (error) {
    console.error('[Electron] Lab parse error:', error);
    return { success: false, error: error.message };
  }
});

// ── Medical Documents (Radiology + Doctor's Notes) ────────────────────────
ipcMain.handle('docs:parse-document', async (event, filePath, docType) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
    const { parseMedicalDocumentWithAI } = require('./medical-doc-parser.cjs');
    const result = await parseMedicalDocumentWithAI(filePath, docType, apiKey);
    return { success: true, ...result };
  } catch (error) {
    console.error('[Electron] Medical doc parse error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('docs:save-document', (event, data) => {
  try {
    const { addMedicalDocument } = require('./db-ipc.cjs');
    return addMedicalDocument(data);
  } catch (error) {
    console.error('[Electron] Save document error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('docs:get-documents', (event, docType) => {
  try {
    const { getMedicalDocuments } = require('./db-ipc.cjs');
    const docs = getMedicalDocuments(docType || null);
    return { success: true, documents: docs };
  } catch (error) {
    console.error('[Electron] Get documents error:', error);
    return { success: false, error: error.message, documents: [] };
  }
});

ipcMain.handle('docs:delete-document', (event, id) => {
  try {
    const { deleteMedicalDocument } = require('./db-ipc.cjs');
    return deleteMedicalDocument(id);
  } catch (error) {
    console.error('[Electron] Delete document error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('docs:update-markers', (event, id, markers) => {
  try {
    const { updateMedicalDocumentMarkers } = require('./db-ipc.cjs');
    return updateMedicalDocumentMarkers(id, markers);
  } catch (error) {
    console.error('[Electron] Update markers error:', error);
    return { success: false, error: error.message };
  }
});

// Genomics: mutation-drug-pathway network (Electron IPC mode for Network tab)
ipcMain.handle('genomics:get-mutation-network', () => {
  try {
    const { buildMutationNetwork } = require('./genomics-network-ipc.cjs');
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'data', 'health-secure.db');
    return buildMutationNetwork(dbPath);
  } catch (error) {
    console.error('[Electron] Network build error:', error);
    return { nodes: [], edges: [], error: error.message };
  }
});

// Genomics: search clinical trials for a list of mutations
ipcMain.handle('genomics:search-trials', async (event, mutations) => {
  try {
    const { searchTrialsForMutations } = require('./genomics-trials-search.cjs');
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'data', 'health-secure.db');
    const braveApiKey = process.env.BRAVE_API_KEY || null;
    const result = await searchTrialsForMutations(mutations, dbPath, braveApiKey);
    console.log(`[Electron] Trial search complete: ${result.trialsFound} trials for ${result.mutationsSearched} genes`);
    return { success: true, ...result };
  } catch (error) {
    console.error('[Electron] Trial search error:', error);
    return { success: false, error: error.message, trialsFound: 0, mutationsSearched: 0 };
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Electron] Unhandled rejection:', error);
});
