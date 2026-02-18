# Deploy Website to Vercel

The public-facing website lives in the `website/` directory of this repo.

## Quick Deploy (5 minutes)

### 1. Connect Vercel to This Repo

**Option A: Vercel Dashboard**
1. Go to https://vercel.com/new
2. Import `jeperkins4/medical-research-tracker`
3. **Important:** Configure project settings:
   - **Root Directory:** `website`
   - **Build Command:** Leave empty (static HTML)
   - **Output Directory:** Leave empty
4. Click **Deploy**
5. Done! Site live at `https://medical-research-tracker.vercel.app`

**Option B: Vercel CLI**
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (first time - will ask for config)
vercel

# When prompted:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - What's your project's name? mytreatmentpath
# - In which directory is your code located? website
# - Want to modify settings? N

# Deploy to production
vercel --prod
```

### 2. Configure Vercel Project Settings

If you already deployed and need to change settings:

1. Go to your project dashboard: https://vercel.com/jeperkins4/medical-research-tracker
2. **Settings** → **General**
3. **Root Directory:** Set to `website`
4. **Build & Development Settings:**
   - Build Command: (leave empty or `echo 'Static HTML'`)
   - Output Directory: (leave empty)
   - Install Command: (leave empty - no dependencies)

### 3. Auto-Deploy Setup

Once connected, Vercel will:
- ✅ Auto-deploy on every push to `main` branch
- ✅ Create preview deployments for pull requests
- ✅ Only deploy files from `website/` directory (thanks to `.vercelignore`)

### 4. Custom Domain (Optional)

1. Buy domain (e.g., `mytreatmentpath.com`)
2. Vercel Dashboard → Your Project → **Settings** → **Domains**
3. Click **Add Domain** → Enter domain → Follow DNS instructions
4. SSL certificate auto-provisions in ~5 minutes

**DNS Records:**
```
Type    Name    Value
A       @       76.76.21.21 (Vercel IP)
CNAME   www     cname.vercel-dns.com
```

Or use Vercel nameservers (easier):
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

## Verify Deployment

After deploying, check these URLs work:

- Landing page: `https://[your-domain].vercel.app/`
- Privacy Policy: `https://[your-domain].vercel.app/privacy.html`
- Terms: `https://[your-domain].vercel.app/terms.html`
- Download redirect: `https://[your-domain].vercel.app/download` → GitHub Releases

## Update Website Content

Just edit files in `website/` and push:

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
# Edit website/index.html, website/privacy.html, etc.

git add website/
git commit -m "Update website content"
git push origin main

# Vercel auto-deploys in ~30 seconds!
```

## Troubleshooting

### Build fails with "Cannot find module better-sqlite3"
**Fix:** Vercel is trying to build the Electron app, not the website.
- Set **Root Directory** to `website` in project settings
- Check `.vercelignore` excludes `package.json` at root level

### 404 on privacy.html or terms.html
**Fix:** Vercel might not be serving `website/` files.
- Verify **Root Directory** is set to `website`
- Check files exist: `ls -la website/`
- Redeploy: `vercel --prod`

### Changes aren't showing up
**Fix:** Clear cache and redeploy.
- Vercel Dashboard → Your Project → **Deployments** → Latest → **...** → **Redeploy**
- Or trigger new push to `main` branch

## Environment Variables (If Needed Later)

For future features (analytics, contact forms, etc.):

1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add variables:
   - `ANALYTICS_API_KEY` (if using Plausible/Fathom)
   - `CONTACT_FORM_WEBHOOK` (if adding contact form)

## Security Headers

Already configured in `vercel.json`:
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy: camera=(), microphone=(), geolocation=()

## Questions?

- Vercel Docs: https://vercel.com/docs
- Deployment Issues: https://github.com/jeperkins4/medical-research-tracker/issues
- Email: support@mytreatmentpath.com

---

**Ready to deploy!** Visit https://vercel.com/new and import this repo.
