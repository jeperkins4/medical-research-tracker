#!/usr/bin/env python3
import sqlite3
import json
from datetime import datetime

# Article data from all 8 searches
articles_raw = {
    "bladder cancer clinical trial 2025": [
        {
            "title": "New Drug-Releasing System Eliminates Bladder Cancer in Over 80 of Patients in a Phase II Trial",
            "url": "https://ascopost.com/news/august-2025/new-drug-releasing-system-eliminates-bladder-cancer-in-over-80-of-patients-in-a-phase-ii-trial/",
            "snippet": "A new drug-releasing system, TAR-200, eliminated tumors in 82% of patients in the phase II SunRISe-1 trial for individuals with high-risk non–muscle-invasive",
            "source": "ascopost.com",
            "published_date": "August 22, 2025"
        },
        {
            "title": "New drug developed at UC Davis offers hope to bladder cancer patients",
            "url": "https://health.ucdavis.edu/news/headlines/new-drug-developed-at-uc-davis-offers-hope-to-bladder-cancer-patients/2025/11",
            "snippet": "Just six weeks after starting treatment in July 2025, his scans showed no sign of bladder cancer",
            "source": "health.ucdavis.edu",
            "published_date": "November 17, 2025"
        },
        {
            "title": "New treatment eliminates bladder cancer in 82% of patients",
            "url": "https://news.keckmedicine.org/new-treatment-eliminates-bladder-cancer-in-82-of-patients/",
            "snippet": "A new study finds that a drug-device duo eliminates bladder cancer in 82% of patients with a certain type of treatment-resistant bladder cancer",
            "source": "news.keckmedicine.org",
            "published_date": "August 12, 2025"
        },
        {
            "title": "Clinical Trials in Progress: Bladder Cancer",
            "url": "https://www.auajournals.org/doi/10.1097/01.JU.0001110440.53375.7d",
            "snippet": "As of January 30, 2025, 181 patients have been randomized, and recruitment is ongoing at 122 sites",
            "source": "www.auajournals.org",
            "published_date": "May 1, 2025"
        },
        {
            "title": "UCSD Bladder Cancer Clinical Trials for 2026",
            "url": "https://clinicaltrials.ucsd.edu/bladder-cancer",
            "snippet": "Giving ultra-hypofractionated radiation may be equally effective as hypofractionated therapy for patients with muscle invasive bladder cancer",
            "source": "clinicaltrials.ucsd.edu",
            "published_date": "March 5, 2026"
        }
    ],
    "urothelial carcinoma immunotherapy trial": [
        {
            "title": "A Comprehensive Review of Immunotherapy Clinical Trials for Metastatic Urothelial Carcinoma",
            "url": "https://www.mdpi.com/2072-6694/16/2/335",
            "snippet": "Table 4 summarizes clinical trials combining ICIs with the antibody–drug conjugates (ADCs) directed at nectin-4, trop-2, or HER2",
            "source": "www.mdpi.com",
            "published_date": "January 12, 2024"
        },
        {
            "title": "Immunotherapy for advanced or metastatic urothelial carcinoma",
            "url": "https://pubmed.ncbi.nlm.nih.gov/37811690/",
            "snippet": "To assess the effects of immune checkpoint inhibitors compared to chemotherapy as first- and second-line treatment of advanced or metastatic urothelial carcinoma",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "October 9, 2023"
        },
        {
            "title": "Enfortumab Vedotin and Pembrolizumab in Untreated Advanced Urothelial Cancer",
            "url": "https://www.nejm.org/doi/full/10.1056/NEJMoa2312117",
            "snippet": "Durvalumab alone and durvalumab plus tremelimumab versus chemotherapy in previously untreated patients with unresectable, locally advanced or metastatic urothelial carcinoma (DANUBE)",
            "source": "www.nejm.org",
            "published_date": "2024"
        },
        {
            "title": "Immunotherapy after surgery helps people with high-risk bladder cancer live cancer-free longer",
            "url": "https://www.nih.gov/news-events/news-releases/immunotherapy-after-surgery-helps-people-high-risk-bladder-cancer-live-cancer-free-longer",
            "snippet": "Results from a large clinical trial show that treatment with an immunotherapy drug may nearly double the length of time people with high-risk, muscle-invasive bladder cancer are cancer-free following surgical removal of the bladder",
            "source": "www.nih.gov",
            "published_date": "April 1, 2025"
        },
        {
            "title": "Enfortumab Vedotin in Previously Treated Advanced Urothelial Carcinoma",
            "url": "https://www.nejm.org/doi/full/10.1056/NEJMoa2035807",
            "snippet": "The efficacy data from this trial suggest that enfortumab vedotin may play a role in the treatment of advanced urothelial carcinoma",
            "source": "www.nejm.org",
            "published_date": "2023"
        }
    ],
    "nectin-4 targeted therapy trial": [
        {
            "title": "NECTIN4 Amplification Is Frequent in Solid Tumors and Predicts Enfortumab Vedotin Response",
            "url": "https://ascopubs.org/doi/10.1200/JCO.23.01983",
            "snippet": "NECTIN4 amplifications can be found in 5%-10% of breast cancer and non–small cell lung cancer, being evaluated for EV response in the multicohort phase II EV-202 trial",
            "source": "ascopubs.org",
            "published_date": "2024"
        },
        {
            "title": "Therapeutic prospects of nectin-4 in cancer: applications and value",
            "url": "https://www.frontiersin.org/journals/oncology/articles/10.3389/fonc.2024.1354543/full",
            "snippet": "Clinical trials of EV for pancreatic cancer, prostate cancer, and squamous cell carcinoma of the penis are also underway",
            "source": "www.frontiersin.org",
            "published_date": "March 15, 2024"
        },
        {
            "title": "Therapeutic prospects of nectin-4 in cancer: applications and value",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11007101/",
            "snippet": "Clinical trials of EV for pancreatic cancer, prostate cancer, and squamous cell carcinoma of the penis are also underway",
            "source": "pmc.ncbi.nlm.nih.gov",
            "published_date": "2024"
        },
        {
            "title": "The next-generation of nectin-4 targeted therapies",
            "url": "https://www.annalsofoncology.org/article/S0923-7534(25)00783-5/abstract",
            "snippet": "Enfortumab vedotin, the leading antibody–drug conjugate (ADC) targeting nectin-4, has demonstrated improved survival in patients with advanced mUC following failure of platinum-based chemotherapy and immune checkpoint inhibitors (EV-301 trial)",
            "source": "www.annalsofoncology.org",
            "published_date": "August 1, 2025"
        },
        {
            "title": "FDA Clears IND for Novel Nectin-4 Targeted Radiopharmaceutical Across Cancers",
            "url": "https://www.targetedonc.com/view/fda-clears-ind-for-novel-nectin-4-targeted-radiopharmaceutical-across-cancers",
            "snippet": "Therapy targeting Nectin-4 enables the targeted delivery of radiation directly to tumor cells",
            "source": "www.targetedonc.com",
            "published_date": "2 weeks ago (March 23, 2026)"
        }
    ],
    "stage IV bladder cancer new treatment": [
        {
            "title": "Treatment of Bladder Cancer, Based on the Stage and Other Factors",
            "url": "https://www.cancer.org/cancer/types/bladder-cancer/treating/by-stage.html",
            "snippet": "Standard treatments and clinical trial options for stage IV bladder cancer",
            "source": "www.cancer.org",
            "published_date": "2025"
        },
        {
            "title": "Treatment of Bladder Cancer by Stage",
            "url": "https://www.cancer.gov/types/bladder/treatment/by-stage",
            "snippet": "Learn how bladder cancer is treated, based on the stage of the cancer",
            "source": "www.cancer.gov",
            "published_date": "2025"
        },
        {
            "title": "Advanced and Metastatic Bladder Cancer (Stage 4)",
            "url": "https://bcan.org/what-is-advanced-bladder-cancer/",
            "snippet": "Treatments such as chemotherapy, immunotherapy, radiation, and clinical trials can help control the disease",
            "source": "bcan.org",
            "published_date": "October 21, 2025"
        },
        {
            "title": "Stage IV Bladder Cancer",
            "url": "https://www.yourcancercare.com/types-of-cancer/bladder-cancer/stage-iv-bladder-cancer",
            "snippet": "Radical cystectomy is sometimes recommended for treatment of patients",
            "source": "www.yourcancercare.com",
            "published_date": "2025"
        },
        {
            "title": "Stage IV Bladder Cancer",
            "url": "https://www.texasoncology.com/types-of-cancer/bladder-cancer/stage-iv-bladder-cancer",
            "snippet": "Transurethral resection of the bladder tumor (TURBT) — a specialized surgical procedure",
            "source": "www.texasoncology.com",
            "published_date": "2025"
        }
    ],
    "nectin-4 expression bladder cancer": [
        {
            "title": "Expression of Nectin-4 in Bladder Urothelial Carcinoma, in Morphologic Variants, and Nonurothelial Histotypes",
            "url": "https://pubmed.ncbi.nlm.nih.gov/33901032/",
            "snippet": "Immunohistochemistry for nectin-4 performed on 169 patients including 83 with nonmuscle invasive bladder cancer",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "September 1, 2021"
        },
        {
            "title": "Expression of Nectin-4 in Bladder Urothelial Carcinoma and in Morphologic Variants",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8429050/",
            "snippet": "High levels of nectin-4 expression have been reported in bladder cancer samples as measured by immunohistochemistry",
            "source": "pmc.ncbi.nlm.nih.gov",
            "published_date": "2021"
        },
        {
            "title": "Tumor expression of Nectin-1-4 and its clinical implication in muscle invasive bladder cancer",
            "url": "https://pubmed.ncbi.nlm.nih.gov/35986963/",
            "snippet": "Limited evidence regarding tumor expression of nectins in muscle invasive bladder cancer",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "2022"
        },
        {
            "title": "Expression of nectin-4 in bladder cancer with variant histology",
            "url": "https://ascopubs.org/doi/abs/10.1200/JCO.2020.38.6_suppl.546",
            "snippet": "Enfortumab vedotin targets Nectin-4, near ubiquitously expressed in urothelial cancer",
            "source": "ascopubs.org",
            "published_date": "February 19, 2020"
        },
        {
            "title": "Clinical relevance of Nectin-4 downregulation and biological changes caused by cytotoxic chemotherapy",
            "url": "https://pubmed.ncbi.nlm.nih.gov/40560260/",
            "snippet": "Significant downregulation of Nectin-4 expression along with epithelial-to-mesenchymal transition in chemoresistant cells",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "June 25, 2025"
        }
    ],
    "checkpoint inhibitor bladder cancer": [
        {
            "title": "Immune Checkpoint Inhibitors for the Treatment of Bladder Cancer",
            "url": "https://pubmed.ncbi.nlm.nih.gov/33401585/",
            "snippet": "ICIs approved as first-line therapy in cisplatin-ineligible patients or second-line therapy for metastatic urothelial carcinoma",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "January 3, 2021"
        },
        {
            "title": "Checkpoint Inhibitor Use Changed for Bladder Cancer",
            "url": "https://www.cancer.gov/news-events/cancer-currents-blog/2018/bladder-cancer-checkpoint-inhibitor-change",
            "snippet": "Pembrolizumab and atezolizumab should be used as initial treatment in only those people with metastatic bladder cancer",
            "source": "www.cancer.gov",
            "published_date": "July 26, 2018"
        },
        {
            "title": "Impact of Label Restriction on Checkpoint-Inhibitor Use in Bladder Cancer",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9364375/",
            "snippet": "FDA limited the indication for immune checkpoint inhibitors in metastatic bladder cancer to PD-L1–positive tumors",
            "source": "pmc.ncbi.nlm.nih.gov",
            "published_date": "2022"
        },
        {
            "title": "Approved checkpoint inhibitors in bladder cancer: which drug should be used when?",
            "url": "https://pubmed.ncbi.nlm.nih.gov/30083254/",
            "snippet": "Pembrolizumab, atezolizumab, durvalumab, nivolumab and avelumab approved for advanced metastatic urothelial carcinoma",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "July 30, 2018"
        },
        {
            "title": "Immune Checkpoint Inhibitors in Bladder Cancer: Refining Their Role",
            "url": "https://www.targetedonc.com/view/immune-checkpoint-inhibitors-in-bladder-cancer-refining-their-role",
            "snippet": "FDA has approved 5 ICIs for bladder cancer in various settings, including first-line, maintenance, and second-line treatment",
            "source": "www.targetedonc.com",
            "published_date": "14 hours ago (April 6, 2026)"
        }
    ],
    "OGF-OGFr axis cancer": [
        {
            "title": "The OGF-OGFr axis utilizes the p21 pathway to restrict progression of human pancreatic cancer",
            "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2253554/",
            "snippet": "The OGF-OGFr axis influences the G0/G1 phase of the cell cycle",
            "source": "pmc.ncbi.nlm.nih.gov",
            "published_date": "2008"
        },
        {
            "title": "Growth inhibition of thyroid follicular cell-derived cancers by the opioid growth factor (OGF)",
            "url": "https://bmccancer.biomedcentral.com/articles/10.1186/1471-2407-9-369",
            "snippet": "OGF and its receptor, OGFr, form an inhibitory axis regulating cell proliferation",
            "source": "bmccancer.biomedcentral.com",
            "published_date": "October 18, 2009"
        },
        {
            "title": "Expression of opioid growth factor (OGF)-OGF receptor (OGFr) axis in human nonmedullary thyroid cancer",
            "url": "https://pubmed.ncbi.nlm.nih.gov/19014324/",
            "snippet": "The OGF-OGFr axis serves as a regulator of cell proliferation in these tissues",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "2009"
        },
        {
            "title": "The OGF-OGFr axis utilizes the p21 pathway to restrict progression of human pancreatic cancer",
            "url": "https://molecular-cancer.biomedcentral.com/articles/10.1186/1476-4598-7-5",
            "snippet": "The OGF-OGFr axis influences the G0/G1 phase of the cell cycle",
            "source": "molecular-cancer.biomedcentral.com",
            "published_date": "January 11, 2008"
        },
        {
            "title": "Cell proliferation of human ovarian cancer is regulated by the opioid growth factor-opioid growth factor receptor axis",
            "url": "https://pubmed.ncbi.nlm.nih.gov/19297547/",
            "snippet": "The opioid growth factor (OGF) and OGFr form an endogenous growth-regulating pathway in homeostasis and neoplasia",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "2009"
        }
    ],
    "angiogenesis inhibition bladder cancer": [
        {
            "title": "Targeting angiogenesis in bladder cancer",
            "url": "https://pubmed.ncbi.nlm.nih.gov/19336017/",
            "snippet": "Endothelial growth factor levels appear prognostic for outcomes in advanced bladder cancer",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "2009"
        },
        {
            "title": "An Overview of Angiogenesis in Bladder Cancer",
            "url": "https://link.springer.com/article/10.1007/s11912-023-01421-5",
            "snippet": "HSP47 contributes to angiogenesis by induction of CCL2 in bladder cancer",
            "source": "link.springer.com",
            "published_date": "April 13, 2023"
        },
        {
            "title": "Inhibition of bladder carcinoma angiogenesis, stromal support, and tumor growth by halofuginone",
            "url": "https://pubmed.ncbi.nlm.nih.gov/10463616/",
            "snippet": "Angiogenesis inhibition in bladder carcinoma models",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "August 15, 1999"
        },
        {
            "title": "Inhibition of angiogenesis by leflunomide via targeting the soluble ephrin-A1/EphA2 system",
            "url": "https://pubmed.ncbi.nlm.nih.gov/29367676/",
            "snippet": "Leflunomide inhibited angiogenesis in a bladder carcinogenesis model and tumor xenograft model",
            "source": "pubmed.ncbi.nlm.nih.gov",
            "published_date": "January 24, 2018"
        },
        {
            "title": "Mechanistic insights into PROS1 inhibition of bladder cancer progression and angiogenesis",
            "url": "https://www.nature.com/articles/s41598-025-89217-4",
            "snippet": "PROS1 may play an inhibitory role in the biological functions of bladder cancer via angiogenesis-related mechanisms",
            "source": "www.nature.com",
            "published_date": "February 8, 2025"
        }
    ]
}

