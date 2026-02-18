import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './AnalyticsDashboard.css';

export default function AnalyticsDashboardSupabase() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all analytics tables in parallel
      const [
        { data: userMetrics, error: userError },
        { data: diagnoses, error: diagnosesError },
        { data: mutations, error: mutationsError },
        { data: treatments, error: treatmentsError },
        { data: demographics, error: demographicsError }
      ] = await Promise.all([
        supabase
          .from('analytics_user_metrics')
          .select('*')
          .order('metric_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('analytics_diagnosis_aggregates')
          .select('*')
          .order('patient_count', { ascending: false }),
        supabase
          .from('analytics_mutation_aggregates')
          .select('*')
          .order('patient_count', { ascending: false }),
        supabase
          .from('analytics_treatment_aggregates')
          .select('*')
          .order('patient_count', { ascending: false }),
        supabase
          .from('analytics_demographics')
          .select('*')
          .order('demographic_type, patient_count', { ascending: false })
      ]);

      // Check for errors
      if (userError) throw userError;
      if (diagnosesError) throw diagnosesError;
      if (mutationsError) throw mutationsError;
      if (treatmentsError) throw treatmentsError;
      if (demographicsError) throw demographicsError;

      setData({
        userMetrics: userMetrics || {},
        diagnoses: diagnoses || [],
        mutations: mutations || [],
        treatments: treatments || [],
        demographics: demographics || [],
        hipaaCompliant: true,
        minCellSize: 11,
        note: 'All data is de-identified and aggregated per HIPAA Safe Harbor rules'
      });

      setLoading(false);
    } catch (err) {
      console.error('Analytics error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGenerateAnalytics = async () => {
    try {
      setLoading(true);

      // Call Edge Function to generate analytics
      const { data, error } = await supabase.functions.invoke('analytics-aggregator', {
        body: { action: 'generate' }
      });

      if (error) throw error;

      console.log('Analytics generated:', data);

      // Refresh analytics
      await fetchAnalytics();
    } catch (err) {
      console.error('Generate analytics error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-dashboard">
        <div className="error">
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalytics}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="analytics-dashboard">
        <div className="empty">No analytics data available</div>
      </div>
    );
  }

  // Group demographics by type
  const demographicsByType = {};
  (data.demographics || []).forEach(demo => {
    if (!demographicsByType[demo.demographic_type]) {
      demographicsByType[demo.demographic_type] = [];
    }
    demographicsByType[demo.demographic_type].push(demo);
  });

  return (
    <div className="analytics-dashboard">
      {/* HIPAA Compliance Notice */}
      <div className="hipaa-notice">
        <div className="hipaa-icon">🔒</div>
        <div className="hipaa-text">
          <strong>HIPAA-Compliant Analytics</strong>
          <p>All data is de-identified and aggregated. No individual patient information is exposed.</p>
          <p className="small">Minimum cell size: {data.minCellSize} patients (groups smaller than this are suppressed)</p>
        </div>
      </div>

      {/* User Metrics */}
      <section className="metrics-section">
        <h2>👥 User Statistics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">{data.userMetrics?.total_users || 0}</div>
            <div className="metric-label">Total Users</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{data.userMetrics?.new_users_today || 0}</div>
            <div className="metric-label">New Today</div>
          </div>
          {data.userMetrics?.active_users_30d !== null && data.userMetrics?.active_users_30d !== undefined && (
            <div className="metric-card">
              <div className="metric-value">{data.userMetrics.active_users_30d}</div>
              <div className="metric-label">Active (30 days)</div>
            </div>
          )}
        </div>
      </section>

      {/* Diagnoses */}
      {data.diagnoses && data.diagnoses.length > 0 && (
        <section className="data-section">
          <h2>🩺 Diagnoses</h2>
          <p className="section-note">Aggregated counts by cancer type and stage</p>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Cancer Type</th>
                  <th>Stage</th>
                  <th>Patient Count</th>
                </tr>
              </thead>
              <tbody>
                {data.diagnoses.map((diag, idx) => (
                  <tr key={idx}>
                    <td>{diag.cancer_type || 'N/A'}</td>
                    <td>{diag.stage || 'N/A'}</td>
                    <td className="count">{diag.patient_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Mutations */}
      {data.mutations && data.mutations.length > 0 && (
        <section className="data-section">
          <h2>🧬 Genomic Mutations</h2>
          <p className="section-note">Aggregated counts by gene and mutation type</p>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Gene</th>
                  <th>Mutation Type</th>
                  <th>Patient Count</th>
                </tr>
              </thead>
              <tbody>
                {data.mutations.map((mut, idx) => (
                  <tr key={idx}>
                    <td className="gene-name">{mut.gene_name}</td>
                    <td>{mut.mutation_type || 'N/A'}</td>
                    <td className="count">{mut.patient_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Treatments */}
      {data.treatments && data.treatments.length > 0 && (
        <section className="data-section">
          <h2>💊 Treatments</h2>
          <p className="section-note">Aggregated counts by treatment name and type</p>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Treatment</th>
                  <th>Type</th>
                  <th>Patient Count</th>
                </tr>
              </thead>
              <tbody>
                {data.treatments.map((treat, idx) => (
                  <tr key={idx}>
                    <td>{treat.treatment_name}</td>
                    <td>
                      <span className={`type-badge ${treat.treatment_type?.toLowerCase()}`}>
                        {treat.treatment_type || 'N/A'}
                      </span>
                    </td>
                    <td className="count">{treat.patient_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Demographics */}
      {data.demographics && data.demographics.length > 0 && (
        <section className="data-section">
          <h2>📊 Demographics</h2>
          <p className="section-note">HIPAA-compliant ranges (age ranges, state-level only)</p>
          
          {/* Age Ranges */}
          {demographicsByType.age_range && (
            <div className="demographic-group">
              <h3>Age Ranges</h3>
              <div className="bar-chart">
                {demographicsByType.age_range.map((demo, idx) => (
                  <div key={idx} className="bar-item">
                    <div className="bar-label">{demo.demographic_value}</div>
                    <div className="bar-container">
                      <div 
                        className="bar-fill" 
                        style={{ 
                          width: `${(demo.patient_count / Math.max(...demographicsByType.age_range.map(d => d.patient_count))) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="bar-count">{demo.patient_count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gender */}
          {demographicsByType.gender && (
            <div className="demographic-group">
              <h3>Gender</h3>
              <div className="bar-chart">
                {demographicsByType.gender.map((demo, idx) => (
                  <div key={idx} className="bar-item">
                    <div className="bar-label">{demo.demographic_value}</div>
                    <div className="bar-container">
                      <div 
                        className="bar-fill" 
                        style={{ 
                          width: `${(demo.patient_count / Math.max(...demographicsByType.gender.map(d => d.patient_count))) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="bar-count">{demo.patient_count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State */}
          {demographicsByType.state && (
            <div className="demographic-group">
              <h3>State (Geographic Distribution)</h3>
              <div className="bar-chart">
                {demographicsByType.state.map((demo, idx) => (
                  <div key={idx} className="bar-item">
                    <div className="bar-label">{demo.demographic_value}</div>
                    <div className="bar-container">
                      <div 
                        className="bar-fill" 
                        style={{ 
                          width: `${(demo.patient_count / Math.max(...demographicsByType.state.map(d => d.patient_count))) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="bar-count">{demo.patient_count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty State */}
      {(!data.diagnoses || data.diagnoses.length === 0) &&
       (!data.mutations || data.mutations.length === 0) &&
       (!data.treatments || data.treatments.length === 0) &&
       (!data.demographics || data.demographics.length === 0) && (
        <div className="empty-analytics">
          <h3>No Analytics Data Yet</h3>
          <p>Analytics are generated when you have at least {data.minCellSize} users in each category.</p>
          <p className="small">This ensures HIPAA compliance by preventing re-identification of individuals.</p>
          <button onClick={handleGenerateAnalytics} className="generate-btn">
            🔄 Generate Analytics Now
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="analytics-footer">
        <button onClick={fetchAnalytics} className="refresh-btn">
          🔄 Refresh Analytics
        </button>
        <button onClick={handleGenerateAnalytics} className="refresh-btn">
          ⚡ Re-generate Analytics
        </button>
        <p className="last-updated">
          Last updated: {data.userMetrics?.metric_date || 'Never'}
        </p>
      </div>
    </div>
  );
}
