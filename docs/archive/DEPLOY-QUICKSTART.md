# MyTreatmentPath: Deploy in 1 Hour

**Goal:** Get MRT live on the internet with downloadable macOS app.

---

## 🚀 Fast Path (Render + Netlify)

### Step 1: Deploy Backend (10 min)

```bash
# 1. Push code to GitHub
cd ~/.openclaw/workspace/medical-research-tracker
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jeperkins4/medical-research-tracker.git
git push -u origin main

# 2. Deploy to Render
# - Go to https://render.com
# - New → Web Service
# - Connect GitHub repo: jeperkins4/medical-research-tracker
# - Settings:
#   Name: mrt-api
#   Environment: Node
#   Build Command: npm install
#   Start Command: node server/index.js
#   Plan: Free (or Starter $7/month for custom domain)

# 3. Add Environment Variables in Render dashboard:
NODE_ENV=production
SUPABASE_URL=https://ylcgxdfhexeyvythdnmg.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-...
SESSION_SECRET=random-32-char-string-here

# 4. Deploy!
# Click "Create Web Service"
# API will be live at: https://mrt-api.onrender.com
```

**Test API:**
```bash
curl https://mrt-api.onrender.com/health
# Should return: {"status":"ok"}
```

---

### Step 2: Build macOS App (15 min)

```bash
cd ~/.openclaw/workspace/medical-research-tracker

# Update API endpoint
# Edit src/services/api.js:
const API_URL = 'https://mrt-api.onrender.com';

# Build for macOS
npm run electron:build:mac

# Output files:
# build/MyTreatmentPath-0.1.0-arm64.dmg (Apple Silicon)
# build/MyTreatmentPath-0.1.0.dmg (Intel)
```

---

### Step 3: Upload Builds to GitHub Releases (10 min)

```bash
# Create release
gh release create v0.1.0 \
  build/MyTreatmentPath-0.1.0-arm64.dmg \
  build/MyTreatmentPath-0.1.0.dmg \
  --title "MyTreatmentPath v0.1.0" \
  --notes "Initial public release"

# Download URLs will be:
# https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.0/MyTreatmentPath-0.1.0-arm64.dmg
# https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.0/MyTreatmentPath-0.1.0.dmg
```

---

### Step 4: Deploy Landing Page (10 min)

```bash
# Update download links in landing-page/index.html:
# Replace "yourusername" with "jeperkins4"

cd landing-page

# Deploy to Netlify
npm install -g netlify-cli
netlify login
netlify init
# Follow prompts:
# - Create new site
# - Site name: mytreatmentpath
# - Publish directory: . (current directory)

netlify deploy --prod

# Site live at: https://mytreatmentpath.netlify.app
```

---

### Step 5: Custom Domain (15 min) - Optional

**Buy domain (if you don't have one):**
- Go to Namecheap or Google Domains
- Buy: mytreatmentpath.com (~$12/year)

**Configure DNS:**
```
# For Netlify (landing page):
A     @       → 75.2.60.5
CNAME www     → mytreatmentpath.netlify.app

# For Render (API):
CNAME api     → mrt-api.onrender.com
```

**Update Netlify:**
- Dashboard → Domain settings
- Add custom domain: mytreatmentpath.com
- SSL auto-configures in ~5 min

**Update Render:**
- Dashboard → Settings → Custom Domain
- Add: api.mytreatmentpath.com
- Update download links to use custom domain

---

## ✅ Done!

**You now have:**
- ✅ Live API: https://api.mytreatmentpath.com
- ✅ Marketing site: https://mytreatmentpath.com
- ✅ Downloadable macOS app (Intel + ARM)
- ✅ GitHub releases for version control
- ✅ SSL certificates (HTTPS everywhere)

**Total time:** ~1 hour  
**Total cost:** $0-8/month (Free tier or $7 Render Starter)

---

## 📝 Post-Launch Checklist

- [ ] Test download links
- [ ] Install app on clean Mac (verify it works)
- [ ] Test API connection from app
- [ ] Add privacy policy page
- [ ] Add medical disclaimer
- [ ] Setup uptime monitoring (UptimeRobot, free)
- [ ] Add analytics (optional: Plausible, privacy-friendly)
- [ ] Tweet/share launch announcement
- [ ] Add to Product Hunt (optional)

---

## 🔄 Future Updates

**To release new version:**
```bash
# 1. Update version in package.json
# 2. Build
npm run electron:build:mac

# 3. Create GitHub release
gh release create v0.2.0 \
  build/MyTreatmentPath-0.2.0-arm64.dmg \
  build/MyTreatmentPath-0.2.0.dmg \
  --title "MyTreatmentPath v0.2.0" \
  --notes "New features: ..."

# 4. Update landing page download links
# 5. Announce on Twitter/email list
```

---

## 🆘 Troubleshooting

**API not connecting:**
- Check CORS settings in server/index.js
- Verify SUPABASE_URL/KEY in Render env vars
- Check Render logs: Dashboard → Logs

**App won't open on Mac:**
- User needs to right-click → Open (first time only)
- Or: System Preferences → Security → Allow

**Build errors:**
- Clear cache: `rm -rf node_modules build dist`
- Reinstall: `npm install`
- Try: `npm run electron:build:mac -- --dir` (faster dev build)

---

**Ready to launch? Run Step 1 now!**
