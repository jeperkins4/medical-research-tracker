# MyTreatmentPath: Launch Checklist

**Goal:** Get MRT live and downloadable by users.

---

## Phase 1: Pre-Launch Prep (1 hour)

### Code Preparation
- [ ] Update API endpoint in `src/services/api.js`:
  ```javascript
  const API_URL = 'https://mrt-api.onrender.com'; // or custom domain
  ```

- [ ] Update download URLs in `landing-page/index.html`:
  ```
  Find: yourusername
  Replace: jeperkins4 (or your GitHub username)
  ```

- [ ] Test app locally:
  ```bash
  npm run electron:dev
  # Verify all features work
  ```

- [ ] Update version in `package.json`:
  ```json
  "version": "0.1.0"
  ```

---

## Phase 2: Backend Deployment (15 min)

### Push to GitHub
```bash
cd ~/.openclaw/workspace/medical-research-tracker
git init
git add .
git commit -m "Initial release v0.1.0"
git remote add origin https://github.com/jeperkins4/medical-research-tracker.git
git push -u origin main
```

### Deploy to Render
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repo: `jeperkins4/medical-research-tracker`
4. Settings:
   - **Name:** `mrt-api`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
   - **Plan:** Free (or Starter $7/month)
5. Add Environment Variables:
   ```
   NODE_ENV=production
   SUPABASE_URL=https://ylcgxdfhexeyvythdnmg.supabase.co
   SUPABASE_KEY=eyJhbG...
   OPENAI_API_KEY=sk-proj-...
   SESSION_SECRET=random-32-char-string
   ```
6. Click "Create Web Service"
7. Wait for deploy (~5 min)
8. Test API: `curl https://mrt-api.onrender.com/health`

**Checkpoint:** Backend live at `https://mrt-api.onrender.com`

---

## Phase 3: Build Desktop App (30 min)

### macOS Build
```bash
cd ~/.openclaw/workspace/medical-research-tracker

# Clean previous builds
rm -rf build dist

# Build for macOS
npm run electron:build:mac

# Output files will be in build/:
# - MyTreatmentPath-0.1.0-arm64.dmg (Apple Silicon)
# - MyTreatmentPath-0.1.0.dmg (Intel)
# - MyTreatmentPath-0.1.0-arm64-mac.zip
# - MyTreatmentPath-0.1.0-mac.zip
```

### Windows Build (Optional)
```bash
npm run electron:build:win
# Output:
# - MyTreatmentPath Setup 0.1.0.exe
# - MyTreatmentPath 0.1.0.exe (portable)
```

### Linux Build (Optional)
```bash
npm run electron:build:linux
# Output:
# - MyTreatmentPath-0.1.0.AppImage
# - mytreatmentpath_0.1.0_amd64.deb
```

**Checkpoint:** DMG files created in `build/` directory

---

## Phase 4: Upload to GitHub Releases (10 min)

```bash
# Install GitHub CLI if needed
brew install gh

# Login
gh auth login

# Create release
gh release create v0.1.0 \
  build/MyTreatmentPath-0.1.0-arm64.dmg \
  build/MyTreatmentPath-0.1.0.dmg \
  --title "MyTreatmentPath v0.1.0" \
  --notes "🎉 Initial public release

**Features:**
- Health dashboard with vitals, labs, medications
- Genomic integration (Foundation One CDx)
- Research discovery (PubMed + ClinicalTrials.gov)
- AI strategy insights (GPT-4)
- Nutrition tracking
- Automated research alerts
- Privacy-first design

**Downloads:**
- macOS Apple Silicon (M1/M2/M3): MyTreatmentPath-0.1.0-arm64.dmg
- macOS Intel: MyTreatmentPath-0.1.0.dmg

**System Requirements:**
- macOS 11.0 (Big Sur) or later

**Known Issues:**
- First launch requires right-click → Open (Gatekeeper)
- Windows/Linux builds coming soon"
```

**Checkpoint:** Release live at `https://github.com/jeperkins4/medical-research-tracker/releases/tag/v0.1.0`

---

## Phase 5: Deploy Landing Page (10 min)

### Update Download Links
```bash
cd landing-page

# Edit index.html, update GitHub URLs:
# Line ~157 and ~165:
href="https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.0/MyTreatmentPath-0.1.0-arm64.dmg"
href="https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.0/MyTreatmentPath-0.1.0.dmg"
```

### Deploy to Netlify
```bash
# Option A: Drag & drop
# Go to https://app.netlify.com/drop
# Drag landing-page/ folder
# Done!

# Option B: CLI
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

**Checkpoint:** Landing page live at `https://mytreatmentpath.netlify.app` (or custom domain)

---

## Phase 6: Testing (15 min)

### Test Landing Page
- [ ] Visit landing page URL
- [ ] Click download button (Apple Silicon)
- [ ] Verify download starts
- [ ] Click download button (Intel)
- [ ] Verify download starts
- [ ] Test on mobile (responsive design)
- [ ] Test FAQ links scroll smoothly
- [ ] Test navigation links work

### Test Desktop App
- [ ] Install DMG on clean Mac
- [ ] Open app (right-click → Open first time)
- [ ] Create account / login
- [ ] Add health data (vitals, medication)
- [ ] Search research (verify API connection)
- [ ] Generate AI summary (verify OpenAI integration)
- [ ] Verify data persists after restart

