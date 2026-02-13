import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Add the BT8009/Zelenectide Pevedotin clinical trial paper
const insertPaper = db.prepare(`
  INSERT INTO papers (title, authors, journal, publication_date, url, abstract, type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const title = "BT8009 (Zelenectide Pevedotin) - Nectin-4 Targeting Bicycle Toxin Conjugate for Urothelial Cancer";

const authors = "Bicycle Therapeutics (Multiple investigators across Phase 1/2 DURAVELO-1 trial)";

const journal = "Multiple presentations: AACR 2022, ASCO 2023-2025, Journal of Medicinal Chemistry";

const publication_date = "2022-2025";

const url = "https://clinicaltrials.gov/study/NCT04561362";

const abstract = `BT8009 (now named zelenectide pevedotin) is a novel Bicycle Toxin Conjugate (BTC) targeting Nectin-4, conjugated to MMAE. It represents a new class of therapeutics for advanced/metastatic urothelial cancer.

PHASE 1/2 DURAVELO-1 TRIAL (NCT04561362):

MONOTHERAPY RESULTS:
• Overall Response Rate (ORR): 45-50%
• Clinical Benefit Rate: 75%
• Disease Control Rate: 75%
• Confirmed partial responses in heavily pre-treated patients
• Generally manageable safety profile
• Well-tolerated with preliminary antitumor activity

COMBINATION WITH PEMBROLIZUMAB (Keytruda):
• ORR: 65% in cisplatin-ineligible, previously untreated patients
• Demonstrates synergy between Nectin-4 targeting and PD-1 checkpoint inhibition
• Promising results in first-line setting

FDA DESIGNATIONS:
• Fast Track Designation granted (January 2023)
• Expedited development pathway aligned with FDA

PHASE 2/3 DURAVELO-2 TRIAL:
• Registrational trial design for potential accelerated approval
• Launched Q1 2024
• Target enrollment: ≤956 patients in 2 cohorts
  - Cohort 1: Previously untreated, platinum-eligible (≤641 patients)
  - Cohort 2: ≥1 prior systemic therapy, excluding enfortumab vedotin (≤315 patients)

MECHANISM OF ACTION:
• Highly selective Nectin-4 binding via bicyclic peptide
• MMAE payload (same as enfortumab vedotin/Padcev)
• Small molecule size allows better tumor penetration than antibodies
• Rapid renal clearance reduces systemic toxicity
• Nectin-4 overexpressed in ~90% of urothelial cancers

COMPETITIVE ADVANTAGE vs PADCEV (Enfortumab Vedotin):
• Smaller molecular size → improved tumor penetration
• Faster clearance → potentially better tolerability
• Similar mechanism but different delivery platform
• Early data suggests comparable efficacy with different toxicity profile

CLINICAL CONTEXT:
• Validates Nectin-4 as critical therapeutic target
• Following success of enfortumab vedotin (PADCEV), now first-line standard
• BT8009 offers alternative for patients who progress on or are ineligible for PADCEV
• Combination with checkpoint inhibitors shows synergy`;

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
  'bt8009',
  'zelenectide-pevedotin',
  'nectin-4',
  'bicycle-toxin-conjugate',
  'bladder-cancer',
  'urothelial-carcinoma',
  'clinical-trial',
  'phase-2-3',
  'targeted-therapy',
  'mmae',
  'fast-track',
  'pembrolizumab-combination',
  'nct04561362',
  'duravelo-1',
  'duravelo-2'
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
