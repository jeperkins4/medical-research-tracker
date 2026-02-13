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

const insertTag = db.prepare(`
  INSERT OR IGNORE INTO tags (name) VALUES (?)
`);

const insertPaperTag = db.prepare(`
  INSERT INTO paper_tags (paper_id, tag_id)
  SELECT ?, id FROM tags WHERE name = ?
`);

// Paper 1: Systematic Review
const paper1 = {
  title: "Naltrexone's Impact on Cancer Progression and Mortality: A Systematic Review",
  authors: "Karina Liubchenko, Gaby I. Lattarulo, Chelsea I. Malamud, et al.",
  journal: "Advances in Therapy",
  publication_date: "2021-02-01",
  url: "https://pubmed.ncbi.nlm.nih.gov/33337537/",
  abstract: `Systematic review examining naltrexone's role in cancer therapy across human, animal, and cell culture studies.

KEY FINDINGS:

CLINICAL EVIDENCE:
• Case reports demonstrate NOTABLE SURVIVAL DURATIONS and METASTATIC RESOLUTIONS in late-stage cancer patients
• Average LDN dose: 3-5 mg/day
• Well-tolerated with minimal side effects

DOSING INSIGHT - CRITICAL:
• LOW doses + INTERMITTENT treatment → hinder cell proliferation, impede tumorigenesis
• HIGH doses + CONTINUOUS administration → can FOSTER cancer progression
• Duration of receptor blockade determines biotherapeutic response

MECHANISMS:
• Transient opioid receptor blockade (4-6 hours)
• Compensatory upregulation of endogenous opioid system
• OGF-OGFr axis modulation → cell cycle arrest
• Immune system enhancement

CANCER TYPES SHOWING BENEFIT:
• Bladder cancer
• Breast cancer
• Liver cancer
• Lung cancer
• Lymph nodes
• Colon and rectum
• Pancreatic cancer
• Melanoma
• Prostate cancer

ANIMAL/CELL CULTURE DATA:
• Overarching principle: High doses/continuous = pro-cancer; Low doses/intermittent = anti-cancer
• Consistent across multiple tumor models
• Supports human case report observations

IMPLICATIONS:
• LDN shows promising anticancer potential
• Optimal dosing schedule matters (not just dose)
• Need for larger controlled human trials
• Non-toxic, inexpensive adjuvant option

LIMITATIONS:
• Limited large-scale human trials
• Most evidence from case reports and preclinical studies
• Mechanisms not fully elucidated

CONCLUSION:
Review emphasizes value of future research on naltrexone in cancer therapy. Warrants better understanding of underlying mechanisms and controlled studies with robust sample sizes.

DOI: 10.1007/s12325-020-01591-9
PMID: 33337537`,
  type: 'integrative',
  tags: ['ldn', 'low-dose-naltrexone', 'systematic-review', 'bladder-cancer', 'ogf-ogfr-axis', 'immune-modulation', 'integrative-oncology', 'case-reports', 'metastatic-cancer', 'survival-benefit']
};

