/**
 * IPC Coverage Static Analysis Tests
 *
 * Scans ALL src/components/*.jsx files and asserts that every
 * apiFetch('/api/...') or fetch('/api/...') call either:
 *   (a) has a window.electron guard within GUARD_WINDOW lines above it, OR
 *   (b) is in an explicitly allowlisted file (server-only / Supabase-only)
 *
 * This test catches the core production bug pattern: components calling
 * HTTP endpoints that don't exist in the packaged Electron app (which must
 * use IPC instead).
 *
 * Run: npx playwright test --project=ipc-modules tests/e2e/ipc-coverage.spec.js
 */

import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const fs        = require('fs');
const path      = require('path');

const ROOT       = resolve(__dirname, '../..');
const COMPONENTS = path.join(ROOT, 'src/components');

// ── Tuning ────────────────────────────────────────────────────────────────────

/** Lines to search above a fetch call for a window.electron / isElectron guard */
const GUARD_WINDOW = 30;

/**
 * Files that are intentionally server-only or Supabase-backed and will never
 * run inside the packaged Electron app unguarded.  Each entry should be
 * justified in the comment.
 */
const ALLOWLISTED_FILES = new Set([
  // Cloud sync is disabled in the packaged app (Supabase-only path)
  'CloudSync.jsx',
  // Supabase variant of analytics — not used in packaged app
  'AnalyticsDashboardSupabase.jsx',
  // PHI transfer is a deliberate localhost:3000 dev-only workflow
  'PHITransfer.jsx',
]);

// ── Patterns that indicate a fetch is hitting an HTTP API endpoint ─────────────

const API_CALL_PATTERN   = /(?:apiFetch|fetch)\s*\(\s*[`'"](?:https?:\/\/[^'"]+)?\/api\//;
const ELECTRON_GUARD_RE  = /window\.electron|isElectron/;

// ── Helper ────────────────────────────────────────────────────────────────────

function scanFile(filePath) {
  const src   = fs.readFileSync(filePath, 'utf-8');
  const lines = src.split('\n');
  const violations = [];

  lines.forEach((line, idx) => {
    if (!API_CALL_PATTERN.test(line)) return;

    // Search the GUARD_WINDOW lines above for a window.electron / isElectron check
    const start   = Math.max(0, idx - GUARD_WINDOW);
    const context = lines.slice(start, idx + 1).join('\n');

    if (!ELECTRON_GUARD_RE.test(context)) {
      violations.push({
        lineNumber: idx + 1,
        line: line.trim(),
      });
    }
  });

  return violations;
}

// ── Collect all JSX component files ──────────────────────────────────────────

function getComponentFiles() {
  return fs
    .readdirSync(COMPONENTS)
    .filter(f => f.endsWith('.jsx'))
    .map(f => ({ name: f, full: path.join(COMPONENTS, f) }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('IPC Coverage — static analysis of /api/ calls in components', () => {
  const files = getComponentFiles();

  // ── Sanity: components directory must exist and have files ────────────────

  test('src/components/ directory has JSX files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // ── Per-file tests ────────────────────────────────────────────────────────

  for (const { name, full } of files) {
    if (ALLOWLISTED_FILES.has(name)) {
      test(`[allowlisted] ${name} — skipped (server-only/Supabase path)`, () => {
        // Document allowlisted files so they stay intentional
        expect(ALLOWLISTED_FILES.has(name)).toBe(true);
      });
      continue;
    }

    test(`${name} — all /api/ calls have window.electron guard`, () => {
      const violations = scanFile(full);
      const detail = violations
        .map(v => `  Line ${v.lineNumber}: ${v.line}`)
        .join('\n');

      expect(violations, `Unguarded /api/ calls in ${name}:\n${detail}`).toHaveLength(0);
    });
  }

  // ── Regression: known-fixed bugs must remain guarded ─────────────────────

  test.describe('Regression — known-fixed IPC bugs must remain guarded', () => {
    const REGRESSIONS = [
      { file: 'KidneyHealthTracker.jsx',  endpoint: '/api/kidney-health',          ipc: 'window.electron.organHealth.getKidney' },
      { file: 'LiverHealthTracker.jsx',   endpoint: '/api/liver-health',           ipc: 'window.electron.organHealth.getLiver' },
      { file: 'LungHealthTracker.jsx',    endpoint: '/api/lung-health',            ipc: 'window.electron.organHealth.getLung'  },
      { file: 'BoneHealthTracker.jsx',    endpoint: '/api/bone-health',            ipc: 'window.electron.organHealth.getBone'  },
      { file: 'AnalyticsDashboard.jsx',   endpoint: '/api/analytics/dashboard',    ipc: 'window.electron.analytics.getDashboard' },
      { file: 'HealthcareSummary.jsx',    endpoint: '/api/ai/healthcare-summary',  ipc: 'window.electron.ai.generateHealthcareSummary' },
      { file: 'NutritionTracker.jsx',     endpoint: '/api/nutrition/analyze-meal', ipc: 'window.electron.ai.analyzeMeal' },
    ];

    for (const { file, endpoint, ipc } of REGRESSIONS) {
      test(`${file}: ${endpoint} has IPC guard (${ipc})`, () => {
        const src = fs.readFileSync(path.join(COMPONENTS, file), 'utf-8');

        // The IPC handler must be referenced
        expect(src, `${file} must reference ${ipc}`).toContain(ipc);

        // The HTTP fallback line, if present, must be preceded by a guard
        const lines = src.split('\n');
        const apiLineIdx = lines.findIndex(l => l.includes(endpoint));
        if (apiLineIdx === -1) return; // endpoint removed entirely — that's fine too

        const start   = Math.max(0, apiLineIdx - GUARD_WINDOW);
        const context = lines.slice(start, apiLineIdx + 1).join('\n');
        expect(
          ELECTRON_GUARD_RE.test(context),
          `${file} line ${apiLineIdx + 1} (${endpoint}) must have window.electron guard within ${GUARD_WINDOW} lines above`
        ).toBe(true);
      });
    }
  });

  // ── Summary test: count total violations across all non-allowlisted files ──

  test('Zero total unguarded /api/ calls across all non-allowlisted components', () => {
    const allViolations = [];

    for (const { name, full } of files) {
      if (ALLOWLISTED_FILES.has(name)) continue;
      const violations = scanFile(full);
      for (const v of violations) {
        allViolations.push(`${name}:${v.lineNumber} → ${v.line}`);
      }
    }

    expect(
      allViolations,
      `Unguarded /api/ calls found:\n${allViolations.map(v => '  ' + v).join('\n')}`
    ).toHaveLength(0);
  });
});
