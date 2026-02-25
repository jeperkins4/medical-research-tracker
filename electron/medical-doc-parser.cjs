/**
 * Medical Document Parser — powered by Claude
 * Handles radiology reports and doctor's notes / clinical notes.
 * Parallel to lab-pdf-parser.cjs but for narrative clinical documents.
 */

const fs = require('fs');
const https = require('https');

// ── Claude API ────────────────────────────────────────────────────────────

function callClaude(apiKey, messages, model = 'claude-opus-4-5', usePdfBeta = false) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, max_tokens: 4096, messages });
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    // PDF document type requires beta header
    if (usePdfBeta) headers['anthropic-beta'] = 'pdfs-2024-09-25';

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          resolve({ ...parsed, _statusCode: res.statusCode });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Retry with exponential backoff ────────────────────────────────────────

async function callClaudeWithRetry(apiKey, messages, model, usePdfBeta, maxRetries = 3) {
  const FALLBACK_MODEL = 'claude-haiku-4-5'; // lighter model as fallback
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // On last retry, switch to lighter model
    const tryModel = attempt === maxRetries ? FALLBACK_MODEL : model;
    try {
      const result = await callClaude(apiKey, messages, tryModel, usePdfBeta);
      return result;
    } catch (err) {
      lastError = err;
      const isOverloaded = err.message?.toLowerCase().includes('overload') ||
                           err.message?.toLowerCase().includes('529') ||
                           err.message?.toLowerCase().includes('rate limit') ||
                           err.message?.toLowerCase().includes('529');
      if (!isOverloaded || attempt === maxRetries) break;
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(`[MedDocParser] Overloaded (attempt ${attempt + 1}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── PDF → base64 images ───────────────────────────────────────────────────

function pdfToBase64Pages(filePath) {
  // Read raw bytes; send first 3 pages (Claude vision handles PDF via base64)
  const bytes = fs.readFileSync(filePath);
  return bytes.toString('base64');
}

// ── Prompts ────────────────────────────────────────────────────────────────

const PROMPTS = {
  radiology: `You are a medical AI assistant specializing in radiology report interpretation.
Extract ALL key information from this radiology report and return ONLY valid JSON with this exact structure:
{
  "document_type": "radiology",
  "date": "YYYY-MM-DD or null",
  "provider": "radiologist name or null",
  "facility": "imaging center/hospital name or null",
  "title": "study title (e.g. CT Abdomen/Pelvis with Contrast) or null",
  "modality": "CT | MRI | X-Ray | PET | Ultrasound | Nuclear Medicine | Other",
  "body_region": "body area scanned, e.g. Chest, Abdomen/Pelvis, Brain",
  "clinical_indication": "reason for study",
  "technique": "imaging technique/protocol used",
  "comparison": "prior studies compared if any, or null",
  "findings": "detailed findings section verbatim or summarized",
  "impression": "impression/conclusion section verbatim",
  "recommendations": ["list of follow-up recommendations if any"],
  "critical_findings": ["any urgent/critical findings flagged"],
  "summary": "1-2 sentence plain-language summary of what this study showed",
  "body_regions_affected": [
    {
      "region": "one of: head, neck, left-lung, right-lung, heart, liver, spleen, stomach, left-kidney, right-kidney, bladder, pelvis, spine, left-adrenal, right-adrenal, left-lymph-node, right-lymph-node, abdominal-lymph-nodes, left-shoulder, right-shoulder, left-arm, right-arm, left-hip, right-hip, left-leg, right-leg, peritoneum, soft-tissue",
      "finding": "brief description of what was found here (1 sentence max)",
      "type": "one of: metastasis | primary-tumor | mass | lymphadenopathy | inflammation | normal | suspicious | other",
      "size_mm": number or null
    }
  ]
}
body_regions_affected should list EVERY anatomical region specifically mentioned in the report, including normal findings. Use precise region names from the list above. Return ONLY the JSON. No markdown, no explanation.`,

  doctor_note: `You are a medical AI assistant specializing in clinical documentation.
Extract ALL key information from this doctor's note or clinical document and return ONLY valid JSON with this exact structure:
{
  "document_type": "doctor_note",
  "date": "YYYY-MM-DD or null",
  "provider": "doctor/provider name and credentials or null",
  "facility": "clinic/hospital name or null",
  "title": "visit type (e.g. Follow-up Visit, Consultation, Progress Note) or null",
  "note_type": "office_visit | consultation | referral | discharge | operative | pathology | other",
  "chief_complaint": "primary reason for visit",
  "diagnoses": ["list of diagnoses/problems addressed"],
  "medications_mentioned": ["medications discussed, changed, or prescribed"],
  "labs_ordered": ["any labs/tests ordered"],
  "imaging_ordered": ["any imaging ordered"],
  "treatment_plan": "treatment plan section verbatim or summarized",
  "follow_up": "follow-up instructions and timeline",
  "referrals": ["any specialist referrals"],
  "clinical_notes": "any other important clinical observations",
  "summary": "2-3 sentence plain-language summary of the visit and plan"
}
Return ONLY the JSON. No markdown, no explanation.`,
};

// ── Main export ────────────────────────────────────────────────────────────

async function parseMedicalDocumentWithAI(filePath, docType, apiKey) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const ext = filePath.toLowerCase().split('.').pop();
  const prompt = PROMPTS[docType];
  if (!prompt) throw new Error(`Unknown document type: ${docType}`);

  let content;

  let usePdfBeta = false;

  if (ext === 'pdf') {
    usePdfBeta = true;
    const b64 = pdfToBase64Pages(filePath);
    content = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: b64 },
      },
      { type: 'text', text: prompt },
    ];
  } else if (['jpg','jpeg','png','webp','gif'].includes(ext)) {
    const b64 = fs.readFileSync(filePath).toString('base64');
    const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
      { type: 'text', text: prompt },
    ];
  } else if (ext === 'txt' || ext === 'rtf') {
    const text = fs.readFileSync(filePath, 'utf8');
    content = [{ type: 'text', text: `${prompt}\n\nDOCUMENT TEXT:\n${text}` }];
  } else {
    throw new Error(`Unsupported file type: .${ext}. Supported: PDF, JPG, PNG, TXT`);
  }

  const response = await callClaudeWithRetry(apiKey, [{ role: 'user', content }], 'claude-opus-4-5', usePdfBeta);
  const rawText = response.content?.[0]?.text || '';

  // Extract JSON from response
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    ...parsed,
    file_name: require('path').basename(filePath),
    raw_text: rawText,
  };
}

module.exports = { parseMedicalDocumentWithAI };
