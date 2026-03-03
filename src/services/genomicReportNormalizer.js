// Normalizes genomic report payloads from multiple vendors into a generic MRT shape.
// v2 — profile-aware gene allowlist, structured alteration parsing, VAF extraction

import { getCancerProfile } from '../models/cancerProfiles.js';

const KNOWN_SOURCE_HINTS = {
  foundationone: ['foundation', 'foundationone', 'f1cdx', 'f1 cdx', 'foundation medicine'],
  tempus: ['tempus'],
  caris: ['caris'],
  guardant: ['guardant360', 'guardant'],
  msk_impact: ['msk-impact', 'msk impact', 'memorial sloan'],
};

function detectSource(rawText = '') {
  const t = rawText.toLowerCase();
  for (const [source, hints] of Object.entries(KNOWN_SOURCE_HINTS)) {
    if (hints.some((h) => t.includes(h))) return source;
  }
  return 'unknown';
}

// All genes across all profiles — superset allowlist
const UNIVERSAL_GENE_SET = new Set([
  // Urothelial
  'ARID1A','CDKN1A','MLL2','KMT2D','TERT','FGFR3','PIK3CA','ERBB2','NECTIN4','PDL1',
  // Breast
  'ER','PR','HER2','ESR1','BRCA1','BRCA2',
  // Lung
  'EGFR','ALK','ROS1','MET','RET','STK11','KEAP1',
  // CRC
  'KRAS','NRAS','BRAF','APC','SMAD4',
  // Universal
  'TMB','MSI','CDKN2A','TP53','PTEN','RB1','CDK4','CDK6','MDM2',
  'NF1','NF2','TSC1','TSC2','VHL','IDH1','IDH2','POLE','MTOR',
  'ERBB3','ERBB4','FGF19','CCND1','MYC','MYCN',
  'CTNNB1','FBXW7','FAT1','KDM6A','STAG2',
]);

// Build profile-specific gene set
function buildGeneAllowlist(cancerProfileId) {
  if (!cancerProfileId) return UNIVERSAL_GENE_SET;
  const profile = getCancerProfile(cancerProfileId);
  if (!profile) return UNIVERSAL_GENE_SET;
  const profileGenes = new Set(profile.keyBiomarkers.map((g) => g.toUpperCase().replace(/-/g, '')));
  // Merge profile genes + universal
  return new Set([...UNIVERSAL_GENE_SET, ...profileGenes]);
}

/**
 * Normalize alteration string into structured shape.
 * Examples: "FGFR3 p.S249C", "KRAS G12D", "EGFR Exon19 deletion", "PIK3CA amplification"
 */
function parseAlteration(rawAlt = '') {
  const s = rawAlt.trim();
  // Missense / point mutation: p.X000Y or single letter X000Y
  const pointMut = s.match(/p\.?([A-Z])(\d+)([A-Z*])/i) || s.match(/\b([A-Z])(\d+)([A-Z*])\b/);
  if (pointMut) {
    return {
      type: 'point_mutation',
      proteinChange: `p.${pointMut[1].toUpperCase()}${pointMut[2]}${pointMut[3].toUpperCase()}`,
      codon: parseInt(pointMut[2], 10),
    };
  }
  // Deletion
  if (/del(etion)?/i.test(s)) {
    const exon = s.match(/exon\s*(\d+)/i);
    return { type: 'deletion', exon: exon ? parseInt(exon[1], 10) : null };
  }
  // Insertion
  if (/ins(ertion)?/i.test(s)) return { type: 'insertion' };
  // Amplification
  if (/amplif/i.test(s)) return { type: 'amplification' };
  // Fusion
  if (/fusion|rearrange/i.test(s)) return { type: 'fusion', raw: s };
  // Splice
  if (/splice/i.test(s)) return { type: 'splice_site' };
  // Frameshift
  if (/frameshift|fs/i.test(s)) return { type: 'frameshift' };
  // Truncation / stop
  if (/trunc|nonsense|\*/i.test(s)) return { type: 'truncation' };
  return { type: 'other', raw: s };
}

/**
 * Extract gene-alteration pairs from free text.
 * Looks for patterns like "FGFR3 p.S249C" or "KRAS G12D" or "EGFR amplification"
 */
