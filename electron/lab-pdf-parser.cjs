/**
 * Lab PDF Parser — powered by Claude
 * Extracts CMP, CBC, Lipid Panel, Thyroid, and other lab values from PDF reports.
 * Uses the same vision API approach as ai-genomics-parser.cjs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Panel detection ────────────────────────────────────────────────────────
const PANEL_TESTS = {
  CMP: ['glucose', 'bun', 'creatinine', 'egfr', 'sodium', 'potassium', 'chloride',
        'co2', 'carbon dioxide', 'calcium', 'total protein', 'albumin', 'globulin',
        'bilirubin', 'alk phos', 'alkaline phosphatase', 'ast', 'alt', 'a/g ratio',
        'bun/creatinine', 'anion gap'],
  CBC:  ['wbc', 'rbc', 'hemoglobin', 'hgb', 'hematocrit', 'hct', 'mcv', 'mch', 'mchc',
        'rdw', 'platelets', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils',
        'basophils', 'absolute neutrophil'],
  Lipid: ['total cholesterol', 'ldl', 'hdl', 'triglycerides', 'vldl', 'non-hdl'],
  Thyroid: ['tsh', 'free t4', 'free t3', 't3', 't4', 'thyroid'],
  Tumor: ['psa', 'cea', 'ca 125', 'ca 19-9', 'afp', 'ldh', 'urine cytology'],
  Kidney: ['egfr', 'creatinine', 'bun', 'uric acid', 'phosphorus', 'magnesium'],
  HbA1c: ['hba1c', 'hemoglobin a1c', 'a1c', 'estimated average glucose'],
};

function detectPanel(testName) {
  const lower = testName.toLowerCase();
  for (const [panel, tests] of Object.entries(PANEL_TESTS)) {
    if (tests.some(t => lower.includes(t))) return panel;
  }
  return 'General';
}

// ── Numeric extraction ─────────────────────────────────────────────────────
function parseNumeric(value) {
  if (!value) return null;
  const match = String(value).match(/^[<>]?\s*([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function parseFlag(flagStr, value, low, high) {
  if (!flagStr) {
    // Derive from value vs range
    const v = parseNumeric(value);
    const l = parseNumeric(low);
    const h = parseNumeric(high);
    if (v != null && h != null && v > h) return 'high';
    if (v != null && l != null && v < l) return 'low';
    return 'normal';
  }
  const f = String(flagStr).toLowerCase();
  if (f.includes('h') || f.includes('high') || f.includes('>')) return 'high';
  if (f.includes('l') || f.includes('low') || f.includes('<')) return 'low';
  if (f.includes('crit') || f.includes('panic')) return 'critical';
  return 'normal';
}

// ── Claude API call ────────────────────────────────────────────────────────

function callClaude(apiKey, messages, model = 'claude-opus-4-5') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch (e) {
          reject(new Error('Claude API JSON parse failed: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Claude API timeout')); });
    req.write(body);
    req.end();
  });
}

async function extractTextFromPDF(filePath) {
  // Primary: pdf-parse (pure Node.js — works in packaged Electron app with no Python)
  // Use the library path directly to avoid the known test-file require bug
  try {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    if (result.text && result.text.trim().length > 50) {
      console.log('[LabParser] pdf-parse extracted', result.text.length, 'chars');
      return { method: 'text', text: result.text };
    }
  } catch (e) {
    console.log('[LabParser] pdf-parse failed:', e.message);
    // Fallback: try top-level pdf-parse
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const result = await pdfParse(buffer);
      if (result.text && result.text.trim().length > 50) {
        return { method: 'text', text: result.text };
      }
    } catch (e2) {
      console.log('[LabParser] pdf-parse (fallback) failed:', e2.message);
    }
  }

  // Secondary: pdfplumber via Python venv (better table extraction when available)
  try {
    const { execSync } = require('child_process');
    const venvPython = path.join(require('os').homedir(), '.openclaw/workspace/.venv/bin/python3');
    const tmpScript = path.join(require('os').tmpdir(), 'lab_extract.py');
    fs.writeFileSync(tmpScript, `
import pdfplumber, sys
with pdfplumber.open(sys.argv[1]) as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        if text: print(text)
`);
    const text = execSync(`"${venvPython}" "${tmpScript}" "${filePath}"`, {
      timeout: 30000, maxBuffer: 1024 * 1024 * 10
    }).toString();
    if (text && text.trim().length > 50) {
      console.log('[LabParser] pdfplumber extracted', text.length, 'chars');
      return { method: 'text', text };
    }
  } catch (e) {
    console.log('[LabParser] pdfplumber failed, falling back to document API:', e.message);
  }

  // Fallback: Claude's document API (supports PDF natively — NOT the image endpoint)
  return { method: 'document', data: fs.readFileSync(filePath).toString('base64') };
}

// ── Main export ────────────────────────────────────────────────────────────

async function parseLabReportWithAI(filePath, apiKey) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const extracted = await extractTextFromPDF(filePath);
  const fileName = path.basename(filePath);

  const systemPrompt = `You are a medical lab report parser. Extract ALL laboratory test results from the provided lab report into structured JSON.

Output ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "report_date": "YYYY-MM-DD",
  "provider": "Lab name or ordering provider",
  "patient_name": "Patient name if visible",
  "panels": ["CMP", "CBC"],
  "results": [
    {
      "test_name": "Glucose",
      "value": "95",
      "unit": "mg/dL",
      "normal_low": "70",
      "normal_high": "100",
      "flag": "normal",
      "panel": "CMP"
    }
  ]
}

Rules:
- Include ALL tests, even normal ones
- flag must be: "normal", "high", "low", or "critical"
- Extract normal ranges (e.g., "70-100" → normal_low: "70", normal_high: "100")
- report_date from the specimen/collection date, not ordering date
- panel: detect based on test type (CMP, CBC, Lipid, Thyroid, Tumor, General)
- For "<" or ">" values, include the full string in value (e.g., "<0.5")`;

  // Route to text or document API based on extraction result
  if (extracted.method === 'text') {
    // Text path: send extracted text directly
    const response = await callClaude(apiKey, [
      { role: 'user', content: systemPrompt + '\n\nFile: ' + fileName + '\n\n' + extracted.text.slice(0, 15000) }
    ]);
    return processClaudeResponse(response, filePath);
  } else {
    // Document path: use Claude's native PDF document support (type: document, NOT type: image)
    const response = await callClaude(apiKey, [
      { role: 'user', content: systemPrompt },
      { role: 'assistant', content: 'Understood. Please provide the lab report PDF.' },
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: extracted.data }
          },
          { type: 'text', text: `Parse this lab report. File: ${fileName}` }
        ]
      }
    ]);
    return processClaudeResponse(response, filePath);
  }
}

function processClaudeResponse(response, filePath) {
  const text = response?.content?.[0]?.text || '';

  // Extract JSON from response
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Claude response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e.message}\n\nResponse: ${text.slice(0, 500)}`);
  }

  const results = (parsed.results || []).map(r => {
    const flag = parseFlag(r.flag, r.value, r.normal_low, r.normal_high);
    const panel = r.panel || detectPanel(r.test_name);
    return {
      test_name:     r.test_name || 'Unknown',
      result:        r.value != null ? String(r.value) : '',
      value_numeric: parseNumeric(r.value),
      unit:          r.unit || '',
      normal_low:    r.normal_low || '',
      normal_high:   r.normal_high || '',
      flag,
      panel_name:    panel,
      date:          parsed.report_date || new Date().toISOString().split('T')[0],
      provider:      parsed.provider || '',
      notes:         '',
    };
  });

  return {
    report_date:  parsed.report_date,
    provider:     parsed.provider,
    patient_name: parsed.patient_name,
    panels:       parsed.panels || [...new Set(results.map(r => r.panel_name))],
    results,
    resultCount:  results.length,
    abnormalCount: results.filter(r => r.flag !== 'normal').length,
  };
}

module.exports = { parseLabReportWithAI };
