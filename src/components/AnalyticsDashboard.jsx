import { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

export default function AnalyticsDashboard({ apiFetch }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/analytics/dashboard');
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Analytics API error:', res.status, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status}`);
      }
      
      const analyticsData = await res.json();
      console.log('Analytics data received:', analyticsData);
      
      // Check if analytics is disabled
      if (analyticsData.enabled === false) {
        setError(analyticsData.message || 'Analytics not available');
        setLoading(false);
        return;
      }
      
      setData(analyticsData);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Analytics error:', err);
      setError(err.message || 'Failed to load analytics');
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
          <button onClick={fetchAnalytics} className="retry-button">
            Retry
          </button>
          <details style={{ marginTop: '20px', fontSize: '12px', opacity: 0.7 }}>
            <summary>Troubleshooting</summary>
            <ul style={{ textAlign: 'left', marginTop: '10px' }}>
              <li>Check that the server is running</li>
              <li>Check browser console for detailed errors (F12)</li>
              <li>Verify you're logged in</li>
              <li>Analytics tables may need to be created: run <code>node check-analytics-tables.js</code></li>
            </ul>
          </details>
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
          {data.userMetrics?.active_users_30d !== null && (
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
        </div>
      )}

      {/* Refresh Button */}
      <div className="analytics-footer">
        <button onClick={fetchAnalytics} className="refresh-btn">
          🔄 Refresh Analytics
        </button>
        <p className="last-updated">
          Last updated: {data.userMetrics?.metric_date || 'Never'}
        </p>
      </div>
    </div>
  );
}
