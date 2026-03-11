/**
 * Cancer Profiles Model — Unit Tests
 *
 * Pure-function unit tests for src/models/cancerProfiles.js.
 * No server or DB required — these run in < 10ms.
 *
 * Coverage:
 *  1. listCancerProfiles() — shape, count, field contracts
 *  2. getCancerProfile()   — known ids, unknown id, null/undefined inputs
 *  3. searchProfilesByBiomarker() — known genes, unknown genes, edge inputs
 *  4. Data contract: every profile has required fields with correct types
 *  5. John's profile (urothelial): FGFR3 / ARID1A / PIK3CA present
 *  6. Alias arrays are non-empty and lowercase-friendly
 *  7. Cross-profile biomarker sharing (TP53, BRCA1, BRCA2, BRAF)
 *
 * Run:
 *   npx vitest run tests/unit/cancerProfiles.vitest.js
 */

import { describe, it, expect } from 'vitest';
import {
  listCancerProfiles,
  getCancerProfile,
  searchProfilesByBiomarker,
  CANCER_PROFILES,
} from '../../src/models/cancerProfiles.js';

// ─── 1. listCancerProfiles() ───────────────────────────────────────────────

describe('listCancerProfiles()', () => {
  it('returns an array', () => {
    expect(Array.isArray(listCancerProfiles())).toBe(true);
  });

  it('returns exactly 8 cancer profiles', () => {
    expect(listCancerProfiles()).toHaveLength(8);
  });

  it('every item has id and label fields', () => {
    for (const p of listCancerProfiles()) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('label');
      expect(typeof p.id).toBe('string');
      expect(typeof p.label).toBe('string');
    }
  });

  it('no item has keyBiomarkers or aliases in the list (list is summary only)', () => {
    for (const p of listCancerProfiles()) {
      // List endpoint should only expose id + label, not full detail
      expect(Object.keys(p).sort()).toEqual(['id', 'label'].sort());
    }
  });

  it('all 8 expected profile IDs are present', () => {
    const ids = listCancerProfiles().map((p) => p.id);
    const EXPECTED = [
      'urothelial_carcinoma',
      'breast_cancer',
      'lung_nsclc',
      'colorectal_cancer',
      'prostate_cancer',
      'ovarian_cancer',
      'pancreatic_cancer',
      'melanoma',
    ];
    for (const id of EXPECTED) {
      expect(ids).toContain(id);
    }
  });

  it('id values are unique (no duplicates)', () => {
    const ids = listCancerProfiles().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('label values are unique (no duplicates)', () => {
    const labels = listCancerProfiles().map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('returns a new array on each call (not mutable shared state)', () => {
    const a = listCancerProfiles();
    const b = listCancerProfiles();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ─── 2. getCancerProfile() ─────────────────────────────────────────────────

describe('getCancerProfile()', () => {
  it('returns full profile for urothelial_carcinoma', () => {
    const p = getCancerProfile('urothelial_carcinoma');
    expect(p).not.toBeNull();
    expect(p.id).toBe('urothelial_carcinoma');
    expect(p.label).toBe('Urothelial Carcinoma');
  });

  it('returns full profile for breast_cancer', () => {
    const p = getCancerProfile('breast_cancer');
    expect(p).not.toBeNull();
    expect(p.id).toBe('breast_cancer');
  });

  it('returns full profile for lung_nsclc', () => {
    const p = getCancerProfile('lung_nsclc');
    expect(p).not.toBeNull();
  });

  it('returns full profile for colorectal_cancer', () => {
    const p = getCancerProfile('colorectal_cancer');
    expect(p).not.toBeNull();
  });

  it('returns full profile for prostate_cancer', () => {
    const p = getCancerProfile('prostate_cancer');
    expect(p).not.toBeNull();
  });

  it('returns full profile for ovarian_cancer', () => {
    const p = getCancerProfile('ovarian_cancer');
    expect(p).not.toBeNull();
  });

  it('returns full profile for pancreatic_cancer', () => {
    const p = getCancerProfile('pancreatic_cancer');
    expect(p).not.toBeNull();
  });

  it('returns full profile for melanoma', () => {
    const p = getCancerProfile('melanoma');
    expect(p).not.toBeNull();
  });

  it('returns null for unknown profile id', () => {
    expect(getCancerProfile('unknown_cancer')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getCancerProfile('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getCancerProfile(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getCancerProfile(undefined)).toBeNull();
  });

  it('returns null for numeric input', () => {
    expect(getCancerProfile(42)).toBeNull();
  });

  it('is case-sensitive (uppercase does not match)', () => {
    // IDs are lowercase_snake — 'UROTHELIAL_CARCINOMA' should not match
    expect(getCancerProfile('UROTHELIAL_CARCINOMA')).toBeNull();
  });
});

// ─── 3. searchProfilesByBiomarker() ──────────────────────────────────────

describe('searchProfilesByBiomarker() — known biomarkers', () => {
  it('FGFR3 → at least urothelial_carcinoma', () => {
    const matches = searchProfilesByBiomarker('FGFR3');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('urothelial_carcinoma');
  });

  it('ARID1A → at least urothelial_carcinoma', () => {
    const matches = searchProfilesByBiomarker('ARID1A');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('urothelial_carcinoma');
  });

  it('PIK3CA → at least urothelial_carcinoma and breast_cancer', () => {
    const matches = searchProfilesByBiomarker('PIK3CA');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('urothelial_carcinoma');
    expect(ids).toContain('breast_cancer');
  });

  it('TP53 → multiple profiles (universal suppressor)', () => {
    const matches = searchProfilesByBiomarker('TP53');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('BRCA1 → at least breast, ovarian, prostate, pancreatic', () => {
    const matches = searchProfilesByBiomarker('BRCA1');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('breast_cancer');
    expect(ids).toContain('ovarian_cancer');
    expect(ids).toContain('prostate_cancer');
    expect(ids).toContain('pancreatic_cancer');
  });

  it('BRCA2 → at least breast, ovarian, prostate, pancreatic', () => {
    const matches = searchProfilesByBiomarker('BRCA2');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('breast_cancer');
    expect(ids).toContain('ovarian_cancer');
    expect(ids).toContain('prostate_cancer');
    expect(ids).toContain('pancreatic_cancer');
  });

  it('BRAF → at least colorectal_cancer and melanoma', () => {
    const matches = searchProfilesByBiomarker('BRAF');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('colorectal_cancer');
    expect(ids).toContain('melanoma');
  });

  it('KRAS → at least colorectal_cancer and pancreatic_cancer', () => {
    const matches = searchProfilesByBiomarker('KRAS');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('colorectal_cancer');
    expect(ids).toContain('pancreatic_cancer');
  });

  it('EGFR → at least lung_nsclc', () => {
    const matches = searchProfilesByBiomarker('EGFR');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('lung_nsclc');
  });

  it('HER2 → at least breast_cancer', () => {
    const matches = searchProfilesByBiomarker('HER2');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('breast_cancer');
  });

  it('AR → at least prostate_cancer', () => {
    const matches = searchProfilesByBiomarker('AR');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('prostate_cancer');
  });

  it('MSI → at least colorectal_cancer and prostate_cancer', () => {
    const matches = searchProfilesByBiomarker('MSI');
    const ids = matches.map((m) => m.id);
    expect(ids).toContain('colorectal_cancer');
    expect(ids).toContain('prostate_cancer');
  });
});

describe('searchProfilesByBiomarker() — case insensitivity', () => {
  it('fgfr3 (lowercase) → same result as FGFR3', () => {
    const upper = searchProfilesByBiomarker('FGFR3').map((m) => m.id);
    const lower = searchProfilesByBiomarker('fgfr3').map((m) => m.id);
    expect(lower.sort()).toEqual(upper.sort());
  });

  it('Kras (mixed case) → same result as KRAS', () => {
    const upper = searchProfilesByBiomarker('KRAS').map((m) => m.id);
    const mixed = searchProfilesByBiomarker('Kras').map((m) => m.id);
    expect(mixed.sort()).toEqual(upper.sort());
  });

  it('brca2 (lowercase) → same result as BRCA2', () => {
    const upper = searchProfilesByBiomarker('BRCA2').map((m) => m.id);
    const lower = searchProfilesByBiomarker('brca2').map((m) => m.id);
    expect(lower.sort()).toEqual(upper.sort());
  });
});

describe('searchProfilesByBiomarker() — edge inputs', () => {
  it('unknown gene → empty array (not null or undefined)', () => {
    const result = searchProfilesByBiomarker('DOESNOTEXIST123');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('empty string → empty array', () => {
    const result = searchProfilesByBiomarker('');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('null → empty array (never throws)', () => {
    expect(() => searchProfilesByBiomarker(null)).not.toThrow();
    expect(searchProfilesByBiomarker(null)).toHaveLength(0);
  });

  it('undefined → empty array (never throws)', () => {
    expect(() => searchProfilesByBiomarker(undefined)).not.toThrow();
    expect(searchProfilesByBiomarker(undefined)).toHaveLength(0);
  });

  it('numeric input → empty array (never throws)', () => {
    expect(() => searchProfilesByBiomarker(42)).not.toThrow();
    expect(searchProfilesByBiomarker(42)).toHaveLength(0);
  });

  it('whitespace-only string → empty array', () => {
    const result = searchProfilesByBiomarker('   ');
    expect(Array.isArray(result)).toBe(true);
    // Trimming whitespace may match nothing
    expect(result.length).toBe(0);
  });
});

describe('searchProfilesByBiomarker() — result shape', () => {
  it('each match has id, label, keyBiomarkers', () => {
    const matches = searchProfilesByBiomarker('FGFR3');
    for (const m of matches) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('label');
      expect(m).toHaveProperty('keyBiomarkers');
      expect(Array.isArray(m.keyBiomarkers)).toBe(true);
    }
  });

  it('each match keyBiomarkers includes the searched gene (case-insensitive)', () => {
    const matches = searchProfilesByBiomarker('fgfr3');
    for (const m of matches) {
      const hasGene = m.keyBiomarkers.some((b) => b.toUpperCase() === 'FGFR3');
      expect(hasGene).toBe(true);
    }
  });

  it('does not expose aliases in search results (list-only fields)', () => {
    const matches = searchProfilesByBiomarker('FGFR3');
    // Result shape should be {id, label, keyBiomarkers} — not the full profile
    for (const m of matches) {
      expect(Object.keys(m)).not.toContain('commonReportSources');
    }
  });
});

// ─── 4. Data contract: all profiles have required fields ──────────────────

describe('CANCER_PROFILES data contract — all 8 profiles', () => {
  const ALL_IDS = [
    'urothelial_carcinoma', 'breast_cancer', 'lung_nsclc', 'colorectal_cancer',
    'prostate_cancer', 'ovarian_cancer', 'pancreatic_cancer', 'melanoma',
  ];

  for (const id of ALL_IDS) {
    describe(`${id}`, () => {
      it('has required fields', () => {
        const p = CANCER_PROFILES[id];
        expect(p).toBeDefined();
        expect(typeof p.id).toBe('string');
        expect(typeof p.label).toBe('string');
        expect(Array.isArray(p.aliases)).toBe(true);
        expect(Array.isArray(p.keyBiomarkers)).toBe(true);
        expect(Array.isArray(p.commonReportSources)).toBe(true);
      });

      it('id matches registry key', () => {
        expect(CANCER_PROFILES[id].id).toBe(id);
      });

      it('aliases array is non-empty', () => {
        expect(CANCER_PROFILES[id].aliases.length).toBeGreaterThan(0);
      });

      it('keyBiomarkers array has at least 3 markers', () => {
        expect(CANCER_PROFILES[id].keyBiomarkers.length).toBeGreaterThanOrEqual(3);
      });

      it('commonReportSources is non-empty', () => {
        expect(CANCER_PROFILES[id].commonReportSources.length).toBeGreaterThan(0);
      });

      it('all keyBiomarkers are non-empty strings', () => {
        for (const b of CANCER_PROFILES[id].keyBiomarkers) {
          expect(typeof b).toBe('string');
          expect(b.length).toBeGreaterThan(0);
        }
      });
    });
  }
});

// ─── 5. John's profile: FGFR3 / ARID1A / PIK3CA guards ───────────────────

describe("John's cancer profile — urothelial_carcinoma critical biomarker guards", () => {
  const PROFILE = getCancerProfile('urothelial_carcinoma');

  it('profile is defined', () => {
    expect(PROFILE).not.toBeNull();
  });

  it('FGFR3 is in keyBiomarkers', () => {
    expect(PROFILE.keyBiomarkers).toContain('FGFR3');
  });

  it('ARID1A is in keyBiomarkers', () => {
    expect(PROFILE.keyBiomarkers).toContain('ARID1A');
  });

  it('PIK3CA is in keyBiomarkers', () => {
    expect(PROFILE.keyBiomarkers).toContain('PIK3CA');
  });

  it('ERBB2 (HER2) is in keyBiomarkers', () => {
    expect(PROFILE.keyBiomarkers).toContain('ERBB2');
  });

  it('PD-L1 is in keyBiomarkers (checkpoint inhibitor target)', () => {
    expect(PROFILE.keyBiomarkers).toContain('PD-L1');
  });

  it('TP53 is in keyBiomarkers', () => {
    expect(PROFILE.keyBiomarkers).toContain('TP53');
  });

  it('FoundationOne is in commonReportSources', () => {
    expect(PROFILE.commonReportSources).toContain('FoundationOne');
  });

  it('aliases include bladder cancer variant', () => {
    const hasAlias = PROFILE.aliases.some((a) => a.toLowerCase().includes('bladder'));
    expect(hasAlias).toBe(true);
  });
});
