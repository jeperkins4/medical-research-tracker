import OpenAI from 'openai';
import { query } from './db.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

/**
 * Collect all relevant patient data for AI analysis
 */
export async function collectPatientData() {
  // Profile
  const profile = query('SELECT * FROM patient_profile WHERE id = 1')[0] || {};
  
  // Conditions
  const conditions = query('SELECT * FROM conditions WHERE status = "active"');
  
  // Current medications/supplements
  const medications = query(`
    SELECT * FROM medications 
    WHERE stopped_date IS NULL OR stopped_date = ''
    ORDER BY started_date DESC
  `);
  
  // Genomic data
  const mutations = query('SELECT * FROM genomic_mutations');
  const pathways = query('SELECT * FROM pathways');
  const genomicTreatments = query(`
    SELECT mt.*, gm.gene, gm.alteration 
    FROM mutation_treatments mt
    JOIN genomic_mutations gm ON mt.mutation_id = gm.id
    WHERE mt.sensitivity_or_resistance = 'sensitivity'
  `);
  
  // Treatment correlations (Dr. Gildea's protocol)
  const treatmentCorrelations = query(`
    SELECT 
      tgc.*,
      m.name as medication_name,
      gm.gene,
      gm.alteration,
      p.name as pathway_name
    FROM treatment_genomic_correlation tgc
    LEFT JOIN medications m ON tgc.medication_id = m.id
    LEFT JOIN genomic_mutations gm ON tgc.mutation_id = gm.id
    LEFT JOIN pathways p ON tgc.pathway_id = p.id
  `);
  
  // Dietary habits
  const dietaryHabits = query('SELECT * FROM dietary_habits ORDER BY date DESC');
  
  // Recent research papers
  const papers = query(`
    SELECT p.*, GROUP_CONCAT(t.name) as tags
    FROM papers p
    LEFT JOIN paper_tags pt ON p.id = pt.paper_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    GROUP BY p.id
    ORDER BY p.saved_at DESC
    LIMIT 20
  `);
  
  // Recent vitals
  const vitals = query('SELECT * FROM vitals ORDER BY date DESC LIMIT 10');
  
  // Recent lab results
  const labs = query('SELECT * FROM test_results ORDER BY date DESC LIMIT 20');
  
  return {
    profile,
    conditions,
    medications,
    mutations,
    pathways,
    genomicTreatments,
    treatmentCorrelations,
    dietaryHabits,
    papers,
    vitals,
    labs
  };
}

/**
 * Build comprehensive prompt for AI summary
 */
