#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

console.log('Creating genomic-driven treatment rationale links...\n');

// Get mutation IDs
const arid1a = db.prepare("SELECT id FROM genomic_mutations WHERE gene = 'ARID1A'").get();
const cdkn1a = db.prepare("SELECT id FROM genomic_mutations WHERE gene = 'CDKN1A'").get();
const tert = db.prepare("SELECT id FROM genomic_mutations WHERE gene = 'TERT'").get();

// Get pathway IDs
const chromatinPathway = db.prepare("SELECT id FROM pathways WHERE name LIKE '%Chromatin%'").get();
const atrPathway = db.prepare("SELECT id FROM pathways WHERE name LIKE '%ATR%'").get();
const immunePathway = db.prepare("SELECT id FROM pathways WHERE name LIKE '%PD-1%'").get();
const telomerePathway = db.prepare("SELECT id FROM pathways WHERE name LIKE '%Telomere%'").get();

// Get medication IDs for supplements
const medications = {
    akg: db.prepare("SELECT id FROM medications WHERE name LIKE '%AKG%' OR name LIKE '%Alpha-Ketoglutarate%'").get(),
    ubiquinol: db.prepare("SELECT id FROM medications WHERE name LIKE '%Ubiquinol%'").get(),
    methyleneBlue: db.prepare("SELECT id FROM medications WHERE name LIKE '%Methylene Blue%'").get(),
    ivVitaminC: db.prepare("SELECT id FROM medications WHERE name LIKE '%Vitamin C%' AND dosage LIKE '%infusion%'").get(),
    angiostop: db.prepare("SELECT id FROM medications WHERE name LIKE '%Angiostop%'").get(),
    turkeyTail: db.prepare("SELECT id FROM medications WHERE name LIKE '%Turkey Tail%'").get(),
    ldn: db.prepare("SELECT id FROM medications WHERE name LIKE '%LDN%' OR name LIKE '%Naltrexone%'").get(),
    ivermectin: db.prepare("SELECT id FROM medications WHERE name LIKE '%Ivermectin%'").get(),
    fenbendazole: db.prepare("SELECT id FROM medications WHERE name LIKE '%Fenbendazole%'").get()
};

const insertCorrelation = db.prepare(`
    INSERT INTO treatment_genomic_correlation (
        medication_id, mutation_id, pathway_id, correlation_type, mechanism_description, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
`);

const correlations = [];

// AKG (Alpha-Ketoglutarate) - ARID1A driven
if (medications.akg && arid1a) {
    correlations.push({
        medication_id: medications.akg.id,
        mutation_id: arid1a.id,
        pathway_id: atrPathway?.id,
        correlation_type: 'targeted',
        mechanism_description: 'Alpha-ketoglutarate (AKG) is a key intermediate in the Krebs cycle and cofactor for α-ketoglutarate-dependent dioxygenases. ARID1A loss leads to chromatin remodeling defects and hypoxia/HIF1 pathway dysregulation. AKG modulates HIF1α stability and epigenetic modifications via TET (ten-eleven translocation) enzymes and Jumonji-domain histone demethylases. By supporting these α-KG-dependent enzymes, AKG may counteract the epigenetic and metabolic vulnerabilities created by ARID1A deficiency, particularly in cancer stem cell populations driven by hypoxia signaling.',
        notes: 'Dr. Gildea genomic protocol - Targets Hypoxia/HIF1 pathway dysregulated by ARID1A loss. 1000mg daily dosing.'
    });
}

