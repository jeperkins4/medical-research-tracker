/**
 * Initialize genomic data for John Perkins
 * Run this once to populate the genomic_mutations and mutation_therapies tables
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path (matches main.cjs logic)
const userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'MyTreatmentPath');
const dbPath = path.join(userDataPath, 'data', 'health-secure.db');

console.log(`Opening database at: ${dbPath}`);
const db = new Database(dbPath);

// John's known mutations from Foundation One CDx report
const mutations = [
  {
    gene: 'ARID1A',
    mutation_type: 'Loss of function',
    mutation_detail: 'Frameshift mutation (exon 18)',
    vaf: 22.5,
    clinical_significance: 'pathogenic',
    report_source: 'Foundation One CDx',
    report_date: '2024-12-15',
    notes: 'Chromatin remodeling defect, tumor suppressor loss'
  },
  {
    gene: 'FGFR3',
    mutation_type: 'S249C missense',
    mutation_detail: 'S249C activating mutation',
    vaf: 18.3,
    clinical_significance: 'pathogenic',
    report_source: 'Foundation One CDx',
    report_date: '2024-12-15',
    notes: 'Common bladder cancer driver, activating mutation'
  },
  {
    gene: 'PIK3CA',
    mutation_type: 'E545K hotspot',
    mutation_detail: 'E545K helical domain mutation',
    vaf: 15.7,
    clinical_significance: 'pathogenic',
    report_source: 'Foundation One CDx',
    report_date: '2024-12-15',
    notes: 'PI3K pathway activation, oncogenic driver'
  }
];

// Therapies for each mutation
const therapies = {
  ARID1A: [
    {
      therapy_name: 'Tazemetostat (Tazverik)',
      therapy_type: 'EZH2 inhibitor',
      evidence_level: 'FDA_approved',
      clinical_trial_id: null,
      trial_phase: null,
      mechanism: 'Synthetic lethality with ARID1A loss',
      notes: 'FDA approved for other indications, clinical evidence in ARID1A-deficient tumors'
    },
    {
      therapy_name: 'Olaparib',
      therapy_type: 'PARP inhibitor',
      evidence_level: 'Phase_2',
      clinical_trial_id: 'NCT02576444',
      trial_phase: 'Phase 2',
      mechanism: 'DNA repair pathway inhibition',
      notes: 'Synthetic lethality approach'
    },
    {
      therapy_name: 'Temozolomide',
      therapy_type: 'Chemotherapy',
      evidence_level: 'Phase_2',
      clinical_trial_id: null,
      trial_phase: null,
      mechanism: 'DNA alkylating agent, exploits MMR deficiency',
      notes: 'Showing promise in ARID1A-mutant cancers'
    }
  ],
  FGFR3: [
    {
      therapy_name: 'Erdafitinib (Balversa)',
      therapy_type: 'FGFR inhibitor',
      evidence_level: 'FDA_approved',
      clinical_trial_id: null,
      trial_phase: null,
      mechanism: 'Pan-FGFR kinase inhibitor',
      notes: 'FDA approved for FGFR-altered bladder cancer'
    },
    {
      therapy_name: 'Pemigatinib (Pemazyre)',
      therapy_type: 'FGFR inhibitor',
      evidence_level: 'FDA_approved',
      clinical_trial_id: null,
      trial_phase: null,
      mechanism: 'Selective FGFR1/2/3 inhibitor',
      notes: 'FDA approved for cholangiocarcinoma, active in FGFR3 mutations'
    },
    {
      therapy_name: 'Infigratinib',
      therapy_type: 'FGFR inhibitor',
      evidence_level: 'Phase_3',
      clinical_trial_id: 'NCT03410693',
      trial_phase: 'Phase 3',
      mechanism: 'FGFR1/2/3 inhibitor',
      notes: 'Strong clinical trial data in FGFR3-mutant bladder cancer'
    }
  ],
  PIK3CA: [
    {
      therapy_name: 'Alpelisib (Piqray)',
      therapy_type: 'PI3K inhibitor',
      evidence_level: 'FDA_approved',
      clinical_trial_id: null,
      trial_phase: null,
      mechanism: 'Selective PI3Kα inhibitor',
      notes: 'FDA approved for PIK3CA-mutant breast cancer'
    },
    {
      therapy_name: 'Everolimus',
      therapy_type: 'mTOR inhibitor',
      evidence_level: 'FDA_approved',
      clinical_trial_id: null,
      trial_phase: null,
      mechanism: 'mTOR pathway inhibition (downstream of PI3K)',
      notes: 'Blocks PI3K/AKT/mTOR pathway'
    },
    {
      therapy_name: 'Capivasertib',
      therapy_type: 'AKT inhibitor',
      evidence_level: 'Phase_3',
      clinical_trial_id: 'NCT04493853',
      trial_phase: 'Phase 3',
      mechanism: 'Pan-AKT inhibitor',
      notes: 'Promising results in PIK3CA/AKT pathway-altered cancers'
    }
  ]
};

// Pathways affected by mutations
const pathways = {
  ARID1A: [
    {
      pathway_name: 'SWI/SNF chromatin remodeling',
      pathway_role: 'Tumor suppressor',
      impact_description: 'Loss disrupts chromatin accessibility and gene regulation'
    },
    {
      pathway_name: 'EZH2/PRC2 antagonism',
      pathway_role: 'Epigenetic regulation',
      impact_description: 'ARID1A loss leads to EZH2 dependency (synthetic lethality target)'
    }
  ],
  FGFR3: [
    {
      pathway_name: 'FGFR signaling',
      pathway_role: 'Oncogenic driver',
      impact_description: 'Constitutive activation drives cell proliferation and survival'
    },
    {
      pathway_name: 'RAS/MAPK pathway',
      pathway_role: 'Growth signaling',
      impact_description: 'Downstream activation promotes tumor growth'
    }
  ],
  PIK3CA: [
    {
      pathway_name: 'PI3K/AKT/mTOR pathway',
      pathway_role: 'Oncogenic driver',
      impact_description: 'Hyperactivation drives cell growth, survival, and metabolism'
    },
    {
      pathway_name: 'Cell cycle regulation',
      pathway_role: 'Proliferation',
      impact_description: 'Enhanced cell cycle progression and resistance to apoptosis'
    }
  ]
};

console.log('Inserting mutations...');

// Insert mutations and their therapies/pathways
mutations.forEach((mutation) => {
  // Insert mutation
  const mutationStmt = db.prepare(`
    INSERT INTO genomic_mutations 
    (gene, mutation_type, mutation_detail, vaf, clinical_significance, report_source, report_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = mutationStmt.run(
    mutation.gene,
    mutation.mutation_type,
    mutation.mutation_detail,
    mutation.vaf,
    mutation.clinical_significance,
    mutation.report_source,
    mutation.report_date,
    mutation.notes
  );
  
  const mutationId = result.lastInsertRowid;
  console.log(`  ✓ Inserted ${mutation.gene} (ID: ${mutationId}, VAF: ${mutation.vaf}%)`);
  
  // Insert therapies for this mutation
  if (therapies[mutation.gene]) {
    console.log(`    Adding ${therapies[mutation.gene].length} therapies...`);
    therapies[mutation.gene].forEach((therapy) => {
      const therapyStmt = db.prepare(`
        INSERT INTO mutation_therapies
        (mutation_id, therapy_name, therapy_type, evidence_level, clinical_trial_id, trial_phase, mechanism, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      therapyStmt.run(
        mutationId,
        therapy.therapy_name,
        therapy.therapy_type,
        therapy.evidence_level,
        therapy.clinical_trial_id,
        therapy.trial_phase,
        therapy.mechanism,
        therapy.notes
      );
      
      console.log(`      • ${therapy.therapy_name} (${therapy.evidence_level})`);
    });
  }
  
  // Insert pathways for this mutation
  if (pathways[mutation.gene]) {
    console.log(`    Adding ${pathways[mutation.gene].length} pathways...`);
    pathways[mutation.gene].forEach((pathway) => {
      const pathwayStmt = db.prepare(`
        INSERT INTO mutation_pathways
        (mutation_id, pathway_name, pathway_role, impact_description)
        VALUES (?, ?, ?, ?)
      `);
      
      pathwayStmt.run(
        mutationId,
        pathway.pathway_name,
        pathway.pathway_role,
        pathway.impact_description
      );
      
      console.log(`      • ${pathway.pathway_name}`);
    });
  }
  
  console.log('');
});

db.close();
console.log('✅ Genomic data initialization complete!');
console.log('');
console.log('Summary:');
console.log(`  - ${mutations.length} mutations added`);
console.log(`  - ${Object.values(therapies).flat().length} therapies added`);
console.log(`  - ${Object.values(pathways).flat().length} pathways added`);
