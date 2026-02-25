/**
 * Medication & Supplement Manager
 * Add, edit, delete prescription drugs and supplements with research evidence
 */

import { useState, useEffect } from 'react';
import './MedicationManager.css';
import medicationEvidence from '../medicationEvidence';

// Evaluated as a getter so it's always current (guards against preload timing edge cases)
const getIsElectron = () => typeof window !== 'undefined' && !!window?.electron?.db;

export default function MedicationManager({ apiFetch }) {
  const [medications, setMedications] = useState([]);
  const [editingMed, setEditingMed] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, prescription, supplement
  const [selectedMed, setSelectedMed] = useState(null); // For viewing evidence

  // Form state with persistence
  const getInitialFormData = () => {
    // Try to restore from sessionStorage (survives tab switches)
    const saved = sessionStorage.getItem('medicationFormData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to parse saved form data:', err);
      }
    }
    
    // Default empty form
    return {
      name: '',
      type: 'supplement',
      category: '',
      dosage: '',
      frequency: '',
      route: 'oral',
      started_date: new Date().toISOString().split('T')[0],
      stopped_date: '',
      active: true,
      reason: '',
      prescribed_by: '',
      notes: '',
      effectiveness_rating: null
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);

  useEffect(() => {
    fetchMedications();
    
    // Restore showAddForm state if there was unsaved data
    const saved = sessionStorage.getItem('medicationFormData');
    if (saved) {
      setShowAddForm(true);
    }
  }, []);

  // Save form data to sessionStorage whenever it changes (survives tab switches)
  useEffect(() => {
    if (showAddForm && (formData.name || formData.dosage || formData.notes)) {
      sessionStorage.setItem('medicationFormData', JSON.stringify(formData));
    }
  }, [formData, showAddForm]);

  const fetchMedications = async () => {
    try {
      if (getIsElectron()) {
        const result = await window.electron.db.getMedications();
        if (result.success) setMedications(result.medications || []);
        else console.error('Failed to fetch medications (IPC):', result.error);
      } else {
        const res = await apiFetch('/api/medications');
        if (res.ok) {
          const data = await res.json();
          setMedications(data.medications || []);
        } else if (res.status === 401) {
          console.warn('[MedicationManager] 401 on fetchMedications — session expired or no auth cookie');
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Failed to fetch medications:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Check if this medication has evidence data we can auto-populate
      const evidence = medicationEvidence[formData.name];
      
      const medData = {
        ...formData,
        // Auto-populate from evidence database if available
        mechanism: evidence?.mechanism || formData.mechanism,
        target_pathways: evidence?.targetPathways ? JSON.stringify(evidence.targetPathways) : null,
        genomic_alignment: evidence?.genomicAlignment || null,
        evidence_strength: evidence?.strength || null,
        recommended_dosing: evidence?.dosing || formData.recommended_dosing,
        precautions: evidence?.precautions || formData.precautions
      };

      if (getIsElectron()) {
        let result;
        if (editingMed) {
          result = await window.electron.db.updateMedication(editingMed.id, medData);
        } else {
          result = await window.electron.db.addMedication(medData);
        }

        if (result.success) {
          // Auto-add research articles for new medications with evidence
          if (!editingMed && evidence?.research && result.id) {
            for (const article of evidence.research) {
              await window.electron.db.addMedicationResearch({
                medication_id: result.id,
                title: article.title,
                url: article.url,
                publication_year: article.year,
                key_findings: article.summary,
                article_type: 'supporting',
                evidence_quality: 'high'
              });
            }
          }
          resetForm();
          fetchMedications();
        } else {
          alert(`Error: ${result.error}`);
        }
      } else {
        const url = editingMed 
          ? `/api/medications/${editingMed.id}`
          : '/api/medications';
        
        const method = editingMed ? 'PUT' : 'POST';
        
        const res = await apiFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(medData)
        });

        if (res.ok) {
          if (!editingMed && evidence?.research) {
            const resData = await res.json();
            const newMedId = resData.id;
            for (const article of evidence.research) {
              await apiFetch('/api/medications/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  medication_id: newMedId,
                  title: article.title,
                  url: article.url,
                  publication_year: article.year,
                  key_findings: article.summary,
                  article_type: 'supporting',
                  evidence_quality: 'high'
                })
              });
            }
          }
          resetForm();
          fetchMedications();
        } else {
          const error = await res.json();
          if (res.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.reload();
          } else {
            alert(`Error: ${error.error}`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save medication:', err);
      alert('Failed to save medication');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this medication?')) return;

    try {
      if (getIsElectron()) {
        const result = await window.electron.db.deleteMedication(id);
        if (result.success) fetchMedications();
        else console.error('Failed to delete medication (IPC):', result.error);
      } else {
        const res = await apiFetch(`/api/medications/${id}`, { method: 'DELETE' });
        if (res.ok) fetchMedications();
      }
    } catch (err) {
      console.error('Failed to delete medication:', err);
    }
  };

  const handleEdit = (med) => {
    setEditingMed(med);
    setFormData({
      name: med.name || '',
      type: med.type || 'supplement',
      category: med.category || '',
      dosage: med.dosage || '',
      frequency: med.frequency || '',
      route: med.route || 'oral',
      started_date: med.started_date || new Date().toISOString().split('T')[0],
      stopped_date: med.stopped_date || '',
      active: med.active !== undefined ? med.active : true,
      reason: med.reason || '',
      prescribed_by: med.prescribed_by || '',
      notes: med.notes || '',
      effectiveness_rating: med.effectiveness_rating || null
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'supplement',
      category: '',
      dosage: '',
      frequency: '',
      route: 'oral',
      started_date: new Date().toISOString().split('T')[0],
      stopped_date: '',
      active: true,
      reason: '',
      prescribed_by: '',
      notes: '',
      effectiveness_rating: null
    });
    setEditingMed(null);
    setShowAddForm(false);
    // Clear saved form data from sessionStorage
    sessionStorage.removeItem('medicationFormData');
  };

  const viewEvidence = async (med) => {
    try {
      if (getIsElectron()) {
        const result = await window.electron.db.getMedicationResearch(med.id);
        setSelectedMed({ ...med, research: result.success ? (result.articles || []) : [] });
      } else {
        const res = await apiFetch(`/api/medications/${med.id}/research`);
        if (res.ok) {
          const data = await res.json();
          setSelectedMed({ ...med, research: data.articles || [] });
        } else {
          setSelectedMed({ ...med, research: [] });
        }
      }
    } catch (err) {
      console.error('Failed to fetch research:', err);
      setSelectedMed({ ...med, research: [] });
    }
  };

  const filteredMedications = medications.filter(med => {
    if (filterType === 'all') return true;
    return med.type === filterType;
  });

  // Quick-add from evidence database
  const quickAddOptions = Object.keys(medicationEvidence).filter(name => 
    !medications.find(m => m.name === name)
  );

  return (
    <div className="medication-manager">
      <div className="medication-manager-header">
        <h2>💊 Medications & Supplements</h2>
        <div className="header-actions">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All ({medications.length})</option>
            <option value="prescription">
              Prescription ({medications.filter(m => m.type === 'prescription').length})
            </option>
            <option value="supplement">
              Supplements ({medications.filter(m => m.type === 'supplement').length})
            </option>
          </select>
          
          <button 
            onClick={() => showAddForm ? resetForm() : setShowAddForm(true)}
            className="btn-add"
          >
            {showAddForm ? '✕ Cancel' : '+ Add Medication/Supplement'}
          </button>
        </div>
      </div>

      {/* Quick Add from Evidence Database */}
      {!showAddForm && quickAddOptions.length > 0 && (
        <div className="quick-add-section">
          <h3>📚 Quick Add (From Evidence Database)</h3>
          <div className="quick-add-options">
            {quickAddOptions.slice(0, 6).map(name => (
              <button
                key={name}
                onClick={() => {
                  setFormData({ ...formData, name });
                  setShowAddForm(true);
                }}
                className="quick-add-btn"
                title={`${medicationEvidence[name].strength} - Click to add`}
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
        >
        <form onSubmit={handleSubmit} className="medication-form" style={{
          position: 'relative', maxHeight: '90vh', overflowY: 'auto',
          width: '100%', maxWidth: 680, borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)'
        }}>

          {/* Modal header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {editingMed ? `✏️ Edit — ${editingMed.name}` : '➕ Add Medication / Supplement'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: '#64748b', lineHeight: 1,
                padding: '4px 8px', borderRadius: 6,
              }}
              title="Close"
            >✕</button>
          </div>

          {/* Restore notice */}
          {!editingMed && sessionStorage.getItem('medicationFormData') && (
            <div className="restored-notice" style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              padding: '8px 12px',
              marginBottom: '16px',
              fontSize: '14px',
              color: '#856404'
            }}>
              💾 Your unsaved changes were restored. Click ✕ to discard.
            </div>
          )}
          
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                list="evidence-suggestions"
                placeholder="Start typing..."
              />
              <datalist id="evidence-suggestions">
                {Object.keys(medicationEvidence).map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label>Type *</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="supplement">Supplement</option>
                <option value="prescription">Prescription</option>
                <option value="otc">Over-the-Counter</option>
                <option value="integrative">Integrative</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Dosage</label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="e.g., 500mg, 1 tablet"
              />
            </div>

            <div className="form-group">
              <label>Frequency</label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                placeholder="e.g., Daily, Twice daily, As needed"
              />
            </div>

            <div className="form-group">
              <label>Route</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
              >
                <option value="oral">Oral</option>
                <option value="IV">IV Infusion</option>
                <option value="topical">Topical</option>
                <option value="sublingual">Sublingual</option>
                <option value="injection">Injection</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Started</label>
              <input
                type="date"
                value={formData.started_date}
                onChange={(e) => setFormData({ ...formData, started_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Stopped</label>
              <input
                type="date"
                value={formData.stopped_date}
                onChange={(e) => setFormData({ ...formData, stopped_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                Currently Active
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Reason / Indication</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Why taking this medication"
            />
          </div>

          <div className="form-group">
            <label>Prescribed By</label>
            <input
              type="text"
              value={formData.prescribed_by}
              onChange={(e) => setFormData({ ...formData, prescribed_by: e.target.value })}
              placeholder="Doctor name"
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Personal notes, side effects, effectiveness..."
            />
          </div>

          {medicationEvidence[formData.name] && (
            <div className="evidence-preview">
              <h4>📊 Evidence Available</h4>
              <p><strong>Strength:</strong> {medicationEvidence[formData.name].strength}</p>
              <p><strong>Target Pathways:</strong> {medicationEvidence[formData.name].targetPathways.join(', ')}</p>
              <p><strong>Research Articles:</strong> {medicationEvidence[formData.name].research.length} studies will be added automatically</p>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingMed ? 'Update' : 'Add'} Medication
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
        </div>
      )}

      {/* Medications List */}
      <div className="medications-list">
        {filteredMedications.length === 0 && (
          <div className="empty-state">
            <p>No {filterType === 'all' ? '' : filterType} medications added yet.</p>
            <button onClick={() => setShowAddForm(true)} className="btn-add">
              + Add Your First Medication
            </button>
          </div>
        )}

        {filteredMedications.map(med => (
          <div key={med.id} className={`medication-card ${!med.active ? 'inactive' : ''}`}>
            <div className="medication-header">
              <h3>
                {med.name}
                {!med.active && <span className="badge inactive-badge">Stopped</span>}
              </h3>
              <span className={`type-badge ${med.type}`}>
                {med.type}
              </span>
            </div>

            <div className="medication-details">
              {med.dosage && <p><strong>Dosage:</strong> {med.dosage}</p>}
              {med.frequency && <p><strong>Frequency:</strong> {med.frequency}</p>}
              {med.started_date && <p><strong>Started:</strong> {new Date(med.started_date).toLocaleDateString()}</p>}
              {med.stopped_date && <p><strong>Stopped:</strong> {new Date(med.stopped_date).toLocaleDateString()}</p>}
              {med.reason && <p><strong>Reason:</strong> {med.reason}</p>}
              {med.prescribed_by && <p><strong>Prescribed by:</strong> {med.prescribed_by}</p>}
              {med.notes && <p><strong>Notes:</strong> {med.notes}</p>}
            </div>

            <div className="medication-actions">
              <button onClick={() => viewEvidence(med)} className="btn-evidence">
                📚 View Research
              </button>
              <button onClick={() => handleEdit(med)} className="btn-edit">
                ✏️ Edit
              </button>
              <button onClick={() => handleDelete(med.id)} className="btn-delete">
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Evidence Modal */}
      {selectedMed && (
        <div className="evidence-modal-overlay" onClick={() => setSelectedMed(null)}>
          <div className="evidence-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📚 Research Evidence: {selectedMed.name}</h2>
              <button onClick={() => setSelectedMed(null)} className="close-btn">✕</button>
            </div>

            <div className="modal-content">
              {selectedMed.evidence_strength && (
                <div className="evidence-summary">
                  <p><strong>Evidence Strength:</strong> {selectedMed.evidence_strength}</p>
                  {selectedMed.target_pathways && (
                    <p><strong>Target Pathways:</strong> {JSON.parse(selectedMed.target_pathways).join(', ')}</p>
                  )}
                  {selectedMed.genomic_alignment && (
                    <div className="genomic-alignment">
                      <strong>🎯 Genomic Alignment:</strong>
                      <p>{selectedMed.genomic_alignment}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedMed.research && selectedMed.research.length > 0 ? (
                <div className="research-articles">
                  <h3>Research Articles ({selectedMed.research.length})</h3>
                  {selectedMed.research.map((article, idx) => (
                    <div key={idx} className="research-article">
                      <h4>
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          {article.title}
                        </a>
                      </h4>
                      {article.publication_year && <p className="year">({article.publication_year})</p>}
                      {article.key_findings && <p>{article.key_findings}</p>}
                      {article.article_type && (
                        <span className={`article-type-badge ${article.article_type}`}>
                          {article.article_type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No research articles linked yet. Click "Add Research Article" to add supporting evidence or warnings.</p>
              )}

              <button 
                onClick={() => alert('Research article form coming soon')} 
                className="btn-add-research"
              >
                + Add Research Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
