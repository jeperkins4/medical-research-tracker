# Portal Sync Data Priorities

## User Requirements (2026-02-12)

**Focus on clinical data, not nursing documentation.**

### Priority Order:

1. **🔬 Lab Results** (HIGH PRIORITY)
   - All lab work (CBC, metabolic panels, tumor markers, etc.)
   - FHIR: `Observation` with category `laboratory`
   - Include reference ranges and abnormal flags

2. **📊 Imaging/Scans** (HIGH PRIORITY)
   - CT scans, MRI, PET scans, X-rays
   - FHIR: `DiagnosticReport` with category `radiology`
   - `ImagingStudy` resource if available
   - Include radiologist findings/impressions

3. **🔬 Pathology Reports** (HIGH PRIORITY)
   - Tissue biopsies, surgical pathology
   - FHIR: `DiagnosticReport` with category `pathology`
   - Critical for cancer diagnosis/staging

4. **📄 Doctor Notes** (HIGH PRIORITY)
   - Clinical notes from providers (oncologist, surgeon, etc.)
   - FHIR: `DocumentReference` 
   - **EXCLUDE**: Nursing notes, care coordination notes
   - **FILTER**: author.role = Physician, NP, PA (not RN)

5. **🧬 Signatera Reports** (HIGH PRIORITY)
   - Circulating tumor DNA (ctDNA) genomic testing
   - Tracks minimal residual disease
   - FHIR: `Observation` with code LOINC `96603-3` or similar
   - May also appear as `DiagnosticReport`
   - Vendor: Natera

6. **💊 Medications** (MEDIUM PRIORITY)
   - Active prescriptions
   - FHIR: `MedicationRequest` (prescriptions), `MedicationStatement` (patient-reported)
   - Include dosage, frequency, start/end dates

7. **📈 Vitals** (MEDIUM PRIORITY)
   - Blood pressure, heart rate, weight, temperature
   - FHIR: `Observation` with category `vital-signs`
   - Useful for monitoring trends

## Excluded Data:

- ❌ Nursing notes/documentation
- ❌ Care coordination notes
- ❌ Administrative documents
- ❌ Billing/insurance records
- ❌ Appointment scheduling (unless includes clinical summary)

## FHIR Resource Mapping:

### Epic MyChart (SMART on FHIR)

**Endpoints to query:**
```
GET /Observation?patient={id}&category=laboratory
GET /Observation?patient={id}&category=vital-signs
GET /Observation?patient={id}&code=96603-3  # Signatera if coded
GET /DiagnosticReport?patient={id}&category=LAB
GET /DiagnosticReport?patient={id}&category=RAD
GET /DiagnosticReport?patient={id}&category=PAT
GET /DocumentReference?patient={id}&type=clinical-note
GET /MedicationRequest?patient={id}&status=active
GET /ImagingStudy?patient={id}
```

**Filters:**
- DocumentReference: Check `author.role` to exclude RN-authored notes
- Observation: Use `category` to distinguish labs from vitals
- DiagnosticReport: Use `category` to separate labs/imaging/pathology

### CareSpace / Generic Portals (Browser Automation)

**Navigate to:**
1. Lab Results section → download all available
2. Imaging/Radiology section → download reports (not just orders)
3. Pathology section → download tissue reports
4. Clinical Notes → filter by author if possible
5. Test Results → look for Signatera/genomic tests
6. Medications → active prescriptions list

**File types to handle:**
- PDF reports (OCR if needed)
- HTML reports (parse tables)
- CSV/Excel downloads (if available)
- Embedded images (DICOM for imaging - may need viewer)

## Database Schema Considerations:

New tables may be needed:
- `imaging_studies` (separate from test_results)
- `pathology_reports` (structured fields for cancer staging)
- `clinical_notes` (with author, specialty, note type)
- `genomic_tests` (Signatera, Foundation One, etc.)

Or extend `test_results` with:
- `category` field (lab, imaging, pathology, genomic)
- `report_pdf` blob field
- `structured_data` JSON field

## Signatera-Specific Notes:

- Test detects circulating tumor DNA
- Used for monitoring recurrence/minimal residual disease
- Reports include:
  - ctDNA detected/not detected
  - Mean tumor molecules per mL
  - Trending over time (critical)
- May be reported as separate vendor portal (Natera)
- Important to track longitudinally

## Implementation Priority:

1. **Phase 2 (Next)**: Epic MyChart FHIR connector
   - Focus on labs, imaging reports, pathology first
   - Then doctor notes with RN filtering
   - Signatera detection via LOINC codes or report text

2. **Phase 3**: CareSpace browser automation
   - PDF download + parsing
   - Section detection and navigation

3. **Phase 4**: Generic fallback
   - Playwright automation for any portal
   - Manual mapping configuration per portal type
