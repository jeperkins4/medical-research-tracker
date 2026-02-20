# API Reference

**REST API endpoints for MyTreatmentPath.**

Base URL: `http://localhost:3000`

All endpoints require `credentials: 'include'` for cookie-based JWT auth (except public endpoints).

---

## Authentication

### POST /api/auth/register
Create new user account (multi-user support).

**Request:**
```json
{
  "username": "john",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "success": true,
  "username": "john"
}
```

**Cookies:** Sets `auth_token` (HTTP-only, 7 days)

---

### POST /api/auth/login
User login.

**Request:**
```json
{
  "username": "john",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "success": true,
  "username": "john"
}
```

**Cookies:** Sets `auth_token`

---

### POST /api/auth/logout
End user session.

**Response:**
```json
{
  "success": true
}
```

**Cookies:** Clears `auth_token`

---

### GET /api/auth/check
Verify authentication status.

**Response:**
```json
{
  "authenticated": true,
  "username": "john"
}
```

---

### GET /api/auth/needs-setup
Check if first-time setup needed.

**Response:**
```json
{
  "needsSetup": false
}
```

---

## Cloud Sync

### GET /api/sync/status
Get current sync status.

**Response:**
```json
{
  "available": true,
  "cloudConnected": true,
  "supabaseUserId": "82e75502-c890-4854-88ca-ca8799e92bc5",
  "email": "john@example.com",
  "lastSyncedAt": "2026-02-19T12:00:00Z",
  "syncStatus": "synced",
  "unsyncedPapers": 0,
  "lastSyncLog": {
    "sync_type": "research",
    "status": "completed",
    "items_synced": 8
  }
}
```

---

### POST /api/sync/connect
Create Supabase Auth user and link local account.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "cloudpass123"
}
```

**Response:**
```json
{
  "success": true,
  "supabaseUserId": "82e75502-c890-4854-88ca-ca8799e92bc5",
  "alreadySynced": false
}
```

---

### POST /api/sync/research
Sync research papers to cloud.

**Response:**
```json
{
  "success": true,
  "synced": 8
}
```

---

### POST /api/sync/full
Full sync (create user + sync research).

**Request:**
```json
{
  "email": "john@example.com",
  "password": "cloudpass123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "supabaseUserId": "82e75502-c890-4854-88ca-ca8799e92bc5",
    "created": true
  },
  "research": {
    "synced": 8
  }
}
```

---

## Medications

### GET /api/medications
List all medications.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Gemcitabine",
    "dosage": "1000mg/m²",
    "frequency": "Day 1, 8, 15 of 28-day cycle",
    "type": "chemotherapy",
    "active": 1,
    "evidence_level": "fda_approved",
    "genomic_targets": "[\"general\"]"
  }
]
```

---

### POST /api/medications
Add new medication.

**Request:**
```json
{
  "name": "Artemisinin",
  "dosage": "200mg",
  "frequency": "2x daily",
  "type": "integrative",
  "evidence_level": "preclinical",
  "genomic_targets": "[\"ARID1A\"]",
  "notes": "Targets HIF1α hypoxia pathway"
}
```

**Response:**
```json
{
  "id": 42,
  "name": "Artemisinin",
  ...
}
```

---

### PUT /api/medications/:id
Update medication.

**Request:**
```json
{
  "dosage": "300mg",
  "active": 1
}
```

---

### DELETE /api/medications/:id
Remove medication.

**Response:**
```json
{
  "success": true
}
```

---

## Research Papers

