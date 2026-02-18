-- Enhanced Medications & Supplements Schema
-- Adds support for:
-- - Prescription drugs vs supplements distinction
-- - Research article links (supporting evidence or warnings)
-- - Genomic pathway targeting
-- - Evidence strength ratings
-- - Dosing recommendations

-- ============================================================================
-- Enhanced Medications Table
-- ============================================================================

-- Drop existing medications table (backup data first if needed)
-- ALTER TABLE medications RENAME TO medications_backup;

-- Create enhanced medications table
CREATE TABLE IF NOT EXISTS medications_enhanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Basic info
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('prescription', 'supplement', 'otc', 'integrative')),
  category TEXT, -- e.g., 'chemotherapy', 'immunotherapy', 'vitamins', 'herbs'
  
  -- Dosing
  dosage TEXT,
  frequency TEXT,
  route TEXT, -- e.g., 'oral', 'IV', 'topical'
  
  -- Timing
  started_date TEXT,
  stopped_date TEXT,
  active BOOLEAN DEFAULT 1,
  
  -- Clinical context
  reason TEXT, -- Why prescribed/taken
  prescribed_by TEXT, -- Doctor name
  
  -- Evidence-based information
  mechanism TEXT, -- How it works
  target_pathways TEXT, -- JSON array: ['PI3K/AKT/mTOR', 'HIF-1α']
  genomic_alignment TEXT, -- How it relates to patient's mutations
  evidence_strength TEXT, -- 'Strongly Supported', 'Moderately Supported', 'Investigational'
  
  -- Dosing guidance
  recommended_dosing TEXT,
  precautions TEXT,
  interactions TEXT, -- Drug-drug or drug-supplement interactions
  
  -- User notes
  notes TEXT,
  effectiveness_rating INTEGER CHECK(effectiveness_rating BETWEEN 1 AND 10),
  side_effects TEXT,
  
  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Research Articles (linked to medications/supplements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS medication_research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL,
  
  -- Article details
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  publication_year INTEGER,
  abstract TEXT,
  
  -- Links
  url TEXT,
  pubmed_id TEXT,
  doi TEXT,
  
  -- Classification
  article_type TEXT CHECK(article_type IN ('supporting', 'warning', 'mechanism', 'clinical_trial', 'review')),
  evidence_quality TEXT CHECK(evidence_quality IN ('high', 'moderate', 'low')), -- Study quality
  
  -- Summary
  key_findings TEXT, -- Brief summary of main results
  relevance TEXT, -- Why this paper matters for this medication
  
  -- Metadata
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (medication_id) REFERENCES medications_enhanced(id) ON DELETE CASCADE
);

-- ============================================================================
-- Medication Combinations (track what's taken together)
-- ============================================================================

CREATE TABLE IF NOT EXISTS medication_combinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combination_name TEXT, -- e.g., "Morning supplements"
  description TEXT,
  medications TEXT NOT NULL, -- JSON array of medication IDs
  timing TEXT, -- e.g., "Morning with breakfast"
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Medication Log (track actual doses taken)
-- ============================================================================

CREATE TABLE IF NOT EXISTS medication_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL,
  
  -- When taken
  taken_date TEXT NOT NULL,
  taken_time TEXT,
  
  -- What was taken
  dosage_taken TEXT,
  
  -- Notes
  notes TEXT,
  missed BOOLEAN DEFAULT 0,
  
  -- Metadata
  logged_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (medication_id) REFERENCES medications_enhanced(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_medications_type ON medications_enhanced(type);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications_enhanced(active);
CREATE INDEX IF NOT EXISTS idx_medication_research_med_id ON medication_research(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_log_date ON medication_log(taken_date DESC);
CREATE INDEX IF NOT EXISTS idx_medication_log_med_id ON medication_log(medication_id);

-- ============================================================================
-- Migration: Copy old data to new table (if medications table exists)
-- ============================================================================

INSERT INTO medications_enhanced (
  name, 
  type,
  dosage,
  frequency,
  started_date,
  stopped_date,
  reason,
  notes,
  created_at
)
SELECT 
  name,
  CASE 
    WHEN name LIKE '%curcumin%' OR name LIKE '%vitamin%' OR name LIKE '%extract%' THEN 'supplement'
    WHEN name LIKE '%IV%' OR name LIKE '%infusion%' THEN 'prescription'
    ELSE 'supplement'
  END as type,
  dosage,
  frequency,
  started_date,
  stopped_date,
  reason,
  notes,
  created_at
FROM medications
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='medications');

-- ============================================================================
-- Trigger: Update timestamp on modification
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_medications_timestamp 
AFTER UPDATE ON medications_enhanced
BEGIN
  UPDATE medications_enhanced 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;
