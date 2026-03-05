/**
 * Epic MyChart FHIR Connector (SMART on FHIR)
 * 
 * Implements OAuth 2.0 authorization flow and FHIR R4 API integration
 * for Epic MyChart patient portals.
 */

import fetch from 'node-fetch';
import { run, query } from '../db-secure.js';
import crypto from 'crypto';

// Epic FHIR endpoints (configurable via environment variables)
const getEpicConfig = () => ({
  EPIC_CLIENT_ID: process.env.EPIC_CLIENT_ID,
  EPIC_FHIR_BASE: process.env.EPIC_FHIR_BASE_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  EPIC_AUTH_URL: process.env.EPIC_AUTHORIZATION_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
  EPIC_TOKEN_URL: process.env.EPIC_TOKEN_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
});

/**
 * Step 1: Generate authorization URL for patient to login
 * 
 * @param {string} credentialId - Portal credential ID (for state parameter)
 * @returns {string} Authorization URL to redirect patient to
 */
export function getAuthorizationUrl(credentialId) {
  const { EPIC_CLIENT_ID, EPIC_FHIR_BASE, EPIC_AUTH_URL, APP_BASE_URL } = getEpicConfig();
  if (!EPIC_CLIENT_ID) {
    throw new Error('EPIC_CLIENT_ID not configured. See FHIR-SETUP-GUIDE.md');
  }
  
  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in database temporarily (expires in 10 minutes)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  run(`
    INSERT OR REPLACE INTO fhir_oauth_state (credential_id, state, expires_at)
    VALUES (?, ?, ?)
  `, [credentialId, state, expiresAt]);
  
  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: EPIC_CLIENT_ID,
    redirect_uri: `${APP_BASE_URL}/api/fhir/callback`,
    scope: [
      'patient/Observation.read',
      'patient/DiagnosticReport.read',
      'patient/DocumentReference.read',
      'patient/MedicationRequest.read',
      'patient/Condition.read',
      'patient/Patient.read',
      'launch/patient',
      'offline_access' // For refresh tokens
    ].join(' '),
    state: state,
    aud: EPIC_FHIR_BASE // Required by Epic
  });
  
  return `${EPIC_AUTH_URL}?${params.toString()}`;
}

/**
 * Step 2: Exchange authorization code for access token
 * 
 * @param {string} code - Authorization code from OAuth callback
 * @param {string} state - State parameter (for CSRF validation)
 * @returns {Promise<Object>} Token response with access_token, patient ID, etc.
 */
export async function exchangeCodeForToken(code, state) {
  const { EPIC_CLIENT_ID, EPIC_TOKEN_URL, APP_BASE_URL } = getEpicConfig();
  if (!EPIC_CLIENT_ID) throw new Error('EPIC_CLIENT_ID not configured');
  // Validate state parameter (CSRF protection)
  const stateRecord = query(`
    SELECT credential_id, expires_at 
    FROM fhir_oauth_state 
    WHERE state = ?
  `, [state])[0];
  
  if (!stateRecord) {
    throw new Error('Invalid state parameter (possible CSRF attack)');
  }
  
  if (new Date(stateRecord.expires_at) < new Date()) {
    throw new Error('Authorization expired. Please try again.');
  }
  
  // Exchange code for token
  const tokenResponse = await fetch(EPIC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${APP_BASE_URL}/api/fhir/callback`,
      client_id: EPIC_CLIENT_ID
    }).toString()
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  const tokenData = await tokenResponse.json();
  
  // Store tokens securely in database (encrypted via SQLCipher)
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  
  run(`
    INSERT OR REPLACE INTO fhir_tokens (
      credential_id, 
      access_token, 
      refresh_token, 
      patient_id, 
      expires_at,
      scope
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    stateRecord.credential_id,
    tokenData.access_token,
    tokenData.refresh_token || null,
    tokenData.patient, // Patient FHIR ID
    expiresAt,
    tokenData.scope
  ]);
  
  // Clean up used state
  run('DELETE FROM fhir_oauth_state WHERE state = ?', [state]);
  
  return {
    credentialId: stateRecord.credential_id,
    patientId: tokenData.patient,
    expiresAt: expiresAt
  };
}

