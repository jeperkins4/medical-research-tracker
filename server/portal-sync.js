import { getCredential, updateSyncStatus } from './portal-credentials.js';
import { query, run } from './db.js';
import { syncCareSpace } from './connectors/carespace.js';

/**
 * Main sync controller - routes to appropriate portal connector
 */
export async function syncPortal(credentialId) {
  const startTime = new Date().toISOString();
  
  try {
    // Get decrypted credentials
    const credential = getCredential(credentialId);
    
    console.log(`🔄 Starting sync for: ${credential.service_name} (${credential.portal_type})`);
    
    // Log sync start
    const logResult = run(`
      INSERT INTO portal_sync_log (
        credential_id, sync_started, status
      ) VALUES (?, ?, 'running')
    `, [credentialId, startTime]);
    
    const syncLogId = logResult.lastInsertRowid;
    
    // Route to appropriate connector
    let result;
    
    switch (credential.portal_type) {
      case 'epic':
        result = await syncEpicMyChart(credential);
        break;
      case 'cerner':
        result = await syncCernerPortal(credential);
        break;
      case 'athena':
        result = await syncAthenaPortal(credential);
        break;
      case 'carespace':
        result = await syncCareSpacePortal(credential);
        break;
      case 'generic':
        result = await syncGenericPortal(credential);
        break;
      default:
        throw new Error(`Unknown portal type: ${credential.portal_type}`);
    }
    
    // Update sync log with results
    const endTime = new Date().toISOString();
    run(`
      UPDATE portal_sync_log
      SET sync_completed = ?,
          status = 'success',
          records_imported = ?
      WHERE id = ?
    `, [endTime, result.recordsImported, syncLogId]);
    
    // Update credential last_sync
    updateSyncStatus(credentialId, 'success', result.recordsImported);
    
    console.log(`✅ Sync complete: ${result.recordsImported} records imported`);
    
    return {
      success: true,
      recordsImported: result.recordsImported,
      summary: result.summary,
      syncLogId
    };
    
  } catch (error) {
    console.error(`❌ Sync failed for credential ${credentialId}:`, error);
    
    // Update sync log with error
    run(`
      UPDATE portal_sync_log
      SET sync_completed = CURRENT_TIMESTAMP,
          status = 'failed',
          error_message = ?
      WHERE credential_id = ?
      AND sync_started = ?
    `, [error.message, credentialId, startTime]);
    
    // Update credential status
    updateSyncStatus(credentialId, 'failed', 0, error.message);
    
    throw error;
  }
}

/**
 * Epic MyChart FHIR connector (OAuth + API)
 */
async function syncEpicMyChart(credential) {
  // TODO: Implement Epic FHIR OAuth flow + data fetch
  // For now, return mock data
  console.log('  → Epic MyChart connector (TODO: implement FHIR OAuth)');
  
  return {
    recordsImported: 0,
    summary: {
      connector: 'Epic MyChart (FHIR)',
      status: 'Connector not yet implemented',
      message: 'Epic FHIR OAuth + API connector coming soon!',
      details: {
        labResults: 0,
        imagingReports: 0,
        pathologyReports: 0,
        clinicalNotes: 0,
        signateraReports: 0,
        medications: 0,
        vitals: 0
      },
      priorities: [
        '🔬 Lab Results (Observation)',
        '📊 Imaging/Scans (DiagnosticReport - radiology)',
        '🔬 Pathology Reports (DiagnosticReport - pathology)',
        '📄 Doctor Notes (DocumentReference - exclude nursing notes)',
        '🧬 Signatera Reports (Observation - genomic tumor tracking)',
        '💊 Medications (MedicationRequest)',
        '📈 Vitals (Observation - vital signs)'
      ],
      nextSteps: [
        'OAuth 2.0 SMART on FHIR flow',
        'Fetch Observation (labs, Signatera, vitals)',
        'Fetch DiagnosticReport (imaging, pathology)',
        'Fetch DocumentReference (filter for provider notes only)',
        'Fetch MedicationRequest',
        'Map FHIR → your schema',
        'Import to database'
      ]
    }
  };
}

/**
 * Cerner portal connector
 */
async function syncCernerPortal(credential) {
  console.log('  → Cerner connector (TODO: implement)');
  
  return {
    recordsImported: 0,
    summary: {
      connector: 'Cerner Health (FHIR)',
      status: 'Connector not yet implemented',
      message: 'Cerner FHIR API connector planned for Phase 3',
      details: {
        labResults: 0,
        medications: 0,
        vitals: 0,
        conditions: 0,
        immunizations: 0
      }
    }
  };
}

/**
 * Athenahealth portal connector
 */
async function syncAthenaPortal(credential) {
  console.log('  → Athena connector (TODO: implement)');
  
  return {
    recordsImported: 0,
    summary: {
      connector: 'Athenahealth (FHIR)',
      status: 'Connector not yet implemented',
      message: 'Athenahealth API connector planned for Phase 3',
      details: {
        labResults: 0,
        medications: 0,
        vitals: 0,
        conditions: 0
      }
    }
  };
}

/**
 * CareSpace portal connector
 */
async function syncCareSpacePortal(credential) {
  console.log('  → CareSpace connector (Browser Automation)');
  
  try {
    return await syncCareSpace(credential);
  } catch (error) {
    console.error('  ✗ CareSpace sync failed:', error.message);
    
    // Return error details
    return {
      recordsImported: 0,
      summary: {
        connector: 'CareSpace Portal (Browser Automation)',
        status: 'Failed',
        message: `Sync failed: ${error.message}`,
        details: {
          labResults: 0,
          imagingReports: 0,
          pathologyReports: 0,
          clinicalNotes: 0,
          signateraReports: 0,
          medications: 0
        },
        error: error.message,
        troubleshooting: [
          'Check that portal URL is correct',
          'Verify credentials are still valid',
          'Portal layout may have changed (need manual inspection)',
          'Check server logs for detailed error'
        ]
      }
    };
  }
}

/**
 * Generic portal connector (browser automation fallback)
 */
async function syncGenericPortal(credential) {
  console.log('  → Generic connector (TODO: implement Playwright automation)');
  
  return {
    recordsImported: 0,
    summary: {
      connector: 'Generic Portal (Browser Automation)',
      status: 'Connector not yet implemented',
      message: 'Generic browser automation fallback for unsupported portals',
      details: {
        documentsDownloaded: 0,
        recordsParsed: 0
      },
      nextSteps: [
        'Playwright headless browser',
        'Custom scraping logic per portal',
        'PDF/HTML parsing',
        'Manual record mapping'
      ]
    }
  };
}

/**
 * Check if credential needs auto-sync (for auto-sync on tab open)
 */
export function needsAutoSync(credentialId) {
  const cred = query(`
    SELECT last_sync, auto_sync_on_open
    FROM portal_credentials
    WHERE id = ?
  `, [credentialId])[0];
  
  if (!cred || !cred.auto_sync_on_open) {
    return false;
  }
  
  if (!cred.last_sync) {
    return true; // Never synced
  }
  
  // Check if last sync was > 24 hours ago
  const lastSync = new Date(cred.last_sync);
  const now = new Date();
  const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
  
  return hoursSinceSync > 24;
}
