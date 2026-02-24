/**
 * AI-powered genomic report parser
 * Supports both text-based and image-based (scanned) PDFs.
 *
 * Strategy:
 *   1. Try pdf-parse to extract text.
 *   2. If text is empty/minimal (image-only PDF), send the PDF directly
 *      to Claude as a base64 document — Claude reads it natively via vision.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');

// ── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical genomics expert analyzing molecular pathology reports.
Extract all genetic alterations from the report and return them as a JSON array.
Be thorough and precise. Include every mutation, alteration, biomarker, and genomic finding.`;

const JSON_SCHEMA = `Return a JSON array where each element has exactly these fields:
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
- For biomarkers like TMB-High, MSI-Stable: use mutation_type="Biomarker"
- For gene amplifications: mutation_type="Copy Number Alteration", mutation_detail="Amplification"
- If a field is not in the report, use null (not empty string)
- Return ONLY the JSON array, no markdown, no explanation, no code fences`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectReportSource(text) {
  if (/foundation\s*one/i.test(text)) return 'FoundationOne CDx';
  if (/tempus/i.test(text))           return 'Tempus xT';
  if (/caris/i.test(text))            return 'Caris MI Profile';
  if (/guardant/i.test(text))         return 'Guardant360';
  if (/msk\-impact/i.test(text))      return 'MSK-IMPACT';
  return null;
}

function normalizeMutations(mutations) {
  return mutations
    .map(m => ({
      gene:                  String(m.gene || '').trim(),
      mutation_type:         String(m.mutation_type || 'Short Variant').trim(),
      mutation_detail:       String(m.mutation_detail || '').trim(),
      vaf:                   (m.vaf != null && !isNaN(Number(m.vaf))) ? Number(m.vaf) : null,
      clinical_significance: String(m.clinical_significance || 'unknown').trim(),
      transcript_id:         m.transcript_id ? String(m.transcript_id).trim() : null,
      coding_effect:         m.coding_effect  ? String(m.coding_effect).trim()  : null,
      exon:                  m.exon           ? String(m.exon).trim()           : null,
      report_source:         m.report_source  ? String(m.report_source).trim()  : 'Unknown',
      report_date:           m.report_date    ? String(m.report_date).trim()    : null,
    }))
    .filter(m => m.gene);
}

function parseAIJson(aiText) {
  const clean = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ── Text-based PDF path ───────────────────────────────────────────────────────

async function parseWithText(client, rawText) {
  const textForAI = rawText.length > 12000
    ? rawText.substring(0, 12000) + '\n...[truncated]'
    : rawText;

  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages: [{
      role:    'user',
      content: `Analyze this genomic/molecular pathology report and extract ALL genetic findings.\n\n${JSON_SCHEMA}\n\nREPORT TEXT:\n${textForAI}`,
    }],
  });

  return parseAIJson(message.content[0]?.text || '');
}

// ── Image-based PDF path (send PDF directly to Claude) ────────────────────────

async function parseWithVision(client, pdfBuffer) {
  const base64 = pdfBuffer.toString('base64');

  console.log('[AI Parser] Image-based PDF detected — sending to Claude as document');

  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages: [{
      role:    'user',
      content: [
        {
          type:   'document',
          source: {
            type:       'base64',
            media_type: 'application/pdf',
            data:       base64,
          },
        },
        {
          type: 'text',
          text: `Extract ALL genetic findings from this genomic report PDF.\n\n${JSON_SCHEMA}`,
        },
      ],
    }],
    betas: ['pdfs-2024-09-25'],
  });

  return parseAIJson(message.content[0]?.text || '');
}

// ── Main export ───────────────────────────────────────────────────────────────

async function parseGenomicReportWithAI(pdfPath, apiKey) {
  const buffer = fs.readFileSync(pdfPath);
  const client = new Anthropic({ apiKey });

  let rawText = '';
  let mutations = [];

  // Step 1: Try to extract text
  try {
    const parsed = await pdfParse(buffer);
    rawText = parsed.text || '';
  } catch (e) {
    console.warn('[AI Parser] pdf-parse failed:', e.message);
  }

  // Step 2: Route based on whether we got usable text
  const hasText = rawText.trim().length > 100; // <100 chars = image-only or nearly empty

  if (hasText) {
    console.log(`[AI Parser] Text-based PDF (${rawText.length} chars) — using text path`);
    mutations = await parseWithText(client, rawText);
  } else {
    console.log('[AI Parser] No extractable text — using vision/document path');
    mutations = await parseWithVision(client, buffer);
    rawText = '(image-based PDF — text extracted by Claude vision)';
  }

  mutations = normalizeMutations(mutations);

  const reportSource = mutations[0]?.report_source
    || detectReportSource(rawText)
    || 'Genomic Report';

  return { mutations, rawText, reportSource };
}

module.exports = { parseGenomicReportWithAI };
