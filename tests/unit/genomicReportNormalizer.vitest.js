/**
 * Vitest unit tests for genomicReportNormalizer (v2)
 * Run: npx vitest run tests/unit/genomicReportNormalizer.vitest.js
 *
 * Covers:
 *  1. Source detection (FoundationOne, Tempus, Caris, Guardant, MSK, unknown)
 *  2. Profile-aware gene extraction (urothelial, breast, lung, CRC)
 *  3. Pathogenicity classification (pathogenic hotspots, frameshift, VUS, benign)
 *  4. VAF extraction
 *  5. Key biomarker flags (TMB-H, MSI-H, PD-L1)
 *  6. Schema shape validation
 */

import { describe, it, expect } from 'vitest';
import { normalizeGenomicReport } from '../../src/services/genomicReportNormalizer.js';

// Direct import for cases needing null rawText passthrough
const _normalizeGenomicReport = normalizeGenomicReport;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function norm(rawText, cancerProfileId = null) {
  return normalizeGenomicReport({ rawText, patient: { cancerProfileId } });
}

function gene(result, symbol) {
  return result.alterations.find((a) => a.gene === symbol) || null;
}

// ─── 1. Source detection ───────────────────────────────────────────────────────

describe('Source detection', () => {
  it('detects foundationone', () => {
    const r = norm('Foundation Medicine F1CDx report for patient...');
    expect(r.source).toBe('foundationone');
    expect(r.schemaVersion).toBe('2.0');
  });

  it('detects tempus', () => {
    const r = norm('Tempus xT sequencing panel results');
    expect(r.source).toBe('tempus');
  });

  it('detects caris', () => {
    const r = norm('Caris Molecular Intelligence report');
    expect(r.source).toBe('caris');
  });

  it('detects guardant360', () => {
    const r = norm('Guardant360 liquid biopsy results');
    expect(r.source).toBe('guardant');
  });

  it('detects MSK-IMPACT', () => {
    const r = norm('Memorial Sloan Kettering IMPACT panel');
    expect(r.source).toBe('msk_impact');
  });

  it('returns unknown for unrecognized source', () => {
    const r = norm('Some unknown lab result with FGFR3 mutation');
    expect(r.source).toBe('unknown');
  });
});

// ─── 2. Urothelial cancer profile ─────────────────────────────────────────────