// Paper 2: Comprehensive Review
const paper2 = {
  title: "Low-Dose Naltrexone as an Adjuvant in Combined Anticancer Therapy - Comprehensive Mechanisms Review",
  authors: "Multiple authors (Polish research consortium)",
  journal: "Cancers (Basel)",
  publication_date: "2024-03-01",
  url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10968813/",
  abstract: `Comprehensive 2024 review of low-dose naltrexone mechanisms, synergy with conventional therapies, and clinical applications.

MECHANISM OF ACTION:

OGF-OGFr AXIS:
• Transient blockade (4-6 hours) → 18-20 hour upregulation window
• OGF (Met-enkephalin) binds OGFr on nuclear membrane
• Moves into nucleus → activates p16/p21 → G1/S cell cycle arrest
• Present in 90% of human cancers (47+ different cancer types)

IMMUNE MODULATION:
• ↑ NK cell cytotoxic activity
• ↑ CD8+ T lymphocyte proliferation
• M2 → M1 macrophage polarization (anti-tumor)
• ↑ IL-2, IFN-γ, IL-6 production
• ↓ IL-10 (immunosuppressive cytokine)
• Enhanced phagocytic activity

APOPTOSIS INDUCTION:
• ↑ Pro-apoptotic: Bax, BAD, Caspase 3, 7, 8, 9
• ↓ Anti-apoptotic: Bcl-2, survivin
• Activates intrinsic apoptosis pathway

ADDITIONAL MECHANISMS:
• PTEN tumor suppressor activation (missing in 70% prostate cancers)
• PGE2 receptor antagonism (EP2/EP4) → reduced metastasis
• Topoisomerase 2-alpha inhibition (DNA level)
• TLR-4 antagonism (anti-inflammatory)

SYNERGY WITH CONVENTIONAL THERAPY:

WITH CHEMOTHERAPY:
• LDN + Cisplatin: 3x higher apoptosis, 42-44% reduced angiogenesis (ovarian cancer)
• LDN + Carboplatin: Higher CD8+ T cells, reduced hematologic toxicity, improved survival (breast cancer)
• LDN + 5-Fluorouracil: Enhanced apoptosis, increased p21/p53, decreased Bcl-2 (ovarian cancer)
• LDN + Gemcitabine: Synergistic effect in pancreatic cancer

WITH IMMUNOTHERAPY:
• LDN + IL-2: Enhanced anticancer activity, increased lymphocyte counts
• LDN + Checkpoint inhibitors: Theoretical synergy (immune activation)

WITH TARGETED THERAPY:
• LDN + Propranolol: G2/M arrest, elevated apoptotic proteins (breast cancer)
• LDN + Vitamin D: Tumor regression, improved outcomes (case reports)
• LDN + α-Lipoic Acid: Metastatic resolution, dormant state induction (RCC, pancreatic)

BLADDER CANCER CASE:
• 65-year-old with high-grade muscle-invasive bladder cancer
• Declined cystectomy
• LDN + single BCG course → COMPLETE REMISSION in 4 months
• 7+ YEARS cancer-free
• Demonstrates synergy with immunotherapy

IN VITRO/IN VIVO EVIDENCE:
• Cervical cancer: ↓ proliferation, migration, invasion
• Colorectal cancer: Selective growth inhibition, apoptosis induction
• Ovarian cancer xenografts: 39% tumor burden reduction
• Oral squamous cell: Reduced tumor volume/mass, ↓ DNA synthesis
• Non-small cell lung: 50-80% invasion inhibition

DOSING & SAFETY:
• Standard: 1.5-4.5 mg nightly
• Well-tolerated, minimal side effects
• Main SE: Transient sleep disruption (resolves in 2 weeks)
• No hepatotoxicity at low doses (<300 mg)
• Long-term use safe and effective

CONTRAINDICATIONS:
• Active full-dose opioid use (competitive antagonism)
• Caution with opioid pain management

CLINICAL CONSIDERATIONS:
• Best as ADJUVANT (not monotherapy)
• Optimal with adequate vitamin D levels
• Enhanced effect with dietary/lifestyle modifications
• Consider timing: evening dose for transient blockade

LIMITATIONS:
• Generic drug (no pharmaceutical industry funding)
• Limited large-scale RCTs
• Off-label use
• Variability in compounding quality

FUTURE DIRECTIONS:
• Need for registrational trials
• Optimal dosing schedule refinement
• Biomarker development
• Combination protocol standardization

PMC: PMC10968813`,
  type: 'integrative',
  tags: ['ldn', 'low-dose-naltrexone', 'comprehensive-review', 'ogf-ogfr-axis', 'immune-modulation', 'chemotherapy-synergy', 'bladder-cancer', 'case-reports', 'apoptosis', 'integrative-oncology', 'adjuvant-therapy', 'immunotherapy-synergy']
};