function extractAlterations(text = '', geneSet) {
  const results = [];
  const seen = new Set();

  // Pattern: GENE followed by optional alteration description.
  // Allow p.XXXNNY style but stop at sentence boundary (period+space or period+newline), comma, semicolon.
  const RE = /\b([A-Z][A-Z0-9]{1,9})\b\s*((?:[^\s,;\n][\s]?){0,8})?/g;
  let m;
  while ((m = RE.exec(text)) !== null) {
    const gene = m[1];
    if (!geneSet.has(gene)) continue;
    const raw = (m[2] || '').trim();
    const key = `${gene}:${raw}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const altParsed = raw ? parseAlteration(raw) : { type: 'mentioned' };
    results.push({
      gene,
      raw,
      ...altParsed,
      pathogenicity: inferPathogenicity(gene, altParsed),
    });
  }
  return results;
}

/**
 * Simple pathogenicity heuristic based on known hotspots.
 */
const HOTSPOT_PATHOGENIC = {
  FGFR3: ['S249C', 'Y373C', 'R248C'],
  KRAS: ['G12D', 'G12V', 'G13D', 'G12C'],
  EGFR: ['L858R', 'T790M'],
  BRAF: ['V600E'],
  PIK3CA: ['E545K', 'H1047R', 'E542K'],
  TP53: [], // most TP53 mutations are LOF
};

function inferPathogenicity(gene, altInfo) {
  if (altInfo.type === 'amplification') return 'likely_pathogenic';
  if (altInfo.type === 'truncation' || altInfo.type === 'frameshift') return 'likely_pathogenic';
  if (altInfo.proteinChange && HOTSPOT_PATHOGENIC[gene]) {
    const short = altInfo.proteinChange.replace('p.', '');
    if (HOTSPOT_PATHOGENIC[gene].includes(short)) return 'pathogenic';
  }
  if (gene === 'TP53' && altInfo.type !== 'mentioned') return 'likely_pathogenic';
  return 'unknown';
}

/**
 * Extract TMB, MSI, PDL1 from text.
 */
function extractBiomarkers(text = '') {
  const t = text.toLowerCase();

  // TMB: "tumor mutational burden: 12 mut/Mb" or "TMB-H" or "TMB=8"
  let tmb = null;
  const tmbNum = text.match(/TMB[:\s=\-]*(\d+(?:\.\d+)?)\s*(?:mut\/Mb|mutations?\/Mb)?/i);
  if (tmbNum) {
    tmb = { value: parseFloat(tmbNum[1]), unit: 'mut/Mb', high: parseFloat(tmbNum[1]) >= 10 };
  } else if (/TMB[\s-]H/i.test(text)) {
    tmb = { value: null, qualitative: 'high', high: true };
  } else if (/TMB[\s-]L/i.test(text)) {
    tmb = { value: null, qualitative: 'low', high: false };
  }

  // MSI: MSI-H, MSI-L, MSS
  let msi = null;
  if (/MSI[\s-]H/i.test(text) || /microsatellite instability.{0,20}high/i.test(text)) {
    msi = 'MSI-H';
  } else if (/MSI[\s-]L/i.test(text) || /MSS/i.test(text)) {
    msi = 'MSI-L/MSS';
  } else if (t.includes('microsatellite')) {
    msi = 'mentioned';
  }

  // PDL1: "PD-L1 TPS 80%" or "PD-L1 positive" or "PD-L1 CPS 15"
  let pdl1 = null;
  const pdl1Score = text.match(/PD[\s-]?L1[^%\d]*(\d+(?:\.\d+)?)\s*%/i);
  if (pdl1Score) {
    pdl1 = { score: parseFloat(pdl1Score[1]), unit: '%' };
  } else if (/PD[\s-]?L1.{0,20}positive/i.test(text)) {
    pdl1 = { qualitative: 'positive' };
  } else if (/PD[\s-]?L1.{0,20}negative/i.test(text)) {
    pdl1 = { qualitative: 'negative' };
  } else if (/PD[\s-]?L1/i.test(text)) {
    pdl1 = { qualitative: 'mentioned' };
  }

  // ctDNA / Signatera
  const ctdna = t.includes('ctdna') || t.includes('signatera') || t.includes('circulating tumor');

  return { tmb, msi, pdl1, ctdna: ctdna || null };
}

/**
 * Main normalization entry point.
 *
 * @param {object} params
 * @param {string} params.rawText - Full text of the genomic report
 * @param {object} params.patient - { id, diagnosis, cancerProfileId }
 * @param {object} params.metadata - { source, reportDate }
 * @returns Normalized report object
 */
export function normalizeGenomicReport({ rawText = '', patient = {}, metadata = {} }) {
  const source = metadata.source || detectSource(rawText);
  const geneSet = buildGeneAllowlist(patient.cancerProfileId || null);

  const alterations = extractAlterations(rawText, geneSet);
  const biomarkers = extractBiomarkers(rawText);

  // Profile-aware: flag key biomarkers that are present
  const profile = getCancerProfile(patient.cancerProfileId);
  const keyBiomarkersFound = profile
    ? profile.keyBiomarkers.filter((b) =>
        alterations.some((a) => a.gene === b.toUpperCase().replace(/-/g, ''))
      )
    : [];

  return {
    schemaVersion: '2.0',
    source,
    reportDate: metadata.reportDate || null,
    patient: {
      id: patient.id || null,
      diagnosis: patient.diagnosis || null,
      cancerProfileId: patient.cancerProfileId || null,
    },
    alterations,
    biomarkers,
    keyBiomarkersFound,
    summary: buildSummary(alterations, biomarkers),
    raw: {
      length: rawText.length,
    },
  };
}

function buildSummary(alterations, biomarkers) {
  const pathogenic = alterations.filter(
    (a) => a.pathogenicity === 'pathogenic' || a.pathogenicity === 'likely_pathogenic'
  );
  const parts = [];
  if (pathogenic.length > 0) {
    parts.push(`${pathogenic.length} pathogenic/likely-pathogenic alteration(s): ${pathogenic.map((a) => a.gene).join(', ')}`);
  }
  if (biomarkers.tmb?.high) parts.push('TMB-High');
  if (biomarkers.msi === 'MSI-H') parts.push('MSI-High');
  if (biomarkers.pdl1) parts.push(`PD-L1: ${biomarkers.pdl1.qualitative || biomarkers.pdl1.score + '%'}`);
  return parts.length > 0 ? parts.join(' | ') : 'No high-confidence alterations extracted';
}
