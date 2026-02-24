/**
 * Foundation One CDx Report Parser
 * Extracts genomic mutations, copy number alterations, and biomarkers
 * from FoundationOne CDx PDF reports (Foundation Medicine standard format).
 */

// Use lib path directly — avoids pdf-parse loading test fixtures at require time
// (a known issue in packaged Electron apps that causes "pdfParse is not a function")
let pdfParse;
try {
  pdfParse = require('pdf-parse/lib/pdf-parse.js');
} catch {
  const raw = require('pdf-parse');
  pdfParse = (typeof raw === 'function') ? raw : (raw.default || raw);
}
const fs = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize whitespace / newlines from PDF text extraction
 */
function clean(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extract the report date from header text
 */
function extractReportDate(text) {
  const patterns = [
    /Report\s+Date[:\s]+(\w+ \d{1,2},\s*\d{4})/i,
    /Date\s+of\s+Report[:\s]+(\w+ \d{1,2},\s*\d{4})/i,
    /Reported[:\s]+(\w+ \d{1,2},\s*\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      try {
        const d = new Date(m[1]);
        if (!isNaN(d)) return d.toISOString().split('T')[0];
      } catch {
        return m[1];
      }
    }
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse VAF value from string like "35%" or "35.0" or "35.0%"
 */
function parseVAF(str) {
  if (!str) return null;
  const m = str.toString().match(/([\d.]+)\s*%?/);
  return m ? parseFloat(m[1]) : null;
}

// ── Short Variant (SNV / indel) extraction ────────────────────────────────────

const KNOWN_GENES = new Set([
  'ABL1','AKT1','AKT2','AKT3','ALK','APC','AR','ARAF','ARID1A','ARID1B','ARID2',
  'ATM','ATR','AXIN1','AXIN2','BAP1','BARD1','BCL2','BCL6','BCOR','BRCA1','BRCA2',
  'BRD4','BRIP1','CDH1','CDK12','CDK4','CDK6','CDKN1A','CDKN1B','CDKN2A','CDKN2B',
  'CHEK1','CHEK2','CREBBP','CTCF','CTNNB1','DDR2','DICER1','DNMT1','DNMT3A','DNMT3B',
  'EGFR','EP300','EPCAM','ERBB2','ERBB3','ERBB4','ESR1','EZH2','FANCA','FANCC',
  'FANCD2','FANCG','FANCL','FGF3','FGF4','FGFR1','FGFR2','FGFR3','FGFR4','FLT1',
  'FLT3','FLT4','FOXL2','GNA11','GNAQ','GNAS','HNF1A','HRAS','IDH1','IDH2','IGF1R',
  'JAK1','JAK2','JAK3','KDM5C','KDM6A','KIT','KRAS','MAP2K1','MAP2K2','MAP2K4',
  'MAPK1','MCL1','MDM2','MDM4','MET','MLH1','MLH3','MLL','MLL2','MLL3','MLL4',
  'MSH2','MSH6','MTOR','MYC','MYCN','NBN','NF1','NF2','NFE2L2','NOTCH1','NOTCH2',
  'NOTCH3','NOTCH4','NRAS','NTRK1','NTRK2','NTRK3','PALB2','PBRM1','PDGFRA','PDGFRB',
  'PIK3C2G','PIK3CA','PIK3CB','PIK3R1','PIK3R2','PMS2','POLE','PTEN','RAD51',
  'RAD51B','RAD51C','RAD51D','RAF1','RB1','RET','RICTOR','RNF43','ROS1','RUNX1',
  'SETD2','SF3B1','SMAD2','SMAD4','SMARCA4','SMARCB1','SMARCD1','SMO','SPOP',
  'SRC','STK11','TBX3','TERT','TET2','TMPRSS2','TP53','TSC1','TSC2','U2AF1',
  'VHL','WISP3','WT1','FBXW7','CCND1','CCND2','CCND3','CCNE1','CCNE2',
]);

function extractShortVariants(text) {
  const variants = [];

  // Foundation One lists short variants in a block like:
  //   GENE  alteration  transcript  cds  aa  VAF  type
  // We try multiple patterns

  // Pattern 1: gene followed by mutation notation on same/next line
  const variantPattern = /\b([A-Z][A-Z0-9]{1,8})\s+([A-Za-z0-9.*_>\- ()]+?)\s+(\d{1,2}\.?\d*)\s*%/g;
  let m;
  while ((m = variantPattern.exec(text)) !== null) {
    const gene = m[1];
    if (KNOWN_GENES.has(gene)) {
      const alteration = m[2].trim();
      const vaf = parseFloat(m[3]);
      if (!isNaN(vaf) && vaf > 0 && vaf <= 100 && alteration.length > 1) {
        variants.push({
          gene,
          mutation_type: 'Short Variant',
          mutation_detail: alteration,
          vaf,
          clinical_significance: 'unknown',
          report_source: 'FoundationOne CDx',
        });
      }
    }
  }

  // Pattern 2: known gene name on its own line (Foundation CDx table format)
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const geneMatch = line.match(/^([A-Z][A-Z0-9]{1,8})\s+(.+)$/);
    if (geneMatch && KNOWN_GENES.has(geneMatch[1])) {
      const gene = geneMatch[1];
      const rest = geneMatch[2];
      // Look for VAF in same line or next few lines
      const vafMatch = (rest + ' ' + (lines[i+1] || '') + ' ' + (lines[i+2] || ''))
        .match(/(\d{1,2}\.?\d*)\s*%/);
      if (vafMatch) {
        const vaf = parseFloat(vafMatch[1]);
        if (vaf > 0 && vaf <= 100) {
          // Check if this gene is already captured
          const alreadyHave = variants.some(v => v.gene === gene && Math.abs(v.vaf - vaf) < 1);
          if (!alreadyHave) {
            // Extract alteration from rest
            const altMatch = rest.match(/([pco]\.[A-Za-z0-9.*_>-]+|[A-Za-z0-9]+\s+[A-Za-z0-9*]+)/);
            variants.push({
              gene,
              mutation_type: 'Short Variant',
              mutation_detail: altMatch ? altMatch[0].trim() : rest.split(/\s+/).slice(0,2).join(' ').trim(),
              vaf,
              clinical_significance: 'unknown',
              report_source: 'FoundationOne CDx',
            });
          }
        }
      }
    }
  }

  return dedupeVariants(variants);
}

// ── Copy Number Alteration extraction ─────────────────────────────────────────

function extractCopyNumbers(text) {
  const cnas = [];

  // Patterns: "GENE  amplification", "GENE  copy number gain/loss"
  const cnaPattern = /\b([A-Z][A-Z0-9]{1,8})\s+(amplification|copy\s+number\s+gain|copy\s+number\s+loss|deletion|focal\s+deletion|focal\s+amplification)/gi;
  let m;
  while ((m = cnaPattern.exec(text)) !== null) {
    const gene = m[1].toUpperCase();
    if (KNOWN_GENES.has(gene)) {
      cnas.push({
        gene,
        mutation_type: 'Copy Number Alteration',
        mutation_detail: m[2].replace(/\s+/g, ' ').trim(),
        vaf: null,
        clinical_significance: 'unknown',
        report_source: 'FoundationOne CDx',
      });
    }
  }

  return dedupeVariants(cnas);
}

// ── Rearrangement extraction ──────────────────────────────────────────────────

function extractRearrangements(text) {
  const rearrangements = [];

  // Pattern: GENE1-GENE2 fusion or GENE rearrangement
  const fusionPattern = /\b([A-Z][A-Z0-9]{1,8})-([A-Z][A-Z0-9]{1,8})\s+(?:fusion|rearrangement)/gi;
  let m;
  while ((m = fusionPattern.exec(text)) !== null) {
    const gene1 = m[1].toUpperCase();
    const gene2 = m[2].toUpperCase();
    if (KNOWN_GENES.has(gene1) || KNOWN_GENES.has(gene2)) {
      rearrangements.push({
        gene: `${gene1}-${gene2}`,
        mutation_type: 'Rearrangement',
        mutation_detail: 'fusion',
        vaf: null,
        clinical_significance: 'unknown',
        report_source: 'FoundationOne CDx',
      });
    }
  }

  const rearrangePattern = /\b([A-Z][A-Z0-9]{1,8})\s+rearrangement/gi;
  while ((m = rearrangePattern.exec(text)) !== null) {
    const gene = m[1].toUpperCase();
    if (KNOWN_GENES.has(gene)) {
      rearrangements.push({
        gene,
        mutation_type: 'Rearrangement',
        mutation_detail: 'rearrangement',
        vaf: null,
        clinical_significance: 'unknown',
        report_source: 'FoundationOne CDx',
      });
    }
  }

  return dedupeVariants(rearrangements);
}

// ── Biomarker extraction (TMB, MSI, etc.) ────────────────────────────────────

function extractBiomarkers(text) {
  const biomarkers = [];

  // TMB: Tumor Mutational Burden
  const tmbMatch = text.match(/Tumor\s+Mutational\s+Burden[:\s]+(\d+\.?\d*)\s*Muts?\s*\/\s*Mb/i);
  if (tmbMatch) {
    const val = parseFloat(tmbMatch[1]);
    biomarkers.push({
      name: 'Tumor Mutational Burden (TMB)',
      value: `${val} Muts/Mb`,
      numeric_value: val,
      unit: 'Muts/Mb',
      status: val >= 10 ? 'TMB-High' : val >= 6 ? 'TMB-Intermediate' : 'TMB-Low',
    });
  }

  // MSI: Microsatellite Instability
  const msiMatch = text.match(/Microsatellite\s+(?:Instability|Status)[:\s]+(MSS|MSI-L|MSI-H|Microsatellite\s+(?:Stable|Unstable))/i);
  if (msiMatch) {
    biomarkers.push({
      name: 'Microsatellite Instability (MSI)',
      value: msiMatch[1],
      numeric_value: null,
      unit: null,
      status: msiMatch[1].toUpperCase().includes('HIGH') || msiMatch[1] === 'MSI-H' ? 'MSI-High' : 'MSS',
    });
  }

  // LOH: Loss of Heterozygosity (genomic)
  const lohMatch = text.match(/Genomic\s+Loss\s+of\s+Heterozygosity\s*[\(LOH\):\s]+(\d+\.?\d*)\s*%?/i);
  if (lohMatch) {
    const val = parseFloat(lohMatch[1]);
    biomarkers.push({
      name: 'Genomic Loss of Heterozygosity (LOH)',
      value: `${val}%`,
      numeric_value: val,
      unit: '%',
      status: val >= 16 ? 'High' : 'Low',
    });
  }

  return biomarkers;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function dedupeVariants(variants) {
  const seen = new Set();
  return variants.filter(v => {
    const key = `${v.gene}:${v.mutation_detail}:${v.mutation_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a Foundation One CDx PDF file.
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<{mutations: Array, biomarkers: Array, reportDate: string, rawText: string}>}
 */
async function parseFoundationOneReport(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer, { max: 0 }); // all pages
  const text = clean(data.text);

  const reportDate = extractReportDate(text);
  const shortVariants = extractShortVariants(text);
  const copyNumbers = extractCopyNumbers(text);
  const rearrangements = extractRearrangements(text);
  const biomarkers = extractBiomarkers(text);

  const allMutations = [...shortVariants, ...copyNumbers, ...rearrangements].map(m => ({
    ...m,
    report_date: reportDate,
  }));

  return {
    mutations: allMutations,
    biomarkers,
    reportDate,
    rawText: text.substring(0, 2000), // for debugging
  };
}

module.exports = { parseFoundationOneReport };
