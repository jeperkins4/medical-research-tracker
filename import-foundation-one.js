#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Create genomic tables
console.log('Creating genomic schema...');
const schema = fs.readFileSync(path.join(__dirname, 'create-genomic-schema.sql'), 'utf8');
db.exec(schema);

// Insert genomic mutations from Foundation One report
console.log('Importing genomic mutations...');

const mutations = [
    {
        gene: 'ARID1A',
        alteration: 'Y1281*',
        transcript_id: 'NM_006015',
        coding_effect: '3843_3845TGG>ATT',
        variant_allele_frequency: 14.5,
        clinical_significance: 'Tumor suppressor gene inactivating mutation. AT-rich interactive domain-containing protein 1A, member of SWI/SNF chromatin remodeling complex.',
        mutation_type: 'substitution',
        report_date: '2022-09-10',
        report_source: 'Foundation One CDx',
        notes: 'KEY ACTIONABLE MUTATION. Truncating mutation with ARID1A protein loss. Associated with chromatin remodeling deficiency.'
    },
    {
        gene: 'CDKN1A',
        alteration: 'C4ifs*7',
        transcript_id: 'NM_006389',
        coding_effect: 'W1_22insT',
        variant_allele_frequency: 11.0,
        clinical_significance: 'Cell cycle regulator p21 (WAF1/CIP1) inactivating mutation. Negatively regulates CDK1 and CDK2.',
        mutation_type: 'insertion',
        report_date: '2022-09-10',
        report_source: 'Foundation One CDx',
        notes: 'Frequent in bladder cancer (24% vs 0.6% pan-cancer). Critical mediator of p53-dependent cell cycle arrest.'
    },
    {
        gene: 'MLL2',
        alteration: 'E4056*',
        transcript_id: 'NM_603482',
        coding_effect: '12166G>T',
        variant_allele_frequency: 8.6,
        clinical_significance: 'H3K4-specific histone methyltransferase mutation. May represent clonal hematopoiesis.',
        mutation_type: 'substitution',
        report_date: '2022-09-10',
        report_source: 'Foundation One CDx',
        notes: 'POTENTIAL CLONAL HEMATOPOIESIS: May originate from blood cells, not tumor. Would require peripheral blood sequencing to confirm. Tumor suppressor role in cancer.'
    },
    {
        gene: 'TERT',
        alteration: 'promoter -124C>T',
        transcript_id: 'NM_198252',
        coding_effect: '-124C>T',
        variant_allele_frequency: 5.3,
        clinical_significance: 'Telomerase reverse transcriptase promoter mutation (hotspot). Confers enhanced TERT promoter activity.',
        mutation_type: 'substitution',
        report_date: '2022-09-10',
        report_source: 'Foundation One CDx',
        notes: 'Common in bladder cancer (67% high-grade, 56% low-grade). Located 124bp upstream of transcriptional start site (C228T). Associated with poor prognosis.'
    }
];

