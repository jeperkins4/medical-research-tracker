/**
 * AI-powered genomic report parser
 * Uploads PDF text to Claude, gets back structured mutation data.
 * Works with Foundation One CDx, Tempus, Caris, Guardant, and any other format.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// pdf-parse v1.1.1 — exports a function directly
const pdfParse = require('pdf-parse');

// Anthropic SDK (already installed)
const Anthropic = require('@anthropic-ai/sdk');

// ── Claude prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical genomics expert analyzing molecular pathology reports.
Extract all genetic alterations from the report text provided and return them as a JSON array.
Be thorough and precise. Include every mutation, alteration, biomarker, and genomic finding.`;

const USER_PROMPT_TEMPLATE = (reportText) => `Analyze this genomic/molecular pathology report and extract ALL genetic findings.

Return a JSON array where each element has exactly these fields:
{
  "gene": "gene name (e.g. ARID1A, TP53, KRAS, FGFR3)",
  "mutation_type": "one of: Short Variant, Copy Number Alteration, Rearrangement, Biomarker",
  "mutation_detail": "specific alteration (e.g. p.Q456*, Exon 2 deletion, Amplification, TMB-High)",
  "vaf": null or a number (variant allele frequency as percentage, e.g. 35.2),
  "clinical_significance": "one of: pathogenic, likely pathogenic, VUS, likely benign, benign, unknown",
  "transcript_id": null or string (e.g. "NM_006015.5"),
  "coding_effect": null or string (e.g. "nonsense", "missense", "frameshift", "splice site", "amplification"),
  "exon": null or string (e.g. "7"),
  "report_source": "the lab/test name from the report (e.g. FoundationOne CDx, Tempus, Caris)",
  "report_date": null or "YYYY-MM-DD format date from the report"
}

Rules:
- Include ALL variants: short variants, CNAs, rearrangements, fusions, biomarkers (TMB, MSI, LOH)
- For biomarkers like TMB-High, MSI-Stable, LOH-High: use mutation_type="Biomarker"
- For gene amplifications: use mutation_type="Copy Number Alteration", mutation_detail="Amplification"
- If a field is not present in the report, use null (not empty string)
- Return ONLY the JSON array, no markdown, no explanation, no code fences

REPORT TEXT:
${reportText}`;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a genomic report PDF using AI.
 * @param {string} pdfPath  Absolute path to the PDF file
 * @param {string} apiKey   Anthropic API key
 * @returns {Promise<{ mutations: Array, rawText: string, reportSource: string }>}
 */
async function parseGenomicReportWithAI(pdfPath, apiKey) {
  // 1. Extract text from PDF
  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(buffer);
  const rawText = parsed.text || '';

  if (!rawText.trim()) {
    throw new Error('Could not extract text from PDF. The file may be image-only or corrupted.');
  }

  // 2. Call Claude
  const client = new Anthropic({ apiKey });

  // Limit text to ~12,000 chars to stay well within context limits
  const textForAI = rawText.length > 12000
    ? rawText.substring(0, 12000) + '\n...[truncated]'
    : rawText;

  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role:    'user',
        content: USER_PROMPT_TEMPLATE(textForAI),
      }
    ],
    system: SYSTEM_PROMPT,
  });

  const aiResponse = message.content[0]?.text || '';

  // 3. Parse the JSON response
  let mutations = [];
  try {
    // Strip any accidental markdown fences
    const clean = aiResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    mutations = JSON.parse(clean);
    if (!Array.isArray(mutations)) {
      mutations = [mutations]; // wrap object in array just in case
    }
  } catch (parseErr) {
    console.error('[AI Parser] Failed to parse AI response as JSON:', aiResponse.substring(0, 500));
    throw new Error(`AI returned invalid JSON: ${parseErr.message}`);
  }

  // 4. Normalise fields — ensure consistent types
  mutations = mutations.map(m => ({
    gene:                 String(m.gene || '').trim(),
    mutation_type:        String(m.mutation_type || 'Short Variant').trim(),
    mutation_detail:      String(m.mutation_detail || '').trim(),
    vaf:                  (m.vaf !== null && m.vaf !== undefined && !isNaN(Number(m.vaf)))
                            ? Number(m.vaf) : null,
    clinical_significance: String(m.clinical_significance || 'unknown').trim(),
    transcript_id:        m.transcript_id ? String(m.transcript_id).trim() : null,
    coding_effect:        m.coding_effect ? String(m.coding_effect).trim() : null,
    exon:                 m.exon ? String(m.exon).trim() : null,
    report_source:        m.report_source ? String(m.report_source).trim() : 'Unknown',
    report_date:          m.report_date ? String(m.report_date).trim() : null,
  })).filter(m => m.gene); // drop any entries with no gene name

  // Detect report source from first mutation or raw text
  const reportSource = mutations[0]?.report_source
    || detectReportSource(rawText)
    || 'Genomic Report';

  return { mutations, rawText, reportSource };
}

/**
 * Best-effort detect the report source from raw text
 */
function detectReportSource(text) {
  if (/foundation\s*one/i.test(text))  return 'FoundationOne CDx';
  if (/tempus/i.test(text))            return 'Tempus xT';
  if (/caris/i.test(text))             return 'Caris MI Profile';
  if (/guardant/i.test(text))          return 'Guardant360';
  if (/msk\-impact/i.test(text))       return 'MSK-IMPACT';
  return null;
}

module.exports = { parseGenomicReportWithAI };
