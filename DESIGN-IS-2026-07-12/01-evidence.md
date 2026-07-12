# Evidence — Consolidated

Sources: 5 evidence subagents (Structural, Visual, Copy & Honesty, Weight & Friction, Accessibility) reading source under `src/` and `server/`, plus live verification via Chrome on a fresh throwaway account (`designaudit`) against the running dev server (localhost:5173) and backend (localhost:3000, Node 24 LTS, fresh local `.env` secrets generated for this audit session only).

## Structural (subagent aa4574a7)

- ≈200+ discrete interactive elements across the audited surface; App.jsx nav/forms alone contribute 76.
- Max primary-render nesting depth = 4 (App.jsx:118-119); deeper (6) in form helpers outside the main return.
- 6 repeated-pattern groups, notably:
  - **Duplicate "🔐 Portals" nav button** — App.jsx:166-171 and :184-189, both `onClick={() => setActiveTab('portals')}`; `<PortalManager />` rendered twice (App.jsx:199, :202), second is dead code. **LIVE-CONFIRMED**: two identical "Portals" tabs visible in the running app (`ref_13`/`ref_16` in DOM, both screenshots).
  - Sub-nav tab pattern repeated 3x (Overview/Treatment/Research views), identical structure — consistent, not a violation.
  - Identical ~15-line hover-elevate card style block copy-pasted 7x in PrecisionMedicineDashboard.jsx (151-167, 222-238, 280-296, 411-427, 468-485, 542-558, 632-650).
  - `apiFetch` locally reimplemented in HealthcareSummary.jsx:3-12 and PortalManager.jsx:3-12 despite a shared `src/apiFetch.js` already used elsewhere.
- 4 unused `import React` statements (BoneHealthTracker.jsx, RadiologyViewer.jsx, NutritionTracker.jsx, MedicationEvidenceModal.jsx:1) — dead weight from the pre-new-JSX-transform era.

## Visual (subagent af230ac1, INFERRED from source; cross-checked live)

- No `createTheme`/`ThemeProvider` anywhere in `src` — MUI is unthemed; styling is plain CSS + ad hoc inline `sx`/style objects (107 `sx=` occurrences).
- Spacing scale: 16 distinct values `[2,4,6,8,10,12,14,16,20,24,28,30,32,40,48,60]` — not a clean 4/8px grid.
- Type scale: ~14 distinct sizes `[12,13,14,15,16,18,20,24,28,32,36,48px]` plus 2 relative sizes — near-linear crawl, no modular ratio.
- **83 unique hardcoded hex colors**, no design-token source of truth. Same semantic role (e.g. "success green") expressed as different hexes in different files (`#10b981` vs `#27ae60`/`#2ecc71`).
- Lowest contrast: `.empty` text `#9ca3af` on white ≈ **2.54:1** (App.css:211-216); footer separator `#d1d5db` on white ≈1.47:1 (decorative).
- States checklist: Empty ✅ present widely; Loading ⚠️ present but sparse (only 2 of ~9 major views implement a loading string, no skeletons); Error ⚠️ present in try/catch everywhere but only 2 components render a matching error UI; Success ✅; Focus ✅ (default outline replaced with custom border/shadow — INTENTIONAL, not suppressed-and-abandoned); Disabled ✅.

## Copy & Honesty (subagent a2d5d7b7; LIVE-VERIFIED)