// Paper 3: LDN Research Trust Case Reports
const paper3 = {
  title: "The Game Changer - LDN & Cancer: Clinical Case Reports and Mechanistic Insights",
  authors: "LDN Research Trust (Multiple physicians and researchers)",
  journal: "LDN Research Trust",
  publication_date: "2016-2022",
  url: "https://ldnresearchtrust.org/%E2%80%9C-game-changer%E2%80%9D-ldn-cancer-ldn-low-dose-naltrexone",
  abstract: `Collection of clinical case reports and expert interviews on LDN use in cancer, featuring notable bladder cancer case.

BLADDER CANCER CASE (Dr. Mark Rosenberg):
• 65-year-old male, high-grade muscle-invasive bladder cancer
• Multiple prior surgeries, tumor recurrence
• Growing into muscle → recommended total cystectomy + voice box removal
• Patient declined aggressive surgery
• Started: LDN + single BCG immunotherapy course
• RESULT: Complete remission after 4 months
• STATUS: 7+ YEARS cancer-free
• SIGNIFICANCE: LDN + immunotherapy synergy

LUNG CANCER CASE (Antoine E.):
• 60-year-old, Stage 4 adenocarcinoma (inoperable, grapefruit-sized)
• Given 3-6 months to live
• Protocol: Tarceva + LDN + Angiostop + Revivin + Myomin + Reishi + Asparagus Extract
• PET scan Dec 2013: NO TUMOR
• Oncologist: "Only patient on Tarceva living that long" (>9 months typical)
• Attributed to LDN preventing Tarceva resistance

TONGUE CANCER CASE (Dr. Mark Rosenberg):
• 58-year-old, adenoid cystic carcinoma, 3cm tumor
• Recommended: Total tongue + voice box removal
• Protocol: LDN + Vitamin D (10,000 IU daily)
• Within months: Tumor shrinking
• 2 years: MRI showed COMPLETE DISAPPEARANCE
• 5+ years: Cancer-free

COLON CANCER CASE (Dr. Mark Rosenberg):
• 51-year-old, stable but not cured after chemo
• Added LDN to regimen
• 18 months: Symptoms improved, disease stabilized
• Withdrew LDN (physician skepticism): Recurrence within 9 months
• Restarted LDN: Symptoms resolved again
• Demonstrates LDN withdrawal → relapse → re-start → response

OVARIAN CANCER CASE (Dr. Jonathan Wright):
• 2004: Initial diagnosis, surgery + chemo
• 2011: Stage 4 metastatic (spleen, liver, colon) recurrence
• Expected survival: 4-5 months
• Started LDN 2011
• 4 years later: Liver metastases stabilized, controlled

SQUAMOUS CELL CARCINOMA (Dr. Jonathan Wright):
• 38-year-old, Stage 4 tonsil SCC
• Chemo/radiation, declined neck dissection
• Added LDN after standard treatment
• 4 years later: NO CANCER on PET scans
• Oncologist: "Don't need to follow anymore"

MELANOMA WITH VITILIGO INDUCTION:
• Patient on vaccine program 4 years, disease progressing
• Added LDN
• 2 weeks: Developed vitiligo (white patches)
• Vitiligo = immune system targeting melanin (on-target immune activation)
• Dramatic clinical response
• STILL ALIVE years later (expected rapid decline)

ENDOMETRIAL CANCER CASE (Dr. Annette Manabi):
• Physician with Stage 1 endometrial cancer
• Deferred surgery, chose integrative approach
• LDN + holistic treatments for 6 months
• Tumor markers rising → eventually had surgery
• AT SURGERY: Tumor did NOT invade systemically
• Only 0.5cm into uterine wall, no lymph nodes, no metastasis
• Tumor grew in size but NOT into own tissues
• Continues LDN post-surgery for prevention

LEIOMYOSARCOMA WITH LIVER TRANSPLANT:
• Multiple HCC recurrences despite treatment
• Started LDN: 3.5 years remission
• Discontinued (physician dismissal): Recurrence within 9 months
• Restarted LDN + saw Dr. Berkson
• Liver transplant indicated
• At transplant pathology: All tumors COMPLETELY NECROSED
• 3+ years post-transplant: No recurrence

KEY MECHANISMS DISCUSSED:
• OGF-OGFr axis (90% of cancers express)
• Immune system reboot (NK cells, CD8+ T cells)
• M2 → M1 macrophage switch
• Vitiligo induction = biomarker of immune activation in melanoma
• Universal immune booster + anti-inflammatory

DOSING PATTERNS:
• Start: 1.5mg, titrate to 4.5mg
• Timing: Evening (allows 4-6h blockade, 18-20h upregulation)
• Most common SE: Initial sleep disruption (resolves 2 weeks)

PHYSICIAN PERSPECTIVES:
• Dr. Angus Dalgleish (UK oncologist): Multiple patients self-prescribing, symptom-free 18+ months
• Dr. Burt Berkson (Las Cruces, NM): α-lipoic acid + LDN combination protocols
• Multiple integrative oncologists: 250-350 patients treated, 30%+ verified clinical success

LONG-TERM USE:
• Years of continuous use maintains effectiveness
• Unlike many drugs that lose effect
• Quality of life improvement consistently reported
• Well-tolerated long-term

CALL FOR RESEARCH:
• Need NHS/government-funded trials
• Generic drug = no pharma incentive
• Cost-effective alternative to £5,000/month drugs
• Potential to save healthcare system millions

PATIENT SELECTION:
• Stage 3-4 with low disease volume (best candidates)
• Post-surgery, not completely cured
• Advanced disease, conventional options exhausted
• As adjuvant with other therapies

CRITICAL QUOTES:
"If I had cancer myself, I would be on low dose naltrexone" - Dr. Jonathan Wright (physician/pharmacologist/former FDA)

"It's imperative as a support measure for all cancer patients" - Dr. Wright

"The most impressed I've been with any therapy in 20 years" - Dr. integrative oncologist`,
  type: 'integrative',
  tags: ['ldn', 'low-dose-naltrexone', 'case-reports', 'bladder-cancer', 'clinical-outcomes', 'bcg-combination', 'immune-activation', 'long-term-survival', 'integrative-oncology', 'vitamin-d-synergy', 'quality-of-life', 'remission']
};

// Insert all papers
const papers = [paper1, paper2, paper3];
const paperIds = [];

papers.forEach((paper, index) => {
  const info = insertPaper.run(
    paper.title,
    paper.authors,
    paper.journal,
    paper.publication_date,
    paper.url,
    paper.abstract,
    paper.type
  );
  
  const paperId = info.lastInsertRowid;
  paperIds.push(paperId);
  
  console.log(`\n✓ Added paper ${index + 1}: "${paper.title}" (ID: ${paperId})`);
  
  // Add tags
  paper.tags.forEach(tag => {
    insertTag.run(tag);
    insertPaperTag.run(paperId, tag);
    console.log(`  ✓ Tagged: ${tag}`);
  });
});

console.log('\n\n📚 All LDN papers added successfully!');
console.log('\nSummary:');
paperIds.forEach((id, index) => {
  const paper = db.prepare('SELECT title, url FROM papers WHERE id = ?').get(id);
  console.log(`\n${index + 1}. ${paper.title}`);
  console.log(`   ${paper.url}`);
});

console.log(`\n\nView at: http://localhost:5173/research`);
console.log(`\nSearch tags: ldn, low-dose-naltrexone, bladder-cancer, integrative-oncology`);

db.close();