/**
 * Step 3: Refresh access token using refresh token
 * 
 * @param {number} credentialId - Portal credential ID
 * @returns {Promise<string>} New access token
 */
export async function refreshAccessToken(credentialId) {
  const { EPIC_CLIENT_ID, EPIC_TOKEN_URL } = getEpicConfig();
  if (!EPIC_CLIENT_ID) throw new Error('EPIC_CLIENT_ID not configured');

  const tokenRecord = query(`
    SELECT refresh_token 
    FROM fhir_tokens 
    WHERE credential_id = ?
  `, [credentialId])[0];
  
  if (!tokenRecord || !tokenRecord.refresh_token) {
    throw new Error('No refresh token available. Re-authorization required.');
  }
  
  const tokenResponse = await fetch(EPIC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
      client_id: EPIC_CLIENT_ID
    }).toString()
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${error}. Re-authorization required.`);
  }
  
  const tokenData = await tokenResponse.json();
  
  // Update stored tokens
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  
  run(`
    UPDATE fhir_tokens 
    SET access_token = ?, 
        refresh_token = ?, 
        expires_at = ?
    WHERE credential_id = ?
  `, [
    tokenData.access_token,
    tokenData.refresh_token || tokenRecord.refresh_token,
    expiresAt,
    credentialId
  ]);
  
  return tokenData.access_token;
}

/**
 * Get valid access token (refresh if expired)
 * 
 * @param {number} credentialId - Portal credential ID
 * @returns {Promise<Object>} { accessToken, patientId }
 */
async function getValidAccessToken(credentialId) {
  const tokenRecord = query(`
    SELECT access_token, patient_id, expires_at 
    FROM fhir_tokens 
    WHERE credential_id = ?
  `, [credentialId])[0];
  
  if (!tokenRecord) {
    throw new Error('Not authorized. Please connect your Epic MyChart account first.');
  }
  
  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = new Date(tokenRecord.expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  let accessToken = tokenRecord.access_token;
  
  if (expiresAt < fiveMinutesFromNow) {
    console.log('  → Access token expired, refreshing...');
    accessToken = await refreshAccessToken(credentialId);
  }
  
  return {
    accessToken: accessToken,
    patientId: tokenRecord.patient_id
  };
}

/**
 * Make authenticated FHIR API request
 * 
 * @param {string} accessToken - OAuth access token
 * @param {string} resourcePath - FHIR resource path (e.g., "Observation?category=laboratory")
 * @returns {Promise<Object>} FHIR Bundle response
 */
async function fhirRequest(accessToken, resourcePath) {
  const { EPIC_FHIR_BASE } = getEpicConfig();
  const url = `${EPIC_FHIR_BASE}/${resourcePath}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/fhir+json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FHIR API error: ${response.status} ${error}`);
  }
  
  return await response.json();
}

/**
 * Fetch all pages of a FHIR Bundle (handle pagination)
 * 
 * @param {string} accessToken - OAuth access token
 * @param {string} resourcePath - Initial FHIR resource path
 * @returns {Promise<Array>} All resources from all pages
 */
async function fetchAllPages(accessToken, resourcePath) {
  const allResources = [];
  let nextUrl = resourcePath;
  
  while (nextUrl) {
    const bundle = await fhirRequest(accessToken, nextUrl);
    
    if (bundle.entry) {
      allResources.push(...bundle.entry.map(e => e.resource));
    }
    
    // Check for next page link
    const nextLink = bundle.link?.find(l => l.relation === 'next');
    const { EPIC_FHIR_BASE } = getEpicConfig();
    nextUrl = nextLink ? nextLink.url.replace(EPIC_FHIR_BASE + '/', '') : null;
  }
  
  return allResources;
}

/**
 * Main sync function: Fetch FHIR data and import to database
 * 
 * @param {Object} credential - Portal credential object
 * @returns {Promise<Object>} Sync results
 */
export async function syncEpicFHIR(credential) {
  console.log('  → Epic FHIR connector (SMART on FHIR)');
  
  try {
    // Get valid access token
    const { accessToken, patientId } = await getValidAccessToken(credential.id);
    
    const results = {
      labResults: 0,
      imagingReports: 0,
      pathologyReports: 0,
      clinicalNotes: 0,
      signateraReports: 0,
      medications: 0,
      vitals: 0,
      conditions: 0
    };
    
    // Fetch Lab Results (Observation with category=laboratory)
    console.log('    → Fetching lab results (Observation)...');
    const labs = await fetchAllPages(accessToken, `Observation?patient=${patientId}&category=laboratory`);
    results.labResults = importObservations(labs, 'laboratory');
    
    // Fetch Vitals (Observation with category=vital-signs)
    console.log('    → Fetching vitals (Observation)...');
    const vitals = await fetchAllPages(accessToken, `Observation?patient=${patientId}&category=vital-signs`);
    results.vitals = importObservations(vitals, 'vital-signs');
    
    // Fetch Signatera/ctDNA Results (Observation with specific LOINC codes)
    console.log('    → Fetching Signatera/genomic tests (Observation)...');
    // LOINC code 96603-3 = Circulating tumor DNA
    const signatera = await fetchAllPages(accessToken, `Observation?patient=${patientId}&code=96603-3`);
    results.signateraReports = importObservations(signatera, 'genomic');
    
    // Fetch Imaging Reports (DiagnosticReport with category=radiology)
    console.log('    → Fetching imaging reports (DiagnosticReport)...');
    const imaging = await fetchAllPages(accessToken, `DiagnosticReport?patient=${patientId}&category=RAD`);
    results.imagingReports = importDiagnosticReports(imaging, 'imaging');
    
    // Fetch Pathology Reports (DiagnosticReport with category=pathology)
    console.log('    → Fetching pathology reports (DiagnosticReport)...');
    const pathology = await fetchAllPages(accessToken, `DiagnosticReport?patient=${patientId}&category=PAT`);
    results.pathologyReports = importDiagnosticReports(pathology, 'pathology');
    
    // Fetch Clinical Notes (DocumentReference)
    console.log('    → Fetching clinical notes (DocumentReference)...');
    const notes = await fetchAllPages(accessToken, `DocumentReference?patient=${patientId}`);
    results.clinicalNotes = importDocumentReferences(notes, credential.id);
    
    // Fetch Medications (MedicationRequest)
    console.log('    → Fetching medications (MedicationRequest)...');
    const medications = await fetchAllPages(accessToken, `MedicationRequest?patient=${patientId}&status=active`);
    results.medications = importMedicationRequests(medications);
    
    // Fetch Conditions (Condition)
    console.log('    → Fetching conditions/diagnoses (Condition)...');
    const conditions = await fetchAllPages(accessToken, `Condition?patient=${patientId}`);
    results.conditions = importConditions(conditions);
    
    const totalRecords = Object.values(results).reduce((sum, val) => sum + val, 0);
    
    return {
      recordsImported: totalRecords,
      summary: {
        connector: 'Epic MyChart (FHIR)',
        status: 'Success',
        message: `Successfully synced ${totalRecords} records via FHIR API`,
        details: results
      }
    };
    
  } catch (error) {
    console.error('    ✗ Epic FHIR sync failed:', error.message);
    
    return {
      recordsImported: 0,
      summary: {
        connector: 'Epic MyChart (FHIR)',
        status: 'Failed',
        message: error.message,
        details: {
          labResults: 0,
          imagingReports: 0,
          pathologyReports: 0,
          clinicalNotes: 0,
          signateraReports: 0,
          medications: 0,
          vitals: 0,
          conditions: 0
        },
        error: error.message
      }
    };
  }
}

/**
 * Import FHIR Observation resources (labs, vitals, genomic tests)
 * 
 * @param {Array} observations - Array of FHIR Observation resources
 * @param {string} category - Category for filtering (laboratory, vital-signs, genomic)
 * @returns {number} Number of records imported
 */
function importObservations(observations, category) {
  let imported = 0;
  
  for (const obs of observations) {
    try {
      // Skip if not final/amended
      if (!['final', 'amended', 'corrected'].includes(obs.status)) {
        continue;
      }
      
      // Extract test name
      const testName = obs.code?.text || 
                      obs.code?.coding?.[0]?.display || 
                      'Unknown Test';
      
      // Extract value
      let value = null;
      let unit = null;
      
      if (obs.valueQuantity) {
        value = obs.valueQuantity.value;
        unit = obs.valueQuantity.unit || obs.valueQuantity.code;
      } else if (obs.valueString) {
        value = obs.valueString;
      } else if (obs.valueCodeableConcept) {
        value = obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display;
      }
      
      if (!value) {
        continue; // Skip observations without values
      }
      
      // Extract reference range
      let normalLow = null;
      let normalHigh = null;
      
      if (obs.referenceRange && obs.referenceRange.length > 0) {
        const range = obs.referenceRange[0];
        normalLow = range.low?.value || null;
        normalHigh = range.high?.value || null;
      }
      
      // Extract date
      const date = obs.effectiveDateTime || obs.effectivePeriod?.start || obs.issued;
      const formattedDate = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];
      
      // Build result string with unit
      const resultString = unit ? `${value} ${unit}` : String(value);
      
      // Check if abnormal
      const interpretation = obs.interpretation?.[0]?.coding?.[0]?.code;
      const abnormalFlag = ['H', 'HH', 'L', 'LL', 'A'].includes(interpretation) ? interpretation : null;
      
      // Build notes
      const notes = [];
      if (normalLow && normalHigh) {
        notes.push(`Normal range: ${normalLow}-${normalHigh}${unit ? ' ' + unit : ''}`);
      }
      if (abnormalFlag) {
        notes.push(`Flag: ${abnormalFlag}`);
      }
      notes.push(`Source: Epic MyChart (FHIR)`);
      notes.push(`FHIR ID: ${obs.id}`);
      
      // Check for duplicates
      const existing = query(`
        SELECT id FROM test_results 
        WHERE test_name = ? AND date = ? AND result = ?
      `, [testName, formattedDate, resultString]);
      
      if (existing.length === 0) {
        // Insert new result
        if (category === 'vital-signs') {
          // Import to vitals table
          const vitalType = testName.toLowerCase();
          if (vitalType.includes('blood pressure')) {
            // Handle blood pressure specially (systolic/diastolic)
            const [systolic, diastolic] = resultString.split('/').map(v => parseFloat(v.trim()));
            run(`
              INSERT INTO vitals (systolic, diastolic, date, notes)
              VALUES (?, ?, ?, 'Source: Epic MyChart (FHIR)')
            `, [systolic || null, diastolic || null, formattedDate]);
          } else if (vitalType.includes('heart rate') || vitalType.includes('pulse')) {
            run(`
              INSERT INTO vitals (heart_rate, date, notes)
              VALUES (?, ?, 'Source: Epic MyChart (FHIR)')
            `, [parseFloat(value), formattedDate]);
          } else if (vitalType.includes('temperature')) {
            run(`
              INSERT INTO vitals (temperature_f, date, notes)
              VALUES (?, ?, 'Source: Epic MyChart (FHIR)')
            `, [parseFloat(value), formattedDate]);
          } else if (vitalType.includes('weight')) {
            run(`
              INSERT INTO vitals (weight_lbs, date, notes)
              VALUES (?, ?, 'Source: Epic MyChart (FHIR)')
            `, [parseFloat(value), formattedDate]);
          }
        } else {
          // Import to test_results table (labs, genomic tests)
          run(`
            INSERT INTO test_results (test_name, result, date, provider, notes, created_at)
            VALUES (?, ?, ?, 'Epic MyChart (FHIR)', ?, datetime('now'))
          `, [testName, resultString, formattedDate, notes.join('. ')]);
        }
        
        imported++;
      }
    } catch (err) {
      console.error(`      ✗ Error importing observation ${obs.id}:`, err.message);
    }
  }
  
  return imported;
}

/**
 * Import FHIR DiagnosticReport resources (imaging, pathology)
 */
function importDiagnosticReports(reports, category) {
  let imported = 0;
  
  for (const report of reports) {
    try {
      if (!['final', 'amended', 'corrected'].includes(report.status)) {
        continue;
      }
      
      const testName = report.code?.text || report.code?.coding?.[0]?.display || 'Unknown Report';
      const date = report.effectiveDateTime || report.issued || new Date().toISOString();
      const formattedDate = date.split('T')[0];
      
      const conclusion = report.conclusion || report.presentedForm?.[0]?.title || 'See full report';
      
      // Check for duplicates
      const existing = query(`
        SELECT id FROM test_results 
        WHERE test_name = ? AND date = ?
      `, [testName, formattedDate]);
      
      if (existing.length === 0) {
        run(`
          INSERT INTO test_results (test_name, result, date, provider, notes, created_at)
          VALUES (?, ?, ?, 'Epic MyChart (FHIR)', ?, datetime('now'))
        `, [
          `${category === 'imaging' ? '📊' : '🔬'} ${testName}`,
          conclusion.substring(0, 500),
          formattedDate,
          `Category: ${category}. Source: Epic MyChart (FHIR). FHIR ID: ${report.id}`
        ]);
        
        imported++;
      }
    } catch (err) {
      console.error(`      ✗ Error importing diagnostic report ${report.id}:`, err.message);
    }
  }
  
  return imported;
}

// Keywords that flag a clinical note as oncology-relevant
const CANCER_KEYWORDS = [
  'cancer', 'carcinoma', 'tumor', 'tumour', 'malignant', 'malignancy',
  'oncol', 'chemo', 'immunotherapy', 'bladder', 'urothelial', 'metastas',
  'cisplatin', 'gemcitabine', 'pembrolizumab', 'atezolizumab', 'erdafitinib',
  'arid1a', 'fgfr3', 'pik3ca', 'cystoscopy', 'pathology', 'biopsy',
  'radiation', 'checkpoint inhibitor', 'pdl1', 'pd-l1',
];

/**
 * Classify the DocumentReference type from LOINC or category codes.
 */
function classifyNoteType(doc) {
  const loinc = doc.type?.coding?.[0]?.code || '';
  const display = (doc.type?.coding?.[0]?.display || doc.type?.text || '').toLowerCase();

  if (display.includes('pathol') || loinc === '60568-3') return 'pathology';
  if (display.includes('discharg') || loinc === '18842-5') return 'discharge';
  if (display.includes('operat') || display.includes('procedur') || loinc === '11504-8') return 'operative';
  if (display.includes('radiol') || display.includes('imaging') || loinc === '18748-4') return 'imaging';
  if (display.includes('progress') || loinc === '11506-3') return 'progress';
  if (display.includes('consult') || loinc === '11488-4') return 'consult';
  return 'other';
}

/**
 * Extract plain text from a FHIR DocumentReference attachment.
 * Handles base64-encoded text/plain and text/html content types.
 */
function extractNoteText(doc) {
  const content = doc.content || [];
  let text = '';
  let html = '';

  for (const item of content) {
    const att = item.attachment || {};
    if (!att.data) continue;

    let decoded = '';
    try {
      decoded = Buffer.from(att.data, 'base64').toString('utf8');
    } catch {
      continue;
    }

    if (att.contentType?.startsWith('text/html')) {
      html = decoded;
      // Strip tags for plain text version
      text = text || decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } else if (att.contentType?.startsWith('text/plain') || !att.contentType) {
      text = decoded;
    }
  }

  return { text, html };
}

/**
 * Import FHIR DocumentReference resources (clinical notes) into clinical_notes table.
 * @param {Array}  notes        - Array of FHIR DocumentReference resources
 * @param {number} credentialId - portal_credentials.id for the source portal
 * @returns {number} count of newly imported notes
 */
function importDocumentReferences(notes, credentialId = null) {
  // Ensure migration table exists (idempotent DDL)
  try {
    run(`CREATE TABLE IF NOT EXISTS clinical_notes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      fhir_id         TEXT UNIQUE,
      credential_id   INTEGER,
      note_type       TEXT,
      title           TEXT,
      date            TEXT,
      author          TEXT,
      department      TEXT,
      facility        TEXT,
      content_text    TEXT,
      content_html    TEXT,
      loinc_code      TEXT,
      loinc_display   TEXT,
      status          TEXT DEFAULT 'final',
      cancer_relevant INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    )`);
    run(`CREATE INDEX IF NOT EXISTS idx_clinical_notes_date ON clinical_notes(date DESC)`);
  } catch (e) {
    console.error('clinical_notes table init error:', e.message);
    return 0;
  }

  let imported = 0;

  for (const doc of notes) {
    try {
      const fhirId = doc.id || null;
      if (!fhirId) continue;

      // Skip if already stored
      const existing = query('SELECT id FROM clinical_notes WHERE fhir_id = ?', [fhirId]);
      if (existing.length > 0) continue;

      const noteType = classifyNoteType(doc);
      const loincCode = doc.type?.coding?.[0]?.code || null;
      const loincDisplay = doc.type?.coding?.[0]?.display || doc.type?.text || null;
      const title = loincDisplay || 'Clinical Note';
      const date = doc.date || doc.context?.period?.start || null;
      const author = doc.author?.[0]?.display || null;
      const department = doc.context?.practiceSetting?.text || null;
      const facility = doc.custodian?.display || null;
      const status = doc.status || 'final';

      const { text, html } = extractNoteText(doc);

      // Flag oncology relevance
      const combined = (title + ' ' + text + ' ' + (loincDisplay || '')).toLowerCase();
      const cancerRelevant = CANCER_KEYWORDS.some(kw => combined.includes(kw)) ? 1 : 0;

      run(
        `INSERT OR IGNORE INTO clinical_notes
           (fhir_id, credential_id, note_type, title, date, author, department, facility,
            content_text, content_html, loinc_code, loinc_display, status, cancer_relevant)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fhirId, credentialId, noteType, title, date, author, department, facility,
         text || null, html || null, loincCode, loincDisplay, status, cancerRelevant]
      );
      imported++;
    } catch (err) {
      console.error(`      ✗ Error importing DocumentReference ${doc.id}:`, err.message);
    }
  }

  if (imported > 0) {
    console.log(`      ✓ Imported ${imported} clinical note(s)`);
  }
  return imported;
}

