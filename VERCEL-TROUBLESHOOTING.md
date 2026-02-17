# Vercel Deployment Troubleshooting

## Error: better-sqlite3 build failure on Node v24

**Symptom:**
```
npm error /vercel/.cache/node-gyp/24.13.0/include/node/v8-template.h:1110:6: 
error: no matching function for call to 'v8::Template::Set...'
```

**Root Cause:**
- Vercel was trying to build the entire project (including Node.js backend with SQLite)
- `better-sqlite3` is a native C++ module that requires compilation
- Node v24.13.0 has V8 API changes incompatible with current better-sqlite3 version

**Fix Applied:**

### 1. Moved SQLite to optionalDependencies
```json
// package.json
"optionalDependencies": {
  "better-sqlite3": "^12.6.2",
  "better-sqlite3-multiple-ciphers": "^11.10.0"
}
```

This tells npm: "Try to install these, but don't fail if build fails."

### 2. Created vercel.json configuration
```json
{
  "outputDirectory": "landing-page",
  "installCommand": "echo 'No dependencies to install'",
  "buildCommand": "echo 'Static site - no build needed'"
}
```

This tells Vercel: "Only deploy the static landing-page/ folder, skip npm install."

---

## Verify Fix

After pushing to GitHub, Vercel will auto-redeploy. Check:

1. **Vercel Dashboard → Deployments → Latest**
2. Build log should show:
   ```
   Static site - no build needed
   ✓ Build completed
   ```
3. No more SQLite/node-gyp errors

---

## Architecture Clarification

**MRT has 3 parts:**

1. **Landing Page** (HTML/CSS/JS)
   - Deploy to: Vercel (static hosting)
   - No backend, no build, just static files
   - Location: `landing-page/`

2. **Electron Desktop App** (React + SQLite + Express)
   - Build locally: `npm run electron:build:mac`
   - Distribute via: GitHub Releases
   - Database: Local SQLite (better-sqlite3)

3. **Cloud Sync Backend** (Optional - if needed later)
   - Deploy to: Render.com or Railway (Node.js hosting)
   - Database: Supabase PostgreSQL (no SQLite)
   - Location: `server/` (but uses Supabase, not better-sqlite3)

**What we're deploying to Vercel:** #1 only (static landing page).

---

## How to Redeploy

### Option A: Auto-Deploy (Recommended)
```bash
cd ~/.openclaw/workspace/medical-research-tracker
git push origin main
# Vercel auto-detects push and redeploys
```

### Option B: Manual Redeploy
```bash
# In Vercel Dashboard
1. Go to Deployments tab
2. Click "..." on latest deployment
3. Click "Redeploy"
```

### Option C: CLI Redeploy
```bash
cd ~/.openclaw/workspace/medical-research-tracker/landing-page
vercel --prod
```

---

## What if it still fails?

### 1. Check Vercel Project Settings

**Vercel Dashboard → Settings → General:**
- Root Directory: `landing-page` (NOT `.` or empty)
- Framework Preset: Other (NOT Next.js, Create React App, etc.)
- Build Command: (leave empty or `echo 'No build needed'`)
- Output Directory: `.` (current directory, since root is already landing-page/)
- Install Command: (leave empty or `echo 'No install needed'`)

### 2. Check vercel.json is committed

```bash
cd ~/.openclaw/workspace/medical-research-tracker
git status
# Should show "nothing to commit" if changes are pushed
```

### 3. Check package.json changes

```bash
cat package.json | grep -A5 "optionalDependencies"
# Should show better-sqlite3 entries
```

### 4. Force clean deploy

```bash
# In Vercel Dashboard
1. Settings → General → Scroll to bottom
2. Click "Delete Project" (don't worry, just reconnect)
3. Create new project
4. Import repo again
5. Set Root Directory: landing-page
6. Deploy
```

---

## Alternative: Use Netlify Instead

If Vercel continues to have issues:

```bash
cd ~/.openclaw/workspace/medical-research-tracker/landing-page

# Create netlify.toml
cat > netlify.toml << 'EOF'
[build]
  publish = "."
  command = "echo 'Static site - no build'"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"

[[redirects]]
  from = "/download"
  to = "https://github.com/jeperkins4/medical-research-tracker/releases/latest"
  status = 302
EOF

# Deploy
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

Netlify is more forgiving with monorepo structures and optional dependencies.

---

## Backend Deployment (Not Needed Yet)

**When you're ready to deploy the Express backend (server/):**

**Option 1: Render.com**
```bash
# Uses Supabase (PostgreSQL), NOT SQLite
# Create render.yaml:
services:
  - type: web
    name: mrt-api
    env: node
    buildCommand: npm install
    startCommand: node server/index.js
    envVars:
      - key: DATABASE_URL
        value: (Supabase connection string)
```

**Option 2: Railway.app**
```bash
# Auto-detects Node.js, deploys from GitHub
# Just connect repo, Railway handles the rest
```

**Do NOT deploy backend to Vercel** - it's designed for serverless functions, not long-running Express servers.

---

## Summary

**What we fixed:**
1. ✅ Moved SQLite to optionalDependencies (prevents build failures)
2. ✅ Created vercel.json (tells Vercel to deploy static landing page only)
3. ✅ Committed and pushed to GitHub

**What Vercel will do now:**
1. ✅ Detect push to main branch
2. ✅ Read vercel.json configuration
3. ✅ Deploy only landing-page/ folder
4. ✅ Skip npm install (no dependencies needed)
5. ✅ Serve static HTML/CSS/JS
6. ✅ Success! 🎉

**Next steps:**
1. Push to GitHub: `git push origin main`
2. Check Vercel Dashboard → Deployments
3. Verify build succeeds
4. Visit deployed URL
5. Test download links

---

**Expected build log after fix:**
```
[Vercel] Running build command: echo 'Static site - no build needed'
Static site - no build needed
[Vercel] Build completed in 2s
[Vercel] Deploying outputs...
[Vercel] Deployment complete!
✓ https://medical-research-tracker.vercel.app
```

If you see this, deployment is fixed! 🚀