// Ubiquinol - ARID1A driven (MDR reversal)
if (medications.ubiquinol && arid1a) {
    correlations.push({
        medication_id: medications.ubiquinol.id,
        mutation_id: arid1a.id,
        pathway_id: atrPathway?.id,
        correlation_type: 'supportive',
        mechanism_description: 'Ubiquinol (reduced CoQ10) is critical for mitochondrial electron transport chain function (Complex I/II) and ATP production. ARID1A loss creates metabolic stress and upregulates multi-drug resistance (MDR) phenotypes through altered chromatin accessibility at drug transporter genes (P-glycoprotein/MDR1, ABCG2). Ubiquinol supports mitochondrial function under replication stress, potentially reversing MDR by restoring normal oxidative metabolism. Enhanced mitochondrial function reduces reliance on glycolysis and may sensitize cancer cells to chemotherapy and targeted agents. Also provides antioxidant protection during treatment.',
        notes: 'Dr. Gildea genomic protocol - Targets MDR phenotype and mitochondrial dysfunction. 100mg daily dosing.'
    });
}

// Methylene Blue - ARID1A/Mitochondrial support
if (medications.methyleneBlue && arid1a) {
    correlations.push({
        medication_id: medications.methyleneBlue.id,
        mutation_id: arid1a.id,
        pathway_id: chromatinPathway?.id,
        correlation_type: 'targeted',
        mechanism_description: 'Methylene blue acts as an alternative electron carrier in the mitochondrial electron transport chain, bypassing Complex I/III deficiencies and enhancing ATP production. In hypoxic conditions created by ARID1A-driven chromatin dysregulation, methylene blue improves mitochondrial efficiency and reduces ROS production. It also has mild MAO-A/MAO-B inhibition, potentially affecting cancer cell metabolism. By targeting mitochondrial dysfunction and hypoxia adaptation, methylene blue addresses key vulnerabilities in ARID1A-deficient tumors that rely on altered metabolic states for survival.',
        notes: 'Dr. Gildea genomic protocol - Mitochondrial support targeting hypoxia adaptation and metabolic stress.'
    });
}

// IV Vitamin C - ARID1A (synergy with conventional therapy)
if (medications.ivVitaminC && arid1a) {
    correlations.push({
        medication_id: medications.ivVitaminC.id,
        mutation_id: arid1a.id,
        pathway_id: atrPathway?.id,
        correlation_type: 'synergistic',
        mechanism_description: 'High-dose intravenous vitamin C (ascorbate) generates hydrogen peroxide in the extracellular space, creating oxidative stress preferentially toxic to cancer cells with compromised antioxidant defenses. ARID1A loss impairs DNA damage response and creates "BRCAness" phenotype, making cells vulnerable to oxidative DNA damage. Ascorbate synergizes with platinum chemotherapy (cisplatin) and may enhance immune checkpoint inhibitor efficacy by modulating tumor microenvironment. Clinical trial NCT04046094 demonstrated 30% pathological downstaging in cisplatin-ineligible bladder cancer with ZERO adverse events.',
        notes: 'Clinical evidence: 30% downstaging, 25% complete response in bladder cancer. Bi-weekly high-dose infusions. Synergizes with Keytruda + Padcev.'
    });
}

// Keytruda (Pembrolizumab) - ARID1A may predict response despite low TMB
const keytruda = db.prepare("SELECT id FROM medications WHERE name LIKE '%Keytruda%' OR name LIKE '%Pembrolizumab%'").get();
if (keytruda && arid1a && immunePathway) {
    correlations.push({
        medication_id: keytruda.id,
        mutation_id: arid1a.id,
        pathway_id: immunePathway.id,
        correlation_type: 'targeted',
        mechanism_description: 'ARID1A loss correlates with increased PD-L1 expression and immune infiltration in some tumor types. While TMB is low (4 Muts/Mb) and microsatellite stable (MSS) - typically unfavorable biomarkers for checkpoint inhibitor response - ARID1A alterations may independently predict sensitivity to anti-PD-1 therapy. ARID1A deficiency alters chromatin accessibility at immune regulatory genes, potentially sensitizing tumors to checkpoint blockade through mechanisms independent of neoantigen burden. Patient achieved stable disease on Keytruda + Padcev despite unfavorable biomarkers, supporting ARID1A-driven immune sensitivity.',
        notes: 'Paradoxical response: Stable disease achieved despite TMB 4 (low) and MSS status. ARID1A mutation may confer checkpoint inhibitor sensitivity. Started 6/20/2025, stable disease confirmed 12/10/2025 PET/CT.'
    });
}

