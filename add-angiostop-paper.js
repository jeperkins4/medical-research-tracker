import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

const insertPaper = db.prepare(`
  INSERT INTO papers (title, authors, journal, publication_date, url, abstract, type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const title = "Angiostop (Sea Cucumber Extract) Inhibits Multiple Cancer Targets - Multi-RTK Inhibition & Clinical Cases";

const authors = "Tsu-Tsair Chi, NMD, PhD";

const journal = "Townsend Letter";

const publication_date = "2016-12-01";

const url = "https://townsendletter.com/angiostop-sea-cucumber-extract-inhibits-multiple-cancer-targets-chi-sponsored-article/";

const abstract = `Comprehensive review of Angiostop (sea cucumber triterpene glycoside extract) demonstrating multiple anti-cancer mechanisms and clinical applications.

MULTIPLE RTK INHIBITION (5 RECEPTORS):
• VEGFr - Vascular Endothelial Growth Factor Receptor (angiogenesis)
• EGFr - Epidermal Growth Factor Receptor (proliferation)
• PDGFr - Platelet-Derived Growth Factor Receptor (angiogenesis)
• FGFr - Fibroblast Growth Factor Receptor (angiogenesis)
• IGFr - Insulin-like Growth Factor Receptor (proliferation/survival)

RGCC TESTING RESULTS (Colon Cancer Patient):
• IGFr inhibition: 19%
• FGFr inhibition: 24%
• VEGFr inhibition: 26%
• Caspase 3 activation: Increased
• >10% inhibition = "excellent anti-cancer agent"

IGFr CLINICAL SIGNIFICANCE:
• No FDA-approved IGFr inhibitor exists
• IGFr elevated in almost all cancers
• Hyperinsulinemia increases cancer risk dramatically:
  - Colorectal: +17-42%
  - Gastric: +69-101%
  - Breast: +200-300%
  - Liver: +240%
  - Prostate: +562%
  - Endometrial: +4500%

ANGIOGENESIS INHIBITION:
• Disrupts all 3 processes: proliferation, migration, tube formation
• Case: 42-year-old breast cancer, 2 months Angiostop → significant angiogenesis reduction (thermal imaging)
• Starves tumors → apoptosis

APOPTOSIS INDUCTION:
• Activates Caspase 3, 7, 8, 9
• ↑ Pro-apoptotic: Bax, BAD, Cytochrome C
• ↓ Anti-apoptotic: Bcl-2, survivin
• Intrinsic pathway activation

ADDITIONAL MECHANISMS:
• PTEN activation (tumor suppressor missing in 70% prostate cancers)
• PGE2 receptor antagonism (EP2/EP4) → reduced metastasis
• Topoisomerase 2-alpha inhibition (DNA level, no toxicity)
• Downstream suppression: Akt, ERK, FAK, paxillin

SYNERGY WITH TARGETED DRUGS:

CASE: Angiosarcoma + Sutent
• 81-year-old, breast angiosarcoma recurrence
• Sutent alone (even doubled): No effect
• Sutent reduced + Angiostop added: Cleared in 4 months
• Reason: Sutent only inhibits VEGFr/PDGFr; Angiostop adds EGFr/FGFr/IGFr

CASE: Kidney Cancer + Sutent
• Male 60s, Sutent reduced tumor to 2cm
• Added Angiostop + Revivin: 1cm in 4 months, cleared after 1 year

CASE: Lung Cancer + Tarceva
• Antoine E., 60-year-old, Stage 4 adenocarcinoma (grapefruit size)
• Given 3-6 months
• Tarceva + Angiostop + Myomin + Revivin + others
• Dec 2013: PET scan NO TUMOR
• Oncologist: "Only patient on Tarceva living that long" (9 months typical)

CASE: Prostate Cancer
• Dino F., 51-year-old, PSA 5.9 after testosterone therapy
• Angiostop + Myomin + Revivin for 1.5 years
• PSA: 5.9 → 2.8
• Weight: 298 → 220 lbs

BLADDER CANCER PDX MODELS:
• PDX B521: Angiostop outperformed Padcev and cisplatin/gemcitabine
• PDX BLCU-003: Superior efficacy vs Padcev
• Dose-dependent responses
• Multiple complete responses

TRIPLE NEGATIVE BREAST CANCER CASE:
• 52-year-old, Grade 3 ER-/PR-/HER2- invasive ductal carcinoma
• Declined full-dose chemo after lumpectomy
• Protocol: Angiostop + Revivin
• CTC: 9.4 cells/7.5ml → 0 in 3 months
• All tumor markers normal (CEA, CA 15-3, CA 27-29)
• RGCC testing showed high risk for VEGFr, FGFr, PDGFr, EGFr → all inhibited by Angiostop

SURGERY PROTECTION:
• 50% recurrence risk within 2 years after breast/colon/lung surgery
• Surgery healing triggers angiogenic factors
• Recommendation: Angiostop BEFORE and AFTER any invasive procedure
• Critical for biopsy, colonoscopy, endoscopy, cystectomy

COLORECTAL CANCER + AVASTIN/5FU:
• Patient CEA: 8 → 6.9 after 5 weeks Avastin + 5FU
• Added Angiostop: CEA 6.9 → 3.6 in 4 weeks
• Much faster response with Angiostop addition

LONG-TERM USE CASE:
• 70-year-old smoker, blood in stool
• Started Angiostop + Myomin + Revivin immediately (June 2011)
• Sept 2012 (age 65): Lung cancer surgery, no metastasis (surgeon amazed)
• March 2013: Colon cancer surgery
• Added Tarceva Jan 2015, continued Angiostop + Myomin
• CEA well-managed 2013-2016 (4+ years)
• Quality of life maintained

RESEARCH GENETIC CANCER CENTRE (RGCC) VALIDATION:
• Greece-based, personalizes testing on CTCs
• Dr. Ray Hammond: "Very potent, effective on 6-7 cancer types"
• Tested: breast, lung, prostate, colorectal, pancreatic, liver
• Consistent inhibition across multiple cancer types

SAFETY PROFILE:
• Minimal or no side effects
• Well-tolerated long-term (years of use)
• No acute toxicity in studies
• Synergistic with chemo (enhanced effect, no added toxicity)
• Enhanced gemcitabine in pancreatic cancer
• Enhanced cisplatin with no side effects
• Enhanced Avastin + 5FU response

ADVANTAGES OVER SINGLE-TARGET DRUGS:
• Most targeted drugs: 1-2 RTKs only
• Angiostop: 5 RTKs simultaneously
• Cancer expresses multiple RTKs (breast, prostate, lung, colorectal, ovarian, brain, pancreatic = all 5)
• Single-target = partial suppression → poor prognosis/recurrence
• Multi-target = comprehensive suppression

CHINESE MEDICINE HISTORY:
• Used for centuries for stomach ulcer and stomach cancer
• Modern identification of active compounds: triterpene glycosides
• Scientific validation of traditional use

CLINICAL TRIAL SYNERGY EVIDENCE:
• Pancreatic cancer: Sea cucumber enhanced gemcitabine (more effective than either alone)
• Cisplatin combination: Enhanced activity, no side effects
• Multiple preclinical models validate synergy

COMPARISON TO ANGIOSTOP:
Unlike drugs with limited RTK targets:
• Nexavar (kidney/liver/thyroid): Only 3 months survival increase
• Tarceva (EGFR): 9-10 months effectiveness, then resistance
• Angiostop: Years of effectiveness, no resistance development

CLINICAL RECOMMENDATIONS:
• Surgical patients: Start before and continue after procedures
• Active treatment: Combine with conventional therapy
• Maintenance: Continue long-term for prevention
• Low disease burden: Start early for best results

DOSING:
• Typically 800-1200mg daily in divided doses
• Higher doses for active disease
• Maintenance doses for prevention
• No toxicity dose-limiting factors

FUTURE DIRECTIONS:
• Larger clinical trials needed
• Optimal dosing protocols
• Combination therapy guidelines
• Biomarker development for response prediction`;

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
  'angiostop',
  'sea-cucumber',
  'triterpene-glycosides',
  'multi-rtk-inhibitor',
  'vegfr',
  'egfr',
  'pdgfr',
  'fgfr',
  'igfr',
  'angiogenesis-inhibition',
  'bladder-cancer',
  'apoptosis',
  'integrative-oncology',
  'natural-compounds',
  'case-reports',
  'synergy-chemotherapy',
  'hyperinsulinemia',
  'metabolic-oncology',
  'surgical-protection',
  'long-term-use'
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