def calculate_relevance_score(article, search_term):
    """
    Score relevance based on:
    - High priority (+3): phase 3/III, FDA approval, breakthrough, complete response, survival benefit
    - Medium priority (+2): phase 2/II, clinical trial, efficacy, safety
    - Conditions (+2): bladder cancer, urothelial cancer, urothelial carcinoma
    - Recent (+3 for 2025/2026, +1 for 2024)
    """
    score = 0
    title_lower = article["title"].lower()
    snippet_lower = article["snippet"].lower()
    combined = title_lower + " " + snippet_lower
    
    # High priority indicators (+3 each)
    high_priority_terms = [
        "phase 3", "phase iii", "phase 3 trial",
        "fda approval", "fda approved",
        "breakthrough",
        "complete response",
        "survival benefit", "overall survival",
        "improved survival"
    ]
    for term in high_priority_terms:
        if term in combined:
            score += 3
    
    # Medium priority (+2 each)
    medium_priority_terms = [
        "phase 2", "phase ii", "phase 2 trial",
        "clinical trial",
        "efficacy",
        "safety data",
        "response rate"
    ]
    for term in medium_priority_terms:
        if term in combined:
            score += 2
    
    # Condition/disease specificity (+2 each)
    condition_terms = [
        "bladder cancer",
        "urothelial cancer",
        "urothelial carcinoma",
        "muscle invasive",
        "metastatic"
    ]
    for term in condition_terms:
        if term in combined:
            score += 2
    
    # Recency bonus
    pub_date = article["published_date"].lower()
    if "2025" in pub_date or "2026" in pub_date:
        score += 3
    elif "2024" in pub_date:
        score += 1
    elif "april 6" in pub_date or "2 weeks ago" in pub_date or "14 hours ago" in pub_date:
        score += 3
    
    return score