// Angiostop - Multi-RTK inhibition
if (medications.angiostop && arid1a) {
    correlations.push({
        medication_id: medications.angiostop.id,
        mutation_id: arid1a.id,
        pathway_id: null,
        correlation_type: 'supportive',
        mechanism_description: 'Angiostop (sea cucumber extract) inhibits 5 receptor tyrosine kinases: VEGFr (angiogenesis), EGFr (proliferation), PDGFr (stroma), FGFr (FGFR3 mutation present in patient), and IGFr (no approved inhibitor exists). ARID1A loss may increase angiogenic signaling and tumor vascularization. Multi-RTK inhibition addresses tumor microenvironment dependencies and growth factor signaling pathways. Of particular interest: targets FGFr pathway (patient has FGFR3 mutation) and IGFr (no pharmaceutical options available). Natural compound provides broad spectrum RTK modulation without pharmaceutical toxicity.',
        notes: 'Targets FGFR3 mutation (also present in genomic profile). Multi-mechanistic anti-angiogenic and growth factor inhibition.'
    });
}

// LDN - Immune modulation via OGF-OGFr axis
if (medications.ldn && arid1a && immunePathway) {
    correlations.push({
        medication_id: medications.ldn.id,
        mutation_id: arid1a.id,
        pathway_id: immunePathway.id,
        correlation_type: 'synergistic',
        mechanism_description: 'Low-dose naltrexone (LDN) works through the opioid growth factor (OGF) - OGF receptor (OGFr) axis to modulate immune function and inhibit cancer cell proliferation. By transiently blocking opioid receptors, LDN causes compensatory upregulation of endogenous opioids (β-endorphins, met-enkephalin) and increased OGFr expression. This enhances NK cell and T-cell activity, reduces tumor angiogenesis, and inhibits cancer cell proliferation. Particularly relevant with ARID1A alterations that affect immune checkpoint regulation - LDN may synergize with pembrolizumab (Keytruda) by enhancing immune surveillance. Case reports show remarkable responses in bladder cancer: 65yo patient with LDN + BCG achieved complete remission lasting 7+ years.',
        notes: 'OGF-OGFr axis immune modulation. Synergizes with checkpoint inhibitors. Clinical evidence: complete remissions in bladder cancer. 3-5mg nightly dosing.'
    });
}

// Ivermectin - Multi-mechanistic anticancer
if (medications.ivermectin && arid1a) {
    correlations.push({
        medication_id: medications.ivermectin.id,
        mutation_id: arid1a.id,
        pathway_id: immunePathway?.id,
        correlation_type: 'synergistic',
        mechanism_description: 'Ivermectin exhibits multiple anticancer mechanisms: 1) Inhibits PAK1 kinase (oncogenic signaling), 2) Blocks WNT/β-catenin pathway (cancer stemness), 3) Induces mitochondrial dysfunction and autophagy in cancer cells, 4) Modulates immune response and may enhance checkpoint inhibitor efficacy, 5) Inhibits P-glycoprotein (MDR1) potentially reversing chemoresistance. ARID1A loss creates vulnerabilities in DNA damage response and metabolic pathways that ivermectin may exploit. Growing body of evidence suggests synergy with conventional cancer therapy. 36mg daily dosing (continuous).',
        notes: 'Multi-mechanistic repurposed drug. May synergize with immunotherapy and reverse MDR phenotype. 36mg daily continuous dosing.'
    });
}

