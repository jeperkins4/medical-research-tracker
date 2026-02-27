import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts';
import './AnalyticsDashboard.css';

export default function AnalyticsDashboard({ apiFetch }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      let analyticsData;
      if (typeof window !== 'undefined' && window.electron?.analytics?.getDashboard) {
        analyticsData = await window.electron.analytics.getDashboard();
      } else {
        const res = await apiFetch('/api/analytics/dashboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        analyticsData = await res.json();
      }
      if (analyticsData.enabled === false) {
        setError(analyticsData.message || 'Analytics not available');
      } else if (analyticsData.error) {
        setError(analyticsData.error);
      } else {
        setData(analyticsData);
      }
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="analytics-dashboard"><div className="loading">Loading analytics…</div></div>;

  if (error) return (
    <div className="analytics-dashboard">
      <div className="error">
        <h3>Error Loading Analytics</h3>
        <p>{error}</p>
        <button className="retry-btn" onClick={fetchAnalytics}>Retry</button>
        <details><summary>▸ Troubleshooting</summary>
          <ul>
            <li>Make sure the app is running (not loading localhost:5173)</li>
            <li>Check browser console for detailed errors (F12)</li>
          </ul>
        </details>
      </div>
    </div>
  );

  if (!data) return <div className="analytics-dashboard"><div className="empty">No analytics data available</div></div>;

  const m = data.userMetrics || {};

  return (
    <div className="analytics-dashboard">

      {/* Summary Metrics */}
      <section className="metrics-section">
        <h2>📊 Health Record Summary</h2>
        <div className="metrics-grid">
          {[
            { label: 'Conditions', value: m.total_conditions ?? 0, icon: '🩺' },
            { label: 'Medications', value: m.total_medications ?? 0, icon: '💊' },
            { label: 'Lab Results', value: m.total_lab_results ?? 0, icon: '🧪' },
            { label: 'Vitals Entries', value: m.total_vitals ?? 0, icon: '❤️' },
            { label: 'Mutations', value: m.total_mutations ?? 0, icon: '🧬' },
            { label: 'Research Papers', value: m.total_papers ?? 0, icon: '📄' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="metric-card">
              <div className="metric-icon">{icon}</div>
              <div className="metric-value">{value}</div>
              <div className="metric-label">{label}</div>
            </div>
          ))}
        </div>
        {(m.last_lab_date || m.last_vital_date) && (
          <div className="last-updated-row">
            {m.last_lab_date && <span>🧪 Last lab: <strong>{m.last_lab_date}</strong></span>}
            {m.last_vital_date && <span>❤️ Last vital: <strong>{m.last_vital_date}</strong></span>}
          </div>
        )}
      </section>

      {/* Lab Trends */}
      {data.labTrends && Object.keys(data.labTrends).length > 0 && (
        <section className="data-section">
          <h2>🧪 Lab Trends</h2>
          {Object.entries(data.labTrends).map(([key, rows]) => {
            const chartData = rows.map(r => ({
              date: r.date?.slice(0, 10),
              value: parseFloat(r.result) || null,
            })).filter(r => r.value !== null);
            if (chartData.length < 2) return null;
            const labels = {
              psa: 'PSA', alkPhos: 'Alk Phos', creatinine: 'Creatinine',
              wbc: 'WBC', hemoglobin: 'Hemoglobin'
            };
            return (
              <div key={key} className="trend-chart">
                <h3>{labels[key] || key}</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#2196f3" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </section>
      )}

      {/* Vitals Trends */}
      {data.vitalsTrend?.length > 1 && (
        <section className="data-section">
          <h2>❤️ Vitals Trends</h2>
          {data.vitalsTrend.some(v => v.weight_lbs) && (
            <div className="trend-chart">
              <h3>Weight (lbs)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.vitalsTrend.filter(v => v.weight_lbs)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight_lbs" name="Weight" stroke="#4caf50" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.vitalsTrend.some(v => v.pain_level != null) && (
            <div className="trend-chart">
              <h3>Pain Level (0–10)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.vitalsTrend.filter(v => v.pain_level != null)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pain_level" name="Pain" stroke="#f44336" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.vitalsTrend.some(v => v.systolic) && (
            <div className="trend-chart">
              <h3>Blood Pressure</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.vitalsTrend.filter(v => v.systolic)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#e53935" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#1e88e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      {/* Conditions */}
      {data.diagnoses?.length > 0 && (
        <section className="data-section">
          <h2>🩺 Conditions</h2>
          <div className="data-table">
            <table>
              <thead><tr><th>Condition</th><th>Status</th><th>Diagnosed</th></tr></thead>
              <tbody>
                {data.diagnoses.map((d, i) => (
                  <tr key={i}>
                    <td>{d.diagnosis_name}</td>
                    <td><span className={`status-pill status-${d.status?.toLowerCase()}`}>{d.status || '—'}</span></td>
                    <td>{d.diagnosed_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Mutations */}
      {data.mutations?.length > 0 && (
        <section className="data-section">
          <h2>🧬 Genomic Mutations</h2>
          <div className="data-table">
            <table>
              <thead><tr><th>Gene</th><th>Variant Type</th><th>Pathogenicity</th><th>Protein Change</th></tr></thead>
              <tbody>
                {data.mutations.map((m, i) => (
                  <tr key={i}>
                    <td className="gene-name">{m.gene_name}</td>
                    <td>{m.variant_type || '—'}</td>
                    <td><span className={`path-pill path-${(m.pathogenicity || '').toLowerCase().replace(/\s+/g, '-')}`}>{m.pathogenicity || '—'}</span></td>
                    <td className="mono">{m.protein_change || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Medications */}
      {data.treatments?.length > 0 && (
        <section className="data-section">
          <h2>💊 Medications & Treatments</h2>
          <div className="data-table">
            <table>
              <thead><tr><th>Name</th><th>Dosage</th><th>Frequency</th><th>Status</th><th>Started</th></tr></thead>
              <tbody>
                {data.treatments.map((t, i) => (
                  <tr key={i}>
                    <td>{t.treatment_name}</td>
                    <td>{t.dosage || '—'}</td>
                    <td>{t.frequency || '—'}</td>
                    <td><span className={`status-pill status-${t.status}`}>{t.status}</span></td>
                    <td>{t.started_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="analytics-footer">
        Last updated: {data.lastUpdated?.slice(0, 16).replace('T', ' ')} UTC
      </div>
    </div>
  );
}
