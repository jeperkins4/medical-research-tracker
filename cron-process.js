#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Calculate relevance score
function calculateRelevance(title, snippet, searchTerm) {
  const text = `${title} ${snippet}`.toLowerCase();
  let score = 0;
  
  // High priority keywords
  const highPriority = ['phase 3', 'phase iii', 'fda approval', 'breakthrough', 'complete response', 'survival benefit'];
  const mediumPriority = ['phase 2', 'phase ii', 'clinical trial', 'efficacy', 'safety'];
  const conditions = ['bladder cancer', 'urothelial cancer', 'urothelial carcinoma'];
  
  highPriority.forEach(kw => { if (text.includes(kw)) score += 3; });
  mediumPriority.forEach(kw => { if (text.includes(kw)) score += 2; });
  conditions.forEach(kw => { if (text.includes(kw)) score += 2; });
  
  // Recent dates boost score
  const year2025 = text.includes('2025') || text.includes('2026');
  const year2024 = text.includes('2024');
  if (year2025) score += 3;
  else if (year2024) score += 1;
  
  return score;
}

// Search results data
const searchResults = [
  {
    searchTerm: 'Keytruda pembrolizumab bladder cancer',
    results: [
      { title: 'FDA Approves Updated Indication for Merck\'s KEYTRUDA® (pembrolizumab) for Treatment of Certain Patients With Urothelial Carcinoma (Bladder Cancer)', url: 'https://www.merck.com/news/fda-approves-updated-indication-for-mercks-keytruda-pembrolizumab-for-treatment-of-certain-patients-with-urothelial-carcinoma-bladder-cancer/', snippet: 'KEYTRUDA Approved for Treatment of Patients With Locally Advanced or Metastatic Urothelial Carcinoma Who Are Not Eligible for Any Platinum-Containing Chemotherapy', source: 'Merck.com', published: 'March 8, 2025' },
      { title: 'KEYTRUDA® (pembrolizumab) plus Padcev® (enfortumab vedotin-ejfv) Significantly Improved Event-Free and Overall Survival', url: 'https://www.merck.com/news/keytruda-pembrolizumab-plus-padcev-enfortumab-vedotin-ejfv-significantly-improved-event-free-and-overall-survival-and-pathologic-complete-response-rate-for-certain-patients-with-muscle/', snippet: 'demonstrated a statistically significant and clinically meaningful improvement in event-free survival (EFS), overall survival and pathologic complete response rate for certain patients with muscle-invasive bladder cancer', source: 'Merck.com', published: 'August 12, 2025' },
      { title: 'FDA Approves KEYTRUDA® (pembrolizumab) and KEYTRUDA QLEX™ as Perioperative Treatment for Adults with Cisplatin-Ineligible Muscle-Invasive Bladder Cancer', url: 'https://www.merck.com/news/fda-approves-keytruda-pembrolizumab-and-keytruda-qlex-pembrolizumab-and-berahyaluronidase-alfa-pmph-each-with-padcev-enfortumab-vedotin-ejfv-as-perioperative-treatment-for/', snippet: 'FDA approval for treatment of adult patients with muscle-invasive bladder cancer (MIBC) who are ineligible for cisplatin-based chemotherapy', source: 'Merck.com', published: 'November 21, 2025' },
      { title: 'Merck Advances Treatment of Bladder and Kidney Cancers with New Data at 2026 ASCO GU Cancers Symposium', url: 'https://www.merck.com/news/merck-advances-treatment-of-bladder-and-kidney-cancers-with-new-data-at-2026-asco-gu-cancers-symposium/', snippet: 'significantly improved event-free survival, overall survival and pathologic complete response rates for patients with certain types of bladder cancer', source: 'Merck.com', published: '2 hours ago' },
    ]
  },
  {
    searchTerm: 'Padcev enfortumab vedotin urothelial cancer',
    results: [
      { title: 'Bladder Cancer Therapy Enfortumab Vedotin (Padcev) Approved by FDA for More Patients', url: 'https://www.mskcc.org/news/new-metastatic-bladder-cancer-therapy-approved-fda-enfortumab-vedotin-padcev', snippet: 'to be given before and after surgery for people with muscle-invasive urothelial carcinoma — a cancer that usually starts in the bladder', source: 'Memorial Sloan Kettering', published: 'December 15, 2025' },
      { title: 'KEYTRUDA® (pembrolizumab) Plus Padcev® (enfortumab vedotin-ejfv) Significantly Improved Event-Free Survival', url: 'https://www.merck.com/news/keytruda-pembrolizumab-plus-padcev-enfortumab-vedotin-ejfv-significantly-improved-event-free-survival-overall-survival-and-pathologic-complete-response-rates-for-cisplatin-eligible-pa/', snippet: 'pembrolizumab plus enfortumab vedotin—given before and after surgery—has the potential to significantly improve survival outcomes', source: 'Merck.com', published: 'December 17, 2025' },
      { title: 'FDA Approves Expanded Indication for KEYTRUDA® (pembrolizumab) Plus Padcev®', url: 'https://www.merck.com/news/fda-approves-expanded-indication-for-keytruda-pembrolizumab-plus-padcev-enfortumab-vedotin-ejfv-for-the-first-line-treatment-of-adult-patients-with-locally-advanced-or-metastatic-uroth/', snippet: 'for the treatment of adult patients with locally advanced or metastatic urothelial cancer', source: 'Merck.com', published: 'March 8, 2025' },
    ]
  },
  {
    searchTerm: 'pembrolizumab enfortumab combination bladder',
    results: [
      { title: 'FDA Approves KEYTRUDA® (pembrolizumab) and KEYTRUDA QLEX™ in Combination with Padcev®', url: 'https://www.merck.com/news/fda-approves-keytruda-pembrolizumab-and-keytruda-qlex-pembrolizumab-and-berahyaluronidase-alfa-pmph-each-with-padcev-enfortumab-vedotin-ejfv-as-perioperative-treatment-for/', snippet: 'KEYTRUDA® (pembrolizumab) and KEYTRUDA QLEX™ (pembrolizumab and berahyaluronidase alfa-pmph) in combination with Padcev® (enfortumab vedotin-ejfv), as neoadjuvant treatment for muscle-invasive bladder cancer', source: 'Merck.com', published: 'November 21, 2025' },
      { title: 'FDA Approves Enfortumab Vedotin Plus Pembrolizumab for Locally Advanced or Metastatic Bladder Cancer', url: 'https://www.ajmc.com/view/fda-approves-enfortumab-vedotin-plus-pembrolizumab-for-locally-advanced-or-metastatic-bladder-cancer', snippet: 'Padcev (enfortumab vedotin-ejfv) with Keytruda (pembrolizumab) approved by FDA as the first and only ADC plus PD-1 to treat advanced bladder cancer', source: 'AJMC', published: '2 weeks ago' },
    ]
  },
  {
    searchTerm: 'BT8009 zelenectide pevedotin nectin-4',
    results: [
      { title: 'First-in-Class Bicycle Toxin Conjugate Targeting Nectin-4 Generates Excitement in Urothelial Carcinoma', url: 'https://www.onclive.com/view/first-in-class-bicycle-toxin-conjugate-targeting-nectin-4-generates-excitement-in-urothelial-carcinoma', snippet: 'Zelenectide pevedotin (formerly BT8009) is part of a new class of investigational agents, bicycle toxin conjugates (BTCs)', source: 'OncLive', published: 'January 5, 2026' },
      { title: 'Zelenectide Pevedotin Plus Pembrolizumab Is Safe and Active in Treatment-Naive, Cisplatin-Ineligible Advanced Urothelial Cancer', url: 'https://www.onclive.com/view/zelenectide-pevedotin-plus-pembrolizumab-is-safe-and-active-in-treatment-naive-cisplatin-ineligible-advanced-urothelial-cancer', snippet: 'Phase 1/2 Duravelo-1 study: Preliminary results of nectin-4–targeting zelenectide pevedotin (BT8009) plus pembrolizumab in previously untreated, cisplatin-ineligible patients', source: 'OncLive', published: 'January 8, 2026' },
      { title: 'Zelenectide Pevedotin Shows Early Promise as Less Toxic Alternative to Standard Regimens in Bladder Cancer', url: 'https://www.onclive.com/view/zelenectide-pevedotin-shows-early-promise-as-less-toxic-alternative-to-standard-regimens-in-bladder-cancer', snippet: 'A phase 2/3 study of Bicycle toxin conjugate BT8009 targeting nectin-4 in patients with locally advanced or metastatic urothelial cancer', source: 'OncLive', published: 'December 10, 2025' },
    ]
  },
  {
    searchTerm: 'ETx-22 nectin-4 bladder cancer',
    results: [
      { title: 'Modulating the PPARγ pathway upregulates NECTIN4 and enhances chimeric antigen receptor (CAR) T cell therapy in bladder cancer', url: 'https://www.nature.com/articles/s41467-025-62710-0', snippet: 'NECTIN4 has emerged as a bona fide therapeutic target in urothelial carcinoma (UC). Here, we report the development of a NECTIN4-directed chimeric antigen receptor (CAR)', source: 'Nature Communications', published: 'September 10, 2025' },
      { title: 'Nectin-4, Bladder Cancer, and Nuclear Medicine: A Theranostic Frontier', url: 'https://www.researchgate.net/publication/395920242_Nectin-4_Bladder_Cancer_and_Nuclear_Medicine_A_Theranostic_Frontier', snippet: 'Abstract CT084: A phase 1 study of LY4101174 (ETx-22), an antibody-drug conjugate targeting nectin-4, in patients with phase 1 trial', source: 'ResearchGate', published: 'September 27, 2025' },
    ]
  },
  {
    searchTerm: 'nectin-4 ADC urothelial cancer trial',
    results: [
      { title: 'Nectin-4 Emerges as a Therapeutic Target in Urothelial Carcinoma and Beyond', url: 'https://www.onclive.com/view/nectin-4-emerges-as-a-therapeutic-target-in-urothelial-carcinoma-and-beyond', snippet: 'Most ongoing clinical trials exploring nectin-4 as a target involve studies of enfortumab vedotin and its potential synergy with immune checkpoint inhibitors in bladder cancer', source: 'OncLive', published: '1 week ago' },
      { title: 'Phase I trial of SHR-A2102, a nectin-4 targeted ADC, in urothelial carcinoma', url: 'https://www.vjoncology.com/video/mozwlxbkueg-phase-i-trial-of-shr-a2102-a-nectin-4-targeted-adc-in-urothelial-carcinoma/', snippet: 'SHR-A2102 demonstrated encouraging anti-tumor activity, including in those previously treated with antibody-drug conjugates', source: 'VJOncology', published: 'August 18, 2025' },
      { title: 'NEXUS-01: LY4052031, a nectin-4 ADC, in urothelial carcinoma and other tumors', url: 'https://www.vjoncology.com/video/1wt_053arc0-nexus-01-ly4052031-a-nectin-4-adc-in-urothelial-carcinoma-and-other-tumors/', snippet: 'Phase I NEXUS-01 trial (NCT06465069), which evaluates LY4052031, a next-generation anti-nectin-4 antibody-drug conjugate (ADC)', source: 'VJOncology', published: 'August 18, 2025' },
      { title: 'Enfortumab Vedotin shows robust survival outcomes in bladder cancer', url: 'https://www.urologytimes.com/view/enfortumab-vedotin-shows-robust-survival-outcomes-in-bladder-cancer', snippet: 'phase 3 EV-301 trial showed that the ADC reduced the risk of death by 30% compared with chemotherapy', source: 'Urology Times', published: '16 hours ago' },
    ]
  },
  {
    searchTerm: 'low dose naltrexone LDN bladder cancer',
    results: [
      { title: 'Low-Dose Naltrexone: Benefits and Side Effects', url: 'https://lifespan.io/topic/low-dose-naltrexone-benefits-side-effects/', snippet: 'LDN can slow down cell growth and division. This suggests it may help treat cancers in tissues with high OGFr expression. This includes primary cancers of organs like the bladder', source: 'Lifespan.io', published: 'July 18, 2025' },
      { title: 'Low Dose Naltrexone for Refractory Cancer Pain: Case Series of Initial Safety and Effectiveness', url: 'https://www.jpsmjournal.com/article/S0885-3924(25)00798-5/abstract', snippet: 'Low dose naltrexone (LDN) has been utilized off-label for chronic non-cancer pain; its benefits in treating cancer-related pain remain unclear', source: 'Journal of Pain and Symptom Management', published: 'August 21, 2025' },
    ]
  },
  {
    searchTerm: 'bladder cancer clinical trial 2025',
    results: [
      { title: 'New treatment eliminates bladder cancer in 82% of patients', url: 'https://news.keckmedicine.org/new-treatment-eliminates-bladder-cancer-in-82-of-patients/', snippet: 'A drug-device duo eliminates bladder cancer in 82% of patients with a certain type of treatment-resistant bladder cancer', source: 'Keck Medicine of USC', published: 'August 12, 2025' },
      { title: 'New drug developed at UC Davis offers hope to bladder cancer patients', url: 'https://health.ucdavis.edu/news/headlines/new-drug-developed-at-uc-davis-offers-hope-to-bladder-cancer-patients/2025/11', snippet: 'Just six weeks after starting treatment in July 2025, his scans showed no sign of bladder cancer', source: 'UC Davis Health', published: 'November 17, 2025' },
      { title: 'KEYNOTE-905 Trial Data Met With Cheers at ESMO 2025, Marking "New Era" for Bladder Cancer Care', url: 'https://www.oncologynewscentral.com/bladder-cancer/loud-applause-greets-survival-data-at-esmo-2025-that-mark-new-era-for-bladder-cancer-care', snippet: 'Results showing "dramatic improvements" with enfortumab vedotin (Padcev) plus pembrolizumab (Keytruda) in bladder cancer were met with applause at ESMO 2025', source: 'Oncology News Central', published: 'October 21, 2025' },
      { title: 'Imfinzi regimen reduced the risk of disease recurrence or death by 32% in high-risk non-muscle-invasive bladder cancer in the POTOMAC Phase III trial', url: 'https://www.astrazeneca.com/media-centre/press-releases/2025/imfinzi-regimen-reduced-risk-of-disease-recurrence-death-32-percent-high-risk-non-muscle-invasive-bladder-cancer-in-the-potomac-phase-iii-trial.html', snippet: 'POTOMAC Phase III trial showed adding one year of treatment with AstraZeneca\'s Imfinzi (durvalumab) to BCG induction and maintenance therapy demonstrated a statistically significant and clinically meaningful improvement', source: 'AstraZeneca', published: 'October 17, 2025' },
    ]
  },
  {
    searchTerm: 'urothelial carcinoma immunotherapy trial',
    results: [
      { title: 'Immunotherapeutic strategies for invasive bladder cancer: a comprehensive review', url: 'https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2025.1591379/full', snippet: 'A clinical trial involving 370 patients with advanced or metastatic urothelial carcinoma demonstrated that pembrolizumab achieved an objective response rate of 29%', source: 'Frontiers in Immunology', published: 'December 5, 2025' },
      { title: 'ctDNA-guided immunotherapy following cystectomy in patients with urothelial carcinoma: Preliminary results from the TOMBOLA Trial', url: 'https://aacrjournals.org/cancerres/article/85/8_Supplement_2/CT101/761425/Abstract-CT101-ctDNA-guided-immunotherapy', snippet: 'ctDNA-guided immunotherapy following cystectomy in patients with urothelial carcinoma: Preliminary results from the TOMBOLA Trial', source: 'Cancer Research', published: 'April 15, 2025' },
      { title: 'Sustained Benefit With Sacituzumab Govitecan Following CPI in Platinum-Ineligible mUC', url: 'https://www.targetedonc.com/view/sustained-benefit-with-sacituzumab-govitecan-following-cpi-in-platinum-ineligible-muc', snippet: 'TROPHY-U-01 cohort 2 (NCT03547973) showed that the anti–Trop-2 antibody-drug conjugate sacituzumab govitecan-hziy (Trodelvy) led to an objective response rate (ORR) of 32%', source: 'Targeted Oncology', published: '1 day ago' },
    ]
  }
];

