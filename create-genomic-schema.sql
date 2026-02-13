-- Genomic Mutations Schema
-- Foundation One CDx genomic profiling integration

-- Core mutations table
CREATE TABLE IF NOT EXISTS genomic_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene TEXT NOT NULL,
    alteration TEXT NOT NULL,
    transcript_id TEXT,
    coding_effect TEXT,
    variant_allele_frequency REAL,
    clinical_significance TEXT,
    mutation_type TEXT, -- substitution, insertion, deletion, copy_number, rearrangement
    report_date TEXT,
    report_source TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Biological pathways affected by mutations
CREATE TABLE IF NOT EXISTS pathways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    biological_role TEXT,
    cancer_relevance TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Link mutations to affected pathways
CREATE TABLE IF NOT EXISTS mutation_pathways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_id INTEGER NOT NULL,
    pathway_id INTEGER NOT NULL,
    impact_level TEXT, -- high, medium, low
    mechanism TEXT,
    FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id),
    FOREIGN KEY (pathway_id) REFERENCES pathways(id)
);

-- Therapies targeting specific mutations/pathways
CREATE TABLE IF NOT EXISTS mutation_treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_id INTEGER,
    pathway_id INTEGER,
    therapy_name TEXT NOT NULL,
    therapy_type TEXT, -- targeted_therapy, immunotherapy, chemotherapy, trial
    mechanism TEXT,
    clinical_evidence TEXT, -- FDA_approved, Phase_3, Phase_2, Phase_1, Preclinical
    sensitivity_or_resistance TEXT, -- sensitivity, resistance
    evidence_description TEXT,
    evidence_references TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id),
    FOREIGN KEY (pathway_id) REFERENCES pathways(id)
);

-- Clinical trials matched to genomic profile
CREATE TABLE IF NOT EXISTS genomic_trials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_id INTEGER,
    trial_name TEXT NOT NULL,
    target_biomarker TEXT,
    therapy_agents TEXT,
    phase TEXT,
    locations TEXT,
    eligibility_notes TEXT,
    nct_number TEXT,
    status TEXT, -- recruiting, active, completed
    priority_score INTEGER, -- Foundation One ranking
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id)
);

-- Biomarker findings (TMB, MSI, LOH, etc.)
CREATE TABLE IF NOT EXISTS biomarkers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biomarker_name TEXT NOT NULL,
    result TEXT NOT NULL,
    numeric_value REAL,
    unit TEXT,
    clinical_significance TEXT,
    report_date TEXT,
    report_source TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Variants of Unknown Significance
CREATE TABLE IF NOT EXISTS vus_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene TEXT NOT NULL,
    alteration TEXT NOT NULL,
    transcript_id TEXT,
    coding_effect TEXT,
    variant_allele_frequency REAL,
    report_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Treatment-mutation correlations (track which treatments work for which mutations)
CREATE TABLE IF NOT EXISTS treatment_genomic_correlation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER,
    mutation_id INTEGER,
    pathway_id INTEGER,
    correlation_type TEXT, -- targeted, supportive, synergistic
    mechanism_description TEXT,
    started_date TEXT,
    notes TEXT,
    FOREIGN KEY (medication_id) REFERENCES medications(id),
    FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id),
    FOREIGN KEY (pathway_id) REFERENCES pathways(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mutations_gene ON genomic_mutations(gene);
CREATE INDEX IF NOT EXISTS idx_mutations_report_date ON genomic_mutations(report_date);
CREATE INDEX IF NOT EXISTS idx_pathways_name ON pathways(name);
CREATE INDEX IF NOT EXISTS idx_mutation_treatments_therapy ON mutation_treatments(therapy_name);
CREATE INDEX IF NOT EXISTS idx_genomic_trials_status ON genomic_trials(status);
CREATE INDEX IF NOT EXISTS idx_biomarkers_name ON biomarkers(biomarker_name);
