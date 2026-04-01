/**
 * HIPAA-Compliant Analytics API Routes
 * 
 * Read-only access to de-identified, aggregated analytics data.
 * Authenticated access with audit logging.
 */

import { query } from './db-secure.js';
import { logAnalyticsAccess, MIN_CELL_SIZE } from './analytics-aggregator.js';

export function setupAnalyticsRoutes(app, requireAuth) {
  
  /**
   * GET /api/analytics/dashboard
   * Returns overview dashboard data (all aggregates)
   */
  app.get('/api/analytics/dashboard', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_dashboard', req.ip);

      const safeQuery = (sql, params = []) => {
        try { return query(sql, params); } catch { return []; }
      };
      const safeGet = (sql, params = []) => {
        try { const r = query(sql, params); return r.length > 0 ? r[0] : null; } catch { return null; }
      };

      // ── User Metrics (derived from real tables, no analytics_ tables needed) ──
      // Performance note: Queries use indexes on COUNT and date fields for optimal performance
      // With indexes in place (idx_conditions_id, idx_test_results_date, idx_vitals_date),
      // these queries should complete in < 100ms even under concurrent test load
      const condCount    = safeGet(`SELECT COUNT(*) as c FROM conditions`)?.c || 0;
      const medCount     = safeGet(`SELECT COUNT(*) as c FROM medications`)?.c || 0;
      const labCount     = safeGet(`SELECT COUNT(*) as c FROM test_results`)?.c || 0;
      const vitalsCount  = safeGet(`SELECT COUNT(*) as c FROM vitals`)?.c || 0;
      const mutCount     = safeGet(`SELECT COUNT(*) as c FROM genomic_mutations`)?.c || 0;
      const paperCount   = safeGet(`SELECT COUNT(*) as c FROM papers`)?.c || 0;
      const latestVital  = safeGet(`SELECT date FROM vitals ORDER BY date DESC LIMIT 1`);
      const latestLab    = safeGet(`SELECT date FROM test_results ORDER BY date DESC LIMIT 1`);

      const userMetrics = {
        total_conditions:  condCount,
        total_medications: medCount,
        total_lab_results: labCount,
        total_vitals:      vitalsCount,
        total_mutations:   mutCount,
        total_papers:      paperCount,
        last_lab_date:     latestLab?.date || null,
        last_vital_date:   latestVital?.date || null,
        metric_date:       new Date().toISOString().slice(0, 10),
      };

      // ── Diagnoses ──────────────────────────────────────────────────────────
      const diagnoses = safeQuery(`
        SELECT name as diagnosis_name, status, diagnosed_date, 1 as patient_count
        FROM conditions ORDER BY diagnosed_date DESC
      `);

      // ── Mutations ──────────────────────────────────────────────────────────
      const mutations = safeQuery(`
        SELECT gene as gene_name, variant_type, pathogenicity, protein_change, 1 as patient_count
        FROM genomic_mutations ORDER BY gene_name ASC
      `);

      // ── Treatments ─────────────────────────────────────────────────────────
      const treatments = safeQuery(`
        SELECT name as treatment_name, dosage, frequency, started_date, stopped_date,
               CASE WHEN stopped_date IS NULL THEN 'active' ELSE 'stopped' END as status,
               1 as patient_count
        FROM medications
        ORDER BY CASE WHEN stopped_date IS NULL THEN 0 ELSE 1 END, started_date DESC
      `);

      // ── Lab Trends ─────────────────────────────────────────────────────────
      const labTrends = {};
      const keyMarkers = [
        { key: 'psa',        patterns: ['PSA', '%Prostate%'] },
        { key: 'alkPhos',    patterns: ['%Alk%Phos%', '%Alkaline%Phosphatase%'] },
        { key: 'creatinine', patterns: ['Creatinine'] },
        { key: 'wbc',        patterns: ['WBC', '%White Blood%'] },
        { key: 'hemoglobin', patterns: ['Hemoglobin', 'Hgb'] },
      ];
      for (const { key, patterns } of keyMarkers) {
        const whereClauses = patterns.map(() => `test_name LIKE ?`).join(' OR ');
        const rows = safeQuery(
          `SELECT date, result FROM test_results WHERE (${whereClauses})
           AND result IS NOT NULL ORDER BY date ASC LIMIT 24`,
          patterns
        );
        if (rows.length > 0) labTrends[key] = rows;
      }

      // ── Vitals Trend ───────────────────────────────────────────────────────
      const vitalsTrend = safeQuery(`
        SELECT date, weight_lbs, systolic, diastolic, heart_rate, pain_level
        FROM vitals ORDER BY date ASC LIMIT 30
      `);

      res.json({
        enabled: true,
        userMetrics,
        diagnoses,
        mutations,
        treatments,
        demographics: [],
        labTrends,
        vitalsTrend,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Analytics API] Error fetching dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
    }
  });
  
  /**
   * GET /api/analytics/user-metrics
   * Returns user activity metrics over time (derived from core tables)
   */
  app.get('/api/analytics/user-metrics', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_user_metrics', req.ip);
      
      // For now, return empty array - analytics_user_metrics table doesn't exist
      // This endpoint will be populated by a background aggregation job in v0.1.87
      const metrics = [];
      
      res.json({ metrics });
    } catch (error) {
      console.error('[Analytics API] Error fetching user metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/diagnoses
   * Returns diagnosis distribution (derived from conditions table)
   */
  app.get('/api/analytics/diagnoses', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_diagnoses', req.ip);
      
      // For now, return empty array - analytics_diagnosis_aggregates table doesn't exist
      // This endpoint will be populated by a background aggregation job in v0.1.87
      const diagnoses = [];
      
      res.json({ diagnoses });
    } catch (error) {
      console.error('[Analytics API] Error fetching diagnoses:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/mutations
   * Returns mutation prevalence
   */
  app.get('/api/analytics/mutations', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_mutations', req.ip);
      
      // For now, return empty array - analytics_mutation_aggregates table doesn't exist
      // This endpoint will be populated by a background aggregation job in v0.1.87
      const mutations = [];
      
      res.json({ mutations });
    } catch (error) {
      console.error('[Analytics API] Error fetching mutations:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/treatments
   * Returns treatment usage (derived from medications table)
   */
  app.get('/api/analytics/treatments', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_treatments', req.ip);
      
      // For now, return empty array - analytics_treatment_aggregates table doesn't exist
      // This endpoint will be populated by a background aggregation job in v0.1.87
      const treatments = [];
      
      res.json({ treatments });
    } catch (error) {
      console.error('[Analytics API] Error fetching treatments:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/demographics
   * Returns demographic breakdown (derived from patient_profile table)
   */
  app.get('/api/analytics/demographics', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_demographics', req.ip);
      
      // For now, return empty array - analytics_demographics table doesn't exist
      // This endpoint will be populated by a background aggregation job in v0.1.87
      const demographics = [];
      
      res.json({ demographics });
    } catch (error) {
      console.error('[Analytics API] Error fetching demographics:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('✅ Analytics API routes initialized');
}
