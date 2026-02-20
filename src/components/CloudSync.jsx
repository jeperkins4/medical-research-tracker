import { useState, useEffect } from 'react';
import './CloudSync.css';

function CloudSync() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch sync status on mount
  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync/status', {
        credentials: 'include'
      });
      const data = await response.json();
      setSyncStatus(data);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectToCloud = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSyncing(true);

    try {
      const response = await fetch('/api/sync/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`✅ Connected to cloud! Synced ${data.research.synced} papers.`);
        setShowConnectModal(false);
        setEmail('');
        setPassword('');
        fetchSyncStatus();
      } else {
        setError(data.error || 'Failed to connect to cloud');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    setError('');
    setSuccessMessage('');
    setSyncing(true);

    try {
      const response = await fetch('/api/sync/research', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`✅ Synced ${data.synced} papers to cloud`);
        fetchSyncStatus();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Sync failed. Check your internet connection.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="cloud-sync-widget loading">
        <div className="sync-spinner"></div>
      </div>
    );
  }

  if (!syncStatus?.available) {
    return null; // Cloud sync not configured on server
  }

  const isConnected = syncStatus.cloudConnected;
  const hasUnsyncedData = syncStatus.unsyncedPapers > 0;

  return (
    <div className="cloud-sync-widget">
      {successMessage && (
        <div className="sync-message success">{successMessage}</div>
      )}
      
      {error && (
        <div className="sync-message error">{error}</div>
      )}

      {!isConnected ? (
        <div className="sync-status not-connected">
          <div className="sync-icon">☁️</div>
          <div className="sync-info">
            <div className="sync-title">Local Only</div>
            <div className="sync-description">
              Your data is secure locally. Connect to cloud for multi-device access.
            </div>
          </div>
          <button 
            onClick={() => setShowConnectModal(true)} 
            className="sync-button primary"
          >
            Connect to Cloud
          </button>
        </div>
      ) : (
        <div className="sync-status connected">
          <div className="sync-icon">✅</div>
          <div className="sync-info">
            <div className="sync-title">Cloud Connected</div>
            <div className="sync-description">
              {hasUnsyncedData ? (
                <span className="warning">{syncStatus.unsyncedPapers} unsynced papers</span>
              ) : (
                <span>All research synced</span>
              )}
              {syncStatus.lastSyncedAt && (
                <span className="last-sync">
                  {' · Last sync: ' + new Date(syncStatus.lastSyncedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          {hasUnsyncedData && (
            <button 
              onClick={handleSyncNow} 
              disabled={syncing}
              className="sync-button secondary"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Connect to Cloud</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowConnectModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Enter an email and password for your cloud account. 
                Your health data (PHI) stays encrypted locally. 
                Only research papers and preferences sync to the cloud.
              </p>

              <form onSubmit={handleConnectToCloud}>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    disabled={syncing}
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
                    placeholder="At least 6 characters"
                    disabled={syncing}
                  />
                </div>

                <div className="modal-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowConnectModal(false)}
                    className="button secondary"
                    disabled={syncing}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="button primary"
                    disabled={syncing}
                  >
                    {syncing ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="sync-privacy-note">
        🔒 <strong>Privacy:</strong> Your health data (medications, labs, vitals) 
        never leaves your device. Only research papers sync to the cloud.
      </div>
    </div>
  );
}

export default CloudSync;