const insertMutation = db.prepare(`
    INSERT INTO genomic_mutations (
        gene, alteration, transcript_id, coding_effect, variant_allele_frequency,
        clinical_significance, mutation_type, report_date, report_source, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const mutation of mutations) {
    const result = insertMutation.run(
        mutation.gene,
        mutation.alteration,
        mutation.transcript_id,
        mutation.coding_effect,
        mutation.variant_allele_frequency,
        mutation.clinical_significance,
        mutation.mutation_type,
        mutation.report_date,
        mutation.report_source,
        mutation.notes
    );
    console.log(`✓ Imported ${mutation.gene} ${mutation.alteration} (ID: ${result.lastInsertRowid})`);
}

// Insert biomarkers
console.log('\nImporting biomarkers...');

const biomarkers = [
    {
        biomarker_name: 'Tumor Mutational Burden (TMB)',
        result: 'Low',
        numeric_value: 4.0,
        unit: 'Muts/Mb',
        clinical_significance: 'LOW TMB associated with LOWER rates of clinical benefit from PD-1/PD-L1 checkpoint inhibitors. Typical responders have TMB ≥9-12 Muts/Mb.',
        report_date: '2022-09-10',
        report_source: 'Foundation One CDx',
        notes: 'Median TMB in bladder cancer: 5.5 Muts/Mb. Atezolizumab responders: ≥9.7 Muts/Mb. Pembrolizumab responders: 12.3 Muts/Mb median.'
    },
    {
        biomarker_name: 'Microsatellite Status',
        result: 'MS-Stable',
        numeric_value: null,
        unit: null,
        clinical_significance: 'MSS tumors significantly LESS likely to respond to anti-PD-1 immune checkpoint inhibitors (nivolumab, pembrolizumab) compared to MSI-H tumors.',
        report_date: '2022-09-10',
        report_source: 'Foundation One CDx',
        notes: 'Indicates MMR proficiency. MSI detected in 26-49% of urothelial carcinomas. MSI-H patients show 70% ORR vs 12% for non-MSI-H with pembrolizumab.'
    }
];

const insertBiomarker = db.prepare(`
    INSERT INTO biomarkers (
        biomarker_name, result, numeric_value, unit, clinical_significance,
        report_date, report_source, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const biomarker of biomarkers) {
    const result = insertBiomarker.run(
        biomarker.biomarker_name,
        biomarker.result,
        biomarker.numeric_value,
        biomarker.unit,
        biomarker.clinical_significance,
        biomarker.report_date,
        biomarker.report_source,
        biomarker.notes
    );
    console.log(`✓ Imported biomarker: ${biomarker.biomarker_name} = ${biomarker.result}`);
}

// Insert VUS variants
console.log('\nImporting variants of unknown significance...');

const vusVariants = [
    { gene: 'AXIN1', alteration: 'E245K', transcript_id: 'TBD', coding_effect: 'TBD', variant_allele_frequency: null },
    { gene: 'AXIN1', alteration: 'E73Q', transcript_id: 'TBD', coding_effect: 'TBD', variant_allele_frequency: null },
    { gene: 'ROS1', alteration: 'T234V', transcript_id: 'TBD', coding_effect: 'TBD', variant_allele_frequency: null },
    { gene: 'TET2', alteration: 'N1035S', transcript_id: 'TBD', coding_effect: 'TBD', variant_allele_frequency: null },
    { gene: 'TSC2', alteration: 'F510del', transcript_id: 'TBD', coding_effect: 'TBD', variant_allele_frequency: null }
];

const insertVUS = db.prepare(`
    INSERT INTO vus_variants (gene, alteration, transcript_id, coding_effect, variant_allele_frequency, report_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const vus of vusVariants) {
    insertVUS.run(
        vus.gene,
        vus.alteration,
        vus.transcript_id,
        vus.coding_effect,
        vus.variant_allele_frequency,
        '2022-09-10',
        'Variant of Unknown Significance - not adequately characterized in scientific literature at time of report.'
    );
    console.log(`✓ Imported VUS: ${vus.gene} ${vus.alteration}`);
}

// Insert biological pathways
console.log('\nImporting biological pathways...');

const pathways = [
    {
        name: 'Chromatin Remodeling / SWI/SNF Complex',
        description: 'ATP-dependent chromatin remodeling complex that regulates gene expression by altering DNA accessibility.',
        biological_role: 'Controls transcription, DNA repair, and cell cycle regulation through nucleosome repositioning.',
        cancer_relevance: 'ARID1A is a key member of SWI/SNF complex. Loss leads to dysregulated gene expression, impaired DNA repair, and tumor suppression deficiency.'
    },
    {
        name: 'Cell Cycle Regulation / CDK Pathway',
        description: 'Cyclin-dependent kinase pathway controlling cell division and proliferation.',
        biological_role: 'CDKN1A (p21) inhibits CDK1/CDK2 to arrest cell cycle. Critical for p53-dependent cell cycle arrest.',
        cancer_relevance: 'CDKN1A loss removes cell cycle checkpoint, allowing uncontrolled proliferation. Frequent in bladder cancer (24%).'
    },
    {
        name: 'Telomere Maintenance',
        description: 'Cellular mechanism to maintain chromosomal length and prevent senescence.',
        biological_role: 'TERT (telomerase reverse transcriptase) extends telomeres to enable unlimited replication.',
        cancer_relevance: 'TERT promoter mutations activate telomerase, hallmark of 80-90% of malignancies. Enables immortalization of cancer cells.'
    },
    {
        name: 'DNA Damage Response / ATR Pathway',
        description: 'ATR (Ataxia Telangiectasia and Rad3-related) kinase pathway responds to replication stress and DNA damage.',
        biological_role: 'Detects stalled replication forks and single-stranded DNA breaks. Activates cell cycle checkpoints and DNA repair.',
        cancer_relevance: 'ARID1A loss creates "BRCAness" phenotype - synthetic lethality with ATR inhibition. Tumors with chromatin remodeling defects rely on ATR for survival.'
    },
    {
        name: 'Epigenetic Regulation / Histone Methylation',
        description: 'Histone modification controlling gene expression without altering DNA sequence.',
        biological_role: 'MLL2 (KMT2D) methylates histone H3 lysine 4 (H3K4) to activate transcription.',
        cancer_relevance: 'MLL2 mutations disrupt epigenetic regulation. Common in lung SCC and SCLC. Associated with poor prognosis.'
    },
    {
        name: 'Immune Checkpoint / PD-1/PD-L1 Axis',
        description: 'Programmed death receptor pathway that regulates T-cell activation and immune tolerance.',
        biological_role: 'PD-1 on T-cells binds PD-L1 on tumor cells to suppress immune response. Cancer hijacks this to evade immunity.',
        cancer_relevance: 'Low TMB and MSS status predict LOWER response to checkpoint inhibitors. However, ARID1A mutations may confer sensitivity despite unfavorable biomarkers.'
    }
];

const insertPathway = db.prepare(`
    INSERT INTO pathways (name, description, biological_role, cancer_relevance)
    VALUES (?, ?, ?, ?)
`);

const pathwayIds = {};
for (const pathway of pathways) {
    const result = insertPathway.run(
        pathway.name,
        pathway.description,
        pathway.biological_role,
        pathway.cancer_relevance
    );
    pathwayIds[pathway.name] = result.lastInsertRowid;
    console.log(`✓ Imported pathway: ${pathway.name}`);
}

// Link mutations to pathways
console.log('\nLinking mutations to pathways...');

const mutationPathwayLinks = [
    { mutation: 'ARID1A Y1281*', pathway: 'Chromatin Remodeling / SWI/SNF Complex', impact: 'high', mechanism: 'Loss of ARID1A protein disrupts SWI/SNF complex function, leading to chromatin remodeling deficiency.' },
    { mutation: 'ARID1A Y1281*', pathway: 'DNA Damage Response / ATR Pathway', impact: 'high', mechanism: 'ARID1A loss creates synthetic lethality with ATR inhibition. Tumors become dependent on ATR for survival under replication stress.' },
    { mutation: 'ARID1A Y1281*', pathway: 'Immune Checkpoint / PD-1/PD-L1 Axis', impact: 'medium', mechanism: 'ARID1A alterations may predict sensitivity to anti-PD-1/PD-L1 immunotherapy despite low TMB.' },
    { mutation: 'CDKN1A C4ifs*7', pathway: 'Cell Cycle Regulation / CDK Pathway', impact: 'high', mechanism: 'p21 inactivation removes CDK1/CDK2 inhibition, eliminating cell cycle checkpoint control.' },
    { mutation: 'TERT promoter -124C>T', pathway: 'Telomere Maintenance', impact: 'high', mechanism: 'Promoter mutation enhances TERT transcription, activating telomerase to enable unlimited replication.' },
    { mutation: 'MLL2 E4056*', pathway: 'Epigenetic Regulation / Histone Methylation', impact: 'medium', mechanism: 'MLL2 truncation disrupts H3K4 methylation, altering transcriptional regulation.' }
];

const insertMutationPathway = db.prepare(`
    INSERT INTO mutation_pathways (mutation_id, pathway_id, impact_level, mechanism)
    VALUES (?, ?, ?, ?)
`);

// Get mutation IDs
const getMutationId = db.prepare('SELECT id FROM genomic_mutations WHERE gene = ? AND alteration = ?');

for (const link of mutationPathwayLinks) {
    const [gene, alteration] = link.mutation.split(' ');
    const mutationRow = getMutationId.get(gene, alteration);
    const pathwayId = pathwayIds[link.pathway];
    
    if (mutationRow && pathwayId) {
        insertMutationPathway.run(mutationRow.id, pathwayId, link.impact, link.mechanism);
        console.log(`✓ Linked ${link.mutation} → ${link.pathway}`);
    }
}

console.log('\n✅ Foundation One genomic data import complete!');
console.log('\nNext steps:');
console.log('1. Import mutation treatments (ATR inhibitors, etc.)');
console.log('2. Import clinical trials');
console.log('3. Build Precision Medicine Dashboard UI');

db.close();
