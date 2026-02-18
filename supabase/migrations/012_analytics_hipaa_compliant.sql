-- HIPAA-Compliant Analytics Tables for Supabase (PostgreSQL)
-- These tables store ONLY de-identified, aggregated data
-- NO PHI (Protected Health Information) is stored here

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Analytics snapshot table (daily aggregates)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_category TEXT NOT NULL, -- 'users', 'diagnoses', 'mutations', 'treatments', 'demographics'
  metric_value TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, metric_name, metric_value)
);

-- User registration metrics (counts only, no PHI)
CREATE TABLE IF NOT EXISTS analytics_user_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  new_users_today INTEGER DEFAULT 0,
  active_users_30d INTEGER DEFAULT 0, -- Users who logged in within 30 days
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- Diagnosis aggregates (no patient identifiers)
CREATE TABLE IF NOT EXISTS analytics_diagnosis_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnosis_type TEXT NOT NULL,
  cancer_type TEXT, -- 'bladder', 'lung', 'breast', etc.
  stage TEXT, -- 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagnosis_type, cancer_type, stage)
);

-- Mutation aggregates (no patient identifiers)
CREATE TABLE IF NOT EXISTS analytics_mutation_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gene_name TEXT NOT NULL, -- 'ARID1A', 'PIK3CA', 'FGFR3', etc.
  mutation_type TEXT, -- 'Loss of Function', 'Gain of Function', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gene_name, mutation_type)
);

-- Treatment aggregates (no patient identifiers)
CREATE TABLE IF NOT EXISTS analytics_treatment_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_name TEXT NOT NULL,
  treatment_type TEXT, -- 'Drug', 'Supplement', 'Therapy', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(treatment_name, treatment_type)
);

-- Demographics (HIPAA-compliant ranges only)
CREATE TABLE IF NOT EXISTS analytics_demographics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demographic_type TEXT NOT NULL, -- 'age_range', 'gender', 'state'
  demographic_value TEXT NOT NULL, -- '18-25', 'Male', 'FL', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(demographic_type, demographic_value)
);

-- Audit log for analytics access
CREATE TABLE IF NOT EXISTS analytics_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'view_dashboard', 'export_data', 'generate_report'
  ip_address TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_category ON analytics_snapshots(metric_category);
CREATE INDEX IF NOT EXISTS idx_user_metrics_date ON analytics_user_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_diagnosis_cancer_type ON analytics_diagnosis_aggregates(cancer_type);
CREATE INDEX IF NOT EXISTS idx_mutation_gene ON analytics_mutation_aggregates(gene_name);
CREATE INDEX IF NOT EXISTS idx_demographics_type ON analytics_demographics(demographic_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON analytics_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_accessed ON analytics_audit_log(accessed_at);

-- Triggers to auto-update last_updated timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_diagnosis_aggregates_timestamp
  BEFORE UPDATE ON analytics_diagnosis_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mutation_aggregates_timestamp
  BEFORE UPDATE ON analytics_mutation_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatment_aggregates_timestamp
  BEFORE UPDATE ON analytics_treatment_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demographics_timestamp
  BEFORE UPDATE ON analytics_demographics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- IMPORTANT: Analytics tables are de-identified, so we can be more permissive
-- But still require authentication

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_diagnosis_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_mutation_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_treatment_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_audit_log ENABLE ROW LEVEL SECURITY;

-- Read access: Any authenticated user can view de-identified analytics
CREATE POLICY "Anyone authenticated can view analytics snapshots"
  ON analytics_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can view user metrics"
  ON analytics_user_metrics FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can view diagnosis aggregates"
  ON analytics_diagnosis_aggregates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can view mutation aggregates"
  ON analytics_mutation_aggregates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can view treatment aggregates"
  ON analytics_treatment_aggregates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can view demographics"
  ON analytics_demographics FOR SELECT
  USING (auth.role() = 'authenticated');

-- Audit log: Users can only view their own access logs
CREATE POLICY "Users can view their own audit logs"
  ON analytics_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Admin write access: Only service role can write analytics data
-- (This is done by the aggregation function, not end users)
CREATE POLICY "Service role can insert/update analytics"
  ON analytics_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage user metrics"
  ON analytics_user_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage diagnosis aggregates"
  ON analytics_diagnosis_aggregates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage mutation aggregates"
  ON analytics_mutation_aggregates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage treatment aggregates"
  ON analytics_treatment_aggregates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage demographics"
  ON analytics_demographics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can log analytics access"
  ON analytics_audit_log FOR INSERT
  USING (auth.role() = 'service_role');

-- Comments explaining HIPAA compliance
COMMENT ON TABLE analytics_snapshots IS 'HIPAA-compliant: De-identified aggregate snapshots only';
COMMENT ON TABLE analytics_user_metrics IS 'HIPAA-compliant: User counts only, no identifiers';
COMMENT ON TABLE analytics_diagnosis_aggregates IS 'HIPAA-compliant: Diagnosis counts, min cell size 11';
COMMENT ON TABLE analytics_mutation_aggregates IS 'HIPAA-compliant: Mutation counts, min cell size 11';
COMMENT ON TABLE analytics_treatment_aggregates IS 'HIPAA-compliant: Treatment counts, min cell size 11';
COMMENT ON TABLE analytics_demographics IS 'HIPAA-compliant: Age ranges, state-level only, min cell size 11';
COMMENT ON TABLE analytics_audit_log IS 'Audit trail for analytics access (HIPAA requirement)';

-- Grant permissions
GRANT SELECT ON analytics_snapshots TO authenticated;
GRANT SELECT ON analytics_user_metrics TO authenticated;
GRANT SELECT ON analytics_diagnosis_aggregates TO authenticated;
GRANT SELECT ON analytics_mutation_aggregates TO authenticated;
GRANT SELECT ON analytics_treatment_aggregates TO authenticated;
GRANT SELECT ON analytics_demographics TO authenticated;
GRANT SELECT ON analytics_audit_log TO authenticated;

GRANT ALL ON analytics_snapshots TO service_role;
GRANT ALL ON analytics_user_metrics TO service_role;
GRANT ALL ON analytics_diagnosis_aggregates TO service_role;
GRANT ALL ON analytics_mutation_aggregates TO service_role;
GRANT ALL ON analytics_treatment_aggregates TO service_role;
GRANT ALL ON analytics_demographics TO service_role;
GRANT ALL ON analytics_audit_log TO service_role;
