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
      // Log access
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_dashboard', req.ip);
      
      // Check if analytics tables exist
      const tableCheck = query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'analytics_%'
      `);
      
      if (tableCheck.length === 0) {
        return res.json({
          enabled: false,
          message: 'Analytics tables not created yet. Run analytics migration first.',
          userMetrics: {},
          diagnoses: [],
          mutations: [],
          treatments: [],
          demographics: {}
        });
      }
      
      // Get user metrics
      const userMetricsRows = query(`
        SELECT * FROM analytics_user_metrics 
        ORDER BY metric_date DESC LIMIT 1
      `);
      const userMetrics = userMetricsRows.length > 0 ? userMetricsRows[0] : {};
      
      // Get diagnosis aggregates
      const diagnoses = query(`
        SELECT * FROM analytics_diagnosis_aggregates 
        WHERE patient_count >= ?
        ORDER BY patient_count DESC
      `, [MIN_CELL_SIZE]);
      
      // Get mutation aggregates
      const mutations = query(`
        SELECT * FROM analytics_mutation_aggregates 
        WHERE patient_count >= ?
        ORDER BY patient_count DESC
      `, [MIN_CELL_SIZE]);
      
      // Get treatment aggregates
      const treatments = query(`
        SELECT * FROM analytics_treatment_aggregates 
        WHERE patient_count >= ?
        ORDER BY patient_count DESC
      `, [MIN_CELL_SIZE]);
      
      // Get demographics
      const demographicsRows = query(`
        SELECT * FROM analytics_demographics 
        ORDER BY snapshot_date DESC LIMIT 1
      `);
      const demographics = demographicsRows.length > 0 ? demographicsRows[0] : {};
      
      res.json({
        enabled: true,
        userMetrics,
        diagnoses,
        mutations,
        treatments,
        demographics,
        lastUpdated: userMetrics.metric_date || new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics API] Error fetching dashboard:', error);
      res.status(500).json({ 
        error: 'Failed to fetch analytics',
        message: error.message 
      });
    }
  });
  
  /**
   * GET /api/analytics/user-metrics
   * Returns user activity metrics over time
   */
  app.get('/api/analytics/user-metrics', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_user_metrics', req.ip);
      
      const metrics = query(`
        SELECT * FROM analytics_user_metrics 
        ORDER BY metric_date DESC
        LIMIT 30
      `);
      
      res.json({ metrics });
    } catch (error) {
      console.error('[Analytics API] Error fetching user metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/diagnoses
   * Returns diagnosis distribution
   */
  app.get('/api/analytics/diagnoses', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_diagnoses', req.ip);
      
      const diagnoses = query(`
        SELECT * FROM analytics_diagnosis_aggregates 
        WHERE patient_count >= ?
        ORDER BY patient_count DESC
      `, [MIN_CELL_SIZE]);
      
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
      
      const mutations = query(`
        SELECT * FROM analytics_mutation_aggregates 
        WHERE patient_count >= ?
        ORDER BY patient_count DESC
      `, [MIN_CELL_SIZE]);
      
      res.json({ mutations });
    } catch (error) {
      console.error('[Analytics API] Error fetching mutations:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/treatments
   * Returns treatment usage
   */
  app.get('/api/analytics/treatments', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_treatments', req.ip);
      
      const treatments = query(`
        SELECT * FROM analytics_treatment_aggregates 
        WHERE patient_count >= ?
        ORDER BY patient_count DESC
      `, [MIN_CELL_SIZE]);
      
      res.json({ treatments });
    } catch (error) {
      console.error('[Analytics API] Error fetching treatments:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/analytics/demographics
   * Returns demographic breakdown
   */
  app.get('/api/analytics/demographics', requireAuth, (req, res) => {
    try {
      logAnalyticsAccess(req.user?.username || 'unknown', 'view_demographics', req.ip);
      
      const demographics = query(`
        SELECT * FROM analytics_demographics 
        ORDER BY snapshot_date DESC
        LIMIT 10
      `);
      
      res.json({ demographics });
    } catch (error) {
      console.error('[Analytics API] Error fetching demographics:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('✅ Analytics API routes initialized');
}