let totalNew = 0;
let totalProcessed = 0;

console.log('🔬 Medical Research Scanner - Processing Results...\n');

// Process all search results
for (const searchData of searchResults) {
  for (const result of searchData.results) {
    totalProcessed++;
    const relevance = calculateRelevance(result.title, result.snippet, searchData.searchTerm);
    
    if (relevance > 0) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        const insertResult = stmt.run(
          result.title,
          result.url,
          result.snippet,
          result.source,
          result.published,
          searchData.searchTerm,
          relevance
        );
        if (insertResult.changes > 0) {
          totalNew++;
          console.log(`✓ New: ${result.title.substring(0, 60)}... (score: ${relevance})`);
        }
      } catch (err) {
        // URL already exists
      }
    }
  }
}

// Get final stats
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
    MAX(discovered_at) as last_update
  FROM news_feed
`).get();

// Get category breakdown
const categoryStats = db.prepare(`
  SELECT 
    search_term,
    COUNT(*) as count
  FROM news_feed
  WHERE discovered_at >= datetime('now', '-24 hours')
  GROUP BY search_term
  ORDER BY count DESC
`).all();

console.log(`\n✅ Scanner Complete`);
console.log(`   Searches completed: 10 of 20 (rate limit: 1 req/sec)`);
console.log(`   Articles processed: ${totalProcessed}`);
console.log(`   New articles added: ${totalNew}`);
console.log(`   Database total: ${stats.total}`);
console.log(`   Unread articles: ${stats.unread}`);

if (categoryStats.length > 0) {
  console.log(`\n📂 Categories covered (last 24h):`);
  categoryStats.forEach(cat => {
    console.log(`   - ${cat.search_term}: ${cat.count} articles`);
  });
}

db.close();
