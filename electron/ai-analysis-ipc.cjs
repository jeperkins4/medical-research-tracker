/**
 * AI Analysis IPC — Healthcare Summary & Meal Analysis
 *
 * Provides AI-powered analysis features for the packaged Electron app without
 * requiring the Express HTTP server.  Uses the Anthropic API directly via Node
 * https (same pattern as medical-doc-parser.cjs — no SDK required).
 */

'use strict';

const https = require('https');
const db    = require('./db-ipc.cjs');

// ── Low-level Claude API call ─────────────────────────────────────────────

function callClaude(apiKey, system, userContent, model = 'claude-sonnet-4-6', maxTokens = 3000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Retry wrapper ─────────────────────────────────────────────────────────

async function callClaudeWithRetry(apiKey, system, content, model, maxTokens, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await callClaude(apiKey, system, content, model, maxTokens);
      return result;
    } catch (err) {
      if (attempt === retries) throw err;
      const backoff = 1000 * attempt;
      console.warn(`[ai-analysis-ipc] Claude attempt ${attempt} failed, retrying in ${backoff}ms:`, err.message);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// ── Healthcare Summary ────────────────────────────────────────────────────

/**
 * Gather all patient data from the IPC database (same as server/ai-summary.js
 * collectPatientData() but using db-ipc.cjs functions instead of db-secure.js).
 */
function collectPatientData() {
  const db_ = db._rawDb(); // see note below — we use a thin raw query helper
  if (!db_) return null;

  const run = (sql, params = []) => {
    try { return db_.prepare(sql).all(...params); } catch { return []; }
  };

  const profile      = db_.prepare('SELECT * FROM patient_profile WHERE id = 1').get() || {};
  const conditions   = run(`SELECT * FROM conditions WHERE status = 'active'`);
  const medications  = run(`SELECT * FROM medications WHERE stopped_date IS NULL OR stopped_date = '' ORDER BY started_date DESC`);
  const mutations    = run(`SELECT * FROM genomic_mutations`);
  const pathways     = run(`SELECT * FROM pathways`);
  const therapies    = run(`SELECT mt.*, gm.gene, gm.alteration FROM mutation_treatments mt JOIN genomic_mutations gm ON mt.mutation_id = gm.id WHERE mt.sensitivity_or_resistance = 'sensitivity'`);
  const vitals       = run(`SELECT * FROM vitals ORDER BY date DESC LIMIT 10`);
  const labs         = run(`SELECT * FROM test_results ORDER BY date DESC LIMIT 20`);
  const papers       = run(`SELECT * FROM papers ORDER BY saved_at DESC LIMIT 20`);

  return { profile, conditions, medications, mutations, pathways, therapies, vitals, labs, papers };
}

function buildSummaryPrompt(data) {
  const { profile, conditions, medications, mutations, pathways, therapies, vitals, labs, papers } = data;

  return `
## Patient Overview
Name: ${profile.name || 'John'}
Age: ${profile.age || 'N/A'}
Primary Diagnosis: ${conditions.map(c => c.name).join(', ') || 'Bladder cancer'}

## Active Genomic Mutations (${mutations.length})
${mutations.map(m => `- **${m.gene}** ${m.alteration} — ${m.clinical_significance || 'variant'}`).join('\n') || 'None recorded'}

## Affected Pathways (${pathways.length})
${pathways.map(p => `- ${p.name || p.pathway_name}`).join('\n') || 'None recorded'}

## Targeted Therapies / Sensitivities (${therapies.length})
${therapies.map(t => `- ${t.gene}/${t.alteration}: ${t.therapy_name || t.therapy}`).join('\n') || 'None recorded'}

## Current Medications & Supplements (${medications.length})
${medications.slice(0, 20).map(m => `- ${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('\n') || 'None recorded'}

## Recent Vitals
${vitals.slice(0, 5).map(v => `- ${v.date}: BP ${v.blood_pressure || '–'}, HR ${v.heart_rate || '–'}, Weight ${v.weight || '–'}`).join('\n') || 'None recorded'}

## Recent Lab Highlights
${labs.slice(0, 10).map(l => `- ${l.test_name}: ${l.value} ${l.unit || ''} (${l.date})`).join('\n') || 'None recorded'}

## Recent Research Papers (${papers.length})
${papers.slice(0, 10).map(p => `- ${p.title} (${p.year || ''})`).join('\n') || 'None recorded'}

---

Please synthesize this data into a comprehensive **Healthcare Strategy Summary** covering:
1. **Genomic Landscape** — key mutations and what they mean for treatment
2. **Treatment Alignment** — how current medications align with genomic profile
3. **Nutrition & Lifestyle** — evidence-based recommendations for this genomic profile
4. **Research Opportunities** — relevant trials or emerging therapies
5. **Monitoring Priorities** — what labs/vitals to watch closely
6. **Optimization Opportunities** — gaps or improvements in the current approach

Use ### headers for each section. Be specific, cite mutations by name (e.g., ARID1A, FGFR3, PIK3CA). Focus on actionable insights. Do NOT make prognosis predictions or give medical advice.
`.trim();
}

async function generateHealthcareSummary(apiKey) {
  if (!apiKey) {
    return { error: 'Anthropic API key not configured', message: 'Set ANTHROPIC_API_KEY in your .env file' };
  }

  const data = collectPatientData();
  if (!data) {
    return { error: 'Database not ready', message: 'Could not access patient data' };
  }

  const prompt = buildSummaryPrompt(data);
  const system = 'You are a medical research analyst specializing in precision oncology and integrative healthcare strategies. You synthesize complex genomic, clinical, and lifestyle data to identify optimization opportunities. You never make prognosis predictions or provide medical advice.';

  const resp = await callClaudeWithRetry(apiKey, system, prompt, 'claude-sonnet-4-6', 3000);
  const summary = resp.content?.[0]?.text || '';

  return {
    success:     true,
    summary,
    generatedAt: new Date().toISOString(),
    model:       'claude-sonnet-4-6',
    dataSnapshot: {
      mutationCount:  data.mutations.length,
      pathwayCount:   data.pathways.length,
      medicationCount: data.medications.length,
      paperCount:     data.papers.length,
    },
  };
}

// ── Meal Analysis ─────────────────────────────────────────────────────────

function buildMealPrompt(mealDescription, mealData, patientCtx) {
  const { diagnosis, mutations, pathways, medications } = patientCtx;

  return `You are a genomics-driven nutrition AI analyzing a meal for a ${diagnosis} patient.

**Confirmed Genomic Mutations:**
${mutations.map(m => `- ${m.gene} (${m.alteration}): ${m.clinical_significance || ''}`).join('\n') || 'None recorded'}

**Active Pathways:**
${pathways.map(p => `- ${p.name || p.pathway_name}`).join('\n') || 'None recorded'}

**Current Medications/Supplements:**
${medications.slice(0, 15).map(m => `- ${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('\n') || 'None recorded'}

**Treatment Phase:** ${mealData.treatment_phase || 'maintenance'}
**Energy Level After Meal:** ${mealData.energy_level || 'not reported'}/10
**Nausea Level:** ${mealData.nausea_level || 'not reported'}/10

---

**Meal to Analyze:**
"${mealDescription}"

---

Rate this meal (0-100) based on:
1. Genomic Support — foods that support active pathways?
2. Anti-Cancer Nutrition — anti-inflammatory, antioxidant-rich?
3. Treatment Phase Alignment — appropriate for ${mealData.treatment_phase || 'maintenance'}?
4. Nutrient Density — high-quality proteins, healthy fats, phytonutrients?
5. Tolerability — easy to digest, anti-nausea, energy-sustaining?

Respond in JSON format ONLY:
{
  "overall_score": <0-100>,
  "category_scores": {
    "genomic_support": <0-100>,
    "anti_cancer": <0-100>,
    "treatment_alignment": <0-100>,
    "nutrient_density": <0-100>,
    "tolerability": <0-100>
  },
  "strengths": ["<specific strength>"],
  "gaps": ["<specific gap>"],
  "recommendations": ["<specific addition>"],
  "pathway_support": ["<which pathways and which foods>"],
  "summary": "<2-3 sentence assessment>"
}`.trim();
}

async function analyzeMeal(apiKey, mealDescription, mealData = {}) {
  if (!apiKey) {
    return { error: 'Anthropic API key not configured', message: 'Set ANTHROPIC_API_KEY in your .env file' };
  }
  if (!mealDescription) {
    return { error: 'Meal description required' };
  }

  const db_ = db._rawDb();
  const run  = (sql, params = []) => { try { return db_.prepare(sql).all(...params); } catch { return []; } };

  const conditions  = run(`SELECT name FROM conditions WHERE status = 'active' LIMIT 1`);
  const mutations   = run(`SELECT gene, alteration, clinical_significance FROM genomic_mutations`);
  const pathways    = run(`SELECT DISTINCT name FROM pathways`);
  const medications = run(`SELECT name, dosage, frequency FROM medications WHERE stopped_date IS NULL ORDER BY started_date DESC LIMIT 15`);

  const patientCtx = {
    diagnosis:   conditions[0]?.name || 'cancer',
    mutations,
    pathways,
    medications,
  };

  const prompt = buildMealPrompt(mealDescription, mealData, patientCtx);
  const system = 'You are a genomics and nutrition expert specializing in precision oncology nutrition. Analyze meals for cancer patients based on their genomic profile and treatment phase. Be specific, evidence-based, and actionable. Always respond with valid JSON only.';

  const resp = await callClaudeWithRetry(apiKey, system, prompt, 'claude-sonnet-4-6', 2048);
  const text = resp.content?.[0]?.text || '{}';

  let analysis;
  try {
    analysis = JSON.parse(text);
  } catch {
    // Try to extract JSON from wrapped text
    const match = text.match(/\{[\s\S]*\}/);
    analysis = match ? JSON.parse(match[0]) : { error: 'Could not parse AI response' };
  }

  return {
    success:         true,
    analysis,
    meal:            mealDescription,
    treatment_phase: mealData.treatment_phase,
    model:           'claude-sonnet-4-6',
    timestamp:       new Date().toISOString(),
  };
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = { generateHealthcareSummary, analyzeMeal };
