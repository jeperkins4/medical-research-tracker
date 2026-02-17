import { useState, useEffect } from 'react';
import './App.css';
import Login from './Login';
import PrecisionMedicineDashboard from './components/PrecisionMedicineDashboard';
import ResearchSearch from './components/ResearchSearch';
import HealthcareSummary from './components/HealthcareSummary';
import PortalManager from './components/PortalManager';
import BoneHealthTracker from './components/BoneHealthTracker';
import NutritionTracker from './components/NutritionTracker';
import MedicationEvidenceModal from './components/MedicationEvidenceModal';
import medicationEvidence from './medicationEvidence';

// Helper to make authenticated API calls
const apiFetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};

function App() {
  const [health, setHealth] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [authenticated, setAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if setup is needed
      const setupRes = await apiFetch('/api/auth/needs-setup', {
        credentials: 'include'
      });
      const setupData = await setupRes.json();
      
      if (setupData.needsSetup) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      // Check authentication
      const authRes = await apiFetch('/api/auth/check', {
        credentials: 'include'
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        setAuthenticated(true);
        setUsername(authData.username);
        
        // Fetch health status
        const healthRes = await apiFetch('/api/health');
        const healthData = await healthRes.json();
        setHealth(healthData);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user) => {
    console.log('[App] Login successful, user:', user);
    setUsername(user);
    setAuthenticated(true);
    setNeedsSetup(false);
    
    // Try to fetch health status (will fail if backend not authenticated, but that's OK for now)
    apiFetch('/api/health')
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          console.log('[App] Backend API not authenticated (expected with Supabase login)');
          // Set a basic health status for cloud-only mode
          return { status: 'cloud', message: 'Using cloud authentication' };
        }
      })
      .then(data => {
        console.log('[App] Health status:', data);
        setHealth(data);
      })
      .catch(err => {
        console.log('[App] API connection failed (expected with Supabase-only login):', err.message);
        // Set a basic health status even if backend fails
        setHealth({ status: 'cloud', message: 'Cloud mode - local backend unavailable' });
      });
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setAuthenticated(false);
    setUsername('');
    setHealth(null);
  };

  if (loading) {
    return (
      <div className="app">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} needsSetup={needsSetup} />;
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>🏥 Medical Research Tracker</h1>
          <p>Personal health records + research discovery</p>
        </div>
        <div className="header-actions">
          {health && <span className="status">● Connected</span>}
          <span className="username">Logged in as {username}</span>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      <nav>
        <button 
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          📋 Overview
        </button>
        <button 
          className={activeTab === 'genomics' ? 'active' : ''}
          onClick={() => setActiveTab('genomics')}
        >
          🧬 Genomics
        </button>
        <button 
          className={activeTab === 'treatment' ? 'active' : ''}
          onClick={() => setActiveTab('treatment')}
        >
          💊 Treatment
        </button>
        <button 
          className={activeTab === 'research' ? 'active' : ''}
          onClick={() => setActiveTab('research')}
        >
          📚 Research
        </button>
        <button 
          className={activeTab === 'summary' ? 'active' : ''}
          onClick={() => setActiveTab('summary')}
        >
          🧠 Strategy
        </button>
        <button 
          className={activeTab === 'portals' ? 'active' : ''}
          onClick={() => setActiveTab('portals')}
        >
          🔐 Portals
        </button>
      </nav>

      <main>
        {activeTab === 'profile' && <OverviewView />}
        {activeTab === 'genomics' && <PrecisionMedicineDashboard />}
        {activeTab === 'treatment' && <TreatmentView />}
        {activeTab === 'research' && <ResearchView />}
        {activeTab === 'summary' && <HealthcareSummary />}
        {activeTab === 'portals' && <PortalManager />}
      </main>
    </div>
  );
}