### Test Backend API
```bash
# Health check
curl https://mrt-api.onrender.com/health

# Should return: {"status":"ok"}
```

**Checkpoint:** Everything works end-to-end

---

## Phase 7: Legal Pages (30 min)

Create before public announcement:

### Privacy Policy
```bash
cd landing-page
touch privacy.html
```
- Explain data collection (local-first, optional cloud sync)
- OpenAI usage (AI summaries send data to OpenAI)
- Third-party services (PubMed, ClinicalTrials.gov, Supabase)
- User rights (export, delete data)
- GDPR compliance

### Terms of Service
```bash
touch terms.html
```
- License (MIT or proprietary)
- User responsibilities
- Liability limitations
- Termination conditions

### Medical Disclaimer
```bash
touch disclaimer.html
```
- **Critical:** Not medical advice
- Not a medical device
- Always consult healthcare providers
- No warranties or guarantees
- Emergency situations guidance

**Checkpoint:** Legal pages created and linked from footer

---

## Phase 8: Optional Enhancements

### Custom Domain ($12/year)
1. Buy domain: mytreatmentpath.com
2. Netlify dashboard → Domain settings → Add custom domain
3. Update DNS:
   ```
   A     @     → 75.2.60.5
   CNAME www   → mytreatmentpath.netlify.app
   ```
4. Render dashboard → Custom Domain → Add api.mytreatmentpath.com
5. Update DNS:
   ```
   CNAME api   → mrt-api.onrender.com
   ```
6. Wait for SSL (~5 min)
7. Update API URL in app if using custom domain

### Analytics
```html
<!-- Add to landing-page/index.html before </head> -->

<!-- Plausible (privacy-friendly) -->
<script defer data-domain="mytreatmentpath.com" src="https://plausible.io/js/script.js"></script>

<!-- OR Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Monitoring
1. **Uptime monitoring:**
   - Sign up: https://uptimerobot.com (free)
   - Monitor: `https://mrt-api.onrender.com/health`
   - Alert: Email/SMS if down

2. **Error tracking:**
   ```bash
   npm install @sentry/node
   # Add to server/index.js
   ```

### SEO
- [ ] Add favicon.ico
- [ ] Add og-image.png (1200x630px)
- [ ] Add sitemap.xml
- [ ] Add robots.txt
- [ ] Submit to Google Search Console

---

## Phase 9: Launch Announcement

### Social Media
- [ ] Twitter/X announcement thread
- [ ] LinkedIn post
- [ ] Product Hunt submission
- [ ] Hacker News (Show HN)
- [ ] Reddit (r/HealthIT, r/biohacking)

### Email
- [ ] Email to friends/family
- [ ] Email to beta testers
- [ ] Email to interested users (if any)

### Content
- [ ] Blog post: "Why I built MyTreatmentPath"
- [ ] Demo video (3-5 min)
- [ ] Screenshots for social sharing

---

## Launch Day Checklist

**Morning of launch:**
- [ ] Final test: Download → Install → Use
- [ ] Backend API responding
- [ ] Landing page loads fast
- [ ] All links work
- [ ] Legal pages complete
- [ ] Social posts drafted
- [ ] Monitor setup (uptime, errors)

**Announce!**
- [ ] Tweet launch
- [ ] Post on LinkedIn
- [ ] Submit to Product Hunt
- [ ] Post on Hacker News
- [ ] Share in health tech communities
- [ ] Email announcement

**Monitor:**
- [ ] Check Render logs (any errors?)
- [ ] Check analytics (traffic?)
- [ ] Check GitHub releases (downloads?)
- [ ] Respond to questions/issues
- [ ] Fix critical bugs ASAP

---

## Post-Launch (Week 1)

- [ ] Collect user feedback
- [ ] Fix reported bugs
- [ ] Update documentation based on user questions
- [ ] Write tutorial blog posts
- [ ] Create video walkthrough
- [ ] Thank early users
- [ ] Plan v0.2.0 features

---

## Success Metrics

**Day 1:**
- 50+ website visits
- 5+ downloads
- 0 critical bugs

**Week 1:**
- 200+ website visits
- 20+ downloads
- 5+ active users
- 1+ testimonial

**Month 1:**
- 1,000+ website visits
- 100+ downloads
- 25+ active users
- 5+ testimonials
- Featured on 1 health tech blog

---

## Emergency Contacts

**If something breaks:**
- Backend down → Check Render logs
- App crashes → Check GitHub issues
- Domain issues → Check DNS settings
- Security concern → Email security@mytreatmentpath.com

**Support channels:**
- Email: support@mytreatmentpath.com
- GitHub Issues: https://github.com/jeperkins4/medical-research-tracker/issues
- Twitter: @MyTreatmentPath (if created)

---

## You're Ready! 🚀

**Estimated time to launch:** 2-3 hours

**Start now:**
```bash
# Step 1: Push to GitHub
git push

# Step 2: Deploy to Render
# (via web dashboard)

# Step 3: Build app
npm run electron:build:mac

# Step 4: Create GitHub Release
gh release create v0.1.0 build/*.dmg

# Step 5: Deploy landing page
cd landing-page && netlify deploy --prod

# Done!
```

Good luck! 🎉
