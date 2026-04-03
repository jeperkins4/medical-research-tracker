/**
 * FHIR API Client
 * 
 * Wraps calls to FHIR-compliant servers with token management
 */

import { ensureValidToken, getAuthStatus } from './fhir-auth.js';

/**
 * Generic FHIR API request
 */
const fhirRequest = async (credentialId, fhirServerUrl, endpoint, options = {}) => {
  const { accessToken } = await ensureValidToken(credentialId);
  
  const url = `${fhirServerUrl}/${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/fhir+json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`FHIR API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
};

/**
 * Fetch patient demographics
 */
export const getPatient = async (credentialId, fhirServerUrl, patientId) => {
  return fhirRequest(credentialId, fhirServerUrl, `Patient/${patientId}`);
};

/**
 * Fetch patient conditions
 */
export const getPatientConditions = async (credentialId, fhirServerUrl, patientId) => {
  return fhirRequest(
    credentialId,
    fhirServerUrl,
    `Condition?patient=${patientId}&_count=100`
  );
};

/**
 * Fetch patient medications
 */
export const getPatientMedications = async (credentialId, fhirServerUrl, patientId) => {
  return fhirRequest(
    credentialId,
    fhirServerUrl,
    `MedicationRequest?patient=${patientId}&_count=100`
  );
};

/**
 * Fetch patient observations (vitals, labs)
 */
export const getPatientObservations = async (credentialId, fhirServerUrl, patientId) => {
  return fhirRequest(
    credentialId,
    fhirServerUrl,
    `Observation?patient=${patientId}&_count=100&_sort=-date`
  );
};

/**
 * Fetch patient diagnostic reports
 */
export const getPatientDiagnosticReports = async (credentialId, fhirServerUrl, patientId) => {
  return fhirRequest(
    credentialId,
    fhirServerUrl,
    `DiagnosticReport?patient=${patientId}&_count=100&_sort=-date`
  );
};

/**
 * Fetch patient imaging studies
 */
export const getPatientImagingStudies = async (credentialId, fhirServerUrl, patientId) => {
  return fhirRequest(
    credentialId,
    fhirServerUrl,
    `ImagingStudy?patient=${patientId}&_count=100&_sort=-date`
  );
};

/**
 * Batch fetch common patient resources
 */
export const getPatientBundle = async (credentialId, fhirServerUrl, patientId) => {
  try {
    const [patient, conditions, medications, observations, diagnosticReports] = await Promise.all([
      getPatient(credentialId, fhirServerUrl, patientId),
      getPatientConditions(credentialId, fhirServerUrl, patientId),
      getPatientMedications(credentialId, fhirServerUrl, patientId),
      getPatientObservations(credentialId, fhirServerUrl, patientId),
      getPatientDiagnosticReports(credentialId, fhirServerUrl, patientId)
    ]);

    return {
      patient,
      conditions: conditions.entry || [],
      medications: medications.entry || [],
      observations: observations.entry || [],
      diagnosticReports: diagnosticReports.entry || []
    };
  } catch (error) {
    console.error('Error fetching patient bundle:', error);
    throw error;
  }
};

/**
 * Get current auth status
 */
export const getCurrentAuthStatus = (credentialId) => {
  return getAuthStatus(credentialId);
};
