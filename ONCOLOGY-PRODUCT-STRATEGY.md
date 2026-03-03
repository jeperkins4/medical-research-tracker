# Oncology Decision Support — Product Strategy v1.0
**Medical Research Tracker | Clinical Product Strategist Output**  
*March 2026 | Target: v0.2.x releases*

---

## Executive Summary

MRT has the right bones: a working Electron app, SQLite backend, portal sync, lab import, medication evidence modals, and basic research search. The gap is **clinical coherence** — the features don't connect in a way that helps John walk into an oncologist appointment prepared, make evidence-grounded decisions, or optimize his daily survival inputs.

This document defines five priority modules, the exact data model and API changes needed, and a sequenced rollout that adds zero regression risk to existing functionality.

---

## The Five Modules

| # | Module | Oncology Value | Risk |
|---|--------|----------------|------|
| 1 | **Evidence Grading** | Distinguish Phase III RCT from anecdote | 🟢 Additive DB columns only |
| 2 | **Actionable Research Linking** | Connect papers → meds/conditions/mutations | 🟢 New join tables |
| 3 | **Trial Matching Panel** | Structured eligibility vs. John's profile | 🟡 Extends clinical_trials |
| 4 | **Visit-Prep One-Pager** | Printable/exportable appointment brief | 🟢 Read-only aggregate query |
| 5 | **Survival Optimization Dashboard** | Nutrition/exercise/sleep/symptoms composite | 🟡 New tables + new component |

---

## Module 1: Evidence Grading

### The Problem
`papers` table has no quality signal. A Phase III RCT and a Reddit anecdote look identical.

### Data Model Changes (additive — no migrations break anything)

```sql
-- Add to existing papers table via ALTER TABLE (safe, nullable columns)
ALTER TABLE papers ADD COLUMN evidence_level TEXT 
  CHECK (evidence_level IN ('1a','1b','2a','2b','3','4','5')) DEFAULT NULL;
  -- 1a = systematic review of RCTs
  -- 1b = individual RCT
  -- 2a = systematic review of cohort studies
  -- 2b = individual cohort / low-quality RCT
  -- 3  = case-control study
  -- 4  = case series / poor cohort
  -- 5  = expert opinion / mechanism only

ALTER TABLE papers ADD COLUMN grade TEXT 
  CHECK (grade IN ('A','B','C','D')) DEFAULT NULL;
  -- Oxford CEBM grade (A = strong, D = weak)

ALTER TABLE papers ADD COLUMN study_design TEXT DEFAULT NULL;
  -- 'RCT', 'observational', 'meta-analysis', 'case-report', 'preclinical', 'review'

ALTER TABLE papers ADD COLUMN sample_size INTEGER DEFAULT NULL;
ALTER TABLE papers ADD COLUMN outcome_relevance TEXT DEFAULT NULL;
  -- 'overall_survival', 'progression_free_survival', 'response_rate', 
  -- 'quality_of_life', 'biomarker', 'mechanism'

ALTER TABLE papers ADD COLUMN is_actionable INTEGER DEFAULT 0;
  -- 1 = John can act on this now (change supplement, ask about trial, etc.)

ALTER TABLE papers ADD COLUMN action_note TEXT DEFAULT NULL;
  -- Free text: "Ask Sonpavde about erdafitinib dosing for FGFR3"
```

### API Endpoints

```
PATCH /api/papers/:id/grade
  Body: { evidence_level, grade, study_design, sample_size, outcome_relevance, is_actionable, action_note }
  → Updates grading fields on existing paper

GET /api/papers?grade=A&outcome=overall_survival&actionable=1
  → Filtered paper list (extend existing query with WHERE clauses)
```

### UI: ResearchSearch.jsx Enhancement

**In the existing "saved" tab** — add a grade badge next to each paper:
- `[A]` green badge, `[B]` yellow, `[C]` orange, `[D]` gray
- Actionable papers get a `⚡ Action` chip that shows `action_note` on hover
- Filter bar: Evidence Level | Grade | Outcome Type | Actionable only toggle
- When adding a paper: inline grade form (5 fields, takes 30 seconds to fill)

**Effort:** ~1 day. Zero regression — only adds UI to existing component.

