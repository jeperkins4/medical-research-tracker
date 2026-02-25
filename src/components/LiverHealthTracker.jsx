/**
 * Liver Health Tracker
 * Monitors ALT, AST, Albumin, Bilirubin, Alk Phos trends
 */
import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

const credFetch = (url, opts = {}) => fetch(url, { ...opts, credentials: 'include' });
const STATUS_COLOR = { normal: '#4caf50', warning: '#ff9800', critical: '#f44336' };

function TrendBadge({ trend, invertBad = false }) {
  if (!trend) return <span style={{ color: '#888' }}>—</span>;
  const bad = invertBad ? trend.direction === 'down' : trend.direction === 'up';
  return (
    <span style={{ color: bad ? '#f44336' : '#4caf50', fontWeight: 600, fontSize: 13 }}>
      {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.change)}%
    </span>
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
        }}>
          ⚠️ {f.label}
        </div>
      ))}
    </div>
  );
}

export default function LiverHealthTracker({ apiFetch: propFetch }) {
  const apiFetch = propFetch || credFetch;
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await apiFetch('/api/liver-health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Loading liver health data…</div>;
  if (error)   return <div style={{ padding: 32, color: '#f44336' }}>Error: {error}</div>;
  if (!data)   return null;

  // All-clear view
  if (data.allNormal) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 4 }}>🫀 Liver Health</h2>
        <div style={{
          marginTop: 24, padding: 28, borderRadius: 12, background: '#e8f5e9',
          boxShadow: '0 1px 6px rgba(0,0,0,.08)', borderLeft: '5px solid #4caf50'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#2e7d32' }}>Liver Function Normal</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#444' }}>
            ALT · AST · Albumin · Bilirubin all within normal limits.<br/>
            No hepatotoxicity detected. Continue monitoring with each lab draw.
          </p>
          {data.latestALT !== null && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#555' }}>
              Latest: ALT {data.latestALT} U/L · AST {data.latestAST} U/L ·
              Albumin {data.latestAlbumin} g/dL · Bilirubin {data.latestBilirubin} mg/dL
            </p>
          )}
        </div>
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: '#fff3e0', fontSize: 13, color: '#555' }}>
          <strong>Erdafitinib alert:</strong> If started on FGFR3 inhibitor therapy, liver enzymes should be checked every 2 weeks for the first 3 months.
          Report any fatigue, jaundice, or dark urine immediately.
        </div>
      </div>
    );
  }

  const altStatus = data.latestALT === null ? 'normal' : data.latestALT > 120 ? 'critical' : data.latestALT > 40 ? 'warning' : 'normal';
  const astStatus = data.latestAST === null ? 'normal' : data.latestAST > 120 ? 'critical' : data.latestAST > 40 ? 'warning' : 'normal';
  const albStatus = data.latestAlbumin === null ? 'normal' : data.latestAlbumin < 3.2 ? 'critical' : data.latestAlbumin < 3.5 ? 'warning' : 'normal';

  const cards = [
    { label: 'ALT', value: data.latestALT !== null ? `${data.latestALT} U/L` : '—', normal: data.normalRanges.alt, status: altStatus, trend: data.trends.alt, invertBad: false },
    { label: 'AST', value: data.latestAST !== null ? `${data.latestAST} U/L` : '—', normal: data.normalRanges.ast, status: astStatus, trend: data.trends.ast, invertBad: false },
    { label: 'Albumin', value: data.latestAlbumin !== null ? `${data.latestAlbumin} g/dL` : '—', normal: data.normalRanges.albumin, status: albStatus, trend: data.trends.albumin, invertBad: true },
    { label: 'Total Bilirubin', value: data.latestBilirubin !== null ? `${data.latestBilirubin} mg/dL` : '—', normal: data.normalRanges.bilirubin, status: data.latestBilirubin > 1.2 ? 'warning' : 'normal', trend: null, invertBad: false },
    { label: 'Alk Phos', value: data.latestAlkPhos !== null ? `${data.latestAlkPhos} U/L` : '—', normal: data.normalRanges.alkPhos, status: data.latestAlkPhos > 147 ? 'warning' : 'normal', trend: null, invertBad: false },
    { label: 'AST/ALT Ratio', value: data.astAltRatio !== null ? data.astAltRatio : '—', normal: '<1.0 hepatitis, >2.0 alcohol', status: 'normal', trend: null, invertBad: false },
  ];

  // Combine ALT + AST into single chart for comparison
  const combinedTransaminases = (() => {
    const map = {};
    for (const r of data.series.alt) map[r.date] = { date: r.date, alt: r.value };
    for (const r of data.series.ast) {
      if (!map[r.date]) map[r.date] = { date: r.date };
      map[r.date].ast = r.value;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 4 }}>🫀 Liver Health</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>
        ALT · AST · Albumin · Bilirubin · Alk Phos — Hepatotoxicity monitoring during cancer treatment
      </p>

      <FlagBanner flags={data.flags} />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {cards.map(card => (
          <div key={card.label} style={{
            flex: '1 1 160px', padding: 18, borderRadius: 12,
            background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.08)',
            borderLeft: `4px solid ${STATUS_COLOR[card.status]}`
          }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 3px', color: STATUS_COLOR[card.status] }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#888' }}>Normal: {card.normal}</div>
            {card.trend && <div style={{ marginTop: 5, fontSize: 12 }}>Trend: <TrendBadge trend={card.trend} invertBad={card.invertBad} /></div>}
          </div>
        ))}
      </div>

      {/* Transaminase chart */}
      {combinedTransaminases.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>ALT + AST Trend (Liver Enzymes)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={combinedTransaminases}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'U/L', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={40} stroke="#ff9800" strokeDasharray="4 4" label={{ value: 'Upper limit (40)', fill: '#ff9800', fontSize: 11 }} />
              <Line type="monotone" dataKey="alt" stroke="#e91e63" strokeWidth={2} dot={false} name="ALT" />
              <Line type="monotone" dataKey="ast" stroke="#ff5722" strokeWidth={2} dot={false} name="AST" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Albumin chart */}
      {data.series.albumin.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Albumin Trend (Nutritional / Hepatic Synthetic Function)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.series.albumin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'g/dL', angle: -90, position: 'insideLeft', fontSize: 11 }} domain={[2.5, 6]} />
              <Tooltip />
              <ReferenceLine y={3.2} stroke="#f44336" strokeDasharray="4 4" label={{ value: 'Low limit (3.2)', fill: '#f44336', fontSize: 11 }} />
              <ReferenceLine y={5.2} stroke="#4caf50" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="#4caf50" strokeWidth={2} dot={false} name="Albumin" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Clinical context */}
      <div style={{ background: '#fce4ec', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)' }}>
        <h3 style={{ marginBottom: 12 }}>📋 Clinical Context for Bladder Cancer Treatment</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: '#333' }}>
          <li><strong>ALT/AST monitoring critical:</strong> Erdafitinib (FGFR3 inhibitor) can cause hepatotoxicity. Baseline and regular liver function monitoring required.</li>
          <li><strong>Albumin &lt;3.5:</strong> Malnutrition marker — increases cancer mortality risk. Protein intake target 1.2–1.5g/kg/day.</li>
          <li><strong>Albumin &lt;3.2:</strong> Severe — poor prognosis for surgery/systemic therapy. Nutritional intervention urgent.</li>
          <li><strong>AST/ALT &gt;2.0:</strong> Suggests alcoholic pattern or biliary disease. Alert Dr. Do.</li>
          <li><strong>Bilirubin &gt;1.5:</strong> May indicate liver metastases, biliary obstruction, or hemolysis — warrants imaging.</li>
          <li><strong>Elevated Alk Phos + elevated bilirubin:</strong> Cholestatic pattern — possible biliary involvement or liver mets.</li>
        </ul>
      </div>
    </div>
  );
}
