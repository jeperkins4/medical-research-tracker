/**
 * Unit tests for genomicReportNormalizer (v2)
 * Run: node --experimental-vm-modules tests/unit/genomicReportNormalizer.test.mjs
 */

// Simple inline assert (no test framework dependency)
let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

// Dynamic import since normalizer is ESM
const { normalizeGenomicReport } = await import('../../src/services/genomicReportNormalizer.js');

// ─── Test 1: FoundationOne source detection ────────────────────────────────
{
  const r = normalizeGenomicReport({ rawText: 'Foundation Medicine F1CDx report for patient...', patient: {} });
  assert(r.source === 'foundationone', 'source: foundationone detected');
  assert(r.schemaVersion === '2.0', 'schemaVersion 2.0');
}

// ─── Test 2: FGFR3 hotspot mutation ───────────────────────────────────────
{
  const text = 'FGFR3 p.S249C detected in tumor sample. PIK3CA E545K also present.';
  const r = normalizeGenomicReport({ rawText: text, patient: { cancerProfileId: 'urothelial_carcinoma' } });
  const fgfr3 = r.alterations.find(a => a.gene === 'FGFR3');
  assert(fgfr3 != null, 'FGFR3 extracted');
  assert(fgfr3.pathogenicity === 'pathogenic', 'FGFR3 S249C pathogenic');
  const pik3ca = r.alterations.find(a => a.gene === 'PIK3CA');
  assert(pik3ca?.pathogenicity === 'pathogenic', 'PIK3CA E545K pathogenic');
}

// ─── Test 3: TMB-High extraction ──────────────────────────────────────────
{
  const text = 'TMB: 22 mut/Mb — high mutational burden. MSI-H confirmed.';
  const r = normalizeGenomicReport({ rawText: text, patient: {} });
  assert(r.biomarkers.tmb?.value === 22, 'TMB numeric value');
  assert(r.biomarkers.tmb?.high === true, 'TMB-High flag');
  assert(r.biomarkers.msi === 'MSI-H', 'MSI-H');
}

// ─── Test 4: PD-L1 percentage ─────────────────────────────────────────────
{
  const text = 'PD-L1 TPS: 75% expression detected.';
  const r = normalizeGenomicReport({ rawText: text, patient: {} });
  assert(r.biomarkers.pdl1?.score === 75, 'PD-L1 score 75%');
}

// ─── Test 5: KRAS G12C NSCLC ──────────────────────────────────────────────
{
  const text = 'KRAS G12C mutation. EGFR wild-type. ALK negative.';
  const r = normalizeGenomicReport({ rawText: text, patient: { cancerProfileId: 'lung_nsclc' } });
  const kras = r.alterations.find(a => a.gene === 'KRAS');
  assert(kras != null, 'KRAS extracted for NSCLC profile');
  assert(r.keyBiomarkersFound.includes('KRAS'), 'KRAS in keyBiomarkersFound');
}

// ─── Test 6: Frameshift → likely_pathogenic ────────────────────────────────
{
  const text = 'TP53 frameshift deletion exon 5';
  const r = normalizeGenomicReport({ rawText: text, patient: {} });
  const tp53 = r.alterations.find(a => a.gene === 'TP53');
  assert(tp53 != null, 'TP53 extracted');
  assert(tp53.pathogenicity === 'likely_pathogenic', 'TP53 frameshift likely_pathogenic');
}

// ─── Test 7: Unknown source fallback ──────────────────────────────────────
{
  const r = normalizeGenomicReport({ rawText: 'Some random genomic report text', patient: {} });
  assert(r.source === 'unknown', 'unknown source fallback');
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
