/**
 * MyTreatmentPath E2E Tests
 * Run: npx playwright test
 *
 * Tests the web dev server (localhost:5173 + Express API).
 * Guards against the regressions that keep coming back.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const LOGIN = { username: 'jeperkins4', password: 'health2024' };

// ── Auth helper ───────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="text"], input[name="username"], input[placeholder*="username" i]', { timeout: 10000 });

  // Fill username (try multiple selectors)
  const usernameField = page.locator('input[name="username"], input[type="text"]').first();
  await usernameField.fill(LOGIN.username);

  const passwordField = page.locator('input[type="password"]').first();
  await passwordField.fill(LOGIN.password);

  await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first().click();

  // Wait for dashboard to load
  await page.waitForSelector('nav button, .tab-button, button:has-text("Overview")', { timeout: 15000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('shows login form on first load', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
  });

  test('logs in with valid credentials', async ({ page }) => {
    await login(page);
    // Should show the app, not the login form
    await expect(page.locator('input[type="password"]')).not.toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[name="username"], input[type="text"]').first().fill('wrong');
    await page.locator('input[type="password"]').first().fill('wrong');
    await page.locator('button[type="submit"], button:has-text("Login")').first().click();
    // Should stay on login or show error — NOT navigate to dashboard
    await page.waitForTimeout(2000);
    const hasPassword = await page.locator('input[type="password"]').isVisible();
    expect(hasPassword).toBeTruthy();
  });
});

test.describe('Navigation — no crashes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Overview tab loads', async ({ page }) => {
    await page.locator('button:has-text("Overview"), nav button').first().click();
    await page.waitForTimeout(1000);
    // Should not have a JS error toast/modal
    await expect(page.locator('text=/Uncaught|TypeError|is not a function/i')).not.toBeVisible();
    // Should show SOME content
    const content = await page.locator('main, .main-content, #root > div > div').first().textContent();
    expect(content?.length).toBeGreaterThan(0);
  });

  test('Genomics tab loads without white screen [REGRESSION]', async ({ page }) => {
    const genomicsBtn = page.locator('button:has-text("Genomics"), nav button:has-text("Genomics")');
    await genomicsBtn.first().click();
    await page.waitForTimeout(2000);

    // Check for white screen: main container should have visible content
    const mainContent = await page.locator('main, #root').first().innerHTML();
    expect(mainContent.trim().length).toBeGreaterThan(100);

    // Should NOT show a blank page or uncaught error
    await expect(page.locator('text=/Uncaught|TypeError|Cannot read properties of undefined/i')).not.toBeVisible();

    // Should show either mutations or the Foundation One uploader (not nothing)
    const hasContent = await page.locator(
      'text=/Precision Medicine|Genomics Dashboard|Upload Foundation One|No genomic data/i'
    ).first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('Portals tab loads WITHOUT "no such column" error [REGRESSION]', async ({ page }) => {
    const portalsBtn = page.locator('button:has-text("Portals"), nav button:has-text("Portals")');
    await portalsBtn.first().click();
    await page.waitForTimeout(2000);

    // THE key regression: this error banner must NOT appear
    await expect(page.locator('text=/no such column/i')).not.toBeVisible({ timeout: 5000 });

    // Should show vault UI or portal list (not a crash)
    const hasUI = await page.locator(
      'text=/Healthcare Portals|Unlock|Master Password|Add Portal|No portals/i'
    ).first().isVisible();
    expect(hasUI).toBeTruthy();
  });

  test('Subscriptions tab loads', async ({ page }) => {
    const subBtn = page.locator('button:has-text("Subscriptions"), nav button:has-text("Subscriptions")');
    if (!(await subBtn.first().isVisible())) {
      test.skip(true, 'Subscriptions tab not present in this build');
    }
    await subBtn.first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=/Subscriptions|Monthly Cost|no subscriptions/i').first()).toBeVisible();
    await expect(page.locator('text=/no such column|TypeError/i')).not.toBeVisible();
  });

  test('Research tab loads', async ({ page }) => {
    const resBtn = page.locator('button:has-text("Research"), nav button:has-text("Research")');
    await resBtn.first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=/Uncaught|TypeError/i')).not.toBeVisible();
  });

  test('Analytics tab loads', async ({ page }) => {
    const analyticsBtn = page.locator('button:has-text("Analytics")');
    await analyticsBtn.first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=/Uncaught|TypeError/i')).not.toBeVisible();
  });
});

test.describe('Portals — detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('button:has-text("Portals"), nav button:has-text("Portals")').first().click();
    await page.waitForTimeout(1500);
  });

  test('no SQL error on portal load', async ({ page }) => {
    await expect(page.locator('text=/no such column/i')).not.toBeVisible();
  });

  test('can open Add Portal form', async ({ page }) => {
    // If vault is unlocked, "Add Portal" button should be available
    const addPortalBtn = page.locator('button:has-text("Add Portal"), button:has-text("+ Add Portal")');
    if (await addPortalBtn.isVisible()) {
      await addPortalBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=/Service Name|Portal Name|Add New/i').first()).toBeVisible();
    }
  });
});

test.describe('Genomics — Foundation One upload UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('button:has-text("Genomics"), nav button:has-text("Genomics")').first().click();
    await page.waitForTimeout(2000);
  });

  test('shows upload button or uploader when no mutations', async ({ page }) => {
    const hasUploader = await page.locator(
      'text=/Upload Foundation One|Choose PDF|Upload New Report/i'
    ).first().isVisible();
    // Either the uploader is shown (no mutations) or the "Upload New Report" button is visible (has mutations)
    expect(hasUploader).toBeTruthy();
  });

  test('upload button opens picker', async ({ page }) => {
    const uploadBtn = page.locator('button:has-text("Upload New Report"), button:has-text("Choose PDF Report")').first();
    if (await uploadBtn.isVisible()) {
      // In web mode, clicking triggers file input — just verify it's interactive
      await expect(uploadBtn).toBeEnabled();
    }
  });
});

test.describe('Subscriptions — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const subBtn = page.locator('button:has-text("Subscriptions")').first();
    if (!(await subBtn.isVisible())) return;
    await subBtn.click();
    await page.waitForTimeout(1500);
  });

  test('can open Add Subscription modal', async ({ page }) => {
    const addBtn = page.locator('button:has-text("+ Add Subscription"), button:has-text("Add Subscription")').first();
    if (!(await addBtn.isVisible())) return;
    await addBtn.click();
    await page.waitForSelector('text=/Service Name/i', { timeout: 5000 });
    await expect(page.locator('text=/Service Name/i').first()).toBeVisible();
    // Close
    await page.keyboard.press('Escape');
  });

  test('add subscription form validates required fields', async ({ page }) => {
    const addBtn = page.locator('button:has-text("+ Add Subscription"), button:has-text("Add Subscription")').first();
    if (!(await addBtn.isVisible())) return;
    await addBtn.click();
    await page.waitForSelector('text=/Service Name/i', { timeout: 5000 });
    // Try to submit empty form
    await page.locator('button:has-text("Add Subscription"):not(:has-text("+"))').last().click();
    // Should show a validation error or stay on the form
    const stillOpen = await page.locator('text=/Service Name/i').first().isVisible();
    expect(stillOpen).toBeTruthy();
  });
});

test.describe('API health', () => {
  test('GET /api/portals/credentials returns 200 or 401 (not 500)', async ({ request }) => {
    const res = await request.get(`${BASE.replace('5173', '3001')}/api/portals/credentials`);
    // 200 (logged in) or 401 (not logged in) — NOT 500 (SQL crash)
    expect([200, 401, 403]).toContain(res.status());
  });
});
