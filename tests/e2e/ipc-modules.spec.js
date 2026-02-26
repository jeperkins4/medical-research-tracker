/**
 * IPC Module Smoke Tests
 * Tests electron/*.cjs modules directly (no Electron runtime needed).
 * These catch logic errors in IPC handlers that would cause 404/crash
 * in the packaged app where no HTTP server is running.
 *
 * Run: npx playwright test --project=api-tests tests/e2e/ipc-modules.spec.js
 */

import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Mock db._rawDb() ──────────────────────────────────────────────────────────
// Returns a minimal in-memory SQLite-like interface using better-sqlite3
// so we can test IPC modules without a real database.

function makeMockRunner(rows = {}) {
  // rows: { 'test_results': [...], 'conditions': [...], ... }
  return (sql, params = []) => {
    // Return empty arrays for everything by default — tests that modules
    // handle missing data gracefully without crashing.
    const lower = sql.toLowerCase();
    for (const [table, data] of Object.entries(rows)) {
      if (lower.includes(table.toLowerCase())) return data;
    }
    // COUNT(*) queries should return [{count: 0}]
    if (lower.includes('count(*)')) return [{ count: 0 }];
    return [];
  };
}

// ── organ-health-ipc.cjs ──────────────────────────────────────────────────────

test.describe('organ-health-ipc.cjs [IPC module smoke tests]', () => {
  let mod;

  test.beforeAll(() => {
    mod = require(resolve(__dirname, '../../electron/organ-health-ipc.cjs'));
  });

  test('module exports all four functions', () => {
    expect(typeof mod.getKidneyHealthData).toBe('function');
    expect(typeof mod.getLiverHealthData).toBe('function');
    expect(typeof mod.getLungHealthData).toBe('function');
    expect(typeof mod.getBoneHealthData).toBe('function');
  });

  // ── Kidney ──────────────────────────────────────────────────────────────────

  test.describe('getKidneyHealthData()', () => {
    test('returns enabled:false gracefully with empty db (no crash)', () => {
      const run = makeMockRunner({});
      const result = mod.getKidneyHealthData(run);
      expect(result).toBeDefined();
      expect(typeof result.enabled).toBe('boolean');
      expect(result).not.toHaveProperty('error');
    });

    test('returns correct shape with lab data present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'GFR', result: '75', value_numeric: 75, unit: 'mL/min', flag: null, date: '2025-01-01' },
          { test_name: 'Creatinine', result: '1.0', value_numeric: 1.0, unit: 'mg/dL', flag: null, date: '2025-01-01' },
          { test_name: 'BUN', result: '18', value_numeric: 18, unit: 'mg/dL', flag: null, date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getKidneyHealthData(run);
      expect(result.enabled).toBe(true);
      expect(result).toHaveProperty('latestGFR');
      expect(result).toHaveProperty('latestCreatinine');
      expect(result).toHaveProperty('ckdStage');
      expect(result).toHaveProperty('series');
      expect(result).toHaveProperty('normalRanges');
      expect(Array.isArray(result.triggers)).toBe(true);
    });

    test('flags low GFR correctly', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'GFR', result: '45', value_numeric: 45, unit: 'mL/min', flag: 'L', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getKidneyHealthData(run);
      expect(result.gfrNormal).toBe(false);
      expect(result.triggers.some(t => t.includes('eGFR'))).toBe(true);
    });
  });

  // ── Liver ───────────────────────────────────────────────────────────────────

  test.describe('getLiverHealthData()', () => {
    test('returns enabled:false gracefully with empty db (no crash)', () => {
      const run = makeMockRunner({});
      const result = mod.getLiverHealthData(run);
      expect(result).toBeDefined();
      expect(typeof result.enabled).toBe('boolean');
      expect(result).not.toHaveProperty('error');
    });

    test('returns correct shape with lab data present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'ALT', result: '25', value_numeric: 25, unit: 'U/L', flag: null, date: '2025-01-01' },
          { test_name: 'AST', result: '22', value_numeric: 22, unit: 'U/L', flag: null, date: '2025-01-01' },
          { test_name: 'Albumin', result: '4.0', value_numeric: 4.0, unit: 'g/dL', flag: null, date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getLiverHealthData(run);
      expect(result.enabled).toBe(true);
      expect(result).toHaveProperty('latestALT');
      expect(result).toHaveProperty('latestAST');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('series');
      expect(result).toHaveProperty('normalRanges');
    });

    test('flags elevated ALT correctly', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'ALT', result: '95', value_numeric: 95, unit: 'U/L', flag: 'H', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getLiverHealthData(run);
      expect(result.flags.some(f => f.label.includes('ALT'))).toBe(true);
    });
  });

  // ── Lung ────────────────────────────────────────────────────────────────────

  test.describe('getLungHealthData()', () => {
    test('returns enabled:true even with empty db (always show for cancer patients)', () => {
      const run = makeMockRunner({});
      const result = mod.getLungHealthData(run);
      expect(result).toBeDefined();
      expect(result.enabled).toBe(true); // always enabled
      expect(result).not.toHaveProperty('error');
    });

    test('sets noDirectMarkers:true when no CO2/SpO2 in record', () => {
      const run = makeMockRunner({});
      const result = mod.getLungHealthData(run);
      expect(result.noDirectMarkers).toBe(true);
      expect(typeof result.note).toBe('string');
    });

    test('returns correct shape with lab data', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'CO2', result: '25', value_numeric: 25, unit: 'mEq/L', flag: null, date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getLungHealthData(run);
      expect(result).toHaveProperty('series');
      expect(result).toHaveProperty('normalRanges');
      expect(Array.isArray(result.flags)).toBe(true);
    });
  });

  // ── Bone ────────────────────────────────────────────────────────────────────

  test.describe('getBoneHealthData()', () => {
    test('returns enabled:false gracefully with empty db (no crash)', () => {
      const run = makeMockRunner({});
      const result = mod.getBoneHealthData(run);
      expect(result).toBeDefined();
      expect(typeof result.enabled).toBe('boolean');
      expect(result).not.toHaveProperty('error');
    });

    test('returns correct shape with lab data present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Calcium', result: '9.5', value_numeric: 9.5, unit: 'mg/dL', flag: null, date: '2025-01-01' },
          { test_name: 'Vitamin D', result: '42', value_numeric: 42, unit: 'ng/mL', flag: null, date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.enabled).toBe(true);
      expect(result).toHaveProperty('latestCalcium');
      expect(result).toHaveProperty('latestVitaminD');
      expect(result).toHaveProperty('series');
      expect(result).toHaveProperty('normalRanges');
    });

    test('flags low Vitamin D correctly', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Vitamin D', result: '18', value_numeric: 18, unit: 'ng/mL', flag: 'L', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.flags.some(f => f.label.includes('Vitamin D'))).toBe(true);
    });

    test('flags hypercalcemia correctly', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Calcium', result: '11.2', value_numeric: 11.2, unit: 'mg/dL', flag: 'H', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.flags.some(f => f.label.includes('Calcium Elevated'))).toBe(true);
    });
  });
});

