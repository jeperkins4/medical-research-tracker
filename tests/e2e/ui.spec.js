/**
 * UI Regression Tests
 * Tests the React app in a browser (no Electron IPC).
 * Catches crashes, white screens, and visible error text.
 *
 * Run: npx playwright test --project=chromium
 */

import { test, expect } from '@playwright/test';

const UI_PORT   = process.env.TEST_UI_PORT  || '5174';
const API_PORT  = process.env.TEST_API_PORT || '3999';
const BASE      = `http://localhost:${UI_PORT}`;
const API       = `http://localhost:${API_PORT}`;

// ── Auth helper ───────────────────────────────────────────────────────────────

async function dismissSetupWizard(page) {
  // Handle first-run setup wizard
  const skipBtn = page.locator('button:has-text("SKIP SETUP"), button:has-text("Skip Setup"), button:has-text("Skip")').first();
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(1000);
  }
}

async function tryLogin(page) {
  try {
    await page.goto(BASE, { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Dismiss setup wizard if present
    await dismissSetupWizard(page);

    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await page.locator('input[name="username"], input[type="text"]').first().fill('testuser');
      await passwordInput.fill('testpass123');
      await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first().click();
      await page.waitForTimeout(2000);
    }
  } catch {
    // continue — tests will still run against whatever state the app is in
  }
}

// ── Page load ─────────────────────────────────────────────────────────────────

test.describe('App loads', () => {
  test('homepage renders without crash', async ({ page }) => {
    await page.goto(BASE, { timeout: 15000 });

    // Basic: page has a body with content
    const body = await page.locator('body').innerHTML();
    expect(body.length).toBeGreaterThan(50);

    // No uncaught error overlay
    await expect(page.locator('text=/Uncaught TypeError/i')).not.toBeVisible();
  });

  test('shows login form, setup wizard, or app nav', async ({ page }) => {
    await page.goto(BASE, { timeout: 15000 });
    await page.waitForTimeout(2500);

    const loginVisible  = await page.locator('input[type="password"]').isVisible().catch(() => false);
    const navVisible    = await page.locator('button:has-text("Overview"), nav button').first().isVisible().catch(() => false);
    const wizardVisible = await page.locator('text=/Welcome to MyTreatmentPath|Setup|SKIP SETUP/i').first().isVisible().catch(() => false);

    expect(loginVisible || navVisible || wizardVisible).toBeTruthy();
  });
});

// ── Navigation — no white screens ────────────────────────────────────────────

test.describe('Tab navigation [REGRESSION: white screens]', () => {
  test.beforeEach(async ({ page }) => {
    await tryLogin(page);
  });

  const tabs = [
    { name: 'Overview',      matcher: /Overview|Patient|Profile/i },
    { name: 'Genomics',      matcher: /Genomics|Precision Medicine|Upload Foundation|No genomic/i },
    { name: 'Treatment',     matcher: /Treatment|Medication|Supplement/i },
    { name: 'Research',      matcher: /Research|Papers/i },
    { name: 'Strategy',      matcher: /Strategy|Summary|Healthcare/i },
    { name: 'Portals',       matcher: /Portals|Vault|Healthcare Portal/i },
    { name: 'Analytics',     matcher: /Analytics|Dashboard/i },
  ];

  for (const { name, matcher } of tabs) {
    test(`${name} tab: visible content, no crash [REGRESSION]`, async ({ page }) => {
      const btn = page.locator(`nav button:has-text("${name}"), button:has-text("${name}")`).first();
      if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, `${name} tab not found`);
        return;
      }

      await btn.click();
      await page.waitForTimeout(2000);

      // White screen check: body must have visible content beyond nav
      const content = await page.locator('main, #root > div > div').last().innerHTML();
      expect(content.length).toBeGreaterThan(50);

      // No SQL error text in the page
      await expect(page.locator('text=/no such column/i')).not.toBeVisible({ timeout: 1000 });
      await expect(page.locator('text=/SQLITE_ERROR/i')).not.toBeVisible({ timeout: 1000 });

      // Expected content appears somewhere
      const hasExpected = await page.locator(`text=${matcher.source.replace(/[/]/g, '').split('|')[0]}`).isVisible().catch(() => false);
      // Just log — don't fail since tab may need API to show content
      if (!hasExpected) {
        console.log(`  ℹ️  ${name}: expected content not visible (API may be required)`);
      }
    });
  }
});

