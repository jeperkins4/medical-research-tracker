# SMART on FHIR Integration Guide

## Overview

SMART on FHIR is the industry standard for healthcare application authentication and data access. It uses OAuth 2.0 with healthcare-specific scopes.

## Step 1: Register Your Application

### Epic MyChart (Most Common)

1. **Go to:** https://fhir.epic.com/Developer/Apps
2. **Click:** "Build Apps" → "Create"
3. **Fill out:**
   - App Name: MyTreatmentPath
   - Application Type: **Patient Standalone**
   - FHIR Specification: **R4**
   - Redirect URI: `http://localhost:3000/api/fhir/callback` (development)
   - Redirect URI: `https://yourdomain.com/api/fhir/callback` (production)

4. **Request Scopes:**
   ```
   patient/Observation.read          # Labs, vitals, Signatera
   patient/DiagnosticReport.read     # Imaging, pathology reports
   patient/DocumentReference.read    # Clinical notes
   patient/MedicationRequest.read    # Prescriptions
   patient/Condition.read            # Diagnoses
   patient/Patient.read              # Patient demographics
   launch/patient                    # Patient context
   offline_access                    # Refresh tokens
   ```

5. **Save your Client ID** - you'll need this

### Cerner (Oracle Health)

1. **Go to:** https://code-console.cerner.com/
2. **Create Account** (requires email verification)
3. **Create App:**
   - App Type: **Patient Facing**
   - FHIR Version: **R4**
   - Redirect URI: Same as Epic
   - Scopes: Same as Epic

4. **Save Client ID and Client Secret**

### Other EHR Systems

- **Allscripts:** https://developer.allscripts.com/
- **athenahealth:** https://docs.athenahealth.com/api/
- **NextGen:** https://www.nextgen.com/api

## Step 2: OAuth 2.0 Flow (SMART on FHIR)

### Authorization Code Flow

```
┌─────────────┐                                  ┌─────────────┐
│             │                                  │             │
│   Patient   │                                  │  EHR FHIR   │
│  (Browser)  │                                  │   Server    │
│             │                                  │   (Epic)    │
└──────┬──────┘                                  └──────┬──────┘
       │                                                │
       │  1. Click "Connect Epic MyChart"              │
       ├──────────────────────────────────────────────►│
       │                                                │
       │  2. Redirect to Epic login                    │
       │◄───────────────────────────────────────────────┤
       │                                                │
       │  3. Patient logs in, approves scopes          │
       ├──────────────────────────────────────────────►│
       │                                                │
       │  4. Redirect back with authorization code     │
       │◄───────────────────────────────────────────────┤
       │                                                │
┌──────▼──────┐                                  ┌──────▼──────┐
│             │  5. Exchange code for token      │             │
│ Your Server │─────────────────────────────────►│  EHR FHIR   │
│             │                                  │   Server    │
│             │  6. Return access + refresh token│             │
│             │◄─────────────────────────────────│             │
│             │                                  │             │
│             │  7. Fetch FHIR resources         │             │
│             │─────────────────────────────────►│             │
│             │                                  │             │
│             │  8. Return patient data          │             │
│             │◄─────────────────────────────────│             │
└─────────────┘                                  └─────────────┘
```

## Step 3: Implementation

### Environment Variables

Add to `.env`:

```bash
# Epic MyChart FHIR
EPIC_CLIENT_ID=your_client_id_from_epic
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_AUTHORIZATION_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token

# Cerner (if using)
CERNER_CLIENT_ID=your_client_id
CERNER_CLIENT_SECRET=your_client_secret
CERNER_FHIR_BASE_URL=https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
CERNER_AUTHORIZATION_URL=https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize
CERNER_TOKEN_URL=https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token

# Your app's base URL
APP_BASE_URL=http://localhost:3000
```

### Key Concepts

#### 1. **Authorization URL** (Step 1)
Where you redirect the patient to login:
```
https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=http://localhost:3000/api/fhir/callback&
  scope=patient/Observation.read patient/Patient.read launch/patient&
  state=random_string_for_security&
  aud=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
```

#### 2. **Token Exchange** (Step 2)
Exchange authorization code for access token:
```
POST https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
redirect_uri=http://localhost:3000/api/fhir/callback&
client_id=YOUR_CLIENT_ID
```

