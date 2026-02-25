import { useState, useEffect } from 'react';
import './App.css';
import Login from './Login';
import Onboarding from './components/Onboarding';
import FirstRunWizard from './components/FirstRunWizard';
import PrecisionMedicineDashboard from './components/PrecisionMedicineDashboard';
import ResearchSearch from './components/ResearchSearch';
import HealthcareSummary from './components/HealthcareSummary';
import PortalManager from './components/PortalManager';
import BoneHealthTracker from './components/BoneHealthTracker';
import NutritionTracker from './components/NutritionTracker';
import KidneyHealthTracker from './components/KidneyHealthTracker';
import LiverHealthTracker from './components/LiverHealthTracker';
import LungHealthTracker from './components/LungHealthTracker';
import MedicationEvidenceModal from './components/MedicationEvidenceModal';
import MedicationManager from './components/MedicationManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CloudSync from './components/CloudSync';
import PHITransfer from './components/PHITransfer';
import medicationEvidence from './medicationEvidence';
import { apiFetch as robustApiFetch, fetchJSON, clearCache } from './utils/apiHelpers';
import * as api from './api';
import LabReportUploader from './components/LabReportUploader';

// Simple apiFetch for components that don't use retry yet (legacy - will be migrated)
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
  const [showFirstRunWizard, setShowFirstRunWizard] = useState(false);

  useEffect(() => {
    checkFirstRun();
  }, []);

  const checkFirstRun = async () => {
    try {
      // Check if user account exists
      const needsSetupResult = await api.needsSetup();
      
      if (!needsSetupResult) {
        // User exists - skip wizard, go straight to login
        console.log('[App] User account exists, skipping wizard');
        checkAuth();
        return;
      }
      
      // Check if wizard has been completed/dismissed before
      const wizardCompleted = localStorage.getItem('firstRunWizardCompleted');
      
      if (wizardCompleted === 'true') {
        // Wizard already shown - skip it, go to login/setup
        console.log('[App] Wizard already completed, skipping to auth');
        checkAuth();
        return;
      }
      
      // First time ever - show wizard
      console.log('[App] First run detected, showing wizard');
      setShowFirstRunWizard(true);
      setLoading(false);
    } catch (err) {
      console.error('[App] First run check failed:', err);
      // If everything fails, proceed with normal auth flow
      checkAuth();
    }
  };

  const handleFirstRunComplete = () => {
    // Mark wizard as completed (never show again)
    localStorage.setItem('firstRunWizardCompleted', 'true');
    setShowFirstRunWizard(false);
    checkAuth();
  };

  const checkAuth = async () => {
    console.log('[App] Starting auth check...');
    try {
      // Check if setup is needed
      console.log('[App] Checking if setup is needed...');
      const needsSetupResult = await api.needsSetup();
      console.log('[App] Setup needed:', needsSetupResult);
      
      if (needsSetupResult) {
        console.log('[App] Setup needed, showing setup screen');
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      // For embedded database (Electron), we just check if user is logged in
      // User will be prompted to login if not authenticated
      console.log('[App] No setup needed, user can login');
      
      // Fetch health status
      const healthData = await api.getHealthStatus();
      setHealth(healthData);
    } catch (err) {
      console.error('[App] Auth check failed:', err);
    } finally {
      console.log('[App] Auth check complete, setting loading=false');
      setLoading(false);
    }
  };

  const handleLogin = async (user) => {
    console.log('[App] Login successful, user:', user);
    setUsername(user);
    setAuthenticated(true);
    setNeedsSetup(false);
    
    // Fetch health status
    try {
      const healthData = await api.getHealthStatus();
      console.log('[App] Health status:', healthData);
      setHealth(healthData);
    } catch (err) {
      console.log('[App] Health status check failed:', err.message);
      setHealth({ status: 'embedded', message: 'Using local database' });
    }
  };

  const handleLogout = async () => {
    await api.logoutUser();
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

  // Show first-run wizard before anything else
  if (showFirstRunWizard) {
    return <FirstRunWizard open={true} onComplete={handleFirstRunComplete} />;
  }

  if (!authenticated) {
    if (needsSetup) {
      return <Onboarding onComplete={handleLogin} />;
    }
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
        <button 
          className={activeTab === 'analytics' ? 'active' : ''}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
      </nav>

      <main>
        {activeTab === 'profile' && <OverviewView />}
        {activeTab === 'genomics' && <PrecisionMedicineDashboard />}
        {activeTab === 'treatment' && <TreatmentView />}
        {activeTab === 'research' && <ResearchView />}
        {activeTab === 'summary' && <HealthcareSummary />}
        {activeTab === 'portals' && <PortalManager />}
        {activeTab === 'analytics' && <AnalyticsDashboard apiFetch={apiFetch} />}
      </main>

      <AppFooter />
    </div>
  );
}

function AppFooter() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (window.electron) {
      window.electron.getAppVersion().then(v => setVersion(v));
    }
  }, []);

  return (
    <footer className="app-footer">
      {version && <span className="version">v{version}</span>}
    </footer>
  );
}