- ~150 user-facing strings inventoried across App.jsx, Login.jsx, and all 8 feature components.
- **Flagged inflations / label-behavior mismatches, all LIVE-CONFIRMED:**
  1. Login.jsx:134-135 **"🔒 HIPAA Compliant" / "AES-256 encryption, automated backups, full audit logging"** — no HIPAA certification exists for a solo unaudited personal app; "full audit logging" not found in `server/`.
  2. Login.jsx:194 **"Your data stays on your device. No cloud storage, no third parties."** directly contradicted by Login.jsx:21-46, which attempts Supabase cloud auth first. **LIVE-CONFIRMED** this exact copy is the first thing shown on the signup screen (screenshot 1).
  3. Login.jsx:126-127 **"Research Scanner — Automated search..."** oversells; the actual Research tab (**LIVE-CONFIRMED**, screenshot) honestly says "While automated search is being implemented, you can: Search PubMed or ClinicalTrials.gov" and ships a disabled gray "Search" button. In-context honesty is good; the marketing claim on Login is not.
  4. PortalManager.jsx:676 **"Send Telegram notification on sync completion"** — no Telegram integration exists anywhere in `server/`; toggle does nothing.
  5. BoneHealthTracker.jsx:360 **"Trusted Sources (FDA-compliant, third-party tested)"** — unverifiable; links to retailer product pages, not an FDA determination. **LIVE-CONFIRMED**: Bone Health tab presents Fenbendazole and Ivermectin (off-label, unproven-for-cancer repurposed drugs) under a green-checkmark "✅ What You're Doing Right" heading with no efficacy-evidence caveat visible above the fold.
  6. RadiologyViewer.jsx:679-683 **"Showing volumetric reconstruction from {study.modality} data"** — `server/radiology.js:127-137` confirms this is a synthetic CT-like volume generated from metadata, not real DICOM data, but the UI presents it as if rendering the actual scan.
  7. PortalManager.jsx:455-457 **"🔓 Unlock Vault"** button — source shows `onClick={() => window.location.reload()}`, i.e. it doesn't unlock anything, just reloads the page. (Source-confirmed only; not live-reproduced this session since the fresh test account never had a vault configured — live session instead showed the legitimate first-time "Set Master Password" screen, a different, correctly-labeled state.)
- No dark patterns found (expected for a single-user personal tool).
- Jargon flagged: "VAF", "Coding Effect"/"Transcript ID", "MFA Method"/"TOTP Secret", "Genomic Nutrition Score" — all lack plain-language glosses on first use.

## Weight & Friction (subagent a39bc05f)

- Production bundle: **2,154.7 KB raw / 621.94 KB gzipped** JS (`npm run build`, `dist/assets/*.js`). No MUI theme/tree-shaking optimization evident.
- 6 network requests fire on initial mount before any user interaction (3 in App-level auth check, 3 in default Profile/Overview view).
- Estimated TTI ~2,155ms (rough heuristic, not measured).
- 19 CSS transition/animation declarations; no MUI motion components in the default view.
- 0 unsolicited modals/badges/snackbars on initial load — confirmed, only user-triggered.

## Accessibility (subagent ae6ee7a7; LIVE-CONFIRMED nav order)

- **6 of 23 sampled text/background pairs FAIL WCAG AA contrast** (4.5:1 normal text) — recurring offenders: `#10b981` green and `#9ca3af` gray used as text-weight color on light backgrounds (e.g. `.empty` 2.54:1, `.manual-entry-button` 2.54:1, disabled-button text 2.54:1, `.test-provider` 2.43:1).
- Zero `tabIndex` overrides — DOM order = focus order, includes the duplicate Portals stop.
- All primary actions keyboard-reachable (real `<button>`/`<a>` elements); modal backdrop click-to-close has no keyboard/Escape equivalent, but each modal's real Close/Cancel button is keyboard reachable.
- Only 4 landmark/role signals total (`<header>`, `<nav>` with no `aria-label`, `<main>`, one `role="group"`); 0 `aria-label` attributes found anywhere in `src/App.jsx` or `src/components/*`.
- No skip-to-content link.

## Live-session-only findings (not in any subagent's source-only pass)

1. **Uncaught crash, no error boundary**: clicking Radiology threw `TypeError: studies.map is not a function` (RadiologyViewer.jsx:1514) — the entire screen goes blank white with zero user-facing feedback, no error message, no recovery path short of reload. Console also showed a failed genomic-dashboard fetch (PrecisionMedicineDashboard.jsx:37, backend returned HTML instead of JSON) and a NutritionTracker Autocomplete `options` prop-type warning (expected array, got object).
2. **First-click-does-nothing bug**: after a route/crash reset, the first click on the "Research" nav tab only focused it (blue outline) without switching visible content; a second click was required to actually render the Research view. Reproduced twice.
