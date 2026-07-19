/**
 * Scanner Search Domain Configuration
 * ===================================
 *
 * This module defines WHAT the research scanners search for and how they
 * score relevance. The defaults below are intentionally GENERIC oncology
 * terms -- they contain NO specific cancer type, NO specific gene names,
 * and NO specific brand-name drugs.
 *
 * >>> CUSTOMIZE THIS FOR YOUR OWN DIAGNOSIS <<<
 *
 * You do NOT need to edit code to do so. Set the following environment
 * variables to JSON strings and they will override the defaults:
 *
 *   SCANNER_SEARCH_TERMS  -- JSON object, same shape as SEARCH_TERMS below
 *                            (category keys -> array of search-term strings)
 *   SCANNER_CONDITIONS    -- JSON array of condition strings used for
 *                            relevance scoring (JSON array of strings)
 *
 * Example (in your .env or shell):
 *   SCANNER_CONDITIONS='["<your cancer type>","<your histology>"]'
 *
 * If an env var is unset or is not valid JSON, the generic defaults apply.
 */

// Generic oncology search terms, keyed by category.
// Categories match those consumed by the scanners (the enhanced scanner uses
// all of these; the basic scanner uses a subset -- extra keys are harmless).
const DEFAULT_SEARCH_TERMS = {
  // Current Conventional Treatments
  conventional: [
    'immunotherapy checkpoint inhibitor advanced cancer',
    'antibody-drug conjugate solid tumor',
    'chemotherapy combination advanced cancer',
  ],

  // Pipeline Drugs (Experimental)
  pipeline: [
    'antibody-drug conjugate solid tumor trial',
    'targeted therapy advanced cancer pipeline',
    'novel investigational oncology drug trial',
  ],

  // Integrative/Alternative Treatments
  integrative: [
    'low dose naltrexone cancer',
    'IV vitamin C cancer',
    'fenbendazole cancer clinical',
    'ivermectin cancer research',
    'methylene blue cancer mitochondrial',
    'curcumin cancer',
  ],

  // Clinical Trials
  trials: [
    'clinical trial recruiting advanced solid tumor',
    'immunotherapy trial phase 2 solid tumor',
    'targeted therapy trial enrollment cancer',
    'advanced cancer new treatment trial',
  ],

  // Genomics & Biomarkers
  genomics: [
    'tumor mutational burden biomarker',
    'genomic mutation targeted cancer therapy',
    'PD-L1 expression biomarker cancer',
    'next-generation sequencing cancer treatment',
  ],

  // Mechanisms & Pathways
  research: [
    'angiogenesis inhibition cancer',
    'hypoxia HIF-1 pathway cancer',
    'immune checkpoint pathway cancer',
    'autophagy cancer treatment',
  ],

  // Specialist / expert oncology resource
  guoncology: [
    'oncology clinical trial advanced cancer',
    'immunotherapy advanced cancer expert review',
    'targeted therapy solid tumor guidelines',
  ],
};

// Generic condition terms used to boost relevance scoring.
const DEFAULT_CONDITIONS = ['cancer', 'carcinoma', 'oncology', 'tumor'];

// Read an env var as JSON, falling back to the provided default on
// absence or parse error.
function fromEnvJson(envValue, fallback, label) {
  if (!envValue) return fallback;
  try {
    return JSON.parse(envValue);
  } catch (err) {
    console.warn(`⚠ Could not parse ${label} as JSON; using defaults. (${err.message})`);
    return fallback;
  }
}

const SEARCH_TERMS = fromEnvJson(
  process.env.SCANNER_SEARCH_TERMS,
  DEFAULT_SEARCH_TERMS,
  'SCANNER_SEARCH_TERMS'
);

const RELEVANCE_CONDITIONS = fromEnvJson(
  process.env.SCANNER_CONDITIONS,
  DEFAULT_CONDITIONS,
  'SCANNER_CONDITIONS'
);

export { SEARCH_TERMS, RELEVANCE_CONDITIONS };
