/**
 * Lung Health Tracker
 * Monitors CO2, SpO2, WBC — indirect pulmonary markers in bladder cancer patients
 */
import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

const credFetch = (url, opts = {}) => fetch(url, { ...opts, credentials: 'include' });
const STATUS_COLOR = { normal: '#4caf50', warning: '#ff9800', critical: '#f44336' };

function ProtectiveSupplementsCard({ supplements, organ }) {
  if (!supplements?.length) return null;
  const color = { kidney: '#e3f2fd', liver: '#fce4ec', lung: '#e0f7fa', bone: '#f3e5f5' }[organ] || '#f5f5f5';
  const border = { kidney: '#2196f3', liver: '#e91e63', lung: '#00bcd4', bone: '#9c27b0' }[organ] || '#999';
  return (
    <div style={{ marginTop: 20, padding: 20, borderRadius: 12, background: color, boxShadow: '0 1px 6px rgba(0,0,0,.08)', borderLeft: `4px solid ${border}` }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>✅ Supplements Already Protecting Your {organ.charAt(0).toUpperCase() + organ.slice(1)}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {supplements.map((s, i) => (
          <div key={i} style={{ flex: '1 1 260px', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{s.name}</div>
            {(s.brand || s.manufacturer) && (
              <div style={{ fontSize: 11, color: '#0369a1', marginBottom: 4, background: '#f0f9ff', borderRadius: 10, padding: '1px 8px', display: 'inline-block' }}>
                🏷️ {[s.brand, s.manufacturer].filter(Boolean).join(' · ')}
              </div>
            )}
            {s.dosage && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{s.dosage}</div>}
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{s.reason}</div>
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{s.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlagBanner({ flags }) {
  if (!flags?.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      {flags.map((f, i) => (
        <div key={i} style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 8,
          background: f.severity === 'high' ? '#ffebee' : '#fff3e0',
          borderLeft: `4px solid ${f.severity === 'high' ? '#f44336' : '#ff9800'}`,
          fontSize: 14
        }}>⚠️ {f.label}</div>
      ))}
    </div>
  );
}

export default function LungHealthTracker({ apiFetch: propFetch }) {
  const apiFetch = propFetch || credFetch;
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (window.electron?.organHealth?.getLung) {
        setData(await window.electron.organHealth.getLung());
      } else {
        const res = await apiFetch('/api/lung-health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Loading lung health data…</div>;
  if (error)   return <div style={{ padding: 32, color: '#f44336' }}>Error: {error}</div>;
  if (!data)   return null;

  // All-clear view
  if (data.allNormal) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 4 }}>🫁 Lung Health</h2>
        <div style={{
          marginTop: 24, padding: 28, borderRadius: 12, background: '#e8f5e9',
          boxShadow: '0 1px 6px rgba(0,0,0,.08)', borderLeft: '5px solid #4caf50'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#2e7d32' }}>No Pulmonary Markers of Concern</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#444' }}>
            CO2 within range. No lung metastases or pulmonary conditions on record.<br/>
            No current clinical indicators for elevated pulmonary monitoring.
          </p>
        </div>
        {data.protectiveSupplements?.length > 0 && (
          <ProtectiveSupplementsCard supplements={data.protectiveSupplements} organ="lung" />
        )}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: '#fff3e0', fontSize: 13, color: '#555' }}>
          <strong>Ongoing vigilance:</strong> Bladder cancer can metastasize to lungs. Report any new shortness of breath,
          hemoptysis, or persistent cough to Dr. Do. Annual CT chest recommended at your stage.
        </div>
      </div>
    );
  }

  const co2Status  = data.latestCO2 === null ? 'normal'
    : (data.latestCO2 < 22 || data.latestCO2 > 29) ? 'warning' : 'normal';

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 4 }}>🫁 Lung Health</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>
        CO2 · SpO2 · WBC — Pulmonary & respiratory monitoring during bladder cancer treatment
      </p>

      <FlagBanner flags={data.flags} />

      {/* No-data notice */}
      {data.noDirectMarkers && (
        <div style={{
          background: '#e8f5e9', borderRadius: 12, padding: 20,
          boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24,
          borderLeft: '4px solid #4caf50'
        }}>
          <strong>✅ No abnormal pulmonary lab markers detected</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#444' }}>
            {data.note}
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          {
            label: 'CO2 (Bicarb)',
            value: data.latestCO2 !== null ? `${data.latestCO2} mEq/L` : 'Not on record',
            normal: data.normalRanges.co2,
            status: co2Status,
            note: 'Respiratory compensation / acid-base balance'
          },
          {
            label: 'SpO2',
            value: data.latestSpO2 !== null ? `${data.latestSpO2}%` : 'Not on record',
            normal: data.normalRanges.spo2,
            status: data.latestSpO2 !== null && data.latestSpO2 < 95 ? 'critical' : 'normal',
            note: 'Oxygen saturation — add pulse oximeter reading if available'
          },
          {
            label: 'WBC',
            value: data.series.wbc.at(-1)?.value !== undefined ? `${data.series.wbc.at(-1).value} K/μL` : 'Not on record',
            normal: data.normalRanges.wbc,
            status: 'normal',
            note: 'Infection / inflammation surrogate'
          }
        ].map(card => (
          <div key={card.label} style={{
            flex: '1 1 200px', padding: 20, borderRadius: 12,
            background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.08)',
            borderLeft: `4px solid ${STATUS_COLOR[card.status]}`
          }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 3px', color: STATUS_COLOR[card.status] }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#888' }}>Normal: {card.normal}</div>
            {card.note && <div style={{ marginTop: 6, fontSize: 12, color: '#555', fontStyle: 'italic' }}>{card.note}</div>}
          </div>
        ))}
      </div>

      {/* CO2 trend chart */}
      {data.series.co2.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>CO₂ / Bicarbonate Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.series.co2}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'mEq/L', angle: -90, position: 'insideLeft', fontSize: 11 }} domain={[15, 35]} />
              <Tooltip />
              <ReferenceLine y={22} stroke="#ff9800" strokeDasharray="4 4" label={{ value: 'Lower limit (22)', fill: '#ff9800', fontSize: 11 }} />
              <ReferenceLine y={29} stroke="#ff9800" strokeDasharray="4 4" label={{ value: 'Upper limit (29)', fill: '#ff9800', fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#00bcd4" strokeWidth={2} dot={false} name="CO2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* WBC trend */}
      {data.series.wbc.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>WBC Trend (Inflammation / Immune Status)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.series.wbc}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'K/μL', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={4.5} stroke="#ff9800" strokeDasharray="4 4" label={{ value: 'Low (4.5)', fill: '#ff9800', fontSize: 11 }} />
              <ReferenceLine y={11} stroke="#f44336" strokeDasharray="4 4" label={{ value: 'High (11)', fill: '#f44336', fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#009688" strokeWidth={2} dot={false} name="WBC" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monitoring recommendations */}
      <div style={{ background: '#e0f7fa', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>📋 Pulmonary Monitoring for Bladder Cancer</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: '#333' }}>
          <li><strong>Lung mets screening:</strong> Bladder cancer can metastasize to lungs. Annual CT chest recommended if high-risk (T3+, lymph node positive, or metastatic stage).</li>
          <li><strong>Symptoms to report immediately:</strong> New shortness of breath, hemoptysis (coughing blood), persistent dry cough, unexplained weight loss.</li>
          <li><strong>CO2 monitoring:</strong> Low CO2 (&lt;22) can indicate metabolic acidosis or hyperventilation — possible if tumor burden is high or you're experiencing pain.</li>
          <li><strong>SpO2 target:</strong> Keep ≥96% at rest. If using a pulse oximeter, log readings after exercise and at rest.</li>
          <li><strong>Immunotherapy + lungs:</strong> If you ever receive checkpoint inhibitors (pembrolizumab, atezolizumab), pneumonitis is a serious side effect. Report any new breathing changes immediately.</li>
          <li><strong>Exercise benefit:</strong> 20–40 min moderate walking improves pulmonary reserve, increases NK cell trafficking, and reduces cancer mortality. Prioritize outdoor walks.</li>
        </ul>
      </div>

      {/* Protective supplements */}
      {data.protectiveSupplements?.length > 0 && (
        <ProtectiveSupplementsCard supplements={data.protectiveSupplements} organ="lung" />
      )}

      {/* Add SpO2 reading */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginTop: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)' }}>
        <h3 style={{ marginBottom: 8 }}>📟 Track SpO2 Manually</h3>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
          SpO2 isn't typically included in standard lab panels. If you have a pulse oximeter, log your reading here or in the Vitals section.
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          <strong>Normal:</strong> 96–100% at rest &nbsp;|&nbsp;
          <strong>Concerning:</strong> &lt;95% — discuss with Dr. Do &nbsp;|&nbsp;
          <strong>Emergency:</strong> &lt;90% — call 911
        </p>
      </div>
    </div>
  );
}