/**
 * Import FHIR MedicationRequest resources
 */
function importMedicationRequests(medications) {
  let imported = 0;
  
  for (const med of medications) {
    try {
      const medicationName = med.medicationCodeableConcept?.text || 
                            med.medicationCodeableConcept?.coding?.[0]?.display ||
                            med.medicationReference?.display ||
                            'Unknown Medication';
      
      const dosage = med.dosageInstruction?.[0]?.text || 
                    med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value + ' ' +
                    med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit ||
                    '';
      
      const frequency = med.dosageInstruction?.[0]?.timing?.code?.text || '';
      
      const startDate = med.authoredOn || new Date().toISOString().split('T')[0];
      
      // Check for duplicates
      const existing = query(`
        SELECT id FROM medications 
        WHERE medication_name = ? AND start_date = ?
      `, [medicationName, startDate]);
      
      if (existing.length === 0) {
        run(`
          INSERT INTO medications (medication_name, dosage, frequency, start_date, status, notes)
          VALUES (?, ?, ?, ?, 'active', ?)
        `, [
          medicationName,
          dosage,
          frequency,
          startDate,
          `Source: Epic MyChart (FHIR). FHIR ID: ${med.id}`
        ]);
        
        imported++;
      }
    } catch (err) {
      console.error(`      ✗ Error importing medication ${med.id}:`, err.message);
    }
  }
  
  return imported;
}

/**
 * Import FHIR Condition resources (diagnoses)
 */
function importConditions(conditions) {
  let imported = 0;
  
  for (const condition of conditions) {
    try {
      const conditionName = condition.code?.text || 
                           condition.code?.coding?.[0]?.display ||
                           'Unknown Condition';
      
      const diagnosedDate = condition.onsetDateTime || 
                           condition.recordedDate || 
                           new Date().toISOString().split('T')[0];
      
      const status = condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'active' : 'inactive';
      
      // Check for duplicates
      const existing = query(`
        SELECT id FROM conditions 
        WHERE name = ? AND diagnosed_date = ?
      `, [conditionName, diagnosedDate]);
      
      if (existing.length === 0) {
        run(`
          INSERT INTO conditions (name, diagnosed_date, status, notes)
          VALUES (?, ?, ?, ?)
        `, [
          conditionName,
          diagnosedDate,
          status,
          `Source: Epic MyChart (FHIR). FHIR ID: ${condition.id}`
        ]);
        
        imported++;
      }
    } catch (err) {
      console.error(`      ✗ Error importing condition ${condition.id}:`, err.message);
    }
  }
  
  return imported;
}
