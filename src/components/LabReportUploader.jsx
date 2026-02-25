/**
 * Lab Report Uploader
 * Parses lab PDFs (CMP, CBC, Lipid, etc.) with Claude AI and imports results.
 */
import { useState } from 'react';

const isElectron = typeof window !== 'undefined' && window.electron?.labs?.parsePDF;

const FLAG_STYLE = {
  high:     { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', label: '▲ HIGH' },
  low:      { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd', label: '▼ LOW' },
  critical: { bg: '#fff1f2', text: '#9f1239', border: '#fda4af', label: '⚡ CRITICAL' },
  normal:   { bg: '#f0fdf4', text: '#166534', border: '#86efac', label: '✓ Normal' },
};

const PANEL_EMOJI = { CMP: '🧪', CBC: '🩸', Lipid: '💛', Thyroid: '🦋', Tumor: '🔬', HbA1c: '📊', Kidney: '🫘', General: '📋' };

export default function LabReportUploader({ onImported }) {
  const [step, setStep]                   = useState('idle'); // idle | parsing | preview | importing | done | error
  const [parsed, setParsed]               = useState(null);
  const [error, setError]                 = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [result, setResult]               = useState(null);
  const [filterPanel, setFilterPanel]     = useState('all');
  const [filterFlag, setFilterFlag]       = useState('all');

  // ── File pick ──────────────────────────────────────────────────────────

  async function handlePickFile() {
    setError(null);
    try {
      if (isElectron) {
        const { canceled, filePaths } = await window.electron.labs.openFile({
          title: 'Open Lab Report PDF',
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
          properties: ['openFile'],
        });
        if (canceled || !filePaths.length) return;
        await parsePDF(filePaths[0]);
      } else {
        document.getElementById('lab-file-input').click();
      }
    } catch (err) {
      setError('Failed to open file: ' + err.message);
    }
  }

  async function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('parsing');
    try {
      const formData = new FormData();
      formData.append('report', file);
      const res = await fetch('/api/labs/parse-pdf', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Parse failed');
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError('Parse failed: ' + err.message);
      setStep('error');
    }
  }

  async function parsePDF(filePath) {
    setStep('parsing');
    try {
      const data = await window.electron.labs.parsePDF(filePath);
      if (!data.success) throw new Error(data.error || 'Parse failed');
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError('Parse failed: ' + err.message);
      setStep('error');
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!parsed?.results?.length) return;
    setStep('importing');
    try {
      let res;
      if (isElectron) {
        res = await window.electron.labs.importResults(parsed.results, replaceExisting);
      } else {
        const r = await fetch('/api/labs/import-results', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ results: parsed.results, replaceExisting }),
        });
        res = await r.json();
      }
      setResult(res);
      setStep('done');
      onImported?.();
    } catch (err) {
      setError('Import failed: ' + err.message);
      setStep('error');
    }
  }

  function reset() {
    setStep('idle'); setParsed(null); setError(null); setResult(null);
    setFilterPanel('all'); setFilterFlag('all');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const panels = parsed ? [...new Set(parsed.results?.map(r => r.panel_name) || [])] : [];
  const visibleResults = (parsed?.results || []).filter(r => {
    const panelOK = filterPanel === 'all' || r.panel_name === filterPanel;
    const flagOK  = filterFlag === 'all' || r.flag === filterFlag;
    return panelOK && flagOK;
  });
  const abnormal = (parsed?.results || []).filter(r => r.flag !== 'normal');

  return (
    <div style={{ marginBottom: '24px' }}>
      {!isElectron && <input id="lab-file-input" type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />}

      {/* ── Idle ── */}
      {step === 'idle' && (
        <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '28px', textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧪</div>
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Upload Lab Report PDF</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>
            Upload any lab report (CMP, CBC, Lipid Panel, Thyroid, etc.).<br />
            Claude AI will extract all test values, flags, and reference ranges.
          </p>
          <button onClick={handlePickFile} style={{ padding: '10px 24px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            📄 Choose Lab Report PDF
          </button>
        </div>
      )}

      {/* ── Parsing ── */}
      {step === 'parsing' && (
        <div style={{ padding: '32px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <style>{`
            @keyframes lr-spin{to{transform:rotate(360deg)}}
            @keyframes lr-pulse{0%,100%{opacity:.4;transform:scaleX(.6)}50%{opacity:1;transform:scaleX(1)}}
            .lr-spin{width:48px;height:48px;border:4px solid #e0f2fe;border-top-color:#0369a1;border-radius:50%;animation:lr-spin 0.9s linear infinite;margin:0 auto 16px}
            .lr-bar-track{width:220px;height:6px;margin:12px auto 0;background:#e0f2fe;border-radius:99px;overflow:hidden}
            .lr-bar-fill{height:100%;width:45%;background:#0369a1;border-radius:99px;animation:lr-pulse 1.4s ease-in-out infinite;transform-origin:left center}
          `}</style>
          <div className="lr-spin" />
          <div style={{ fontWeight: 600, color: '#0c4a6e', fontSize: '15px', marginBottom: '6px' }}>Analyzing lab report with AI…</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Claude is extracting test values, reference ranges, and flags.</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>This takes 10–20 seconds</div>
          <div className="lr-bar-track"><div className="lr-bar-fill" /></div>
        </div>
      )}

      {/* ── Preview ── */}
      {step === 'preview' && parsed && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 20px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: '#0c4a6e', fontSize: '16px', fontWeight: 700 }}>
                  🧪 {parsed.resultCount} test results extracted
                  {abnormal.length > 0 && <span style={{ marginLeft: '12px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>⚠️ {abnormal.length} abnormal</span>}
                </h3>
                <div style={{ fontSize: '12px', color: '#0369a1' }}>
                  {parsed.report_date && `Date: ${parsed.report_date}`}
                  {parsed.provider && ` · ${parsed.provider}`}
                  {panels.length > 0 && ` · Panels: ${panels.map(p => `${PANEL_EMOJI[p] || '📋'} ${p}`).join(', ')}`}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <select value={filterPanel} onChange={e => setFilterPanel(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff' }}>
                <option value="all">All Panels</option>
                {panels.map(p => <option key={p} value={p}>{PANEL_EMOJI[p] || '📋'} {p}</option>)}
              </select>
              <select value={filterFlag} onChange={e => setFilterFlag(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff' }}>
                <option value="all">All Results</option>
                <option value="high">▲ High only</option>
                <option value="low">▼ Low only</option>
                <option value="critical">⚡ Critical only</option>
                <option value="normal">✓ Normal only</option>
              </select>
              <span style={{ fontSize: '12px', color: '#64748b', alignSelf: 'center' }}>{visibleResults.length} showing</span>
            </div>
          </div>

          {/* Results table */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['Panel', 'Test Name', 'Result', 'Unit', 'Reference Range', 'Flag'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((r, i) => {
                  const fs = FLAG_STYLE[r.flag] || FLAG_STYLE.normal;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: r.flag !== 'normal' ? fs.bg : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#64748b', fontSize: '11px' }}>{PANEL_EMOJI[r.panel_name] || '📋'} {r.panel_name}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1e293b' }}>{r.test_name}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: r.flag !== 'normal' ? fs.text : '#334155' }}>{r.result}</td>
                      <td style={{ padding: '6px 10px', color: '#64748b' }}>{r.unit}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8', fontSize: '12px' }}>
                        {r.normal_low && r.normal_high ? `${r.normal_low} – ${r.normal_high}` : (r.normal_low || r.normal_high || '—')}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: fs.bg, color: fs.text, border: `1px solid ${fs.border}` }}>
                          {fs.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} />
              Replace existing results with same test/date
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={reset} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleImport} disabled={!parsed.results?.length} style={{ padding: '8px 20px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: parsed.results?.length ? 1 : 0.5 }}>
                Import {parsed.results?.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Importing ── */}
      {step === 'importing' && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>💾</div>
          Saving lab results…
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && result && (
        <div style={{ padding: '16px 20px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ color: '#065f46' }}>✅ Import complete</strong>
            <span style={{ color: '#047857', marginLeft: '10px', fontSize: '14px' }}>
              {result.imported} new · {result.updated || 0} updated · {result.skipped} skipped
            </span>
          </div>
          <button onClick={reset} style={{ padding: '6px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Upload Another
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <div style={{ padding: '14px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#b91c1c', fontSize: '14px' }}>❌ {error}</span>
          <button onClick={reset} style={{ padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Try Again</button>
        </div>
      )}
    </div>
  );
}
