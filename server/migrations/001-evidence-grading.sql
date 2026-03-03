-- Migration 001: Evidence Grading
-- Adds CEBM evidence level, Oxford grade, study design, and actionability fields to papers
-- All columns nullable — safe to run on existing data

-- Evidence level (Oxford CEBM 2011)
-- 1a = systematic review of RCTs
-- 1b = individual RCT (with narrow CI)
-- 2a = systematic review of cohort studies
-- 2b = individual cohort study / low-quality RCT
-- 3  = case-control study
-- 4  = case series / poor cohort
-- 5  = expert opinion / mechanism / preclinical only
ALTER TABLE papers ADD COLUMN evidence_level TEXT 
  CHECK (evidence_level IN ('1a','1b','2a','2b','3','4','5'));

-- Oxford grade (A=strong, B=consistent, C=extrapolated, D=weak/expert)
ALTER TABLE papers ADD COLUMN grade TEXT 
  CHECK (grade IN ('A','B','C','D'));

-- Study design label
ALTER TABLE papers ADD COLUMN study_design TEXT;
  -- 'RCT', 'meta-analysis', 'observational', 'case-report', 'preclinical', 'review', 'other'

-- Sample size (patients in study)
ALTER TABLE papers ADD COLUMN sample_size INTEGER;

-- What outcome does this paper address?
ALTER TABLE papers ADD COLUMN outcome_relevance TEXT;
  -- 'overall_survival', 'progression_free_survival', 'response_rate',
  -- 'quality_of_life', 'biomarker', 'mechanism', 'safety'

-- Is this paper actionable for John right now?
ALTER TABLE papers ADD COLUMN is_actionable INTEGER DEFAULT 0;

-- What action should John take based on this paper?
ALTER TABLE papers ADD COLUMN action_note TEXT;
  -- e.g. "Ask Sonpavde about erdafitinib for FGFR3 — Phase III FORT-2 data"
