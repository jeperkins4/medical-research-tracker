# Deploy MRT Landing Page to Vercel

## Overview

Deploy the MyTreatmentPath marketing website to Vercel for free, fast, global CDN hosting.

**Benefits:**
- ✅ Free tier (perfect for landing pages)
- ✅ Automatic HTTPS/SSL
- ✅ Global CDN (fast worldwide)
- ✅ Auto-deploy from GitHub
- ✅ Custom domains
- ✅ Built-in analytics

---

## Option 1: Deploy via Vercel Dashboard (Easiest - 5 min)

### Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel to access your repos

### Step 2: Create New Project

1. Click **"Add New..." → Project**
2. **Import Git Repository:**
   - If you haven't pushed to GitHub yet, do that first:
     ```bash
     cd ~/.openclaw/workspace/medical-research-tracker
     git add landing-page/
     git commit -m "Add landing page"
     git push origin main
     ```
   - Select your `medical-research-tracker` repo
   - Click **"Import"**

3. **Configure Project:**
   - **Framework Preset:** Other (it's just HTML/CSS/JS)
   - **Root Directory:** `landing-page`
   - **Build Command:** (leave empty - no build needed)
   - **Output Directory:** `.` (current directory)
   - **Install Command:** (leave empty)

4. Click **"Deploy"**

5. **Done!** Site will be live at:
   ```
   https://medical-research-tracker-[random].vercel.app
   ```

---

## Option 2: Deploy via Vercel CLI (5 min)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login

```bash
vercel login
# Opens browser to authenticate
```

### Step 3: Deploy

```bash
cd ~/.openclaw/workspace/medical-research-tracker/landing-page
vercel

# First time prompts:
# Set up and deploy? Yes
# Which scope? (your account)
# Link to existing project? No
# Project name? medical-research-tracker
# In which directory is your code located? ./ (current)

# Vercel will deploy and give you a URL:
# https://medical-research-tracker-abc123.vercel.app
```

### Step 4: Deploy to Production

```bash
vercel --prod
# Production URL: https://medical-research-tracker.vercel.app
```

---

## Option 3: Auto-Deploy from GitHub (Recommended)

**Best workflow:** Push to GitHub → Vercel auto-deploys

1. **Connect GitHub repo** (via Vercel dashboard - Option 1)
2. **Every git push to `main` branch** → Auto-deploys to production
3. **Pull requests** → Auto-preview deployments (test before merging)

**Setup:**
```bash
# Just push to GitHub
cd ~/.openclaw/workspace/medical-research-tracker
git add landing-page/
git commit -m "Update landing page"
git push origin main

# Vercel auto-deploys within 30 seconds!
```

---

## Custom Domain Setup (mytreatmentpath.com)

### Step 1: Buy Domain (if you don't have it)

- Namecheap: ~$12/year
- Google Domains: ~$12/year
- Cloudflare Registrar: ~$9/year (cheapest)

### Step 2: Add Domain to Vercel

1. Vercel Dashboard → Your Project → **Settings → Domains**
2. Click **"Add"**
3. Enter: `mytreatmentpath.com`
4. Click **"Add"**

### Step 3: Configure DNS

Vercel will show you DNS records to add. Two options:

**Option A: Use Vercel Nameservers (Easiest)**
```
1. Vercel gives you nameservers:
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   
2. Go to your domain registrar (Namecheap, etc.)
3. Change nameservers to Vercel's
4. Wait ~24 hours for propagation
5. Vercel handles everything (SSL, DNS, etc.)
```

**Option B: Use Existing DNS (More control)**
```
Add these DNS records:

A Record:
  Name: @
  Value: 76.76.21.21

CNAME Record:
  Name: www
  Value: cname.vercel-dns.com

Wait ~1 hour for DNS to propagate
Vercel auto-provisions SSL certificate
```

### Step 4: Verify

1. Check domain status in Vercel dashboard
2. Should show: ✅ Valid Configuration
3. Visit: https://mytreatmentpath.com
4. SSL should be active (🔒 in browser)

---

## Update Download Links

Once deployed, update the GitHub download URLs in `index.html`:

```html
<!-- Current (replace "yourusername" with "jeperkins4") -->
<a href="https://github.com/yourusername/medical-research-tracker/releases/download/v0.1.0/MyTreatmentPath-0.1.0-arm64.dmg">

<!-- Updated -->
<a href="https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.0/MyTreatmentPath-0.1.0-arm64.dmg">
```

Commit and push:
```bash
cd ~/.openclaw/workspace/medical-research-tracker
git add landing-page/index.html
git commit -m "Update download links"
git push origin main
# Vercel auto-deploys
```

---

## Environment Variables (if needed)

If you add analytics or backend API calls to the landing page:

1. Vercel Dashboard → Your Project → **Settings → Environment Variables**
2. Add key-value pairs
3. Redeploy to pick up new variables

Example:
```
NEXT_PUBLIC_API_URL=https://api.mytreatmentpath.com
NEXT_PUBLIC_ANALYTICS_ID=G-XXXXXXXXXX
```

---

## Vercel Configuration File (Optional)

Create `landing-page/vercel.json` for advanced config:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/download",
      "destination": "https://github.com/jeperkins4/medical-research-tracker/releases/latest",
      "permanent": false
    }
  ]
}
```

Benefits:
- Security headers
- Custom redirects (e.g., `/download` → GitHub releases)
- Custom 404 pages
- SPA fallback routing

---

## Deploy Other Pages

Create legal pages and deploy them too:

```bash
cd landing-page