const isElectronLabs = typeof window !== 'undefined' && window.electron?.labs?.getResults;

function TestResultsView() {
  const [tests, setTests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('byDate'); // 'byDate' or 'trends'
  const [showUploader, setShowUploader] = useState(false);

  const loadTests = () => {
    if (isElectronLabs) {
      window.electron.labs.getResults()
        .then(data => {
          if (Array.isArray(data)) {
            setTests(data);
            if (data.length > 0 && !selectedDate) {
              const dates = [...new Set(data.map(t => t.date))].sort().reverse();
              setSelectedDate(dates[0]);
            }
          }
        })
        .catch(err => console.error('[TestResultsView] IPC error:', err));
    } else {
      apiFetch('/api/tests')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTests(data);
            if (data.length > 0 && !selectedDate) {
              const dates = [...new Set(data.map(t => t.date))].sort().reverse();
              setSelectedDate(dates[0]);
            }
          } else {
            console.warn('[TestResultsView] Tests API returned non-array:', data);
            setTests([]);
          }
        })
        .catch(err => {
          console.error('[TestResultsView] Failed to fetch tests:', err);
          setTests([]);
        });
    }
  };

  useEffect(() => { loadTests(); }, []);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Laboratory Results</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowUploader(v => !v)}
            style={{ padding: '7px 16px', background: showUploader ? '#0c4a6e' : '#0369a1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            {showUploader ? '✕ Close Uploader' : '📄 Upload Lab Report'}
          </button>
          <div className="view-toggle">
            <button className={viewMode === 'byDate' ? 'active' : ''} onClick={() => setViewMode('byDate')}>By Date</button>
            <button className={viewMode === 'trends' ? 'active' : ''} onClick={() => setViewMode('trends')}>Trends</button>
          </div>
        </div>
      </div>

      {showUploader && (
        <LabReportUploader onImported={() => { loadTests(); setShowUploader(false); }} />
      )}

      {!showUploader && tests.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', marginBottom: '20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧪</div>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>No lab results yet</div>
          <div style={{ fontSize: '13px', marginBottom: '14px' }}>Upload a lab report PDF to extract CMP, CBC, and other test results automatically.</div>
          <button onClick={() => setShowUploader(true)} style={{ padding: '8px 20px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            📄 Upload Lab Report
          </button>
        </div>
      )}

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
                  <div key={test.id} className={`test-result-card ${(test.flag && test.flag !== 'normal') ? 'abnormal' : isAbnormal(test.result) ? 'abnormal' : ''}`}>
                    <div className="test-header">
                      <h4>{test.test_name}</h4>
                      {(test.flag === 'high' || test.flag === 'critical') && <span className="flag" style={{ color: '#dc2626' }}>▲ {test.flag === 'critical' ? 'CRITICAL' : 'HIGH'}</span>}
                      {test.flag === 'low' && <span className="flag" style={{ color: '#2563eb' }}>▼ LOW</span>}
                      {(!test.flag || test.flag === 'normal') && isAbnormal(test.result) && <span className="flag">⚠️</span>}
                    </div>
                    <div className="test-result" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1em' }}>{test.result}</span>
                      {test.unit && <span style={{ fontSize: '0.85em', color: '#64748b' }}>{test.unit}</span>}
                    </div>
                    {(test.normal_low || test.normal_high) && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Ref: {test.normal_low && test.normal_high ? `${test.normal_low}–${test.normal_high}` : test.normal_low || test.normal_high} {test.unit || ''}
                      </div>
                    )}
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
    api.getProfile()
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
    await api.updateProfile(formData);
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
    api.getConditions()
      .then(data => {
        if (Array.isArray(data)) {
          setConditions(data);
        } else {
          console.warn('[ProfileView] Conditions API returned non-array:', data);
          setConditions([]);
        }
      })
      .catch(err => {
        console.error('[ProfileView] Failed to fetch conditions:', err);
        setConditions([]);
      });
    
    api.getMedications()
      .then(data => {
        if (Array.isArray(data)) {
          setMedications(data);
        } else {
          console.warn('[ProfileView] Medications API returned non-array:', data);
          setMedications([]);
        }
      })
      .catch(err => {
        console.error('[ProfileView] Failed to fetch medications:', err);
        setMedications([]);
      });
    
    api.getVitals(10)
      .then(data => {
        if (Array.isArray(data)) {
          setVitals(data);
        } else {
          console.warn('[ProfileView] Vitals API returned non-array:', data);
          setVitals([]);
        }
      })
      .catch(err => {
        console.error('[ProfileView] Failed to fetch vitals:', err);
        setVitals([]);
      });
  }, []);

  const refreshVitals = () => {
    api.getVitals(10)
      .then(data => Array.isArray(data) ? setVitals(data) : setVitals([]))
      .catch(() => setVitals([]));
  };

  const refreshMedications = () => {
    api.getMedications()
      .then(data => Array.isArray(data) ? setMedications(data) : setMedications([]))
      .catch(() => setMedications([]));
  };

  const refreshConditions = () => {
    api.getConditions()
      .then(data => Array.isArray(data) ? setConditions(data) : setConditions([]))
      .catch(() => setConditions([]));
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
    
    await api.addCondition(formData);

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
    
    await api.addMedication(formData);

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

    await api.addVitals(payload);

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
        <button 
          className={subTab === 'settings' ? 'active' : ''}
          onClick={() => setSubTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>
      
      {subTab === 'vitals' && <ProfileView />}
      {subTab === 'patient' && <PatientView />}
      {subTab === 'labs' && <TestResultsView />}
      {subTab === 'settings' && (
        <>
          <h2>Settings</h2>
          <CloudSync />
          <div style={{ marginTop: '2rem' }}>
            <PHITransfer />
          </div>
        </>
      )}
    </div>
  );
}

