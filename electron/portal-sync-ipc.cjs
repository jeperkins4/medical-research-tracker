/**
 * Portal Sync IPC - Browser-based scraping for healthcare portals
 * Runs Playwright in Electron main process
 */

const { chromium } = require('playwright');
const { tmpdir } = require('os');
const { join } = require('path');
const { existsSync, readFileSync, writeFileSync, unlinkSync } = require('fs');
const Database = require('better-sqlite3');
const { getVault } = require('./vault-ipc.cjs');

let db = null;

function getDb(dbPath) {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

/**
 * Main sync function - routes to appropriate connector
 */
async function syncPortal(credentialId, dbPath) {
  const database = getDb(dbPath);
  const vault = getVault();
  
  if (!vault.isUnlocked()) {
    throw new Error('Vault is locked. Please unlock it first.');
  }
  
  // Get credential
  const cred = database.prepare(`
    SELECT * FROM portal_credentials WHERE id = ?
  `).get(credentialId);
  
  if (!cred) {
    throw new Error('Credential not found');
  }
  
  // Decrypt credentials — safeDecrypt falls back to the raw value if it's plaintext
  // (backfill from old schema may have written plaintext into username_encrypted)
  function safeDecrypt(val, fallback = '') {
    if (!val) return fallback;
    try { return vault.decrypt(val); } catch { return val; }
  }
  const decryptedPassword = safeDecrypt(cred.password_encrypted);
  const decryptedUsername = safeDecrypt(cred.username_encrypted, cred.username || '');
  const credential = {
    ...cred,
    username: decryptedUsername,
    password: decryptedPassword,
  };
  
  console.log(`🔄 Starting sync for: ${credential.service_name} (${credential.portal_type})`);
  
  const startTime = new Date().toISOString();
  
  // Log sync start
  const insertLog = database.prepare(`
    INSERT INTO portal_sync_log (credential_id, sync_started, status)
    VALUES (?, ?, 'running')
  `);
  
  const logResult = insertLog.run(credentialId, startTime);
  const syncLogId = logResult.lastInsertRowid;
  
  try {
    let result;
    
    switch (credential.portal_type) {
      case 'carespace':
        result = await syncCareSpace(credential, database);
        break;
      case 'generic':
      case 'epic':
      case 'cerner':
      case 'athena':
        // Not yet automated — return a graceful no-op so the UI doesn't show an error
        result = {
          recordsImported: 0,
          summary: {
            connector: credential.portal_type,
            status: 'manual',
            message: `Automated sync is not available for "${credential.portal_type}" portals. ` +
                     `You can manually upload records via the Treatment or Genomics tabs.`,
            details: {},
          }
        };
        break;
      default:
        throw new Error(`Unknown portal type: ${credential.portal_type}`);
    }
    
    // Update sync log
    const endTime = new Date().toISOString();
    database.prepare(`
      UPDATE portal_sync_log
      SET sync_completed = ?,
          status = 'success',
          records_imported = ?
      WHERE id = ?
    `).run(endTime, result.recordsImported, syncLogId);
    
    // Update credential (last_sync_records may not exist on older DBs)
    try {
      database.prepare(`
        UPDATE portal_credentials
        SET last_sync = ?, last_sync_status = 'success', last_sync_records = ?
        WHERE id = ?
      `).run(endTime, result.recordsImported, credentialId);
    } catch (e) {
      database.prepare(`
        UPDATE portal_credentials SET last_sync = ?, last_sync_status = 'success' WHERE id = ?
      `).run(endTime, credentialId);
    }
    
    console.log(`✅ Sync complete: ${result.recordsImported} records imported`);
    
    return {
      success: true,
      recordsImported: result.recordsImported,
      summary: result.summary
    };
    
  } catch (error) {
    console.error(`❌ Sync failed: ${error.message}`);
    
    // Update sync log
    database.prepare(`
      UPDATE portal_sync_log
      SET sync_completed = CURRENT_TIMESTAMP,
          status = 'failed',
          error_message = ?
      WHERE id = ?
    `).run(error.message, syncLogId);
    
    // Update credential
    try {
      database.prepare(`
        UPDATE portal_credentials SET last_sync = CURRENT_TIMESTAMP, last_sync_status = 'failed' WHERE id = ?
      `).run(credentialId);
    } catch (_) {}
    
    throw error;
  }
}

/**
 * CareSpace Portal scraper
 */
async function syncCareSpace(credential, database) {
  // In a packaged Electron app the ASAR virtual FS can't resolve Playwright's
  // internal browser registry — pass the executable path explicitly.
  let executablePath;
  try {
    executablePath = chromium.executablePath();
    console.log('  → Chromium path:', executablePath);
  } catch (e) {
    console.warn('  → chromium.executablePath() failed, falling back to auto-detect');
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  
  const authStatePath = join(tmpdir(), `carespace-auth-${credential.id}.json`);
  
  let context;
  let usedCachedAuth = false;
  
  if (existsSync(authStatePath)) {
    try {
      console.log('  → Using cached authentication');
      context = await browser.newContext({
        storageState: authStatePath,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });
      usedCachedAuth = true;
    } catch (error) {
      console.log('  → Cached auth failed, logging in fresh');
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });
    }
  } else {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
  }
  
  const page = await context.newPage();
  
  const results = {
    labResults: 0,
    imagingReports: 0,
    pathologyReports: 0,
    clinicalNotes: 0,
    medications: 0,
    errors: []
  };
  
  try {
    console.log(`  → Navigating to ${credential.base_url}`);
    await page.goto(credential.base_url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check if already logged in (CareSpace/Flatiron flow)
    // Nav to carespaceportal.com redirects to accounts.flatiron.com/account/login if not logged in
    const currentUrl = page.url();
    const alreadyLoggedIn = currentUrl.includes('carespaceportal.com') && 
                           !currentUrl.includes('/login') &&
                           await page.locator('text=/labs|health|appointments|logout|sign out/i').count() > 0;
    
    if (!alreadyLoggedIn || !usedCachedAuth) {
      // Login required
      if (usedCachedAuth && existsSync(authStatePath)) {
        unlinkSync(authStatePath);
      }
      
      console.log('  → Performing login');
      
      // Detect and fill login fields
      const usernameSelector = await detectUsernameField(page);
      const passwordSelector = await detectPasswordField(page);
      
      if (!usernameSelector || !passwordSelector) {
        throw new Error('Could not detect login form');
      }
      
      await page.fill(usernameSelector, credential.username);
      await page.fill(passwordSelector, credential.password);
      
      const submitButton = await detectSubmitButton(page);
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          page.click(submitButton)
        ]);
      } else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          page.press(passwordSelector, 'Enter')
        ]);
      }
      
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      
      const loginSuccess = await checkLoginSuccess(page);
      if (!loginSuccess) {
        const mfaDetected = await detectMFA(page);
        if (mfaDetected) {
          await browser.close();
          return {
            recordsImported: 0,
            summary: {
              connector: 'CareSpace Portal',
              status: 'MFA Required',
              message: 'Multi-factor authentication detected. Complete MFA manually, then sync again.',
              details: results
            }
          };
        }
        throw new Error('Login failed');
      }
      
      console.log('  ✓ Login successful');
      
      // Save auth state
      try {
        await context.storageState({ path: authStatePath });
      } catch (e) {
        console.log('  → Could not cache auth:', e.message);
      }
    } else {
      console.log('  ✓ Using cached session');
    }
    
    // Scrape data
    try {
      console.log('  → Scraping lab results');
      results.labResults = await scrapeLabs(page, database, credential.id);
    } catch (err) {
      results.errors.push(`Labs: ${err.message}`);
      console.error('  ✗ Lab scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping imaging reports');
      results.imagingReports = await scrapeImaging(page, database, credential.id);
    } catch (err) {
      results.errors.push(`Imaging: ${err.message}`);
      console.error('  ✗ Imaging scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping pathology reports');
      results.pathologyReports = await scrapePathology(page, database, credential.id);
    } catch (err) {
      results.errors.push(`Pathology: ${err.message}`);
      console.error('  ✗ Pathology scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping clinical notes');
      results.clinicalNotes = await scrapeClinicalNotes(page, database, credential.id);
    } catch (err) {
      results.errors.push(`Notes: ${err.message}`);
      console.error('  ✗ Notes scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping medications');
      results.medications = await scrapeMedications(page, database, credential.id);
    } catch (err) {
      results.errors.push(`Medications: ${err.message}`);
      console.error('  ✗ Medications scraping failed:', err.message);
    }
    
    await browser.close();
    
    const totalRecords = results.labResults + results.imagingReports + 
                        results.pathologyReports + results.clinicalNotes + 
                        results.medications;
    
    return {
      recordsImported: totalRecords,
      summary: {
        connector: 'CareSpace Portal',
        status: results.errors.length > 0 ? 'Partial Success' : 'Success',
        message: results.errors.length > 0 
          ? `Completed with ${results.errors.length} errors` 
          : 'All sections scraped successfully',
        details: results,
        errors: results.errors.length > 0 ? results.errors : undefined
      }
    };
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Helper functions for login
async function detectUsernameField(page) {
  const selectors = [
    'input[name="username"]',
    'input[name="userName"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[id*="username" i]',
    'input[id*="email" i]'
  ];
  
  for (const selector of selectors) {
    if (await page.locator(selector).count() > 0) {
      return selector;
    }
  }
  return null;
}