function TestResultsView() {
  const [tests, setTests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('byDate'); // 'byDate' or 'trends'

  useEffect(() => {
    apiFetch('/api/tests')
      .then(r => r.json())
      .then(data => {
        setTests(data);
        if (data.length > 0 && !selectedDate) {
          // Auto-select most recent date
          const dates = [...new Set(data.map(t => t.date))].sort().reverse();
          setSelectedDate(dates[0]);
        }
      });
  }, []);

  // Group tests by date
  const testsByDate = tests.reduce((acc, test) => {
    if (!acc[test.date]) acc[test.date] = [];
    acc[test.date].push(test);
    return acc;
  }, {});

  const dates = Object.keys(testsByDate).sort().reverse();

  // Key metrics for trend tracking
  const keyMetrics = [
    'Hemoglobin (Hgb)',
    'MCHC',
    'Glucose',
    'Eosinophils %',
    'Immature Granulocytes %',
    'Lymphocytes #',
    'Alkaline Phosphatase',
    'HgbA1C',
    'TSH (Thyroid Stimulating Hormone)'
  ];

  // Get trend data for a specific test
  const getTrendData = (testName) => {
    return tests
      .filter(t => t.test_name === testName)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => ({
        date: t.date,
        result: t.result,
        isAbnormal: /HIGH|LOW|High|Low/.test(t.result)
      }));
  };

  const isAbnormal = (result) => /HIGH|LOW|High|Low/.test(result);

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Laboratory Results</h2>
        <div className="view-toggle">
          <button
            className={viewMode === 'byDate' ? 'active' : ''}
            onClick={() => setViewMode('byDate')}
          >
            By Date
          </button>
          <button
            className={viewMode === 'trends' ? 'active' : ''}
            onClick={() => setViewMode('trends')}
          >
            Trends
          </button>
        </div>
      </div>

      {viewMode === 'byDate' && (
        <div className="test-results-container">
          <div className="date-selector">
            <h3>Test Dates</h3>
            {dates.map(date => (
              <button
                key={date}
                className={`date-button ${selectedDate === date ? 'active' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="date-label">{new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}</div>
                <div className="date-count">{testsByDate[date].length} tests</div>
                {testsByDate[date].some(t => isAbnormal(t.result)) && (
                  <span className="abnormal-indicator">⚠️</span>
                )}
              </button>
            ))}
          </div>

          {selectedDate && (
            <div className="test-results-panel">
              <h3>Results from {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</h3>
              
              {testsByDate[selectedDate]
                .sort((a, b) => a.test_name.localeCompare(b.test_name))
                .map(test => (
                  <div key={test.id} className={`test-result-card ${isAbnormal(test.result) ? 'abnormal' : ''}`}>
                    <div className="test-header">
                      <h4>{test.test_name}</h4>
                      {isAbnormal(test.result) && <span className="flag">⚠️</span>}
                    </div>
                    <div className="test-result">{test.result}</div>
                    {test.notes && <div className="test-notes">{test.notes}</div>}
                    {test.provider && <div className="test-provider">{test.provider}</div>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'trends' && (
        <div className="trends-container">
          <h3>Key Metric Trends</h3>
          <p className="trends-subtitle">Tracking critical values over time</p>
          
          {keyMetrics.map(metricName => {
            const trendData = getTrendData(metricName);
            if (trendData.length === 0) return null;

            return (
              <div key={metricName} className="trend-card">
                <h4>{metricName}</h4>
                <div className="trend-timeline">
                  {trendData.map((point, idx) => (
                    <div key={idx} className={`trend-point ${point.isAbnormal ? 'abnormal' : ''}`}>
                      <div className="trend-date">{new Date(point.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}</div>
                      <div className="trend-value">{point.result.split('(')[0].trim()}</div>
                      {point.isAbnormal && <span className="trend-flag">⚠️</span>}
                    </div>
                  ))}
                </div>
                {trendData.every(p => p.isAbnormal) && trendData.length > 1 && (
                  <div className="trend-alert">
                    ⚠️ Persistent abnormality - {trendData.length} consecutive results out of range
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PatientView() {
  const [profile, setProfile] = useState({});
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    apiFetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setFormData(data);
      });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    loadProfile();
    setEditing(false);
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null;
    return ((weight / (height * height)) * 703).toFixed(1);
  };

  if (!editing && Object.keys(profile).length === 0) {
    return (
      <div className="view">
        <h2>Patient Information</h2>
        <div className="empty-profile">
          <p>No patient information on file.</p>
          <button onClick={() => setEditing(true)}>+ Add Patient Information</button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="view">
        <h2>Patient Information</h2>
        <form className="patient-form" onSubmit={handleSave}>
          <fieldset>
            <legend>Personal Information</legend>
            <div className="form-grid">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth || ''}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Sex</label>
                <select name="sex" value={formData.sex || ''} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Blood Type</label>
                <select name="blood_type" value={formData.blood_type || ''} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Physical Characteristics</legend>
            <div className="form-grid">
              <div className="form-group">
                <label>Height (inches)</label>
                <input
                  type="number"
                  step="0.5"
                  name="height_inches"
                  value={formData.height_inches || ''}
                  onChange={handleChange}
                  placeholder="70"
                />
              </div>
              <div className="form-group">
                <label>Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  name="weight_lbs"
                  value={formData.weight_lbs || ''}
                  onChange={handleChange}
                  placeholder="170"
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Medical Information</legend>
            <div className="form-group">
              <label>Allergies</label>
              <textarea
                name="allergies"
                value={formData.allergies || ''}
                onChange={handleChange}
                rows="2"
                placeholder="List any known allergies..."
              />
            </div>
            <div className="form-group">
              <label>Primary Physician</label>
              <input
                type="text"
                name="primary_physician"
                value={formData.primary_physician || ''}
                onChange={handleChange}
                placeholder="Dr. Name, Practice Name"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Emergency Contact</legend>
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name || ''}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone || ''}
                  onChange={handleChange}
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Insurance</legend>
            <div className="form-grid">
              <div className="form-group">
                <label>Provider</label>
                <input
                  type="text"
                  name="insurance_provider"
                  value={formData.insurance_provider || ''}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Member ID</label>
                <input
                  type="text"
                  name="insurance_id"
                  value={formData.insurance_id || ''}
                  onChange={handleChange}
                />
              </div>
            </div>
          </fieldset>

          <div className="form-group">
            <label>Additional Notes</label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => { setEditing(false); setFormData(profile); }}>
              Cancel
            </button>
            <button type="submit" className="primary">Save Profile</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Patient Information</h2>
        <button onClick={() => setEditing(true)}>Edit Profile</button>
      </div>

      <div className="profile-display">
        <section className="profile-section">
          <h3>Personal Information</h3>
          <div className="profile-grid">
            <div className="profile-field">
              <span className="field-label">Name:</span>
              <span className="field-value">
                {profile.first_name} {profile.last_name}
              </span>
            </div>
            <div className="profile-field">
              <span className="field-label">Date of Birth:</span>
              <span className="field-value">
                {profile.date_of_birth}
                {profile.date_of_birth && ` (Age ${calculateAge(profile.date_of_birth)})`}
              </span>
            </div>
            <div className="profile-field">
              <span className="field-label">Sex:</span>
              <span className="field-value">{profile.sex || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Blood Type:</span>
              <span className="field-value">{profile.blood_type || '—'}</span>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <h3>Physical Characteristics</h3>
          <div className="profile-grid">
            <div className="profile-field">
              <span className="field-label">Height:</span>
              <span className="field-value">
                {profile.height_inches ? `${profile.height_inches}" (${Math.floor(profile.height_inches / 12)}'${profile.height_inches % 12}")` : '—'}
              </span>
            </div>
            <div className="profile-field">
              <span className="field-label">Weight:</span>
              <span className="field-value">{profile.weight_lbs ? `${profile.weight_lbs} lbs` : '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">BMI:</span>
              <span className="field-value">
                {calculateBMI(profile.weight_lbs, profile.height_inches) || '—'}
              </span>
            </div>
          </div>
        </section>

        {profile.allergies && (
          <section className="profile-section">
            <h3>Allergies</h3>
            <p className="profile-text">{profile.allergies}</p>
          </section>
        )}

        {profile.primary_physician && (
          <section className="profile-section">
            <h3>Primary Physician</h3>
            <p className="profile-text">{profile.primary_physician}</p>
          </section>
        )}

        {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
          <section className="profile-section">
            <h3>Emergency Contact</h3>
            <div className="profile-grid">
              <div className="profile-field">
                <span className="field-label">Name:</span>
                <span className="field-value">{profile.emergency_contact_name || '—'}</span>
              </div>
              <div className="profile-field">
                <span className="field-label">Phone:</span>
                <span className="field-value">{profile.emergency_contact_phone || '—'}</span>
              </div>
            </div>
          </section>
        )}

        {(profile.insurance_provider || profile.insurance_id) && (
          <section className="profile-section">
            <h3>Insurance</h3>
            <div className="profile-grid">
              <div className="profile-field">
                <span className="field-label">Provider:</span>
                <span className="field-value">{profile.insurance_provider || '—'}</span>
              </div>
              <div className="profile-field">
                <span className="field-label">Member ID:</span>
                <span className="field-value">{profile.insurance_id || '—'}</span>
              </div>
            </div>
          </section>
        )}

        {profile.notes && (
          <section className="profile-section">
            <h3>Additional Notes</h3>
            <p className="profile-text">{profile.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function ProfileView() {
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [vitals, setVitals] = useState([]);
  const [showVitalForm, setShowVitalForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  useEffect(() => {
    apiFetch('/api/conditions').then(r => r.json()).then(setConditions);
    apiFetch('/api/medications').then(r => r.json()).then(setMedications);
    apiFetch('/api/vitals?limit=10').then(r => r.json()).then(setVitals);
  }, []);

  const refreshVitals = () => {
    apiFetch('/api/vitals?limit=10').then(r => r.json()).then(setVitals);
  };

  const refreshMedications = () => {
    apiFetch('/api/medications').then(r => r.json()).then(setMedications);
  };

  const refreshConditions = () => {
    apiFetch('/api/conditions').then(r => r.json()).then(setConditions);
  };

  const showMedicationEvidence = (medication) => {
    setSelectedMedication(medication);
    setShowEvidenceModal(true);
  };

  return (
    <div className="view">
      <h2>Health Profile</h2>
      
      <section>
        <h3>Recent Vitals</h3>
        {vitals.length === 0 && <p className="empty">No vitals recorded yet</p>}
        <div className="vitals-grid">
          {vitals.slice(0, 3).map(v => (
            <VitalCard key={v.id} vital={v} conditions={conditions} />
          ))}
        </div>
        <button onClick={() => setShowVitalForm(!showVitalForm)}>
          {showVitalForm ? '✕ Cancel' : '+ Record Vitals'}
        </button>
        {showVitalForm && <VitalForm conditions={conditions} onSave={refreshVitals} onClose={() => setShowVitalForm(false)} />}
      </section>

      <section>
        <h3>Conditions ({conditions.length})</h3>
        {conditions.length === 0 && <p className="empty">No conditions tracked yet</p>}
        <ul>
          {conditions.map(c => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.diagnosed_date && <span> — Diagnosed {c.diagnosed_date}</span>}
              <span className={`status ${c.status}`}>{c.status}</span>
            </li>
          ))}
        </ul>
        <button onClick={() => setShowConditionForm(!showConditionForm)}>
          {showConditionForm ? '✕ Cancel' : '+ Add Condition'}
        </button>
        {showConditionForm && <ConditionForm onSave={refreshConditions} onClose={() => setShowConditionForm(false)} />}
      </section>

      <section>
        <h3>Medications ({medications.length})</h3>
        {medications.length === 0 && <p className="empty">No medications tracked yet</p>}
        <ul className="medications-list">
          {medications.map(m => (
            <li key={m.id} className="medication-item">
              <div className="medication-info">
                <strong>{m.name}</strong> — {m.dosage} {m.frequency}
              </div>
              {medicationEvidence[m.name] && (
                <button 
                  className="evidence-button" 
                  onClick={() => showMedicationEvidence(m)}
                  title="View research evidence"
                >
                  📚 Evidence
                </button>
              )}
            </li>
          ))}
        </ul>
        <button onClick={() => setShowMedicationForm(!showMedicationForm)}>
          {showMedicationForm ? '✕ Cancel' : '+ Add Medication'}
        </button>
        {showMedicationForm && <MedicationForm onSave={refreshMedications} onClose={() => setShowMedicationForm(false)} />}
      </section>

      {showEvidenceModal && selectedMedication && (
        <MedicationEvidenceModal
          medication={selectedMedication}
          evidence={medicationEvidence[selectedMedication.name]}
          onClose={() => setShowEvidenceModal(false)}
        />
      )}
    </div>
  );
}

function VitalCard({ vital, conditions }) {
  const associatedConditions = conditions.filter(c => 
    vital.condition_ids?.includes(c.id)
  );

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null;
    return ((weight / (height * height)) * 703).toFixed(1);
  };

  return (
    <div className="vital-card">
      <div className="vital-date">{vital.date} {vital.time || ''}</div>
      <div className="vital-readings">
        {vital.systolic && vital.diastolic && (
          <div className="reading">
            <span className="label">BP:</span> {vital.systolic}/{vital.diastolic}
          </div>
        )}
        {vital.heart_rate && (
          <div className="reading">
            <span className="label">HR:</span> {vital.heart_rate} bpm
          </div>
        )}
        {vital.temperature_f && (
          <div className="reading">
            <span className="label">Temp:</span> {vital.temperature_f}°F
          </div>
        )}
        {vital.oxygen_saturation && (
          <div className="reading">
            <span className="label">SpO2:</span> {vital.oxygen_saturation}%
          </div>
        )}
        {vital.weight_lbs && (
          <div className="reading">
            <span className="label">Weight:</span> {vital.weight_lbs} lbs
            {vital.height_inches && ` (BMI: ${calculateBMI(vital.weight_lbs, vital.height_inches)})`}
          </div>
        )}
        {vital.blood_glucose && (
          <div className="reading">
            <span className="label">Glucose:</span> {vital.blood_glucose} mg/dL
          </div>
        )}
        {vital.pain_level !== null && vital.pain_level !== undefined && (
          <div className="reading">
            <span className="label">Pain:</span> {vital.pain_level}/10
          </div>
        )}
      </div>
      {vital.notes && <div className="vital-notes">{vital.notes}</div>}
    </div>
  );
}

function ConditionForm({ onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    diagnosed_date: '',
    status: 'active',
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    await apiFetch('/api/conditions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    onSave();
    onClose();
  };

  return (
    <form className="condition-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-group">
          <label>Condition Name *</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            placeholder="e.g., Hypertension, Diabetes Type 2"
            required 
          />
        </div>
        <div className="form-group">
          <label>Diagnosed Date</label>
          <input 
            type="date" 
            name="diagnosed_date" 
            value={formData.diagnosed_date} 
            onChange={handleChange} 
          />
        </div>
      </div>

      <div className="form-group">
        <label>Status</label>
        <select name="status" value={formData.status} onChange={handleChange}>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea 
          name="notes" 
          value={formData.notes} 
          onChange={handleChange} 
          rows="3"
          placeholder="Any additional information about this condition..."
        />
      </div>

      <div className="form-actions">
        <button type="submit">Save Condition</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function MedicationForm({ onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    prescribing_provider: '',
    purpose: '',
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    await apiFetch('/api/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    onSave();
    onClose();
  };

  return (
    <form className="medication-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-group">
          <label>Medication Name *</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            placeholder="e.g., Lisinopril"
            required 
          />
        </div>
        <div className="form-group">
          <label>Dosage *</label>
          <input 
            type="text" 
            name="dosage" 
            value={formData.dosage} 
            onChange={handleChange} 
            placeholder="e.g., 10mg"
            required 
          />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Frequency *</label>
          <input 
            type="text" 
            name="frequency" 
            value={formData.frequency} 
            onChange={handleChange} 
            placeholder="e.g., Daily, Twice daily, As needed"
            required 
          />
        </div>
        <div className="form-group">
          <label>Start Date</label>
          <input 
            type="date" 
            name="start_date" 
            value={formData.start_date} 
            onChange={handleChange} 
          />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>End Date (if applicable)</label>
          <input 
            type="date" 
            name="end_date" 
            value={formData.end_date} 
            onChange={handleChange} 
          />
        </div>
        <div className="form-group">
          <label>Prescribing Provider</label>
          <input 
            type="text" 
            name="prescribing_provider" 
            value={formData.prescribing_provider} 
            onChange={handleChange} 
            placeholder="Dr. Smith"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Purpose/Reason</label>
        <input 
          type="text" 
          name="purpose" 
          value={formData.purpose} 
          onChange={handleChange} 
          placeholder="What is this medication for?"
        />
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea 
          name="notes" 
          value={formData.notes} 
          onChange={handleChange} 
          rows="3"
          placeholder="Any additional notes, side effects, or instructions..."
        />
      </div>

      <div className="form-actions">
        <button type="submit">Save Medication</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function VitalForm({ conditions, onSave, onClose }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    systolic: '',
    diastolic: '',
    heart_rate: '',
    temperature_f: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    weight_lbs: '',
    height_inches: '',
    blood_glucose: '',
    pain_level: '',
    notes: '',
    condition_ids: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConditionToggle = (conditionId) => {
    setFormData(prev => ({
      ...prev,
      condition_ids: prev.condition_ids.includes(conditionId)
        ? prev.condition_ids.filter(id => id !== conditionId)
        : [...prev.condition_ids, conditionId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Convert empty strings to null for numeric fields
    const payload = { ...formData };
    const numericFields = ['systolic', 'diastolic', 'heart_rate', 'temperature_f', 
                           'respiratory_rate', 'oxygen_saturation', 'weight_lbs', 
                           'height_inches', 'blood_glucose', 'pain_level'];
    
    numericFields.forEach(field => {
      payload[field] = payload[field] === '' ? null : parseFloat(payload[field]);
    });

    await apiFetch('/api/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    onSave();
    onClose();
  };

  return (
    <form className="vital-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-group">
          <label>Date</label>
          <input type="date" name="date" value={formData.date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Time</label>
          <input type="time" name="time" value={formData.time} onChange={handleChange} />
        </div>
      </div>

      <fieldset>
        <legend>Vital Signs</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Blood Pressure (systolic/diastolic)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="number" name="systolic" placeholder="120" value={formData.systolic} onChange={handleChange} />
              <span>/</span>
              <input type="number" name="diastolic" placeholder="80" value={formData.diastolic} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Heart Rate (bpm)</label>
            <input type="number" name="heart_rate" placeholder="72" value={formData.heart_rate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Temperature (°F)</label>
            <input type="number" step="0.1" name="temperature_f" placeholder="98.6" value={formData.temperature_f} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Respiratory Rate (breaths/min)</label>
            <input type="number" name="respiratory_rate" placeholder="16" value={formData.respiratory_rate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Oxygen Saturation (%)</label>
            <input type="number" name="oxygen_saturation" placeholder="98" value={formData.oxygen_saturation} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Pain Level (0-10)</label>
            <input type="number" min="0" max="10" name="pain_level" placeholder="0" value={formData.pain_level} onChange={handleChange} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Measurements</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Weight (lbs)</label>
            <input type="number" step="0.1" name="weight_lbs" placeholder="170" value={formData.weight_lbs} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Height (inches)</label>
            <input type="number" step="0.1" name="height_inches" placeholder="70" value={formData.height_inches} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Blood Glucose (mg/dL)</label>
            <input type="number" name="blood_glucose" placeholder="100" value={formData.blood_glucose} onChange={handleChange} />
          </div>
        </div>
      </fieldset>

      {conditions.length > 0 && (
        <fieldset>
          <legend>Associated Diagnoses</legend>
          <div className="condition-checkboxes">
            {conditions.map(condition => (
              <label key={condition.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.condition_ids.includes(condition.id)}
                  onChange={() => handleConditionToggle(condition.id)}
                />
                {condition.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="form-group">
        <label>Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" />
      </div>

      <div className="form-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary">Save Vitals</button>
      </div>
    </form>
  );
}

function OverviewView() {
  const [subTab, setSubTab] = useState('vitals');

  return (
    <div className="view">
      <div className="sub-nav">
        <button 
          className={subTab === 'vitals' ? 'active' : ''}
          onClick={() => setSubTab('vitals')}
        >
          Vitals & Records
        </button>
        <button 
          className={subTab === 'patient' ? 'active' : ''}
          onClick={() => setSubTab('patient')}
        >
          Patient Info
        </button>
        <button 
          className={subTab === 'labs' ? 'active' : ''}
          onClick={() => setSubTab('labs')}
        >
          Lab Results
        </button>
      </div>
      
      {subTab === 'vitals' && <ProfileView />}
      {subTab === 'patient' && <PatientView />}
      {subTab === 'labs' && <TestResultsView />}
    </div>
  );
}

function TreatmentView() {
  const [subTab, setSubTab] = useState('nutrition');

  return (
    <div className="view">
      <div className="sub-nav">
        <button 
          className={subTab === 'nutrition' ? 'active' : ''}
          onClick={() => setSubTab('nutrition')}
        >
          🥗 Nutrition
        </button>
        <button 
          className={subTab === 'bone' ? 'active' : ''}
          onClick={() => setSubTab('bone')}
        >
          🦴 Bone Health
        </button>
      </div>
      
      {subTab === 'nutrition' && <NutritionTracker />}
      {subTab === 'bone' && <BoneHealthTracker />}
    </div>
  );
}

function ResearchView() {
  const [subTab, setSubTab] = useState('search');
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    apiFetch('/api/papers').then(r => r.json()).then(setPapers);
  }, []);

  const getPaperUrl = (paper) => {
    if (paper.url) return paper.url;
    if (paper.pubmed_id) return `https://pubmed.ncbi.nlm.nih.gov/${paper.pubmed_id}/`;
    return null;
  };

  return (
    <div className="view">
      <div className="sub-nav">
        <button 
          className={subTab === 'search' ? 'active' : ''}
          onClick={() => setSubTab('search')}
        >
          Search
        </button>
        <button 
          className={subTab === 'library' ? 'active' : ''}
          onClick={() => setSubTab('library')}
        >
          Library ({papers.length})
        </button>
      </div>

      {subTab === 'search' && (
        <>
          <h2>Research Discovery</h2>
          <ResearchSearch />
        </>
      )}

      {subTab === 'library' && (
        <>
          <h2>Research Library</h2>
          {papers.length === 0 && <p className="empty">No papers saved yet</p>}
          <div className="papers">
            {papers.map(p => {
              const paperUrl = getPaperUrl(p);
              const CardContent = (
                <>
                  <h4>{p.title}</h4>
                  <p className="meta">{p.authors} • {p.journal}</p>
                  <span className={`type ${p.type}`}>{p.type}</span>
                </>
              );

              return paperUrl ? (
                <a 
                  key={p.id} 
                  href={paperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="paper-card clickable"
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  {CardContent}
                </a>
              ) : (
                <div key={p.id} className="paper-card">
                  {CardContent}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
