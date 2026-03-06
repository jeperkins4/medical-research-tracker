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

    test('flags elevated Alk Phos correctly', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Alk Phos', result: '180', value_numeric: 180, unit: 'U/L', flag: 'H', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.flags.some(f => f.label.includes('Alk Phos Elevated'))).toBe(true);
      expect(result.flags.some(f => f.severity === 'medium')).toBe(true);
    });

    test('does NOT flag normal Alk Phos', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Alk Phos', result: '90', value_numeric: 90, unit: 'U/L', flag: null, date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.flags.filter(f => f.label.includes('Alk Phos'))).toHaveLength(0);
    });

    test('flags Vitamin D deficient (<20) with high severity', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Vitamin D', result: '12', value_numeric: 12, unit: 'ng/mL', flag: 'L', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      const highFlags = result.flags.filter(f => f.severity === 'high' && f.label.includes('Vitamin D'));
      expect(highFlags.length).toBeGreaterThan(0);
    });

    test('flags low calcium (<8.5) correctly', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Calcium', result: '8.0', value_numeric: 8.0, unit: 'mg/dL', flag: 'L', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.flags.some(f => f.label.includes('Calcium Low'))).toBe(true);
    });

    test('flags bone metastases when documented in conditions', () => {
      // The mock runner returns conditions with count > 0 for the bone mets query
      const run = (sql, params) => {
        if (sql.includes('test_results')) return [];
        if (sql.includes('conditions')) return [{ count: 1 }];
        return [];
      };
      const result = mod.getBoneHealthData(run);
      expect(result.flags.some(f => f.label.includes('Bone metastases'))).toBe(true);
      expect(result.flags.some(f => f.severity === 'high')).toBe(true);
    });

    test('returns series with pth data when PTH lab is present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'PTH', result: '65', value_numeric: 65, unit: 'pg/mL', flag: null, date: '2025-01-15' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.series).toHaveProperty('pth');
      expect(Array.isArray(result.series.pth)).toBe(true);
      expect(result.series.pth.length).toBeGreaterThan(0);
    });

    test('returns trends object with calcium and vitaminD keys', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Calcium', result: '9.0', value_numeric: 9.0, unit: 'mg/dL', flag: null, date: '2025-01-01' },
          { test_name: 'Calcium', result: '9.2', value_numeric: 9.2, unit: 'mg/dL', flag: null, date: '2025-02-01' },
          { test_name: 'Vitamin D', result: '35', value_numeric: 35, unit: 'ng/mL', flag: null, date: '2025-01-01' },
          { test_name: 'Vitamin D', result: '42', value_numeric: 42, unit: 'ng/mL', flag: null, date: '2025-02-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.trends).toHaveProperty('calcium');
      expect(result.trends).toHaveProperty('vitaminD');
      // Two data points → trend should compute direction
      expect(result.trends.calcium).not.toBeNull();
      expect(result.trends.vitaminD.direction).toBe('up');
    });

    test('returns normalRanges with all expected keys', () => {
      const run = makeMockRunner({});
      const result = mod.getBoneHealthData(run);
      expect(result).toHaveProperty('normalRanges');
      expect(result.normalRanges).toHaveProperty('calcium');
      expect(result.normalRanges).toHaveProperty('phosphorus');
      expect(result.normalRanges).toHaveProperty('alkPhos');
      expect(result.normalRanges).toHaveProperty('vitaminD');
    });

    test('returns enabled:true when only Alk Phos data present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Alk Phos', result: '88', value_numeric: 88, unit: 'U/L', flag: null, date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.enabled).toBe(true);
    });

    test('allNormal is true when data present and no flags', () => {
      // makeMockRunner returns ALL test_results for any pattern query (doesn't filter by
      // test_name), so we use a pattern-aware runner to avoid cross-contamination where
      // the calcium value (9.5) would be interpreted as a low Vitamin D (< 30 → flag).
      const labData = [
        { test_name: 'Calcium',   result: '9.5', value_numeric: 9.5, unit: 'mg/dL', flag: null, date: '2025-01-01' },
        { test_name: 'Vitamin D', result: '50',  value_numeric: 50,  unit: 'ng/mL', flag: null, date: '2025-02-01' },
        { test_name: 'Alk Phos',  result: '88',  value_numeric: 88,  unit: 'U/L',   flag: null, date: '2025-02-01' },
      ];
      const run = (sql, params = []) => {
        const lower = sql.toLowerCase();
        if (lower.includes('count(*)')) return [{ count: 0 }];
        if (lower.includes('test_results') && params.length > 0) {
          // Filter by the LIKE pattern supplied as the first param
          const pat = String(params[0]).replace(/%/g, '.*').replace(/_/g, '.');
          const re = new RegExp(`^${pat}$`, 'i');
          return labData.filter(r => re.test(r.test_name));
        }
        return [];
      };
      const result = mod.getBoneHealthData(run);
      expect(result.allNormal).toBe(true);
      expect(result.flags).toHaveLength(0);
    });

    test('allNormal is false when flags present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Vitamin D', result: '15', value_numeric: 15, unit: 'ng/mL', flag: 'L', date: '2025-01-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const result = mod.getBoneHealthData(run);
      expect(result.allNormal).toBe(false);
    });

    test('does not throw on completely empty DB (no tables)', () => {
      const run = () => { throw new Error('no such table: test_results'); };
      expect(() => mod.getBoneHealthData(run)).not.toThrow();
      const result = mod.getBoneHealthData(run);
      expect(result).toHaveProperty('enabled');
    });

    // ── panelData / softTissueData shape (IPC ↔ server parity) ────────────

    test('returns panelData with calcium, phosphorus, vitaminD, ldh keys', () => {
      const run = makeMockRunner({});
      const result = mod.getBoneHealthData(run);
      expect(result).toHaveProperty('panelData');
      expect(result.panelData).toHaveProperty('calcium');
      expect(result.panelData).toHaveProperty('phosphorus');
      expect(result.panelData).toHaveProperty('vitaminD');
      expect(result.panelData).toHaveProperty('ldh');
    });

    test('panelData entries have series, trend, latest, normal, unit, label', () => {
      const run = makeMockRunner({});
      const { panelData } = mod.getBoneHealthData(run);
      for (const key of ['calcium', 'vitaminD', 'ldh']) {
        expect(Array.isArray(panelData[key].series)).toBe(true);
        expect(panelData[key]).toHaveProperty('trend');
        expect(panelData[key]).toHaveProperty('latest');
        expect(panelData[key]).toHaveProperty('normal');
        expect(panelData[key]).toHaveProperty('unit');
        expect(panelData[key]).toHaveProperty('label');
      }
    });

    test('returns softTissueData with albumin, crp, ferritin, uricAcid keys', () => {
      const run = makeMockRunner({});
      const result = mod.getBoneHealthData(run);
      expect(result).toHaveProperty('softTissueData');
      expect(result.softTissueData).toHaveProperty('albumin');
      expect(result.softTissueData).toHaveProperty('crp');
      expect(result.softTissueData).toHaveProperty('ferritin');
      expect(result.softTissueData).toHaveProperty('uricAcid');
    });

    test('panelData.ldh.latest populated when LDH lab present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'LDH', result: '310', value_numeric: 310, unit: 'U/L', flag: 'H', date: '2025-03-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const { panelData, flags } = mod.getBoneHealthData(run);
      expect(panelData.ldh.latest).toBe(310);
      expect(flags.some(f => f.label.includes('LDH Elevated'))).toBe(true);
    });

    test('softTissueData.albumin.latest populated and flags when low', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Albumin', result: '3.1', value_numeric: 3.1, unit: 'g/dL', flag: 'L', date: '2025-03-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const { softTissueData, flags } = mod.getBoneHealthData(run);
      expect(softTissueData.albumin.latest).toBe(3.1);
      expect(flags.some(f => f.label.includes('Albumin Low'))).toBe(true);
    });

    test('panelData shape survives empty DB (no throws, all keys present)', () => {
      const run = () => { throw new Error('no such table: test_results'); };
      const result = mod.getBoneHealthData(run);
      // Should not throw — returns enabled:false on outer catch
      expect(result).toHaveProperty('enabled', false);
    });

    // ── Cancer Spread Signals — flag threshold precision ──────────────────
    // Note: makeMockRunner returns ALL rows for any test_results query (no LIKE
    // filtering). For single-lab tests this works fine. For multi-lab tests we
    // use a LIKE-aware runner (makeLikeRunner) defined below.

    // Helper: simulates SQLite LIKE filtering so multi-lab tests work correctly.
    function makeLikeRunner(allRows, conditionCount = 0) {
      return (sql, params = []) => {
        const lower = sql.toLowerCase();
        if (lower.includes('test_results')) {
          const pattern = params[0];
          if (!pattern) return allRows;
          const regex = new RegExp(
            '^' + String(pattern).replace(/%/g, '.*').replace(/_/g, '.') + '$',
            'i'
          );
          return allRows.filter(r => regex.test(r.test_name));
        }
        if (lower.includes('count(*)')) return [{ count: conditionCount }];
        return [];
      };
    }

    test('softTissueData.crp.latest populated and flags when elevated > 10 mg/L', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'CRP', result: '18.5', value_numeric: 18.5, unit: 'mg/L', flag: 'H', date: '2025-03-10' },
        ],
        conditions: [{ count: 0 }],
      });
      const { softTissueData, flags } = mod.getBoneHealthData(run);
      expect(softTissueData.crp.latest).toBe(18.5);
      expect(flags.some(f => f.label.includes('CRP Elevated'))).toBe(true);
      expect(flags.find(f => f.label.includes('CRP'))?.severity).toBe('medium');
    });

    test('softTissueData.crp is NOT flagged when CRP is within normal range', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'CRP', result: '0.8', value_numeric: 0.8, unit: 'mg/L', flag: null, date: '2025-03-10' },
        ],
        conditions: [{ count: 0 }],
      });
      const { flags } = mod.getBoneHealthData(run);
      expect(flags.some(f => f.label.includes('CRP'))).toBe(false);
    });

    test('LDH flag severity is "high" when LDH > 400 U/L', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'LDH', result: '520', value_numeric: 520, unit: 'U/L', flag: 'H', date: '2025-03-10' },
        ],
        conditions: [{ count: 0 }],
      });
      const { flags } = mod.getBoneHealthData(run);
      const ldhFlag = flags.find(f => f.label.includes('LDH Elevated'));
      expect(ldhFlag).toBeTruthy();
      expect(ldhFlag.severity).toBe('high');
    });

    test('LDH flag severity is "medium" when LDH is 247–400 U/L', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'LDH', result: '300', value_numeric: 300, unit: 'U/L', flag: 'H', date: '2025-03-10' },
        ],
        conditions: [{ count: 0 }],
      });
      const { flags } = mod.getBoneHealthData(run);
      const ldhFlag = flags.find(f => f.label.includes('LDH Elevated'));
      expect(ldhFlag).toBeTruthy();
      expect(ldhFlag.severity).toBe('medium');
    });

    test('softTissueData.ferritin.latest populated when ferritin lab present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Ferritin', result: '450', value_numeric: 450, unit: 'ng/mL', flag: 'H', date: '2025-03-05' },
        ],
        conditions: [{ count: 0 }],
      });
      const { softTissueData } = mod.getBoneHealthData(run);
      expect(softTissueData.ferritin.latest).toBe(450);
    });

    test('softTissueData.uricAcid.latest populated when uric acid lab present', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Uric Acid', result: '8.2', value_numeric: 8.2, unit: 'mg/dL', flag: 'H', date: '2025-03-05' },
        ],
        conditions: [{ count: 0 }],
      });
      const { softTissueData } = mod.getBoneHealthData(run);
      expect(softTissueData.uricAcid.latest).toBe(8.2);
    });

    test('multiple Cancer Spread Signals all flagged simultaneously (makeLikeRunner)', () => {
      const allLabs = [
        { test_name: 'LDH',       result: '310', value_numeric: 310,  unit: 'U/L',   flag: 'H', date: '2025-03-01' },
        { test_name: 'CRP',       result: '22',  value_numeric: 22,   unit: 'mg/L',  flag: 'H', date: '2025-03-01' },
        { test_name: 'Albumin',   result: '3.0', value_numeric: 3.0,  unit: 'g/dL',  flag: 'L', date: '2025-03-01' },
        { test_name: 'Calcium',   result: '11.2',value_numeric: 11.2, unit: 'mg/dL', flag: 'H', date: '2025-03-01' },
      ];
      const run = makeLikeRunner(allLabs, 0);
      const { flags } = mod.getBoneHealthData(run);
      expect(flags.some(f => f.label.includes('LDH'))).toBe(true);
      expect(flags.some(f => f.label.includes('CRP'))).toBe(true);
      expect(flags.some(f => f.label.includes('Albumin'))).toBe(true);
      expect(flags.some(f => f.label.includes('Calcium Elevated'))).toBe(true);
      expect(flags.length).toBeGreaterThanOrEqual(4);
    });

    // ── Cancer Spread Signals — trend direction (pure) ────────────────────
    // trend() in organ-health-ipc.cjs returns { change, direction } not a string.
    // These tests verify the direction property used by BoneHealthTracker chart rendering.

    test('panelData series is chronologically ordered (oldest → newest)', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'LDH', result: '200', value_numeric: 200, unit: 'U/L', flag: null, date: '2025-01-01' },
          { test_name: 'LDH', result: '250', value_numeric: 250, unit: 'U/L', flag: null, date: '2025-02-01' },
          { test_name: 'LDH', result: '310', value_numeric: 310, unit: 'U/L', flag: 'H',  date: '2025-03-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const { panelData } = mod.getBoneHealthData(run);
      const ldhSeries = panelData.ldh.series;
      expect(ldhSeries.length).toBe(3);
      for (let i = 1; i < ldhSeries.length; i++) {
        expect(ldhSeries[i].date >= ldhSeries[i - 1].date).toBe(true);
      }
    });

    test('panelData.ldh.trend.direction is "up" when LDH has 3 consecutive increases', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'LDH', result: '200', value_numeric: 200, unit: 'U/L', flag: null, date: '2025-01-01' },
          { test_name: 'LDH', result: '250', value_numeric: 250, unit: 'U/L', flag: null, date: '2025-02-01' },
          { test_name: 'LDH', result: '310', value_numeric: 310, unit: 'U/L', flag: 'H',  date: '2025-03-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const { panelData } = mod.getBoneHealthData(run);
      // trend() returns { change: number, direction: 'up' | 'down' }
      expect(panelData.ldh.trend).not.toBeNull();
      expect(panelData.ldh.trend.direction).toBe('up');
      expect(panelData.ldh.trend.change).toBeGreaterThan(0);
    });

    test('softTissueData.albumin.trend.direction is "down" when albumin consistently drops', () => {
      const run = makeMockRunner({
        test_results: [
          { test_name: 'Albumin', result: '4.2', value_numeric: 4.2, unit: 'g/dL', flag: null, date: '2025-01-01' },
          { test_name: 'Albumin', result: '3.8', value_numeric: 3.8, unit: 'g/dL', flag: null, date: '2025-02-01' },
          { test_name: 'Albumin', result: '3.1', value_numeric: 3.1, unit: 'g/dL', flag: 'L',  date: '2025-03-01' },
        ],
        conditions: [{ count: 0 }],
      });
      const { softTissueData } = mod.getBoneHealthData(run);
      expect(softTissueData.albumin.trend).not.toBeNull();
      expect(softTissueData.albumin.trend.direction).toBe('down');
    });

    test('flags array is empty and allNormal is true when all labs are in range (makeLikeRunner)', () => {
      const allLabs = [
        { test_name: 'Calcium',    result: '9.2', value_numeric: 9.2, unit: 'mg/dL', flag: null, date: '2025-03-01' },
        { test_name: 'Lactate Dehydrogenase', result: '180', value_numeric: 180, unit: 'U/L', flag: null, date: '2025-03-01' },
        { test_name: 'Albumin',    result: '4.1', value_numeric: 4.1, unit: 'g/dL',  flag: null, date: '2025-03-01' },
        { test_name: 'Vitamin D',  result: '52',  value_numeric: 52,  unit: 'ng/mL', flag: null, date: '2025-03-01' },
      ];
      const run = makeLikeRunner(allLabs, 0);
      const { flags, allNormal, enabled } = mod.getBoneHealthData(run);
      expect(flags.length).toBe(0);
      expect(allNormal).toBe(true);
      expect(enabled).toBe(true);
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
