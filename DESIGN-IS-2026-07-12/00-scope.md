# Scope Lock

**Audited:** Whole app, live dev server at http://localhost:5173 (Vite), backend API at http://localhost:3001.
**App:** medical-research-tracker — "Personal health records and medical research discovery tool" (package.json description).

**Primary user:** The app's sole user and owner — a cancer patient tracking his own treatment, using this as a personal clinical/research dashboard.

**Primary task:** Log in, land on a status/profile view, and navigate via tab-based nav across: Profile, Precision Medicine Dashboard, Research Search, Healthcare Summary, Portal Manager, Bone Health Tracker, Radiology Viewer, Nutrition Tracker, Medication Evidence.

**Constraints:**
- Stack: React 18 + Vite + MUI (@mui/material, @mui/icons-material) + Express backend.
- HIPAA/PHI sensitivity — repo has had a PHI leak incident (June 2026, purged); PHI must never be exposed insecurely in the UI or client bundle.
- Single-user local/Electron-capable app (electron-builder present) — not a multi-tenant SaaS product.
- No formal design system beyond MUI defaults observed so far.
- Deadline: none stated: personal tool, iterate at will.

**Reference designs / competitors:** None supplied by user. Will benchmark against general clinical-dashboard usability norms (clarity, low cognitive load, information hierarchy) rather than a named competitor.

**Login credentials:** Not available to the auditor in this pass — visual evidence subagent should screenshot what's reachable unauthenticated (login/setup screen) and note if deeper screens are inaccessible without credentials.
