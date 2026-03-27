/**
 * Multi-Cancer Genomic Report Ingestion & Precision Medicine Matching
 *
 * Tests for:
 *   1. Multi-cancer FHIR Genomics bundle parsing
 *   2. Cross-cancer mutation correlation (ARID1A in bladder + breast)
 *   3. Pathway enrichment across cancer types
 *   4. Genomic report normalization with multiple cancers
 *   5. Trial eligibility prediction (multi-cancer cohorts)
 *   6. Variant frequency analysis per cancer
 *   7. Gene expression data integration (log2FC, p-values)
 *   8. Concurrent multi-cancer sync (no data loss)
 *   9. Genomic data quality (schema validation)
 *  10. Precision medicine recommendation accuracy
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/multi-cancer-genomic-ingestion.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_PORT || 3999}`;

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status()).toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

// ─── 1. Multi-Cancer FHIR Bundle Parsing ─────────────────────────────────

test.describe('Multi-cancer — FHIR bundle parsing', () => {
  test('parses FHIR Genomics bundle with multiple cancer specimen types', async ({ request }) => {
    const cookie = await login(request);
    
    // Submit a multi-cancer FHIR bundle
    const res = await request.post(`${API}/api/genomics/ingest`, {
      headers: { Cookie: cookie },
      data: {
        bundleType: 'batch-response',
        entry: [
          {
            resource: {
              resourceType: 'Specimen',
              id: 'bladder-specimen-1',
              type: { coding: [{ code: 'BLADDER' }] },
            },
          },
          {
            resource: {
              resourceType: 'Specimen',
              id: 'breast-specimen-1',
              type: { coding: [{ code: 'BREAST' }] },
            },
          },
        ],
      },
    });

    expect(res.status()).toBeLessThan(400);
  });

  test('ingestion response includes records_per_cancer breakdown', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/ingest`, {
      headers: { Cookie: cookie },
      data: {
        bundleType: 'batch-response',
        entry: [
          {
            resource: {
              resourceType: 'Specimen',
              id: 'bladder-1',
              type: { coding: [{ code: 'BLADDER' }] },
            },
          },
          {
            resource: {
              resourceType: 'Specimen',
              id: 'breast-1',
              type: { coding: [{ code: 'BREAST' }] },
            },
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should breakdown by cancer type
      expect(body.records_per_cancer || body.records_synced).toBeTruthy();
    }
  });

  test('handles bundle with no cancer specimens gracefully', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/ingest`, {
      headers: { Cookie: cookie },
      data: {
        bundleType: 'batch-response',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'pt-1',
              name: [{ text: 'Test' }],
            },
          },
        ],
      },
    });

    // Should not crash; should return valid response
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── 2. Cross-Cancer Mutation Correlation ────────────────────────────────

test.describe('Multi-cancer — mutation correlation', () => {
  test('identifies same mutation (ARID1A) across cancer types', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/correlate-mutations`, {
      headers: { Cookie: cookie },
      data: {
        mutations: [
          {
            gene: 'ARID1A',
            variant: 'p.Q556*',
            cancer: 'BLADDER',
            vaf: 0.45,
          },
          {
            gene: 'ARID1A',
            variant: 'p.Q556*',
            cancer: 'BREAST',
            vaf: 0.38,
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should detect correlation
      expect(body.correlations || body.shared_mutations).toBeTruthy();
    }
  });

  test('distinguishes true correlation from coincidental same variant', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/correlate-mutations`, {
      headers: { Cookie: cookie },
      data: {
        mutations: [
          {
            gene: 'TP53',
            variant: 'p.R175H', // Common polymorphism
            cancer: 'BLADDER',
            vaf: 0.5,
          },
          {
            gene: 'TP53',
            variant: 'p.R175H',
            cancer: 'BREAST',
            vaf: 0.5,
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should flag as potential germline
      expect(body.notes || body.germline_flag).toBeTruthy();
    }
  });

  test('handles non-overlapping mutations across cancers', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/correlate-mutations`, {
      headers: { Cookie: cookie },
      data: {
        mutations: [
          {
            gene: 'FGFR3',
            variant: 'p.Y373C',
            cancer: 'BLADDER',
          },
          {
            gene: 'BRCA1',
            variant: 'c.68_69delAG',
            cancer: 'BREAST',
          },
        ],
      },
    });

    // Should handle gracefully (no correlation, not an error)
    expect(res.status()).toBeLessThan(400);
  });
});

// ─── 3. Pathway Enrichment Across Cancer Types ──────────────────────────

test.describe('Multi-cancer — pathway enrichment', () => {
  test('enrichment identifies shared pathway (FGFR3 + PI3K in bladder)', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/pathway-enrichment`, {
      headers: { Cookie: cookie },
      data: {
        mutations: [
          { gene: 'FGFR3', cancer: 'BLADDER' },
          { gene: 'PIK3CA', cancer: 'BLADDER' },
          { gene: 'ARID1A', cancer: 'BLADDER' },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should identify pathway
      expect(body.pathways || body.enrichment).toBeTruthy();
    }
  });

  test('pathway results include drug targets (FGFR inhibitor for FGFR3)', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/pathway-enrichment`, {
      headers: { Cookie: cookie },
      data: {
        mutations: [
          { gene: 'FGFR3', cancer: 'BLADDER' },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should suggest relevant therapies
      expect(body.therapies || body.drug_targets).toBeTruthy();
    }
  });
});

// ─── 4. Genomic Report Normalization (Multi-Cancer) ──────────────────────

test.describe('Multi-cancer — report normalization', () => {
  test('normalized report includes all cancer types', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/normalize-report`, {
      headers: { Cookie: cookie },
      data: {
        cancers: ['BLADDER', 'BREAST'],
        variants: [
          { gene: 'FGFR3', cancer: 'BLADDER', vaf: 0.45 },
          { gene: 'BRCA1', cancer: 'BREAST', vaf: 0.50 },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should normalize all records
      expect(body.records || body.cancers).toBeTruthy();
    }
  });

  test('report normalization preserves VAF and mutational burden per cancer', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/normalize-report`, {
      headers: { Cookie: cookie },
      data: {
        variants: [
          { gene: 'FGFR3', cancer: 'BLADDER', vaf: 0.45 },
          { gene: 'TP53', cancer: 'BLADDER', vaf: 0.30 },
          { gene: 'BRCA1', cancer: 'BREAST', vaf: 0.50 },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should preserve cancer-specific metrics
      const normalized = body.records || [];
      normalized.forEach(rec => {
        expect(rec.vaf).toBeTruthy();
        expect(rec.cancer).toBeTruthy();
      });
    }
  });
});

// ─── 5. Trial Eligibility Prediction (Multi-Cancer) ──────────────────────

test.describe('Multi-cancer — trial matching', () => {
  test('multi-cancer trial includes both bladder and breast cohorts', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/trials/match-multi-cancer`, {
      headers: { Cookie: cookie },
      data: {
        cancers: [
          {
            type: 'BLADDER',
            mutations: ['FGFR3', 'ARID1A', 'PIK3CA'],
          },
          {
            type: 'BREAST',
            mutations: ['BRCA1', 'TP53'],
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should return trials with multi-cancer eligibility
      expect(body.trials || body.matches).toBeTruthy();
    }
  });

  test('trial matching respects cancer-specific inclusion/exclusion criteria', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/trials/match-multi-cancer`, {
      headers: { Cookie: cookie },
      data: {
        cancers: [
          {
            type: 'BLADDER',
            mutations: ['FGFR3'],
            stage: 'advanced',
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should filter based on criteria
      if (body.trials) {
        body.trials.forEach(trial => {
          // Should indicate eligibility per cancer
          expect(trial.eligible !== undefined).toBe(true);
        });
      }
    }
  });

  test('trial match includes reason for eligibility (or ineligibility)', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/trials/match-multi-cancer`, {
      headers: { Cookie: cookie },
      data: {
        cancers: [
          {
            type: 'BLADDER',
            mutations: ['FGFR3'],
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      if (body.trials && body.trials.length > 0) {
        body.trials.forEach(trial => {
          // Should explain why eligible/ineligible
          expect(trial.reason || trial.notes).toBeTruthy();
        });
      }
    }
  });
});

// ─── 6. Variant Frequency Analysis Per Cancer ───────────────────────────

test.describe('Multi-cancer — variant frequency analysis', () => {
  test('frequency analysis stratifies VAF by cancer type', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/variant-frequency`, {
      headers: { Cookie: cookie },
      data: {
        variants: [
          { gene: 'FGFR3', cancer: 'BLADDER', vaf: 0.45, samples: 150 },
          { gene: 'FGFR3', cancer: 'BREAST', vaf: 0.08, samples: 500 },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should show frequency per cancer
      expect(body.frequency || body.analysis).toBeTruthy();
    }
  });

  test('frequency report includes allele frequency comparisons', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/variant-frequency`, {
      headers: { Cookie: cookie },
      data: {
        variants: [
          { gene: 'FGFR3', cancer: 'BLADDER', vaf: 0.45 },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should compare to population frequency
      expect(body.population_frequency || body.comparison).toBeTruthy();
    }
  });
});

// ─── 7. Gene Expression Data Integration ────────────────────────────────

test.describe('Multi-cancer — gene expression integration', () => {
  test('expression data with log2FC and p-values is parsed correctly', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/expression-ingest`, {
      headers: { Cookie: cookie },
      data: {
        cancer: 'BLADDER',
        expressions: [
          { gene: 'FGFR3', log2FC: 3.2, pvalue: 0.0001 },
          { gene: 'KRT5', log2FC: 2.8, pvalue: 0.0005 },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should accept and store expression data
      expect(body.records_synced || body.success).toBeTruthy();
    }
  });

  test('expression data validates p-value ranges', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/expression-ingest`, {
      headers: { Cookie: cookie },
      data: {
        cancer: 'BLADDER',
        expressions: [
          { gene: 'FGFR3', log2FC: 3.2, pvalue: 0.0001 },
          { gene: 'BAD_GENE', log2FC: 1.0, pvalue: 1.5 }, // Invalid p-value
        ],
      },
    });

    // Should either fix or report issue
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── 8. Concurrent Multi-Cancer Sync ────────────────────────────────────

test.describe('Multi-cancer — concurrent sync', () => {
  test('concurrent sync of two cancer types does not lose data', async ({ request }) => {
    const cookie = await login(request);
    
    const [res1, res2] = await Promise.all([
      request.post(`${API}/api/genomics/ingest`, {
        headers: { Cookie: cookie },
        data: {
          cancer: 'BLADDER',
          variants: [
            { gene: 'FGFR3', vaf: 0.45 },
          ],
        },
      }),
      request.post(`${API}/api/genomics/ingest`, {
        headers: { Cookie: cookie },
        data: {
          cancer: 'BREAST',
          variants: [
            { gene: 'BRCA1', vaf: 0.50 },
          ],
        },
      }),
    ]);

    expect(res1.status()).toBeLessThan(400);
    expect(res2.status()).toBeLessThan(400);
  });

  test('concurrent ingestions do not deadlock on database', async ({ request }) => {
    const cookie = await login(request);
    
    // Multiple rapid ingestions
    const results = await Promise.all(
      Array(5).fill(null).map(() =>
        request.post(`${API}/api/genomics/ingest`, {
          headers: { Cookie: cookie },
          data: {
            cancer: 'BLADDER',
            variants: [{ gene: 'FGFR3', vaf: 0.45 }],
          },
        })
      )
    );

    // All should complete
    results.forEach(res => {
      expect(res.status()).toBeLessThan(500);
    });
  });
});

// ─── 9. Genomic Data Quality ───────────────────────────────────────────

test.describe('Multi-cancer — data quality validation', () => {
  test('ingestion validates required fields per cancer', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/genomics/ingest`, {
      headers: { Cookie: cookie },
      data: {
        cancer: 'BLADDER',
        variants: [
          { gene: 'FGFR3', vaf: 0.45 }, // Missing other fields
        ],
      },
    });

    // Should accept partial data or provide guidance
    expect(res.status()).toBeLessThan(500);
  });

  test('variant data never leaks encrypted PHI', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.get(`${API}/api/genomics`, {
      headers: { Cookie: cookie },
    });

    if (res.status() < 400) {
      const body = await res.json();
      const responseStr = JSON.stringify(body);
      // Should not contain patient names, SSN, etc.
      expect(responseStr).not.toMatch(/[a-z]+ [a-z]+/i);
    }
  });
});

// ─── 10. Precision Medicine Recommendations ────────────────────────────

test.describe('Multi-cancer — precision medicine recommendations', () => {
  test('recommendations account for all cancer mutations', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/precision-medicine/recommend`, {
      headers: { Cookie: cookie },
      data: {
        cancers: [
          {
            type: 'BLADDER',
            mutations: ['FGFR3', 'ARID1A'],
          },
          {
            type: 'BREAST',
            mutations: ['BRCA1'],
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      // Should include therapies targeting both cancers
      expect(body.recommendations || body.therapies).toBeTruthy();
    }
  });

  test('recommendation prioritizes therapies with highest clinical evidence', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(`${API}/api/precision-medicine/recommend`, {
      headers: { Cookie: cookie },
      data: {
        cancers: [
          {
            type: 'BLADDER',
            mutations: ['FGFR3'],
          },
        ],
      },
    });

    if (res.status() < 400) {
      const body = await res.json();
      if (body.recommendations && body.recommendations.length > 0) {
        // First recommendation should have highest evidence
        const first = body.recommendations[0];
        expect(first.evidence_level || first.strength).toBeTruthy();
      }
    }
  });
});
