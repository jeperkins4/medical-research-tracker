/**
 * AI Meal Analyzer
 * 
 * Uses Claude (Anthropic) to analyze meals against genomic pathways, treatment phase, and nutrition goals
 */

import Anthropic from '@anthropic-ai/sdk';
import { query, run } from './db-secure.js';

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

/**
 * Get saved analysis for a meal
 */
export function getSavedAnalysis(mealId) {
  try {
    const results = query(`
      SELECT id, meal_id, analysis_data, model, analyzed_at
      FROM meal_analyses
      WHERE meal_id = ?
      ORDER BY analyzed_at DESC
      LIMIT 1
    `, [mealId]);
    
    if (results.length === 0) {
      return null;
    }
    
    const saved = results[0];
    return {
      ...JSON.parse(saved.analysis_data),
      saved: true,
      savedAt: saved.analyzed_at,
      analysisId: saved.id
    };
  } catch (error) {
    console.error('Error retrieving saved analysis:', error);
    return null;
  }
}

/**
 * Save analysis for a meal
 */
export function saveAnalysis(mealId, analysisData, model) {
  try {
    run(`
      INSERT INTO meal_analyses (meal_id, analysis_data, model)
      VALUES (?, ?, ?)
    `, [mealId, JSON.stringify(analysisData), model]);
    
    return true;
  } catch (error) {
    console.error('Error saving analysis:', error);
    return false;
  }
}

/**
 * Analyze a meal for genomic/nutritional quality
 */
export async function analyzeMeal(mealDescription, mealData = {}) {
  if (!anthropic) {
    return {
      error: 'Anthropic API key not configured',
      message: 'Set ANTHROPIC_API_KEY in .env to enable meal analysis'
    };
  }
  
  try {
    // Get user's genomic context
    const mutations = query(`
      SELECT gene, alteration, clinical_significance 
      FROM genomic_mutations
    `);
    
    const pathways = query(`
      SELECT DISTINCT gp.pathway_name, gp.pathway_category, gp.description
      FROM genomic_pathways gp
      JOIN mutation_pathway_map mpm ON gp.id = mpm.pathway_id
      JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
    `);
    
    const medications = query(`
      SELECT name, dosage, frequency, notes
      FROM medications
      WHERE stopped_date IS NULL
      ORDER BY started_date DESC
      LIMIT 15
    `);
    
    // Build analysis prompt
    const prompt = `You are a genomics-driven nutrition AI analyzing a meal for a bladder cancer patient.

**Patient Context:**

**Confirmed Genomic Mutations:**
${mutations.map(m => `- ${m.gene} (${m.alteration}): ${m.clinical_significance}`).join('\n')}

**Active Pathways (from mutations):**
${pathways.map(p => `- ${p.pathway_name} (${p.pathway_category}): ${p.description || 'pathway dysregulation'}`).join('\n')}

**Current Medications/Supplements:**
${medications.map(m => `- ${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('\n')}

**Treatment Phase:** ${mealData.treatment_phase || 'maintenance'}
**Energy Level After Meal:** ${mealData.energy_level || 'not reported'}/10
**Nausea Level:** ${mealData.nausea_level || 'not reported'}/10

---

**Meal to Analyze:**
"${mealDescription}"

---

**Analysis Task:**

Rate this meal (0-100) based on:
1. **Genomic Support** - Does it contain foods that support the active pathways?
2. **Anti-Cancer Nutrition** - Anti-inflammatory, antioxidant-rich, metabolically appropriate?
3. **Treatment Phase Alignment** - Appropriate for ${mealData.treatment_phase || 'maintenance'}?
4. **Nutrient Density** - High-quality proteins, healthy fats, phytonutrients?
5. **Tolerability** - Easy to digest, anti-nausea, energy-sustaining?

**Respond in JSON format:**
{
  "overall_score": <0-100>,
  "category_scores": {
    "genomic_support": <0-100>,
    "anti_cancer": <0-100>,
    "treatment_alignment": <0-100>,
    "nutrient_density": <0-100>,
    "tolerability": <0-100>
  },
  "strengths": [
    "Specific thing this meal does well (be specific about which foods/ingredients)"
  ],
  "gaps": [
    "Missing pathway support or nutrient (be specific)"
  ],
  "recommendations": [
    "Specific addition that would improve this meal (one food/ingredient at a time)"
  ],
  "pathway_support": [
    "Which pathways this meal supports and through which foods"
  ],
  "summary": "2-3 sentence overall assessment"
}

Be specific about which foods in the meal support which pathways. Reference the patient's mutations when relevant (e.g., "Turmeric supports ARID1A pathway through HIF-1α inhibition").`;

    // Call Claude (Anthropic)
    const systemPrompt = 'You are a genomics and nutrition expert specializing in precision oncology nutrition. Analyze meals for cancer patients based on their genomic profile and treatment phase. Be specific, evidence-based, and actionable. Always respond with valid JSON only.';
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    const analysis = JSON.parse(message.content[0].text);
    
    return {
      success: true,
      analysis,
      meal: mealDescription,
      treatment_phase: mealData.treatment_phase,
      model: 'claude-3-5-haiku-20241022',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Meal analysis error:', error);
    return {
      error: 'Analysis failed',
      message: error.message
    };
  }
}

/**
 * Get quick meal suggestions based on missing pathway coverage
 */
export async function getMealSuggestions(treatmentPhase = 'maintenance') {
  if (!anthropic) {
    return {
      error: 'Anthropic API key not configured'
    };
  }
  
  try {
    const pathways = query(`
      SELECT DISTINCT gp.pathway_name, gp.pathway_category
      FROM genomic_pathways gp
      JOIN mutation_pathway_map mpm ON gp.id = mpm.pathway_id
      JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
    `);
    
    const prompt = `Generate 3 meal ideas for a bladder cancer patient in ${treatmentPhase} phase.

**Active Pathways to Support:**
${pathways.map(p => `- ${p.pathway_name}`).join('\n')}

**Requirements:**
- Support multiple pathways
- Anti-inflammatory, anti-cancer foods
- ${treatmentPhase === 'chemo_week' ? 'Easy to digest, anti-nausea, gentle on stomach' : 'Nutrient-dense, energy-sustaining'}
- Realistic, easy to prepare

**Respond in JSON:**
{
  "meals": [
    {
      "name": "Meal name",
      "description": "Full meal description",
      "pathways_supported": ["pathway1", "pathway2"],
      "key_ingredients": ["ingredient1 (benefit)", "ingredient2 (benefit)"],
      "prep_time": "15 min"
    }
  ]
}`;

    const systemPrompt = 'You are a genomics-driven nutrition expert creating practical, science-backed meal plans for cancer patients. Always respond with valid JSON only.';
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      temperature: 0.8,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    const suggestions = JSON.parse(message.content[0].text);
    
    return {
      success: true,
      suggestions,
      treatment_phase: treatmentPhase
    };
    
  } catch (error) {
    console.error('Meal suggestions error:', error);
    return {
      error: 'Suggestions failed',
      message: error.message
    };
  }
}
