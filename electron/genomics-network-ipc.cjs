/**
 * Genomics Network IPC
 * Builds Cytoscape-compatible mutation-pathway-treatment network from:
 *   1. The SQLite DB (mutation_therapies, mutation_pathways)
 *   2. A curated knowledge base for known bladder cancer mutations
 */

// ── Curated knowledge base ────────────────────────────────────────────────
// Organized by gene → pathways → treatments
// treatment_category: 'chemo' | 'immunotherapy' | 'targeted' | 'supplement'
const KNOWLEDGE_BASE = {
  ARID1A: {
    pathways: ['SWI/SNF chromatin remodeling', 'EZH2/PRC2 antagonism', 'DNA damage repair'],
    treatments: [
      { name: 'Tazemetostat (EZH2i)', category: 'targeted',      evidence: 'FDA_approved', mechanism: 'EZH2 inhibitor — synthetic lethal with ARID1A loss' },
      { name: 'Olaparib (PARPi)',      category: 'targeted',      evidence: 'Phase_2',      mechanism: 'PARP inhibitor — exploits DNA repair defect' },
      { name: 'Pembrolizumab',         category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade — ARID1A loss increases TMB/MSI' },
      { name: 'Atezolizumab',          category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-L1 blockade' },
      { name: 'Gemcitabine/Cisplatin', category: 'chemo',         evidence: 'standard',     mechanism: 'First-line bladder cancer chemotherapy' },
      { name: 'Berberine',             category: 'supplement',    evidence: 'preclinical',  mechanism: 'EZH2 downregulation, epigenetic remodeling' },
      { name: 'Curcumin',              category: 'supplement',    evidence: 'preclinical',  mechanism: 'NF-κB inhibition, SWI/SNF pathway modulation' },
      { name: 'EGCG (Green Tea)',      category: 'supplement',    evidence: 'preclinical',  mechanism: 'DNMT inhibitor, epigenetic target' },
    ]
  },
  CDKN1A: {
    pathways: ['Cell cycle G1/S checkpoint', 'p53 signaling', 'CDK4/6 regulation'],
    treatments: [
      { name: 'Palbociclib (CDK4/6i)', category: 'targeted',      evidence: 'Phase_2',   mechanism: 'CDK4/6 inhibitor — restores G1 arrest' },
      { name: 'Pembrolizumab',          category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade — CDKN1A loss predicts benefit' },
      { name: 'Gemcitabine/Cisplatin',  category: 'chemo',         evidence: 'standard',  mechanism: 'Standard bladder chemo — exploits cell cycle defect' },
      { name: 'Resveratrol',            category: 'supplement',    evidence: 'preclinical', mechanism: 'CDK inhibition, p53 pathway activation' },
      { name: 'Quercetin',              category: 'supplement',    evidence: 'preclinical', mechanism: 'CDK2/cyclin E inhibition' },
    ]
  },
  MLL2: {
    pathways: ['Histone H3K4 methylation', 'Transcriptional regulation', 'Tumor suppressor epigenetics'],
    treatments: [
      { name: 'Pembrolizumab',         category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'MLL2 mutations increase TMB — IO benefit' },
      { name: 'Nivolumab',             category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade' },
      { name: 'Gemcitabine/Cisplatin', category: 'chemo',         evidence: 'standard',     mechanism: 'Platinum-based first-line therapy' },
      { name: 'EGCG (Green Tea)',      category: 'supplement',    evidence: 'preclinical',  mechanism: 'Histone methyltransferase modulation' },
      { name: 'SAM (S-adenosyl methionine)', category: 'supplement', evidence: 'preclinical', mechanism: 'Methyl donor for histone methylation' },
    ]
  },
  TERT: {
    pathways: ['Telomere maintenance', 'Wnt/β-catenin signaling', 'Cell immortalization'],
    treatments: [
      { name: 'Pembrolizumab',         category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'TERT promoter mutations are immunogenic neoantigens' },
      { name: 'Imetelstat',            category: 'targeted',      evidence: 'Phase_2',      mechanism: 'Telomerase inhibitor — direct TERT target' },
      { name: 'BCG immunotherapy',     category: 'immunotherapy', evidence: 'standard',     mechanism: 'Standard non-invasive bladder cancer immunotherapy' },
      { name: 'Astragalus (Huangqi)',  category: 'supplement',    evidence: 'preclinical',  mechanism: 'Telomerase modulation, immune support' },
      { name: 'Curcumin',             category: 'supplement',    evidence: 'preclinical',  mechanism: 'TERT expression downregulation' },
    ]
  },
  FGFR2: {
    pathways: ['FGFR signaling', 'RAS/MAPK pathway', 'PI3K/AKT/mTOR pathway'],
    treatments: [
      { name: 'Erdafitinib (Balversa)', category: 'targeted',     evidence: 'FDA_approved', mechanism: 'Pan-FGFR inhibitor — FDA approved for FGFR2/3 bladder cancer' },
      { name: 'Infigratinib',           category: 'targeted',     evidence: 'Phase_3',      mechanism: 'Selective FGFR1-3 inhibitor' },
      { name: 'Futibatinib',            category: 'targeted',     evidence: 'Phase_2',      mechanism: 'Covalent FGFR1-4 inhibitor' },
      { name: 'Gemcitabine/Cisplatin',  category: 'chemo',        evidence: 'standard',     mechanism: 'Standard first-line chemotherapy' },
      { name: 'Curcumin',              category: 'supplement',   evidence: 'preclinical',  mechanism: 'FGFR pathway downregulation' },
    ]
  },
  FGFR3: {
    pathways: ['FGFR3 signaling', 'RAS/MAPK pathway', 'PI3K/AKT/mTOR pathway'],
    treatments: [
      { name: 'Erdafitinib (Balversa)', category: 'targeted',     evidence: 'FDA_approved', mechanism: 'FDA-approved FGFR3 inhibitor — first genomically targeted bladder therapy' },
      { name: 'Pemigatinib',            category: 'targeted',     evidence: 'FDA_approved', mechanism: 'Selective FGFR1/2/3 inhibitor' },
      { name: 'Infigratinib',           category: 'targeted',     evidence: 'Phase_3',      mechanism: 'Selective FGFR1-3 inhibitor' },
      { name: 'Pembrolizumab',          category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade — used for FGFR3-mutant bladder' },
      { name: 'Gemcitabine/Cisplatin',  category: 'chemo',        evidence: 'standard',     mechanism: 'Standard first-line chemotherapy' },
    ]
  },
  AXIN1: {
    pathways: ['Wnt/β-catenin signaling', 'APC destruction complex', 'Cell proliferation'],
    treatments: [
      { name: 'WNT974 (LGK-974)',      category: 'targeted',      evidence: 'Phase_1',     mechanism: 'Porcupine inhibitor — blocks Wnt ligand secretion' },
      { name: 'Pembrolizumab',         category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade' },
      { name: 'Docetaxel',             category: 'chemo',         evidence: 'standard',     mechanism: 'Second-line chemotherapy for bladder cancer' },
      { name: 'Curcumin',             category: 'supplement',    evidence: 'preclinical',  mechanism: 'Wnt/β-catenin pathway inhibition' },
      { name: 'Resveratrol',          category: 'supplement',    evidence: 'preclinical',  mechanism: 'β-catenin degradation induction' },
    ]
  },
  ROS1: {
    pathways: ['ROS1 kinase signaling', 'JAK/STAT pathway', 'PI3K/AKT/mTOR pathway'],
    treatments: [
      { name: 'Entrectinib (Rozlytrek)', category: 'targeted',    evidence: 'FDA_approved', mechanism: 'ROS1/NTRK inhibitor — FDA approved for ROS1 fusions' },
      { name: 'Crizotinib',             category: 'targeted',     evidence: 'FDA_approved', mechanism: 'ROS1/ALK inhibitor' },
      { name: 'Lorlatinib',             category: 'targeted',     evidence: 'Phase_2',      mechanism: 'Next-gen ROS1 inhibitor for resistance' },
      { name: 'Pembrolizumab',          category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade' },
      { name: 'Gemcitabine/Cisplatin',  category: 'chemo',        evidence: 'standard',     mechanism: 'Standard first-line chemotherapy' },
    ]
  },
  PIK3CA: {
    pathways: ['PI3K/AKT/mTOR pathway', 'Cell survival signaling', 'mTOR complex regulation'],
    treatments: [
      { name: 'Alpelisib (Piqray)',  category: 'targeted',      evidence: 'FDA_approved', mechanism: 'PI3Kα inhibitor — FDA approved for PIK3CA-mutant cancers' },
      { name: 'Everolimus',         category: 'targeted',      evidence: 'FDA_approved', mechanism: 'mTOR inhibitor — PI3K pathway downstream' },
      { name: 'Capivasertib',       category: 'targeted',      evidence: 'Phase_3',      mechanism: 'AKT inhibitor' },
      { name: 'Pembrolizumab',      category: 'immunotherapy', evidence: 'FDA_approved', mechanism: 'PD-1 blockade' },
      { name: 'Gemcitabine/Cisplatin', category: 'chemo',      evidence: 'standard',     mechanism: 'First-line bladder chemotherapy' },
      { name: 'Berberine',          category: 'supplement',    evidence: 'preclinical',  mechanism: 'PI3K/AKT/mTOR pathway inhibition' },
      { name: 'Resveratrol',        category: 'supplement',    evidence: 'preclinical',  mechanism: 'PI3K/mTOR dual inhibition' },
    ]
  }
};

const CATEGORY_COLORS = {
  chemo:         '#7c3aed', // purple
  immunotherapy: '#0369a1', // blue
  targeted:      '#b45309', // amber
  supplement:    '#166534', // green
};

const CATEGORY_LABELS = {
  chemo:         'Chemotherapy',
  immunotherapy: 'Immunotherapy',
  targeted:      'Targeted Therapy',
  supplement:    'Supplement',
};

/**
 * Build Cytoscape-compatible network from DB mutations + knowledge base
 * @param {string} dbPath - Path to health-secure.db
 */
function buildMutationNetwork(dbPath) {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  function addNode(id, data) {
    if (!nodeSet.has(id)) {
      nodes.push({ data: { id, ...data } });
      nodeSet.add(id);
    }
  }

  // Get mutations from DB
  let mutations = [];
  try {
    mutations = db.prepare('SELECT id, gene, mutation_detail, vaf, clinical_significance FROM genomic_mutations ORDER BY vaf DESC NULLS LAST').all();
  } catch (e) {
    console.warn('[NetworkIPC] Could not fetch mutations:', e.message);
    return { nodes: [], edges: [] };
  }

  // Get DB therapies for each mutation
  const dbTherapies = {};
  try {
    const rows = db.prepare('SELECT mutation_id, therapy_name, therapy_type, evidence_level, mechanism FROM mutation_therapies').all();
    for (const r of rows) {
      if (!dbTherapies[r.mutation_id]) dbTherapies[r.mutation_id] = [];
      dbTherapies[r.mutation_id].push(r);
    }
  } catch {}

  for (const mut of mutations) {
    const gene = (mut.gene || '').trim().toUpperCase();
    const mutId = `mut_${mut.id}`;

    addNode(mutId, {
      label: gene,
      type: 'mutation',
      alteration: mut.mutation_detail || '',
      vaf: mut.vaf,
      significance: mut.clinical_significance || 'unknown',
    });

    // Pathways from knowledge base
    const kb = KNOWLEDGE_BASE[gene] || {};
    const pathways = kb.pathways || [];
    for (const pw of pathways) {
      const pwId = `pw_${pw.replace(/\W+/g, '_')}`;
      addNode(pwId, { label: pw, type: 'pathway' });
      edges.push({ data: { id: `e_${mutId}_${pwId}`, source: mutId, target: pwId, rel: 'drives' } });
    }

    // Treatments from knowledge base
    const kbTreatments = kb.treatments || [];

    // Also add DB therapies not already in KB
    const dbT = dbTherapies[mut.id] || [];
    const allTreatments = [...kbTreatments];
    for (const t of dbT) {
      const alreadyHave = allTreatments.find(x => x.name.toLowerCase().includes(t.therapy_name.toLowerCase().split(' ')[0].toLowerCase()));
      if (!alreadyHave) {
        // Map therapy_type to category
        const cat = t.therapy_type?.toLowerCase().includes('chemo') ? 'chemo'
                  : t.therapy_type?.toLowerCase().includes('immuno') || t.therapy_type?.toLowerCase().includes('checkpoint') ? 'immunotherapy'
                  : t.therapy_type?.toLowerCase().includes('supplement') ? 'supplement'
                  : 'targeted';
        allTreatments.push({ name: t.therapy_name, category: cat, evidence: t.evidence_level, mechanism: t.mechanism });
      }
    }

    for (const tx of allTreatments) {
      const txId = `tx_${tx.name.replace(/\W+/g, '_').toLowerCase()}`;
      addNode(txId, {
        label: tx.name,
        type: 'treatment',
        category: tx.category,
        categoryLabel: CATEGORY_LABELS[tx.category] || tx.category,
        color: CATEGORY_COLORS[tx.category] || '#64748b',
        evidence: tx.evidence,
        mechanism: tx.mechanism,
      });
      edges.push({
        data: {
          id: `e_${mutId}_${txId}`,
          source: mutId,
          target: txId,
          rel: 'targeted_by',
          category: tx.category,
        }
      });
    }
  }

  try { db.close(); } catch {}
  return { nodes, edges, mutations };
}

module.exports = { buildMutationNetwork, KNOWLEDGE_BASE, CATEGORY_COLORS, CATEGORY_LABELS };