function TreatmentView() {
  const [subTab, setSubTab] = useState('medications');

  return (
    <div className="view">
      <div className="sub-nav">
        <button 
          className={subTab === 'medications' ? 'active' : ''}
          onClick={() => setSubTab('medications')}
        >
          💊 Medications & Supplements
        </button>
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
        <button
          className={subTab === 'kidney' ? 'active' : ''}
          onClick={() => setSubTab('kidney')}
        >
          🫘 Kidney Health
        </button>
        <button
          className={subTab === 'liver' ? 'active' : ''}
          onClick={() => setSubTab('liver')}
        >
          🫀 Liver Health
        </button>
        <button
          className={subTab === 'lung' ? 'active' : ''}
          onClick={() => setSubTab('lung')}
        >
          🫁 Lung Health
        </button>
      </div>
      
      {subTab === 'medications' && <MedicationManager apiFetch={apiFetch} />}
      {subTab === 'nutrition' && <NutritionTracker />}
      {subTab === 'bone' && <BoneHealthTracker apiFetch={apiFetch} />}
      {subTab === 'kidney' && <KidneyHealthTracker apiFetch={apiFetch} />}
      {subTab === 'liver' && <LiverHealthTracker apiFetch={apiFetch} />}
      {subTab === 'lung' && <LungHealthTracker apiFetch={apiFetch} />}
    </div>
  );
}

function ResearchView() {
  const [subTab, setSubTab] = useState('search');
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    apiFetch('/api/papers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPapers(data);
        } else {
          console.warn('[ResearchView] Papers API returned non-array:', data);
          setPapers([]);
        }
      })
      .catch(err => {
        console.error('[ResearchView] Failed to fetch papers:', err);
        setPapers([]);
      });
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
