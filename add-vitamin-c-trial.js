import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Add the IV Vitamin C clinical trial paper
const insertPaper = db.prepare(`
  INSERT INTO papers (title, authors, journal, publication_date, url, abstract, type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const title = "IV vitamin C with chemotherapy for cisplatin ineligible bladder cancer patients (CI-MIBC) - NCT04046094";

const authors = "Rahul Atul Parikh, John A. Taylor, Qi Chen, Benjamin L. Woolbright, Ping Chen, Elizabeth Marie Wulff-Burchfield, Jeffrey";

const journal = "Journal of Clinical Oncology (2022 ASCO Annual Meeting)";

const publication_date = "2022-06-01";

const url = "https://ascopubs.org/doi/10.1200/JCO.2022.40.16_suppl.e16540";

const abstract = `Clinical trial NCT04046094 tested IV vitamin C with gemcitabine and carboplatin (GCa) for cisplatin-ineligible bladder cancer patients.

KEY RESULTS (12 patients):
• 30% pathological downstaging (4/12 patients)
• 25% complete response among responders
• Zero treatment-related adverse events
• Met continuation criteria for Phase 2 study

PROTOCOL:
• Gemcitabine + carboplatin + IV vitamin C
• Dosed to plasma concentration 350-400 mg/dL (~20 mM)
• 21-day cycle before cystectomy
• Mean follow-up: 10.8 months

BACKGROUND:
40-50% of bladder cancer patients are cisplatin-ineligible (renal insufficiency, hearing loss, poor performance status). GCa alone has limited success. Many proceed directly to cystectomy without neoadjuvant chemotherapy benefit.

SUPPORTING EVIDENCE:
• Ovarian cancer (NCT00772798): IV vitamin C + paclitaxel/carboplatin → PFS 25.5 vs 16.75 months (9-month improvement)
• Pancreatic cancer (NCT00954525): IV vitamin C + gemcitabine ± erlotinib → unexpected stable disease & prolonged survival

CLINICAL RELEVANCE:
Supports bi-weekly IV vitamin C infusions combined with systemic therapy such as checkpoint inhibitors and antibody-drug conjugates. Protocol aligns with emerging integrative oncology evidence.

MECHANISM:
High-dose IV vitamin C acts as pro-oxidant in cancer cells via hydrogen peroxide generation. Selectively cytotoxic to cancer cells while enhancing chemotherapy sensitivity and reducing treatment toxicity.

DOI: 10.1200/JCO.2022.40.16_suppl.e16540`;

const type = 'integrative';

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
  'vitamin-c',
  'iv-vitamin-c',
  'integrative-oncology',
  'bladder-cancer',
  'urothelial-carcinoma',
  'clinical-trial',
  'gemcitabine-carboplatin',
  'angiogenesis',
  'phase-1-trial',
  'nct04046094'
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
