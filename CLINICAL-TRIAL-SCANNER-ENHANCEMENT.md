# Clinical Trial Scanner Enhancement

**Date:** March 28, 2026  
**Feature:** Add NCT IDs and recruitment status to nightly research scanner reports

---

## Overview

The nightly Medical Research Scanner report will now include:
1. **Clinical Trial NCT Number** (e.g., NCT04561362)
2. **Direct link to ClinicalTrials.gov** for recruitment status
3. **Recruitment Status** (Actively Recruiting, Enrolling by Invitation, Not Yet Recruiting, Completed, etc.)
4. **Institution/Location** where trial is being conducted

---

## Implementation Plan

### Phase 1: Enhance Research Scanner (research-scanner.js)

**Task 1: Extract NCT IDs from trial search results**

When the scanner finds a clinical trial article, it should:
1. Parse the article snippet/title for NCT numbers (format: `NCT` followed by 8 digits)
2. Extract from common sources:
   - ClinicalTrials.gov search results (natively in URL/title)
   - PubMed results (references in abstract)
   - News articles mentioning trials

**Example patterns:**
```
- "NCT04561362" (DURAVELO-1, BT8009)
- "NCT05299997" (EV-302)
- "NCT03383484" (KEYNOTE-905)
```

**Code location:** `research-scanner.js` line ~140

```javascript
// Extract NCT ID from search results
function extractNCTId(title, snippet, url) {
  // Match NCT followed by exactly 8 digits
  const nctRegex = /NCT\d{8}/gi;
  
  const matches = [...(title + ' ' + snippet).matchAll(nctRegex)];
  return matches.length > 0 ? matches[0][0] : null;
}

// When inserting article
if (article.is_clinical_trial) {
  const nctId = extractNCTId(article.title, article.snippet, article.url);
  if (nctId) {
    article.nct_id = nctId;
    article.clinicaltrials_url = `https://clinicaltrials.gov/study/${nctId}`;
  }
}
```

### Phase 2: Enhance Database Insertion

**Add NCT tracking to news_feed table** (if not already present):

```sql
ALTER TABLE news_feed ADD COLUMN nct_id TEXT;
ALTER TABLE news_feed ADD COLUMN clinicaltrials_url TEXT;
ALTER TABLE news_feed ADD COLUMN is_clinical_trial INTEGER DEFAULT 0;
```

Or create in DB init if new:

```javascript
CREATE TABLE IF NOT EXISTS news_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT UNIQUE,
  snippet TEXT,
  source TEXT,
  published_date TEXT,
  search_term TEXT,
  relevance_score INTEGER,
  nct_id TEXT,                          -- NEW: Clinical trial ID
  clinicaltrials_url TEXT,               -- NEW: Direct link to ClinicalTrials.gov
  is_clinical_trial INTEGER DEFAULT 0,   -- NEW: Mark as trial
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 3: Enhance Report Generation

**Create new report endpoint:** `GET /api/scanner/report/trials`

Returns clinical trials found in last night's scan with:
- Trial name
- **NCT ID** (clickable/copyable)
- **ClinicalTrials.gov link**
- Recruitment status (fetched from ClinicalTrials.gov API)
- Phase
- Condition/Intervention
- Institution
- Relevance score

**Example response:**
```json
{
  "report_date": "2026-03-28",
  "scan_period": "2026-03-27 02:00 - 2026-03-27 03:30",
  "clinical_trials": [
    {
      "title": "DURAVELO-1: Zelenectide Pevedotin (BT8009) plus Pembrolizumab in Cisplatin-Ineligible Patients",
      "nct_id": "NCT04561362",
      "clinicaltrials_url": "https://clinicaltrials.gov/study/NCT04561362",
      "recruitment_status": "Recruiting",
      "phase": "Phase 1/2",
      "condition": "Urothelial Carcinoma",
      "intervention": "Zelenectide pevedotin + Pembrolizumab",
      "sponsor": "Bicycle Therapeutics",
      "locations": ["United States"],
      "relevance_score": 8,
      "source": "PubMed",
      "published_date": "2026-03-25"
    },
    {
      "title": "EV-302: Enfortumab Vedotin and Pembrolizumab vs Chemotherapy in MIBC",
      "nct_id": "NCT05299997",
      "clinicaltrials_url": "https://clinicaltrials.gov/study/NCT05299997",
      "recruitment_status": "Recruiting",
      "phase": "Phase 3",
      "condition": "Muscle Invasive Bladder Cancer",
      "intervention": "Enfortumab vedotin + Pembrolizumab",
      "sponsor": "Astellas Pharma / Pfizer",
      "locations": ["United States", "Europe"],
      "relevance_score": 9,
      "source": "ClinicalTrials.gov",
      "published_date": "2026-03-24"
    }
  ],
  "total_trials_found": 2,
  "recruiting_count": 2,
  "completed_count": 0
}
```

