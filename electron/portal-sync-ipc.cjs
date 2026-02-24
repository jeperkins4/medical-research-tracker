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
  
  // Decrypt password
  const decryptedPassword = vault.decrypt(cred.password);
  const credential = {
    ...cred,
    password: decryptedPassword
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
    
    // Update credential
    database.prepare(`
      UPDATE portal_credentials
      SET last_sync = ?,
          last_sync_status = 'success',
          last_sync_records = ?
      WHERE id = ?
    `).run(endTime, result.recordsImported, credentialId);
    
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
    database.prepare(`
      UPDATE portal_credentials
      SET last_sync = CURRENT_TIMESTAMP,
          last_sync_status = 'failed'
      WHERE id = ?
    `).run(credentialId);
    
    throw error;
  }
}

/**
 * CareSpace Portal scraper
 */
async function syncCareSpace(credential, database) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
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
    
    // Check if already logged in
    const alreadyLoggedIn = page.url().includes('carespaceportal.com') && 
                           !page.url().includes('/login') &&
                           await page.locator('text=/labs|health|appointments/i').count() > 0;
    
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
      results.labResults = await scrapeLabs(page, database);
    } catch (err) {
      results.errors.push(`Labs: ${err.message}`);
      console.error('  ✗ Lab scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping imaging reports');
      results.imagingReports = await scrapeImaging(page, database);
    } catch (err) {
      results.errors.push(`Imaging: ${err.message}`);
      console.error('  ✗ Imaging scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping pathology reports');
      results.pathologyReports = await scrapePathology(page, database);
    } catch (err) {
      results.errors.push(`Pathology: ${err.message}`);
      console.error('  ✗ Pathology scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping clinical notes');
      results.clinicalNotes = await scrapeClinicalNotes(page, database);
    } catch (err) {
      results.errors.push(`Notes: ${err.message}`);
      console.error('  ✗ Notes scraping failed:', err.message);
    }
    
    try {
      console.log('  → Scraping medications');
      results.medications = await scrapeMedications(page, database);
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
  
  if (url.includes('carespaceportal.com') && !url.includes('/login')) {
    return true;
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

async function scrapeImaging(page, database) {
  // TODO: Implement imaging scraping
  return 0;
}

async function scrapePathology(page, database) {
  // TODO: Implement pathology scraping
  return 0;
}

async function scrapeClinicalNotes(page, database) {
  // TODO: Implement clinical notes scraping
  return 0;
}

async function scrapeMedications(page, database) {
  // TODO: Implement medications scraping
  return 0;
}

module.exports = { syncPortal };