async function detectPasswordField(page) {
  const selectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[id*="password" i]'
  ];
  
  for (const selector of selectors) {
    if (await page.locator(selector).count() > 0) {
      return selector;
    }
  }
  return null;
}

async function detectSubmitButton(page) {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign In")',
    'button:has-text("Log In")',
    'button:has-text("Login")'
  ];
  
  for (const selector of selectors) {
    if (await page.locator(selector).count() > 0) {
      return selector;
    }
  }
  return null;
}

async function checkLoginSuccess(page) {
  const url = page.url();
  
  // CareSpace (Flatiron Health): after login at accounts.flatiron.com,
  // redirects back to carespaceportal.com
  if (url.includes('carespaceportal.com') && !url.includes('/login')) {
    return true;
  }
  // Still on Flatiron but past initial login step
  if (url.includes('flatiron.com') && url.includes('connect/authorize')) {
    // OAuth callback in progress — wait briefly for redirect
    try {
      await page.waitForURL('**/carespaceportal.com/**', { timeout: 8000 });
      return true;
    } catch (_) {}
  }
  
  const successIndicators = [
    page.locator('text=/logout/i'),
    page.locator('text=/sign out/i'),
    page.locator('[href*="logout"]'),
    page.locator('text=/my records/i')
  ];
  
  for (const indicator of successIndicators) {
    if (await indicator.count() > 0) {
      return true;
    }
  }
  
  return false;
}

