const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let serverProcess;
const SERVER_PORT = 3000;
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
    console.log('[Electron] App path:', app.getAppPath());
    console.log('[Electron] Loading frontend from:', indexPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('[Electron] Failed to load frontend:', err);
      dialog.showErrorBox(
        'Frontend Load Error',
        `Failed to load UI: ${err.message}\n\nPath: ${indexPath}`
      );
    });
    
    // Open DevTools to debug
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const serverPath = isDev 
      ? path.join(__dirname, '../server/index.js')
      : path.join(process.resourcesPath, 'app.asar.unpacked/server/index.js');
    
    console.log('[Electron] Starting backend server on port', SERVER_PORT);
    console.log('[Electron] Server path:', serverPath);
    
    // Get app secrets (auto-generated on first run)
    const secrets = getAppSecrets();
    
    // Use Node binary from Electron for ES modules support
    const nodePath = process.execPath;
    
    serverProcess = spawn(nodePath, ['--experimental-specifier-resolution=node', serverPath], {
      env: {
        ...process.env,
        ...secrets,
        PORT: SERVER_PORT,
        NODE_ENV: isDev ? 'development' : 'production',
        ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      console.log('[Server]', data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Failed to start backend:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error('[Electron] Backend exited with code:', code);
      }
    });

    // Give server 2 seconds to start
    setTimeout(() => {
      console.log('[Electron] Backend server should be running');
      resolve();
    }, 2000);
  });
}

function stopBackendServer() {
  if (serverProcess) {
    console.log('[Electron] Stopping backend server');
    serverProcess.kill();
    serverProcess = null;
  }
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    await startBackendServer();
    createWindow();
  } catch (err) {
    console.error('[Electron] Failed to start app:', err);
    dialog.showErrorBox(
      'Startup Error',
      'Failed to start the backend server. Please check the logs.'
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Electron] Unhandled rejection:', error);
});