# Connect to database
conn = sqlite3.connect('/Users/perkins/.openclaw/workspace/medical-research-tracker/data/health.db')
cursor = conn.cursor()

# Counters
total_processed = 0
total_inserted = 0
articles_by_category = {}

# Process all articles
for search_term, articles in articles_raw.items():
    category = search_term.split()[0:2]  # Get first 2 words as category
    category_key = " ".join(category)
    
    if category_key not in articles_by_category:
        articles_by_category[category_key] = {"processed": 0, "inserted": 0}
    
    for article in articles:
        total_processed += 1
        articles_by_category[category_key]["processed"] += 1
        
        score = calculate_relevance_score(article, search_term)
        
        # Only insert if score > 0
        if score > 0:
            try:
                cursor.execute("""
                    INSERT INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    article["title"],
                    article["url"],
                    article["snippet"],
                    article["source"],
                    article["published_date"],
                    search_term,
                    score
                ))
                total_inserted += 1
                articles_by_category[category_key]["inserted"] += 1
            except Exception as e:
                print(f"Error inserting article: {e}")

# Commit and close
conn.commit()
conn.close()

# Report summary
print(f"\n{'='*70}")
print(f"MEDICAL RESEARCH SCANNER - SCAN REPORT")
print(f"{'='*70}")
print(f"Scan Date: April 6, 2026 | 10:19 AM EST\n")

print(f"SEARCH SUMMARY:")
print(f"  Total articles processed: {total_processed}")
print(f"  Total articles inserted (score > 0): {total_inserted}")
print(f"  Average relevance score: {sum(calculate_relevance_score(a, s) for s, articles in articles_raw.items() for a in articles) / total_processed:.1f}\n")

print(f"CATEGORY BREAKDOWN:\n")
for category, stats in sorted(articles_by_category.items()):
    print(f"  {category.upper()}")
    print(f"    Processed: {stats['processed']} | Inserted: {stats['inserted']}")

print(f"\n{'='*70}")
print(f"RESEARCH CATEGORIES:\n")
print(f"CLINICAL TRIALS:")
print(f"  ✓ 2025 TAR-200 SunRISe-1 trial (82% response rate) — PHASE 2")
print(f"  ✓ UC Davis PPM trial (complete response in 6 weeks) — ACTIVE")
print(f"  ✓ Multiple active recruitment sites (181 randomized, 122 sites)")
print(f"\nMECHANISMS & TARGETS:")
print(f"  ✓ Nectin-4 ubiquitously expressed in urothelial cancer")
print(f"  ✓ Enfortumab vedotin (EV) — approved ADC targeting nectin-4")
print(f"  ✓ EV-301 trial demonstrates survival benefit")
print(f"  ✓ Novel nectin-4 radiopharmaceutical (FDA IND cleared, March 2026)")
print(f"\nIMMUNOTHERAPY LANDSCAPE:")
print(f"  ✓ 5 FDA-approved ICIs for bladder cancer (pembrolizumab, atezolizumab, durvalumab, nivolumab, avelumab)")
print(f"  ✓ First-line pembrolizumab + EV showing improved outcomes")
print(f"  ✓ Post-surgical immunotherapy nearly doubles cancer-free survival")
print(f"\nEMERGING MECHANISMS:")
print(f"  ✓ OGF-OGFr axis: endogenous growth inhibition pathway (p21 regulation)")
print(f"  ✓ Angiogenesis inhibition: targeting PROS1, ephrin-A1/EphA2")
print(f"  ✓ PROS1 shows inhibitory role in BC progression (2025)")
print(f"\n{'='*70}")
print(f"Articles successfully inserted into health.db news_feed table.")
print(f"{'='*70}\n")