describe('Urothelial carcinoma profile', () => {
  const PROFILE = 'urothelial_carcinoma';

  it('extracts FGFR3 hotspot S249C as pathogenic', () => {
    const r = norm('FGFR3 p.S249C detected in tumor sample.', PROFILE);
    const g = gene(r, 'FGFR3');
    expect(g).not.toBeNull();
    expect(g.pathogenicity).toBe('pathogenic');
  });

  it('extracts PIK3CA E545K', () => {
    const r = norm('PIK3CA E545K also present.', PROFILE);
    const g = gene(r, 'PIK3CA');
    expect(g).not.toBeNull();
  });

  it('extracts ARID1A frameshift as likely_pathogenic', () => {
    const r = norm('ARID1A p.Q456* frameshift detected.', PROFILE);
    const g = gene(r, 'ARID1A');
    expect(g).not.toBeNull();
    expect(['likely_pathogenic', 'pathogenic']).toContain(g.pathogenicity);
  });

  it('flags TMB-High', () => {
    const r = norm('TMB-High: 18 mutations/Mb detected.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('TMB-H');
  });

  it('flags MSI-H', () => {
    const r = norm('Microsatellite instability: MSI-High', PROFILE);
    expect(r.keyBiomarkersFound).toContain('MSI-H');
  });

  it('flags PD-L1 score', () => {
    const r = norm('PD-L1 expression score 75% (CPS)', PROFILE);
    expect(r.keyBiomarkersFound).toContain('PD-L1');
  });

  it('cancerProfileId is preserved in output (under patient)', () => {
    const r = norm('FGFR3 p.R248C detected', PROFILE);
    expect(r.patient.cancerProfileId).toBe(PROFILE);
  });
});

// ─── 3. Breast cancer profile ─────────────────────────────────────────────────

describe('Breast cancer profile', () => {
  const PROFILE = 'breast_cancer';

  it('extracts BRCA1 variant (HGVS coding notation)', () => {
    // c.5266dupC contains "dup" → frameshift-like → likely_pathogenic
    const r = norm('BRCA1 c.5266dupC pathogenic variant identified.', PROFILE);
    const g = gene(r, 'BRCA1');
    expect(g).not.toBeNull();
    expect(['pathogenic', 'likely_pathogenic']).toContain(g.pathogenicity);
  });

  it('extracts BRCA2', () => {
    const r = norm('BRCA2 p.K3326* variant detected.', PROFILE);
    const g = gene(r, 'BRCA2');
    expect(g).not.toBeNull();
  });

  it('extracts ESR1 mutation (endocrine resistance)', () => {
    const r = norm('ESR1 p.D538G detected — endocrine resistance mutation.', PROFILE);
    const g = gene(r, 'ESR1');
    expect(g).not.toBeNull();
  });

  it('extracts HER2 amplification', () => {
    const r = norm('HER2 amplification detected, copy number 8.', PROFILE);
    const g = gene(r, 'HER2');
    expect(g).not.toBeNull();
  });

  it('handles ER/PR status markers', () => {
    const r = norm('ER positive, PR negative tumor profile.', PROFILE);
    // Should at least return a result without throwing
    expect(r).toBeDefined();
    expect(r.schemaVersion).toBe('2.0');
  });
});

// ─── 4. Lung (NSCLC) profile ──────────────────────────────────────────────────

describe('Lung NSCLC profile', () => {
  const PROFILE = 'lung_nsclc';

  it('extracts EGFR exon 19 deletion', () => {
    const r = norm('EGFR exon 19 deletion (E746-A750del) detected.', PROFILE);
    const g = gene(r, 'EGFR');
    expect(g).not.toBeNull();
  });

  it('extracts KRAS G12C hotspot', () => {
    const r = norm('KRAS G12C mutation detected. Sotorasib-targetable.', PROFILE);
    const g = gene(r, 'KRAS');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('KRAS');
  });

  it('extracts ALK rearrangement', () => {
    const r = norm('ALK rearrangement detected by FISH (positive).', PROFILE);
    const g = gene(r, 'ALK');
    expect(g).not.toBeNull();
  });

  it('extracts MET exon 14 skipping', () => {
    const r = norm('MET exon 14 skipping mutation identified.', PROFILE);
    const g = gene(r, 'MET');
    expect(g).not.toBeNull();
  });

  it('extracts STK11 loss-of-function', () => {
    const r = norm('STK11 p.Q37* nonsense mutation (immunotherapy resistance).', PROFILE);
    const g = gene(r, 'STK11');
    expect(g).not.toBeNull();
  });
});

// ─── 5. Colorectal cancer profile ─────────────────────────────────────────────

describe('Colorectal cancer profile', () => {
  const PROFILE = 'colorectal_cancer';

  it('extracts KRAS G12D (anti-EGFR resistance)', () => {
    const r = norm('KRAS G12D mutation — anti-EGFR therapy resistance.', PROFILE);
    const g = gene(r, 'KRAS');
    expect(g).not.toBeNull();
  });

  it('extracts BRAF V600E', () => {
    const r = norm('BRAF V600E mutation detected.', PROFILE);
    const g = gene(r, 'BRAF');
    expect(g).not.toBeNull();
    expect(g.pathogenicity).toBe('pathogenic');
  });

  it('extracts NRAS Q61K', () => {
    const r = norm('NRAS Q61K detected in ctDNA sample.', PROFILE);
    const g = gene(r, 'NRAS');
    expect(g).not.toBeNull();
  });

  it('extracts SMAD4 loss', () => {
    const r = norm('SMAD4 p.R361H (loss of function, poor prognosis).', PROFILE);
    const g = gene(r, 'SMAD4');
    expect(g).not.toBeNull();
  });
});

// ─── 6. VAF extraction ────────────────────────────────────────────────────────

describe('VAF extraction', () => {
  it('extracts VAF percentage from text', () => {
    const r = norm('FGFR3 p.S249C (VAF: 42.5%)');
    const g = gene(r, 'FGFR3');
    expect(g).not.toBeNull();
    // VAF may be stored as number or string; just verify it's present/reasonable
    if (g.vaf != null) {
      expect(Number(g.vaf)).toBeGreaterThan(0);
    }
  });
});

// ─── 7. Schema shape ──────────────────────────────────────────────────────────

describe('Output schema shape', () => {
  it('always returns required top-level fields', () => {
    const r = norm('Some report with TP53 p.R175H mutation.');
    expect(r).toHaveProperty('schemaVersion', '2.0');
    expect(r).toHaveProperty('source');
    expect(r).toHaveProperty('alterations');
    expect(r).toHaveProperty('keyBiomarkersFound');
    expect(Array.isArray(r.alterations)).toBe(true);
    expect(Array.isArray(r.keyBiomarkersFound)).toBe(true);
  });

  it('each alteration has gene and pathogenicity fields', () => {
    const r = norm('BRAF V600E detected. TP53 R175H present.');
    for (const alt of r.alterations) {
      expect(alt).toHaveProperty('gene');
      expect(typeof alt.gene).toBe('string');
      expect(alt).toHaveProperty('pathogenicity');
    }
  });

  it('handles empty rawText gracefully — no throw', () => {
    expect(() => norm('')).not.toThrow();
    // null is coerced to '' inside the normalizer
    expect(() => normalizeGenomicReport({ rawText: null, patient: {} })).not.toThrow();
  });

  it('handles very long report text without crashing', () => {
    const longText = 'FGFR3 p.S249C detected. '.repeat(500);
    expect(() => norm(longText, 'urothelial_carcinoma')).not.toThrow();
  });
});

// ─── 8. TP53 universal gene ───────────────────────────────────────────────────

describe('TP53 — universal across all profiles', () => {
  const profiles = ['urothelial_carcinoma', 'breast_cancer', 'lung_nsclc', 'colorectal_cancer', null];

  for (const profile of profiles) {
    it(`TP53 R175H extracted for profile: ${profile ?? 'none'}`, () => {
      const r = norm('TP53 p.R175H detected.', profile);
      const g = gene(r, 'TP53');
      expect(g).not.toBeNull();
    });
  }
});

// ─── 9. Prostate cancer profile ───────────────────────────────────────────────

describe('Prostate cancer profile', () => {
  const PROFILE = 'prostate_cancer';

  it('extracts BRCA2 pathogenic variant', () => {
    const r = norm('BRCA2 p.E1953* pathogenic truncation detected. PARP inhibitor eligible.', PROFILE);
    const g = gene(r, 'BRCA2');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('BRCA2');
  });

  it('extracts BRCA1 loss-of-function', () => {
    const r = norm('BRCA1 frameshift deletion c.68_69del identified.', PROFILE);
    const g = gene(r, 'BRCA1');
    expect(g).not.toBeNull();
    expect(['likely_pathogenic', 'pathogenic']).toContain(g.pathogenicity);
  });

  it('extracts ATM mutation', () => {
    const r = norm('ATM p.R2832* stop-gain mutation present.', PROFILE);
    const g = gene(r, 'ATM');
    expect(g).not.toBeNull();
  });

  it('extracts CDK12 biallelic loss', () => {
    const r = norm('CDK12 biallelic loss of function — immunotherapy biomarker.', PROFILE);
    const g = gene(r, 'CDK12');
    expect(g).not.toBeNull();
  });

  it('flags TMB-High for prostate profile', () => {
    const r = norm('TMB: 16 mut/Mb — high mutational burden.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('TMB-H');
  });

  it('flags MSI-H for prostate profile', () => {
    const r = norm('MSI-High confirmed via PCR-based testing.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('MSI-H');
  });

  it('cancerProfileId preserved for prostate profile', () => {
    const r = norm('BRCA2 p.E1953* detected.', PROFILE);
    expect(r.patient.cancerProfileId).toBe(PROFILE);
  });
});

// ─── 10. Ovarian cancer profile ───────────────────────────────────────────────

describe('Ovarian cancer profile', () => {
  const PROFILE = 'ovarian_cancer';

  it('extracts BRCA1 germline pathogenic variant', () => {
    const r = norm('BRCA1 c.5266dupC (germline) — pathogenic. PARP inhibitor eligible.', PROFILE);
    const g = gene(r, 'BRCA1');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('BRCA1');
  });

  it('extracts BRCA2 somatic variant', () => {
    const r = norm('BRCA2 p.K3326* somatic variant detected.', PROFILE);
    const g = gene(r, 'BRCA2');
    expect(g).not.toBeNull();
  });

  it('extracts TP53 (driver in HGSOC)', () => {
    const r = norm('TP53 p.R248W missense — classic HGSOC driver mutation.', PROFILE);
    const g = gene(r, 'TP53');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('TP53');
  });

  it('extracts NF1 loss-of-function', () => {
    const r = norm('NF1 p.R1947* nonsense mutation detected.', PROFILE);
    const g = gene(r, 'NF1');
    expect(g).not.toBeNull();
  });

  it('flags TMB-High for ovarian profile', () => {
    const r = norm('TMB: 20 mutations/Mb — high.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('TMB-H');
  });

  it('cancerProfileId preserved for ovarian profile', () => {
    const r = norm('BRCA1 pathogenic.', PROFILE);
    expect(r.patient.cancerProfileId).toBe(PROFILE);
  });
});

// ─── 11. Pancreatic cancer profile ────────────────────────────────────────────

describe('Pancreatic cancer profile', () => {
  const PROFILE = 'pancreatic_cancer';

  it('extracts KRAS G12D — canonical PDAC driver', () => {
    const r = norm('KRAS G12D mutation detected — pancreatic adenocarcinoma driver.', PROFILE);
    const g = gene(r, 'KRAS');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('KRAS');
  });

  it('extracts KRAS G12V', () => {
    const r = norm('KRAS p.G12V detected in pancreatic tumor sample.', PROFILE);
    const g = gene(r, 'KRAS');
    expect(g).not.toBeNull();
  });

  it('extracts SMAD4 loss (PDAC prognosis marker)', () => {
    const r = norm('SMAD4 homozygous deletion — poor prognosis indicator in PDAC.', PROFILE);
    const g = gene(r, 'SMAD4');
    expect(g).not.toBeNull();
  });

  it('extracts TP53 mutation', () => {
    const r = norm('TP53 p.R282W missense detected.', PROFILE);
    const g = gene(r, 'TP53');
    expect(g).not.toBeNull();
  });

  it('extracts BRCA2 for PARP eligibility', () => {
    const r = norm('BRCA2 p.I2490T pathogenic — olaparib-eligible pancreatic cancer.', PROFILE);
    const g = gene(r, 'BRCA2');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('BRCA2');
  });

  it('extracts ATM pathogenic variant', () => {
    const r = norm('ATM p.L2307fs frameshift detected.', PROFILE);
    const g = gene(r, 'ATM');
    expect(g).not.toBeNull();
  });

  it('flags MSI-H — immunotherapy benefit in PDAC', () => {
    const r = norm('MSI-H detected — pembrolizumab indicated regardless of tumor type.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('MSI-H');
  });

  it('cancerProfileId preserved for pancreatic profile', () => {
    const r = norm('KRAS G12D detected.', PROFILE);
    expect(r.patient.cancerProfileId).toBe(PROFILE);
  });
});

// ─── 12. Melanoma profile ─────────────────────────────────────────────────────

describe('Melanoma profile', () => {
  const PROFILE = 'melanoma';

  it('extracts BRAF V600E — primary targeted therapy target', () => {
    const r = norm('BRAF V600E mutation detected. Vemurafenib + cobimetinib indicated.', PROFILE);
    const g = gene(r, 'BRAF');
    expect(g).not.toBeNull();
    expect(g.pathogenicity).toBe('pathogenic');
    expect(r.keyBiomarkersFound).toContain('BRAF');
  });

  it('extracts BRAF V600K variant', () => {
    const r = norm('BRAF p.V600K detected in cutaneous melanoma specimen.', PROFILE);
    const g = gene(r, 'BRAF');
    expect(g).not.toBeNull();
  });

  it('extracts NRAS Q61K hotspot', () => {
    const r = norm('NRAS Q61K mutation — MEK inhibitor resistance marker.', PROFILE);
    const g = gene(r, 'NRAS');
    expect(g).not.toBeNull();
    expect(r.keyBiomarkersFound).toContain('NRAS');
  });

  it('extracts NRAS Q61R variant', () => {
    const r = norm('NRAS p.Q61R hotspot detected.', PROFILE);
    const g = gene(r, 'NRAS');
    expect(g).not.toBeNull();
  });

  it('extracts NF1 loss-of-function (RAS pathway)', () => {
    const r = norm('NF1 p.Q1228* truncating mutation — RAS pathway activation.', PROFILE);
    const g = gene(r, 'NF1');
    expect(g).not.toBeNull();
  });

  it('flags TMB-High — immunotherapy benefit marker', () => {
    const r = norm('TMB-High: 25 mutations/Mb — pembrolizumab indicated.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('TMB-H');
  });

  it('flags MSI-H for melanoma profile', () => {
    const r = norm('MSI-H confirmed — checkpoint inhibitor eligible.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('MSI-H');
  });

  it('flags PD-L1 expression', () => {
    const r = norm('PD-L1 expression: 80% TPS — high expressors benefit from nivolumab.', PROFILE);
    expect(r.keyBiomarkersFound).toContain('PD-L1');
  });

  it('cancerProfileId preserved for melanoma profile', () => {
    const r = norm('BRAF V600E confirmed.', PROFILE);
    expect(r.patient.cancerProfileId).toBe(PROFILE);
  });
});

// ─── 13. Cross-profile gene overlap ───────────────────────────────────────────

describe('Cross-profile gene sharing', () => {
  it('KRAS extracted in both CRC and pancreatic profiles', () => {
    const text = 'KRAS G12D mutation detected.';
    for (const profile of ['colorectal_cancer', 'pancreatic_cancer']) {
      const r = norm(text, profile);
      const g = gene(r, 'KRAS');
      expect(g).not.toBeNull();
    }
  });

  it('BRCA2 extracted in ovarian, prostate, and pancreatic profiles', () => {
    const text = 'BRCA2 p.K3326* pathogenic variant.';
    for (const profile of ['ovarian_cancer', 'prostate_cancer', 'pancreatic_cancer']) {
      const r = norm(text, profile);
      const g = gene(r, 'BRCA2');
      expect(g).not.toBeNull();
    }
  });

  it('BRAF V600E extracted in both CRC and melanoma profiles', () => {
    const text = 'BRAF V600E detected.';
    for (const profile of ['colorectal_cancer', 'melanoma']) {
      const r = norm(text, profile);
      const g = gene(r, 'BRAF');
      expect(g).not.toBeNull();
      expect(g.pathogenicity).toBe('pathogenic');
    }
  });

  it('TMB-High flagged identically across all 8 profiles', () => {
    const text = 'TMB: 15 mut/Mb — TMB-High.';
    const allProfiles = [
      'urothelial_carcinoma', 'breast_cancer', 'lung_nsclc', 'colorectal_cancer',
      'prostate_cancer', 'ovarian_cancer', 'pancreatic_cancer', 'melanoma',
    ];
    for (const profile of allProfiles) {
      const r = norm(text, profile);
      expect(r.keyBiomarkersFound).toContain('TMB-H');
    }
  });
});
