import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

console.log('Populating genomic profile data from Foundation One report...\n');

// Apply schema
const schema = fs.readFileSync(path.join(__dirname, 'add-genomic-schema.sql'), 'utf8');
const statements = schema.split(';').filter(s => s.trim());
statements.forEach(statement => {
    if (statement.trim()) {
        db.exec(statement);
    }
});

console.log('✓ Genomic schema created\n');

// Insert confirmed mutations from Foundation One
const mutations = [
    {
        gene_name: 'ARID1A',
        mutation_type: 'Loss of function',
        clinical_significance: 'Pathogenic',
        source_test: 'Foundation One',
        test_date: '2025-06-01', // Approximate - will update with actual date
        is_confirmed: 1,
        notes: 'Key driver mutation. ARID1A is a chromatin remodeling gene; loss promotes cancer stem cell phenotype and hypoxia signaling.'
    },
    {
        gene_name: 'FGFR3',
        mutation_type: 'Activating mutation',
        clinical_significance: 'Pathogenic',
        source_test: 'Foundation One',
        test_date: '2025-06-01',
        is_confirmed: 1,
        notes: 'Fibroblast growth factor receptor 3. Common in bladder cancer; drives cell proliferation.'
    },
    {
        gene_name: 'PIK3CA',
        mutation_type: 'Activating mutation',
        clinical_significance: 'Pathogenic',
        source_test: 'Foundation One',
        test_date: '2025-06-01',
        is_confirmed: 1,
        notes: 'PI3K pathway activation. Promotes cell survival and drug resistance.'
    },
    {
        gene_name: 'PTEN',
        mutation_type: 'Wild-type',
        clinical_significance: 'Normal/Intact',
        source_test: 'Foundation One',
        test_date: '2025-06-01',
        is_confirmed: 0, // Confirmed NOT mutated
        notes: 'Confirmed intact/wild-type. PTEN loss would worsen PI3K pathway dysregulation.'
    },
    {
        gene_name: 'KDM6A',
        mutation_type: 'Wild-type',
        clinical_significance: 'Normal/Intact',
        source_test: 'Foundation One',
        test_date: '2025-06-01',
        is_confirmed: 0,
        notes: 'Confirmed intact/wild-type. KDM6A is a histone demethylase frequently lost in bladder cancer.'
    },
    {
        gene_name: 'TP53',
        mutation_type: 'Wild-type',
        clinical_significance: 'Normal/Intact',
        source_test: 'Foundation One',
        test_date: '2025-06-01',
        is_confirmed: 0,
        notes: 'Confirmed intact/wild-type. Intact TP53 is favorable - preserves some apoptotic capacity.'
    }
];

