/make-plan Redesign the Medical Research Tracker's core frontend shell (navigation, data-loading/error handling, and visual system). Current design failed audit at 9/30 with critical gaps in principles #2 (useful), #6 (honest), #8 (thorough).

Verdict paragraph (quoted from 03-verdict.md):
> Total score: 9/30. Three load-bearing principles scored 0: #2 (useful), #6 (honest), #8 (thorough) — any one of these alone would trigger REDESIGN per the scoring rule; having all three confirms it decisively. The bones are not good enough to refine: the app crashes into an unrecoverable blank screen on a core clinical surface (Radiology), and the very first screen a user sees makes a trust claim ("no cloud storage, no third parties") that the code directly beneath it contradicts. For an app whose entire purpose is helping a cancer patient trust and act on his own data, reliability and honesty are not optional polish — they are the product.

Why redesign and not refine: Three load-bearing principles (useful, honest, thorough) each scored 0 — the app has an uncaught, unrecoverable crash on a core clinical view, and its very first screen makes a security/privacy claim the code directly contradicts. This is not a polish problem; it's a trust and reliability problem at the foundation.

Preserve from current design:
- Overall information architecture and feature scope — Overview, Genomics, Treatment, Lab Results, Bone Health, Radiology, Portals, Research, Strategy tabs cover the right ground for this user; don't cut features, fix how they're built (see `App.jsx:130-189` for the current tab list).
- Brand tokens: blue/gray palette direction and the "Your Treatment, Your Data, Your Path" login hero framing — these read fine, just need to be backed by a real design-token system instead of 83 hardcoded hexes (`01-evidence.md` Visual section).
- Empty-state pattern (".empty" — "No vitals recorded yet" etc.) — present consistently across views; keep the pattern, just fix its contrast (currently 2.54:1, fails WCAG AA).

Discard:
- No React error boundary anywhere in the component tree, causing full-screen blank crashes with zero user feedback. Evidence: live-session finding, `RadiologyViewer.jsx:1514` `TypeError: studies.map is not a function` with no recovery path. Caused failure on principle #2 and #8.
- Ad hoc, per-component inline styling with no shared theme (`sx=` scattered 107 times, no `createTheme`/`ThemeProvider` anywhere in `src`). Evidence: `01-evidence.md` Visual section — 83 unique hex colors, 16-step non-grid spacing scale, ~14-size type scale with no ratio. Caused failure on principle #3 and #10.
- Marketing copy on the Login screen that overstates or contradicts actual behavior ("No cloud storage, no third parties" vs. real Supabase cloud-auth code; "HIPAA Compliant / full audit logging" with no backing; "Automated search" for a feature that's explicitly unbuilt in-app). Evidence: `Login.jsx:21-46,126-135,194`. Caused failure on principle #6.
- Buttons whose labels don't match their handlers ("Unlock Vault" → `window.location.reload()`; "Send Telegram notification" toggle with no backing integration; "volumetric reconstruction" label on synthetic placeholder data). Evidence: `PortalManager.jsx:455-457,676`; `RadiologyViewer.jsx:679-683` + `server/radiology.js:127-137`. Caused failure on principle #6.
- Duplicate "Portals" nav tab and its dead second `<PortalManager />` render. Evidence: `App.jsx:166-171,184-189,199,202`. Caused failure on principle #4 and #10.

Top 5 moves from the audit (verbatim):
1. #8 thorough / #2 useful: Add a React error boundary and fix the root crash. RadiologyViewer throws `TypeError: studies.map is not a function` with no error boundary anywhere in the tree, producing a blank white screen with zero recovery path. Evidence: `01-evidence.md` live-session finding #1; `RadiologyViewer.jsx:1514`.
2. #6 honest: Reconcile the "No cloud storage, no third parties" claim with the actual Supabase cloud-auth code path, or remove the claim. Evidence: `Login.jsx:194` vs `Login.jsx:21-46`, live-confirmed on the signup screen.
3. #6 honest: Fix or remove every button/label whose behavior doesn't match its claim. "Unlock Vault" reloads the page instead of unlocking (`PortalManager.jsx:455-457`); "Send Telegram notification" toggle does nothing (`PortalManager.jsx:676`); "volumetric reconstruction from {modality} data" is actually a synthetic placeholder (`RadiologyViewer.jsx:679-683`, `server/radiology.js:127-137`).
4. #4 understandable / #10 as little design as possible: Remove the duplicate "Portals" nav tab and its dead second render. Evidence: `App.jsx:166-171` and `:184-189` (nav), `App.jsx:199` and `:202` (dead render), live-confirmed as two identical tabs in the running nav bar.
5. #3 aesthetic / #9 environmentally friendly: Establish one design-token source of truth (MUI theme: color palette, 8px spacing scale, modular type scale) and cut the bundle from 621.94 KB gzipped toward the <500KB band via proper MUI theming/tree-shaking. Evidence: `01-evidence.md` Visual and Weight & Friction sections.

Redesign principles in priority order:
1. #2 Useful — every primary view (especially Radiology and Genomics, both observed failing to load) must degrade to a clear error message, never a blank screen. Success: a top-level error boundary plus per-view fetch-error UI, verified by intentionally breaking a fetch and confirming a readable message renders instead of a crash.
2. #6 Honest — every claim on the Login screen and every button label must be true of the current code today, not aspirational. Success: a copy audit pass where each user-facing claim is checked against its actual implementation before ship, repeated each release.
3. #10 As little design as possible — one shared theme, one shared `apiFetch`, no duplicate nav items, no copy-pasted style blocks. Success: zero hardcoded hex colors outside a single theme file; grep for `sx={{` inline color/spacing literals returns nothing outside intentional one-offs.

Deliverables for the plan:
- New information architecture only where needed to fix the duplicate-tab and dead-render issues (not a full IA rebuild — the 9-feature tab set stays).
- Error-handling architecture: top-level error boundary + per-view loading/error/empty state pattern, applied consistently across all 9 feature views (currently only 2 of 9 implement loading UI, 2 of 9 implement error UI per `01-evidence.md`).
- MUI theme file (palette, spacing scale, type scale) replacing the 83 hardcoded hex colors and 107 ad hoc `sx=` overrides.
- Honest-copy pass across Login.jsx and every feature component, cross-checked against actual backend behavior (Supabase usage, Telegram integration, radiology data source, vault unlock flow).
- States checklist applied per view: empty, loading, error, success, focus, disabled — currently inconsistent per `01-evidence.md` Visual section.
- Migration path: this is a solo local/Electron app with one real user (no multi-tenant migration concern) — cutover can be direct once the error boundary and honest-copy pass are verified against the existing `data/health.db`.
- Cutover criteria: no uncaught exceptions in console across a full click-through of all 9 tabs; zero Login-screen claims contradicted by grep of the actual code path; gzipped bundle under 500KB.

Anti-patterns to guard against (specific to REDESIGN):
- Porting the old ad hoc inline-style approach under a new coat of paint instead of adopting a real theme.
- Treating the honesty fixes as "just copy edits" — some require either building the claimed feature (real Telegram integration, real automated search) or removing the claim; don't leave the claim in place with a TODO.
- Redesigning the visual language to chase a trend — this app needs to read as calm, current, and trustworthy for years, not fashionable.
- Skipping the error-boundary work because "it's just Radiology" — the same unguarded pattern (no error boundary anywhere in the tree) will crash the next view that hits a bad fetch too.