# Create pages
touch privacy.html
touch terms.html
touch disclaimer.html

# Add content (I can help with templates)

# Deploy
git add .
git commit -m "Add legal pages"
git push origin main
# Auto-deploys!
```

---

## Analytics (Optional)

### Vercel Analytics (Built-in, Privacy-friendly)

1. Vercel Dashboard → Your Project → **Analytics**
2. Click **"Enable"**
3. Add to `index.html` before `</head>`:
   ```html
   <script defer src="/_vercel/insights/script.js"></script>
   ```
4. Free: 10K events/month
5. Tracks: Page views, visitors, top pages

### Google Analytics (More detailed)

```html
<!-- Add before </head> in index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Plausible Analytics (Privacy-first, GDPR-friendly)

```html
<!-- Add before </head> -->
<script defer data-domain="mytreatmentpath.com" src="https://plausible.io/js/script.js"></script>
```

Cost: $9/month for up to 10K monthly visitors

---

## Vercel CLI Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Remove a deployment
vercel rm [deployment-url]

# Open project in browser
vercel open

# View environment variables
vercel env ls

# Add environment variable
vercel env add

# Link local project to Vercel project
vercel link
```

---

## Deployment Checklist

Before going live:

- [ ] Update download links (GitHub username)
- [ ] Test all links work
- [ ] Add favicon.ico
- [ ] Add og-image.png (1200x630px for social sharing)
- [ ] Create privacy.html, terms.html, disclaimer.html
- [ ] Test on mobile (responsive design)
- [ ] Add analytics (Vercel or Google)
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (🔒)
- [ ] Test download buttons
- [ ] Update any API_URL references (if using backend)

---

## Troubleshooting

### "Project not found"
```bash
# Re-link to Vercel project
vercel link
```

### "404 Not Found" after deploy
```
# Check Root Directory is set to: landing-page
Vercel Dashboard → Settings → General → Root Directory
```

### Custom domain not working
```
# Check DNS records are correct
dig mytreatmentpath.com
# Should return Vercel's IP: 76.76.21.21

# Check CNAME
dig www.mytreatmentpath.com
# Should return: cname.vercel-dns.com
```

### SSL certificate pending
```
# Wait 1-24 hours after DNS propagation
# Vercel auto-provisions Let's Encrypt SSL
# Check status: Vercel Dashboard → Domains
```

---

## Cost

**Free Tier (Perfect for Landing Page):**
- 100 GB bandwidth/month
- Unlimited sites
- Custom domains
- SSL certificates
- Preview deployments
- **Cost: $0/month**

**Pro Tier (if you need more):**
- 1 TB bandwidth/month
- Analytics included
- Password protection
- Priority support
- **Cost: $20/month**

---

## Post-Launch

After deploying:

1. **Share the link:**
   - Tweet: "Just launched MyTreatmentPath! 🚀"
   - LinkedIn post
   - Email to friends/testers

2. **Monitor analytics:**
   - Vercel Dashboard → Analytics
   - Track visitors, page views
   - See geographic distribution

3. **Iterate:**
   - Update landing page based on feedback
   - A/B test different messaging
   - Add testimonials as users try it

---

## Quick Start (Right Now)

**5-Minute Deploy:**

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Go to landing page directory
cd ~/.openclaw/workspace/medical-research-tracker/landing-page

# 3. Deploy!
vercel --prod

# 4. Done! Copy the URL and share it
```

**That's it!** Your landing page is now live, globally distributed, with HTTPS.

---

## Next Steps

1. ✅ Deploy landing page to Vercel
2. Build macOS app (`npm run electron:build:mac`)
3. Upload to GitHub Releases
4. Update download links on landing page
5. Deploy backend API to Render
6. Custom domain (optional)
7. Launch! 🚀

**Ready to deploy? Just run:** `vercel --prod` in the landing-page directory!
