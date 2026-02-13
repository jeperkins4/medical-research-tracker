import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Add the ETx-22 research paper
const insertPaper = db.prepare(`
  INSERT INTO papers (title, authors, journal, publication_date, url, abstract, type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const title = "ETx-22, a Novel Nectin-4-Directed Antibody-Drug Conjugate - Active in Low-Nectin-4-Expressing & MMAE-Resistant Tumors";

const authors = "Marc Lopez, Emerence Crompot, Emmanuelle Josselin, Daniel Olive, et al. (Emergence Therapeutics)";

const journal = "Cancer Research Communications";

const publication_date = "2024-11-01";

const url = "https://pubmed.ncbi.nlm.nih.gov/39440991/";

const abstract = `ETx-22 is a novel antibody-drug conjugate (ADC) combining a tumor nectin-4-specific antibody with an innovative linker to exatecan (topoisomerase I inhibitor). Demonstrates significant advantages over MMAE-based ADCs including enfortumab vedotin (Padcev).

KEY DIFFERENTIATORS FROM PADCEV/BT8009:

PAYLOAD:
• ETx-22: Exatecan (topoisomerase I inhibitor)
• Padcev/BT8009: MMAE (microtubule inhibitor)
• Different mechanism = potential to overcome MMAE resistance

ACTIVITY PROFILE:
• Active in LOW Nectin-4-expressing tumors
• Active in MMAE-resistant tumor models
• Better toxicity profile vs MMAE-based ADCs
• Significant and durable responses in preclinical models

BLADDER CANCER PDX RESULTS:
• PDX B521 (bladder cancer): ETx-22 outperformed EV and cisplatin/gemcitabine
• PDX BLCU-003 (bladder cancer): Superior efficacy vs EV
• Both models showed dose-dependent response
• Multiple complete responses observed

OTHER TUMOR TYPES TESTED:
• Breast cancer (SUM190, TNBC models): Complete responses in MMAE-resistant tumors
• Ovarian cancer (PDX OV2018, OV2423): Superior to carboplatin and EV
• Demonstrates broad applicability across Nectin-4+ cancers

MECHANISM OF ACTION:
• Highly selective binding to Nectin-4 IgV domain
• Drug-to-antibody ratio (DAR): 8
• Rapid tumor penetration
• Excellent serum stability (mouse, cynomolgus, human)
• Topoisomerase I inhibition → DNA damage → apoptosis
• Phosphorylated H2A.X confirms mechanism in tumors

EPITOPE SPECIFICITY:
• Novel epitope on Nectin-4 (different from other Nectin-4 ADCs)
• Preferential tumor targeting vs normal keratinocytes
• Higher selectivity ratio (tumor/normal tissue) than reference antibodies
• Cross-reactive with cynomolgus Nectin-4 (enables primate safety studies)

SAFETY ADVANTAGES:
• Better toxicity profile than MMAE-based ADCs
• Reduced off-target effects on normal keratinocytes
• Well-tolerated in preclinical models
• Lower doses required for efficacy

PHARMACOKINETICS:
• Stable DAR in circulation (minimal premature payload release)
• Low free exatecan in plasma (reduced systemic toxicity)
• Tumor-selective accumulation demonstrated by IHC
• Time-dependent tumor penetration and PD activity

CLINICAL IMPLICATIONS:
• Potential for patients who progress on Padcev (MMAE resistance)
• May expand patient population (active in low Nectin-4 expressors)
• Different toxicity profile allows alternative for Padcev-intolerant patients
• Could potentially combine with checkpoint inhibitors (different mechanism)

DEVELOPMENT STATUS:
• Preclinical/early development
• Published in peer-reviewed journal (Cancer Res Commun 2024)
• Emergence Therapeutics developing
• Multiple patents filed

STRATEGIC VALUE:
ETx-22 represents next-generation Nectin-4 targeting with distinct advantages:
1. Overcomes MMAE resistance
2. Active in low-target-expressing tumors
3. Better safety profile
4. Validated in bladder cancer models

DOI: 10.1158/2767-9764.CRC-24-0176
PMID: 39440991`;

const type = 'conventional';

const info = insertPaper.run(
  title,
  authors,
  journal,
  publication_date,
  url,
  abstract,
  type
);

const paperId = info.lastInsertRowid;

console.log(`✓ Added paper: "${title}" (ID: ${paperId})`);

// Add tags
const insertTag = db.prepare(`
  INSERT OR IGNORE INTO tags (name) VALUES (?)
`);

const insertPaperTag = db.prepare(`
  INSERT INTO paper_tags (paper_id, tag_id)
  SELECT ?, id FROM tags WHERE name = ?
`);

const tags = [
  'etx-22',
  'nectin-4',
  'antibody-drug-conjugate',
  'exatecan',
  'topoisomerase-inhibitor',
  'bladder-cancer',
  'urothelial-carcinoma',
  'mmae-resistance',
  'low-expression-tumors',
  'emergence-therapeutics',
  'preclinical',
  'pdx-models',
  'padcev-alternative',
  'next-generation-adc'
];

tags.forEach(tag => {
  insertTag.run(tag);
  insertPaperTag.run(paperId, tag);
  console.log(`  ✓ Tagged: ${tag}`);
});

// Verify
const paper = db.prepare(`
  SELECT p.*, GROUP_CONCAT(t.name, ', ') as tags
  FROM papers p
  LEFT JOIN paper_tags pt ON p.id = pt.paper_id
  LEFT JOIN tags t ON pt.tag_id = t.id
  WHERE p.id = ?
  GROUP BY p.id
`).get(paperId);

console.log('\n📄 Paper added successfully:');
console.log(`Title: ${paper.title}`);
console.log(`Journal: ${paper.journal}`);
console.log(`URL: ${paper.url}`);
console.log(`Tags: ${paper.tags}`);
console.log(`\nView at: http://localhost:5173/research`);

db.close();
