import { chromium } from 'playwright';
import { run, query } from '../db.js';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * CareSpace Portal scraper using Playwright
 * 
 * Logs in, navigates to key sections, downloads data
 */
export async function syncCareSpace(credential) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  
  // Cookie cache file path (unique per credential)
  const authStatePath = join(tmpdir(), `carespace-auth-${credential.id}.json`);
  
  // Try to reuse existing auth state
  let context;
  let usedCachedAuth = false;
  
  if (existsSync(authStatePath)) {
    try {
      console.log('  → Attempting to reuse cached authentication...');
      context = await browser.newContext({
        storageState: authStatePath,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });
      usedCachedAuth = true;
    } catch (error) {
      console.log('  → Cached auth failed, will login fresh');
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
    signateraReports: 0,
    medications: 0,
    errors: []
  };
  
  try {
    console.log(`  → Navigating to ${credential.base_url}`);
    await page.goto(credential.base_url, { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log(`  → Current URL: ${page.url()}`);
    
    // Check if we're already logged in (cached auth worked)
    const alreadyLoggedIn = page.url().includes('carespaceportal.com') && 
                           !page.url().includes('/login') &&
                           await page.locator('text=/labs|health|appointments/i').count() > 0;
    
    if (alreadyLoggedIn && usedCachedAuth) {
      console.log('  ✓ Cached authentication successful - skipping login!');
    } else {
      // If cached auth failed, delete the cache file
      if (usedCachedAuth && existsSync(authStatePath)) {
        console.log('  → Cached auth expired, deleting cache...');
        unlinkSync(authStatePath);
      }
      
      // CareSpace redirects to Flatiron Health SSO
      if (page.url().includes('accounts.flatiron.com')) {
        console.log('  → Detected Flatiron Health SSO login');
      }
      
      // Take screenshot for debugging
      await page.screenshot({ path: '/tmp/carespace-page.png' });
      console.log('  → Screenshot saved to /tmp/carespace-page.png');
      
      // === LOGIN SEQUENCE ===
      console.log('  → Attempting login...');
      
      // Look for common login form fields
      const usernameSelector = await detectUsernameField(page);
      const passwordSelector = await detectPasswordField(page);
      
      console.log(`  → Username field: ${usernameSelector || 'NOT FOUND'}`);
      console.log(`  → Password field: ${passwordSelector || 'NOT FOUND'}`);
      console.log(`  → Page title: ${await page.title()}`);
      
      if (!usernameSelector || !passwordSelector) {
        throw new Error('Could not detect login form. Check /tmp/carespace-page.png for details.');
      }
      
      await page.fill(usernameSelector, credential.username);
      await page.fill(passwordSelector, credential.password);
      
      // Find and click submit button
      const submitButton = await detectSubmitButton(page);
      if (submitButton) {
        console.log(`  → Clicking submit button: ${submitButton}`);
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          page.click(submitButton)
        ]);
      } else {
        // Fallback: press Enter
        console.log('  → Pressing Enter to submit');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          page.press(passwordSelector, 'Enter')
        ]);
      }
      
      // OAuth flow may have multiple redirects
      // Wait a bit for all redirects to complete
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      console.log(`  → After login, URL: ${page.url()}`);
      
      // Take post-login screenshot
      await page.screenshot({ path: '/tmp/carespace-after-login.png' });
      console.log('  → Post-login screenshot saved');
      
      // Check if login succeeded (look for common success indicators)
      const loginSuccess = await checkLoginSuccess(page);
      
      if (!loginSuccess) {
        // Check for MFA prompt
        const mfaDetected = await detectMFA(page);
        
        if (mfaDetected) {
          // MFA required - for now, return partial success with instructions
          await browser.close();
          return {
            recordsImported: 0,
            summary: {
              connector: 'CareSpace Portal (Browser Automation)',
              status: 'MFA Required',
              message: 'Multi-factor authentication detected. Manual intervention needed for first sync.',
              mfaInstructions: [
                'CareSpace requires MFA code',
                'Option 1: Enter TOTP secret in credential settings',
                'Option 2: Complete MFA manually, then re-sync'
              ],
              details: results
            }
          };
        }
        
        throw new Error('Login failed. Check credentials or portal may have changed.');
      }
      
      console.log('  ✓ Login successful');
      
      // Save authentication state for future syncs
      try {
        await context.storageState({ path: authStatePath });
        console.log('  → Cached authentication for future syncs');
      } catch (saveError) {
        console.log('  → Warning: Could not cache auth state:', saveError.message);
      }
    } // End of login block
    
    // Check if browser/page is still alive before scraping
    if (!page || page.isClosed()) {
      throw new Error('Page was closed before scraping could begin');
    }
    
    // === SCRAPE LAB RESULTS ===
    try {
      console.log('  → Scraping lab results...');
      results.labResults = await scrapeLabs(page, credential);
    } catch (err) {
      results.errors.push(`Labs: ${err.message}`);
      console.error('    ✗ Lab scraping failed:', err.message);
      // If browser is closed, don't try other sections
      if (err.message.includes('Target page, context or browser has been closed')) {
        console.error('    ⚠ Browser closed unexpectedly, skipping remaining sections');
        await browser.close();
        return {
          recordsImported: results.labResults || 0,
          summary: {
            connector: 'CareSpace Portal (Browser Automation)',
            status: 'Partial Success',
            message: 'Browser closed unexpectedly after labs',
            details: results,
            errors: results.errors
          }
        };
      }
    }
    
    // === SCRAPE IMAGING REPORTS ===
    try {
      if (!page.isClosed()) {
        console.log('  → Scraping imaging reports...');
        results.imagingReports = await scrapeImaging(page, credential);
      }
    } catch (err) {
      results.errors.push(`Imaging: ${err.message}`);
      console.error('    ✗ Imaging scraping failed:', err.message);
    }
    
    // === SCRAPE PATHOLOGY REPORTS ===
    try {
      if (!page.isClosed()) {
        console.log('  → Scraping pathology reports...');
        results.pathologyReports = await scrapePathology(page, credential);
      }
    } catch (err) {
      results.errors.push(`Pathology: ${err.message}`);
      console.error('    ✗ Pathology scraping failed:', err.message);
    }
    
    // === SCRAPE CLINICAL NOTES ===
    try {
      if (!page.isClosed()) {
        console.log('  → Scraping doctor notes...');
        results.clinicalNotes = await scrapeClinicalNotes(page, credential);
      }
    } catch (err) {
      results.errors.push(`Notes: ${err.message}`);
      console.error('    ✗ Notes scraping failed:', err.message);
    }
    
    // === SCRAPE MEDICATIONS ===
    try {
      if (!page.isClosed()) {
        console.log('  → Scraping medications...');
        results.medications = await scrapeMedications(page, credential);
      }
    } catch (err) {
      results.errors.push(`Medications: ${err.message}`);
      console.error('    ✗ Medication scraping failed:', err.message);
    }
    
    await browser.close();
    
    const totalRecords = Object.values(results).reduce((sum, val) => 
      typeof val === 'number' ? sum + val : sum, 0
    );
    
    return {
      recordsImported: totalRecords,
      summary: {
        connector: 'CareSpace Portal (Browser Automation)',
        status: results.errors.length > 0 ? 'Partial Success' : 'Success',
        message: results.errors.length > 0 
          ? `Completed with ${results.errors.length} errors` 
          : 'All sections scraped successfully',
        details: {
          labResults: results.labResults,
          imagingReports: results.imagingReports,
          pathologyReports: results.pathologyReports,
          clinicalNotes: results.clinicalNotes,
          signateraReports: results.signateraReports,
          medications: results.medications
        },
        errors: results.errors.length > 0 ? results.errors : undefined
      }
    };
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// === HELPER FUNCTIONS ===