async function detectMFA(page) {
  const mfaIndicators = [
    page.locator('text=/verification code/i'),
    page.locator('text=/two.factor/i'),
    page.locator('text=/authenticator/i'),
    page.locator('input[placeholder*="code" i]')
  ];
  
  for (const indicator of mfaIndicators) {
    if (await indicator.count() > 0) {
      return true;
    }
  }
  return false;
}

// Data scraping functions
async function scrapeLabs(page, database) {
  const MAX_REPORTS = 10;
  
  // Navigate to Labs tab
  const labsTab = page.locator('a:has-text("Labs")').first();
  if (await labsTab.count() > 0) {
    await labsTab.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  
  // Click Lab Reports tab
  const labReportsTab = page.locator('a:has-text("Lab Reports"), button:has-text("Lab Reports")').first();
  if (await labReportsTab.count() > 0) {
    await labReportsTab.click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  
  // Find report links
  const reportLinks = page.locator('a.side-nav__item, aside a, .side-nav a').filter({
    hasText: /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}/i
  });
  
  const reportCount = await reportLinks.count();
  console.log(`    → Found ${reportCount} lab reports`);
  
  if (reportCount === 0) {
    return 0;
  }
  
  const reportsToProcess = [];
  for (let i = 0; i < Math.min(reportCount, MAX_REPORTS); i++) {
    const link = reportLinks.nth(i);
    const linkText = await link.textContent();
    const linkHref = await link.getAttribute('href');
    reportsToProcess.push({ text: linkText.trim(), href: linkHref });
  }
  
  const allLabResults = [];
  
  for (let reportIdx = 0; reportIdx < reportsToProcess.length; reportIdx++) {
    const report = reportsToProcess[reportIdx];
    
    // Click report
    const reportLink = page.locator(`a.side-nav__item[href="${report.href}"], aside a[href="${report.href}"]`).first();
    await reportLink.click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    
    // Wait for table
    try {
      await page.waitForSelector('.rt-tbody', { timeout: 8000 });
    } catch (e) {
      continue;
    }
    
    // Extract date
    const reportHeader = await page.locator('h1, h2, h3, [class*="header"]').filter({ 
      hasText: /FRIDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|SATURDAY|SUNDAY/i 
    }).first().textContent().catch(() => null);
    
    let reportDate = null;
    if (reportHeader) {
      const match = reportHeader.match(/(\w+) (\d{1,2}), (\d{4})/i);
      if (match) {
        const monthMap = {
          january: '01', february: '02', march: '03', april: '04',
          may: '05', june: '06', july: '07', august: '08',
          september: '09', october: '10', november: '11', december: '12'
        };
        const month = monthMap[match[1].toLowerCase()];
        const day = match[2].padStart(2, '0');
        const year = match[3];
        reportDate = `${year}-${month}-${day}`;
      }
    }
    
    if (!reportDate) {
      continue;
    }
    
    // Parse table
    const tableRows = page.locator('.rt-tbody .rt-tr[role="row"]');
    const rowCount = await tableRows.count();
    
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const cells = await row.locator('.rt-td').allTextContents();
      
      if (cells.length < 3) continue;
      
      const labName = cells[1]?.trim();
      const resultValue = cells[2]?.trim();
      const normalRange = cells[3]?.trim();
      
      if (!labName || !resultValue) continue;
      
      const resultMatch = resultValue.match(/([\d.]+)/);
      const value = resultMatch ? parseFloat(resultMatch[1]) : null;
      
      if (value === null) continue;
      
      const rangeMatch = normalRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)\s*(.*)?/);
      const normalLow = rangeMatch ? parseFloat(rangeMatch[1]) : null;
      const normalHigh = rangeMatch ? parseFloat(rangeMatch[2]) : null;
      const unit = rangeMatch ? rangeMatch[3]?.trim() : null;
      
      allLabResults.push({
        test_name: labName,
        value: value,
        unit: unit,
        normal_low: normalLow,
        normal_high: normalHigh,
        test_date: reportDate
      });
    }
  }
  
  // Insert into database
  let insertedCount = 0;
  
  const insertStmt = database.prepare(`
    INSERT INTO test_results (test_name, result, date, provider, notes, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  
  const checkStmt = database.prepare(`
    SELECT id FROM test_results 
    WHERE test_name = ? AND date = ? AND result = ?
  `);
  
  for (const result of allLabResults) {
    let resultWithUnit = result.unit 
      ? `${result.value} ${result.unit}` 
      : String(result.value);
    
    if (result.normal_low !== null && result.normal_high !== null) {
      if (result.value < result.normal_low) {
        resultWithUnit += ' LOW';
      } else if (result.value > result.normal_high) {
        resultWithUnit += ' HIGH';
      }
    }
    
    const notes = result.normal_low && result.normal_high
      ? `Normal range: ${result.normal_low}-${result.normal_high}${result.unit ? ' ' + result.unit : ''}. Source: CareSpace`
      : 'Source: CareSpace';
    
    const existing = checkStmt.get(result.test_name, result.test_date, resultWithUnit);
    
    if (!existing) {
      insertStmt.run(result.test_name, resultWithUnit, result.test_date, 'CareSpace Portal', notes);
      insertedCount++;
    }
  }
  
  console.log(`    ✓ Imported ${insertedCount} lab results`);
  return insertedCount;
}

// ── Ensure portal_documents table exists ─────────────────────────────────────
function ensurePortalDocumentsTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS portal_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portal_credential_id INTEGER,
      document_type TEXT NOT NULL,
      title TEXT NOT NULL,
      document_date TEXT,
      provider TEXT,
      content TEXT,
      file_path TEXT,
      mime_type TEXT DEFAULT 'text/plain',
      source_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(document_type, title, document_date, provider)
    )
  `);
}