Response:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "patient/Observation.read patient/Patient.read",
  "patient": "Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB",
  "refresh_token": "eyJhbGci..." // if offline_access requested
}
```

#### 3. **FHIR API Calls**
Use the access token to fetch data:
```
GET https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation?patient=Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB&category=laboratory
Authorization: Bearer eyJhbGci...
Accept: application/fhir+json
```

#### 4. **Refresh Tokens**
When access token expires (usually 1 hour):
```
POST https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=REFRESH_TOKEN&
client_id=YOUR_CLIENT_ID
```

## Step 4: FHIR Resource Mapping

### Labs (Observation)
```json
{
  "resourceType": "Observation",
  "id": "123",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "laboratory"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "2345-7",
      "display": "Glucose"
    }],
    "text": "Glucose"
  },
  "subject": { "reference": "Patient/123" },
  "effectiveDateTime": "2024-02-15T10:30:00Z",
  "valueQuantity": {
    "value": 95,
    "unit": "mg/dL",
    "system": "http://unitsofmeasure.org",
    "code": "mg/dL"
  },
  "referenceRange": [{
    "low": { "value": 70, "unit": "mg/dL" },
    "high": { "value": 100, "unit": "mg/dL" }
  }]
}
```

**Map to:** `test_results` table

### Medications (MedicationRequest)
```json
{
  "resourceType": "MedicationRequest",
  "id": "456",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "197361",
      "display": "Gemcitabine"
    }],
    "text": "Gemcitabine 1000 mg"
  },
  "subject": { "reference": "Patient/123" },
  "dosageInstruction": [{
    "text": "1000 mg IV on days 1, 8, 15 of 28-day cycle",
    "timing": {
      "repeat": { "frequency": 3, "period": 28, "periodUnit": "d" }
    }
  }]
}
```

**Map to:** `medications` table

### Imaging (DiagnosticReport)
```json
{
  "resourceType": "DiagnosticReport",
  "id": "789",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
      "code": "RAD"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "24627-2",
      "display": "CT Chest with contrast"
    }]
  },
  "subject": { "reference": "Patient/123" },
  "effectiveDateTime": "2024-02-15",
  "conclusion": "No evidence of metastatic disease. Stable primary tumor."
}
```

**Map to:** `test_results` table with `category='imaging'`

## Step 5: Security Considerations

### ✅ DO:
- Store access/refresh tokens encrypted in the database
- Use HTTPS in production (redirect URIs must be HTTPS)
- Validate the `state` parameter to prevent CSRF
- Set token expiration and auto-refresh before expiry
- Log all FHIR API access for audit trail

### ❌ DON'T:
- Store tokens in localStorage (use secure httpOnly cookies or encrypted DB)
- Hardcode client secrets in code (use environment variables)
- Request more scopes than you need
- Share tokens across users

## Step 6: Testing

### Epic Sandbox
Epic provides a sandbox for testing:
- **Sandbox Base URL:** https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
- **Test Patient:** Use Epic's test patient credentials
- **No real data** - safe for development

### Cerner Sandbox
- **Sandbox Base URL:** https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
- **Test Patient IDs provided** in Cerner Code Console

## Next Steps

1. Register your app with Epic (or your EHR vendor)
2. Add environment variables to `.env`
3. Implement OAuth flow (see `server/fhir/epic-connector.js`)
4. Test with sandbox
5. Map FHIR resources to your database schema
6. Deploy to production with real credentials

## Resources

- **SMART on FHIR Spec:** http://hl7.org/fhir/smart-app-launch/
- **Epic FHIR Docs:** https://fhir.epic.com/Documentation
- **Cerner FHIR Docs:** https://fhir.cerner.com/
- **FHIR R4 Spec:** http://hl7.org/fhir/R4/
- **HL7 FHIR Forums:** https://chat.fhir.org/

## Common Issues

### "Invalid redirect_uri"
- Make sure redirect URI in authorization URL **exactly matches** what you registered
- Must be HTTPS in production (http://localhost OK for dev)

### "Invalid scope"
- Check that you requested the scope during app registration
- Epic requires `launch/patient` for standalone launch

### "Token expired"
- Access tokens expire after 1 hour
- Implement refresh token flow
- Store `expires_in` and refresh proactively

### "CORS errors"
- FHIR endpoints support CORS for browser-based apps
- If using server-side, no CORS issues

### "Patient context not found"
- Make sure you include `launch/patient` scope
- Patient ID is returned in token response as `patient` field
