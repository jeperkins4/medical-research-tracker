// Normalizes genomic report payloads from multiple vendors into a generic MRT shape.

const KNOWN_SOURCE_HINTS = {
  foundationone: ['foundation', 'foundationone', 'f1'],
  tempus: ['tempus'],
  caris: ['caris'],
  guardant: ['guardant'],
};

function detectSource(rawText = '') {
  const t = rawText.toLowerCase();
  for (const [source, hints] of Object.entries(KNOWN_SOURCE_HINTS)) {
    if (hints.some((h) => t.includes(h))) return source;
  }
  return 'unknown';
}

export function normalizeGenomicReport({ rawText = '', patient = {}, metadata = {} }) {
  const source = metadata.source || detectSource(rawText);

  // Lightweight extraction placeholders; can be replaced with structured parser per vendor.
  const genes = extractGeneMentions(rawText);
  const biomarkers = extractBiomarkers(rawText);

  return {
    schemaVersion: '1.0',
    source,
    reportDate: metadata.reportDate || null,
    patient: {
      id: patient.id || null,
      diagnosis: patient.diagnosis || null,
      cancerProfileId: patient.cancerProfileId || null,
    },
    alterations: genes.map((g) => ({
      gene: g,
      alteration: 'mentioned',
      pathogenicity: 'unknown',
    })),
    biomarkers,
    raw: {
      length: rawText.length,
    },
  };
}

function extractGeneMentions(text = '') {
  const GENE_RE = /\b([A-Z0-9]{3,10})\b/g;
  const allow = new Set([
    'ARID1A','CDKN1A','MLL2','KMT2D','TERT','FGFR3','PIK3CA','ERBB2','NECTIN4','PDL1','TMB','MSI',
    'BRCA1','BRCA2','ESR1','EGFR','ALK','ROS1','BRAF','KRAS','NRAS','MET','RET'
  ]);
  const out = new Set();
  let m;
  while ((m = GENE_RE.exec(text)) !== null) {
    if (allow.has(m[1])) out.add(m[1]);
  }
  return Array.from(out);
}

function extractBiomarkers(text = '') {
  const t = text.toLowerCase();
  return {
    pdl1: t.includes('pd-l1') || t.includes('pdl1') ? 'mentioned' : null,
    tmb: t.includes('tumor mutational burden') || t.includes('tmb') ? 'mentioned' : null,
    msi: t.includes('microsatellite') || t.includes('msi') ? 'mentioned' : null,
    ctdna: t.includes('ctdna') || t.includes('signatera') ? 'mentioned' : null,
  };
}
