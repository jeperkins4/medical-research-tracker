# Frontend Redesign Plan — 2026-07-12

Source: `DESIGN-IS-2026-07-12/` Dieter Rams audit (verdict: REDESIGN, 9/30, load-bearing failures on #2 useful, #6 honest, #8 thorough). This plan executes the audit's handoff prompt (`DESIGN-IS-2026-07-12/04-handoff-prompt.md`).

Each phase is self-contained and can be executed in a new chat context — it carries its own doc references and file:line citations, verified fresh against the current codebase as of this writing (Node 24.16.0 LTS, dev server on :5173, backend on :3000).

---

## Phase 0: Documentation Discovery (COMPLETE — findings below)

**Allowed APIs (cite before using anything not listed here):**

- `createTheme(options)` from `@mui/material/styles` — `palette: { mode, primary, secondary, success, error, warning, info }` (each `{ main, light?, dark?, contrastText? }`, MUI auto-derives missing shades from `main`); `typography: { fontFamily, h1..h6, body1, body2, button, ... }`; `spacing(n)` returns a ready CSS length. Source: Context7 `/mui/material-ui/v7_3_2` (pinned to installed `^7.3.8`).
- `<ThemeProvider theme={theme}>` + `<CssBaseline />` from `@mui/material/styles` and `@mui/material/CssBaseline` — wrap the app root. Source: same.
- `sx` prop resolves theme dot-paths: `sx={{ color: 'primary.main' }}` instead of a hex literal. Source: same, `mui-system/src/style/style.ts`.
- Dark mode (not required by this plan, note for future): `useMediaQuery('(prefers-color-scheme: dark)')` from `@mui/material/useMediaQuery`, or `colorSchemes: { light: true, dark: true }` + `cssVariables` for CSS-variable-based switching. Not in scope for this redesign pass — the app has no dark mode today and none was flagged as required by the audit.
- React 18.2.0 (confirmed `package.json:20-21`) has **no hook-based error boundary** — must be a class component (`static getDerivedStateFromError`, `componentDidCatch`). Source: react.dev/reference/react/Component via Context7 `/websites/react_dev_reference`, quoted verbatim in Phase 1.
- `react-error-boundary` package is **not currently a dependency** — Phase 1 writes a small hand-rolled class component instead of adding a new dependency, since the need is narrow (9 known view boundaries) and React's own docs give the exact minimal pattern.

**Anti-patterns to avoid:**
- Do NOT write a function-component error boundary with `useErrorBoundary` or similar — it doesn't exist in React 18.
- Do NOT invent MUI theme keys beyond `primary/secondary/success/error/warning/info` — those are the only palette intents MUI's components read by default.
- Do NOT assume `theme.spacing(n)` needs a `px` suffix appended — it already returns a full CSS length string in MUI v5+.

---

## Phase 1: Fix the crash — error boundaries + root-cause guard

**What to implement:**

1. Create `src/ErrorBoundary.jsx` — copy this pattern verbatim (adapted from react.dev/reference/react/Component, the current official React 18 pattern):

```jsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" style={{ padding: 20 }}>
          <p>Something went wrong loading this view.</p>
          <button onClick={() => this.setState({ hasError: false })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

2. In `src/App.jsx:192-203` (the `<main>` block with all 9 `activeTab === '...' && <Component/>` conditionals), wrap **each** conditional individually:

```jsx
{activeTab === 'radiology' && <ErrorBoundary resetKey={activeTab}><RadiologyViewer /></ErrorBoundary>}
```
Do this for all 9 views, not just Radiology — the same unguarded pattern (no boundary anywhere in the tree, confirmed via grep) can crash any of them the same way.

3. Fix the actual root cause in `src/components/RadiologyViewer.jsx`, in `fetchStudies()` (currently ~lines 865-875): add a `response.ok` check before `.json()` and an `Array.isArray` guard before `setStudies(data)`:

```js
const response = await apiFetch('/api/radiology/studies');
if (!response.ok) { setStudies([]); return; }
const data = await response.json();
setStudies(Array.isArray(data) ? data : []);
```
This fixes the crash at its source (`studies.map` calls at `RadiologyViewer.jsx:1035` and `:1075`) so the error boundary becomes a safety net, not the primary fix.

**Documentation references:** react.dev/reference/react/Component (class-only error boundary requirement, confirmed via Context7 `/websites/react_dev_reference`); direct reads of `src/App.jsx:192-203`, `src/components/RadiologyViewer.jsx:853,865-875,1035,1075`.

**Verification checklist:**
- `grep -c "ErrorBoundary" src/App.jsx` returns 9 (one per view).
- Manually trigger the original crash path (temporarily have the backend return non-array JSON from `/api/radiology/studies`, or stop the backend and hit Radiology) — confirm the app shows the fallback UI with a Retry button, not a blank white screen.
- Browser console shows no uncaught exceptions when clicking through all 9 tabs.

**Anti-pattern guards:** Don't wrap the entire `<main>` in one boundary — that blanks the whole app (including nav) for a single-view bug, which the Phase 0 research explicitly flagged as bad for a patient using this app mid-treatment.

---

## Phase 2: Fix the honesty violations

**What to implement** — each item below is a direct copy-from-facts fix, not a rewrite. All locations were re-verified live in this codebase (see file:line citations, current as of this plan):

1. **`src/Login.jsx:194`** — `"Your data stays on your device. No cloud storage, no third parties."` directly contradicts the Supabase cloud-auth block at `Login.jsx:20-47` (confirmed still present: `import('@supabase/supabase-js')` at line 27, `localStorage.setItem('supabase_user', ...)` at line 38). **Decide and implement one of two fixes** (this is a product decision, not just copy — pick based on what the app actually does long-term):
   - (a) If Supabase sync is meant to stay: change the claim to something true, e.g. `"Your data is encrypted at rest. You control whether it syncs to your own Supabase project — nothing else."`
   - (b) If local-only is the actual intent: remove the Supabase cloud-auth code path (`Login.jsx:20-47`) entirely and keep the local-auth fallback only.
   Given the app is a personal single-user tool and the local-auth fallback already exists and works (confirmed live during the audit), **default to (b)** unless you have a specific reason to keep cloud sync — flag this to the user before removing code if uncertain.

2. **`src/Login.jsx:134-135`** — `"HIPAA Compliant"` / `"AES-256 encryption, automated backups, full audit logging"`. Change to a true, specific claim: the backend does do AES-256 DB encryption (confirmed live: `"✅ Database encryption verified (AES-256)"` on server startup) — keep that part, drop "HIPAA Compliant" (no certification exists) and "full audit logging" (not found anywhere in `server/`) unless those features get built first. Suggested replacement: `"Encrypted at Rest" / "AES-256 database encryption. Your data, secured."`

3. **`src/Login.jsx:126-127`** — `"Research Scanner" / "Automated search for relevant clinical trials and treatment research"`. The actual Research tab (confirmed live) honestly says "automated search is being implemented" with a disabled Search button and real PubMed/ClinicalTrials.gov links. Change the Login claim to match: `"Research Library" / "Save and organize research from PubMed and ClinicalTrials.gov"` (describes what exists today; update again once automated search ships).

4. **`src/components/PortalManager.jsx:455-457`** — `"🔓 Unlock Vault"` button currently does `onClick={() => window.location.reload()}`. The real unlock form exists separately around lines 429-431. Fix: either remove this dead button (if the real form is the actual UI users see), or if this button is meant to be a distinct "return to unlock screen" action, relabel it accurately (e.g. `"↻ Reload"`) instead of implying it performs an unlock. Read the surrounding ~40 lines first to confirm which case applies before editing.

5. **`src/components/PortalManager.jsx:676`** — `"Send Telegram notification on sync completion"` checkbox bound to `formData.notify_on_sync`, with zero backend Telegram integration (confirmed via `grep -i telegram server/*.js` → no matches). Either remove the checkbox, or label it accurately as not-yet-implemented (e.g. move it out of the active form into a visibly-disabled "Coming soon" section) — do not ship a checkbox that silently does nothing.

6. **`src/components/RadiologyViewer.jsx:680`** — `"Showing volumetric reconstruction from {study.modality} data."` — `server/radiology.js:126-136` confirms this is `generateDemoVolume()`, explicitly commented `"synthetic CT-like volume... used when no actual DICOM data is available"`. Change the UI copy to be honest about this, e.g. `"Showing a synthetic {study.modality}-style volume for demonstration — no real imaging data is loaded."` Keep this distinct from any future state where real DICOM data IS loaded (check if `server/radiology.js` has a real-data path elsewhere before assuming this label always applies).

**Documentation references:** all locations directly re-verified in this codebase, see file:line citations above (from the Phase 0 codebase-verification pass).

**Verification checklist:**
- Every changed string in `Login.jsx`, `PortalManager.jsx`, `RadiologyViewer.jsx` is grep-able and matches what the underlying code actually does (spot-check each against its backing implementation, same method the audit used).
- `grep -i telegram server/*.js` — decide and confirm: either it now returns a match (feature built) or the checkbox was removed/marked not-implemented.

**Anti-pattern guards:** Don't just soften the wording ("AI-powered" → "smart") without checking whether the underlying claim is even true — verify against the actual code path every time, the way the audit did.

---

## Phase 3: Remove duplication (nav, apiFetch, dead code)

**What to implement:**

1. **`src/App.jsx`** — remove the duplicate "Portals" nav button and duplicate render:
   - Nav buttons at `App.jsx:166-171` and `App.jsx:184-189` are identical (`onClick={() => setActiveTab('portals')}`, label `🔐 Portals`). Delete one (keep whichever fits the intended tab ordering — check the surrounding tab order in the nav bar before choosing which to remove).
   - Render lines `App.jsx:199` and `App.jsx:202` both do `{activeTab === 'portals' && <PortalManager />}`. Delete the duplicate render line — keep one.

2. **`src/components/HealthcareSummary.jsx:3`** and **`src/components/PortalManager.jsx:3`** — both locally define their own `apiFetch` function instead of importing the shared `src/apiFetch.js` (confirmed: single named export `apiFetch`, a fetch wrapper with `credentials: 'include'` and JSON header default). Replace the local definitions with `import { apiFetch } from '../apiFetch';` (adjust relative path to match actual location) and delete the local duplicate function bodies.

3. **Unused imports** — `import React` is unused in `BoneHealthTracker.jsx:1`, `RadiologyViewer.jsx:1`, `NutritionTracker.jsx:1`, `MedicationEvidenceModal.jsx:1` (confirmed via the audit's structural evidence pass, new JSX transform doesn't need it). Remove each.

4. **Copy-pasted style block** — `src/components/PrecisionMedicineDashboard.jsx` has an identical ~15-line hover-elevate inline style object repeated 7x (lines 151-167, 222-238, 280-296, 411-427, 468-485, 542-558, 632-650, per audit). Extract into one shared constant or helper function in the same file (e.g. `const hoverCardSx = { ... }` or `const getHoverCardSx = (isHovered) => ({ ... })`) and reference it at all 7 call sites. Re-read each of the 7 sites first — the audit found them "verbatim" but confirm no site has a meaningful variation before collapsing them.

**Documentation references:** `01-evidence.md` Structural section (repeated-pattern and dead-import counts); direct current-line verification from Phase 0's codebase agent.

**Verification checklist:**
- `grep -c "Portals" src/App.jsx` nav buttons — exactly 1 button, exactly 1 render line for the portals tab.
- `grep -n "const apiFetch" src/components/*.jsx` — returns zero results (only the shared `src/apiFetch.js` defines it).
- `grep -n "^import React" src/components/*.jsx` — returns zero results for the 4 files listed.
- App still renders and all 9 tabs (now 8 unique, post-dedupe) switch correctly — click through each manually or via browser automation.

**Anti-pattern guards:** Don't delete the *wrong* duplicate blindly — check which nav position/render order makes more sense in context before removing either copy.

---

## Phase 4: Design-token system (MUI theme)

**What to implement:**

1. Create `src/theme.js`:

```js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#2563eb' },  // matches existing dominant blue, App.css
    secondary: { main: '#7c3aed' },
    success:   { main: '#10b981' },
    error:     { main: '#ef4444' },
    warning:   { main: '#f59e0b' },
    info:      { main: '#3b82f6' },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',   // passes 4.5:1 on white per audit — use this instead of #9ca3af for body text
    },
  },
  spacing: 8, // establishes a real 8px grid, replacing the 16-value ad hoc scale
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '2rem' },      // 32px
    h2: { fontSize: '1.5rem' },    // 24px
    h3: { fontSize: '1.25rem' },   // 20px
    body1: { fontSize: '1rem' },   // 16px
    body2: { fontSize: '0.875rem' }, // 14px
    caption: { fontSize: '0.75rem' }, // 12px
  },
});

export default theme;
```
Palette main colors are chosen from the *most-used* existing hex values per the audit's color inventory (`#2563eb` blue, `#10b981` green, `#ef4444` red, `#f59e0b` amber) — this preserves the existing visual identity (per the audit's "preserve brand tokens" instruction) while consolidating the 83 hardcoded hexes down to one source of truth.

2. Wrap the app root in `src/main.jsx`:

```jsx
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
// existing imports...

root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
```

3. **Do not attempt a full one-pass migration of all 107 `sx=` usages and every CSS hex value in this phase** — that's too large a surgical change for one sitting and risks visual regressions across 9 feature views. Instead:
   - Fix the specific contrast failures the audit flagged first (highest-leverage, safety-relevant): `App.css:211-216` `.empty` and `App.css:218-223` `.coming-soon` — change `color: #9ca3af` to `color: #6b7280` (passes 4.5:1 per the audit's own contrast calculation) or reference `theme.palette.text.secondary` if migrating that file to `sx`.
   - For any *new* component work going forward, use theme tokens (`sx={{ color: 'primary.main' }}`) instead of hardcoded hex — this stops the problem from growing while a full sweep is scheduled separately.

**Documentation references:** MUI v7 `createTheme`/`ThemeProvider`/`sx` token resolution, Context7 `/mui/material-ui/v7_3_2` (Phase 0 findings above); `01-evidence.md` Visual section for the specific hex values and contrast failures being fixed.

**Verification checklist:**
- App builds and renders with `<ThemeProvider>` wrapping it, no console errors about theme shape.
- `.empty` and `.coming-soon` text now measures ≥4.5:1 contrast against their background (recompute with the WCAG formula, same method the audit used).
- Existing visual appearance is not drastically altered — the palette main colors were chosen to match existing dominant hexes specifically to avoid a jarring visual change.

**Anti-pattern guards:** Don't invent new brand colors — the audit's "preserve" list explicitly says keep the blue/gray palette direction; this phase formalizes it, doesn't replace it. Don't try to migrate all 83 hex values in one phase — that's explicitly out of scope here to keep this phase reviewable and low-risk.

---

## Final Phase: Verification

1. **Re-run the audit's live checks:**
   - Click through all tabs (now 8 unique after Phase 3 dedupe) — confirm no uncaught console exceptions (`onlyErrors: true` in `read_console_messages`).
   - Confirm the Radiology crash no longer reproduces even with a bad API response (re-test the Phase 1 verification scenario).
   - Re-read `Login.jsx` and confirm every claim now matches its backing code (repeat the Phase 0 codebase-verification agent's method: grep the claim, grep the implementation, confirm match).

2. **Grep for anti-patterns:**
   - `grep -n "const apiFetch" src/components/*.jsx` → 0 results.
   - `grep -c "Portals" src/App.jsx` for nav buttons and render lines → exactly 1 each.
   - `grep -n "^import React" src/components/*.jsx` for the 4 flagged files → 0 results.

3. **Bundle check:** `npm run build`, then `du -ch dist/assets/*.js | tail -1` — compare against the audit's baseline (2,154.7 KB raw / 621.94 KB gzipped). A full reduction to <500KB gzipped requires MUI tree-shaking/theming work beyond this plan's scope (noted as a future pass in Phase 4) — for this plan, confirm the number hasn't *grown*, not that it's hit the audit's aspirational threshold.

4. **Run existing tests:** `npm test` (vitest) — confirm no regressions in the existing `apiFetch`, config-validator, and radiology test suites (per recent commit history, these exist).

5. If time allows, hand the result back through `/design-is` for a follow-up score — expect #2 (useful), #6 (honest), #8 (thorough) to move off 0, and #4/#10 to improve from the dedup work. A full REFINE-level score is not expected from this plan alone (the full states/accessibility/bundle-size sweep is intentionally out of scope here) — treat that as the next planning cycle.