// ── Preload exposure check ────────────────────────────────────────────────────
// Verify preload.cjs exports organHealth bindings (static analysis).

test.describe('preload.cjs [organHealth bindings present]', () => {
  test('preload source exposes window.electron.organHealth.*', () => {
    const fs = require('fs');
    const preload = fs.readFileSync(
      resolve(__dirname, '../../electron/preload.cjs'),
      'utf-8'
    );
    expect(preload).toContain('organHealth');
    expect(preload).toContain('getKidney');
    expect(preload).toContain('getLiver');
    expect(preload).toContain('getLung');
    expect(preload).toContain('getBone');
    expect(preload).toContain('organ-health:kidney');
    expect(preload).toContain('organ-health:liver');
    expect(preload).toContain('organ-health:lung');
    expect(preload).toContain('organ-health:bone');
  });

  test('preload source exposes window.electron.analytics.getDashboard', () => {
    const fs = require('fs');
    const preload = fs.readFileSync(
      resolve(__dirname, '../../electron/preload.cjs'),
      'utf-8'
    );
    expect(preload).toContain('analytics');
    expect(preload).toContain('getDashboard');
    expect(preload).toContain('analytics:dashboard');
  });

  test('preload source exposes window.electron.ai.*', () => {
    const fs = require('fs');
    const preload = fs.readFileSync(
      resolve(__dirname, '../../electron/preload.cjs'),
      'utf-8'
    );
    expect(preload).toContain('generateHealthcareSummary');
    expect(preload).toContain('analyzeMeal');
    expect(preload).toContain('ai:healthcare-summary');
    expect(preload).toContain('ai:analyze-meal');
  });
});

// ── main.cjs IPC handler registration check ──────────────────────────────────
// Verify main.cjs registers all expected IPC channels (static analysis).

test.describe('main.cjs [IPC handler registration]', () => {
  let mainSrc;

  test.beforeAll(() => {
    const fs = require('fs');
    mainSrc = fs.readFileSync(
      resolve(__dirname, '../../electron/main.cjs'),
      'utf-8'
    );
  });

  const requiredChannels = [
    'organ-health:kidney',
    'organ-health:liver',
    'organ-health:lung',
    'organ-health:bone',
    'analytics:dashboard',
    'ai:healthcare-summary',
    'ai:analyze-meal',
  ];

  for (const channel of requiredChannels) {
    test(`registers IPC channel: '${channel}'`, () => {
      expect(mainSrc).toContain(`'${channel}'`);
    });
  }
});
