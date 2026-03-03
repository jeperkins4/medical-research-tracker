/**
 * CancerProfileSelector
 * Lets the user pick their cancer type; persists via CancerProfileContext.
 * Drop this anywhere — currently placed in the Settings sub-tab.
 */

import { useCancerProfile } from '../contexts/CancerProfileContext';

const EMOJI = {
  urothelial_carcinoma: '🫧',
  breast_cancer: '🎗️',
  lung_nsclc: '🫁',
  colorectal_cancer: '🔵',
};

export default function CancerProfileSelector() {
  const { profileId, profiles, selectProfile, profile } = useCancerProfile();

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: 15 }}>
        🎯 Cancer Profile
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
        Selecting your cancer type tailors biomarker labels, research terms, and genomic
        normalizer hints throughout the app. Your selection is saved locally.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {profiles.map((p) => {
          const active = p.id === profileId;
          return (
            <button
              key={p.id}
              onClick={() => selectProfile(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '20px',
                border: active ? '2px solid #0369a1' : '2px solid #e2e8f0',
                background: active ? '#e0f2fe' : '#f8fafc',
                color: active ? '#0369a1' : '#475569',
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span>{EMOJI[p.id] || '🔬'}</span>
              {p.label}
              {active && <span style={{ marginLeft: 2 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {profile && (
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 8,
          fontSize: 13,
          color: '#0c4a6e',
        }}>
          <strong>Key biomarkers tracked:</strong>{' '}
          {profile.keyBiomarkers.join(', ')}
        </div>
      )}
    </div>
  );
}
