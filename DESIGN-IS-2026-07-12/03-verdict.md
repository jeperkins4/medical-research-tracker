# Verdict: REDESIGN

**Total score: 9/30.** Three load-bearing principles scored 0: #2 (useful), #6 (honest), #8 (thorough) — any one of these alone would trigger REDESIGN per the scoring rule; having all three confirms it decisively. The bones are not good enough to refine: the app crashes into an unrecoverable blank screen on a core clinical surface (Radiology), and the very first screen a user sees makes a trust claim ("no cloud storage, no third parties") that the code directly beneath it contradicts. For an app whose entire purpose is helping a cancer patient trust and act on his own data, reliability and honesty are not optional polish — they are the product.

**Top 5 highest-leverage moves:**

1. **#8 thorough / #2 useful — Add a React error boundary and fix the root crash.** RadiologyViewer throws `TypeError: studies.map is not a function` with no error boundary anywhere in the tree, producing a blank white screen with zero recovery path. Evidence: `01-evidence.md` live-session finding #1; `RadiologyViewer.jsx:1514`.
2. **#6 honest — Reconcile the "No cloud storage, no third parties" claim with the actual Supabase cloud-auth code path, or remove the claim.** Evidence: `Login.jsx:194` vs `Login.jsx:21-46`, live-confirmed on the signup screen.
3. **#6 honest — Fix or remove every button/label whose behavior doesn't match its claim.** "Unlock Vault" reloads the page instead of unlocking (`PortalManager.jsx:455-457`); "Send Telegram notification" toggle does nothing (`PortalManager.jsx:676`); "volumetric reconstruction from {modality} data" is actually a synthetic placeholder (`RadiologyViewer.jsx:679-683`, `server/radiology.js:127-137`).
4. **#4 understandable / #10 as little design as possible — Remove the duplicate "Portals" nav tab and its dead second render.** Evidence: `App.jsx:166-171` and `:184-189` (nav), `App.jsx:199` and `:202` (dead render), live-confirmed as two identical tabs in the running nav bar.
5. **#3 aesthetic / #9 environmentally friendly — Establish one design-token source of truth and cut the bundle.** 83 hardcoded hex colors with no theme, a 16-step non-grid spacing scale, and a 621.94 KB gzipped bundle (no MUI theming/tree-shaking) all stem from the same root cause: no shared styling system. Evidence: `01-evidence.md` Visual and Weight & Friction sections.

Everything else in the evidence (loading-state gaps, contrast failures, accessibility landmarks, jargon) should be addressed as part of the redesign's states/detail pass, not bolted on separately.
