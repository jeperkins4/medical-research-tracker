/**
 * Kidney Health Tracker
 * Monitors Creatinine, GFR, BUN trends for bladder cancer patients
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
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.name}</div>
            {s.dosage && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{s.dosage}</div>}
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{s.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendBadge({ trend, invertBad = false }) {
  if (!trend) return <span style={{ color: '#888' }}>—</span>;
  const bad = invertBad ? trend.direction === 'down' : trend.direction === 'up';
  return (
    <span style={{ color: bad ? '#f44336' : '#4caf50', fontWeight: 600, fontSize: 13 }}>
      {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.change)}%
    </span>
  );
}

export default function KidneyHealthTracker({ apiFetch: propFetch }) {
  const apiFetch = propFetch || credFetch;
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await apiFetch('/api/kidney-health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Loading kidney health data…</div>;
  if (error)   return <div style={{ padding: 32, color: '#f44336' }}>Error: {error}</div>;
  if (!data)   return null;

  // All-clear view — labs normal, no clinical indicators
  if (data.allNormal) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 4 }}>🫘 Kidney Health</h2>
        <div style={{
          marginTop: 24, padding: 28, borderRadius: 12, background: '#e8f5e9',
          boxShadow: '0 1px 6px rgba(0,0,0,.08)', borderLeft: '5px solid #4caf50'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#2e7d32' }}>Kidney Function Normal</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#444' }}>
            eGFR ≥90 · Creatinine within range · BUN normal.<br/>
            No clinical indicators for elevated kidney monitoring at this time.<br/>
            <strong>CKD Stage:</strong> {data.ckdStage}
          </p>
        </div>
        {data.protectiveSupplements?.length > 0 && (
          <ProtectiveSupplementsCard supplements={data.protectiveSupplements} organ="kidney" />
        )}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: '#fff3e0', fontSize: 13, color: '#555' }}>
          <strong>Still watch for:</strong> Creatinine rise &gt;0.3 in 48h (hydronephrosis from bladder tumor).
          Adequate hydration (2.5–3L/day) is your best kidney protection.
        </div>
      </div>
    );
  }

  const gfrStatus = data.latestGFR >= 90 ? 'normal' : data.latestGFR >= 60 ? 'warning' : 'critical';
  const crStatus  = data.creatinineNormal ? 'normal' : 'warning';

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 4 }}>🫘 Kidney Health</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Creatinine · GFR · BUN — Critical for cisplatin eligibility and bladder cancer staging
      </p>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          {
            label: 'eGFR',
            value: data.latestGFR !== null ? `${data.latestGFR.toFixed(1)} mL/min` : '—',
            normal: data.normalRanges.gfr,
            status: gfrStatus,
            trend: data.trends.gfr,
            invertBad: true,
            note: data.ckdStage
          },
          {
            label: 'Creatinine',
            value: data.latestCreatinine !== null ? `${data.latestCreatinine} mg/dL` : '—',
            normal: data.normalRanges.creatinine,
            status: crStatus,
            trend: data.trends.creatinine,
            invertBad: false,
            note: 'Serum creatinine'
          },
          {
            label: 'BUN',
            value: data.series.bun.at(-1)?.value !== undefined ? `${data.series.bun.at(-1).value} mg/dL` : '—',
            normal: data.normalRanges.bun,
            status: 'normal',
            trend: null,
            note: 'Blood urea nitrogen'
          }
        ].map(card => (
          <div key={card.label} style={{
            flex: '1 1 200px', padding: 20, borderRadius: 12,
            background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.08)',
            borderLeft: `4px solid ${STATUS_COLOR[card.status]}`
          }}>
            <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: STATUS_COLOR[card.status] }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#888' }}>Normal: {card.normal}</div>
            {card.trend && <div style={{ marginTop: 6, fontSize: 13 }}>Trend: <TrendBadge trend={card.trend} invertBad={card.invertBad} /></div>}
            {card.note && <div style={{ marginTop: 6, fontSize: 12, color: '#555', fontStyle: 'italic' }}>{card.note}</div>}
          </div>
        ))}
      </div>

      {/* GFR chart */}
      {data.series.gfr.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>eGFR Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.series.gfr}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'mL/min', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={60} stroke="#ff9800" strokeDasharray="4 4" label={{ value: 'CKD threshold (60)', fill: '#ff9800', fontSize: 11 }} />
              <ReferenceLine y={90} stroke="#4caf50" strokeDasharray="4 4" label={{ value: 'Normal (90)', fill: '#4caf50', fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#2196f3" strokeWidth={2} dot={false} name="eGFR" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Creatinine chart */}
      {data.series.creatinine.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Creatinine Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.series.creatinine}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'mg/dL', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={1.2} stroke="#f44336" strokeDasharray="4 4" label={{ value: 'Upper limit (1.2)', fill: '#f44336', fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#9c27b0" strokeWidth={2} dot={false} name="Creatinine" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Protective supplements */}
      {data.protectiveSupplements?.length > 0 && (
        <ProtectiveSupplementsCard supplements={data.protectiveSupplements} organ="kidney" />
      )}

      {/* Clinical context */}
      <div style={{ background: '#e3f2fd', borderRadius: 12, padding: 20, marginTop: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)' }}>
        <h3 style={{ marginBottom: 12 }}>📋 Clinical Context for Bladder Cancer</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: '#333' }}>
          <li><strong>eGFR &lt;60:</strong> Cisplatin ineligible — limits standard MVAC/GC chemotherapy options. Erdafitinib (your FGFR3 target) does NOT require renal dosing adjustment at your current GFR.</li>
          <li><strong>eGFR 60–89:</strong> Mildly decreased — monitor closely. Carboplatin-based regimens may be preferred if cisplatin is needed.</li>
          <li><strong>eGFR ≥90:</strong> Fully cisplatin eligible. Current level supports full-dose systemic therapy if needed.</li>
          <li><strong>Creatinine rise:</strong> Could indicate hydronephrosis from ureteral obstruction — common in bladder cancer progression. Report to Dr. Do immediately if Cr rises &gt;0.3 in 48h.</li>
          <li><strong>Hydration target:</strong> 2.5–3L/day. Adequate hydration protects kidneys and dilutes carcinogens in urine.</li>
        </ul>
      </div>
    </div>
  );
}
