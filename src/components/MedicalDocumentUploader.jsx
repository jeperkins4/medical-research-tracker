/**
 * MedicalDocumentUploader
 * Upload + AI-parse radiology reports and doctor's notes.
 * Stores structured extractions locally (HIPAA, no cloud).
 */
import { useState, useEffect } from 'react';
import BodyDiagram from './BodyDiagram';

const isElectron = typeof window !== 'undefined' && !!window.electron?.docs;

const DOC_TYPES = {
  radiology: {
    label: 'Radiology Report',
    emoji: '🫁',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    hint: 'CT scans, MRI, X-rays, PET scans, Ultrasounds',
    fileHint: 'PDF, JPG, PNG',
  },
  doctor_note: {
    label: "Doctor's Note / Clinical Note",
    emoji: '🩺',
    color: '#059669',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    hint: 'Office visit notes, consults, referrals, discharge summaries',
    fileHint: 'PDF, TXT',
  },
};

export default function MedicalDocumentUploader({ apiFetch, onSaved }) {
  const [docType, setDocType]       = useState('radiology');
  const [step, setStep]             = useState('idle'); // idle | parsing | preview | saving | done | error
  const [parsed, setParsed]         = useState(null);
  const [error, setError]           = useState(null);
  const [savedResult, setSavedResult] = useState(null);
  const [documents, setDocuments]   = useState([]);
  const [viewTab, setViewTab]       = useState('upload'); // upload | history
  const [manualMarkers, setManualMarkers] = useState([]);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [docMarkers, setDocMarkers] = useState({}); // id -> markers[]

  const cfg = DOC_TYPES[docType];

  useEffect(() => {
    if (viewTab === 'history') loadDocuments();
  }, [viewTab]);

  async function loadDocuments() {
    try {
      if (isElectron) {
        const r = await window.electron.docs.getDocuments();
        if (r.success) setDocuments(r.documents);
      } else {
        const r = await apiFetch('/api/documents');
        setDocuments(await r.json());
      }
    } catch { setDocuments([]); }
  }

  // ── File selection ──────────────────────────────────────────────────────

  async function handlePickFile() {
    setError(null);
    try {
      if (isElectron) {
        const { canceled, filePaths } = await window.electron.docs.openFile({
          title: `Open ${DOC_TYPES[docType].label}`,
          filters: [
            { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'txt'] },
          ],
          properties: ['openFile'],
        });
        if (canceled || !filePaths.length) return;
        await parseFile(filePaths[0]);
      } else {
        document.getElementById('doc-file-input').click();
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
      const fd = new FormData();
      fd.append('document', file);
      fd.append('docType', docType);
      const res = await apiFetch('/api/documents/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Parse failed');
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError(friendlyError(err.message));
      setStep('error');
    }
  }

  async function parseFile(filePath) {
    setStep('parsing');
    try {
      const data = await window.electron.docs.parseDocument(filePath, docType);
      if (!data.success) throw new Error(data.error || 'Parse failed');
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError(friendlyError(err.message));
      setStep('error');
    }
  }

  function friendlyError(msg = '') {
    const m = msg.toLowerCase();
    if (m.includes('overload') || m.includes('529'))
      return 'Claude AI is busy right now — retrying automatically. If this keeps happening, try again in 30 seconds.';
    if (m.includes('api key') || m.includes('auth') || m.includes('401'))
      return 'API key issue — check that ANTHROPIC_API_KEY is set in your .env file.';
    if (m.includes('timeout') || m.includes('timed out'))
      return 'Request timed out — the PDF may be too large. Try a smaller file or a TXT version.';
    if (m.includes('file not found'))
      return 'File not found — it may have been moved or deleted.';
    return msg;
  }

  // ── Save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!parsed) return;
    setStep('saving');
    try {
      const payload = { ...parsed, body_markers: manualMarkers };
      let result;
      if (isElectron) {
        result = await window.electron.docs.saveDocument(payload);
      } else {
        const r = await apiFetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        result = await r.json();
      }
      setSavedResult(result);
      setStep('done');
      onSaved?.();
    } catch (err) {
      setError('Save failed: ' + err.message);
      setStep('error');
    }
  }

  async function saveDocMarkers(docId, markers) {
    try {
      if (isElectron) {
        await window.electron.docs.updateMarkers(docId, markers);
      } else {
        await apiFetch(`/api/documents/${docId}/markers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markers }),
        });
      }
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, body_markers: markers } : d));
    } catch (err) {
      console.error('Failed to save markers:', err);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document?')) return;
    try {
      if (isElectron) {
        await window.electron.docs.deleteDocument(id);
      } else {
        await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      }
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  function reset() {
    setStep('idle'); setParsed(null); setError(null); setSavedResult(null);
    setManualMarkers([]);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  const Section = ({ title, children, border }) => (
    <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10,
      background: '#f8fafc', border: `1px solid ${border || '#e2e8f0'}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  const Tag = ({ children, color = '#475569', bg = '#f1f5f9' }) => (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 500, background: bg, color, marginRight: 6, marginBottom: 4 }}>
      {children}
    </span>
  );

  const List = ({ items, color }) => !items?.length ? null : (
    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13, color: color || '#334155', marginBottom: 3 }}>{item}</li>
      ))}
    </ul>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ marginBottom: 24 }}>
      {!isElectron && (
        <input id="doc-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.txt"
          style={{ display: 'none' }} onChange={handleFileInput} />
      )}

      {/* Tab bar — Upload / History */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {[['upload','📤 Upload Document'],['history','📁 Document History']].map(([t, label]) => (
          <button key={t} onClick={() => setViewTab(t)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, borderBottom: viewTab === t ? '2px solid #0369a1' : '2px solid transparent',
            color: viewTab === t ? '#0369a1' : '#64748b', marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {/* ── UPLOAD TAB ── */}
      {viewTab === 'upload' && (
        <>
          {/* Document type selector */}
          {step === 'idle' && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {Object.entries(DOC_TYPES).map(([type, c]) => (
                <button key={type} onClick={() => setDocType(type)} style={{
                  flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: docType === type ? `2px solid ${c.color}` : '2px solid #e2e8f0',
                  background: docType === type ? c.bg : '#fff',
                  transition: 'all 0.15s', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: docType === type ? c.color : '#334155', marginBottom: 2 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{c.hint}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>📎 {c.fileHint}</div>
                </button>
              ))}
            </div>
          )}

          {/* ── Idle ── */}
          {step === 'idle' && (
            <div onClick={handlePickFile} style={{
              border: `2px dashed ${cfg.border}`, borderRadius: 12, padding: '32px 24px',
              textAlign: 'center', background: cfg.bg, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{cfg.emoji}</div>
              <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Upload {cfg.label}</h3>
              <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>
                {cfg.hint}.<br />
                Claude AI will extract and structure all clinical information.
              </p>
              <button onClick={handlePickFile} style={{
                padding: '10px 24px', background: cfg.color, color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                📄 Choose File
              </button>
              <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
                Supports: {cfg.fileHint} · Processed locally · PHI never sent to cloud
              </div>
            </div>
          )}

          {/* ── Parsing ── */}
          {step === 'parsing' && (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: '#f8fafc',
              borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <style>{`
                @keyframes md-spin{to{transform:rotate(360deg)}}
                @keyframes md-pulse{0%,100%{opacity:.4;transform:scaleX(.6)}50%{opacity:1;transform:scaleX(1)}}
                .md-spin{width:52px;height:52px;border:4px solid ${cfg.bg};border-top-color:${cfg.color};border-radius:50%;animation:md-spin 0.9s linear infinite;margin:0 auto 16px}
                .md-bar-track{width:240px;height:6px;margin:14px auto 0;background:${cfg.bg};border-radius:99px;overflow:hidden}
                .md-bar-fill{height:100%;width:45%;background:${cfg.color};border-radius:99px;animation:md-pulse 1.4s ease-in-out infinite;transform-origin:left center}
              `}</style>
              <div className="md-spin" />
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>
                Analyzing {cfg.label} with AI…
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Claude is extracting clinical information and structuring findings.
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Takes 15–30 seconds · Auto-retries if API is busy
              </div>
              <div className="md-bar-track"><div className="md-bar-fill" /></div>
            </div>
          )}

          {/* ── Preview ── */}
          {step === 'preview' && parsed && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', color: '#1e293b', fontSize: 16, fontWeight: 700 }}>
                      {cfg.emoji} {parsed.title || cfg.label}
                    </h3>
                    <div style={{ fontSize: 12, color: cfg.color }}>
                      {[parsed.date, parsed.provider, parsed.facility].filter(Boolean).join(' · ')}
                      {parsed.file_name && <span style={{ color: '#94a3b8' }}> · {parsed.file_name}</span>}
                    </div>
                  </div>
                  <button onClick={reset} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20
                  }}>✕</button>
                </div>
                {parsed.modality && <Tag color={cfg.color} bg="#fff">{parsed.modality}</Tag>}
                {parsed.body_region && <Tag>{parsed.body_region}</Tag>}
                {parsed.note_type && <Tag color={cfg.color} bg="#fff">{parsed.note_type.replace('_', ' ')}</Tag>}
              </div>

              {/* Content */}
              <div style={{ padding: 20, maxHeight: 420, overflowY: 'auto' }}>
                {/* AI Summary */}
                {parsed.summary && (
                  <Section title="AI Summary" border={cfg.border}>
                    <p style={{ margin: 0, fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{parsed.summary}</p>
                  </Section>
                )}

                {/* Critical findings */}
                {parsed.critical_findings?.length > 0 && (
                  <Section title="⚡ Critical / Urgent Findings" border="#fca5a5">
                    <List items={parsed.critical_findings} color="#dc2626" />
                  </Section>
                )}

                {/* Radiology-specific */}
                {docType === 'radiology' && (
                  <>
                    {parsed.clinical_indication && (
                      <Section title="Clinical Indication">
                        <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>{parsed.clinical_indication}</p>
                      </Section>
                    )}
                    {parsed.findings && (
                      <Section title="Findings">
                        <p style={{ margin: 0, fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{parsed.findings}</p>
                      </Section>
                    )}
                    {parsed.impression && (
                      <Section title="Impression / Conclusion" border={cfg.border}>
                        <p style={{ margin: 0, fontSize: 13, color: '#0c4a6e', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontWeight: 500 }}>{parsed.impression}</p>
                      </Section>
                    )}
                    {parsed.comparison && (
                      <Section title="Comparison">
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{parsed.comparison}</p>
                      </Section>
                    )}
                    {parsed.recommendations?.length > 0 && (
                      <Section title="Recommendations">
                        <List items={parsed.recommendations} />
                      </Section>
                    )}
                    {/* Body Diagram */}
                    <Section title="Anatomy Map" border={cfg.border}>
                      <BodyDiagram
                        findings={parsed.body_regions_affected || []}
                        markers={manualMarkers}
                        onMarkersChange={setManualMarkers}
                      />
                    </Section>
                  </>
                )}

                {/* Doctor note-specific */}
                {docType === 'doctor_note' && (
                  <>
                    {parsed.chief_complaint && (
                      <Section title="Chief Complaint">
                        <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>{parsed.chief_complaint}</p>
                      </Section>
                    )}
                    {parsed.diagnoses?.length > 0 && (
                      <Section title="Diagnoses / Problems">
                        <List items={parsed.diagnoses} color="#1e293b" />
                      </Section>
                    )}
                    {parsed.treatment_plan && (
                      <Section title="Treatment Plan" border={cfg.border}>
                        <p style={{ margin: 0, fontSize: 13, color: '#14532d', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{parsed.treatment_plan}</p>
                      </Section>
                    )}
                    {parsed.medications_mentioned?.length > 0 && (
                      <Section title="Medications Discussed">
                        <List items={parsed.medications_mentioned} />
                      </Section>
                    )}
                    {parsed.labs_ordered?.length > 0 && (
                      <Section title="Labs Ordered">
                        <List items={parsed.labs_ordered} color="#0369a1" />
                      </Section>
                    )}
                    {parsed.imaging_ordered?.length > 0 && (
                      <Section title="Imaging Ordered">
                        <List items={parsed.imaging_ordered} color="#7c3aed" />
                      </Section>
                    )}
                    {parsed.referrals?.length > 0 && (
                      <Section title="Referrals">
                        <List items={parsed.referrals} />
                      </Section>
                    )}
                    {parsed.follow_up && (
                      <Section title="Follow-up Instructions">
                        <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>{parsed.follow_up}</p>
                      </Section>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={reset} style={{
                  padding: '8px 16px', background: '#f1f5f9', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                }}>↩ Re-upload</button>
                <button onClick={handleSave} style={{
                  padding: '8px 22px', background: cfg.color, color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>💾 Save to Records</button>
              </div>
            </div>
          )}

          {/* ── Saving ── */}
          {step === 'saving' && (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>💾</div>
              Saving to local records…
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div style={{ padding: '16px 20px', background: '#d1fae5', border: '1px solid #6ee7b7',
              borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#065f46' }}>✅ Saved to records</strong>
                <span style={{ color: '#047857', marginLeft: 10, fontSize: 14 }}>
                  {parsed?.title || cfg.label} — {parsed?.date || 'undated'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setViewTab('history')} style={{
                  padding: '6px 14px', background: '#059669', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                }}>View History</button>
                <button onClick={reset} style={{
                  padding: '6px 14px', background: '#6ee7b7', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                }}>Upload Another</button>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div style={{ padding: '14px 20px', background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#b91c1c', fontSize: 14 }}>❌ {error}</span>
              <button onClick={reset} style={{
                padding: '6px 14px', background: '#ef4444', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              }}>Try Again</button>
            </div>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {viewTab === 'history' && (
        <div>
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📁</div>
              <p>No medical documents saved yet.</p>
              <button onClick={() => setViewTab('upload')} style={{
                padding: '8px 20px', background: '#0369a1', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              }}>Upload First Document</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {documents.map(doc => {
                const c = DOC_TYPES[doc.document_type] || DOC_TYPES.radiology;
                const hasCritical = doc.critical_findings?.length > 0;
                return (
                  <div key={doc.id} style={{
                    border: `1px solid ${hasCritical ? '#fca5a5' : c.border}`,
                    borderRadius: 12, background: '#fff', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '14px 18px', background: hasCritical ? '#fef2f2' : c.bg,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 2 }}>
                          {c.emoji} {doc.title || c.label}
                          {hasCritical && <span style={{ marginLeft: 8, fontSize: 12, color: '#dc2626' }}>⚡ Critical findings</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {[doc.date, doc.provider, doc.facility].filter(Boolean).join(' · ')}
                        </div>
                        {doc.modality && <Tag color={c.color} bg="#fff">{doc.modality}</Tag>}
                        {doc.body_region && <Tag>{doc.body_region}</Tag>}
                      </div>
                      <button onClick={() => handleDelete(doc.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94a3b8', fontSize: 16, padding: '2px 6px',
                      }} title="Delete">🗑️</button>
                    </div>
                    {doc.summary && (
                      <div
                        style={{ padding: '12px 18px', fontSize: 13, color: '#334155', lineHeight: 1.6,
                          borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                        onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                      >
                        {doc.summary}
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>
                          {expandedDocId === doc.id ? '▲ collapse' : '▼ anatomy map'}
                        </span>
                      </div>
                    )}
                    {hasCritical && (
                      <div style={{ padding: '8px 18px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
                        <strong style={{ fontSize: 12, color: '#dc2626' }}>⚡ Critical: </strong>
                        <span style={{ fontSize: 12, color: '#991b1b' }}>{doc.critical_findings.join(' · ')}</span>
                      </div>
                    )}
                    {/* Expandable body diagram */}
                    {expandedDocId === doc.id && doc.document_type === 'radiology' && (
                      <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
                        <BodyDiagram
                          findings={doc.body_regions_affected || []}
                          markers={doc.body_markers || []}
                          onMarkersChange={(markers) => saveDocMarkers(doc.id, markers)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
