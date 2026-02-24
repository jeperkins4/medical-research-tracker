import { useState, useEffect } from 'react';
import * as api from '../api';

export default function PortalManager() {
  const [vaultStatus, setVaultStatus] = useState({ initialized: false, unlocked: false });
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    service_name: '',
    portal_type: 'epic',
    base_url: '',
    username: '',
    password: '',
    mfa_method: 'none',
    totp_secret: '',
    notes: '',
    sync_schedule: 'manual',
    sync_time: '02:00',
    sync_day_of_week: 1,
    sync_day_of_month: 1,
    auto_sync_on_open: false,
    notify_on_sync: true
  });
  
  const [syncing, setSyncing] = useState({});

  useEffect(() => {
    loadVaultStatus();
  }, []);

  useEffect(() => {
    if (vaultStatus.unlocked) {
      loadCredentials();
    }
  }, [vaultStatus.unlocked]);

  const loadVaultStatus = async () => {
    try {
      const data = await api.getVaultStatus();
      setVaultStatus(data);
    } catch (err) {
      setError('Failed to check vault status');
    } finally {
      setLoading(false);
    }
  };

  const loadCredentials = async () => {
    try {
      const data = await api.getPortalCredentials();
      setCredentials(data);
    } catch (err) {
      setError('Failed to load credentials');
    }
  };

  const handleSetupVault = async (e) => {
    e.preventDefault();
    setError(null);

    if (masterPassword.length < 8) {
      setError('Master password must be at least 8 characters');
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const result = await api.setupVault(masterPassword);

      if (result.success) {
        setMasterPassword('');
        setConfirmPassword('');
        loadVaultStatus();
      } else {
        setError(result.error || 'Failed to setup vault');
      }
    } catch (err) {
      setError(err.message || 'Failed to setup vault');
    }
  };

  const handleUnlockVault = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await api.unlockVault(masterPassword);

      if (result.success) {
        setMasterPassword('');
        loadVaultStatus();
      } else {
        setError(result.error || 'Invalid password');
      }
    } catch (err) {
      setError(err.message || 'Failed to unlock vault');
    }
  };

  const handleLockVault = async () => {
    try {
      await api.lockVault();
      setCredentials([]);
      loadVaultStatus();
    } catch (err) {
      setError('Failed to lock vault');
    }
  };

  const handleAddCredential = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await api.savePortalCredential(formData);

      if (result.success) {
        resetForm();
        loadCredentials();
      } else {
        setError(result.error || 'Failed to add credential');
      }
    } catch (err) {
      setError(err.message || 'Failed to add credential');
    }
  };

  const handleUpdateCredential = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await api.savePortalCredential({ ...formData, id: editingId });

      if (result.success) {
        resetForm();
        loadCredentials();
      } else {
        setError(result.error || 'Failed to update credential');
      }
    } catch (err) {
      setError(err.message || 'Failed to update credential');
    }
  };

  const handleDeleteCredential = async (id) => {
    if (!confirm('Delete this portal credential? This cannot be undone.')) return;

    try {
      await api.deletePortalCredential(id);
      loadCredentials();
    } catch (err) {
      setError('Failed to delete credential');
    }
  };

  const startEdit = async (id) => {
    try {
      // Find credential in existing credentials array
      const credential = credentials.find(c => c.id === id);
      if (credential) {
        setFormData(credential);
        setEditingId(id);
        setShowAddForm(true);
      }
    } catch (err) {
      setError('Failed to load credential');
    }
  };

  const handleSync = async (credentialId, serviceName) => {
    setSyncing(prev => ({ ...prev, [credentialId]: true }));
    setError(null);
    
    try {
      // Use the unified API (works in both Electron and browser)
      const data = await api.syncPortal(credentialId);
      
      if (data.success !== false) {
        // Reload credentials to show updated sync status
        loadCredentials();
        
        // Build detailed sync result message
        let message = `✅ Sync Complete: ${serviceName}\n\n`;
        
        if (data.summary) {
          if (data.summary.connector) {
            message += `Connector: ${data.summary.connector}\n`;
          }
          if (data.summary.status) {
            message += `Status: ${data.summary.status}\n\n`;
          }
          
          if (data.summary.details) {
            message += `Records Imported:\n`;
            const details = data.summary.details;
            if (details.labResults !== undefined) message += `  • Lab Results: ${details.labResults}\n`;
            if (details.imagingReports !== undefined) message += `  • Imaging/Scans: ${details.imagingReports}\n`;
            if (details.pathologyReports !== undefined) message += `  • Pathology Reports: ${details.pathologyReports}\n`;
            if (details.clinicalNotes !== undefined) message += `  • Doctor Notes: ${details.clinicalNotes}\n`;
            if (details.signateraReports !== undefined) message += `  • Signatera Reports: ${details.signateraReports}\n`;
            if (details.medications !== undefined) message += `  • Medications: ${details.medications}\n`;
            if (details.vitals !== undefined) message += `  • Vitals: ${details.vitals}\n`;
            if (details.conditions !== undefined) message += `  • Conditions: ${details.conditions}\n`;
            if (details.immunizations !== undefined) message += `  • Immunizations: ${details.immunizations}\n`;
            if (details.documentsDownloaded !== undefined) message += `  • Documents Downloaded: ${details.documentsDownloaded}\n`;
            if (details.recordsParsed !== undefined) message += `  • Records Parsed: ${details.recordsParsed}\n`;
            message += `\nTotal: ${data.recordsImported} records\n`;
          } else {
            message += `Records Imported: ${data.recordsImported}\n`;
          }
          
          if (data.summary.message) {
            message += `\n${data.summary.message}`;
          }
          
          if (data.summary.errors && data.summary.errors.length > 0) {
            message += `\n\n❌ Errors:\n`;
            data.summary.errors.forEach(error => {
              message += `  • ${error}\n`;
            });
          }
          
          if (data.summary.priorities && data.summary.priorities.length > 0) {
            message += `\n\nData Priorities:\n`;
            data.summary.priorities.forEach(priority => {
              message += `  ${priority}\n`;
            });
          }
          
          if (data.summary.nextSteps && data.summary.nextSteps.length > 0) {
            message += `\n\nImplementation Steps:\n`;
            data.summary.nextSteps.forEach(step => {
              message += `  → ${step}\n`;
            });
          }
        } else {
          message += `Records Imported: ${data.recordsImported}`;
        }
        
        alert(message);
      } else {
        const errorMsg = data.summary?.message || data.error || 'Sync failed';
        if (errorMsg.includes('Vault') || errorMsg.includes('locked')) {
          setError('Vault is locked. Please unlock it first by clicking "Unlock Vault" button below.');
          // Reload vault status
          loadVaultStatus();
        } else {
          setError(errorMsg);
        }
      }
    } catch (err) {
      setError('Sync failed: ' + err.message);
    } finally {
      setSyncing(prev => ({ ...prev, [credentialId]: false }));
    }
  };

  const resetForm = () => {
    setFormData({
      service_name: '',
      portal_type: 'epic',
      base_url: '',
      username: '',
      password: '',
      mfa_method: 'none',
      totp_secret: '',
      notes: '',
      sync_schedule: 'manual',
      sync_time: '02:00',
      sync_day_of_week: 1,
      sync_day_of_month: 1,
      auto_sync_on_open: false,
      notify_on_sync: true
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  if (loading) {
    return <div className="view"><p>Loading...</p></div>;
  }

  // Main portal management screen (vault auto-unlocked on login)
  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>🔐 Healthcare Portals</h2>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            Securely store credentials for automated record syncing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowAddForm(true)}>+ Add Portal</button>
        </div>
      </div>

      {error && (
        <div className="alert error" style={{
          padding: '1rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && resetForm()}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3>{editingId ? 'Edit Portal Credential' : 'Add Portal Credential'}</h3>
            <form onSubmit={editingId ? handleUpdateCredential : handleAddCredential}>
              <div className="form-group">
                <label>Service Name *</label>
                <input
                  type="text"
                  value={formData.service_name}
                  onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                  placeholder="e.g., Epic MyChart - Florida Cancer Specialists"
                  required
                />
              </div>

              <div className="form-group">
                <label>Portal Type *</label>
                <select
                  value={formData.portal_type}
                  onChange={(e) => setFormData({ ...formData, portal_type: e.target.value })}
                  required
                >
                  <option value="epic">Epic MyChart</option>
                  <option value="cerner">Cerner Health</option>
                  <option value="athena">Athenahealth</option>
                  <option value="carespace">CareSpace Portal</option>
                  <option value="generic">Custom/Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Portal URL</label>
                <input
                  type="url"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder="https://mychart.example.com"
                />
              </div>

              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Your portal username"
                  required
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Your portal password"
                  required={!editingId}
                  autoComplete="new-password"
                />
                {editingId && <small>Leave blank to keep existing password</small>}
              </div>

              <div className="form-group">
                <label>MFA Method</label>
                <select
                  value={formData.mfa_method}
                  onChange={(e) => setFormData({ ...formData, mfa_method: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="sms">SMS Code</option>
                  <option value="email">Email Code</option>
                  <option value="totp">Authenticator App (TOTP)</option>
                </select>
              </div>

              {formData.mfa_method === 'totp' && (
                <div className="form-group">
                  <label>TOTP Secret</label>
                  <input
                    type="text"
                    value={formData.totp_secret}
                    onChange={(e) => setFormData({ ...formData, totp_secret: e.target.value })}
                    placeholder="Base32 secret from authenticator setup"
                  />
                  <small>Optional: For automatic TOTP code generation</small>
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder="Any additional notes about this portal"
                />
              </div>

              <fieldset style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
                <legend style={{ fontSize: '1em', fontWeight: 600, padding: '0 0.5rem' }}>⏰ Sync Schedule</legend>
                
                <div className="form-group">
                  <label>Sync Frequency</label>
                  <select
                    value={formData.sync_schedule}
                    onChange={(e) => setFormData({ ...formData, sync_schedule: e.target.value })}
                  >
                    <option value="manual">Manual only</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {formData.sync_schedule !== 'manual' && (
                  <>
                    <div className="form-group">
                      <label>Sync Time</label>
                      <input
                        type="time"
                        value={formData.sync_time}
                        onChange={(e) => setFormData({ ...formData, sync_time: e.target.value })}
                      />
                      <small>Time of day to run scheduled sync</small>
                    </div>

                    {formData.sync_schedule === 'weekly' && (
                      <div className="form-group">
                        <label>Day of Week</label>
                        <select
                          value={formData.sync_day_of_week}
                          onChange={(e) => setFormData({ ...formData, sync_day_of_week: parseInt(e.target.value) })}
                        >
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                      </div>
                    )}

                    {formData.sync_schedule === 'monthly' && (
                      <div className="form-group">
                        <label>Day of Month</label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={formData.sync_day_of_month}
                          onChange={(e) => setFormData({ ...formData, sync_day_of_month: parseInt(e.target.value) })}
                        />
                        <small>Day 1-28 (avoids month-end complications)</small>
                      </div>
                    )}
                  </>
                )}

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.auto_sync_on_open}
                      onChange={(e) => setFormData({ ...formData, auto_sync_on_open: e.target.checked })}
                    />
                    Auto-sync when opening related tabs (if data &gt; 24hrs old)
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notify_on_sync}
                      onChange={(e) => setFormData({ ...formData, notify_on_sync: e.target.checked })}
                    />
                    Send Telegram notification on sync completion
                  </label>
                </div>
              </fieldset>

              <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={resetForm}>Cancel</button>
                <button type="submit" className="primary">
                  {editingId ? 'Update' : 'Add'} Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {credentials.length === 0 ? (
        <div className="empty-state" style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '2rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏥</div>
          <h3>No Portal Credentials Yet</h3>
          <p style={{ color: '#666', marginTop: '1rem' }}>
            Add your healthcare portal credentials to enable automated record syncing.
          </p>
          <button onClick={() => setShowAddForm(true)} className="primary" style={{ marginTop: '1.5rem' }}>
            + Add Your First Portal
          </button>
        </div>
      ) : (
        <div className="credentials-list">
          {credentials.map(cred => (
            <div key={cred.id} className="credential-card" style={{
              padding: '1.5rem',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>{cred.service_name}</h4>
                  <div style={{ fontSize: '0.9em', color: '#666' }}>
                    <div><strong>Type:</strong> {cred.portal_type}</div>
                    {cred.base_url && <div><strong>URL:</strong> {cred.base_url}</div>}
                    <div><strong>MFA:</strong> {cred.mfa_method}</div>
                    <div>
                      <strong>Last Sync:</strong>{' '}
                      {cred.last_sync ? new Date(cred.last_sync).toLocaleString() : 'Never'}
                      {cred.last_sync_status && cred.last_sync_status !== 'never' && (
                        <>
                          {' '}
                          <span className={`status-badge ${cred.last_sync_status}`}>
                            {cred.last_sync_status}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleSync(cred.id, cred.service_name)} 
                      disabled={syncing[cred.id]}
                      className="primary"
                      style={{ fontSize: '0.9em', minWidth: '100px' }}
                    >
                      {syncing[cred.id] ? '⏳ Syncing...' : '🔄 Sync Now'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => startEdit(cred.id)} style={{ fontSize: '0.9em' }}>Edit</button>
                    <button onClick={() => handleDeleteCredential(cred.id)} style={{ fontSize: '0.9em', color: '#c00' }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
