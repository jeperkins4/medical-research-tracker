import { useState } from 'react';
import './Onboarding.css';

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [accountData, setAccountData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    diagnosis: '',
    diagnosisDate: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const steps = [
    'welcome',
    'account',
    'profile',
    'genomics',
    'tour'
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    // Skip optional steps
    if (steps[step] === 'profile' || steps[step] === 'genomics') {
      handleNext();
    }
  };

  const createAccount = async () => {
    setError('');
    
    // Validation
    if (accountData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    if (accountData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (accountData.password !== accountData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: accountData.username,
          password: accountData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        handleNext();
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch (err) {
      console.error('Account creation error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profileData.firstName && !profileData.diagnosis) {
      // Nothing to save, skip to next step
      handleNext();
      return;
    }

    setLoading(true);
    
    try {
      // Save patient profile
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          date_of_birth: profileData.dateOfBirth
        })
      });

      // Save diagnosis if provided
      if (profileData.diagnosis) {
        await fetch('/api/conditions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: profileData.diagnosis,
            diagnosis_date: profileData.diagnosisDate || new Date().toISOString().split('T')[0],
            status: 'active'
          })
        });
      }

      handleNext();
    } catch (err) {
      console.error('Profile save error:', err);
      setError('Failed to save profile. You can add this later.');
      setTimeout(() => {
        setError('');
        handleNext();
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = () => {
    onComplete(accountData.username);
  };

  // Welcome Screen
  if (steps[step] === 'welcome') {
    return (
      <div className="onboarding-container">
        <div className="onboarding-content welcome-screen">
          <div className="welcome-icon">
            <svg width="80" height="80" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="256" cy="256" r="240" fill="#2196F3"/>
              <path d="M 180 120 Q 140 180, 180 240 T 180 360 T 180 480" stroke="white" strokeWidth="16" fill="none" strokeLinecap="round"/>
              <path d="M 332 120 Q 372 180, 332 240 T 332 360 T 332 480" stroke="white" strokeWidth="16" fill="none" strokeLinecap="round"/>
              <line x1="180" y1="200" x2="332" y2="200" stroke="white" strokeWidth="12"/>
              <line x1="180" y1="260" x2="332" y2="260" stroke="white" strokeWidth="12"/>
              <line x1="180" y1="320" x2="332" y2="320" stroke="white" strokeWidth="12"/>
              <circle cx="256" cy="150" r="12" fill="#4CAF50"/>
              <circle cx="256" cy="256" r="14" fill="#4CAF50"/>
              <circle cx="256" cy="362" r="12" fill="#4CAF50"/>
            </svg>
          </div>
          
          <h1>Welcome to MyTreatmentPath</h1>
          <p className="welcome-subtitle">
            Your personal medical research assistant
          </p>

          <div className="welcome-features">
            <div className="welcome-feature">
              <span className="feature-icon">🧬</span>
              <h3>Genomics Integration</h3>
              <p>Connect mutations to treatments and clinical trials</p>
            </div>
            
            <div className="welcome-feature">
              <span className="feature-icon">📊</span>
              <h3>Health Tracking</h3>
              <p>Labs, vitals, medications, symptoms in one place</p>
            </div>
            
            <div className="welcome-feature">
              <span className="feature-icon">🔬</span>
              <h3>Research Discovery</h3>
              <p>Automated scanning for relevant papers and trials</p>
            </div>
            
            <div className="welcome-feature">
              <span className="feature-icon">🔒</span>
              <h3>Privacy First</h3>
              <p>Your data stays on your device, encrypted locally</p>
            </div>
          </div>

          <button onClick={handleNext} className="onboarding-button primary">
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // Account Creation
  if (steps[step] === 'account') {
    return (
      <div className="onboarding-container">
        <div className="onboarding-content">
          <div className="onboarding-header">
            <h2>Create Your Account</h2>
            <p>Your credentials are stored securely on this device only</p>
          </div>

          <div className="onboarding-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={accountData.username}
                onChange={(e) => setAccountData({...accountData, username: e.target.value})}
                placeholder="Choose a username"
                autoFocus
                disabled={loading}
              />
              <small className="help-text">At least 3 characters</small>
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={accountData.password}
                onChange={(e) => setAccountData({...accountData, password: e.target.value})}
                placeholder="Choose a strong password"
                disabled={loading}
              />
              <small className="help-text">At least 6 characters</small>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={accountData.confirmPassword}
                onChange={(e) => setAccountData({...accountData, confirmPassword: e.target.value})}
                placeholder="Re-enter your password"
                disabled={loading}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="security-note">
              <span className="security-icon">🔒</span>
              <p>
                Your password is encrypted using AES-256 and never leaves this device.
                Make sure to remember it - there's no password recovery.
              </p>
            </div>
          </div>

          <div className="onboarding-actions">
            <button onClick={handleBack} className="onboarding-button secondary" disabled={loading}>
              Back
            </button>
            <button onClick={createAccount} className="onboarding-button primary" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>

          <div className="onboarding-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${(step / (steps.length - 1)) * 100}%`}}></div>
            </div>
            <p className="progress-text">Step {step + 1} of {steps.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // Profile Setup (Optional)
  if (steps[step] === 'profile') {
    return (
      <div className="onboarding-container">
        <div className="onboarding-content">
          <div className="onboarding-header">
            <h2>Basic Profile</h2>
            <p>Help us personalize your experience (optional - you can add this later)</p>
          </div>

          <div className="onboarding-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                  placeholder="Your first name"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                  placeholder="Your last name"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                value={profileData.dateOfBirth}
                onChange={(e) => setProfileData({...profileData, dateOfBirth: e.target.value})}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Primary Diagnosis (if applicable)</label>
              <input
                type="text"
                value={profileData.diagnosis}
                onChange={(e) => setProfileData({...profileData, diagnosis: e.target.value})}
                placeholder="e.g., Bladder Cancer, Breast Cancer"
                disabled={loading}
              />
            </div>

            {profileData.diagnosis && (
              <div className="form-group">
                <label>Diagnosis Date</label>
                <input
                  type="date"
                  value={profileData.diagnosisDate}
                  onChange={(e) => setProfileData({...profileData, diagnosisDate: e.target.value})}
                  disabled={loading}
                />
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="onboarding-actions">
            <button onClick={handleSkip} className="onboarding-button secondary" disabled={loading}>
              Skip for Now
            </button>
            <button onClick={saveProfile} className="onboarding-button primary" disabled={loading}>
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>

          <div className="onboarding-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${(step / (steps.length - 1)) * 100}%`}}></div>
            </div>
            <p className="progress-text">Step {step + 1} of {steps.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // Genomic Data Import (Optional)
  if (steps[step] === 'genomics') {
    return (
      <div className="onboarding-container">
        <div className="onboarding-content">
          <div className="onboarding-header">
            <h2>Import Genomic Data</h2>
            <p>Upload your Foundation One CDx report for precision medicine insights</p>
          </div>

          <div className="genomics-info">
            <div className="info-card">
              <h3>🧬 What is Foundation One CDx?</h3>
              <p>
                A comprehensive genomic test that analyzes 324 cancer-related genes.
                It identifies mutations, treatment options, and clinical trial matches.
              </p>
            </div>

            <div className="info-card">
              <h3>📄 Supported Formats</h3>
              <ul>
                <li>Foundation One CDx PDF reports</li>
                <li>Foundation Medicine XML files</li>
                <li>Tempus xT reports (coming soon)</li>
                <li>Guardant360 reports (coming soon)</li>
              </ul>
            </div>

            <div className="info-card">
              <h3>🔒 Your Data is Private</h3>
              <p>
                Genomic data is encrypted and stored locally on your device.
                It never leaves your computer without your explicit permission.
              </p>
            </div>
          </div>

          <div className="onboarding-actions">
            <button onClick={handleSkip} className="onboarding-button secondary">
              Skip for Now
            </button>
            <button onClick={handleNext} className="onboarding-button primary">
              I'll Upload Later
            </button>
          </div>

          <div className="onboarding-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${(step / (steps.length - 1)) * 100}%`}}></div>
            </div>
            <p className="progress-text">Step {step + 1} of {steps.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // Quick Tour
  if (steps[step] === 'tour') {
    return (
      <div className="onboarding-container">
        <div className="onboarding-content">
          <div className="onboarding-header">
            <h2>You're All Set!</h2>
            <p>Here's what you can do with MyTreatmentPath</p>
          </div>

          <div className="tour-features">
            <div className="tour-feature">
              <div className="tour-icon">📊</div>
              <h3>Track Your Health</h3>
              <p>
                Log medications, vitals, lab results, and symptoms.
                See trends over time and export reports for your doctors.
              </p>
            </div>

            <div className="tour-feature">
              <div className="tour-icon">🧬</div>
              <h3>Explore Genomics</h3>
              <p>
                View your mutations, pathways, and targeted treatments.
                Discover clinical trials matching your genomic profile.
              </p>
            </div>

            <div className="tour-feature">
              <div className="tour-icon">🔬</div>
              <h3>Discover Research</h3>
              <p>
                Search PubMed and ClinicalTrials.gov for relevant papers.
                Automated daily scans find new research matching your condition.
              </p>
            </div>

            <div className="tour-feature">
              <div className="tour-icon">🧠</div>
              <h3>AI Insights</h3>
              <p>
                Get GPT-4 powered meal analysis and healthcare summaries.
                Understand how nutrition affects your treatment.
              </p>
            </div>
          </div>

          <div className="getting-started">
            <h3>Quick Start Tips</h3>
            <ol>
              <li>Add your current medications in the <strong>Medications</strong> tab</li>
              <li>Upload recent lab results in <strong>Lab Results</strong></li>
              <li>Search for your condition in <strong>Research</strong></li>
              <li>If you have genomic data, upload it in <strong>Genomics</strong></li>
            </ol>
          </div>

          <button onClick={completeOnboarding} className="onboarding-button primary large">
            Start Using MyTreatmentPath
          </button>

          <div className="onboarding-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{width: '100%'}}></div>
            </div>
            <p className="progress-text">Setup Complete!</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default Onboarding;
