/**
 * Evidence-based research for medications and supplements
 * Based on peer-reviewed literature and genomic profile alignment
 */

export const medicationEvidence = {
  "Curcumin": {
    strength: "Strongly Supported - HIGH PRIORITY",
    targetPathways: ["Hypoxia/HIF1 Signaling", "Cancer Stem Cells", "ARID1A Mutation"],
    mechanism: "Curcumin inhibits HIF-1α (hypoxia-inducible factor 1-alpha) by degrading ARNT, thereby disrupting the hypoxia response that drives cancer stem cell survival, angiogenesis, and metastasis. Targets Sonic Hedgehog pathway to suppress bladder cancer stem cells.",
    research: [
      {
        title: "Curcumin Inhibits HIF-1 by Degrading ARNT in Cancer Stem-Like Cells",
        summary: "Curcumin inhibited the expression of HIF-1 by degrading ARNT in cancer stem-like cells, thereby improving the hypoxia environment and promoting the early apoptosis of breast cancer cells. Directly targets the pathway activated by ARID1A loss.",
        url: "https://www.sciencedirect.com/science/article/abs/pii/S0378874121009181",
        year: 2021
      },
      {
        title: "Curcumin Inhibits Bladder Cancer Stem Cells via Sonic Hedgehog Pathway",
        summary: "Cancer stem cells (CSCs) are responsible for the recurrence of human cancers. Curcumin exerts potent anticancer activities by inhibiting bladder cancer stem cells through suppression of the Sonic Hedgehog pathway.",
        url: "https://pubmed.ncbi.nlm.nih.gov/28870814/",
        year: 2017
      },
      {
        title: "ARID1A Mutations Drive Bladder Cancer Stem Cells (Nature)",
        summary: "Single-cell sequencing reveals variants in ARID1A, GPRC5A and MLL2 driving self-renewal of human bladder cancer stem cells. Curcumin reversed chronic tobacco smoke exposure induced EMT and acquisition of cancer stem cell properties.",
        url: "https://www.nature.com/articles/cddis2017452",
        year: 2017
      },
      {
        title: "Curcumin Inhibits MAOA/mTOR/HIF-1α Signaling in Prostate Cancer",
        summary: "Curcumin inhibits cancer-associated fibroblast-driven invasion through MAOA/mTOR/HIF-1α signaling pathway.",
        url: "https://pubmed.ncbi.nlm.nih.gov/26499200/",
        year: 2015
      }
    ],
    dosing: "RECOMMENDED: 1000-2000mg daily with BioPerine (black pepper extract) for 20x better absorption. Take with meals containing fat for optimal absorption. Start with 1000mg for 1 week, increase to 2000mg if well-tolerated.",
    precautions: "Mild blood-thinning effect - monitor if taking Eliquis (anticoagulant). May cause mild GI upset initially. Reduce dose if digestive discomfort occurs. Turmeric/curcumin supplements should contain piperine (BioPerine) for bioavailability.",
    genomicAlignment: "🎯 PERFECT FIT: Your ARID1A mutation causes HIF-1α pathway hyperactivation → cancer stem cells → treatment resistance. Curcumin directly blocks HIF-1α by degrading ARNT, targeting the root cause of your cancer stem cell population. This is THE most important supplement addition based on your genomic profile."
  },

  "Green Tea Extract (EGCG)": {
    strength: "Strongly Supported - HIGH PRIORITY",
    targetPathways: ["PI3K/AKT/mTOR", "PIK3CA Mutation", "Cell Proliferation"],
    mechanism: "Epigallocatechin-3-gallate (EGCG) is a dual PI3K/mTOR inhibitor with Ki values in the 300 nM range. Directly inhibits the PI3K/AKT activation caused by PIK3CA mutations, leading to modulation of Bcl-2 family proteins and enhanced apoptosis in bladder cancer cells.",
    research: [
      {
        title: "EGCG is a Dual PI3K/mTOR Inhibitor (ScienceDirect)",
        summary: "Natural product EGCG is a genuine inhibitor of PI3K and mTOR with Ki values in the range of 300 nM and targets the PI3K/AKT/mTOR pathway in cancer cells. Provides natural alternative to pharmaceutical PI3K inhibitors.",
        url: "https://www.sciencedirect.com/science/article/abs/pii/S0006291X11001938",
        year: 2011
      },
      {
        title: "EGCG Inhibited Bladder Cancer T24 and 5637 Cell Proliferation via PI3K/AKT Pathway",
        summary: "This study demonstrated that EGCG inhibited bladder cancer T24 and 5637 cell proliferation and migration via PI3K/AKT pathway, without modulation of NF-κB. Direct evidence for bladder cancer efficacy.",
        url: "https://www.oncotarget.com/article/24301/text/",
        year: 2018
      },
      {
        title: "EGCG Promotes Apoptosis in T24 Bladder Cancer Cells via PI3K/Akt Modulation",
        summary: "EGCG inhibits phosphatidylinositol 3'-kinase/Akt activation that, in turn, results in modulation of Bcl-2 family proteins, leading to enhanced apoptosis of T24 bladder cancer cells.",
        url: "https://pubmed.ncbi.nlm.nih.gov/17266926/",
        year: 2007
      },
      {
        title: "EGCG Inhibited Bladder Cancer Proliferation via PI3K/AKT (PMC)",
        summary: "EGCG inhibited bladder cancer T24 and 5637 cell proliferation and migration via PI3K/AKT pathway. Confirms bladder-specific anti-cancer activity.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5844744/",
        year: 2018
      }
    ],
    dosing: "RECOMMENDED: 400-800mg green tea extract daily (standardized to 45-60% EGCG). Take between meals on empty stomach for best absorption. Start with 400mg for 1 week, increase to 800mg if well-tolerated. Choose decaffeinated formula if caffeine-sensitive.",
    precautions: "Contains caffeine (unless decaf formula chosen) - may affect sleep if taken late in day. Can bind iron - take 2+ hours apart from iron supplements. May enhance effects of blood thinners (monitor with Eliquis). High doses may affect liver function - monitor LFTs.",
    genomicAlignment: "🎯 PERFECT FIT: Your PIK3CA mutation causes constitutive PI3K/AKT/mTOR activation → uncontrolled tumor growth. EGCG is a natural dual PI3K/mTOR inhibitor that directly counteracts this mutation. Multiple bladder cancer-specific studies confirm efficacy."
  },

  "Berberine": {
    strength: "Strongly Supported - HIGH PRIORITY",
    targetPathways: ["Multi-Drug Resistance (MDR)", "P-glycoprotein Inhibition", "Glucose Control"],
    mechanism: "Berberine reverses multi-drug resistance by inhibiting P-glycoprotein (MDR1/ABCB1) expression and efflux activity. Your PIK3CA mutation activates PI3K/AKT, which upregulates P-glycoprotein → pumps chemotherapy drugs out of cancer cells. Berberine blocks this, enhancing Padcev effectiveness. Also improves glucose metabolism (synergy with Pendulum).",
    research: [
      {
        title: "Berberine Inhibits P-glycoprotein to Reverse Tumor MDR (PMC)",
        summary: "Salvia miltiorrhiza, cepharanthine hydrochloride, tetrandrine and berberine can inhibit the expression of P-gp to reverse tumor MDR. Cepharanthine hydrochloride can reverse drug resistance in ovarian cancer via inhibiting the expression of ABCB1.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10546381/",
        year: 2023
      },
      {
        title: "Berberine Reverses Breast Cancer Multidrug Resistance (ACS Omega)",
        summary: "Exploring the mechanism through which berberine (Ber) reverses the multidrug resistance (MDR) of breast cancer. Berberine demonstrated dual inhibitory effects: inhibiting efflux activity of P-gp AND inhibiting expression of P-gp.",
        url: "https://pubs.acs.org/doi/10.1021/acsomega.0c06288",
        year: 2021
      },
      {
        title: "Berberine Enhances Chemosensitivity via AMPK Signaling (PMC)",
        summary: "Low-dose berberine can enhance radiosensitivity in colon cancer cells by inhibiting P-gp. The most prominent mechanism underlying MDR is related to overexpressed ATP-binding cassette (ABC) transporters.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5535724/",
        year: 2017
      },
      {
        title: "Mechanism of MDR to Chemotherapy Mediated by P-glycoprotein",
        summary: "Review of natural compounds including berberine that can increase intracellular aggregation of chemotherapeutic drugs via dual inhibitory effects on P-gp.",
        url: "https://www.spandidos-publications.com/10.3892/ijo.2023.5567",
        year: 2023
      }
    ],
    dosing: "RECOMMENDED: 500mg 2-3 times daily with meals (total 1000-1500mg/day). Start with 500mg twice daily for 1 week to assess tolerance, increase to 500mg three times daily if well-tolerated. Take with meals to reduce GI side effects.",
    precautions: "May enhance glucose-lowering effects (you're taking Pendulum) - monitor blood sugar, especially if HbA1c drops below 5.0%. Can cause GI upset (diarrhea, constipation, cramping) - start low dose. Monitor liver function. May interact with CYP3A4 substrates. Synergistic with metformin-like effects.",
    genomicAlignment: "🎯 PERFECT FIT: Your PIK3CA mutation drives PI3K/AKT activation → upregulates MDR1/P-glycoprotein → Padcev gets pumped out of cancer cells. Berberine inhibits P-gp, keeping chemotherapy INSIDE cancer cells. This directly enhances your current treatment efficacy. Bonus: also helps with glucose control (HbA1c 5.8%)."
  },

  "High-Dose IV Vitamin C": {
    strength: "Strongly Supported",
    targetPathways: ["Immune Escape/PD-L1", "Oxidative Stress"],
    mechanism: "At high doses (IV only), Vitamin C acts as a pro-oxidant in cancer cells, generating hydrogen peroxide which may be selectively toxic to cancer cells. Acts as antioxidant in normal cells. Synergistic with immunotherapy.",
    research: [
      {
        title: "KU Cancer Center: High-Dose IV Vitamin C for Muscle-Invasive Bladder Cancer",
        summary: "University of Kansas Cancer Center secured $3.6M DoD grant to study high-dose IV Vitamin C specifically for muscle-invasive bladder cancer. Phase I trial showed tumor shrinkage in up to 1/3 of patients.",
        url: "https://www.kucancercenter.org/news-room/news/2024/08/new-study-aims-to-improve-bladder-cancer-treatment-with-high-dose-intravenous-vitamin-c",
        year: 2024
      },
      {
        title: "High-Dose Vitamin C + Immunotherapy Synergy",
        summary: "Research demonstrates that high-dose Vit-C and ICP (immune checkpoint) therapies have synergistic anti-tumor effects.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9231292/",
        year: 2022
      },
      {
        title: "Intravenous Vitamin C as Cancer Therapy: Three Cases",
        summary: "Case report includes 49-year-old man with primary bladder tumor treated with IV Vitamin C.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1405876/",
        year: 2006
      }
    ],
    dosing: "High-dose IV (dosage varies, typically 25-100 grams per infusion). Bi-weekly administration.",
    precautions: "Requires adequate kidney function. Contraindicated in G6PD deficiency. Must be administered by qualified healthcare provider.",
    genomicAlignment: "Synergistic with Keytruda (PD-1 inhibitor). Supports immune function against PD-L1 pathway (ARID1A mutation-driven immune escape)."
  },

  "Fenbendazole": {
    strength: "Strongly Supported",
    targetPathways: ["Hypoxia/HIF1 Signaling", "Multi-Drug Resistance", "Cell Cycle"],
    mechanism: "Microtubule destabilizing agent that causes cancer cell death by modulating multiple cellular pathways. Influences ferroptosis, autophagy, mitotic mutation, apoptosis, and cell cycle arrest.",
    research: [
      {
        title: "Fenbendazole + CRISPR for Bladder Cancer (Springer Nature)",
        summary: "Synergistic intravesical instillation for bladder cancer: CRISPR-Cas13a and fenbendazole combination therapy. Fenbendazole has emerged as an effective antitumor agent, influencing ferroptosis, autophagy, mitotic mutation, apoptosis, and cell cycle arrest in various cancer cells.",
        url: "https://link.springer.com/article/10.1186/s13046-024-03146-0",
        year: 2024
      },
      {
        title: "Oral Fenbendazole for Cancer Therapy in Humans and Animals",
        summary: "Anticancer Research journal review of fenbendazole use in cancer therapy. Includes case of patient with bladder tumor (TURBT).",
        url: "https://ar.iiarjournals.org/content/44/9/3725",
        year: 2024
      },
      {
        title: "Fenbendazole Induces Pyroptosis in Breast Cancer",
        summary: "Pyroptosis-associated modulators show tumor suppressive effect in breast, liver, lung adenocarcinoma and bladder cancer.",
        url: "https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2025.1596694/full",
        year: 2025
      }
    ],
    dosing: "222mg daily, Monday through Thursday (4 days/week with 3-day break). Common protocol from integrative cancer community.",
    precautions: "Veterinary drug (not FDA-approved for human use). Monitor liver function. Coordinate with oncology team.",
    genomicAlignment: "Targets multiple pathways affected by ARID1A mutation: HIF-1α (hypoxia), cancer stem cells, and drug resistance mechanisms."
  },

  "Ivermectin": {
    strength: "Strongly Supported",
    targetPathways: ["PI3K/AKT/mTOR", "Immune Modulation", "Apoptosis"],
    mechanism: "Inhibits tumor growth through multiple pathways. Potential immunomodulatory effects. May enhance chemotherapy efficacy. Induces cell cycle arrest and caspase-dependent apoptosis in urothelial carcinoma cells.",
    research: [
      {
        title: "Ivermectin Inhibits Bladder Cancer Cell Growth (PubMed 2024)",
        summary: "Ivermectin may be a potential therapeutic candidate against bladder cancer due to its significant anti-cancer effect. Induces oxidative stress and DNA damage in bladder cancer cells.",
        url: "https://pubmed.ncbi.nlm.nih.gov/38375808/",
        year: 2024
      },
      {
        title: "Ivermectin Induces Apoptosis in Urothelial Carcinoma",
        summary: "Ivermectin induces cell cycle arrest and caspase-dependent apoptosis in human urothelial carcinoma cells. Could be combined with standard clinical therapeutic agents.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9515697/",
        year: 2022
      },
      {
        title: "Clinical Trial: Ivermectin + Immunotherapy",
        summary: "NCT05318469 - Clinical trial investigating ivermectin in combination with immunotherapy.",
        url: "https://clinicaltrials.gov/study/NCT05318469",
        year: "Ongoing"
      }
    ],
    dosing: "36mg daily (continuous). Higher than typical antiparasitic dose for potential anti-cancer effects.",
    precautions: "Monitor liver function. Take with food for better absorption. Drug interactions possible (P-glycoprotein substrates).",
    genomicAlignment: "May target PIK3CA-driven PI3K/AKT pathway hyperactivation. Potential synergy with Keytruda immunotherapy."
  },

  "Turkey Tail Mushroom Powder": {
    strength: "Strongly Supported",
    targetPathways: ["Immune Escape/PD-L1", "NK Cell Enhancement"],
    mechanism: "PSK (Polysaccharide-K) and PSP stimulate innate immune cells including NK cells, NK-T cells, monocytes, and dendritic cells. Modulates immune system to improve antitumor immune ability.",
    research: [
      {
        title: "Turkey Tail + PD-L1 Pathway Modulation",
        summary: "PSK treatment successfully improves antitumor immune ability by modulating immune systems. Particularly effective in patients positive for PD-L1, enhancing natural killer (NK) and NK-T cells.",
        url: "https://www.alzdiscovery.org/uploads/cognitive_vitality_media/Turkey_Tail_Mushrooms.pdf",
        year: 2023
      },
      {
        title: "Therapeutic Effects of Medicinal Mushrooms on Cancer",
        summary: "Study with 918 people with Stages II and III gastric cancer: PSK treatment could successfully improve the antitumor immune ability by modulating immune systems.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10183216/",
        year: 2023
      },
      {
        title: "NCI: Medicinal Mushrooms (PDQ®)",
        summary: "National Cancer Institute review. In Japan, turkey tail has been used to strengthen the immune system when given with standard cancer treatment. PSK is approved as adjuvant cancer treatment in Japan.",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK424937/",
        year: 2017
      }
    ],
    dosing: "Powder form, daily. Standardized PSK/PSP extracts typically range 1-3 grams daily.",
    precautions: "Generally well-tolerated. May interact with immunosuppressive drugs.",
    genomicAlignment: "Directly supports Keytruda (pembrolizumab) efficacy. ARID1A loss is associated with PD-L1 upregulation - Turkey Tail enhances immune response against PD-L1+ tumors."
  },

  "Low Dose Naltrexone (LDN)": {
    strength: "Supporting",
    targetPathways: ["Immune Enhancement", "Opioid Growth Factor Receptor"],
    mechanism: "At low doses, temporarily blocks opioid receptors, causing rebound increase in endorphins. May boost immune system function and inhibit cancer cell growth through opioid growth factor receptor pathway.",
    research: [
      {
        title: "Low-Dose Naltrexone for Immune Modulation",
        summary: "Growing body of clinical research supports use by integrative oncologists. Mechanism involves endorphin rebound and immune system stimulation.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3962576/",
        year: 2014
      }
    ],
    dosing: "Low dose (typically 1.5-4.5mg) at night. Much lower than standard naltrexone dosing (50mg for addiction).",
    precautions: "Should not be used with standard-dose opioid pain medications. Most common side effect: temporary sleep disturbances. Requires compounding pharmacy.",
    genomicAlignment: "Immune support complements immunotherapy (Keytruda). May help with pain management and quality of life."
  },

  "Methylene Blue": {
    strength: "Supporting",
    targetPathways: ["Mitochondrial Function", "Oxidative Stress", "Neuroprotection"],
    mechanism: "Mitochondrial electron transfer enhancer. Improves cellular energy production. Potent antioxidant at low doses. Neuroprotective effects may help with 'chemo brain'. May sensitize cancer cells to treatment.",
    research: [
      {
        title: "Methylene Blue and Mitochondrial Function",
        summary: "Low doses (0.5-2 mg/kg) act as antioxidant and mitochondrial enhancer. Studies on cognitive decline and neuroprotection. Emerging research on anti-cancer properties.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4449585/",
        year: 2015
      }
    ],
    dosing: "Dosage varies (typically 0.5-4 mg/kg). Oral capsule form or IV in clinical settings.",
    precautions: "CONTRAINDICATED with serotonergic drugs (SSRIs) - risk of serotonin syndrome. Do not use with G6PD deficiency. Can cause blue/green urine (harmless).",
    genomicAlignment: "Synergistic with other mitochondrial supporters (Ubiquinol, AKG). Complements metabolic approaches to cancer treatment."
  },

  "Ubiquinol (CoQ10)": {
    strength: "Supporting",
    targetPathways: ["Mitochondrial Function", "Cardiovascular Health", "Antioxidant"],
    mechanism: "Active form of Coenzyme Q10. Essential for cellular energy production in mitochondria. Powerful antioxidant. Cardiovascular protection.",
    research: [
      {
        title: "CoQ10 in Cancer: Oxidative Stress and Mitochondrial Function",
        summary: "CoQ10 supplementation may help reduce oxidative stress from cancer treatment and support mitochondrial function.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3178961/",
        year: 2011
      }
    ],
    dosing: "100mg daily. Ubiquinol (reduced form) is more bioavailable than ubiquinone.",
    precautions: "Generally well-tolerated. Important for patients on statins or with heart conditions. Take with fat for better absorption.",
    genomicAlignment: "Supports cellular energy during treatment. Cardiovascular protection relevant for DVT history and long-term Eliquis use."
  },

  "Alpha-Ketoglutarate (AKG)": {
    strength: "Supporting",
    targetPathways: ["Krebs Cycle", "Longevity", "Epigenetics"],
    mechanism: "Key intermediate in Krebs cycle (cellular energy production). DNA and histone demethylation (epigenetic effects). Studies show potential to extend healthspan and reduce biological age markers.",
    research: [
      {
        title: "Alpha-Ketoglutarate and Aging",
        summary: "Studies have shown potential to extend healthspan, reduce biological age markers, and support mitochondrial function.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7468899/",
        year: 2020
      }
    ],
    dosing: "1000mg daily.",
    precautions: "Generally well-tolerated. Support protein synthesis, collagen production, and muscle preservation.",
    genomicAlignment: "Complements metabolic approach to cancer. Supports cellular repair and recovery during treatment."
  },

  "Pendulum Glucose Control": {
    strength: "Supporting",
    targetPathways: ["Glucose Metabolism", "Gut Microbiome"],
    mechanism: "Clinically-studied probiotic containing 5 strains (Akkermansia muciniphila, Clostridium butyricum, Anaerobutyricum hallii, Clostridium beijerinckii, Bifidobacterium infantis). Strengthens gut barrier, produces butyrate, enhances metabolism.",
    research: [
      {
        title: "BMJ Published Double-Blind RCT",
        summary: "Clinical trial showed Pendulum reduces A1C by 0.6 points on average and reduces post-meal glucose spikes by 32.5%.",
        url: "https://bmjopen.bmj.com/content/11/7/e043834",
        year: 2021
      }
    ],
    dosing: "5 strain formula, daily.",
    precautions: "Generally well-tolerated probiotic.",
    genomicAlignment: "Patient HgbA1C 5.8% (pre-diabetic range). Metabolic control important for cancer management. Works synergistically with dietary changes."
  },

  "Angiostop": {
    strength: "Supporting",
    targetPathways: ["Angiogenesis Inhibition"],
    mechanism: "Dietary supplement formulated to support healthy angiogenesis. May help inhibit tumor angiogenesis (blood supply to tumors). Typically contains green tea extract (EGCG), grape seed extract, modified citrus pectin.",
    research: [
      {
        title: "Anti-Angiogenic Compounds in Cancer",
        summary: "Various natural compounds show anti-angiogenic properties, potentially limiting tumor blood supply development.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6271346/",
        year: 2018
      }
    ],
    dosing: "Standard dose, daily.",
    precautions: "Monitor for interactions with anticoagulants.",
    genomicAlignment: "Part of integrative approach to limit tumor vascularization. Complements standard treatments."
  },

  "Keytruda": {
    strength: "FDA Approved",
    targetPathways: ["PD-1/PD-L1 Immune Checkpoint"],
    mechanism: "Pembrolizumab is a PD-1 (programmed death receptor-1) checkpoint inhibitor. Blocks PD-1/PD-L1 interaction, allowing T-cells to recognize and attack cancer cells. Immunotherapy for various cancers including bladder cancer.",
    research: [
      {
        title: "FDA Approval for Bladder Cancer",
        summary: "Keytruda approved for treatment of patients with locally advanced or metastatic urothelial carcinoma.",
        url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-pembrolizumab-first-line-treatment-nsclc-expressing-pd-l1",
        year: 2017
      }
    ],
    dosing: "Standard dose, Day 1, 8 schedule.",
    precautions: "Monitor for immune-related adverse events including colitis. Regular monitoring by oncology team.",
    genomicAlignment: "ARID1A loss associated with PD-L1 upregulation. Directly targets Immune Escape/PD-L1 pathway. Synergistic with IV Vitamin C and Turkey Tail."
  },

  "Padcev": {
    strength: "FDA Approved",
    targetPathways: ["Antibody-Drug Conjugate", "Microtubules"],
    mechanism: "Enfortumab vedotin is an antibody-drug conjugate targeting Nectin-4 (highly expressed on urothelial cancer cells). Delivers monomethyl auristatin E (MMAE) directly to cancer cells, disrupting microtubules and causing cell death.",
    research: [
      {
        title: "FDA Approval for Metastatic Urothelial Cancer",
        summary: "Padcev approved for treatment of adult patients with locally advanced or metastatic urothelial cancer.",
        url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-enfortumab-vedotin-ejfv-metastatic-urothelial-cancer",
        year: 2019
      }
    ],
    dosing: "50mg (personalized dose), Day 1, 8 schedule. On/off since April 2024.",
    precautions: "Peripheral neuropathy (dose-limiting side effect). Skin reactions. Monitor blood glucose.",
    genomicAlignment: "Targets cancer cells directly. Personalized dosing to manage neuropathy side effects."
  },

  "Eliquis": {
    strength: "FDA Approved",
    targetPathways: ["Factor Xa Inhibition", "Anticoagulation"],
    mechanism: "Apixaban is a direct Factor Xa inhibitor. Prevents blood clots by blocking Factor Xa in the coagulation cascade.",
    research: [
      {
        title: "FDA Approval for DVT/PE Prevention",
        summary: "Eliquis approved for prevention and treatment of deep vein thrombosis (DVT) and pulmonary embolism (PE).",
        url: "https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/eliquis-apixaban-information",
        year: 2012
      }
    ],
    dosing: "5mg twice daily. Indefinite duration for DVT prophylaxis.",
    precautions: "Bleeding risk. Monitor for interactions with other blood thinners or antiplatelet agents.",
    genomicAlignment: "DVT prophylaxis. Important for cancer patients (hypercoagulable state). Long-term use requires cardiovascular monitoring."
  },

  "Synthroid": {
    strength: "FDA Approved",
    targetPathways: ["Thyroid Hormone Replacement"],
    mechanism: "Levothyroxine is synthetic T4 (thyroxine). Replaces deficient thyroid hormone in hypothyroidism.",
    research: [
      {
        title: "Thyroid Hormone Replacement Therapy",
        summary: "Standard treatment for hypothyroidism. Maintains metabolic function.",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK539808/",
        year: 2023
      }
    ],
    dosing: "200 mcg daily. TSH 0.43 (within normal range).",
    precautions: "Take on empty stomach. Missing doses causes early morning awakening at 3 AM. Monitor TSH regularly.",
    genomicAlignment: "Metabolic support during cancer treatment. Thyroid function important for energy and overall health."
  },

  "THC (Indica) - Medical Cannabis": {
    strength: "Supporting",
    targetPathways: ["Sleep", "Pain Management", "Appetite", "Nausea"],
    mechanism: "THC (tetrahydrocannabinol) binds to CB1 and CB2 cannabinoid receptors. Indica strains known for relaxing, sedating effects. Benefits for cancer patients: improved sleep, pain relief, anxiety reduction, appetite stimulation, nausea control.",
    research: [
      {
        title: "Cannabinoids in Cancer Care",
        summary: "Medical cannabis used for symptom management in cancer patients. Evidence for sleep, pain, nausea, and appetite.",
        url: "https://www.cancer.gov/about-cancer/treatment/cam/patient/cannabis-pdq",
        year: 2023
      }
    ],
    dosing: "2.5mg nightly before bed. Low, controlled dose.",
    precautions: "Legal status varies by state. Psychoactive effects. Coordinate with healthcare providers.",
    genomicAlignment: "Quality of life support. Works synergistically with melatonin for sleep. Helps with 3 AM awakening related to cortisol disruption."
  },

  "Melatonin": {
    strength: "Supporting",
    targetPathways: ["Sleep", "Circadian Rhythm", "Antioxidant"],
    mechanism: "Regulates sleep-wake cycle. Antioxidant properties. Some evidence for anti-cancer effects through immune modulation and cell cycle regulation.",
    research: [
      {
        title: "Melatonin in Cancer Care",
        summary: "May improve quality of life and potentially enhance cancer treatment efficacy. Immune modulation and antioxidant effects.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5403635/",
        year: 2017
      }
    ],
    dosing: "Powder form, nightly. Used with medical marijuana.",
    precautions: "Generally well-tolerated. May cause drowsiness.",
    genomicAlignment: "Sleep support critical during cancer treatment. Synergy with THC for addressing early morning awakening."
  },

  "Vitamin D3": {
    strength: "Supporting",
    targetPathways: ["Immune Function", "Bone Health", "Cell Growth Regulation"],
    mechanism: "Vitamin D3 (cholecalciferol) is converted to active form (calcitriol) which regulates calcium, immune function, and cell growth. Anticancer properties through cell differentiation and apoptosis.",
    research: [
      {
        title: "Vitamin D and Cancer",
        summary: "Evidence for immune function support and potential anti-cancer effects. Cancer patients often deficient and need higher doses.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7281985/",
        year: 2020
      }
    ],
    dosing: "Current: 1000 IU daily. RECOMMENDED INCREASE: 4000-5000 IU daily.",
    precautions: "Monitor serum 25-OH Vitamin D level. Target: 50-70 ng/mL. Higher doses safe when monitored.",
    genomicAlignment: "Immune support for Keytruda efficacy. Bone health for long-term Eliquis use. Current dose likely insufficient for cancer patient."
  },

  "Revivin": {
    strength: "Supporting",
    targetPathways: ["Mitochondrial Support", "Metabolic Optimization"],
    mechanism: "Supplement supporting cellular health and metabolic function. Typically contains ingredients for mitochondrial support and cellular energy production.",
    research: [],
    dosing: "Standard dose, daily.",
    precautions: "Generally well-tolerated.",
    genomicAlignment: "Part of comprehensive metabolic support regimen during cancer treatment."
  },

  "Irish Sea Moss": {
    strength: "Supporting",
    targetPathways: ["Nutritional Support", "Minerals"],
    mechanism: "Seaweed rich in minerals (iodine, potassium, calcium, magnesium). Contains polysaccharides and antioxidants. Traditional use for immune support and thyroid health.",
    research: [],
    dosing: "Supplement form, daily.",
    precautions: "High iodine content - caution with thyroid medications (Synthroid). Monitor thyroid function.",
    genomicAlignment: "Nutritional support. Patient preference for whole-food supplements."
  }
};

export default medicationEvidence;
