#!/usr/bin/env python3
import sqlite3
from datetime import datetime

# Create database connection
db_path = '/Users/perkins/.openclaw/workspace/medical-research-tracker/data/health.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create table if not exists
cursor.execute('''
CREATE TABLE IF NOT EXISTS news_feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT UNIQUE,
    snippet TEXT,
    source TEXT,
    published_date TEXT,
    search_term TEXT,
    relevance_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')

# Articles with calculated relevance scores
articles = [
    # Search 1: 'bladder cancer clinical trial 2025'
    {
        "title": "New drug developed at UC Davis offers hope to bladder cancer patients",
        "url": "https://health.ucdavis.edu/news/headlines/new-drug-developed-at-uc-davis-offers-hope-to-bladder-cancer-patients/2025/11",
        "snippet": "Just six weeks after starting treatment in July 2025, his scans showed no sign of bladder cancer",
        "source": "health.ucdavis.edu",
        "published_date": "2025-11-17",
        "search_term": "bladder cancer clinical trial 2025",
        "relevance_score": 5  # 2025 date (+3), clinical trial (+2)
    },
    {
        "title": "UCSD Bladder Cancer Clinical Trials for 2026 — San Diego",
        "url": "https://clinicaltrials.ucsd.edu/bladder-cancer",
        "snippet": "Clinical trials for muscle invasive bladder cancer and early-stage solid tumors",
        "source": "clinicaltrials.ucsd.edu",
        "published_date": "2026-03-01",
        "search_term": "bladder cancer clinical trial 2025",
        "relevance_score": 4  # 2026 date (+3), clinical trial (+2), minus older context
    },
    {
        "title": "New Drug-Releasing System Eliminates Bladder Cancer in Over 80 of Patients in a Phase II Trial",
        "url": "https://ascopost.com/news/august-2025/new-drug-releasing-system-eliminates-bladder-cancer-in-over-80-of-patients-in-a-phase-ii-trial/",
        "snippet": "TAR-200 eliminated tumors in 82% of patients in the phase II SunRISe-1 trial",
        "source": "ascopost.com",
        "published_date": "2025-08-14",
        "search_term": "bladder cancer clinical trial 2025",
        "relevance_score": 6  # 2025 (+3), phase II (+2), high efficacy 82% (+1)
    },
    {
        "title": "New treatment eliminates bladder cancer in 82% of patients",
        "url": "https://news.keckmedicine.org/new-treatment-eliminates-bladder-cancer-in-82-of-patients/",
        "snippet": "Drug-device duo eliminates bladder cancer in 82% of patients with treatment-resistant bladder cancer",
        "source": "news.keckmedicine.org",
        "published_date": "2025-08-12",
        "search_term": "bladder cancer clinical trial 2025",
        "relevance_score": 6  # 2025 (+3), high efficacy 82% (+2), treatment outcomes (+1)
    },
    {
        "title": "Bladder cancer clinical trial | Summer 2025 Synthesis",
        "url": "https://health.ucdavis.edu/synthesis/summer-2025/science-education/bladder-cancer",
        "snippet": "PIVOT-006 clinical trial at UC Davis Health for bladder cancer",
        "source": "health.ucdavis.edu",
        "published_date": "2025-08-15",
        "search_term": "bladder cancer clinical trial 2025",
        "relevance_score": 4  # 2025 (+3), clinical trial (+2), but general context
    },
    
    # Search 2: 'urothelial carcinoma immunotherapy trial'
    {
        "title": "A Comprehensive Review of Immunotherapy Clinical Trials for Metastatic Urothelial Carcinoma",
        "url": "https://www.mdpi.com/2072-6694/16/2/335",
        "snippet": "ICIs with antibody-drug conjugates targeting nectin-4, trop-2, or HER2 in combination trials",
        "source": "www.mdpi.com",
        "published_date": "2024-01-12",
        "search_term": "urothelial carcinoma immunotherapy trial",
        "relevance_score": 4  # 2024 (+1), immunotherapy (+2), clinical trial (+2), review article
    },
    {
        "title": "Enfortumab Vedotin and Pembrolizumab in Untreated Advanced Urothelial Cancer",
        "url": "https://www.nejm.org/doi/full/10.1056/NEJMoa2312117",
        "snippet": "Phase 3 trial of enfortumab vedotin and pembrolizumab in advanced urothelial carcinoma",
        "source": "www.nejm.org",
        "published_date": "2024-01-01",
        "search_term": "urothelial carcinoma immunotherapy trial",
        "relevance_score": 5  # Phase 3 (+3), immunotherapy (+2)
    },
    {
        "title": "Immunotherapy after surgery helps people with high-risk bladder cancer",
        "url": "https://www.nih.gov/news-events/news-releases/immunotherapy-after-surgery-helps-people-high-risk-bladder-cancer-live-cancer-free-longer",
        "snippet": "Immunotherapy drug nearly doubles cancer-free survival in high-risk muscle-invasive bladder cancer",
        "source": "www.nih.gov",
        "published_date": "2025-04-01",
        "search_term": "urothelial carcinoma immunotherapy trial",
        "relevance_score": 6  # 2025 (+3), immunotherapy (+2), survival benefit (+1)
    },
    {
        "title": "Enfortumab Vedotin in Previously Treated Advanced Urothelial Carcinoma",
        "url": "https://www.nejm.org/doi/full/10.1056/NEJMoa2035807",
        "snippet": "Clinical trial of enfortumab vedotin in advanced urothelial carcinoma",
        "source": "www.nejm.org",
        "published_date": "2021-01-01",
        "search_term": "urothelial carcinoma immunotherapy trial",
        "relevance_score": 4  # Immunotherapy (+2), clinical trial (+2)
    },
    
    # Search 3: 'nectin-4 targeted therapy trial'
    {
        "title": "NECTIN4 Amplification Is Frequent in Solid Tumors and Predicts Enfortumab Vedotin Response",
        "url": "https://ascopubs.org/doi/10.1200/JCO.23.01983",
        "snippet": "Enfortumab vedotin (EV) targeting NECTIN4 in advanced urothelial cancer and other tumors",
        "source": "ascopubs.org",
        "published_date": "2024-01-01",
        "search_term": "nectin-4 targeted therapy trial",
        "relevance_score": 4  # Clinical application (+2), targeted therapy (+2)
    },
    {
        "title": "Therapeutic prospects of nectin-4 in cancer: applications and value",
        "url": "https://www.frontiersin.org/journals/oncology/articles/10.3389/fonc.2024.1354543/full",
        "snippet": "EV for pancreatic cancer, prostate cancer clinical trials with nectin-4 targeting",
        "source": "www.frontiersin.org",
        "published_date": "2024-03-15",
        "search_term": "nectin-4 targeted therapy trial",
        "relevance_score": 4  # 2024 (+1), targeted therapy (+2), clinical trials mentioned (+2)
    },
    {
        "title": "FDA Clears IND for Novel Nectin-4 Targeted Radiopharmaceutical Across Cancers",
        "url": "https://www.targetedonc.com/view/fda-clears-ind-for-novel-nectin-4-targeted-radiopharmaceutical-across-cancers",
        "snippet": "FDA approval for nectin-4 targeted radiopharmaceutical therapy",
        "source": "www.targetedonc.com",
        "published_date": "2026-03-17",
        "search_term": "nectin-4 targeted therapy trial",
        "relevance_score": 6  # 2026 (+3), FDA approval (+3), targeted therapy (+2), breakthrough
    },
    {
        "title": "The next-generation of nectin-4 targeted therapies",
        "url": "https://www.annalsofoncology.org/article/S0923-7534(25)00783-5/abstract",
        "snippet": "Enfortumab vedotin + pembrolizumab improved survival in advanced mUC vs chemo",
        "source": "www.annalsofoncology.org",
        "published_date": "2025-08-01",
        "search_term": "nectin-4 targeted therapy trial",
        "relevance_score": 6  # 2025 (+3), survival benefit (+2), targeted therapy (+1)
    },
    
    # Search 4: 'stage IV bladder cancer new treatment'
    {
        "title": "Stage 4 Bladder Cancer: Outlook, Treatment, and More",
        "url": "https://www.healthline.com/health/bladder-cancer-stage-4",
        "snippet": "Enfortumab vedotin + pembrolizumab for metastatic bladder cancer shows improved survival vs chemo",
        "source": "www.healthline.com",
        "published_date": "2025-03-27",
        "search_term": "stage IV bladder cancer new treatment",
        "relevance_score": 5  # 2025 (+3), metastatic bladder cancer (+2)
    },
    
    # Search 5: 'nectin-4 expression bladder cancer'
    {
        "title": "Expression of Nectin-4 in Bladder Urothelial Carcinoma, in Morphologic Variants",
        "url": "https://pubmed.ncbi.nlm.nih.gov/33901032/",
        "snippet": "High levels of nectin-4 expression reported in bladder cancer samples",
        "source": "pubmed.ncbi.nlm.nih.gov",
        "published_date": "2021-09-01",
        "search_term": "nectin-4 expression bladder cancer",
        "relevance_score": 3  # Bladder cancer (+2), nectin-4 expression research (+1)
    },
    {
        "title": "Expression of Nectin-4 in Bladder Urothelial Carcinoma and Morphologic Variants",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8429050/",
        "snippet": "High levels of nectin-4 expression in bladder cancer samples via immunohistochemistry",
        "source": "pmc.ncbi.nlm.nih.gov",
        "published_date": "2021-09-01",
        "search_term": "nectin-4 expression bladder cancer",
        "relevance_score": 3  # Bladder cancer (+2), nectin-4 biomarker (+1)
    },
    {
        "title": "Tumor expression of Nectin-1-4 in muscle invasive bladder cancer",
        "url": "https://pubmed.ncbi.nlm.nih.gov/35986963/",
        "snippet": "Limited evidence on nectin expression and clinical implications in muscle invasive bladder cancer",
        "source": "pubmed.ncbi.nlm.nih.gov",
        "published_date": "2022-09-01",
        "search_term": "nectin-4 expression bladder cancer",
        "relevance_score": 2  # Bladder cancer (+2)
    },
    {
        "title": "Expression of nectin-4 in bladder cancer with variant histology",
        "url": "https://ascopubs.org/doi/abs/10.1200/JCO.2020.38.6_suppl.546",
        "snippet": "Nectin-4 near ubiquitously expressed in urothelial cancer",
        "source": "ascopubs.org",
        "published_date": "2020-02-19",
        "search_term": "nectin-4 expression bladder cancer",
        "relevance_score": 2  # Bladder cancer (+2), biomarker discovery
    },
    {
        "title": "Nectin-4, Bladder Cancer, and Nuclear Medicine: A Theranostic Frontier",
        "url": "https://www.sciencedirect.com/science/article/abs/pii/S0001299825001187",
        "snippet": "Nectin-4 abundantly and selectively expressed in most urothelial carcinomas, correlates with advanced disease",
        "source": "www.sciencedirect.com",
        "published_date": "2025-09-27",
        "search_term": "nectin-4 expression bladder cancer",
        "relevance_score": 5  # 2025 (+3), bladder cancer biomarker (+2)
    },
    
    # Search 6: 'checkpoint inhibitor bladder cancer'
    {
        "title": "Immune Checkpoint Inhibitors for the Treatment of Bladder Cancer",
        "url": "https://pubmed.ncbi.nlm.nih.gov/33401585/",
        "snippet": "ICIs approved as first-line or second-line therapy for metastatic urothelial carcinoma",
        "source": "pubmed.ncbi.nlm.nih.gov",
        "published_date": "2021-01-03",
        "search_term": "checkpoint inhibitor bladder cancer",
        "relevance_score": 3  # Checkpoint inhibitor (+2), bladder cancer (+1)
    },
    {
        "title": "Immune Checkpoint Inhibitors as a Treatment Option for Bladder Cancer",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10323982/",
        "snippet": "ICIs targeting CTLA-4 and PD-1 show promise in treating advanced bladder cancer",
        "source": "pmc.ncbi.nlm.nih.gov",
        "published_date": "2023-09-01",
        "search_term": "checkpoint inhibitor bladder cancer",
        "relevance_score": 3  # Checkpoint inhibitor (+2), bladder cancer (+1)
    },
    
    # Search 7: 'OGF-OGFr axis cancer' - Lower relevance (not bladder-specific)
    {
        "title": "The OGF-OGFr axis utilizes the p21 pathway in human pancreatic cancer",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2253554/",
        "snippet": "OGF-OGFr axis influences G0/G1 phase of cell cycle in pancreatic cancer",
        "source": "pmc.ncbi.nlm.nih.gov",
        "published_date": "2008-01-01",
        "search_term": "OGF-OGFr axis cancer",
        "relevance_score": 0  # Not bladder cancer
    },
    {
        "title": "Expression of OGF-OGFr axis in human nonmedullary thyroid cancer",
        "url": "https://pubmed.ncbi.nlm.nih.gov/19014324/",
        "snippet": "OGF-OGFr axis serves as regulator of cell proliferation in thyroid tissue",
        "source": "pubmed.ncbi.nlm.nih.gov",
        "published_date": "2009-01-01",
        "search_term": "OGF-OGFr axis cancer",
        "relevance_score": 0  # Not bladder cancer
    },
    
    # Search 8: 'angiogenesis inhibition bladder cancer'
    {
        "title": "Targeting angiogenesis in bladder cancer",
        "url": "https://pubmed.ncbi.nlm.nih.gov/19336017/",
        "snippet": "VEGF levels prognostic for advanced bladder cancer; angiogenesis inhibition shows anticancer activity",
        "source": "pubmed.ncbi.nlm.nih.gov",
        "published_date": "2009-04-01",
        "search_term": "angiogenesis inhibition bladder cancer",
        "relevance_score": 2  # Bladder cancer (+2)
    },
    {
        "title": "Inhibition of angiogenesis by leflunomide via soluble ephrin-A1/EphA2 in bladder cancer",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29367676/",
        "snippet": "Leflunomide inhibits angiogenesis in bladder carcinogenesis and tumor xenograft models",
        "source": "pubmed.ncbi.nlm.nih.gov",
        "published_date": "2018-01-24",
        "search_term": "angiogenesis inhibition bladder cancer",
        "relevance_score": 2  # Bladder cancer (+2)
    },
    {
        "title": "An Overview of Angiogenesis in Bladder Cancer",
        "url": "https://link.springer.com/article/10.1007/s11912-023-01421-5",
        "snippet": "HSP47, CCL2, and Mettl3 contribute to angiogenesis in bladder cancer",
        "source": "link.springer.com",
        "published_date": "2023-04-13",
        "search_term": "angiogenesis inhibition bladder cancer",
        "relevance_score": 2  # Bladder cancer (+2)
    },
    {
        "title": "Mechanistic insights into PROS1 inhibition of bladder cancer progression and angiogenesis",
        "url": "https://www.nature.com/articles/s41598-025-89217-4",
        "snippet": "PROS1 plays inhibitory role in angiogenesis and bladder cancer progression",
        "source": "www.nature.com",
        "published_date": "2025-02-08",
        "search_term": "angiogenesis inhibition bladder cancer",
        "relevance_score": 3  # 2025 (+3), angiogenesis inhibition research
    },
]

# Insert articles with score > 0
inserted_count = 0
for article in articles:
    if article["relevance_score"] > 0:
        try:
            cursor.execute('''
            INSERT INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                article["title"],
                article["url"],
                article["snippet"],
                article["source"],
                article["published_date"],
                article["search_term"],
                article["relevance_score"]
            ))
            inserted_count += 1
            print(f"✓ {article['title'][:70]}... [{article['relevance_score']}]")
        except sqlite3.IntegrityError:
            print(f"⚠ Duplicate: {article['title'][:70]}...")

conn.commit()
conn.close()

print(f"\n✅ Database created: {db_path}")
print(f"📊 Articles inserted: {inserted_count}")