const insertMutation = db.prepare(`
    INSERT INTO genomic_mutations (gene_name, mutation_type, clinical_significance, source_test, test_date, is_confirmed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

mutations.forEach(m => {
    insertMutation.run(
        m.gene_name,
        m.mutation_type,
        m.clinical_significance,
        m.source_test,
        m.test_date,
        m.is_confirmed,
        m.notes
    );
    console.log(`✓ ${m.gene_name}: ${m.is_confirmed ? 'MUTATED' : 'CONFIRMED NORMAL'}`);
});

console.log('\n✓ Mutations recorded\n');

// Insert therapeutic pathways being targeted
const pathways = [
    {
        pathway_name: 'Hypoxia/HIF1 Signaling',
        pathway_category: 'Cancer Stem Cells',
        description: 'Hypoxia-inducible factor (HIF1) pathway activation promotes cancer stem cell survival, angiogenesis, and metastasis.',
        clinical_relevance: 'ARID1A loss enhances HIF1 signaling, creating hypoxic niches that support treatment-resistant cancer stem cells. Critical target for preventing recurrence.'
    },
    {
        pathway_name: 'Multi-Drug Resistance (MDR)',
        pathway_category: 'Treatment Resistance',
        description: 'ATP-binding cassette (ABC) transporter overexpression pumps chemotherapy drugs out of cancer cells.',
        clinical_relevance: 'PI3K/AKT activation (via PIK3CA mutation) upregulates MDR1/P-glycoprotein, reducing effectiveness of chemotherapy and targeted agents.'
    },
    {
        pathway_name: 'Immune Escape/PD-L1',
        pathway_category: 'Immunotherapy Resistance',
        description: 'PD-L1 expression allows cancer cells to evade T-cell mediated killing.',
        clinical_relevance: 'ARID1A loss is associated with PD-L1 upregulation. Directly relevant to Keytruda (pembrolizumab) efficacy. Enhancing immune function complements checkpoint inhibition.'
    },
    {
        pathway_name: 'PI3K/AKT/mTOR',
        pathway_category: 'Cell Survival & Proliferation',
        description: 'Master growth signaling pathway regulating cell metabolism, survival, and proliferation.',
        clinical_relevance: 'PIK3CA mutation causes constitutive pathway activation. Hyperactive PI3K drives tumor growth and resistance to apoptosis.'
    },
    {
        pathway_name: 'FGFR Signaling',
        pathway_category: 'Growth Factor Signaling',
        description: 'Fibroblast growth factor receptor pathway driving cell division and angiogenesis.',
        clinical_relevance: 'FGFR3 activating mutations are common in bladder cancer. May be targetable with FGFR inhibitors if immunotherapy fails.'
    }
];

const insertPathway = db.prepare(`
    INSERT INTO genomic_pathways (pathway_name, pathway_category, description, clinical_relevance)
    VALUES (?, ?, ?, ?)
`);

pathways.forEach(p => {
    insertPathway.run(
        p.pathway_name,
        p.pathway_category,
        p.description,
        p.clinical_relevance
    );
    console.log(`✓ Pathway: ${p.pathway_name}`);
});

console.log('\n✓ Pathways defined\n');

// Link mutations to pathways
const mutationPathwayLinks = [
    { gene: 'ARID1A', pathway: 'Hypoxia/HIF1 Signaling', impact: 'High', mechanism: 'ARID1A loss derepresses HIF1A transcription and stabilizes HIF1α protein in normoxic conditions.' },
    { gene: 'ARID1A', pathway: 'Immune Escape/PD-L1', impact: 'High', mechanism: 'ARID1A-deficient tumors show increased PD-L1 expression and immune cell infiltration.' },
    { gene: 'PIK3CA', pathway: 'PI3K/AKT/mTOR', impact: 'High', mechanism: 'Activating PIK3CA mutation causes constitutive PI3K activity, driving AKT and mTOR signaling.' },
    { gene: 'PIK3CA', pathway: 'Multi-Drug Resistance (MDR)', impact: 'High', mechanism: 'PI3K/AKT activation upregulates MDR1/P-glycoprotein expression, pumping out chemotherapy drugs.' },
    { gene: 'FGFR3', pathway: 'FGFR Signaling', impact: 'High', mechanism: 'Activating FGFR3 mutations cause ligand-independent receptor activation and downstream ERK/AKT signaling.' },
    { gene: 'FGFR3', pathway: 'PI3K/AKT/mTOR', impact: 'Medium', mechanism: 'FGFR3 activates PI3K/AKT pathway as a downstream effector.' }
];

const getMutationId = db.prepare('SELECT id FROM genomic_mutations WHERE gene_name = ? AND is_confirmed = 1');
const getPathwayId = db.prepare('SELECT id FROM genomic_pathways WHERE pathway_name = ?');

const insertLink = db.prepare(`
    INSERT INTO mutation_pathway_map (mutation_id, pathway_id, impact_level, mechanism)
    VALUES (?, ?, ?, ?)
`);

mutationPathwayLinks.forEach(link => {
    const mutationRow = getMutationId.get(link.gene);
    const pathwayRow = getPathwayId.get(link.pathway);
    
    if (mutationRow && pathwayRow) {
        insertLink.run(mutationRow.id, pathwayRow.id, link.impact, link.mechanism);
        console.log(`✓ Linked ${link.gene} → ${link.pathway} (${link.impact} impact)`);
    }
});

console.log('\n✓ Mutation-pathway links established\n');

// Insert initial genomic-targeted supplements we know about
const genomicTreatments = [
    {
        treatment_name: 'Alpha-Ketoglutarate (AKG)',
        treatment_type: 'Supplement',
        dosage: '1000mg',
        frequency: 'Daily',
        target_pathway: 'Hypoxia/HIF1 Signaling',
        mechanism_of_action: 'AKG is a TCA cycle intermediate and cofactor for HIF prolyl hydroxylases (PHDs). Inhibits HIF1α stabilization, counteracting hypoxic signaling.',
        supporting_evidence: 'PHDs require AKG and oxygen to hydroxylate HIF1α, marking it for degradation. Supplementation may restore PHD activity in ARID1A-mutant cells.',
        priority_level: 'High',
        status: 'Active',
        notes: 'Currently taking. Overlap with existing supplement regimen.'
    },
    {
        treatment_name: 'Ubiquinol (CoQ10)',
        treatment_type: 'Supplement',
        dosage: '100mg',
        frequency: 'Daily',
        target_pathway: 'PI3K/AKT/mTOR',
        mechanism_of_action: 'Mitochondrial electron transport chain component. Supports oxidative metabolism and may counteract Warburg effect (aerobic glycolysis).',
        supporting_evidence: 'Cancer cells with PI3K activation rely heavily on glycolysis. CoQ10 supports mitochondrial function and oxidative phosphorylation.',
        priority_level: 'High',
        status: 'Active',
        notes: 'Currently taking. Mitochondrial support to counteract metabolic reprogramming.'
    }
];

const getPathwayIdForTreatment = db.prepare('SELECT id FROM genomic_pathways WHERE pathway_name = ?');

const insertTreatment = db.prepare(`
    INSERT INTO genomic_treatments 
    (treatment_name, treatment_type, dosage, frequency, target_pathway_id, mechanism_of_action, supporting_evidence, priority_level, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

genomicTreatments.forEach(t => {
    const pathwayRow = getPathwayIdForTreatment.get(t.target_pathway);
    insertTreatment.run(
        t.treatment_name,
        t.treatment_type,
        t.dosage,
        t.frequency,
        pathwayRow ? pathwayRow.id : null,
        t.mechanism_of_action,
        t.supporting_evidence,
        t.priority_level,
        t.status,
        t.notes
    );
    console.log(`✓ ${t.treatment_name} → targets ${t.target_pathway}`);
});

console.log('\n✓ Genomic-targeted treatments recorded\n');

// Link existing medications to show overlap
const existingMeds = [
    { name: 'Alpha-Ketoglutarate', genomic_treatment: 'Alpha-Ketoglutarate (AKG)', overlap: 'Already Taking' },
    { name: 'Ubiquinol', genomic_treatment: 'Ubiquinol (CoQ10)', overlap: 'Already Taking' }
];

const getMedId = db.prepare('SELECT id FROM medications WHERE name = ?');
const getGenomicTreatmentId = db.prepare('SELECT id FROM genomic_treatments WHERE treatment_name = ?');

const insertOverlap = db.prepare(`
    INSERT INTO genomic_med_overlap (genomic_treatment_id, medication_id, overlap_type, notes)
    VALUES (?, ?, ?, ?)
`);

existingMeds.forEach(med => {
    const medRow = getMedId.get(med.name);
    const treatmentRow = getGenomicTreatmentId.get(med.genomic_treatment);
    
    if (medRow && treatmentRow) {
        insertOverlap.run(
            treatmentRow.id,
            medRow.id,
            med.overlap,
            'Already in current supplement regimen'
        );
        console.log(`✓ Linked existing medication: ${med.name}`);
    }
});

console.log('\n✅ Genomic profile system initialized!\n');

// Summary report
console.log('=== GENOMIC PROFILE SUMMARY ===\n');

console.log('MUTATIONS IDENTIFIED:');
const confirmedMutations = db.prepare('SELECT gene_name, mutation_type FROM genomic_mutations WHERE is_confirmed = 1').all();
confirmedMutations.forEach(m => console.log(`  • ${m.gene_name}: ${m.mutation_type}`));

console.log('\nGENES CONFIRMED NORMAL (NOT MUTATED):');
const normalGenes = db.prepare('SELECT gene_name FROM genomic_mutations WHERE is_confirmed = 0').all();
normalGenes.forEach(g => console.log(`  • ${g.gene_name}`));

console.log('\nTHERAPEUTIC PATHWAYS TARGETED:');
const allPathways = db.prepare('SELECT pathway_name, pathway_category FROM genomic_pathways').all();
allPathways.forEach(p => console.log(`  • ${p.pathway_name} (${p.pathway_category})`));

console.log('\nGENOMIC-TARGETED INTERVENTIONS:');
const treatments = db.prepare(`
    SELECT gt.treatment_name, gt.status, gp.pathway_name 
    FROM genomic_treatments gt
    LEFT JOIN genomic_pathways gp ON gt.target_pathway_id = gp.id
`).all();
treatments.forEach(t => console.log(`  • ${t.treatment_name} (${t.status}) → ${t.pathway_name}`));

console.log('\n✅ Ready to add additional supplements from UVA geneticist report\n');

db.close();
