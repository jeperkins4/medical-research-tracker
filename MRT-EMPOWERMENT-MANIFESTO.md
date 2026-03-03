# MRT Empowerment Manifesto + UX Rules

## Mission
**MyTreatmentPath (MRT) exists to empower patients and caregivers with clarity, agency, and decision-readiness — not just data storage.**

---

## Core Beliefs
1. **Patients are partners, not passengers.**
2. **Understanding reduces fear.**
3. **Preparation improves outcomes.**
4. **Evidence must be visible, not hidden.**
5. **Cancer care is whole-person care (body + mind + function).**

---

## Product North Star
Every MRT screen should answer three questions in under 10 seconds:
1. **What changed?**
2. **What does it mean?**
3. **What should I do next?**

If a screen cannot answer these, it is incomplete.

---

## Empowerment Principles (Non-Negotiable)

### 1) Clarity over Complexity
- Use plain language first, medical detail second.
- Show summaries before raw tables.
- Avoid silent states and ambiguous errors.

### 2) Agency over Passivity
- Every module must provide actionable next steps.
- Replace dead-end UI with guided actions.
- Enable user-controlled priorities and tracking.

### 3) Preparation over Panic
- Build visit-readiness into workflow (questions, timelines, key changes).
- Surface deltas since last appointment.
- Convert complexity into conversation-ready briefs.

### 4) Evidence over Vibes
- Label intervention evidence tier explicitly.
- Distinguish hypothesis vs clinical support.
- Show uncertainty honestly.

### 5) Whole-Person over Tumor-Only
- Track treatment plus sleep, exercise, nutrition, symptoms, mood/function.
- Measure resilience and quality of life, not only pathology.

---

## UX Rules (Apply to Every Feature)

## Rule 1: No dead ends
- No blocking popups for expected flows.
- If unavailable: show why + workaround + next step.

## Rule 2: One-click meaning
- Every major data card includes:
  - "Why this matters"
  - "What changed"
  - "Recommended next action"

## Rule 3: Actionable defaults
- Default views should prioritize today’s decisions and risks.
- Personalize critical markers and watchlists.

## Rule 4: Progressive disclosure
- Tier 1: plain summary
- Tier 2: clinical detail
- Tier 3: source evidence

## Rule 5: Accessibility is core, not optional
- Keyboard/voice usable
- readable typography (no essential content below 13px)
- high contrast and clear focus states

## Rule 6: Trust through transparency
- Show source, timestamp, confidence, and sync status.
- Never hide missing data; state it clearly.

## Rule 7: Minimize effort on low-energy days
- Quick logging paths
- templates and defaults
- short interaction loops

## Rule 8: Measure outcomes of features
- Track whether feature improves:
  - visit prep quality
  - adherence
  - symptom awareness
  - decision speed/confidence

---

## Feature Lens Checklist (Gate for New Work)
Before shipping any feature, answer:

1. **Empowerment:** Does this increase patient agency?
2. **Interpretability:** Can a non-clinician understand it quickly?
3. **Actionability:** Does it produce clear next steps?
4. **Evidence:** Are evidence level and confidence explicit?
5. **Whole-person:** Does it account for function/symptoms/lifestyle where relevant?
6. **Workflow fit:** Does it reduce effort during real appointment prep?
7. **Accessibility:** Is it usable on fatigue/neuropathy days?
8. **Trust:** Are source + freshness + limits visible?

If 2+ answers are “no,” do not ship yet.

---

## Applying the Lens to Current MRT Modules

### Labs & Trends
- Add: “what changed since last draw” + “clinical significance” + “discussion prompts.”
- Add marker pinning for personalized oncology watchlist.

### Medications/Supplements
- Add interaction and timing guardrails.
- Add evidence grade + rationale + "monitor this" field.

### Genomics
- Add pathway-to-treatment mapping in patient language.
- Add trial relevance score and why/why-not fit.

### Research Scanner
- Auto-link findings to meds/mutations/conditions.
- Add evidence badges and “discuss with oncologist” prompts.

### Strategy Summary
- Persist previous summary with freshness indicator.
- Show deltas since prior summary.

### Nutrition / Lifestyle
- Add survival-support dashboard (sleep/exercise/symptom/energy trendline).
- Add practical daily targets and adherence cues.

### Portals / FHIR
- Add clear sync status, errors, and “new since last sync.”
- Build data provenance into every imported item.

---

## Three Required Output Modes
From the same underlying data, MRT should generate:

1. **Clinical Brief** (doctor-ready)
2. **Coverage Packet** (insurance-ready)
3. **Patient Plan** (plain language + next actions)

This ensures no stakeholder is left in the dark.

---

## Tone + Copy Standards
- Direct, calm, competent.
- Avoid alarmist language.
- Always pair risk with action.
- Replace jargon unless needed; define terms when used.

---

## Definition of Done (Empowerment Edition)
A feature is done only when:
- It is understandable by patient/caregiver,
- clearly actionable,
- evidence-labeled,
- accessible,
- and improves real decision-readiness.

---

## Closing Commitment
**MRT is not just software. It is a patient empowerment system.**
Every feature must help users move from confusion to clarity, from fear to preparation, and from passive care to informed partnership.
