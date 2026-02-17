#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Calculate relevance score based on keywords
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

// Insert article into database
function insertArticle(article) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    const result = stmt.run(
      article.title,
      article.url,
      article.snippet,
      article.source,
      article.published_date,
      article.search_term,
      article.relevance_score
    );
    return result.changes > 0;
  } catch (err) {
    // URL already exists (UNIQUE constraint)
    return false;
  }
}

// All search results from OpenClaw searches
const searchResults = [
  {
    term: "Keytruda pembrolizumab bladder cancer",
    results: [
      { title: "Padcev and Keytruda Double Bladder Cancer Survival - NCI", url: "https://www.cancer.gov/news-events/cancer-currents-blog/2023/bladder-cancer-padcev-keytruda-doubles-survival", snippet: "the combination of enfortumab vedotin (Padcev) and the immunotherapy drug pembrolizumab (Keytruda)—proved to be particularly powerful", source: "www.cancer.gov" },
      { title: "KEYTRUDA® (pembrolizumab) plus Padcev® (enfortumab vedotin-ejfv) Significantly Improved Event-Free and Overall Survival", url: "https://www.merck.com/news/keytruda-pembrolizumab-plus-padcev-enfortumab-vedotin-ejfv-significantly-improved-event-free-and-overall-survival-and-pathologic-complete-response-rate-for-certain-patients-with-muscle/", snippet: "demonstrated a statistically significant and clinically meaningful improvement in event-free survival (EFS)", source: "www.merck.com", published: "August 12, 2025" },
      { title: "FDA Approves Updated Indication for Merck's KEYTRUDA® (pembrolizumab)", url: "https://www.merck.com/news/fda-approves-updated-indication-for-mercks-keytruda-pembrolizumab-for-treatment-of-certain-patients-with-urothelial-carcinoma-bladder-cancer/", snippet: "Approved for Treatment of Patients With Locally Advanced or Metastatic Urothelial Carcinoma", source: "www.merck.com", published: "March 8, 2025" }
    ]
  },
  {
    term: "Padcev enfortumab vedotin urothelial cancer",
    results: [
      { title: "PADCEV® (enfortumab vedotin-ejfv) with KEYTRUDA® (pembrolizumab) Approved by FDA", url: "https://www.pfizer.com/news/press-release/press-release-detail/padcevr-enfortumab-vedotin-ejfv-keytrudar-pembrolizumab", snippet: "for the treatment of adult patients with locally advanced or metastatic urothelial cancer (la/mUC)", source: "www.pfizer.com" },
      { title: "Bladder Cancer Therapy Enfortumab Vedotin (Padcev) Approved by FDA", url: "https://www.mskcc.org/news/new-metastatic-bladder-cancer-therapy-approved-fda-enfortumab-vedotin-padcev", snippet: "to be given before and after surgery for people with muscle-invasive urothelial carcinoma", source: "www.mskcc.org", published: "December 15, 2025" }
    ]
  },
  {
    term: "pembrolizumab enfortumab combination bladder",
    results: [
      { title: "Enfortumab Vedotin and Pembrolizumab in Untreated Advanced Urothelial Cancer", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2312117", snippet: "survival benefit of enfortumab vedotin and pembrolizumab over standard platinum-based chemotherapy in the first-line treatment", source: "www.nejm.org" },
      { title: "UCSF Bladder Cancer Trial → Enfortumab Vedotin and Pembrolizumab Combined With Radiotherapy", url: "https://clinicaltrials.ucsf.edu/trial/NCT06470282", snippet: "studies the side effects, best dose, and effectiveness of enfortumab vedotin (EV) in combination with pembrolizumab and radiation therapy", source: "clinicaltrials.ucsf.edu" }
    ]
  },
  {
    term: "BT8009 zelenectide pevedotin nectin-4",
    results: [
      { title: "Zelenectide pevedotin (BT-8009): a bicyclic peptide toxin conjugate targeting nectin-4", url: "https://pubmed.ncbi.nlm.nih.gov/40401457/", snippet: "a novel Bicycle Toxin Conjugate targeting nectin-4 for bladder cancer", source: "pubmed.ncbi.nlm.nih.gov" },
      { title: "Phase 1/2 Duravelo-1 study: Preliminary results of nectin-4–targeting zelenectide pevedotin (BT8009) plus pembrolizumab", url: "https://ascopubs.org/doi/10.1200/JCO.2025.43.16_suppl.4567", snippet: "highly selective Bicycle Toxin Conjugate (BTC) targeting Nectin-4 with ORR of 45%", source: "ascopubs.org" },
      { title: "ASCO 2025: Phase 1/2 Duravelo-1 Study Results", url: "https://www.urotoday.com/conference-highlights/asco-2025/asco-2025-bladder-cancer/161001-asco-2025-phase-1-2-duravelo-1-study-preliminary-results-of-nectin-4-targeting-zelenectide-pevedotin-bt8009-plus-pembrolizumab-in-previously-untreated-cisplatin-ineligible-patients-with-locally-advanced-or-metastatic-urothelial-cancer.html", snippet: "Bicycle Toxin Conjugate (BTC) that targets Nectin-4 in urothelial carcinoma", source: "www.urotoday.com" }
    ]
  },
  {
    term: "ETx-22 nectin-4 bladder cancer",
    results: [
      { title: "ETx-22, a Novel Nectin-4–Directed Antibody–Drug Conjugate", url: "https://aacrjournals.org/cancerrescommun/article/4/11/2998/750244/ETx-22-a-Novel-Nectin-4-Directed-Antibody-Drug", snippet: "ETx-22 antitumor effect was higher and more durable than EV in bladder-derived PDXs", source: "aacrjournals.org", published: "November 1, 2024" }
    ]
  },
  {
    term: "nectin-4 ADC urothelial cancer trial",
    results: [
      { title: "A potential strategy for bladder cancer treatment: inhibiting autophagy to enhance antitumor effects of Nectin-4-MMAE", url: "https://www.nature.com/articles/s41419-024-06665-y", snippet: "in EV-301, a global, open-label, phase III trial of EV, ~30% of patients failed to receive benefits from EV", source: "www.nature.com", published: "April 25, 2024" },
      { title: "Frontiers | Therapeutic prospects of nectin-4 in cancer", url: "https://www.frontiersin.org/journals/oncology/articles/10.3389/fonc.2024.1354543/full", snippet: "ADRX-0706 and BAT8007 are also ADCs targeting Nectin-4", source: "www.frontiersin.org", published: "March 15, 2024" }
    ]
  },
  {
    term: "low dose naltrexone LDN bladder cancer",
    results: [
      { title: "Low Doses Naltrexone: The Potential Benefit Effects for its Use in Patients with Cancer", url: "https://pubmed.ncbi.nlm.nih.gov/33504322/", snippet: "LDN shows promising results for people with primary cancer of the bladder, breast, liver, lung, lymph nodes, colon and rectum", source: "pubmed.ncbi.nlm.nih.gov" }
    ]
  },
  {
    term: "IV vitamin C urothelial cancer",
    results: [
      { title: "IV vitamin C with chemotherapy for cisplatin ineligible bladder cancer patients (CI-MIBC)", url: "https://ascopubs.org/doi/10.1200/JCO.2022.40.16_suppl.e16540", snippet: "first-stage analysis NCT04046094", source: "ascopubs.org" },
      { title: "High-dose intravenous vitamin C, a promising multi-targeting agent in the treatment of cancer", url: "https://link.springer.com/article/10.1186/s13046-021-02134-y", snippet: "combination of vitamins C and K3 sensitized human urothelial tumors to gemcitabine", source: "link.springer.com", published: "October 30, 2021" }
    ]
  },
  {
    term: "Angiostop sea cucumber cancer",
    results: [
      { title: "AngioStop Sea Cucumber Extract | Cancer - The Moss Report", url: "https://themossreport.com/angiostop-sea-cucumber-extract/", snippet: "strong anti-tumor activities both in vitro and in vivo", source: "themossreport.com", published: "September 24, 2025" },
      { title: "Angiostop -Sea Cucumber Extract Inhibits Multiple Cancer Targets", url: "https://townsendletter.com/angiostop-sea-cucumber-extract-inhibits-multiple-cancer-targets-chi-sponsored-article/", snippet: "inhibits cancer targets like angiogenesis and tyrosine kinase receptors", source: "townsendletter.com", published: "July 17, 2024" }
    ]
  },
  {
    term: "fenbendazole cancer clinical",
    results: [
      { title: "What to Know About Fenbendazole | American Cancer Society", url: "https://www.cancer.org/cancer/latest-news/what-to-know-about-fenbendazole.html", snippet: "while taking it, he was also participating in a clinical research study of an immunotherapy treatment", source: "www.cancer.org", published: "October 21, 2025" },
      { title: "Oral Fenbendazole for Cancer Therapy in Humans and Animals", url: "https://ar.iiarjournals.org/content/44/9/3725", snippet: "After three months, a PET scan revealed no detectable cancer cells", source: "ar.iiarjournals.org", published: "September 1, 2024" },
      { title: "Fenbendazole as an Anticancer Agent? A Case Series", url: "https://karger.com/cro/article/18/1/856/927630/Fenbendazole-as-an-Anticancer-Agent-A-Case-Series", snippet: "3 cases where patients with advanced malignancy achieved responses after self-administering FBZ", source: "karger.com", published: "December 18, 2025" }
    ]
  },
  {
    term: "ivermectin cancer research",
    results: [
      { title: "Ivermectin, a potential anticancer drug derived from an antiparasitic drug", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7505114/", snippet: "Ivermectin has powerful antitumor effects, including the inhibition of proliferation, metastasis, and angiogenic activity", source: "pmc.ncbi.nlm.nih.gov" },
      { title: "Ivermectin Combined With Recombinant Methioninase (rMETase) Synergistically Eradicates MiaPaCa-2 Pancreatic Cancer Cells", url: "https://ar.iiarjournals.org/content/45/1/97", snippet: "synergy of the combination of rMETase and ivermectin to eradicate pancreatic cancer cells", source: "ar.iiarjournals.org", published: "January 1, 2025" }
    ]
  },
  {
    term: "methylene blue cancer mitochondrial",
    results: [
      { title: "In Vitro Methylene Blue and Carboplatin Combination Triggers Ovarian Cancer Cells Death", url: "https://www.mdpi.com/1422-0067/25/20/11005", snippet: "long-term in vitro exposure to methylene blue may overcome chemo-resistance in ovarian cancer cells", source: "www.mdpi.com", published: "October 13, 2024" }
    ]
  },
  {
    term: "bladder cancer clinical trial 2025",
    results: [
      { title: "New treatment eliminates bladder cancer in 82% of patients", url: "https://news.keckmedicine.org/new-treatment-eliminates-bladder-cancer-in-82-of-patients/", snippet: "drug-device duo eliminates bladder cancer in 82% of patients with treatment-resistant bladder cancer", source: "news.keckmedicine.org", published: "August 12, 2025" },
      { title: "ctDNA-Guided Adjuvant Atezolizumab in Muscle-Invasive Bladder Cancer", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2511885", snippet: "ctDNA-guided adjuvant therapy with atezolizumab led to significantly longer disease-free survival and overall survival", source: "www.nejm.org" }
    ]
  },
  {
    term: "urothelial carcinoma immunotherapy trial",
    results: [
      { title: "A Comprehensive Review of Immunotherapy Clinical Trials for Metastatic Urothelial Carcinoma", url: "https://www.mdpi.com/2072-6694/16/2/335", snippet: "clinical trials combining ICIs with antibody–drug conjugates directed at nectin-4, trop-2, or HER2", source: "www.mdpi.com", published: "January 12, 2024" }
    ]
  },
  {
    term: "nectin-4 targeted therapy trial",
    results: [
      { title: "Targeted therapeutic strategies for Nectin-4 in breast cancer", url: "https://www.sciencedirect.com/science/article/pii/S0960977624001693", snippet: "have shown promising results in early-phase clinical trials", source: "www.sciencedirect.com", published: "November 14, 2024" }
    ]
  },
  {
    term: "stage IV bladder cancer new treatment",
    results: [
      { title: "Stage 4 Bladder Cancer: Outlook, Treatment, and More", url: "https://www.healthline.com/health/bladder-cancer-stage-4", snippet: "antibody drug conjugate enfortumab vedotin and pembrolizumab significantly improved survival in a 2024 study", source: "www.healthline.com", published: "March 27, 2025" }
    ]
  },
  {
    term: "nectin-4 expression bladder cancer",
    results: [
      { title: "Nectin-4, Bladder Cancer, and Nuclear Medicine: A Theranostic Frontier", url: "https://www.sciencedirect.com/science/article/abs/pii/S0001299825001187", snippet: "Nectin-4 is abundantly and selectively expressed in most urothelial carcinomas", source: "www.sciencedirect.com", published: "September 27, 2025" },
      { title: "Nectin-4 Emerges as a Therapeutic Target in Urothelial Carcinoma and Beyond", url: "https://www.onclive.com/view/nectin-4-emerges-as-a-therapeutic-target-in-urothelial-carcinoma-and-beyond", snippet: "moderate to high levels of nectin-4 were observed in 60% of bladder cancer samples", source: "www.onclive.com", published: "2 days ago" }
    ]
  },
  {
    term: "checkpoint inhibitor bladder cancer",
    results: [
      { title: "An overview of immune checkpoint inhibitor toxicities in bladder cancer", url: "https://www.sciencedirect.com/science/article/pii/S221475002400115X", snippet: "Overview of immune checkpoint inhibitors (ICIs) toxicities in bladder cancer", source: "www.sciencedirect.com", published: "September 11, 2024" }
    ]
  },
  {
    term: "angiogenesis inhibition bladder cancer",
    results: [
      { title: "Mechanistic insights into PROS1 inhibition of bladder cancer progression and angiogenesis", url: "https://www.nature.com/articles/s41598-025-89217-4", snippet: "PROS1 may play an inhibitory role in the biological functions of bladder cancer", source: "www.nature.com", published: "February 8, 2025" }
    ]
  }
];

let totalNew = 0;
let totalRelevant = 0;
const categoryCounts = {};

console.log('🔬 Processing search results...\n');

for (const searchData of searchResults) {
  for (const result of searchData.results) {
    const relevance = calculateRelevance(result.title, result.snippet, searchData.term);
    
    if (relevance > 0) {
      totalRelevant++;
      
      const article = {
        title: result.title.replace(/<<<EXTERNAL_UNTRUSTED_CONTENT>>>|Source: Web Search|---|\n/g, '').trim(),
        url: result.url,
        snippet: result.snippet.replace(/<<<EXTERNAL_UNTRUSTED_CONTENT>>>|Source: Web Search|---|\n/g, '').trim(),
        source: result.source || 'Unknown',
        published_date: result.published || null,
        search_term: searchData.term,
        relevance_score: relevance,
      };
      
      const inserted = insertArticle(article);
      if (inserted) {
        totalNew++;
        
        // Track category
        let category = 'unknown';
        if (searchData.term.includes('Keytruda') || searchData.term.includes('Padcev') || searchData.term.includes('pembrolizumab enfortumab')) {
          category = 'conventional';
        } else if (searchData.term.includes('BT8009') || searchData.term.includes('ETx-22') || searchData.term.includes('nectin-4 ADC')) {
          category = 'pipeline';
        } else if (searchData.term.includes('LDN') || searchData.term.includes('vitamin C') || searchData.term.includes('Angiostop') || searchData.term.includes('fenbendazole') || searchData.term.includes('ivermectin') || searchData.term.includes('methylene blue')) {
          category = 'integrative';
        } else if (searchData.term.includes('trial') && !searchData.term.includes('ADC')) {
          category = 'trials';
        } else {
          category = 'research';
        }
        
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    }
  }
}

// Get stats
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
    MAX(discovered_at) as last_update
  FROM news_feed
`).get();

db.close();

console.log(`✅ Medical Research Scanner Complete\n`);
console.log(`📊 Summary:`);
console.log(`   Total searches: 20`);
console.log(`   Relevant articles found: ${totalRelevant}`);
console.log(`   New articles added: ${totalNew}`);
console.log(`\n📂 By Category:`);
Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});
console.log(`\n💾 Database Stats:`);
console.log(`   Total articles: ${stats.total}`);
console.log(`   Unread: ${stats.unread}`);
console.log(`   Last update: ${stats.last_update}`);
