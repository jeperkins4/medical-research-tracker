# Scorecard

1. Good design is innovative — Score: 1/3
   Evidence: Standard tab-nav + card-form CRUD pattern, MUI defaults, no visible attempt at a novel interaction beyond off-the-shelf components (01-evidence.md Visual, Structural).
   Justification: Imitates common dashboard conventions with minor domain variation (genomics/radiology panels); doesn't introduce a new pattern, but isn't a wholesale competitor copy either.

2. Good design makes a product useful — Score: 0/3
   Evidence: Radiology view throws an uncaught crash with no error boundary and blank white screen (01-evidence.md, live-session finding #1); Research tab requires two clicks to render on first navigation after a crash; genomic dashboard fetch fails outright (HTML returned instead of JSON).
   Justification: A load-bearing principle scored 0 — the primary task (viewing one's own radiology/genomic data) is not reliably completable; the app crashes into an unrecoverable blank screen on a core surface with zero feedback, worst-instance scoring applies.

3. Good design is aesthetic — Score: 1/3
   Evidence: 83 unique hardcoded hex colors with no design-token system, spacing scale of 16 irregular steps, type scale of ~14 sizes with no modular ratio, same semantic color (success green) rendered as 3+ different hexes across files (01-evidence.md Visual).
   Justification: No single visible system — worse than "≤2 minor inconsistencies"; this is systemic drift across every component, not one jarring violation, but there is a baseline card/nav visual language that's coherent enough to avoid 0.

4. Good design makes a product understandable — Score: 1/3
   Evidence: Duplicate, unlabeled "🔐 Portals" nav tab live-confirmed twice in the tab bar (01-evidence.md Structural/Accessibility); jargon ("VAF", "Coding Effect", "TOTP Secret") without glosses; "Unlock Vault" button that actually just reloads the page (source-confirmed).
   Justification: Multiple controls are unclear or mislabeled beyond the "2-3 controls" band — duplicate nav item alone would confuse a first-time user about which "Portals" to use, compounding with jargon and a mislabeled button.

5. Good design is unobtrusive — Score: 2/3
   Evidence: No unsolicited modals/badges/snackbars on initial load (0 confirmed, 01-evidence.md Weight & Friction); chrome is a simple header+nav+content layout that recedes to content (live screenshots).
   Justification: Chrome is quiet and content-forward; docked at 2 rather than 3 because the 10-tab nav bar (with a dead duplicate) adds visual noise that competes with content rather than receding cleanly.

6. Good design is honest — Score: 0/3
   Evidence: Login screen claims "No cloud storage, no third parties" while the code attempts Supabase cloud auth first (Login.jsx:21-46, live-confirmed on the signup screen); "HIPAA Compliant" claim unbacked; "Unlock Vault" button that just reloads the page; synthetic radiology data presented as "volumetric reconstruction from {modality} data"; a fake Telegram-notification toggle (01-evidence.md Copy & Honesty).
   Justification: A load-bearing principle scored 0 — this isn't one inflation, it's a deceptive flow: the core trust claim on the very first screen a user sees ("no cloud storage") is contradicted by the code directly beneath it.

7. Good design is long-lasting — Score: 2/3
   Evidence: Visual language (flat cards, system-ish sans, blue/gray palette) has no obvious dated trend markers (no skeuomorphism, no fad gradients) but also lacks any distinctive identity that would age *well* rather than just neutrally (01-evidence.md Visual).
   Justification: Reads as generic-current rather than trend-chasing or dated — safe, unremarkable, one step below a deliberate, considered visual language that would clearly still read as current in 3 years.

8. Good design is thorough down to the last detail — Score: 0/3
   Evidence: Loading states implemented in only 2 of ~9 major views; error states have try/catch everywhere but matching error UI in only 2 components; no error boundary anywhere in the tree (React's own console warning confirms this) leading to full-screen blank crashes; first-click-does-nothing nav bug; duplicate dead Portals render (01-evidence.md, all sections).
   Justification: 4+ states/edge-cases missing or broken (loading, error-UI, crash recovery, first-click nav) — squarely in the 0 band, worst-instance (the uncaught crash) dominates.

9. Good design is environmentally friendly — Score: 1/3
   Evidence: Production JS bundle is 2,154.7 KB raw / 621.94 KB gzipped (01-evidence.md Weight & Friction) — well over the 500KB "1" threshold and far over the "3" threshold of <100KB.
   Justification: Falls in the 500KB–2MB-plus band with motion (19 transition/animation declarations) always-on rather than gated by `prefers-reduced-motion` (no such media query found in any evidence pass) — scores 1, not 0, since there's no autoplay video and dark mode isn't claimed/ignored (not applicable, no theme system exists).

10. Good design is as little design as possible — Score: 1/3
    Evidence: Duplicate dead "Portals" nav button/render (2 removable elements alone), 7x copy-pasted hover-card style block instead of one shared style, 2 locally-reimplemented `apiFetch` copies despite a shared utility already in use, 4 unused imports (01-evidence.md Structural).
    Justification: More than 3-5 removable/duplicated elements once nav, style duplication, and dead code are combined — this is systemic redundancy, not a couple of trimmable extras, but the app isn't dominated by decoration either.

**Total: 9/30**
