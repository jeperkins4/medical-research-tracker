import { useState, useEffect } from 'react';
import MutationDrugNetwork from './MutationDrugNetwork';
import MetastasisTutorial from './MetastasisTutorial';
import FoundationOneUploader from './FoundationOneUploader';
import * as api from '../api';

export default function PrecisionMedicineDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [selectedMutation, setSelectedMutation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('overview'); // overview, mutation-detail, network, tutorial, trials
  const [showUploader, setShowUploader] = useState(false);
  const [clinicalTrials, setClinicalTrials] = useState(null);
  const [trialsLoading, setTrialsLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const data = await api.getGenomicDashboard();
      setDashboard(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch genomic dashboard:', error);
      setLoading(false);
    }
  };

  const fetchClinicalTrials = async () => {
    if (clinicalTrials !== null) return; // already loaded
    setTrialsLoading(true);
    try {
      const data = await api.getClinicalTrials();
      setClinicalTrials(data || []);
    } catch (e) {
      console.error('Failed to load clinical trials:', e);
      setClinicalTrials([]);
    } finally {
      setTrialsLoading(false);
    }
  };

  const fetchMutationDetails = async (mutationId) => {
    try {
      const data = await api.getMutationDetails(mutationId);
      setSelectedMutation(data);
      setView('mutation-detail');
    } catch (error) {
      console.error('Failed to fetch mutation details:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading genomic data...</div>;
  }

  if (!dashboard || showUploader || dashboard.mutations?.length === 0) {
    return (
      <div className="p-8">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>🧬 Genomics Dashboard</h2>
          {dashboard && dashboard.mutations?.length > 0 && (
            <button
              onClick={() => setShowUploader(false)}
              style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
        <FoundationOneUploader onImported={() => { setShowUploader(false); fetchDashboard(); }} />
        {!dashboard && <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '16px' }}>No genomic data yet. Upload a Foundation One CDx report to get started.</p>}
      </div>
    );
  }

  const getVAFColor = (vaf) => {
    if (vaf >= 20) return 'text-red-600 font-bold';
    if (vaf >= 10) return 'text-orange-600 font-semibold';
    if (vaf >= 5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getEvidenceColor = (evidence) => {
    switch (evidence) {
      case 'FDA_approved': return 'bg-green-100 text-green-800 border-green-300';
      case 'Phase_3': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Phase_2': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Phase_1': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Preclinical': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-3xl font-bold mb-2">🧬 Precision Medicine Dashboard</h1>
          <p className="text-gray-600">
            Foundation One CDx Genomic Profile &amp; Treatment Opportunities
            <span style={{ color: '#94a3b8', marginLeft: '10px' }}>
              {dashboard.summary?.totalMutations} mutation{dashboard.summary?.totalMutations !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowUploader(true)}
          style={{
            padding: '8px 16px', background: '#6366f1', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, marginTop: '4px',
          }}
        >
          📄 Upload New Report
        </button>
      </div>

      {/* Navigation Button Group */}
      <div className="inline-flex rounded-lg shadow-sm mb-6" role="group">
        <button
          onClick={() => setView('overview')}
          className={`px-6 py-3 text-sm font-semibold transition-all ${
            view === 'overview'
              ? 'bg-blue-600 text-white shadow-md z-10'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          style={{
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            borderRight: view === 'overview' ? '1px solid #2563eb' : 'none'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setView('network')}
          className={`px-6 py-3 text-sm font-semibold transition-all ${
            view === 'network'
              ? 'bg-blue-600 text-white shadow-md z-10'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-t border-b border-gray-300'
          }`}
          style={{
            borderLeft: view === 'network' ? '1px solid #2563eb' : 'none',
            borderRight: view === 'network' ? '1px solid #2563eb' : 'none',
            marginLeft: view === 'network' ? '0' : '-1px'
          }}
        >
          Network
        </button>
        <button
          onClick={() => setView('tutorial')}
          className={`px-6 py-3 text-sm font-semibold transition-all ${
            view === 'tutorial'
              ? 'bg-blue-600 text-white shadow-md z-10'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-t border-b border-gray-300'
          }`}
          style={{
            borderLeft: view === 'tutorial' ? '1px solid #2563eb' : 'none',
            borderRight: view === 'tutorial' ? '1px solid #2563eb' : 'none',
            marginLeft: view === 'tutorial' ? '0' : '-1px'
          }}
        >
          🎓 Tutorial
        </button>
        <button
          onClick={() => { setView('trials'); fetchClinicalTrials(); }}
          className={`px-6 py-3 text-sm font-semibold transition-all ${
            view === 'trials'
              ? 'bg-blue-600 text-white shadow-md z-10'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          style={{
            borderTopRightRadius: '8px',
            borderBottomRightRadius: '8px',
            borderLeft: view === 'trials' ? '1px solid #2563eb' : 'none',
            marginLeft: view === 'trials' ? '0' : '-1px'
          }}
        >
          Clinical Trials
        </button>
      </div>

      {/* Overview Tab */}
      {view === 'overview' && (
        <>
          {/* Biomarkers Section */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(dashboard.biomarkers || []).map((biomarker) => (
              <div key={biomarker.id} className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-lg mb-2">{biomarker.biomarker_name}</h3>
                <div className="flex items-baseline space-x-2 mb-2">
                  <span className="text-2xl font-bold text-blue-600">{biomarker.result}</span>
                  {biomarker.numeric_value && (
                    <span className="text-gray-600">({biomarker.numeric_value} {biomarker.unit})</span>
                  )}
                </div>
                <p className="text-sm text-gray-700">{biomarker.clinical_significance}</p>
                {biomarker.notes && (
                  <p className="text-xs text-gray-500 mt-2">{biomarker.notes}</p>
                )}
              </div>
            ))}
          </div>

          {/* Genomic Mutations */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-6">Genomic Mutations</h2>
            <div className="space-y-6">
              {(dashboard.mutations || []).map((mutation) => (
                <div
                  key={mutation.id}
                  className="bg-white rounded-lg cursor-pointer"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => fetchMutationDetails(mutation.id)}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {mutation.gene} <span className="text-blue-600">{mutation.alteration}</span>
                      </h3>
                      <p className="text-sm text-gray-600">{mutation.transcript_id} • {mutation.coding_effect}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${getVAFColor(mutation.variant_allele_frequency)}`}>
                        {mutation.variant_allele_frequency}% VAF
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{mutation.mutation_type}</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed">{mutation.clinical_significance}</p>
                  
                  {mutation.notes && (
                    <div style={{
                      backgroundColor: '#fefce8',
                      border: '1px solid #fde047',
                      borderLeft: '3px solid #eab308',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '16px',
                      fontSize: '14px'
                    }}>
                      <strong>Note:</strong> {mutation.notes}
                    </div>
                  )}
                  
                  <div style={{
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '16px',
                    marginTop: '16px'
                  }}>
                    <div className="flex space-x-6 text-sm text-gray-600">
                      <span>🎯 {mutation.pathway_count} pathways affected</span>
                      <span>💊 {mutation.treatment_count} treatment options</span>
                      <span>🔬 {mutation.trial_count} active trials</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Treatment Opportunities */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-6">Treatment Opportunities</h2>
            <div className="space-y-6">
              {(dashboard.treatmentOpportunities || []).map((treatment) => (
                <div 
                  key={treatment.id} 
                  className="bg-white rounded-lg"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="font-bold text-lg mb-2">{treatment.therapy_name}</h3>
                      <p className="text-sm text-gray-600">
                        Targets: <span className="font-medium">{treatment.gene} {treatment.alteration}</span>
                        {treatment.variant_allele_frequency && (
                          <span className="ml-2">({treatment.variant_allele_frequency}% VAF)</span>
                        )}
                      </p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${getEvidenceColor(treatment.clinical_evidence)}`}>
                      {treatment.clinical_evidence.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#fafafa',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '12px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <p className="text-sm text-gray-700">
                      <strong className="text-purple-700">Mechanism:</strong> {treatment.mechanism}
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {treatment.evidence_description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Clinical Trials */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Top Priority Clinical Trials</h2>
            <div className="space-y-6">
              {(dashboard.topTrials || []).map((trial) => (
                <div 
                  key={trial.id} 
                  className="bg-white rounded-lg"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2">{trial.trial_name}</h3>
                      <div style={{
                        backgroundColor: '#fafafa',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        marginBottom: '12px',
                        border: '1px solid #f0f0f0'
                      }}>
                        <p className="text-sm text-gray-700">
                          <strong className="text-blue-700">Biomarker:</strong> {trial.target_biomarker} 
                          {trial.gene && ` (${trial.gene} ${trial.alteration})`}
                        </p>
                      </div>
                      <p className="text-sm text-gray-800 mb-4">
                        <strong className="text-purple-700">Agents:</strong> {trial.therapy_agents}
                      </p>
                    </div>
                    <div className="text-right ml-6 flex flex-col gap-2">
                      <div style={{
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '13px',
                        border: '1px solid #dbeafe'
                      }}>
                        {trial.phase}
                      </div>
                      <div style={{
                        backgroundColor: '#f0fdf4',
                        color: '#166534',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '12px',
                        border: '1px solid #dcfce7'
                      }}>
                        Priority: {trial.priority_score}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '16px',
                    marginTop: '16px'
                  }}>
                    <p className="text-sm text-gray-700 mb-4 leading-relaxed">{trial.eligibility_notes}</p>
                    
                    <p style={{
                      backgroundColor: '#f9fafb',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#4b5563',
                      borderLeft: '3px solid #3b82f6'
                    }}>
                      <strong style={{ color: '#1f2937' }}>📍 Locations:</strong> {trial.locations}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mutation Detail View */}
      {view === 'mutation-detail' && selectedMutation && (
        <div>
          <button
            onClick={() => { setView('overview'); setSelectedMutation(null); }}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Back to Overview
          </button>
          
          <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-md mb-6">
            <h2 className="text-3xl font-bold mb-2">
              {selectedMutation.mutation.gene} <span className="text-blue-600">{selectedMutation.mutation.alteration}</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <strong>Transcript:</strong> {selectedMutation.mutation.transcript_id}
              </div>
              <div>
                <strong>Coding Effect:</strong> {selectedMutation.mutation.coding_effect}
              </div>
              <div>
                <strong>VAF:</strong> <span className={getVAFColor(selectedMutation.mutation.variant_allele_frequency)}>
                  {selectedMutation.mutation.variant_allele_frequency}%
                </span>
              </div>
              <div>
                <strong>Type:</strong> {selectedMutation.mutation.mutation_type}
              </div>
            </div>
            <p className="text-gray-700 mb-2">{selectedMutation.mutation.clinical_significance}</p>
            {selectedMutation.mutation.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <strong>Note:</strong> {selectedMutation.mutation.notes}
              </div>
            )}
          </div>

          {/* Affected Pathways */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-6">Affected Biological Pathways</h3>
            <div className="space-y-6">
              {(selectedMutation.pathways || []).map((pathway) => (
                <div 
                  key={pathway.id} 
                  className="bg-white rounded-lg"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex justify-between items-start mb-5">
                    <h4 className="font-bold text-lg">{pathway.name}</h4>
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      ...( pathway.impact_level === 'high' ? { backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } :
                      pathway.impact_level === 'medium' ? { backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' } :
                      { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' })
                    }}>
                      {pathway.impact_level} impact
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed">{pathway.description}</p>
                  <div style={{
                    backgroundColor: '#fafafa',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '12px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <p className="text-sm text-gray-700">
                      <strong className="text-purple-700">Mechanism:</strong> {pathway.mechanism}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    <strong>Cancer Relevance:</strong> {pathway.cancer_relevance}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Targeted Treatments */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-6">Targeted Treatment Options</h3>
            <div className="space-y-6">
              {(selectedMutation.treatments || []).map((treatment) => (
                <div
                  key={treatment.id}
                  className="rounded-lg"
                  style={{
                    backgroundColor: treatment.sensitivity_or_resistance === 'sensitivity' ? '#f0fdf4' : '#fef2f2',
                    border: treatment.sensitivity_or_resistance === 'sensitivity' ? '1px solid #86efac' : '1px solid #fecaca',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h4 className="font-bold text-lg mb-2">{treatment.therapy_name}</h4>
                      <p className="text-sm text-gray-600">{treatment.therapy_type.replace('_', ' ')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${getEvidenceColor(treatment.clinical_evidence)}`}>
                        {treatment.clinical_evidence.replace('_', ' ')}
                      </span>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        ...( treatment.sensitivity_or_resistance === 'sensitivity'
                          ? { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' }
                          : { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' })
                      }}>
                        {treatment.sensitivity_or_resistance}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <p className="text-sm text-gray-700">
                      <strong className="text-purple-700">Mechanism:</strong> {treatment.mechanism}
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                    {treatment.evidence_description}
                  </p>
                  
                  {treatment.evidence_references && (
                    <p className="text-xs text-gray-500">
                      <strong>Source:</strong> {treatment.evidence_references}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Trials */}
          {(selectedMutation.trials || []).length > 0 && (
            <div>
              <h3 className="text-2xl font-bold mb-6">Matched Clinical Trials</h3>
              <div className="space-y-6">
                {(selectedMutation.trials || []).map((trial) => (
                  <div 
                    key={trial.id} 
                    className="bg-white rounded-lg"
                    style={{
                      border: '1px solid #e5e7eb',
                      padding: '20px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div className="flex justify-between items-start mb-5">
                      <h4 className="font-bold text-lg flex-1 mb-2">{trial.trial_name}</h4>
                      <div className="ml-6 flex flex-col gap-2">
                        <div style={{
                          backgroundColor: '#eff6ff',
                          color: '#1e40af',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '13px',
                          border: '1px solid #dbeafe'
                        }}>
                          {trial.phase}
                        </div>
                        <div style={{
                          backgroundColor: '#f0fdf4',
                          color: '#166534',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '12px',
                          border: '1px solid #dcfce7',
                          textAlign: 'center'
                        }}>
                          Priority {trial.priority_score}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-800 mb-4">
                      <strong className="text-purple-700">Agents:</strong> {trial.therapy_agents}
                    </p>
                    
                    <div style={{
                      borderTop: '1px solid #f3f4f6',
                      paddingTop: '16px',
                      marginTop: '16px'
                    }}>
                      <p className="text-sm text-gray-700 mb-4 leading-relaxed">{trial.eligibility_notes}</p>
                      
                      <p style={{
                        backgroundColor: '#f9fafb',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#4b5563',
                        borderLeft: '3px solid #3b82f6'
                      }}>
                        <strong style={{ color: '#1f2937' }}>📍 Locations:</strong> {trial.locations}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mutation-Drug Network Tab */}
      {view === 'network' && (
        <div className="min-h-screen">
          <MutationDrugNetwork />
        </div>
      )}

      {/* Tutorial Tab */}
      {view === 'tutorial' && (
        <div className="min-h-screen">
          <MetastasisTutorial />
        </div>
      )}

      {/* Trials Tab */}
      {view === 'trials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '20px', color: '#1e293b' }}>🔬 Clinical Trials Matched to Your Mutations</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                Active and recruiting trials from ClinicalTrials.gov — searched automatically after your last genomic import
              </p>
            </div>
            <button
              onClick={() => { setClinicalTrials(null); fetchClinicalTrials(); }}
              style={{ padding: '7px 14px', fontSize: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '7px', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600 }}
            >
              ↻ Refresh
            </button>
          </div>

          {trialsLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <style>{`@keyframes ts{to{transform:rotate(360deg)}} .ts{width:36px;height:36px;border:3px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;animation:ts 0.9s linear infinite;margin:0 auto 12px}`}</style>
              <div className="ts" />
              Searching ClinicalTrials.gov for your mutations…
            </div>
          )}

          {!trialsLoading && clinicalTrials !== null && clinicalTrials.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔬</div>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>No matched trials found yet</div>
              <div style={{ fontSize: '13px' }}>Upload a Foundation One CDx report — trials are searched automatically after import.</div>
            </div>
          )}

          {!trialsLoading && (clinicalTrials || []).map((trial) => {
            const statusColor = trial.status?.includes('RECRUIT') ? { bg: '#dcfce7', text: '#166534', border: '#86efac' }
                              : trial.status?.includes('ACTIVE') ? { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' }
                              : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
            const sourceLabel = trial.nct_id ? 'ClinicalTrials.gov' : (trial.source || 'Web');
            return (
              <div key={trial.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', marginBottom: '14px', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '6px', lineHeight: 1.4 }}>
                      {trial.title}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {trial.matched_genes && trial.matched_genes.split(',').map(g => (
                        <span key={g} style={{ padding: '2px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '99px', fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>{g.trim()}</span>
                      ))}
                      {trial.nct_id && <span style={{ padding: '2px 8px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '99px', fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>{trial.nct_id}</span>}
                      <span style={{ padding: '2px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '99px', fontSize: '11px', color: '#64748b' }}>{sourceLabel}</span>
                    </div>
                    {trial.conditions && <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}><strong>Conditions:</strong> {trial.conditions}</div>}
                    {trial.interventions && <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}><strong>Interventions:</strong> {trial.interventions}</div>}
                    {trial.locations && <div style={{ fontSize: '12px', color: '#475569' }}>📍 {trial.locations}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                    {trial.status && (
                      <span style={{ padding: '4px 10px', background: statusColor.bg, border: `1px solid ${statusColor.border}`, borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: statusColor.text, whiteSpace: 'nowrap' }}>
                        {trial.status.replace(/_/g, ' ')}
                      </span>
                    )}
                    {trial.phase && <span style={{ padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#1d4ed8' }}>{trial.phase}</span>}
                    {trial.url && (
                      <a href={trial.url} target="_blank" rel="noreferrer" style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', fontSize: '12px', color: '#0369a1' }}>
            💡 Trials are matched by gene name from your Foundation One CDx report. Always discuss eligibility with your oncologist before applying.
          </div>
        </div>
      )}
    </div>
  );
}