// ── Generic document navigator & scraper ─────────────────────────────────────
// Tries multiple nav link patterns; returns the count of records stored.
async function navigateAndScrapeDocSection(page, database, credentialId, navTexts, docType) {
  ensurePortalDocumentsTable(database);

  // Try to click nav link
  for (const text of navTexts) {
    try {
      const link = page.locator(`a:has-text("${text}"), button:has-text("${text}"), nav *:has-text("${text}")`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(1500);
        break;
      }
    } catch (_) {}
  }

  // Collect visible document rows / links
  const rowSelectors = [
    '.document-row', '.report-item', '.record-row',
    'tr[data-testid*="row"]', '.list-item', 'li.result-item',
    '[class*="document"]', '[class*="report"]', '[class*="record"]',
    'table tbody tr', '.rt-tbody .rt-tr[role="row"]'
  ];

  let rows = null;
  for (const sel of rowSelectors) {
    const found = page.locator(sel);
    if (await found.count() > 0) { rows = found; break; }
  }

  if (!rows) {
    // Fallback: grab all text on the page, store as one big note
    const bodyText = await page.locator('main, [role="main"], body').first().innerText().catch(() => '');
    if (bodyText.trim().length > 50) {
      const title = `${docType} — ${new Date().toISOString().split('T')[0]}`;
      try {
        database.prepare(`
          INSERT OR IGNORE INTO portal_documents (portal_credential_id, document_type, title, document_date, provider, content, mime_type)
          VALUES (?, ?, ?, date('now'), 'CareSpace Portal', ?, 'text/plain')
        `).run(credentialId, docType, title, bodyText.substring(0, 50000));
        return 1;
      } catch (_) { return 0; }
    }
    return 0;
  }

  const count = await rows.count();
  const MAX = 50;
  let stored = 0;

  const checkStmt = database.prepare(`SELECT id FROM portal_documents WHERE document_type = ? AND title = ? AND document_date = ?`);
  const insertStmt = database.prepare(`
    INSERT OR IGNORE INTO portal_documents (portal_credential_id, document_type, title, document_date, provider, content, source_url, mime_type)
    VALUES (?, ?, ?, ?, 'CareSpace Portal', ?, ?, 'text/plain')
  `);

  for (let i = 0; i < Math.min(count, MAX); i++) {
    try {
      const row = rows.nth(i);
      const rowText = (await row.innerText().catch(() => '')).trim();
      if (!rowText || rowText.length < 3) continue;

      // Extract date from row text
      const dateMatch = rowText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i);
      let docDate = null;
      if (dateMatch) {
        try { docDate = new Date(dateMatch[0]).toISOString().split('T')[0]; } catch (_) {}
      }

      // Use first meaningful line as title
      const lines = rowText.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0]?.substring(0, 200) || `${docType} record`;

      // Try to get source URL
      const href = await row.locator('a').first().getAttribute('href').catch(() => null);

      const existing = checkStmt.get(docType, title, docDate || '');
      if (!existing) {
        insertStmt.run(credentialId, docType, title, docDate || '', rowText.substring(0, 10000), href || null);
        stored++;
      }
    } catch (_) {}
  }

  return stored;
}