---

## Module 2: Actionable Research Linking

### The Problem
Papers, medications, conditions, and genomic mutations exist in silos. There's no way to know: "Which papers support my FGFR3 mutation treatment?" or "What's the evidence base for erdafitinib specifically?"

### Data Model Changes

```sql
-- Link papers to medications
CREATE TABLE IF NOT EXISTS paper_medications (
  paper_id   INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'supports',
    -- 'supports', 'contradicts', 'mechanism', 'alternative', 'synergy', 'caution'
  note TEXT,
  PRIMARY KEY (paper_id, medication_id)
);

-- Link papers to conditions
CREATE TABLE IF NOT EXISTS paper_conditions (
  paper_id     INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  condition_id INTEGER NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'relevant',
  PRIMARY KEY (paper_id, condition_id)
);

-- Link papers to genomic mutations (reference by mutation name string — no FK needed)
CREATE TABLE IF NOT EXISTS paper_mutations (
  paper_id      INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  mutation_name TEXT NOT NULL,  -- 'FGFR3', 'ARID1A', 'PIK3CA', etc.
  relationship  TEXT DEFAULT 'targeted',
  PRIMARY KEY (paper_id, mutation_name)
);

-- Link papers to clinical trials
CREATE TABLE IF NOT EXISTS paper_trials (
  paper_id  INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  trial_id  INTEGER NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, trial_id)
);
```

### API Endpoints

```
POST /api/papers/:id/links
  Body: { medications: [id,...], conditions: [id,...], mutations: ['FGFR3',...], trials: [id,...] }
  → Upsert all link tables in one call

GET /api/medications/:id/evidence
  → All papers linked to this medication with grade, evidence_level, action_note

GET /api/research/by-mutation/:mutation
  → Papers linked to FGFR3, ARID1A, etc. — sorted by grade DESC

GET /api/research/actionable
  → All papers where is_actionable=1, joined with linked medications/mutations
```

### UI: MedicationManager.jsx + ResearchSearch.jsx

**MedicationManager:** Each medication row gets a `📄 N papers` badge. Click → slide-out panel showing linked papers with grade badges. "Link Paper" button opens search-and-select from saved papers.

**ResearchSearch:** "Add Links" button on each saved paper. Multi-select from: medications, conditions, mutations (checkboxes), trials. Save links in one call.

**Effort:** ~2 days. Additive — existing components get new panels bolted on.

---

## Module 3: Trial Matching Panel

### The Problem
`clinical_trials` table is a flat dump: NCT ID, title, status, phase. There's no eligibility matching, no fit score, no connection to John's actual profile.

### Data Model Changes

```sql
-- Extend clinical_trials (additive columns)
ALTER TABLE clinical_trials ADD COLUMN sponsor TEXT DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN primary_endpoint TEXT DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN enrollment_target INTEGER DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN estimated_completion TEXT DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN contact_name TEXT DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN contact_email TEXT DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN contact_phone TEXT DEFAULT NULL;
ALTER TABLE clinical_trials ADD COLUMN eligibility_json TEXT DEFAULT NULL;
  -- JSON: { inclusion: [...], exclusion: [...] }
ALTER TABLE clinical_trials ADD COLUMN john_fit_score INTEGER DEFAULT NULL;
  -- 0-100, manually set after reviewing eligibility
ALTER TABLE clinical_trials ADD COLUMN john_fit_notes TEXT DEFAULT NULL;
  -- "Eligible IF creatinine < 1.5 — check Jan 23 labs"
ALTER TABLE clinical_trials ADD COLUMN priority TEXT DEFAULT 'watch'
  CHECK (priority IN ('apply-now','discuss-next-visit','watch','not-eligible','enrolled'));
ALTER TABLE clinical_trials ADD COLUMN last_reviewed TEXT DEFAULT NULL;

-- Eligibility criteria as structured rows (for matching)
CREATE TABLE IF NOT EXISTS trial_eligibility (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trial_id   INTEGER NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('inclusion','exclusion')),
  criterion  TEXT NOT NULL,
  -- John's match status against this specific criterion
  john_match TEXT DEFAULT 'unknown' 
    CHECK (john_match IN ('yes','no','unknown','conditional')),
  match_note TEXT
);

-- Link trials to mutations (for FGFR3-specific trials, etc.)
CREATE TABLE IF NOT EXISTS trial_mutations (
  trial_id      INTEGER NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
  mutation_name TEXT NOT NULL,
  PRIMARY KEY (trial_id, mutation_name)
);
```

