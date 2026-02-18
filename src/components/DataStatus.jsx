/**
 * Data Status Indicator
 * Shows data integrity and provides refresh capability
 */

import { useState, useEffect } from 'react';
import './DataStatus.css';

export default function DataStatus({ apiFetch }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    checkStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check multiple endpoints quickly
      const [healthRes, conditionsRes, medsRes] = await Promise.allSettled([
        apiFetch('/api/health'),
        apiFetch('/api/conditions'),
        apiFetch('/api/medications')
      ]);
      
      const healthOk = healthRes.status === 'fulfilled' && healthRes.value.ok;
      const conditionsOk = conditionsRes.status === 'fulfilled' && conditionsRes.value.ok;
      const medsOk = medsRes.status === 'fulfilled' && medsRes.value.ok;
      
      // Get condition count if successful
      let conditionCount = 0;
      let medCount = 0;
      
      if (conditionsOk) {
        const conditionsData = await conditionsRes.value.json();
        conditionCount = conditionsData.length || 0;
      }
      
      if (medsOk) {
        const medsData = await medsRes.value.json();
        medCount = medsData.length || 0;
      }
      
      setStatus({
        healthy: healthOk && conditionsOk && medsOk,
        conditionCount,
        medCount,
        endpoints: {
          health: healthOk,
          conditions: conditionsOk,
          medications: medsOk
        }
      });
      
      setLastCheck(new Date());
      
    } catch (err) {
      console.error('Data status check failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // Clear any cached data
    if (window.location) {
      window.location.reload();
    }
  };

  if (!status && !loading && !error) {
    return null;
  }

  return (
    <div className="data-status">
      <div className="data-status-indicator">
        {loading && <span className="status-loading">⏳</span>}
        {!loading && status?.healthy && <span className="status-ok">✅</span>}
        {!loading && status && !status.healthy && <span className="status-error">⚠️</span>}
        {error && <span className="status-error">❌</span>}
        
        <span className="status-text">
          {loading && 'Checking...'}
          {!loading && status?.healthy && `Data OK (${status.conditionCount} conditions, ${status.medCount} meds)`}
          {!loading && status && !status.healthy && 'Data connection issues'}
          {error && 'Data error'}
        </span>
      </div>
      
      <div className="data-status-actions">
        <button 
          onClick={checkStatus} 
          disabled={loading}
          className="status-refresh-btn"
          title="Refresh status"
        >
          🔄
        </button>
        
        <button 
          onClick={handleRefresh}
          className="status-reload-btn"
          title="Reload app"
        >
          ↻
        </button>
      </div>
      
      {lastCheck && (
        <div className="status-last-check">
          Last check: {lastCheck.toLocaleTimeString()}
        </div>
      )}
      
      {error && (
        <div className="status-error-details">
          {error}
        </div>
      )}
    </div>
  );
}