async function scrapeImaging(page, database, credentialId) {
  console.log('    → Scraping imaging/radiology reports');
  return navigateAndScrapeDocSection(
    page, database, credentialId,
    ['Imaging', 'Radiology', 'Radiology Reports', 'Imaging Reports'],
    'Radiology Report'
  );
}

async function scrapePathology(page, database, credentialId) {
  console.log('    → Scraping pathology reports');
  return navigateAndScrapeDocSection(
    page, database, credentialId,
    ['Pathology', 'Pathology Reports', 'Biopsy'],
    'Pathology Report'
  );
}

async function scrapeClinicalNotes(page, database, credentialId) {
  console.log('    → Scraping clinical notes / visit summaries');
  return navigateAndScrapeDocSection(
    page, database, credentialId,
    ["Doctor's Notes", 'Clinical Notes', 'Visit Summary', 'Visit Summaries', 'Notes', 'Documents', 'Health Records'],
    'Clinical Note'
  );
}

async function scrapeMedications(page, database, credentialId) {
  // Navigate to medications / active prescriptions list
  for (const text of ['Medications', 'Prescriptions', 'Active Medications']) {
    try {
      const link = page.locator(`a:has-text("${text}"), nav *:has-text("${text}")`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1200);
        break;
      }
    } catch (_) {}
  }

  // Try to grab medication rows
  const rowSelectors = ['.medication-row', 'tr', '.list-item', '[class*="med"]', 'table tbody tr'];
  let rows = null;
  for (const sel of rowSelectors) {
    const found = page.locator(sel);
    if (await found.count() > 1) { rows = found; break; }
  }
  if (!rows) return 0;

  const count = await rows.count();
  const insertStmt = database.prepare(`
    INSERT OR IGNORE INTO medications (name, dosage, notes, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const checkStmt = database.prepare(`SELECT id FROM medications WHERE name = ?`);

  let stored = 0;
  for (let i = 0; i < Math.min(count, 50); i++) {
    try {
      const text = (await rows.nth(i).innerText().catch(() => '')).trim();
      if (!text || text.length < 3) continue;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const name = lines[0];
      if (!name || name.length < 2) continue;
      const existing = checkStmt.get(name);
      if (!existing) {
        insertStmt.run(name, lines[1] || null, 'Source: CareSpace Portal');
        stored++;
      }
    } catch (_) {}
  }
  return stored;
}

module.exports = { syncPortal };