### API Endpoints

```
GET /api/trials?priority=apply-now&mutation=FGFR3
  → Filtered trial list with fit scores

GET /api/trials/:id/eligibility
  → Full eligibility breakdown with john_match per criterion

PATCH /api/trials/:id/eligibility/:criterionId
  Body: { john_match, match_note }
  → Update John's match status for one criterion

PATCH /api/trials/:id/priority
  Body: { priority, john_fit_score, john_fit_notes }
  → Update fit assessment

GET /api/trials/matched
  → Trials where fit_score >= 70, sorted by priority
```

### New UI Component: TrialMatchingPanel.jsx

**Layout:** Three-column Kanban:
- `🔴 Apply Now` — high fit, open enrollment
- `🟡 Discuss Next Visit` — good fit, needs doctor conversation
- `⚪ Watch` — promising but not ready yet

Each trial card shows:
- NCT ID + title (links to ClinicalTrials.gov)
- Phase badge + status badge
- Fit score bar (0-100)
- Top 3 eligibility flags (✅ meets, ❌ blocks, ⚠️ conditional)
- Linked mutations (FGFR3 chip, etc.)
- Contact info (one-click email)

**Add to App.jsx** as new tab `trials` between `research` and `summary`.

**Effort:** ~2.5 days. New component + simple Kanban. Existing tabs untouched.

---

## Module 4: Visit-Prep One-Pager

### The Problem
Before each oncology appointment, John manually assembles context. This should be automatic.

### Data Model Changes

None. This is a **read-only aggregate** over existing tables.

### API Endpoint

```
GET /api/visit-prep?appointment_id=:id
  → Assembled one-pager JSON

Response shape:
{
  appointment: { date, provider, department, visit_type },
  since_last_visit: {
    new_labs: [...test_results since last appointment],
    new_symptoms: [...symptoms],
    medication_changes: [...started/stopped],
    exercise_summary: { sessions, avg_duration, types },
    pain_trend: { avg_severity, worst_day, notes }
  },
  top_questions: [...action_notes from is_actionable papers, deduplicated],
  priority_trials: [...trials where priority='apply-now' or 'discuss-next-visit'],
  current_medications: [...active meds with evidence grade summary],
  key_labs: {
    // Latest value for each tracked lab with trend arrow
    creatinine: { value, date, trend, normal_range },
    hemoglobin: { ... },
    // etc.
  },
  genomic_summary: "FGFR3+ / ARID1A-deficient / PIK3CA activated — erdafitinib eligible"
}
```

### New UI Component: VisitPrepOnePager.jsx

**Trigger:** "Prep for Visit" button on any upcoming appointment in the app.

**Layout (print-optimized, single page):**
```
┌─────────────────────────────────────────────────────┐
│  VISIT BRIEF — Dr. Sonpavde  |  March 10, 2026      │
├──────────────────┬──────────────────────────────────┤
│ SINCE LAST VISIT │ TOP QUESTIONS FOR DOCTOR          │
│ • 3 new labs     │ 1. Ask about erdafitinib dosing   │
│ • Pain avg 4.2   │ 2. FORT-2 trial eligibility?      │
│ • 8 exercise ses │ 3. Creatinine trending up — why?  │
├──────────────────┼──────────────────────────────────┤
│ KEY LABS         │ ACTIVE MEDICATIONS (8)            │
│ Creatinine 1.2↑  │ erdafitinib 8mg — Grade B evidence│
│ Hgb 11.4 →       │ + 7 more...                      │
├──────────────────┴──────────────────────────────────┤
│ PRIORITY TRIALS                                      │
│ • NCT04517084 — FORT-2 (FGFR3+) — Apply Now        │
│ • NCT05827887 — ARID1A synthetic lethality — Watch  │
├─────────────────────────────────────────────────────┤
│ GENOMIC: FGFR3+ / ARID1A-deficient / PIK3CA active │
└─────────────────────────────────────────────────────┘
```

