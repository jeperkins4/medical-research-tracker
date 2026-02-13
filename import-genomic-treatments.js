#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

console.log('Importing mutation-targeted treatments...');

// Get mutation IDs
const getAridiaId = db.prepare("SELECT id FROM genomic_mutations WHERE gene = 'ARID1A'").get();
const getCdkniaId = db.prepare("SELECT id FROM genomic_mutations WHERE gene = 'CDKN1A'").get();
const getTertId = db.prepare("SELECT id FROM genomic_mutations WHERE gene = 'TERT'").get();

const arid1aId = getAridiaId?.id;
const cdkn1aId = getCdkniaId?.id;
const tertId = getTertId?.id;

if (!arid1aId) {
    console.error('Error: ARID1A mutation not found. Run import-foundation-one.js first.');
    process.exit(1);
}

// Insert mutation treatments
const insertTreatment = db.prepare(`
    INSERT INTO mutation_treatments (
        mutation_id, therapy_name, therapy_type, mechanism, clinical_evidence,
        sensitivity_or_resistance, evidence_description, evidence_references
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const treatments = [
    // ARID1A-targeted therapies
    {
        mutation_id: arid1aId,
        therapy_name: 'M6620 (Berzosertib)',
        therapy_type: 'targeted_therapy',
        mechanism: 'ATR kinase inhibitor. Exploits synthetic lethality with ARID1A loss.',
        clinical_evidence: 'Phase_1',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Phase 1 trial: Patient with metastatic colorectal cancer harboring ARID1A mutation + ATM loss achieved complete response (CR) ongoing at 29 months with single-agent M6620. One SCLC patient with ARID1A mutation had partial response (PR) with M6620 + topotecan.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'Ceralasertib (AZD6738)',
        therapy_type: 'targeted_therapy',
        mechanism: 'ATR kinase inhibitor. Targets replication stress in ARID1A-deficient tumors.',
        clinical_evidence: 'Phase_2',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Phase 2 study in solid tumors: 2 patients with endometrial carcinoma with ARID1A loss achieved complete responses (CR) on ceralasertib monotherapy. At least 1 carried inactivating ARID1A mutation. No responses in patients with normal ARID1A expression.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'BAY 1895344 (Elimusertib)',
        therapy_type: 'targeted_therapy',
        mechanism: 'ATR kinase inhibitor. Synthetic lethal with chromatin remodeling defects.',
        clinical_evidence: 'Phase_1',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Multiple ongoing Phase 1/2 trials targeting ARID1A alterations. Combines with chemotherapy (cisplatin, gemcitabine) for solid tumors including urothelial cancer.',
        evidence_references: 'ClinicalTrials.gov, Foundation One CDx'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'VX-970 (ATR Inhibitor)',
        therapy_type: 'targeted_therapy',
        mechanism: 'ATR kinase inhibitor.',
        clinical_evidence: 'Phase_1',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Phase 1 trials in solid tumors with DNA damage response defects including ARID1A alterations.',
        evidence_references: 'ClinicalTrials.gov'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'EZH2 Inhibitors',
        therapy_type: 'targeted_therapy',
        mechanism: 'Inhibits Enhancer of Zeste Homolog 2, histone methyltransferase. ARID1A inactivation activates EZH2.',
        clinical_evidence: 'Preclinical',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Preclinical studies in ovarian cancer show ARID1A inactivation may predict sensitivity to EZH2 inhibitors under investigation in clinical trials.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'PI3K-AKT Pathway Inhibitors',
        therapy_type: 'targeted_therapy',
        mechanism: 'Targets PI3K or AKT kinases. ARID1A loss may activate PI3K-AKT pathway.',
        clinical_evidence: 'Preclinical',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Studies report ARID1A loss may activate PI3K-AKT pathway and be linked with sensitivity to pathway inhibitors.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'Anti-PD-1/PD-L1 Immunotherapy',
        therapy_type: 'immunotherapy',
        mechanism: 'Checkpoint inhibition. ARID1A alterations associated with immune response.',
        clinical_evidence: 'Phase_2',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Patients with ARID1A alterations in advanced/metastatic solid tumors may derive benefit from anti-PD-1 or anti-PD-L1 immunotherapy.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'Pan-HDAC Inhibitors (Belinostat, Panobinostat)',
        therapy_type: 'targeted_therapy',
        mechanism: 'Histone deacetylase inhibitors. ARID1A-altered urothelial cancer may be sensitive.',
        clinical_evidence: 'Phase_2',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Limited clinical evidence in ARID1A-altered urothelial cancer: retrospective analysis reported complete response (CR) to belinostat and partial response (PR) to panobinostat.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: arid1aId,
        therapy_name: 'Platinum-based Chemotherapy',
        therapy_type: 'chemotherapy',
        mechanism: 'DNA crosslinking agents (cisplatin, carboplatin).',
        clinical_evidence: 'FDA_approved',
        sensitivity_or_resistance: 'resistance',
        evidence_description: 'ARID1A loss associated with chemoresistance to platinum-based therapy in ovarian clear cell carcinoma.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },

    // CDKN1A treatments
    {
        mutation_id: cdkn1aId,
        therapy_name: 'Gemcitabine + CHK Inhibitor',
        therapy_type: 'targeted_therapy',
        mechanism: 'Checkpoint kinase inhibition in context of cell cycle dysregulation.',
        clinical_evidence: 'Preclinical',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Preclinical study: bladder cancer cell lines with concurrent CDKN1A and TP53 inactivation showed increased sensitivity to gemcitabine + CHK inhibitor combination.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: cdkn1aId,
        therapy_name: 'CDK Inhibitors',
        therapy_type: 'targeted_therapy',
        mechanism: 'Cyclin-dependent kinase inhibitors. CDKN1A loss may result in increased CDK activity.',
        clinical_evidence: 'Phase_1',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Several CDK inhibitors in clinical development. Relevance of CDKN1A as predictive biomarker not yet established.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },

    // TERT treatments
    {
        mutation_id: tertId,
        therapy_name: 'TERT Peptide Vaccines',
        therapy_type: 'immunotherapy',
        mechanism: 'Uses TERT as tumor-associated antigen to generate immune response.',
        clinical_evidence: 'Phase_2',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'TERT peptide vaccines showed limited anticancer efficacy in clinical trials. Preclinical study: combination of TERT peptide vaccine + anti-CTLA-4 suppressed tumor growth.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    },
    {
        mutation_id: tertId,
        therapy_name: 'Imetelstat (TERT Inhibitor)',
        therapy_type: 'targeted_therapy',
        mechanism: 'Direct telomerase inhibition.',
        clinical_evidence: 'Phase_2',
        sensitivity_or_resistance: 'sensitivity',
        evidence_description: 'Phase 2 study in advanced NSCLC reported no improvement in PFS or OS with imetelstat.',
        evidence_references: 'Foundation One CDx report 2022-09-10'
    }
];

for (const treatment of treatments) {
    const result = insertTreatment.run(
        treatment.mutation_id,
        treatment.therapy_name,
        treatment.therapy_type,
        treatment.mechanism,
        treatment.clinical_evidence,
        treatment.sensitivity_or_resistance,
        treatment.evidence_description,
        treatment.evidence_references
    );
    console.log(`✓ Imported treatment: ${treatment.therapy_name} (${treatment.sensitivity_or_resistance})`);
}

// Import clinical trials
console.log('\nImporting clinical trials...');

const insertTrial = db.prepare(`
    INSERT INTO genomic_trials (
        mutation_id, trial_name, target_biomarker, therapy_agents, phase,
        locations, eligibility_notes, status, priority_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const trials = [
    {
        mutation_id: arid1aId,
        trial_name: 'BAY 1895344 + Chemotherapy for Advanced Stage Solid Tumors',
        target_biomarker: 'ARID1A',
        therapy_agents: 'ATR inhibitor (BAY 1895344), Topotecan',
        phase: 'Phase 1/2',
        locations: 'Florida, Tennessee, Pennsylvania, Oklahoma, Connecticut, Minnesota, Arizona',
        eligibility_notes: 'Advanced stage solid tumors with focus on SCLC, neuroendocrine cancer, pancreatic cancer. ARID1A alterations eligible.',
        status: 'recruiting',
        priority_score: 10
    },
    {
        mutation_id: arid1aId,
        trial_name: 'Pembrolizumab Alone and in Combinations in Bladder Cancer (Window of Opportunity Study)',
        target_biomarker: 'ARID1A',
        therapy_agents: 'Pembrolizumab (PD-1), HDAC inhibitors',
        phase: 'Phase 2',
        locations: 'North Carolina, Pennsylvania',
        eligibility_notes: 'Bladder cancer patients. ARID1A mutations eligible for HDAC inhibitor combination arms.',
        status: 'recruiting',
        priority_score: 9
    },
    {
        mutation_id: arid1aId,
        trial_name: 'ART0380 for Treatment of Advanced or Metastatic Solid Tumors',
        target_biomarker: 'ARID1A',
        therapy_agents: 'ATR inhibitor (ART0380)',
        phase: 'Phase 1',
        locations: 'Florida, Tennessee, Texas, Pennsylvania, Oklahoma, Colorado',
        eligibility_notes: 'Advanced or metastatic solid tumors. ARID1A alterations predict sensitivity.',
        status: 'recruiting',
        priority_score: 8
    },
    {
        mutation_id: arid1aId,
        trial_name: 'ATR Kinase Inhibitor VX-970 and Irinotecan in Metastatic Solid Tumors',
        target_biomarker: 'ARID1A',
        therapy_agents: 'VX-970 (ATR inhibitor), Irinotecan',
        phase: 'Phase 1',
        locations: 'Tennessee, Missouri, Pennsylvania, Connecticut, Massachusetts, California',
        eligibility_notes: 'Solid tumors that are metastatic or cannot be removed by surgery.',
        status: 'recruiting',
        priority_score: 7
    },
    {
        mutation_id: arid1aId,
        trial_name: 'Lurbinectedin with Berzosertib (ATR Kinase Inhibitor) in Small Cell Cancers and High-Grade Neuroendocrine Cancers',
        target_biomarker: 'ARID1A',
        therapy_agents: 'Lurbinectedin, Berzosertib (M6620, ATR inhibitor)',
        phase: 'Phase 2',
        locations: 'Maryland',
        eligibility_notes: 'Small cell cancers and high-grade neuroendocrine cancers. ARID1A alterations eligible.',
        status: 'recruiting',
        priority_score: 7
    },
    {
        mutation_id: arid1aId,
        trial_name: 'AZD6738 (Ceralasertib) in Combination with Chemotherapy and/or Novel Anti-Cancer Agents',
        target_biomarker: 'ARID1A',
        therapy_agents: 'AZD6738 (ATR inhibitor), Chemotherapy, PARP inhibitors, PD-L1 inhibitors',
        phase: 'Phase 1/2',
        locations: 'New York, Massachusetts, California, United Kingdom (multiple sites)',
        eligibility_notes: 'Ascending doses, multiple combination arms. ARID1A loss predicts ATR inhibitor sensitivity.',
        status: 'recruiting',
        priority_score: 9
    },
    {
        mutation_id: arid1aId,
        trial_name: 'BAY 1895344 ATR Inhibitor + Cisplatin or Cisplatin + Gemcitabine for Advanced Urothelial Cancer',
        target_biomarker: 'ARID1A',
        therapy_agents: 'BAY 1895344 (ATR inhibitor), Cisplatin, Gemcitabine',
        phase: 'Phase 1/2',
        locations: 'Ohio, Maryland, Pennsylvania, Wisconsin, New York, California',
        eligibility_notes: '**UROTHELIAL CANCER SPECIFIC** - Advanced solid tumors with emphasis on urothelial cancer. ARID1A alterations highly relevant.',
        status: 'recruiting',
        priority_score: 10
    },
    {
        mutation_id: arid1aId,
        trial_name: 'Avelumab and M6620 for DDR Deficient Metastatic or Unresectable Solid Tumors',
        target_biomarker: 'ARID1A',
        therapy_agents: 'Avelumab (PD-L1 inhibitor), M6620 (ATR inhibitor)',
        phase: 'Phase 1/2',
        locations: 'Texas',
        eligibility_notes: 'DNA damage response (DDR) deficient tumors including ARID1A alterations. Combines immunotherapy + ATR inhibition.',
        status: 'recruiting',
        priority_score: 8
    },
    {
        mutation_id: arid1aId,
        trial_name: 'BAY 1895344 ATR Inhibitor + Gemcitabine for Advanced Pancreatic/Ovarian Cancer and Solid Tumors',
        target_biomarker: 'ARID1A',
        therapy_agents: 'BAY 1895344 (ATR inhibitor), Gemcitabine',
        phase: 'Phase 1/2',
        locations: 'Maryland, Massachusetts',
        eligibility_notes: 'Advanced pancreatic, ovarian cancer, and solid tumors. ARID1A alterations eligible.',
        status: 'recruiting',
        priority_score: 6
    },
    {
        mutation_id: arid1aId,
        trial_name: 'EDO-S101 in Patients With Advanced Solid Tumors',
        target_biomarker: 'ARID1A',
        therapy_agents: 'EDO-S101 (HDAC inhibitor)',
        phase: 'Phase 1',
        locations: 'Montreal, Canada',
        eligibility_notes: 'Safety, pharmacokinetics, efficacy study. ARID1A-altered urothelial cancer may be sensitive to pan-HDAC inhibitors.',
        status: 'recruiting',
        priority_score: 5
    }
];

for (const trial of trials) {
    const result = insertTrial.run(
        trial.mutation_id,
        trial.trial_name,
        trial.target_biomarker,
        trial.therapy_agents,
        trial.phase,
        trial.locations,
        trial.eligibility_notes,
        trial.status,
        trial.priority_score
    );
    console.log(`✓ Imported trial: ${trial.trial_name}`);
}

console.log('\n✅ Genomic treatments and clinical trials import complete!');
console.log(`\nImported ${treatments.length} treatments and ${trials.length} clinical trials`);
console.log('\nHighest priority trials:');
console.log('1. BAY 1895344 + Cisplatin/Gemcitabine for Urothelial Cancer (Priority 10)');
console.log('2. BAY 1895344 + Chemo for Advanced Solid Tumors (Priority 10)');
console.log('3. AZD6738 (Ceralasertib) Combinations (Priority 9)');

db.close();
