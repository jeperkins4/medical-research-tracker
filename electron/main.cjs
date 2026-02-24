const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db-ipc.cjs');
const vault = require('./vault-ipc.cjs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let currentUserId = null;
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
    // Auto-unlock vault with user's password
    vault.autoUnlockVault(password);
  }
  return result;
});

ipcMain.handle('db:verify-user', async (event, username, password) => {
  const result = db.verifyUser(username, password);
  if (result.success) {
    currentUserId = result.userId;
    // Auto-unlock vault with user's password
    vault.autoUnlockVault(password);
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

// Foundation One PDF Parser
const { parseFoundationOneReport } = require('./foundation-one-parser.cjs');

ipcMain.handle('genomics:parse-foundation-one', async (event, filePath) => {
  try {
    return await parseFoundationOneReport(filePath);
  } catch (err) {
    console.error('[Main] Foundation One parse failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('genomics:import-mutations', (event, mutations, replaceExisting) => {
  return db.importFoundationOneMutations(mutations, replaceExisting || false);
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

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Electron] Unhandled rejection:', error);
});