Buttons: `🖨️ Print` | `📋 Copy as Text` | `📤 Export PDF`

**Add to App.jsx** as tab `visit-prep` or as a modal launched from PortalManager's appointments list.

**Effort:** ~1.5 days. Mostly a query + display component. No new data writes.

---

## Module 5: Survival Optimization Dashboard

### The Problem
Nutrition, exercise, sleep, pain, and symptoms are tracked in separate components with no unified view. There's no correlation analysis, no daily score, no trend over treatment cycles.

### Data Model Changes

```sql
-- Sleep tracking (missing — exercise_logs exists but not sleep)
CREATE TABLE IF NOT EXISTS sleep_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,
  hours       REAL,
  quality     INTEGER CHECK (quality BETWEEN 1 AND 5),
  -- 1=poor, 5=excellent
  disruptions INTEGER DEFAULT 0,
  notes       TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Daily survival score (computed + manually overridable)
CREATE TABLE IF NOT EXISTS daily_scores (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL UNIQUE,
  -- Component scores (0-100 each)
  nutrition_score INTEGER DEFAULT NULL,
  exercise_score  INTEGER DEFAULT NULL,
  sleep_score     INTEGER DEFAULT NULL,
  symptom_score   INTEGER DEFAULT NULL,  -- inverse of symptom burden
  -- Composite
  survival_score  INTEGER DEFAULT NULL,  -- weighted average
  -- Weights (can tune over time)
  nutrition_weight REAL DEFAULT 0.30,
  exercise_weight  REAL DEFAULT 0.25,
  sleep_weight     REAL DEFAULT 0.25,
  symptom_weight   REAL DEFAULT 0.20,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Symptom categories (extend existing symptoms table context)
ALTER TABLE symptoms ADD COLUMN category TEXT DEFAULT 'general'
  CHECK (category IN ('treatment-side-effect','cancer-related','comorbidity','general'));
ALTER TABLE symptoms ADD COLUMN treatment_related INTEGER DEFAULT 0;
```

### Score Computation Logic (server-side, run nightly or on-demand)

```javascript
// server/survival-score.js
function computeDailyScore(date, db) {
  // nutrition_score: 0=no log, 50=partial, 80=logged, 100=logged + protocol adherent
  // exercise_score: 0=none, 60=light, 80=moderate, 100=vigorous (oncology: moderate = optimal)
  // sleep_score: map hours(0→0, 6→50, 7→80, 8→100, 9→90) * quality/5
  // symptom_score: 100 - (avg_severity * 10) — low symptoms = high score
}
```

### API Endpoints

```
POST /api/sleep
  Body: { date, hours, quality, disruptions, notes }

GET /api/sleep?days=30
  → Last N days of sleep logs

GET /api/survival-scores?days=90
  → Daily scores for trend chart

POST /api/survival-scores/compute
  → Trigger recomputation for date range
  Body: { start_date, end_date }

GET /api/survival-dashboard
  → Last 30-day summary: avg scores per component, trend direction, 
    best/worst days, correlation hints
```

