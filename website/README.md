# MyTreatmentPath - Public Website

This directory contains the **public-facing marketing website** for MyTreatmentPath.

## Deployment

Deployed to Vercel from this directory: https://mytreatmentpath.vercel.app (or your custom domain)

**Auto-deploys** when changes are pushed to `main` branch.

## Files

- `index.html` - Landing page with features, download buttons, FAQ
- `privacy.html` - HIPAA-compliant Privacy Policy (Safe Harbor de-identification)
- `terms.html` - Terms and Conditions with medical disclaimers

## Local Preview

Open in browser:
```bash
open website/index.html
```

Or run a local server:
```bash
cd website
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Update Download Links

When releasing a new version, update the download buttons in `index.html`:

```html
<a href="https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.2.0/MyTreatmentPath-0.2.0-arm64.dmg" 
   class="download-button">
    Download for macOS (Apple Silicon)
</a>
```

## Legal Documents

Both privacy.html and terms.html are:
- ✅ HIPAA Safe Harbor compliant
- ✅ Include medical disclaimers
- ✅ Explain local-first architecture
- ✅ Detail optional analytics (11+ user minimum cell size)

**Update dates** when making changes to legal docs.

## Vercel Configuration

See `../vercel.json` in repo root:
- Deploys from `website/` directory
- Security headers enabled
- Redirects `/download` to GitHub Releases

## SEO (Future)

Add these for better discoverability:
- [ ] Favicon (`website/favicon.ico`)
- [ ] Open Graph image (`website/og-image.png` - 1200x630px)
- [ ] Sitemap (`website/sitemap.xml`)
- [ ] Robots.txt (`website/robots.txt`)

---

**Questions?** See main repo README or email support@mytreatmentpath.com