function buildPrompt(data) {
  const { 
    profile, 
    conditions, 
    medications, 
    mutations, 
    pathways, 
    genomicTreatments,
    treatmentCorrelations,
    dietaryHabits,
    papers,
    vitals,
    labs
  } = data;
  
  return `You are a medical research analyst reviewing a comprehensive health strategy for a patient with cancer. Your goal is to synthesize the patient's multi-modal approach and identify opportunities for optimization.

## CRITICAL CONSTRAINTS
- DO NOT make predictions about lifespan, survival rates, or prognosis
- DO NOT provide medical advice or treatment recommendations
- Focus on: strategy synthesis, alignment analysis, gap identification, research opportunities
- Be precise, evidence-based, and reference specific data points

## PATIENT PROFILE
${profile.first_name ? `Name: ${profile.first_name} ${profile.last_name}` : 'Name: Not specified'}
${profile.date_of_birth ? `DOB: ${profile.date_of_birth}` : ''}
${profile.sex ? `Sex: ${profile.sex}` : ''}

## ACTIVE CONDITIONS
${conditions.map(c => `- ${c.name}${c.diagnosed_date ? ` (diagnosed ${c.diagnosed_date})` : ''}${c.notes ? `: ${c.notes}` : ''}`).join('\n')}

## GENOMIC PROFILE (Foundation One CDx)
### Confirmed Mutations
${mutations.map(m => `- ${m.gene} ${m.alteration} (VAF: ${m.variant_allele_frequency || 'N/A'}%)
  Clinical Significance: ${m.clinical_significance || 'Unknown'}
  ${m.functional_impact ? `Impact: ${m.functional_impact}` : ''}`).join('\n')}

### Affected Pathways
${pathways.map(p => `- ${p.name}: ${p.description || 'No description'}`).join('\n')}

### Genomic Treatment Opportunities
${genomicTreatments.slice(0, 10).map(t => `- ${t.drug_name} targeting ${t.gene} ${t.alteration}
  Evidence: ${t.clinical_evidence || 'Unknown'}
  ${t.mechanism ? `Mechanism: ${t.mechanism}` : ''}`).join('\n')}

## CURRENT TREATMENT PROTOCOL
### Medications & Supplements (${medications.length} active)
${medications.map(m => `- ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}
  ${m.reason ? `Reason: ${m.reason}` : ''}
  ${m.notes ? `Notes: ${m.notes}` : ''}`).join('\n')}

### Genomic Correlations (Dr. Gildea's Protocol)
${treatmentCorrelations.map(tc => `- ${tc.medication_name} → ${tc.gene || tc.pathway_name}
  Type: ${tc.correlation_type}
  Mechanism: ${tc.mechanism || 'Not specified'}
  Rationale: ${tc.rationale || 'Not specified'}`).join('\n')}

## DIETARY APPROACH
${dietaryHabits.map(dh => `[${dh.category}] ${dh.description}
${dh.notes ? `  → ${dh.notes}` : ''}`).join('\n')}

## RESEARCH LIBRARY (Recent ${papers.length})
${papers.map(p => `- "${p.title}"${p.journal ? ` (${p.journal})` : ''}
  ${p.tags ? `Tags: ${p.tags}` : 'No tags'}
  ${p.abstract ? `Abstract: ${p.abstract.substring(0, 200)}...` : ''}`).join('\n')}

## RECENT CLINICAL DATA
### Vitals (Last 10 readings)
${vitals.length > 0 ? vitals.slice(0, 3).map(v => `- ${v.date}: ${v.systolic ? `BP ${v.systolic}/${v.diastolic}` : ''}${v.heart_rate ? `, HR ${v.heart_rate}` : ''}${v.weight_lbs ? `, Wt ${v.weight_lbs} lbs` : ''}`).join('\n') : 'No vitals recorded'}

### Lab Results (Recent)
${labs.length > 0 ? labs.slice(0, 5).map(l => `- ${l.date}: ${l.test_name}${l.result ? ` = ${l.result}` : ''}`).join('\n') : 'No lab results recorded'}

## ANALYSIS TASK
Provide a structured healthcare strategy summary with these sections:

### 1. STRATEGY OVERVIEW
Synthesize the patient's current approach: genomic-targeted supplements, dietary modifications, research monitoring. Describe how these components work together.

### 2. ALIGNMENT ANALYSIS
How well do the current medications/supplements align with:
- Confirmed genomic mutations (ARID1A, CDKN1A, MLL2, TERT)
- Affected pathways (Hypoxia/HIF1, MDR, PD-L1, etc.)
- Dietary approach (anti-inflammatory, metabolic)

### 3. COVERAGE GAPS
Identify pathways or mutations that may be under-addressed by the current protocol. Are there known therapeutic targets not being pursued?

### 4. RESEARCH OPPORTUNITIES
Based on the patient's genomic profile and research interests, suggest specific search terms, clinical trial categories, or emerging treatment modalities worth investigating.

### 5. DATA QUALITY
Note any missing clinical data (vitals, labs, biomarkers) that would strengthen strategy optimization.

Keep the tone professional, evidence-based, and actionable. Use specific gene names, pathway names, and medication names from the data above.`;
}

/**
 * Generate AI healthcare strategy summary
 */
export async function generateHealthcareSummary() {
  try {
    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        error: 'OpenAI API key not configured',
        message: 'Set OPENAI_API_KEY environment variable to enable AI summaries'
      };
    }
    
    // Collect patient data
    const data = await collectPatientData();
    
    // Build prompt
    const prompt = buildPrompt(data);
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a medical research analyst specializing in precision oncology and integrative healthcare strategies. You synthesize complex genomic, clinical, and lifestyle data to identify optimization opportunities. You never make prognosis predictions or provide medical advice.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temp for more consistent, factual output
      max_tokens: 2500
    });
    
    const summary = response.choices[0].message.content;
    
    return {
      success: true,
      summary,
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o',
      dataSnapshot: {
        mutationCount: data.mutations.length,
        pathwayCount: data.pathways.length,
        medicationCount: data.medications.length,
        paperCount: data.papers.length
      }
    };
    
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return {
      error: 'Failed to generate summary',
      message: error.message
    };
  }
}

/**
 * Save summary to database (optional - for history tracking)
 */
export async function saveSummary(summary, metadata) {
  // Could add a summaries table to track history
  // For now, we'll just return the live-generated summary
  return { success: true };
}