### New UI Component: SurvivalDashboard.jsx

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  SURVIVAL OPTIMIZATION  |  30-day view              │
│  Today's Score: 74/100  ████████░░  [Trending ↑]   │
├────────────┬────────────┬────────────┬──────────────┤
│ 🥦 NUTRIT  │ 🏃 EXERCISE│ 😴 SLEEP  │ 🩺 SYMPTOMS │
│ 82/100 ↑  │ 68/100 →  │ 71/100 ↑  │ 76/100 ↑   │
│ 24 of 30  │ 18 sessions│ 7.2h avg  │ Avg 3.1/10  │
│ days logged│ 42 min avg │ 4.1 qual  │ fatigue 4.2 │
├─────────────────────────────────────────────────────┤
│ 90-DAY TREND                                        │
│ [Line chart: survival score over time, treatment    │
│  cycle boundaries marked as vertical lines]         │
├─────────────────────────────────────────────────────┤
│ CORRELATIONS (experimental)                         │
│ • Sleep >7h → symptom score +14 pts next day       │
│ • Exercise days → better sleep quality (+0.8)       │
│ • Low nutrition days cluster around treatment weeks │
├─────────────────────────────────────────────────────┤
│ TODAY'S PROTOCOL                                    │
│ ✅ Supplement stack logged                          │
│ ⚠️ Exercise — not logged yet                       │
│ ❌ Sleep — log last night                           │
└─────────────────────────────────────────────────────┘
```

**Quick-log panel** (bottom sheet or sidebar):
- Sleep: hours (slider) + quality (1-5 stars)
- Exercise: type (walk/swim/strength/yoga) + duration + perceived effort
- Symptoms: severity (slider) + category + note
- All three in ~45 seconds total

**Add to App.jsx** as tab `survival` — primary tab, possibly the new default.

**Effort:** ~3 days. Largest module but self-contained.

---

## Data Model Summary (all changes)

### New Tables
| Table | Purpose | Risk |
|-------|---------|------|
| `paper_medications` | Research linking | 🟢 New |
| `paper_conditions` | Research linking | 🟢 New |
| `paper_mutations` | Research linking | 🟢 New |
| `paper_trials` | Research linking | 🟢 New |
| `trial_eligibility` | Per-criterion matching | 🟢 New |
| `trial_mutations` | Trial → mutation link | 🟢 New |
| `sleep_logs` | Sleep tracking | 🟢 New |
| `daily_scores` | Survival score history | 🟢 New |

### Altered Tables (additive nullable columns only — zero migration risk)
| Table | New Columns |
|-------|------------|
| `papers` | `evidence_level`, `grade`, `study_design`, `sample_size`, `outcome_relevance`, `is_actionable`, `action_note` |
| `clinical_trials` | `sponsor`, `primary_endpoint`, `enrollment_target`, `estimated_completion`, `contact_name/email/phone`, `eligibility_json`, `john_fit_score`, `john_fit_notes`, `priority`, `last_reviewed` |
| `symptoms` | `category`, `treatment_related` |

**Total new SQL:** ~80 lines, all safe ALTER TABLE + CREATE TABLE IF NOT EXISTS.

---

## API Endpoint Summary

### New Endpoints (all new — no existing routes touched)
```
Research / Evidence:
  PATCH  /api/papers/:id/grade
  GET    /api/papers (extended query params)
  POST   /api/papers/:id/links
  GET    /api/medications/:id/evidence
  GET    /api/research/by-mutation/:mutation
  GET    /api/research/actionable

Trials:
  GET    /api/trials (extended query params)
  GET    /api/trials/:id/eligibility
  PATCH  /api/trials/:id/eligibility/:criterionId
  PATCH  /api/trials/:id/priority
  GET    /api/trials/matched

Visit Prep:
  GET    /api/visit-prep

Sleep & Survival:
  POST   /api/sleep
  GET    /api/sleep
  GET    /api/survival-scores
  POST   /api/survival-scores/compute
  GET    /api/survival-dashboard
