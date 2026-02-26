import { useState } from 'react';

// Use Electron IPC when available (packaged app), fall back to HTTP (web/dev)
const isElectronAI = typeof window !== 'undefined' && window.electron?.ai?.generateHealthcareSummary;

async function fetchHealthcareSummary() {
  if (isElectronAI) {
    return window.electron.ai.generateHealthcareSummary();
  }
  const res = await fetch('/api/ai/healthcare-summary', {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export default function HealthcareSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildPdfHtml = (summaryData) => {
    const sections = formatSection(summaryData.summary);
    const date = new Date(summaryData.generatedAt).toLocaleString();
    const sectionHtml = sections.map(s => `
      <div class="section">
        <h2>${s.title}</h2>
        <div class="body">
          ${s.content.map(line => {
            if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
              return `<li>${line.replace(/^[-*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
            }
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return formatted.trim() ? `<p>${formatted}</p>` : '';
          }).join('')}
        </div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Healthcare Strategy Summary</title>
<style>
  body { font-family: Georgia, serif; font-size: 11pt; color: #111; margin: 0; padding: 1.5cm 2cm; }
  h1 { font-size: 18pt; color: #2c5282; margin-bottom: 4pt; }
  .meta { font-size: 9pt; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 6pt; margin-bottom: 1cm; }
  .section { page-break-inside: avoid; margin-bottom: 1cm; }
  .section h2 { font-size: 12pt; color: #2c5282; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; margin-bottom: 6pt; }
  .body p { margin: 0 0 5pt 0; line-height: 1.6; }
  .body li { margin: 0 0 4pt 1.5em; line-height: 1.6; }
  .footer { margin-top: 1cm; border-top: 1px solid #ccc; padding-top: 6pt; font-size: 8pt; color: #666; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<h1>🩺 Healthcare Strategy Summary</h1>
<div class="meta">
  <span>Generated: ${date}</span> &nbsp;|&nbsp;
  <span>Model: ${summaryData.model}</span> &nbsp;|&nbsp;
  <span>${summaryData.dataSnapshot.mutationCount} mutations · ${summaryData.dataSnapshot.medicationCount} medications · ${summaryData.dataSnapshot.paperCount} papers</span>
</div>
${sectionHtml}
<div class="footer">
  <span>MyTreatmentPath — Healthcare Strategy Summary</span>
  <span>Confidential — For personal use only</span>
  <span>${date}</span>
</div>
</body>
</html>`;
  };

  const handlePrint = async () => {
    if (!summary) return;

    // Electron: generate a real PDF file via IPC
    if (typeof window !== 'undefined' && window.electron?.pdf?.save) {
      const html = buildPdfHtml(summary);
      const filename = `HealthcareStrategy-${new Date().toISOString().split('T')[0]}.pdf`;
      const result = await window.electron.pdf.save(html, filename);
      if (result?.success) {
        alert(`✅ PDF saved to:\n${result.filePath}`);
      } else if (!result?.canceled) {
        alert(`❌ PDF generation failed: ${result?.error || 'Unknown error'}`);
      }
      return;
    }

    // Web/dev fallback: browser print dialog
    const style = document.createElement('style');
    style.id = 'mrt-print-styles';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #mrt-printable, #mrt-printable * { visibility: visible !important; }
        #mrt-printable { position: absolute !important; top: 0; left: 0; width: 100%;
          padding: 2cm !important; background: white !important;
          font-family: Georgia, serif !important; font-size: 11pt !important; }
        .no-print { display: none !important; }
        .summary-section { page-break-inside: avoid; border: none !important; box-shadow: none !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById('mrt-print-styles')?.remove(), 1000);
  };

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchHealthcareSummary();
      
      if (data.error) {
        setError(data.message || data.error);
      } else {
        setSummary(data);
      }
    } catch (err) {
      setError('Failed to generate summary: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSection = (text) => {
    // Split into sections by ### headers
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;

    lines.forEach(line => {
      if (line.startsWith('###')) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: line.replace(/^###\s*/, '').replace(/\d+\.\s*/, ''),
          content: []
        };
      } else if (currentSection && line.trim()) {
        currentSection.content.push(line);
      }
    });

    if (currentSection) sections.push(currentSection);
    return sections;
  };

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>🧠 Healthcare Strategy Summary</h2>
          <p className="subtitle" style={{ color: '#666', marginTop: '0.5rem' }}>
            AI-powered synthesis of your multi-modal health approach
          </p>
        </div>
        <button 
          onClick={generateSummary} 
          disabled={loading}
          className="primary"
          style={{ minWidth: '160px' }}
        >
          {loading ? '⏳ Generating...' : summary ? '🔄 Regenerate' : '✨ Generate Summary'}
        </button>
      </div>

      {error && (
        <div className="alert error" style={{ 
          padding: '1rem', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong>⚠️ Error:</strong> {error}
          {error.includes('API key') && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.9em' }}>
              To enable AI summaries, set <code>OPENAI_API_KEY</code> environment variable and restart the server.
            </div>
          )}
        </div>
      )}

      {!summary && !error && !loading && (
        <div className="empty-state" style={{ 
          textAlign: 'center', 
          padding: '3rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '2rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧬💊🥗📚</div>
          <h3>Generate Your Healthcare Strategy Summary</h3>
          <p style={{ maxWidth: '600px', margin: '1rem auto', color: '#666', lineHeight: '1.6' }}>
            Our AI will analyze your genomic profile, current medications, dietary approach, 
            and research library to create a comprehensive strategy overview. This includes:
          </p>
          <ul style={{ 
            textAlign: 'left', 
            maxWidth: '500px', 
            margin: '1.5rem auto', 
            lineHeight: '1.8' 
          }}>
            <li><strong>Strategy Overview</strong> – How your components work together</li>
            <li><strong>Alignment Analysis</strong> – Genomics → treatments → diet connections</li>
            <li><strong>Coverage Gaps</strong> – Under-addressed pathways or mutations</li>
            <li><strong>Research Opportunities</strong> – Specific areas worth investigating</li>
            <li><strong>Data Quality</strong> – Missing info that would strengthen optimization</li>
          </ul>
          <p style={{ fontSize: '0.9em', color: '#888', marginTop: '1.5rem' }}>
            <strong>Note:</strong> This tool provides strategic insights, not medical advice or prognosis predictions.
          </p>
        </div>
      )}

      {summary && (
        <div className="summary-content" id="mrt-printable">
          {/* Metadata banner */}
          <div className="summary-meta" style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            backgroundColor: '#e8f4f8',
            borderRadius: '4px',
            marginBottom: '1.5rem',
            fontSize: '0.9em',
            color: '#555'
          }}>
            <span>
              <strong>Generated:</strong> {new Date(summary.generatedAt).toLocaleString()}
            </span>
            <span>
              <strong>Model:</strong> {summary.model}
            </span>
            <span>
              <strong>Data:</strong> {summary.dataSnapshot.mutationCount} mutations, {' '}
              {summary.dataSnapshot.medicationCount} medications, {' '}
              {summary.dataSnapshot.paperCount} papers
            </span>
          </div>

          {/* Summary sections */}
          <div className="summary-sections">
            {formatSection(summary.summary).map((section, idx) => (
              <div key={idx} className="summary-section" style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ 
                  color: '#2c5282',
                  marginTop: 0,
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '2px solid #e2e8f0'
                }}>
                  {section.title}
                </h3>
                <div style={{ lineHeight: '1.7', color: '#333' }}>
                  {section.content.map((line, lineIdx) => {
                    // Check if it's a bullet point
                    if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                      return (
                        <div key={lineIdx} style={{ 
                          marginLeft: '1.5rem',
                          marginBottom: '0.5rem',
                          position: 'relative'
                        }}>
                          <span style={{ 
                            position: 'absolute',
                            left: '-1.5rem',
                            color: '#4299e1'
                          }}>•</span>
                          {line.replace(/^[-*]\s*/, '')}
                        </div>
                      );
                    }
                    
                    // Check if it's a bold term
                    const boldPattern = /\*\*(.*?)\*\*/g;
                    if (boldPattern.test(line)) {
                      const parts = line.split(boldPattern);
                      return (
                        <p key={lineIdx} style={{ marginBottom: '0.75rem' }}>
                          {parts.map((part, partIdx) => 
                            partIdx % 2 === 1 ? <strong key={partIdx}>{part}</strong> : part
                          )}
                        </p>
                      );
                    }
                    
                    return <p key={lineIdx} style={{ marginBottom: '0.75rem' }}>{line}</p>;
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="no-print" style={{ 
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#f7fafc',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Want to explore specific findings? Search your research library or dive into your genomics dashboard.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={generateSummary}
                style={{ minWidth: '140px' }}
              >
                🔄 Regenerate
              </button>
              <button
                onClick={handlePrint}
                style={{
                  minWidth: '140px',
                  backgroundColor: '#2c5282',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1.25rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                📄 Generate PDF
              </button>
            </div>
          </div>

          {/* Print-only footer */}
          <div className="print-footer" style={{ display: 'none' }}>
            <span>MyTreatmentPath — Healthcare Strategy Summary</span>
            <span>Generated: {summary ? new Date(summary.generatedAt).toLocaleDateString() : ''}</span>
            <span>Confidential — For personal use only</span>
          </div>
        </div>
      )}
    </div>
  );
}
