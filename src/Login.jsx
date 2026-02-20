import { useState } from 'react';
import './Login.css';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import About from './pages/About';
import { apiUrl } from './config';

function Login({ onLogin, needsSetup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState('login'); // 'login' | 'signup' | 'terms' | 'privacy' | 'about'
  const [isSignupMode, setIsSignupMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation for signup mode
    if (isSignupMode && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // For signup mode, always use local auth
      if (isSignupMode) {
        console.log('[Auth] Creating new account...');
        
        const response = await fetch(apiUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
          onLogin(data.username);
        } else {
          setError(data.error || 'Failed to create account');
        }
        setLoading(false);
        return;
      }
      
      // Login mode (existing logic)
      // Try Supabase auth first (if configured)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnonKey) {
        console.log('[Auth] Attempting Supabase authentication...');
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username, // Username field accepts email for cloud auth
          password: password
        });
        
        if (!error && data.user) {
          console.log('[Auth] Supabase authentication successful');
          // Store session info locally
          localStorage.setItem('supabase_user', JSON.stringify(data.user));
          onLogin(data.user.email);
          return;
        }
        
        if (error) {
          console.log('[Auth] Supabase auth failed:', error.message);
          // Fall through to local auth
        }
      }
      
      // Fall back to local auth (for offline use or if Supabase auth failed)
      console.log('[Auth] Attempting local authentication...');
      
      const endpoint = needsSetup ? '/api/auth/setup' : '/api/auth/login';
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.username);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error('[Auth] Login error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render legal pages
  if (currentPage === 'terms') {
    return <Terms onBack={() => setCurrentPage('login')} />;
  }
  if (currentPage === 'privacy') {
    return <Privacy onBack={() => setCurrentPage('login')} />;
  }
  if (currentPage === 'about') {
    return <About onBack={() => setCurrentPage('login')} />;
  }

  return (
    <div className="login-container">
      {/* Marketing Side */}
      <div className="login-hero">
        <div className="hero-content">
          <div className="logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          <h1 className="hero-title">Your Treatment,<br />Your Data,<br />Your Path</h1>
          
          <p className="hero-subtitle">
            Cancer treatment generates overwhelming data. We help you organize it, 
            understand it, and use it to make informed decisions.
          </p>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">🧬</span>
              <div>
                <h3>Precision Medicine</h3>
                <p>Connect genomic data to treatment options and clinical trials</p>
              </div>
            </div>
            
            <div className="feature">
              <span className="feature-icon">📊</span>
              <div>
                <h3>All Your Records</h3>
                <p>Labs, vitals, medications, imaging — everything in one secure place</p>
              </div>
            </div>
            
            <div className="feature">
              <span className="feature-icon">🔬</span>
              <div>
                <h3>Research Scanner</h3>
                <p>Automated search for relevant clinical trials and treatment research</p>
              </div>
            </div>
            
            <div className="feature">
              <span className="feature-icon">🔒</span>
              <div>
                <h3>HIPAA Compliant</h3>
                <p>AES-256 encryption, automated backups, full audit logging</p>
              </div>
            </div>
          </div>

          <div className="trust-badge">
            <p>Built by cancer patients for patients who want control over their treatment journey.</p>
          </div>
        </div>
      </div>

      {/* Login Side */}
      <div className="login-panel">
        <div className="login-card">
          <div className="login-header">
            <h2>MyTreatmentPath</h2>
            <p>
              {needsSetup 
                ? 'Create your secure account' 
                : isSignupMode 
                  ? 'Create a new account' 
                  : 'Sign in to continue'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={loading}
                placeholder="Enter your username"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                placeholder={(needsSetup || isSignupMode) ? "At least 6 characters" : "Enter your password"}
              />
              {(needsSetup || isSignupMode) && (
                <small className="help-text">Must be at least 6 characters</small>
              )}
            </div>

            {isSignupMode && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  placeholder="Re-enter your password"
                />
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Please wait...' : (needsSetup || isSignupMode) ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {needsSetup && (
            <div className="setup-info">
              <p className="setup-heading">First time setup</p>
              <p>Your data stays on your device. No cloud storage, no third parties.</p>
            </div>
          )}

          {!needsSetup && !isSignupMode && (
            <div className="login-footer">
              <p>
                Don't have an account?{' '}
                <button 
                  onClick={(e) => { e.preventDefault(); setIsSignupMode(true); setError(''); }}
                  className="link-button"
                >
                  Sign up
                </button>
              </p>
            </div>
          )}

          {!needsSetup && isSignupMode && (
            <div className="login-footer">
              <p>
                Already have an account?{' '}
                <button 
                  onClick={(e) => { e.preventDefault(); setIsSignupMode(false); setError(''); setConfirmPassword(''); }}
                  className="link-button"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          <div className="footer-links">
            <button 
              onClick={(e) => { e.preventDefault(); setCurrentPage('terms'); }} 
              className="footer-link"
            >
              Terms of Use
            </button>
            <span className="footer-separator">•</span>
            <button 
              onClick={(e) => { e.preventDefault(); setCurrentPage('privacy'); }} 
              className="footer-link"
            >
              Privacy Policy
            </button>
            <span className="footer-separator">•</span>
            <button 
              onClick={(e) => { e.preventDefault(); setCurrentPage('about'); }} 
              className="footer-link"
            >
              About Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