```

---

## Rollout Order (Regression-Safe Sequence)

### Sprint 1 — Evidence Grading (3-4 days)
**Why first:** Purely additive. ALTER TABLE + UI badges on existing component. If anything breaks, revert the ALTER (columns are nullable, no data lost).

1. `migrations/add-evidence-grading.sql` — ALTER TABLE papers
2. `server/research-routes.js` — add PATCH /api/papers/:id/grade + extend GET /api/papers
3. `ResearchSearch.jsx` — add grade badges + filter bar + grade form on add/edit

**Validation:** Existing paper save/load still works. New grade fields show as empty but visible.

---

### Sprint 2 — Research Linking (3-4 days)
**Why second:** Depends on grading being done (you grade before you link). New tables only — no existing routes touched.

1. `migrations/add-research-linking.sql` — CREATE TABLE paper_medications/conditions/mutations/trials
2. `server/research-routes.js` — add /api/papers/:id/links and GET endpoints
3. `MedicationManager.jsx` — add evidence badge + slide-out panel
4. `ResearchSearch.jsx` — add "Link" button + multi-select panel

**Validation:** MedicationManager still loads/saves meds normally. Links panel is additive.

---

### Sprint 3 — Trial Matching Panel (4-5 days)
**Why third:** Builds on linking (trials can now be linked to papers). ALTER TABLE clinical_trials + new TrialMatchingPanel.

1. `migrations/add-trial-matching.sql` — ALTER TABLE clinical_trials + CREATE TABLE trial_eligibility/mutations
2. `server/trial-routes.js` — all /api/trials/* endpoints
3. `TrialMatchingPanel.jsx` — new component (Kanban layout)
4. `App.jsx` — add `trials` tab

**Validation:** Existing clinical_trials data unchanged. New columns nullable. New tab is additive.

---

### Sprint 4 — Visit-Prep One-Pager (2-3 days)
**Why fourth:** Pure read — depends on all above data being available (richer papers, linked trials). No new tables.

1. `server/visit-prep-route.js` — GET /api/visit-prep aggregate query
2. `VisitPrepOnePager.jsx` — new component with print CSS
3. Connect from PortalManager appointments list (add "Prep" button)

**Validation:** PortalManager unchanged functionally. New button is additive. Route is read-only.

---

### Sprint 5 — Survival Dashboard (4-5 days)
**Why last:** Most isolated (new tables, new component), highest UX value, but no upstream dependencies. Can be developed in parallel with Sprint 4 if bandwidth allows.

1. `migrations/add-survival-tracking.sql` — CREATE TABLE sleep_logs, daily_scores + ALTER symptoms
2. `server/survival-score.js` — computation engine
3. `server/survival-routes.js` — all /api/sleep/* and /api/survival-* endpoints
4. `SurvivalDashboard.jsx` — new component
5. `App.jsx` — add `survival` tab, consider making it default over `profile`

**Validation:** Existing symptom logging still works (ALTER adds nullable columns). New tab is additive.

---

## Implementation Notes for Current Codebase

### Server Pattern
All new routes should follow the pattern in `server/medications-routes.js`:
- Export a router
- Import in `server/index.js` with `app.use('/api', router)`
- Use `db.js` connection directly

### Migration Pattern
Create `server/migrations/` directory. Each file: numbered SQL, runs on app start via:
```javascript
// In server/db.js initializeDatabase()
db.exec(fs.readFileSync('./server/migrations/001-evidence-grading.sql', 'utf8'));
```
Wrap in `IF NOT EXISTS` / nullable ALTERs so re-running is safe.

### Electron IPC Pattern
All new features need the same Electron guard that ResearchSearch.jsx uses:
```javascript
const isElectron = typeof window !== 'undefined' && !!window.electron;
if (isElectron) { /* graceful fallback */ return; }
```
IPC handlers for these features can come in a later v0.3.x Electron release.

### Component File Locations
```
src/components/TrialMatchingPanel.jsx
src/components/VisitPrepOnePager.jsx
src/components/SurvivalDashboard.jsx
src/components/SleepTracker.jsx  (sub-component of SurvivalDashboard)
```

### CSS Approach
Follow existing pattern: one `.css` file per major component. Print styles for VisitPrepOnePager:
```css
@media print {
  .visit-prep-actions { display: none; }
  .visit-prep-one-pager { width: 100%; font-size: 11pt; }
}
```

---

## Success Metrics

| Metric | Current | Target (90 days) |
|--------|---------|------------------|
| Papers with evidence grade | 0 | 100% of saved papers |
| Papers linked to medications | 0 | >80% |
| Trials with fit scores | 0 | 100% of saved trials |
| Days with survival score logged | 0 | >80% of days |
| Visit preps generated | 0 | Every appointment |

---

## What This Unlocks

After these five modules, John can:

1. **Before appointments:** Generate a one-pager in 10 seconds instead of 20 minutes of manual assembly
2. **In appointments:** Reference specific papers by grade when discussing treatment options
3. **For trials:** Know immediately which 2-3 trials to push on, and exactly which eligibility question to ask
4. **Daily:** See one number (survival score) that reflects whether nutrition/exercise/sleep/symptoms are trending the right direction
5. **Long-term:** Correlate treatment cycles with survival score dips — actionable data for adjusting supportive care

The architecture stays clean: each module is additive, independently deployable, and reversible if a sprint goes sideways.

---

*Generated by Jor-El clinical product strategy session — March 2026*
