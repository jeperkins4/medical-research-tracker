-- PostgreSQL RPC Functions for Analytics Aggregation
-- HIPAA-Compliant: Enforces minimum cell size of 11

-- Function: Get diagnosis aggregates (min cell size)
CREATE OR REPLACE FUNCTION get_diagnosis_aggregates(min_count INTEGER DEFAULT 11)
RETURNS TABLE (
  diagnosis_type TEXT,
  cancer_type TEXT,
  stage TEXT,
  patient_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name::TEXT as diagnosis_type,
    c.name::TEXT as cancer_type,
    c.status::TEXT as stage,
    COUNT(DISTINCT c.user_id)::BIGINT as patient_count
  FROM conditions c
  WHERE c.name IS NOT NULL
  GROUP BY c.name, c.status
  HAVING COUNT(DISTINCT c.user_id) >= min_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get mutation aggregates (min cell size)
CREATE OR REPLACE FUNCTION get_mutation_aggregates(min_count INTEGER DEFAULT 11)
RETURNS TABLE (
  gene_name TEXT,
  mutation_type TEXT,
  patient_count BIGINT
) AS $$
BEGIN
  -- Check if mutations table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mutations') THEN
    RETURN QUERY
    SELECT 
      m.gene::TEXT as gene_name,
      m.alteration::TEXT as mutation_type,
      COUNT(DISTINCT m.user_id)::BIGINT as patient_count
    FROM mutations m
    WHERE m.gene IS NOT NULL
    GROUP BY m.gene, m.alteration
    HAVING COUNT(DISTINCT m.user_id) >= min_count;
  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get treatment aggregates (min cell size)
CREATE OR REPLACE FUNCTION get_treatment_aggregates(min_count INTEGER DEFAULT 11)
RETURNS TABLE (
  treatment_name TEXT,
  treatment_type TEXT,
  patient_count BIGINT
) AS $$
BEGIN
  -- Try medications_enhanced first, then fall back to medications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medications_enhanced') THEN
    RETURN QUERY
    SELECT 
      m.name::TEXT as treatment_name,
      m.type::TEXT as treatment_type,
      COUNT(DISTINCT m.user_id)::BIGINT as patient_count
    FROM medications_enhanced m
    WHERE m.name IS NOT NULL
    GROUP BY m.name, m.type
    HAVING COUNT(DISTINCT m.user_id) >= min_count;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medications') THEN
    RETURN QUERY
    SELECT 
      m.name::TEXT as treatment_name,
      m.type::TEXT as treatment_type,
      COUNT(DISTINCT m.user_id)::BIGINT as patient_count
    FROM medications m
    WHERE m.name IS NOT NULL
    GROUP BY m.name, m.type
    HAVING COUNT(DISTINCT m.user_id) >= min_count;
  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get demographics aggregates (min cell size)
-- Returns age ranges, gender, state-level location
CREATE OR REPLACE FUNCTION get_demographics_aggregates(min_count INTEGER DEFAULT 11)
RETURNS TABLE (
  demographic_type TEXT,
  demographic_value TEXT,
  patient_count BIGINT
) AS $$
BEGIN
  -- Check if patient_info table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_info') THEN
    RETURN;
  END IF;

  -- Age ranges (HIPAA-compliant bins)
  RETURN QUERY
  SELECT 
    'age_range'::TEXT as demographic_type,
    CASE
      WHEN age < 18 THEN 'Under 18'
      WHEN age BETWEEN 18 AND 25 THEN '18-25'
      WHEN age BETWEEN 26 AND 35 THEN '26-35'
      WHEN age BETWEEN 36 AND 45 THEN '36-45'
      WHEN age BETWEEN 46 AND 55 THEN '46-55'
      WHEN age BETWEEN 56 AND 65 THEN '56-65'
      WHEN age BETWEEN 66 AND 75 THEN '66-75'
      WHEN age > 75 THEN 'Over 75'
    END::TEXT as demographic_value,
    COUNT(*)::BIGINT as patient_count
  FROM patient_info
  WHERE age IS NOT NULL
  GROUP BY demographic_value
  HAVING COUNT(*) >= min_count;

  -- Gender
  RETURN QUERY
  SELECT 
    'gender'::TEXT as demographic_type,
    gender::TEXT as demographic_value,
    COUNT(*)::BIGINT as patient_count
  FROM patient_info
  WHERE gender IS NOT NULL
  GROUP BY gender
  HAVING COUNT(*) >= min_count;

  -- State-level location (HIPAA: NO city/zip)
  RETURN QUERY
  SELECT 
    'state'::TEXT as demographic_type,
    state::TEXT as demographic_value,
    COUNT(*)::BIGINT as patient_count
  FROM patient_info
  WHERE state IS NOT NULL
  GROUP BY state
  HAVING COUNT(*) >= min_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service_role
GRANT EXECUTE ON FUNCTION get_diagnosis_aggregates(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_mutation_aggregates(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_treatment_aggregates(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_demographics_aggregates(INTEGER) TO service_role;

-- Comments
COMMENT ON FUNCTION get_diagnosis_aggregates IS 'HIPAA-compliant: Returns diagnosis counts with minimum cell size enforcement';
COMMENT ON FUNCTION get_mutation_aggregates IS 'HIPAA-compliant: Returns mutation counts with minimum cell size enforcement';
COMMENT ON FUNCTION get_treatment_aggregates IS 'HIPAA-compliant: Returns treatment counts with minimum cell size enforcement';
COMMENT ON FUNCTION get_demographics_aggregates IS 'HIPAA-compliant: Returns demographics with age ranges and state-level only';