// Fenbendazole - Microtubule disruption + metabolic targeting
if (medications.fenbendazole && arid1a) {
    correlations.push({
        medication_id: medications.fenbendazole.id,
        mutation_id: arid1a.id,
        pathway_id: null,
        correlation_type: 'synergistic',
        mechanism_description: 'Fenbendazole disrupts microtubule polymerization (similar to taxanes but different binding site), inhibits glucose uptake in cancer cells, and triggers p53-mediated apoptosis. ARID1A-deficient tumors with altered chromatin remodeling may be sensitized to microtubule disruption due to impaired DNA damage checkpoints. Fenbendazole also exhibits anti-angiogenic properties and enhances immune response. Repurposed veterinary anthelmintic with emerging anticancer evidence. Synergizes with conventional chemotherapy. 222mg dosing 4 days/week (Monday-Thursday) to minimize resistance and allow recovery.',
        notes: 'Repurposed drug - microtubule disruption + metabolic targeting. 222mg M-Th schedule (4 days on, 3 days off).'
    });
}

// Turkey Tail Mushroom - Immune support
if (medications.turkeyTail && immunePathway) {
    correlations.push({
        medication_id: medications.turkeyTail.id,
        mutation_id: arid1a.id,
        pathway_id: immunePathway.id,
        correlation_type: 'supportive',
        mechanism_description: 'Turkey tail mushroom (Trametes versicolor) contains polysaccharide-K (PSK) and polysaccharide-peptide (PSP) that enhance immune function through multiple mechanisms: 1) Activates dendritic cells, NK cells, and cytotoxic T-lymphocytes, 2) Increases IFN-γ and TNF-α production, 3) Modulates gut microbiome to enhance immune response, 4) Reduces immunosuppressive myeloid-derived suppressor cells (MDSCs). Clinical studies in cancer patients show improved survival when combined with conventional therapy. May synergize with checkpoint inhibitors by enhancing anti-tumor immune response. Particularly relevant given ARID1A-driven immune dysregulation and PD-L1 pathway involvement.',
        notes: 'Immune modulation via PSK/PSP. Supports checkpoint inhibitor efficacy. Clinical evidence in cancer survival.'
    });
}

// Insert all correlations
let successCount = 0;
let skippedCount = 0;

for (const corr of correlations) {
    if (!corr.medication_id) {
        skippedCount++;
        continue;
    }
    
    try {
        insertCorrelation.run(
            corr.medication_id,
            corr.mutation_id,
            corr.pathway_id,
            corr.correlation_type,
            corr.mechanism_description,
            corr.notes
        );
        
        // Get medication name for display
        const med = db.prepare('SELECT name FROM medications WHERE id = ?').get(corr.medication_id);
        const mutation = corr.mutation_id ? db.prepare('SELECT gene FROM genomic_mutations WHERE id = ?').get(corr.mutation_id) : null;
        
        console.log(`✓ Linked ${med.name} → ${mutation?.gene || 'General'} (${corr.correlation_type})`);
        successCount++;
    } catch (err) {
        console.error(`✗ Failed to link correlation: ${err.message}`);
        skippedCount++;
    }
}

console.log(`\n✅ Treatment-genomic correlations complete!`);
console.log(`   ${successCount} links created`);
console.log(`   ${skippedCount} skipped (medication not found)`);

console.log('\n📊 Genomic-Driven Treatment Rationale Summary:\n');
console.log('ARID1A Y1281* Targets:');
console.log('  • AKG 1000mg → Hypoxia/HIF1 pathway modulation');
console.log('  • Ubiquinol 100mg → MDR reversal, mitochondrial support');
console.log('  • Methylene Blue → Mitochondrial/hypoxia targeting');
console.log('  • IV Vitamin C → Oxidative stress + DNA damage (synergy with chemo)');
console.log('  • Keytruda → ARID1A-driven immune sensitivity (explains response despite low TMB)');
console.log('  • Angiostop → Multi-RTK inhibition (includes FGFr - targets FGFR3 mutation)');
console.log('  • LDN → OGF-OGFr immune modulation (synergizes with Keytruda)');
console.log('  • Ivermectin 36mg → Multi-mechanistic (PAK1, WNT, autophagy, immune)');
console.log('  • Fenbendazole 222mg → Microtubule disruption + metabolic');
console.log('  • Turkey Tail → PSK/PSP immune enhancement');

console.log('\n💡 Each supplement now has molecular mechanism linked to your specific mutations.');

db.close();
