import React from 'react';
import './MedicationEvidenceModal.css';

export default function MedicationEvidenceModal({ medication, evidence, onClose }) {
  if (!evidence) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content evidence-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{medication.name}</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>No research evidence available for this medication/supplement.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content evidence-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{medication.name}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Evidence Strength Badge */}
          <div className={`evidence-badge ${evidence.strength.toLowerCase().replace(/\s+/g, '-')}`}>
            {evidence.strength}
          </div>

          {/* Current Dosing */}
          <div className="evidence-section">
            <h3>Current Regimen</h3>
            <p><strong>Dose:</strong> {medication.dosage || 'Not specified'}</p>
            <p><strong>Frequency:</strong> {medication.frequency || 'Not specified'}</p>
            {medication.notes && (
              <div className="medication-notes">
                <strong>Notes:</strong> {medication.notes}
              </div>
            )}
          </div>

          {/* Target Pathways */}
          {evidence.targetPathways && evidence.targetPathways.length > 0 && (
            <div className="evidence-section">
              <h3>🎯 Target Pathways</h3>
              <div className="pathway-tags">
                {evidence.targetPathways.map((pathway, idx) => (
                  <span key={idx} className="pathway-tag">{pathway}</span>
                ))}
              </div>
            </div>
          )}

          {/* Mechanism */}
          <div className="evidence-section">
            <h3>⚙️ Mechanism of Action</h3>
            <p>{evidence.mechanism}</p>
          </div>

          {/* Genomic Alignment */}
          {evidence.genomicAlignment && (
            <div className="evidence-section genomic-alignment">
              <h3>🧬 Genomic Profile Alignment</h3>
              <p>{evidence.genomicAlignment}</p>
            </div>
          )}

          {/* Research Studies */}
          {evidence.research && evidence.research.length > 0 && (
            <div className="evidence-section">
              <h3>📚 Research Evidence</h3>
              <div className="research-list">
                {evidence.research.map((study, idx) => (
                  <div key={idx} className="research-item">
                    <h4>{study.title}</h4>
                    <p>{study.summary}</p>
                    <div className="research-meta">
                      <span className="research-year">{study.year}</span>
                      {study.url && (
                        <a href={study.url} target="_blank" rel="noopener noreferrer">
                          View Study →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Dosing */}
          {evidence.dosing && (
            <div className="evidence-section">
              <h3>💊 Evidence-Based Dosing</h3>
              <p>{evidence.dosing}</p>
            </div>
          )}

          {/* Precautions */}
          {evidence.precautions && (
            <div className="evidence-section precautions">
              <h3>⚠️ Precautions & Monitoring</h3>
              <p>{evidence.precautions}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
