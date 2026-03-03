# MRT Cancer Generalization Roadmap

## Objective
Evolve MRT from bladder-focused workflows into a reusable oncology platform that supports:
- multiple cancer types
- multiple genomic report vendors
- profile-specific but shared UI primitives

## Phase 0 (this sprint) — Foundation
- [x] Add cancer profile registry (`src/models/cancerProfiles.js`)
- [x] Add generic genomic report normalizer scaffold (`src/services/genomicReportNormalizer.js`)
- [ ] Add profile selector in onboarding/settings
- [ ] Persist `cancer_profile_id` at patient level

## Phase 1 — Data Model
- Add tables/columns:
  - `patients.cancer_profile_id`
  - `genomic_reports.source`
  - `genomic_reports.normalized_json`
  - `genomic_reports.report_date`
- Ensure migration is idempotent and backward compatible.

## Phase 2 — UI Generalization
- Convert bladder-specific labels to profile-aware labels.
- Add profile-aware "Key Biomarkers" cards.
- Add profile-aware default trend markers and visit prompts.

## Phase 3 — Research Linking
- Map scanner output to profile biomarkers and therapies.
- Introduce profile-specific query packs (urothelial, breast, NSCLC, CRC first).
- Keep universal lifestyle/supportive-care scans enabled for all profiles.

## Phase 4 — Report Parsing
- Vendor adapters (FoundationOne, Tempus, Caris, Guardant):
  - parse structured fields when available
  - fallback to text extraction
  - preserve raw artifact for auditability

## Phase 5 — Clinical Export Modes
For every profile, generate:
1. Clinical Brief
2. Coverage Packet
3. Patient Action Plan

## Guardrails
- No hard-coded disease assumptions in shared components.
- Always show evidence level and uncertainty.
- Preserve original source data and timestamps.
- Keep local-first HIPAA posture unchanged.
