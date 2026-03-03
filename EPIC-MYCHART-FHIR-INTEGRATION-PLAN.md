# Epic MyChart / FHIR Integration Plan (MRT)

## Goal
Make Epic MyChart data sync first-class in MRT (desktop + web), replacing fragile portal scraping where possible, while preserving HIPAA-safe local-first behavior.

---

## Current State (already present)
- `server/fhir-routes.js` exists
- Setup docs exist (`FHIR-QUICKSTART.md`, `FHIR-SETUP-GUIDE.md`)
- OAuth + callback flow scaffolded
- Import paths for observations/diagnostics/medications already conceptually defined

---

## Phase 1 — Productionize OAuth + Connection UX (P0)

### Deliverables
1. **PortalManager UI wiring**
   - Add explicit "Connect Epic MyChart (FHIR)" CTA
   - Show connection state: Connected / Token expired / Reconnect required
   - Show last sync timestamp + last sync result

2. **OAuth token safety + lifecycle**
   - Encrypt refresh/access tokens at rest (same app encryption policy)
   - Auto-refresh token before sync
   - Graceful reconnect flow on refresh failure

3. **Environment guardrails**
   - Validate `EPIC_CLIENT_ID`, callback URL, and APP_BASE_URL on startup
   - Human-readable startup warning if misconfigured

### Acceptance Criteria
- User can connect MyChart from UI and return successfully
- Repeated sync does not require re-login under normal token lifecycle
- Connection status is visible in app

---

## Phase 2 — Reliable Data Ingestion + Mapping (P0/P1)

### Resources to sync
- Patient
- Observation (labs + vitals)
- DiagnosticReport (imaging/path reports)
- MedicationRequest (active meds)
- Condition (problem list)
- DocumentReference (clinical docs)

### Mapping policy
- **Observation.category=laboratory** -> `test_results`
- **Observation.category=vital-signs** -> `vitals`
- **MedicationRequest** -> `medications` (type inference for rx/otc where possible)
- **Condition** -> `conditions`
- **DiagnosticReport / DocumentReference** -> `portal_documents`

### De-dup strategy (required)
- Use deterministic source keys:
  - `(source_system='epic_fhir', resource_type, resource_id)`
- Add source metadata columns if missing
- Upsert, never blind insert

### Acceptance Criteria
- Full sync imports data once and remains idempotent
- No duplicate rows across repeated syncs
- Every imported record has source metadata + import timestamp

---

## Phase 3 — Clinical Fidelity + Normalization (P1)

### LOINC/SNOMED normalization
- Preserve original coding + display text
- Normalize known markers to canonical internal names for trend charts
- Add units normalization where needed (e.g., mg/dL variants)

### Priority marker set for MRT dashboards
- CBC: WBC, Hgb, Platelets, ANC
- CMP: Creatinine, eGFR, AST, ALT, Alk Phos, Bilirubin
- Inflammation/metabolic when available
- ctDNA/Signatera (where coded + available)

### Acceptance Criteria
- Trend charts use stable canonical keys
- Raw source values remain auditable

---

## Phase 4 — UX Integration into Daily Workflow (P1)

### UI changes
- Portals tab: Sync Now + Last Sync + New Since Last Sync count
- Overview: "Today from Epic" card (new labs/docs/med changes)
- Notifications: inline sync result summary (success/warnings/errors)

### Error experience
- Replace generic failures with actionable messages:
  - "Reconnect Epic"
  - "Scope missing"
  - "No new records"

### Acceptance Criteria
- User can see what changed since prior sync in <10 seconds
- Sync failures are understandable and actionable

---

## Phase 5 — Supabase/Cloud Sync Compatibility (P2)

### Required updates
- Mirror new FHIR source metadata columns/tables to Supabase schema
- Add RLS-safe sync routines for source-tagged records
- Ensure local-first remains default; cloud optional

### Scripts to run (when cloud sync path is enabled)
- Add migration for:
  - source metadata columns
  - OAuth connection metadata table (without raw token exposure)
  - sync audit table

---

## Security & Compliance Requirements (non-negotiable)
- Never log tokens
- Encrypt OAuth tokens at rest
- Use least-privilege SMART scopes
- Maintain audit trail for sync events
- Keep "not medical advice" language in app docs

---

## Technical Task Breakdown (2-week cut)

### Week 1 (P0)
1. PortalManager connect/reconnect/status UI
2. OAuth/token refresh hardening
3. Idempotent upsert with source keys
4. Sync result summary object + UI feedback

### Week 2 (P1)
1. Marker normalization layer
2. "Today from Epic" card
3. Sync delta summary (new labs/docs/med changes)
4. End-to-end QA: connect -> sync -> re-sync -> reconnect

---

## QA Checklist (must pass before broad release)
- Fresh connect works
- Token refresh works without user interaction
- Reconnect after revocation works
- Duplicate protection verified across 3 consecutive syncs
- New lab appears in trends with correct units
- Failure messages are actionable

---

## Nice-to-Have Next
- Multi-provider FHIR abstraction (Epic first, Cerner next)
- Background scheduled sync
- Per-resource sync toggles (labs only / meds only)