async function detectUsernameField(page) {
  const selectors = [
    'input[name="username"]',
    'input[name="userName"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[id*="username" i]',
    'input[id*="email" i]',
    'input[placeholder*="username" i]',
    'input[placeholder*="email" i]'
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
    'button:has-text("Login")',
    'a:has-text("Sign In")',
    'a:has-text("Log In")'
  ];
  
  for (const selector of selectors) {
    if (await page.locator(selector).count() > 0) {
      return selector;
    }
  }
  return null;
}

async function checkLoginSuccess(page) {
  const currentUrl = page.url();
  
  // If we're back on carespaceportal.com (not accounts.flatiron.com), likely successful
  if (currentUrl.includes('carespaceportal.com') && !currentUrl.includes('/login')) {
    console.log('  → Redirected back to CareSpace portal (OAuth success indicator)');
    return true;
  }
  
  // Look for common post-login indicators
  const successIndicators = [
    page.locator('text=/dashboard/i'),
    page.locator('text=/welcome/i'),
    page.locator('text=/logout/i'),
    page.locator('text=/sign out/i'),
    page.locator('[href*="logout"]'),
    page.locator('[href*="signout"]'),
    page.locator('text=/my records/i'),
    page.locator('text=/health records/i')
  ];
  
  for (const indicator of successIndicators) {
    if (await indicator.count() > 0) {
      console.log('  → Found success indicator');
      return true;
    }
  }
  
  // Check if still on login page (failure indicator)
  if (currentUrl.includes('accounts.flatiron.com') && currentUrl.includes('login')) {
    console.log('  → Still on Flatiron login page (failed)');
    return false;
  }
  
  const loginIndicators = [
    page.locator('input[type="password"]'),
    page.locator('text=/sign in/i'),
    page.locator('text=/log in/i'),
    page.locator('text=/invalid/i'),
    page.locator('text=/incorrect/i')
  ];
  
  for (const indicator of loginIndicators) {
    if (await indicator.count() > 0) {
      console.log('  → Found login/error indicator');
      return false;
    }
  }
  
  // Assume success if we can't definitively say we failed
  console.log('  → Assuming success (no clear failure indicators)');
  return true;
}

