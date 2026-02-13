#!/usr/bin/env node
/**
 * Debug script: Test CareSpace lab scraping with detailed logging
 */

import { chromium } from 'playwright';
import { getCredential } from './server/portal-credentials.js';
import { init as initDb, query } from './server/db.js';

// Initialize database
initDb();

// Get CareSpace credential ID
const credentialRows = query("SELECT id FROM portal_credentials WHERE portal_type = 'carespace' LIMIT 1");
if (!credentialRows || credentialRows.length === 0) {
  console.error('❌ No CareSpace credential found in database');
  process.exit(1);
}

const credential = getCredential(credentialRows[0].id);
const BASE_URL = credential.base_url;
const USERNAME = credential.username;
const PASSWORD = credential.password;

(async () => {
  const browser = await chromium.launch({ 
    headless: false,  // Show browser for debugging
    slowMo: 500       // Slow down actions
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🚀 Navigating to CareSpace...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('📍 Current URL:', page.url());
    
    // === LOGIN ===
    console.log('🔐 Logging in...');
    await page.fill('input[name="username"], input[name="email"], input[type="email"]', USERNAME);
    await page.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.press('input[type="password"]', 'Enter')
    ]);
    
    console.log('✅ Logged in. URL:', page.url());
    await page.waitForTimeout(2000);
    
    // === NAVIGATE TO LABS ===
    console.log('🧪 Navigating to Labs tab...');
    const labsTab = page.locator('a:has-text("Labs")').first();
    if (await labsTab.count() > 0) {
      await labsTab.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    
    console.log('📍 Labs page URL:', page.url());
    
    // === DEBUG: FIND ALL LINKS IN SIDEBAR ===
    console.log('\n🔍 DEBUG: Finding all links in left sidebar...\n');
    
    // Try multiple strategies
    const strategies = [
      {
        name: 'All <a> tags',
        locator: page.locator('a')
      },
      {
        name: 'Sidebar links only',
        locator: page.locator('aside a, nav a, [class*="sidebar"] a, [class*="side"] a')
      },
      {
        name: 'Short text links (2-10 chars)',
        locator: page.locator('a').filter({ hasText: /^[A-Za-z#0-9]{2,10}$/ })
      },
      {
        name: 'Links under HEMATOLOGY section',
        locator: page.locator('text="HEMATOLOGY"').locator('..').locator('a')
      }
    ];
    
    for (const strategy of strategies) {
      const count = await strategy.locator.count();
      console.log(`\n📊 Strategy: ${strategy.name}`);
      console.log(`   Found ${count} links`);
      
      if (count > 0 && count < 100) {
        const links = await strategy.locator.allTextContents();
        console.log('   First 20:', links.slice(0, 20).map(l => l.trim()).join(', '));
      }
    }
    
    // === DEBUG: CHECK CURRENT PAGE STRUCTURE ===
    console.log('\n🏗️  Page structure analysis...\n');
    
    // Get all text containing "WBC" (we know it should be there)
    const wbcElements = await page.locator('text=/WBC/i').all();
    console.log(`Found ${wbcElements.length} elements containing "WBC"`);
    
    for (let i = 0; i < Math.min(wbcElements.length, 5); i++) {
      const el = wbcElements[i];
      const tagName = await el.evaluate(e => e.tagName);
      const text = await el.textContent();
      const isLink = await el.evaluate(e => e.tagName === 'A');
      console.log(`  [${i}] <${tagName}> "${text?.trim()}" ${isLink ? '(LINK)' : ''}`);
    }
    
    // === TRY CLICKING WBC ===
    console.log('\n🖱️  Attempting to click WBC link...\n');
    
    const wbcLink = page.locator('a:has-text("WBC")').first();
    if (await wbcLink.count() > 0) {
      console.log('✅ Found WBC link, clicking...');
      await wbcLink.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(1500);
      
      // === EXTRACT DATA ===
      console.log('\n📊 Extracting data from info box...\n');
      
      const bodyText = await page.textContent('body');
      console.log('Body text sample:', bodyText.substring(0, 500));
      
      // Try to extract the info box specifically
      const infoBoxText = await page.locator('[class*="info"], [class*="result"], [class*="detail"]').first().textContent().catch(() => null);
      if (infoBoxText) {
        console.log('\n📦 Info box text:', infoBoxText);
      }
      
      // Extract date
      const dateMatch = bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      console.log('\n📅 Date extraction:');
      console.log('  Pattern match:', dateMatch ? dateMatch[1] : 'NO MATCH');
      
      // Extract "Your result"
      const resultMatch = bodyText.match(/Your result\s*[\n\r]*\s*([\d.]+)/i);
      console.log('\n🎯 Result extraction:');
      console.log('  Pattern match:', resultMatch ? resultMatch[1] : 'NO MATCH');
      
      // Extract "Normal range"
      const rangeMatch = bodyText.match(/Normal range\s*[\n\r]*\s*([\d.]+)\s*[-–]\s*([\d.]+)\s*([\w\/\^]+)?/i);
      console.log('\n📏 Range extraction:');
      console.log('  Pattern match:', rangeMatch ? `${rangeMatch[1]}-${rangeMatch[2]} ${rangeMatch[3] || ''}` : 'NO MATCH');
      
      console.log('\n✅ Data extraction test complete!');
      
    } else {
      console.log('❌ Could not find WBC link');
    }
    
    console.log('\n⏸️  Browser will stay open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