### GET /api/papers
Get research library.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Erdafitinib in FGFR3+ Bladder Cancer",
    "authors": "Loriot Y, et al",
    "journal": "N Engl J Med",
    "pmid": "31340094",
    "url": "https://pubmed.ncbi.nlm.nih.gov/31340094",
    "synced_at": "2026-02-19T12:00:00Z"
  }
]
```

---

### POST /api/papers
Save paper to library.

**Request:**
```json
{
  "title": "Artemisinin and Cancer Stem Cells",
  "authors": "Singh NP, Lai HC",
  "journal": "Anticancer Res",
  "pmid": "23803987",
  "type": "research"
}
```

---

### DELETE /api/papers/:id
Remove paper from library.

---

## Lab Results

### GET /api/labs
Get all lab results.

**Response:**
```json
[
  {
    "id": 1,
    "test_name": "Creatinine",
    "result_value": "1.2",
    "result_unit": "mg/dL",
    "reference_range": "0.7-1.3",
    "abnormal_flag": 0,
    "test_date": "2026-02-15",
    "category": "kidney"
  }
]
```

---

### POST /api/labs
Add lab result.

**Request:**
```json
{
  "test_name": "Hemoglobin",
  "result_value": "12.5",
  "result_unit": "g/dL",
  "reference_range": "13.5-17.5",
  "abnormal_flag": 1,
  "test_date": "2026-02-19",
  "category": "cbc"
}
```

---

## Vitals

### GET /api/vitals
Get vitals log.

**Query params:**
- `type` - Filter by type (weight, blood_pressure, etc.)
- `limit` - Max results (default: 100)

**Response:**
```json
[
  {
    "id": 1,
    "type": "weight",
    "value": "165",
    "unit": "lbs",
    "recorded_at": "2026-02-19T08:00:00Z"
  }
]
```

---

### POST /api/vitals
Log vital sign.

**Request:**
```json
{
  "type": "pain_score",
  "value": "3",
  "unit": "/10",
  "notes": "Lower back discomfort"
}
```

---

## Nutrition

### POST /api/meal-analysis
Analyze meal with AI.

**Request:**
```json
{
  "meal_description": "Grilled salmon, steamed broccoli, brown rice",
  "meal_type": "dinner"
}
```

**Response:**
```json
{
  "id": 1,
  "calories": 520,
  "protein_grams": 42,
  "carbs_grams": 48,
  "fat_grams": 18,
  "fiber_grams": 8,
  "genomic_compatibility": {
    "ARID1A": "Broccoli's sulforaphane targets HIF1α",
    "PIK3CA": "Omega-3 in salmon modulates PI3K"
  },
  "recommendations": "Excellent protein/fiber balance...",
  "analysis_model": "claude-sonnet-4-6"
}
```

---

## Genomics

### GET /api/mutations
Get genomic mutations.

**Response:**
```json
[
  {
    "id": 1,
    "gene": "FGFR3",
    "variant_type": "activating",
    "clinical_significance": "driver",
    "pathway": "FGFR signaling",
    "targetable_with": "[\"Erdafitinib\", \"BGJ398\"]",
    "evidence_level": "fda_approved"
  }
]
```

---

### POST /api/mutations
Add genomic mutation.

**Request:**
```json
{
  "gene": "ARID1A",
  "variant_type": "loss_of_function",
  "clinical_significance": "driver",
  "pathway": "Hypoxia/HIF1",
  "targetable_with": "[\"Artemisinin\", \"Keytruda\"]",
  "evidence_level": "clinical_trial"
}
```

---

## Analytics (Optional)

### POST /api/analytics/event
Track anonymized usage event.

**Request:**
```json
{
  "event_type": "medication_added",
  "event_category": "treatment",
  "properties": {
    "medication_type": "supplement"
  }
}
```

**Response:**
```json
{
  "success": true,
  "anonymized": true
}
```

---

## Error Responses

All errors return JSON:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (validation failed)
- `401` - Unauthorized (auth required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Server error
- `503` - Service unavailable (Supabase offline)

---

## Rate Limiting

**Not yet implemented.** Planned for v0.2.0:
- 100 requests/minute per user
- 1000 requests/hour per user

---

## Versioning

**Current API version:** v1 (implicit, no `/v1/` prefix yet)

**Future:** `/api/v2/` when breaking changes needed

---

## Authentication Flow

```javascript
// 1. Register
const res = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username, password })
});

// 2. Subsequent requests (cookie auto-sent)
const medications = await fetch('/api/medications', {
  credentials: 'include'
}).then(r => r.json());

// 3. Logout
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
});
```

---

## Testing

```bash
# Start server
npm run server

# Test endpoint
curl http://localhost:3000/api/auth/needs-setup

# With auth
curl -b cookies.txt http://localhost:3000/api/medications
```

---

**Full API implementation:** `server/index.js`