### Phase 4: Frontend Display Enhancement

**Update Research Scanner Report UI** to show:
- Trial name → clickable to ClinicalTrials.gov
- NCT ID → displayed prominently, copy-to-clipboard button
- Recruitment status badge (🟢 Recruiting | 🟡 Enrolling by Invitation | ⚫ Not Yet Recruiting | ✅ Completed)
- Institution/Locations
- Direct "View on ClinicalTrials.gov" button

**Example UI:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔬 Clinical Trials Found Last Night                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ DURAVELO-1: Zelenectide Pevedotin (BT8009) + Pembrolizumab │
│ NCT04561362 [📋 Copy] [🔗 View Trial]                      │
│ Status: 🟢 Actively Recruiting                             │
│ Phase: Phase 1/2 | Sponsor: Bicycle Therapeutics           │
│ Condition: Urothelial Carcinoma                            │
│ Locations: United States (15+ sites)                       │
│ Relevance: ⭐⭐⭐⭐⭐⭐⭐⭐ (8/10)                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ EV-302: Enfortumab Vedotin vs Chemotherapy                 │
│ NCT05299997 [📋 Copy] [🔗 View Trial]                      │
│ Status: 🟢 Actively Recruiting                             │
│ Phase: Phase 3 | Sponsor: Astellas/Pfizer                 │
│ Condition: Muscle Invasive Bladder Cancer                 │
│ Locations: United States, Europe, Asia (40+ sites)        │
│ Relevance: ⭐⭐⭐⭐⭐⭐⭐⭐⭐ (9/10)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## API Integration: ClinicalTrials.gov API

**Fetch recruitment status:**
```javascript
async function getTrialStatus(nctId) {
  const response = await fetch(
    `https://clinicaltrials.gov/api/v2/studies/${nctId}`
  );
  const data = await response.json();
  return {
    nct_id: nctId,
    recruitment_status: data.protocolSection.statusModule.overallStatus,
    phase: data.protocolSection.designModule.phases,
    sponsor: data.protocolSection.sponsorCollaboratorsModule.leadSponsor.name,
    locations: data.protocolSection.contactsLocationsModule.locations
  };
}
```

---

## Search Term Enhancements

**Trials Category (EXISTING):**
```javascript
trials: [
  'bladder cancer clinical trial 2025 site:clinicaltrials.gov',
  'urothelial carcinoma immunotherapy trial NCT',
  'nectin-4 targeted therapy trial 2025',
  'stage IV bladder cancer new treatment trial',
  'MIBC muscle invasive bladder cancer trial',
  'BT8009 DURAVELO trial NCT04561362',
  'EV-302 enfortumab vedotin trial',
  'disitamab vedotin RC48 clinical trial',
]
```

---

## Implementation Checklist

- [ ] **Phase 1:** Enhance `research-scanner.js` with NCT extraction logic
- [ ] **Phase 2:** Add `nct_id`, `clinicaltrials_url`, `is_clinical_trial` columns to news_feed table
- [ ] **Phase 3:** Create `/api/scanner/report/trials` endpoint
- [ ] **Phase 4:** Add ClinicalTrials.gov API calls to fetch recruitment status
- [ ] **Phase 5:** Update frontend React component to display trials with recruitment badges
- [ ] **Phase 6:** Add copy-to-clipboard for NCT IDs
- [ ] **Phase 7:** Add "View on ClinicalTrials.gov" button with direct link
- [ ] **Phase 8:** Test with known trials (DURAVELO-1, EV-302, KEYNOTE-905, etc.)

---

## Example Trials to Test With

| Trial Name | NCT ID | Status | Phase |
|-----------|--------|--------|-------|
| DURAVELO-1 | NCT04561362 | Recruiting | Phase 1/2 |
| EV-302 | NCT05299997 | Recruiting | Phase 3 |
| KEYNOTE-905 | NCT03383484 | Recruiting | Phase 3 |
| TROPiCS-04 | NCT03447743 | Recruiting | Phase 3 |
| NEMIO | NCT03442920 | Recruiting | Phase 1/2 |
| NIAGARA | NCT03775136 | Recruiting | Phase 3 |
| POTOMAC | NCT03539926 | Recruiting | Phase 3 |

---

## Benefits

1. **Easy Trial Lookup:** NCT ID clickable → instant access to recruitment status
2. **Current Status:** See if trial is actively recruiting before contacting
3. **Track Eligibility:** More info on inclusion/exclusion criteria at ClinicalTrials.gov
4. **Save Time:** Don't pursue closed or enrolling-by-invitation trials
5. **Better Research:** Link directly from scanner → trial details in one click

---

## Next Steps

1. Read this enhancement guide in full
2. Implement Phase 1 (NCT extraction in scanner)
3. Add Phase 2 (database columns)
4. Build Phase 3 (report endpoint)
5. Test with real trial data
6. Deploy to production

**Target:** Complete by April 4, 2026
