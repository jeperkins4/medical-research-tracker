# Medical Research Tracker: Cloud Deployment Guide

## Overview

Deploy MRT backend to cloud server + host marketing website with Electron app downloads.

**Architecture:**
```
User Browser → marketing.mytreatmentpath.com (static landing page)
                   ↓
            Download Electron app (macOS/Windows/Linux)
                   ↓
Electron App → api.mytreatmentpath.com (Express backend)
                   ↓
           Supabase (PostgreSQL database)
```

---

## Part 1: Cloud Server Setup (Backend API)

### Option A: DigitalOcean Droplet (Recommended)

**Why DigitalOcean:**
- Simple, reliable, $6/month for starter
- Easy to scale
- Good documentation
- Managed databases available

**Steps:**

1. **Create Droplet**
   ```bash
   # Via DigitalOcean dashboard:
   - Choose Ubuntu 22.04 LTS
   - Plan: Basic ($6/month - 1GB RAM, 1 CPU)
   - Datacenter: Closest to users (SF or NYC)
   - Add SSH key
   - Hostname: mrt-api-production
   ```

2. **Initial Server Setup**
   ```bash
   # SSH into server
   ssh root@your-droplet-ip
   
   # Update system
   apt update && apt upgrade -y
   
   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   apt install -y nodejs
   
   # Install PM2 (process manager)
   npm install -g pm2
   
   # Install nginx (reverse proxy)
   apt install -y nginx
   
   # Install certbot (SSL certificates)
   apt install -y certbot python3-certbot-nginx
   ```

3. **Setup Application**
   ```bash
   # Create app user
   adduser mrt
   usermod -aG sudo mrt
   su - mrt
   
   # Clone/upload code
   mkdir ~/medical-research-tracker
   cd ~/medical-research-tracker
   
   # Upload via git or scp
   # If git:
   git clone https://github.com/yourusername/medical-research-tracker.git .
   
   # If scp (from local machine):
   scp -r ~/medical-research-tracker root@your-droplet-ip:/home/mrt/
   
   # Install dependencies
   npm install --production
   
   # Create .env file
   nano .env
   ```

4. **Environment Variables (.env)**
   ```bash
   NODE_ENV=production
   PORT=3000
   
   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   
   # OpenAI (for AI summaries)
   OPENAI_API_KEY=sk-...
   
   # Session secret
   SESSION_SECRET=generate-random-32-char-string
   
   # Allowed origins (for CORS)
   ALLOWED_ORIGINS=https://mytreatmentpath.com,https://www.mytreatmentpath.com
   ```

5. **Start with PM2**
   ```bash
   # Start backend
   pm2 start server/index.js --name mrt-api
   
   # Auto-restart on reboot
   pm2 startup
   pm2 save
   
   # Monitor
   pm2 logs mrt-api
   pm2 monit
   ```

6. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/mrt-api
   ```
   
   ```nginx
   server {
       listen 80;
       server_name api.mytreatmentpath.com;
   
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   
   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/mrt-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Setup SSL (HTTPS)**
   ```bash
   # Point DNS first: api.mytreatmentpath.com → your-droplet-ip
   
   # Generate certificate
   sudo certbot --nginx -d api.mytreatmentpath.com
   
   # Auto-renewal is configured automatically
   # Test renewal:
   sudo certbot renew --dry-run
   ```

8. **Firewall**
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

---

### Option B: Render.com (Easier, Slightly More Expensive)

**Why Render:**
- Zero DevOps (auto-deploy from git)
- Free SSL
- Auto-scaling
- ~$7/month for starter

**Steps:**

1. **Push code to GitHub**
   ```bash
   cd ~/.openclaw/workspace/medical-research-tracker
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/mrt-backend.git
   git push -u origin main
   ```

2. **Create Render Web Service**
   - Go to https://render.com
   - New → Web Service
   - Connect GitHub repo
   - Settings:
     - **Name:** mrt-api
     - **Environment:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `node server/index.js`
     - **Plan:** Starter ($7/month)

3. **Environment Variables** (in Render dashboard)
   ```
   NODE_ENV=production
   SUPABASE_URL=https://...
   SUPABASE_KEY=...
   OPENAI_API_KEY=sk-...
   SESSION_SECRET=...
   ```

4. **Custom Domain**
   - Render dashboard → Settings → Custom Domain
   - Add: api.mytreatmentpath.com
   - Update DNS:
     ```
     CNAME api → yourapp.onrender.com
     ```
   - SSL auto-configured

5. **Deploy**
   - Push to GitHub → auto-deploys
   - Or manual: Render dashboard → Manual Deploy

**Done!** API live at https://api.mytreatmentpath.com

---

## Part 2: Marketing Website + Downloads

### Static Site (Fastest)

Host on **Netlify** or **Vercel** (free tier):

1. **Create Landing Page**
   ```bash
   cd ~/.openclaw/workspace
   mkdir mrt-website
   cd mrt-website
   ```

2. **Simple HTML + CSS** (see next section for full code)

3. **Deploy to Netlify**
   ```bash
   # Option A: Drag & drop (easiest)
   # Go to netlify.com → Sites → Drag folder
   
   # Option B: CLI
   npm install -g netlify-cli
   netlify init
   netlify deploy --prod
   ```

4. **Custom Domain**
   - Netlify dashboard → Domain settings
   - Add: mytreatmentpath.com
   - Update DNS:
     ```
     A     @ → 75.2.60.5 (Netlify IP)
     CNAME www → yoursite.netlify.app
     ```

---

## Part 3: Electron App Distribution

### Build for macOS

```bash
cd ~/.openclaw/workspace/medical-research-tracker

# Install signing dependencies (optional for now)
# For production: get Apple Developer certificate

# Build
npm run electron:build:mac

# Output: build/MyTreatmentPath-0.1.0-arm64.dmg (M1/M2/M3)
#         build/MyTreatmentPath-0.1.0.dmg (Intel)
```

### Hosting Downloads

**Option A: GitHub Releases**
```bash
# Create release on GitHub
gh release create v0.1.0 \
  build/MyTreatmentPath-0.1.0-arm64.dmg \
  build/MyTreatmentPath-0.1.0.dmg \
  --title "MyTreatmentPath v0.1.0" \
  --notes "Initial release"

# Download URL:
# https://github.com/yourusername/mrt/releases/download/v0.1.0/MyTreatmentPath-0.1.0-arm64.dmg
```

**Option B: DigitalOcean Spaces (S3-compatible)**
```bash
# Create Space in DO dashboard
# Upload DMG files
# Set to public read
# Download URL:
# https://mrt-downloads.nyc3.digitaloceanspaces.com/MyTreatmentPath-0.1.0-arm64.dmg
```

**Option C: Netlify Large Media**
```bash
# Add to Git LFS
git lfs track "*.dmg"
git add .gitattributes
git add build/*.dmg
git commit -m "Add macOS builds"
git push

# Netlify auto-serves
# URL: https://mytreatmentpath.com/downloads/MyTreatmentPath-0.1.0-arm64.dmg
```

---

## Part 4: Auto-Update System (Future)

Use **electron-updater** for seamless app updates:

```javascript
// electron/main.cjs
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'yourusername',
  repo: 'medical-research-tracker'
});

autoUpdater.checkForUpdatesAndNotify();
```

---

## Deployment Checklist

### Pre-Launch
- [ ] Backend code pushed to GitHub
- [ ] Supabase database configured (tables, RLS policies)
- [ ] Environment variables documented
- [ ] API deployed and tested (Render or DigitalOcean)
- [ ] SSL certificate working (https://api.mytreatmentpath.com)
- [ ] CORS configured (allowed origins)
- [ ] Landing page created
- [ ] Electron app built for macOS
- [ ] Download links tested
- [ ] Privacy policy page added
- [ ] Terms of service page added

### DNS Setup
```
A       @       →  Netlify IP (website)
CNAME   www     →  yoursite.netlify.app
CNAME   api     →  mrt-api.onrender.com (or DigitalOcean IP)
```

### Post-Launch
- [ ] Monitor API logs (PM2 or Render dashboard)
- [ ] Test app download and installation
- [ ] Verify API connection from Electron app
- [ ] Setup uptime monitoring (UptimeRobot, free)
- [ ] Setup error tracking (Sentry, free tier)
- [ ] Backup strategy (Supabase auto-backs up)
- [ ] Analytics (optional: Plausible, privacy-friendly)

---

## Monthly Costs Estimate

**Minimal Setup:**
- Domain (mytreatmentpath.com): $12/year (~$1/month)
- Render web service: $7/month
- Supabase (free tier): $0
- Netlify (free tier): $0
- **Total: ~$8/month**

**Production Setup:**
- Domain: $1/month
- DigitalOcean Droplet: $6/month
- Managed PostgreSQL: $15/month (or Supabase Pro $25/month)
- DigitalOcean Spaces (downloads): $5/month
- **Total: ~$27/month**

---

## Security Checklist

- [ ] HTTPS everywhere (API + website)
- [ ] Environment variables not in code
- [ ] Supabase RLS policies configured
- [ ] API rate limiting (express-rate-limit)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (helmet middleware)
- [ ] CORS configured properly
- [ ] Session secrets rotated
- [ ] Dependency vulnerabilities checked (`npm audit`)

---

## Support & Monitoring

**Uptime Monitoring:**
```
UptimeRobot (free):
- Monitor: https://api.mytreatmentpath.com/health
- Alert: Email/SMS if down
```

**Error Tracking:**
```javascript
// server/index.js
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'your-sentry-dsn' });
```

**Logs:**
```bash
# PM2
pm2 logs mrt-api --lines 100

# Render
# Dashboard → Logs tab
```

---

## Next Steps

1. **Immediate:** Deploy backend to Render (easiest path)
2. **Day 2:** Create landing page with download links
3. **Day 3:** Build macOS app, upload to GitHub Releases
4. **Week 2:** Add Windows build
5. **Month 2:** Custom domain, branding polish
6. **Month 3:** Auto-update system

**Ready to start? Let's build the landing page next!**
