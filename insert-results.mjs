#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

function calculateRelevance(title, snippet) {
  const text = `${title} ${snippet}`.toLowerCase();
  let score = 0;
  
  const highPriority = ['phase 3', 'phase iii', 'fda approval', 'breakthrough', 'complete response', 'survival benefit'];
  const mediumPriority = ['phase 2', 'phase ii', 'clinical trial', 'efficacy', 'safety'];
  const conditions = ['bladder cancer', 'urothelial cancer', 'urothelial carcinoma'];
  
  highPriority.forEach(kw => { if (text.includes(kw)) score += 3; });
  mediumPriority.forEach(kw => { if (text.includes(kw)) score += 2; });
  conditions.forEach(kw => { if (text.includes(kw)) score += 2; });
  
  const year2025 = text.includes('2025') || text.includes('2026');
  const year2024 = text.includes('2024');
  if (year2025) score += 3;
  else if (year2024) score += 1;
  
  return score;
}

function cleanText(text) {
  return text.replace(/<<<EXTERNAL_UNTRUSTED_CONTENT>>>|Source: Web Search|---/g, '').trim();
}

// All 20 search results
const allSearches = [
  {
    category: 'conventional',
    term: 'Keytruda pembrolizumab bladder cancer',
    results: [
      { title: 'KEYTRUDA plus Padcev Significantly Improved Event-Free and Overall Survival for Bladder Cancer', url: 'https://www.merck.com/news/keytruda-pembrolizumab-plus-padcev-enfortumab-vedotin-ejfv', description: 'demonstrated a statistically significant and clinically meaningful improvement in event-free survival (EFS)', published: 'August 12, 2025', siteName: 'www.merck.com' },
      { title: 'FDA Approves Updated Indication for KEYTRUDA for Urothelial Carcinoma', url: 'https://www.merck.com/news/fda-approves-updated-indication-for-mercks-keytruda', description: 'Approved for Treatment of Patients With Locally Advanced or Metastatic Urothelial Carcinoma', published: 'March 8, 2025', siteName: 'www.merck.com' },
      { title: 'Padcev and Keytruda Double Bladder Cancer Survival', url: 'https://www.cancer.gov/news-events/cancer-currents-blog/2023/bladder-cancer-padcev-keytruda-doubles-survival', description: 'the combination of enfortumab vedotin (Padcev) and pembrolizumab (Keytruda) proved to be particularly powerful', published: null, siteName: 'www.cancer.gov' }
    ]
  },
  {
    category: 'conventional',
    term: 'Padcev enfortumab vedotin urothelial cancer',
    results: [
      { title: 'PADCEV plus KEYTRUDA Approved by FDA as First ADC Plus PD-1 for Advanced Bladder Cancer', url: 'https://www.pfizer.com/news/press-release/press-release-detail/padcevr-enfortumab-vedotin-ejfv-keytrudar-pembrolizumab', description: 'for the treatment of adult patients with locally advanced or metastatic urothelial cancer', published: null, siteName: 'www.pfizer.com' },
      { title: 'Bladder Cancer Therapy Enfortumab Vedotin Approved by FDA for More Patients', url: 'https://www.mskcc.org/news/new-metastatic-bladder-cancer-therapy-approved-fda-enfortumab-vedotin-padcev', description: 'to be given before and after surgery for people with muscle-invasive urothelial carcinoma', published: 'December 15, 2025', siteName: 'www.mskcc.org' }
    ]
  },
  {
    category: 'conventional',
    term: 'pembrolizumab enfortumab combination bladder',
    results: [
      { title: 'Enfortumab Vedotin and Pembrolizumab in Untreated Advanced Urothelial Cancer', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2312117', description: 'trial showed a survival benefit of enfortumab vedotin and pembrolizumab over standard platinum-based chemotherapy', published: null, siteName: 'www.nejm.org' },
      { title: 'KEYTRUDA plus Padcev Improved Event-Free Survival for Muscle-Invasive Bladder Cancer', url: 'https://www.merck.com/news/keytruda-pembrolizumab-plus-padcev-enfortumab-vedotin-ejfv', description: 'demonstrated a statistically significant and clinically meaningful improvement in event-free survival', published: 'August 12, 2025', siteName: 'www.merck.com' }
    ]
  },
  {
    category: 'pipeline',
    term: 'BT8009 zelenectide pevedotin nectin-4',
    results: [
      { title: 'ASCO 2025: Phase 1/2 Duravelo-1 Study of Nectin-4 targeting Zelenectide Pevedotin plus Pembrolizumab', url: 'https://www.urotoday.com/conference-highlights/asco-2025/asco-2025-bladder-cancer/161001', description: 'Zelenectide pevedotin is a highly selective Bicycle Toxin Conjugate targeting Nectin-4 commonly overexpressed in urothelial carcinoma', published: null, siteName: 'www.urotoday.com' },
      { title: 'Zelenectide pevedotin: a bicyclic peptide toxin conjugate targeting nectin-4 for bladder cancer', url: 'https://pubmed.ncbi.nlm.nih.gov/40401457/', description: 'a novel Bicycle Toxin Conjugate targeting nectin-4, designed to overcome limitations of enfortumab vedotin', published: null, siteName: 'pubmed.ncbi.nlm.nih.gov' },
      { title: 'Phase 2/3 study of zelenectide pevedotin targeting Nectin-4 in urothelial cancer (Duravelo-2)', url: 'https://ascopubs.org/doi/10.1200/JCO.2025.43.5_suppl.TPS898', description: 'bicycle toxin conjugate zelenectide pevedotin (BT8009) targeting Nectin-4 in patients with locally advanced or metastatic urothelial cancer', published: null, siteName: 'ascopubs.org' }
    ]
  },
  {
    category: 'pipeline',
    term: 'ETx-22 nectin-4 bladder cancer',
    results: [
      { title: 'ETx-22, a Novel Nectin-4 Directed ADC, Demonstrates Safety and Potent Antitumor Activity', url: 'https://aacrjournals.org/cancerrescommun/article/4/11/2998/750244', description: 'ETx-22 antitumor effect was higher and more durable than EV in bladder-derived PDXs', published: 'November 1, 2024', siteName: 'aacrjournals.org' }
    ]
  },
  {
    category: 'pipeline',
    term: 'nectin-4 ADC urothelial cancer trial',
    results: [
      { title: 'Targeting nectin-4 by antibody-drug conjugates for urothelial carcinoma', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8224177/', description: 'enfortumab vedotin granted accelerated approval in December 2019 by the FDA for metastatic urothelial cancer', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' },
      { title: 'NECTIN4 Amplification Predicts Enfortumab Vedotin Response in Metastatic Urothelial Cancer', url: 'https://ascopubs.org/doi/10.1200/JCO.23.01983', description: 'NECTIN4 CNV may represent strong classifier for treatment response and improved clinical outcomes', published: null, siteName: 'ascopubs.org' },
      { title: 'Inhibiting autophagy to enhance antitumor effects of Nectin-4-MMAE for bladder cancer', url: 'https://www.nature.com/articles/s41419-024-06665-y', description: 'in EV-301 phase III trial of EV, ~30% of patients failed to receive benefits from EV', published: 'April 25, 2024', siteName: 'www.nature.com' }
    ]
  },
  {
    category: 'integrative',
    term: 'low dose naltrexone LDN bladder cancer',
    results: [
      { title: 'Low Doses Naltrexone: Potential Benefit Effects for Cancer Patients', url: 'https://pubmed.ncbi.nlm.nih.gov/33504322/', description: 'LDN shows promising results for people with primary cancer of the bladder, breast, liver, lung, lymph nodes, colon and rectum', published: null, siteName: 'pubmed.ncbi.nlm.nih.gov' },
      { title: 'Low-Dose Naltrexone as an Adjuvant in Combined Anticancer Therapy', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10968813/', description: 'Low-dose naltrexone exhibits an inhibitory effect on cancer cell proliferation by blocking the opioid growth factor–receptor axis', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' }
    ]
  },
  {
    category: 'integrative',
    term: 'IV vitamin C urothelial cancer',
    results: [
      { title: 'IV vitamin C with chemotherapy for cisplatin ineligible bladder cancer patients first-stage analysis', url: 'https://ascopubs.org/doi/10.1200/JCO.2022.40.16_suppl.e16540', description: 'NCT04046094 clinical trial', published: null, siteName: 'ascopubs.org' },
      { title: 'High-dose intravenous vitamin C, a promising multi-targeting agent in cancer treatment', url: 'https://link.springer.com/article/10.1186/s13046-021-02134-y', description: 'vitamin combination sensitized human urothelial tumors to gemcitabine', published: 'October 30, 2021', siteName: 'link.springer.com' }
    ]
  },
  {
    category: 'integrative',
    term: 'Angiostop sea cucumber cancer',
    results: [
      { title: 'Angiostop Sea Cucumber Extract - Cancer', url: 'https://themossreport.com/angiostop-sea-cucumber-extract/', description: 'has strong anti-tumor activities both in vitro and in vivo', published: 'September 24, 2025', siteName: 'themossreport.com' },
      { title: 'Angiostop - Sea Cucumber Extract Inhibits Multiple Cancer Targets', url: 'https://townsendletter.com/angiostop-sea-cucumber-extract-inhibits-multiple-cancer-targets-chi-sponsored-article/', description: 'inhibits cancer targets like angiogenesis and tyrosine kinase receptors', published: 'July 17, 2024', siteName: 'townsendletter.com' }
    ]
  },
  {
    category: 'integrative',
    term: 'fenbendazole cancer clinical',
    results: [
      { title: 'Fenbendazole as an Anticancer Agent? A Case Series of Self-Administration in Three Patients', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12215191/', description: 'clinical evidence supporting its use and efficacy in treating metastatic cancer', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' },
      { title: 'Fenbendazole as an Anticancer Agent? Case Series in Advanced Cancer', url: 'https://karger.com/cro/article/18/1/856/927630', description: '3 cases of advanced malignancy (breast, prostate, melanoma stage IV) achieved responses after self-administering FBZ', published: 'December 18, 2025', siteName: 'karger.com' },
      { title: 'Oral Fenbendazole for Cancer Therapy in Humans and Animals', url: 'https://ar.iiarjournals.org/content/44/9/3725', description: 'After three months a PET scan revealed no detectable cancer cells in his body', published: 'September 1, 2024', siteName: 'ar.iiarjournals.org' }
    ]
  },
  {
    category: 'integrative',
    term: 'ivermectin cancer research',
    results: [
      { title: 'Ivermectin, a potential anticancer drug derived from an antiparasitic drug', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7505114/', description: 'Ivermectin has powerful antitumor effects, including the inhibition of proliferation, metastasis, and angiogenic activity, in a variety of cancer cells', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' },
      { title: 'Ivermectin Combined With Recombinant Methioninase Synergistically Eradicates Pancreatic Cancer Cells', url: 'https://ar.iiarjournals.org/content/45/1/97', description: 'to demonstrate the synergy of the combination of rMETase and ivermectin to eradicate human pancreatic cancer cells in vitro', published: 'January 1, 2025', siteName: 'ar.iiarjournals.org' }
    ]
  },
  {
    category: 'integrative',
    term: 'methylene blue cancer mitochondrial',
    results: [
      { title: 'Methylene Blue Metabolic Therapy Restrains In Vivo Ovarian Tumor Growth', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10814748/', description: 'MB may specifically induce cancer cell apoptosis', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' },
      { title: 'In Vitro Methylene Blue and Carboplatin Combination Triggers Ovarian Cancer Cells Death', url: 'https://www.mdpi.com/1422-0067/25/20/11005', description: 'long-term in vitro exposure to methylene blue may overcome chemo-resistance in ovarian cancer cells', published: 'October 13, 2024', siteName: 'www.mdpi.com' }
    ]
  },
  {
    category: 'trials',
    term: 'bladder cancer clinical trial 2025',
    results: [
      { title: 'New treatment eliminates bladder cancer in 82% of patients', url: 'https://news.keckmedicine.org/new-treatment-eliminates-bladder-cancer-in-82-of-patients/', description: 'a drug-device duo eliminates bladder cancer in 82% of patients with treatment-resistant bladder cancer', published: 'August 12, 2025', siteName: 'news.keckmedicine.org' },
      { title: 'ctDNA-Guided Adjuvant Atezolizumab in Muscle-Invasive Bladder Cancer', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2511885', description: 'ctDNA-guided adjuvant therapy with atezolizumab led to significantly longer disease-free survival and overall survival than placebo', published: null, siteName: 'www.nejm.org' },
      { title: 'New drug developed at UC Davis offers hope to bladder cancer patients', url: 'https://health.ucdavis.edu/news/headlines/new-drug-developed-at-uc-davis-offers-hope-to-bladder-cancer-patients/2025/11', description: 'Just six weeks after starting treatment in July 2025, his scans showed no sign of bladder cancer', published: 'November 17, 2025', siteName: 'health.ucdavis.edu' }
    ]
  },
  {
    category: 'trials',
    term: 'urothelial carcinoma immunotherapy trial',
    results: [
      { title: 'Enfortumab Vedotin and Pembrolizumab in Untreated Advanced Urothelial Cancer', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2312117', description: 'trial showed a survival benefit over standard platinum-based chemotherapy in first-line treatment', published: null, siteName: 'www.nejm.org' },
      { title: 'Comprehensive Review of Immunotherapy Clinical Trials for Metastatic Urothelial Carcinoma', url: 'https://www.mdpi.com/2072-6694/16/2/335', description: 'Immune checkpoint inhibitors alone or in combination, novel antibodies, cellular therapies, and vaccines', published: 'January 12, 2024', siteName: 'www.mdpi.com' }
    ]
  },
  {
    category: 'trials',
    term: 'nectin-4 targeted therapy trial',
    results: [
      { title: 'NECTIN4 Amplification Predicts Enfortumab Vedotin Response in Metastatic Urothelial Cancer', url: 'https://ascopubs.org/doi/10.1200/JCO.23.01983', description: 'NECTIN4 CNV may be a valuable biomarker for treatment response', published: null, siteName: 'ascopubs.org' },
      { title: 'Therapeutic prospects of nectin-4 in cancer: applications and value', url: 'https://www.frontiersin.org/journals/oncology/articles/10.3389/fonc.2024.1354543/full', description: 'have shown promising results in early-phase clinical trials', published: 'March 15, 2024', siteName: 'www.frontiersin.org' }
    ]
  },
  {
    category: 'trials',
    term: 'stage IV bladder cancer new treatment',
    results: [
      { title: 'Stage 4 Bladder Cancer: Outlook, Treatment, and More', url: 'https://www.healthline.com/health/bladder-cancer-stage-4', description: 'new standard of care involves the antibody drug conjugate enfortumab vedotin and pembrolizumab. Compared with chemo, this treatment significantly improved survival in a 2024 study', published: 'March 27, 2025', siteName: 'www.healthline.com' }
    ]
  },
  {
    category: 'research',
    term: 'nectin-4 expression bladder cancer',
    results: [
      { title: 'Expression of Nectin-4 in Bladder Urothelial Carcinoma, in Morphologic Variants', url: 'https://pubmed.ncbi.nlm.nih.gov/33901032/', description: 'expression of nectin-4 in morphologic variants of urothelial carcinoma and nonurothelial histotypes', published: 'September 1, 2021', siteName: 'pubmed.ncbi.nlm.nih.gov' },
      { title: 'Nectin-4, Bladder Cancer, and Nuclear Medicine: A Theranostic Frontier', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0001299825001187', description: 'a majority of bladder tumors (weighted mean ∼87% positivity) express Nectin-4', published: 'September 27, 2025', siteName: 'www.sciencedirect.com' }
    ]
  },
  {
    category: 'research',
    term: 'checkpoint inhibitor bladder cancer',
    results: [
      { title: 'Immune Checkpoint Inhibitors for the Treatment of Bladder Cancer', url: 'https://pubmed.ncbi.nlm.nih.gov/33401585/', description: 'approved as first-line therapy in cisplatin-ineligible patients or as second-line therapy for metastatic urothelial carcinoma', published: 'January 3, 2021', siteName: 'pubmed.ncbi.nlm.nih.gov' },
      { title: 'Immune Checkpoint Inhibitors as a Treatment Option for Bladder Cancer: Current Evidence', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10323982/', description: 'immune checkpoint inhibitors targeting CTLA-4 and PD-1 have shown promise in treating bladder cancer', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' }
    ]
  },
  {
    category: 'research',
    term: 'OGF-OGFr axis cancer',
    results: [
      { title: 'Growth inhibition of thyroid follicular cell-derived cancers by the OGF-OGFr axis', url: 'https://bmccancer.biomedcentral.com/articles/10.1186/1471-2407-9-369', description: 'The OGF-OGFr axis in thyroid follicular cell-derived cancer', published: 'October 18, 2009', siteName: 'bmccancer.biomedcentral.com' },
      { title: 'The OGF-OGFr axis utilizes the p21 pathway to restrict progression of human pancreatic cancer', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2253554/', description: 'The OGF-OGFr axis influences the G0/G1 phase of the cell cycle', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' },
      { title: 'Targeting the opioid growth factor: Opioid growth factor receptor axis for ovarian cancer treatment', url: 'https://journals.sagepub.com/doi/abs/10.1177/1535370213488483', description: 'The OGF-OGFr axis can be targeted for treatment of human ovarian cancer', published: null, siteName: 'journals.sagepub.com' }
    ]
  },
  {
    category: 'research',
    term: 'angiogenesis inhibition bladder cancer',
    results: [
      { title: 'Targeting angiogenesis in bladder cancer', url: 'https://pubmed.ncbi.nlm.nih.gov/19336017/', description: 'preclinical evaluation of angiogenesis inhibition demonstrates anticancer activity', published: null, siteName: 'pubmed.ncbi.nlm.nih.gov' },
      { title: 'PROS1 inhibition of bladder cancer progression and angiogenesis via the AKT/GSK3β/β-catenin pathway', url: 'https://www.nature.com/articles/s41598-025-89217-4', description: 'PROS1 may play an inhibitory role in the biological functions of bladder cancer', published: 'February 8, 2025', siteName: 'www.nature.com' },
      { title: 'Role of angiogenesis in urothelial bladder carcinoma', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5057050/', description: 'Angiogenesis may be the key to developing novel therapeutic agents able to inhibit molecular pathways responsible for bladder cancer progression', published: null, siteName: 'pmc.ncbi.nlm.nih.gov' }
    ]
  }
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let totalNew = 0;
let totalProcessed = 0;
const categoryStats = {
  conventional: 0,
  pipeline: 0,
  integrative: 0,
  trials: 0,
  research: 0
};

for (const search of allSearches) {
  for (const result of search.results) {
    totalProcessed++;
    
    const title = cleanText(result.title);
    const description = cleanText(result.description || '');
    const score = calculateRelevance(title, description);
    
    if (score > 0) {
      try {
        const info = stmt.run(
          title,
          result.url,
          description,
          result.siteName || 'Unknown',
          result.published || null,
          search.term,
          score
        );
        
        if (info.changes > 0) {
          totalNew++;
          categoryStats[search.category]++;
          console.log(`   ✓ ${search.category}: ${title.substring(0, 60)}... (score: ${score})`);
        }
      } catch (err) {
        // Duplicate URL, skip
      }
    }
  }
}

const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
  FROM news_feed
`).get();

db.close();

console.log('\n✅ Medical Research Scanner Complete\n');
console.log('📊 Summary:');
console.log(`   • Total searches: 20`);
console.log(`   • Results processed: ${totalProcessed}`);
console.log(`   • New articles saved: ${totalNew}`);
console.log(`   • Database total: ${stats.total} articles`);
console.log(`   • Unread: ${stats.unread}\n`);

if (totalNew > 0) {
  console.log('📂 New articles by category:');
  for (const [cat, count] of Object.entries(categoryStats)) {
    if (count > 0) {
      console.log(`   • ${cat}: ${count}`);
    }
  }
  console.log();
}

console.log('🔬 High-priority topics covered:');
console.log('   • FDA approvals and clinical trials (2025-2026)');
console.log('   • Nectin-4 targeted therapies (BT8009, ETx-22)');
console.log('   • Enfortumab vedotin + pembrolizumab combination');
console.log('   • Integrative approaches (LDN, IV vitamin C, fenbendazole)');
console.log('   • Stage IV treatment advances\n');