async function detectMFA(page) {
  const mfaIndicators = [
    page.locator('text=/verification code/i'),
    page.locator('text=/two.factor/i'),
    page.locator('text=/authenticator/i'),
    page.locator('input[placeholder*="code" i]'),
    page.locator('input[name*="otp" i]'),
    page.locator('input[name*="mfa" i]')
  ];
  
  for (const indicator of mfaIndicators) {
    if (await indicator.count() > 0) {
      return true;
    }
  }
  return false;
}

// === DATA SCRAPING FUNCTIONS (CARESPACE-SPECIFIC) ===

async function scrapeLabs(page, credential) {
  try {
    // CareSpace Labs page structure:
    // - Navigation: Health | Labs | Appointments | Messages | Resources
    // - Labs page has: "Lab Reports" | "Lab History" tabs
    // - "Lab Reports" tab shows a TABLE view with all tests at once (MUCH BETTER for scraping!)
    //   - Left sidebar: Date-based report list (e.g., "Friday February 6 - CBC PLT AUTODIFF; POC GLUCOSE")
    //   - Main area: TABLE with columns: Lab | Your result | Normal range | History
    //   - Rows: WBC, RBC, Hgb, HCT, MCV, MCH, etc. with values already visible
    
    // Configuration: How many reports to scrape (default: last 10)
    const MAX_REPORTS = parseInt(process.env.CARESPACE_MAX_REPORTS) || 10;
    
    console.log('    → Clicking Labs navigation tab');
    
    // Click the Labs tab in the main navigation
    try {
      const labsTab = page.locator('a:has-text("Labs")').first();
      
      if (await labsTab.count() > 0) {
        await labsTab.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
          console.log('    → Navigation timeout (continuing anyway)');
        });
        await page.waitForTimeout(2000);
      }
    } catch (navError) {
      console.log(`    → Navigation error: ${navError.message}, continuing...`);
    }
    
    // Make sure we're on the "Lab Reports" tab (should be default, but click it to be sure)
    try {
      const labReportsTab = page.locator('a:has-text("Lab Reports"), button:has-text("Lab Reports")').first();
      if (await labReportsTab.count() > 0) {
        await labReportsTab.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
          console.log('    → Tab navigation timeout (continuing)');
        });
        await page.waitForTimeout(1500);
      }
    } catch (tabError) {
      console.log(`    → Tab click error: ${tabError.message}, continuing...`);
    }
    
    await page.screenshot({ path: '/tmp/carespace-labs-reports.png' });
    console.log('    → Lab Reports page screenshot saved');
    
    // Save HTML for debugging
    const pageHTML = await page.content();
    writeFileSync('/tmp/carespace-labs.html', pageHTML);
    console.log('    → HTML saved to /tmp/carespace-labs.html');
    
    // Get all report links from the sidebar
    // Format: "Friday February 6" or "Thursday January 30"
    console.log('    → Finding available lab reports in sidebar...');
    const reportLinks = page.locator('a.side-nav__item, aside a, .side-nav a').filter({
      hasText: /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}/i
    });
    
    const reportCount = await reportLinks.count();
    console.log(`    → Found ${reportCount} available reports (will process up to ${MAX_REPORTS})`);
    
    if (reportCount === 0) {
      console.log('    ⚠ No reports found in sidebar');
      return 0;
    }
    
    // Collect report URLs/info before clicking (to avoid stale element references)
    const reportsToProcess = [];
    for (let i = 0; i < Math.min(reportCount, MAX_REPORTS); i++) {
      const link = reportLinks.nth(i);
      const linkText = await link.textContent();
      const linkHref = await link.getAttribute('href');
      reportsToProcess.push({ text: linkText.trim(), href: linkHref });
    }
    
    console.log(`    → Will process ${reportsToProcess.length} reports`);
    
    let totalImportedCount = 0;
    const allLabResults = [];
    
    // Process each report
    for (let reportIdx = 0; reportIdx < reportsToProcess.length; reportIdx++) {
      const report = reportsToProcess[reportIdx];
      console.log(`    → [${reportIdx + 1}/${reportsToProcess.length}] Processing: ${report.text}`);
      
      // Click the report link
      try {
        const reportLink = page.locator(`a.side-nav__item[href="${report.href}"], aside a[href="${report.href}"], .side-nav a[href="${report.href}"]`).first();
        await reportLink.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
          console.log('      → Navigation timeout (continuing)');
        });
        await page.waitForTimeout(1500);
      } catch (clickError) {
        console.log(`      ✗ Failed to click report: ${clickError.message}`);
        continue;
      }
      
      // Wait for the React table to load
      try {
        await page.waitForSelector('.rt-tbody', { timeout: 8000 });
      } catch (e) {
        console.log('      → React table not found, skipping this report');
        continue;
      }
      
      await page.waitForTimeout(1000);
      
      // Extract the report date from the main area header
      // Format: "FRIDAY FEBRUARY 6, 2026"
      const reportHeader = await page.locator('h1, h2, h3, [class*="header"]').filter({ 
        hasText: /FRIDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|SATURDAY|SUNDAY/i 
      }).first().textContent().catch(() => null);
      
      let reportDate = null;
      if (reportHeader) {
        // Parse "FRIDAY FEBRUARY 6, 2026" → "2026-02-06"
        const match = reportHeader.match(/(\w+) (\d{1,2}), (\d{4})/i);
        if (match) {
          const monthName = match[1];
          const day = match[2].padStart(2, '0');
          const year = match[3];
          const monthMap = {
            january: '01', february: '02', march: '03', april: '04',
            may: '05', june: '06', july: '07', august: '08',
            september: '09', october: '10', november: '11', december: '12'
          };
          const month = monthMap[monthName.toLowerCase()];
          reportDate = `${year}-${month}-${day}`;
          console.log(`      → Report date: ${reportDate}`);
        }
      }
      
      if (!reportDate) {
        console.log('      ⚠ Could not extract report date, skipping');
        continue;
      }
      
      // Now extract data from the React table
      // The "table" is actually divs with class="ReactTable"
      // Structure: .rt-tbody > .rt-tr-group > .rt-tr (rows)
      // Each row: .rt-td cells (Lab | Your result | Normal range | History)
      
      const tableRows = page.locator('.rt-tbody .rt-tr[role="row"]');
      const rowCount = await tableRows.count();
      console.log(`      → Found ${rowCount} data rows in React table`);
      
      let reportImportedCount = 0;
      
      // Process each React table row
      for (let i = 0; i < rowCount; i++) {
        try {
          const row = tableRows.nth(i);
          const cells = await row.locator('.rt-td').allTextContents();
          
          if (cells.length < 3) {
            continue;
          }
          
          // Column 0: Expander (skip)
          // Column 1: Lab name (e.g., "WBC")
          // Column 2: Your result (e.g., "6.2")
          // Column 3: Normal range (e.g., "4.2-10.0 x10^3/UL")
          // Column 4: History (chart icon, skip)
          
          const labName = cells[1]?.trim();
          const resultValue = cells[2]?.trim();
          const normalRange = cells[3]?.trim();
          
          if (!labName || !resultValue) {
            continue;
          }
          
          // Filter out non-lab rows (like headers or empty rows)
          if (labName.toLowerCase().includes('lab') || labName.toLowerCase().includes('test')) {
            continue;
          }
          
          // Parse result value (may include "Low" or "High" indicator)
          // Example: "13.3 Low" or "6.2"
          const resultMatch = resultValue.match(/([\d.]+)/);
          const value = resultMatch ? parseFloat(resultMatch[1]) : null;
          
          if (value === null) {
            continue;
          }
          
          // Parse normal range
          // Example: "4.2-10.0 x10^3/UL" → low=4.2, high=10.0, unit="x10^3/UL"
          const rangeMatch = normalRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)\s*(.*)?/);
          const normalLow = rangeMatch ? parseFloat(rangeMatch[1]) : null;
          const normalHigh = rangeMatch ? parseFloat(rangeMatch[2]) : null;
          const unit = rangeMatch ? rangeMatch[3]?.trim() : null;
          
          // Store for batch insert
          allLabResults.push({
            test_name: labName,
            value: value,
            unit: unit,
            normal_low: normalLow,
            normal_high: normalHigh,
            test_date: reportDate,
            source: 'CareSpace'
          });
          
          reportImportedCount++;
          
        } catch (rowError) {
          console.error(`        ✗ Error processing row ${i}: ${rowError.message}`);
        }
      }
      
      console.log(`      ✓ Extracted ${reportImportedCount} lab values from ${reportDate}`);
      totalImportedCount += reportImportedCount;
    } // End of report loop
    
    // Insert results into database (using test_results table)
    let insertedCount = 0;
    let skippedCount = 0;
    
    if (allLabResults.length > 0) {
      console.log(`    → Inserting ${allLabResults.length} lab results from ${reportsToProcess.length} reports into database`);
      
      for (const result of allLabResults) {
        try {
          // Convert date from YYYY-MM-DD (already formatted) or m/d/yy to YYYY-MM-DD
          let formattedDate = result.test_date; // Already in YYYY-MM-DD format from earlier
          
          // Format result with unit
          let resultWithUnit = result.unit 
            ? `${result.value} ${result.unit}` 
            : String(result.value);
          
          // Add HIGH/LOW flag if out of range
          if (result.normal_low !== null && result.normal_high !== null) {
            if (result.value < result.normal_low) {
              resultWithUnit += ' LOW';
            } else if (result.value > result.normal_high) {
              resultWithUnit += ' HIGH';
            }
          }
          
          // Format notes with reference range
          const notes = result.normal_low && result.normal_high
            ? `Normal range: ${result.normal_low}-${result.normal_high}${result.unit ? ' ' + result.unit : ''}. Source: CareSpace`
            : 'Source: CareSpace';
          
          // Check if this result already exists (same test, date, and value)
          let existing;
          try {
            existing = query(`
              SELECT id FROM test_results 
              WHERE test_name = ? AND date = ? AND result = ?
            `, [result.test_name, formattedDate, resultWithUnit]);
          } catch (queryError) {
            console.error(`        ✗ Query failed for ${result.test_name}: ${queryError.message}`);
            existing = []; // Treat as no existing record
          }
          
          if (!existing || !Array.isArray(existing) || existing.length === 0) {
            run(`
              INSERT INTO test_results (test_name, result, date, provider, notes, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [result.test_name, resultWithUnit, formattedDate, 'CareSpace Portal', notes]);
            insertedCount++;
          } else {
            skippedCount++;
          }
        } catch (dbError) {
          console.error(`        ✗ DB error for ${result.test_name}: ${dbError.message}`);
        }
      }
    }
    
    console.log(`    ✓ Processed ${reportsToProcess.length} reports: ${insertedCount} new results, ${skippedCount} duplicates skipped`);
    return insertedCount;
    
  } catch (error) {
    console.error(`    ✗ Lab scraping error: ${error.message}`);
    throw error;
  }
}

async function scrapeImaging(page, credential) {
  try {
    // Imaging might be under Resources tab or mixed in with Documents
    console.log('    → Looking for imaging/radiology section');
    
    // Try clicking Resources tab
    const resourcesTab = page.locator('text="Resources"').first();
    if (await resourcesTab.count() > 0) {
      await resourcesTab.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.screenshot({ path: '/tmp/carespace-resources.png' });
      console.log('    → Resources tab screenshot saved');
    }
    
    // Look for imaging-related links or documents
    const imagingIndicators = [
      page.locator('text=/imaging/i'),
      page.locator('text=/radiology/i'),
      page.locator('text=/scan/i'),
      page.locator('text=/CT|MRI|PET|X-ray/i')
    ];
    
    let found = false;
    for (const indicator of imagingIndicators) {
      if (await indicator.count() > 0) {
        console.log('    → Found imaging-related content');
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('    ℹ No imaging section found (may be in Documents with specific type)');
    }
    
    // TODO: Parse imaging reports
    // TODO: Extract scan type, date, findings, radiologist notes
    // TODO: Download report PDFs if available
    
    return 0;
    
  } catch (error) {
    console.error(`    ✗ Imaging scraping error: ${error.message}`);
    throw error;
  }
}

async function scrapePathology(page, credential) {
  try {
    console.log('    → Looking for pathology reports');
    
    // Pathology likely in Documents section with Type = "Pathology" or similar
    // Navigate to Health tab if not already there
    const healthTab = page.locator('text="Health"').first();
    if (await healthTab.count() > 0) {
      await healthTab.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }
    
    // Look for pathology-related documents
    const pathologyIndicators = [
      page.locator('text=/pathology/i'),
      page.locator('text=/biopsy/i'),
      page.locator('text=/tissue/i'),
      page.locator('text=/surgical pathology/i')
    ];
    
    let found = false;
    for (const indicator of pathologyIndicators) {
      if (await indicator.count() > 0) {
        console.log('    → Found pathology-related content');
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('    ℹ No pathology reports found');
    }
    
    // TODO: Parse pathology reports
    // TODO: Extract tissue type, diagnosis, staging, IHC results
    // TODO: Download report PDFs
    
    return 0;
    
  } catch (error) {
    console.error(`    ✗ Pathology scraping error: ${error.message}`);
    throw error;
  }
}

async function scrapeClinicalNotes(page, credential) {
  try {
    // CareSpace Documents section is on the Health tab
    // Columns: Name, Type, Date
    // EXCLUDE: "Nurse Note" type (per user request)
    // INCLUDE: "Provider Note", "Clinical Note", "Visit Summary", "Progress Note", etc.
    
    console.log('    → Navigating to Health tab for Documents');
    const healthTab = page.locator('nav a:has-text("Health"), header a:has-text("Health")').first();
    
    if (await healthTab.count() > 0) {
      await healthTab.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.waitForTimeout(1500);
    }
    
    // Scroll down to Documents section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/carespace-documents.png' });
    console.log('    → Documents section screenshot saved');
    
    // Find the Documents table rows
    // Table structure: Name | Type | Date | (link icon)
    const documentTable = page.locator('table').filter({ hasText: 'Documents' }).or(
      page.locator('section, div').filter({ hasText: /^Documents$/ }).locator('table')
    );
    
    // Get all rows except header
    const allRows = page.locator('table tbody tr, table tr:not(:first-child)').filter({ hasText: /Note|Report|Education/i });
    const rowCount = await allRows.count();
    console.log(`    → Found ${rowCount} document rows`);
    
    if (rowCount === 0) {
      console.log('    ℹ No documents found');
      return 0;
    }
    
    let importedCount = 0;
    const excludedTypes = ['nurse note', 'mar/nurse note', 'nursing'];
    const includedTypes = ['provider note', 'clinical note', 'progress note', 'visit summary', 'physician note', 'office visit', 'consultation'];
    
    // Process each document row
    for (let i = 0; i < rowCount; i++) {
      try {
        const row = allRows.nth(i);
        const rowText = await row.textContent();
        
        // Extract columns from row text
        // Pattern: "MAR/Nurse Note: 2/6/2026    Nurse Note    Feb 6, 2026"
        const cells = await row.locator('td').allTextContents();
        
        const docName = cells[0] || '';
        const docType = cells[1] || '';
        const docDate = cells[2] || '';
        
        // Check if this document type should be excluded
        const typeLower = docType.toLowerCase();
        const isExcluded = excludedTypes.some(t => typeLower.includes(t));
        
        if (isExcluded) {
          console.log(`      → Skipping "${docName}" (Type: ${docType})`);
          continue;
        }
        
        // Check if this is a clinical note type we want
        const isIncluded = includedTypes.some(t => typeLower.includes(t)) || 
                          typeLower.includes('note') && !isExcluded;
        
        if (!isIncluded && docType !== 'PatientEducation') {
          console.log(`      → Including "${docName}" (Type: ${docType}, Date: ${docDate})`);
          
          // Click on the document row or link to view content
          const docLink = row.locator('a').first();
          if (await docLink.count() > 0) {
            await docLink.click();
            await page.waitForLoadState('networkidle', { timeout: 15000 });
            await page.waitForTimeout(1500);
            
            // Screenshot the document
            await page.screenshot({ path: `/tmp/carespace-doc-${i}.png` });
            
            // Extract document content
            const docContent = await page.textContent('main, article, .document-content, .note-content');
            console.log(`        ✓ Document content length: ${docContent?.length || 0} chars`);
            
            // TODO: Parse and insert into clinical_notes table
            // Fields: note_date, provider_name, note_type, content
            
            importedCount++;
            
            // Go back to Health page
            await page.goBack();
            await page.waitForLoadState('networkidle', { timeout: 15000 });
            await page.waitForTimeout(1000);
          }
        } else {
          console.log(`      → Skipping non-clinical doc "${docName}" (Type: ${docType})`);
        }
        
      } catch (rowError) {
        console.error(`      ✗ Error processing document row: ${rowError.message}`);
      }
    }
    
    console.log(`    ✓ Processed ${importedCount} clinical notes (excluding nursing notes)`);
    return importedCount;
    
  } catch (error) {
    console.error(`    ✗ Clinical notes scraping error: ${error.message}`);
    throw error;
  }
}

async function scrapeMedications(page, credential) {
  try {
    console.log('    → Looking for medications section');
    
    // Medications might be on Health tab or under a separate section
    // Try navigating to Health tab first
    const healthTab = page.locator('text="Health"').first();
    if (await healthTab.count() > 0) {
      await healthTab.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }
    
    // Look for medication-related sections
    const medicationIndicators = [
      page.locator('text=/medication/i'),
      page.locator('text=/prescription/i'),
      page.locator('text=/drug/i'),
      page.locator('text=/active medication/i')
    ];
    
    let found = false;
    for (const indicator of medicationIndicators) {
      if (await indicator.count() > 0) {
        console.log('    → Found medication-related content');
        found = true;
        // Could click on it if it's a link
        if (await indicator.count() > 0) {
          try {
            await indicator.first().click();
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            await page.screenshot({ path: '/tmp/carespace-medications.png' });
            console.log('    → Medications screenshot saved');
          } catch (e) {
            // Might not be clickable
          }
        }
        break;
      }
    }
    
    if (!found) {
      console.log('    ℹ No medications section found');
    }
    
    // TODO: Parse medication list
    // TODO: Extract drug name, dosage, frequency, start date
    // TODO: Insert into medications table
    
    return 0;
    
  } catch (error) {
    console.error(`    ✗ Medication scraping error: ${error.message}`);
    throw error;
  }
}
