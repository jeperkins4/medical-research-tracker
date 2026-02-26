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
        <div className="summary-content">
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
          <div style={{ 
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
