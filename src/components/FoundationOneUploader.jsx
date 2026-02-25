/**
 * Foundation One Report Uploader
 * Parses FoundationOne CDx PDF reports and imports mutations into the database.
 * Works in Electron (IPC) and falls back to server-side parsing in web mode.
 */

import { useState } from 'react';

const isElectron = typeof window !== 'undefined' && window.electron && window.electron.genomics;

export default function FoundationOneUploader({ onImported }) {
  const [step, setStep]               = useState('idle'); // idle | parsing | preview | importing | done | error
  const [parsed, setParsed]           = useState(null);
  const [error, setError]             = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [result, setResult]           = useState(null);
  const [trialsSearching, setTrialsSearching] = useState(false);
  const [trialsResult, setTrialsResult]       = useState(null);

  // ── Pick & Parse ───────────────────────────────────────────────────────────

  async function handlePickFile() {
    setError(null);
    try {
      if (isElectron) {
        // Use Electron file dialog
        const { canceled, filePaths } = await window.electron.genomics.openFile({
          title: 'Open Foundation One CDx Report',
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
          properties: ['openFile'],
        });
        if (canceled || !filePaths.length) return;
        await parsePDF(filePaths[0]);
      } else {
        // Web fallback: <input type="file">
        document.getElementById('fo-file-input').click();
      }
    } catch (err) {
      setError('Failed to open file: ' + err.message);
    }
  }

  async function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Web mode: POST to server
    setStep('parsing');
    try {
      const formData = new FormData();
      formData.append('report', file);
      const res = await fetch('/api/genomics/parse-foundation-one', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
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
      const data = await window.electron.genomics.parseFoundationOne(filePath);
      if (data.error) throw new Error(data.error);
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError('Parse failed: ' + err.message);
      setStep('error');
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!parsed?.mutations?.length) return;
    setStep('importing');
    try {
      let res;
      if (isElectron) {
        res = await window.electron.genomics.importMutations(parsed.mutations, replaceExisting);
      } else {
        const r = await fetch('/api/genomics/import-mutations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mutations: parsed.mutations, replaceExisting }),
        });
        res = await r.json();
      }
      setResult(res);
      setStep('done');
      onImported?.();

      // Background: search for clinical trials for each imported mutation.
      // We don't block on this — it runs after the user sees the success state.
      if (isElectron && parsed.mutations?.length) {
        setTrialsSearching(true);
        setTrialsResult(null);
        console.log('[FoundationOneUploader] Triggering background trial search…');
        window.electron.genomics.searchTrials(parsed.mutations)
          .then(r => {
            setTrialsSearching(false);
            setTrialsResult(r || null);
            if (r?.trialsFound > 0) {
              console.log(`[FoundationOneUploader] Trial search: ${r.trialsFound} trials found`);
              onImported?.(); // refresh dashboard to update trial counts
            }
          })
          .catch(err => {
            console.warn('[FoundationOneUploader] Trial search failed:', err.message);
            setTrialsSearching(false);
          });
      }
    } catch (err) {
      setError('Import failed: ' + err.message);
      setStep('error');
    }
  }

  function reset() {
    setStep('idle');
    setParsed(null);
    setError(null);
    setResult(null);
    setTrialsSearching(false);
    setTrialsResult(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Hidden web file input */}
      {!isElectron && (
        <input
          id="fo-file-input"
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      )}

      {step === 'idle' && (
        <div style={{
          border: '2px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          background: '#f8fafc',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧬</div>
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Upload Foundation One CDx Report</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>
            Upload any FoundationOne CDx PDF to automatically extract mutations, copy number alterations, and biomarkers.
          </p>
          <button
            onClick={handlePickFile}
            style={{
              padding: '10px 24px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📄 Choose PDF Report
          </button>
        </div>
      )}

      {step === 'parsing' && (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <style>{`
            @keyframes fo-spin { to { transform: rotate(360deg); } }
            @keyframes fo-pulse { 0%,100% { opacity: .4; transform: scaleX(.6); } 50% { opacity: 1; transform: scaleX(1); } }
            .fo-spinner {
              width: 48px; height: 48px; margin: 0 auto 16px;
              border: 4px solid #dbeafe;
              border-top-color: #2563eb;
              border-radius: 50%;
              animation: fo-spin 0.9s linear infinite;
            }
            .fo-bar-track {
              width: 220px; height: 6px; margin: 12px auto 0;
              background: #dbeafe; border-radius: 99px; overflow: hidden;
            }
            .fo-bar-fill {
              height: 100%; width: 45%; background: #2563eb; border-radius: 99px;
              animation: fo-pulse 1.4s ease-in-out infinite;
              transform-origin: left center;
            }
          `}</style>
          <div className="fo-spinner" />
          <div style={{ fontWeight: 600, color: '#1e40af', fontSize: '15px', marginBottom: '6px' }}>
            Analyzing report with AI…
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Claude is extracting all mutations from your Foundation One CDx report.
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            This typically takes 10–20 seconds — hang tight
          </div>
          <div className="fo-bar-track"><div className="fo-bar-fill" /></div>
        </div>
      )}

      {step === 'preview' && parsed && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', background: '#f0f9ff', borderBottom: '1px solid #e0f2fe' }}>
            <h3 style={{ margin: '0 0 4px', color: '#0c4a6e' }}>
              🧬 AI extracted — {parsed.mutations?.length || 0} mutations found
            </h3>
            <div style={{ fontSize: '13px', color: '#0369a1' }}>
              {parsed.reportSource && `Source: ${parsed.reportSource} • `}
              {parsed.reportDate && `Report date: ${parsed.reportDate}`}
              {!parsed.mutations?.length && ' — Review the mutations below before importing'}
            </div>
          </div>

          {/* Mutation list */}
          <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '16px 20px' }}>
            {parsed.mutations?.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center' }}>
                No mutations detected. The PDF may not follow the standard Foundation One format.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b' }}>Gene</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b' }}>Alteration</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b' }}>Type</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>VAF</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.mutations.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#1e40af' }}>{m.gene}</td>
                      <td style={{ padding: '6px 8px', color: '#334155' }}>{m.mutation_detail}</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                          background: m.mutation_type === 'Short Variant' ? '#dbeafe' :
                                      m.mutation_type === 'Copy Number Alteration' ? '#fef3c7' : '#ede9fe',
                          color: m.mutation_type === 'Short Variant' ? '#1e40af' :
                                  m.mutation_type === 'Copy Number Alteration' ? '#92400e' : '#5b21b6',
                        }}>{m.mutation_type}</span>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155' }}>
                        {m.vaf != null ? `${m.vaf}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Biomarkers */}
          {parsed.biomarkers?.length > 0 && (
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>BIOMARKERS</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {parsed.biomarkers.map((b, i) => (
                  <span key={i} style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
                    background: '#e0f2fe', color: '#0369a1', fontWeight: 600,
                  }}>
                    {b.name}: {b.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={e => setReplaceExisting(e.target.checked)}
              />
              Replace existing mutations with same gene/alteration
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={reset} style={{
                padding: '8px 16px', background: '#f1f5f9', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              }}>Cancel</button>
              <button
                onClick={handleImport}
                disabled={!parsed.mutations?.length}
                style={{
                  padding: '8px 20px', background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600,
                  opacity: parsed.mutations?.length ? 1 : 0.5,
                }}
              >
                Import {parsed.mutations?.length} Mutations
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>💾</div>
          Importing mutations…
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #6ee7b7' }}>
          <div style={{
            padding: '16px 20px',
            background: '#d1fae5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <strong style={{ color: '#065f46' }}>✅ Import complete</strong>
              <span style={{ color: '#047857', marginLeft: '10px', fontSize: '14px' }}>
                {result.imported} imported · {result.skipped} skipped (already exist)
              </span>
            </div>
            <button onClick={reset} style={{
              padding: '6px 14px', background: '#059669', color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            }}>Upload Another</button>
          </div>

          {/* Trial search status */}
          {trialsSearching && (
            <div style={{
              padding: '10px 20px', background: '#eff6ff',
              borderTop: '1px solid #bfdbfe',
              display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1e40af',
            }}>
              <style>{`@keyframes fo-spin2{to{transform:rotate(360deg)}} .fo-mini-spin{width:14px;height:14px;border:2px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:fo-spin2 0.8s linear infinite;flex-shrink:0}`}</style>
              <div className="fo-mini-spin" />
              Searching ClinicalTrials.gov for active studies matching your mutations…
            </div>
          )}

          {!trialsSearching && trialsResult && (
            <div style={{
              padding: '10px 20px', background: trialsResult.trialsFound > 0 ? '#eff6ff' : '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '13px',
              color: trialsResult.trialsFound > 0 ? '#1e40af' : '#64748b',
            }}>
              {trialsResult.trialsFound > 0
                ? `🔬 Found ${trialsResult.trialsFound} clinical trial(s) across ${trialsResult.mutationsSearched} gene(s) — trial counts updated in the dashboard.`
                : '🔬 No active recruiting trials found for these mutations at this time.'}
            </div>
          )}
        </div>
      )}

      {step === 'error' && (
        <div style={{
          padding: '14px 20px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: '#b91c1c', fontSize: '14px' }}>❌ {error}</span>
          <button onClick={reset} style={{
            padding: '6px 14px', background: '#ef4444', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
          }}>Try Again</button>
        </div>
      )}
    </div>
  );
}