// ── Portals — key regression ──────────────────────────────────────────────────

test.describe('Portals tab [REGRESSION: no such column: last_sync]', () => {
  test.beforeEach(async ({ page }) => {
    await tryLogin(page);
  });

  test('"no such column" NEVER appears on portal tab', async ({ page }) => {
    const btn = page.locator('button:has-text("Portals")').first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Portals tab not visible');
    }

    await btn.click();
    await page.waitForTimeout(3000); // Give time for async API call

    // This is the regression. Must never appear.
    await expect(page.locator('text=/no such column/i')).not.toBeVisible();
    await expect(page.locator('text=/SQLITE_ERROR/i')).not.toBeVisible();
  });
});

// ── Genomics — white screen + Foundation One upload ──────────────────────────

test.describe('Genomics tab [REGRESSION: white screen crash]', () => {
  test.beforeEach(async ({ page }) => {
    await tryLogin(page);
  });

  test('renders something (not a white/blank screen)', async ({ page }) => {
    const btn = page.locator('button:has-text("Genomics")').first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Genomics tab not visible');
    }

    await btn.click();
    await page.waitForTimeout(3000);

    // Must have visible content
    const html = await page.locator('main, #root').first().innerHTML();
    expect(html.length).toBeGreaterThan(200);

    // No crash errors in the DOM
    await expect(page.locator('text=/Uncaught|TypeError|Cannot read properties of undefined/i')).not.toBeVisible();
  });

  test('Foundation One uploader is accessible', async ({ page }) => {
    const btn = page.locator('button:has-text("Genomics")').first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Genomics tab not visible');
    }

    await btn.click();
    await page.waitForTimeout(3000);

    // Either "Upload Foundation One" or "Upload New Report" should be somewhere
    const uploadVisible = await page.locator(
      'text=/Upload Foundation One|Choose PDF|Upload New Report/i'
    ).first().isVisible().catch(() => false);

    expect(uploadVisible).toBeTruthy();
  });
});

// ── Subscriptions tab ─────────────────────────────────────────────────────────

test.describe('Subscriptions tab', () => {
  test.beforeEach(async ({ page }) => {
    await tryLogin(page);
  });

  test('renders without crash', async ({ page }) => {
    const btn = page.locator('button:has-text("Subscriptions")').first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Subscriptions tab not in this build');
    }

    await btn.click();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=/no such column/i')).not.toBeVisible();
    const html = await page.locator('main, #root').first().innerHTML();
    expect(html.length).toBeGreaterThan(100);
  });

  test('Add Subscription modal opens', async ({ page }) => {
    const btn = page.locator('button:has-text("Subscriptions")').first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Subscriptions tab not in this build');
    }

    await btn.click();
    await page.waitForTimeout(2000);

    const addBtn = page.locator('button:has-text("+ Add Subscription"), button:has-text("Add Subscription")').first();
    if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Add Subscription button not visible (may need auth)');
    }

    await addBtn.click();
    await expect(page.locator('text=/Service Name/i').first()).toBeVisible({ timeout: 3000 });

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('text=/Service Name/i').first()).not.toBeVisible({ timeout: 2000 });
  });
});

// ── No SQL errors anywhere in the app ────────────────────────────────────────

test('zero SQL errors after navigating all tabs', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().toLowerCase().includes('sql')) {
      errors.push(msg.text());
    }
  });

  await tryLogin(page);

  const tabNames = ['Overview', 'Genomics', 'Portals', 'Analytics', 'Subscriptions'];
  for (const name of tabNames) {
    const btn = page.locator(`button:has-text("${name}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
  }

  // No SQL-related console errors
  expect(errors).toHaveLength(0);
});
