-- Genomic Profile Schema for Precision Medicine
-- Foundation One Report Integration

-- Store genetic mutations identified in genomic testing
CREATE TABLE IF NOT EXISTS genomic_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene_name TEXT NOT NULL,
    mutation_type TEXT, -- missense, frameshift, deletion, amplification, etc.
    mutation_details TEXT, -- specific variant info
    allele_frequency REAL, -- variant allele frequency if known
    clinical_significance TEXT, -- pathogenic, likely pathogenic, VUS, etc.
    source_test TEXT, -- 'Foundation One', 'Tempus', etc.
    test_date TEXT,
    is_confirmed BOOLEAN DEFAULT 1, -- 1 = mutation present, 0 = confirmed absent
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Store which biological pathways are affected by mutations
CREATE TABLE IF NOT EXISTS genomic_pathways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pathway_name TEXT NOT NULL, -- 'Hypoxia/HIF1', 'MDR/Drug Resistance', etc.
    pathway_category TEXT, -- 'Cancer Stem Cells', 'Immune Escape', 'Metabolism'
    description TEXT,
    clinical_relevance TEXT, -- why this pathway matters for treatment
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Link mutations to affected pathways
CREATE TABLE IF NOT EXISTS mutation_pathway_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_id INTEGER NOT NULL,
    pathway_id INTEGER NOT NULL,
    impact_level TEXT, -- 'High', 'Medium', 'Low'
    mechanism TEXT, -- how this mutation affects the pathway
    FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id),
    FOREIGN KEY (pathway_id) REFERENCES genomic_pathways(id)
);

-- Store genomic-based treatment recommendations
CREATE TABLE IF NOT EXISTS genomic_treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    treatment_name TEXT NOT NULL,
    treatment_type TEXT, -- 'Supplement', 'Drug', 'Dietary', 'Lifestyle'
    dosage TEXT,
    frequency TEXT,
    target_pathway_id INTEGER, -- which pathway this targets
    target_mutation_id INTEGER, -- which mutation this addresses (if specific)
    mechanism_of_action TEXT,
    supporting_evidence TEXT, -- research/rationale
    purchase_link TEXT,
    priority_level TEXT, -- 'Critical', 'High', 'Medium', 'Optional'
    status TEXT DEFAULT 'Recommended', -- 'Recommended', 'Active', 'Discontinued'
    start_date TEXT,
    notes TEXT,
    FOREIGN KEY (target_pathway_id) REFERENCES genomic_pathways(id),
    FOREIGN KEY (target_mutation_id) REFERENCES genomic_mutations(id)
);

-- Track overlap with current medications
CREATE TABLE IF NOT EXISTS genomic_med_overlap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    genomic_treatment_id INTEGER NOT NULL,
    medication_id INTEGER, -- links to existing medications table
    overlap_type TEXT, -- 'Already Taking', 'Similar Mechanism', 'Contraindicated'
    notes TEXT,
    FOREIGN KEY (genomic_treatment_id) REFERENCES genomic_treatments(id),
    FOREIGN KEY (medication_id) REFERENCES medications(id)
);

-- Biomarker tracking for genomic monitoring
CREATE TABLE IF NOT EXISTS genomic_biomarkers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biomarker_name TEXT NOT NULL,
    related_mutation_id INTEGER,
    related_pathway_id INTEGER,
    baseline_value TEXT,
    target_range TEXT,
    test_method TEXT,
    monitoring_frequency TEXT,
    clinical_significance TEXT,
    FOREIGN KEY (related_mutation_id) REFERENCES genomic_mutations(id),
    FOREIGN KEY (related_pathway_id) REFERENCES genomic_pathways(id)
);

-- Track biomarker measurements over time
CREATE TABLE IF NOT EXISTS biomarker_measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biomarker_id INTEGER NOT NULL,
    measurement_date TEXT NOT NULL,
    value TEXT NOT NULL,
    unit TEXT,
    trend TEXT, -- 'Improving', 'Stable', 'Worsening'
    notes TEXT,
    FOREIGN KEY (biomarker_id) REFERENCES genomic_biomarkers(id)
);

CREATE INDEX IF NOT EXISTS idx_mutations_gene ON genomic_mutations(gene_name);
CREATE INDEX IF NOT EXISTS idx_treatments_pathway ON genomic_treatments(target_pathway_id);
CREATE INDEX IF NOT EXISTS idx_treatments_mutation ON genomic_treatments(target_mutation_id);
CREATE INDEX IF NOT EXISTS idx_biomarker_date ON biomarker_measurements(measurement_date);
