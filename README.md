# MyTreatmentPath

**Personal Medical Research Assistant for Bladder Cancer**

> Track research, treatments, and genomic data. Built by a Stage IV bladder cancer patient who needed a better way to stay organized.

🌐 **Website:** [website-ecru-ten-36.vercel.app](https://website-ecru-ten-36.vercel.app)

---

## 📥 Download

**macOS (Apple Silicon):**  
[⬇️ Download MyTreatmentPath-0.1.3.dmg](https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.3/MyTreatmentPath-0.1.3-arm64.dmg) (137 MB)

✅ Fully Apple-notarized (no security warnings)  
✅ macOS 11.0+ (Big Sur or later)  
✅ Free and open source (MIT License)

**Installation:**
1. Download the DMG
2. Open and drag to Applications
3. Launch MyTreatmentPath
4. Grant permissions when prompted

---

## ⚡ What It Does

### 🔬 Daily Research Scanner
- Automatically scans 20+ sources every night (2 AM - 3:30 AM)
- Categories: Conventional, Pipeline, Integrative, Trials & Research
- PubMed, ClinicalTrials.gov, medical journals
- Saves results to local database (no cloud sync)

### 💊 Treatment Tracker
- Log treatments, side effects, timelines
- Track conventional + integrative therapies
- Add notes and observations
- Timeline view of your treatment journey

### 🧬 Genomic Data Storage
- Upload Foundation One, Guardant360, Tempus reports
- Store mutations (FGFR3, ARID1A, PIK3CA, etc.)
- Track TMB, MSI status
- No cloud upload - everything stays local

### 🔐 Encrypted PHI Transfer
- Transfer data between Macs without cloud sync
- AES-256-GCM encryption
- Password-protected exports
- Perfect for switching devices or backing up

---

## 🎯 Why I Built This

I'm a Stage IV bladder cancer patient and software developer. After diagnosis, I was drowning in:

- Research papers I couldn't keep track of
- Treatment options scattered across bookmarks
- Genomic reports I didn't fully understand
- No good way to organize it all

So I built MyTreatmentPath. It's the tool I wish I'd had from day one.

**It's free, open source, and built for patients by a patient.**

---

## 🛡️ Privacy First

- **100% local storage** - Your data never leaves your Mac
- **Zero cloud sync** - No servers, no accounts, no tracking
- **Encrypted transfers** - Move data between devices securely
- **No analytics** - We don't know who you are or how you use it

Your health data is yours. Period.

---

## 🚀 Features

### Research Scanner
- [x] Daily automated searches (4 separate jobs, 20 total searches)
- [x] Categorized results (Conventional, Pipeline, Integrative, Trials)
- [x] PubMed integration
- [x] ClinicalTrials.gov integration
- [x] Save and tag research papers
- [x] Brave Search API (respects 1 req/sec rate limit)

### Treatment Tracking
- [x] Timeline view
- [x] Treatment notes
- [x] Side effect logging
- [x] Conventional + integrative therapies

### Genomic Integration
- [x] Upload genomic reports (PDF)
- [x] Store mutation data
- [x] Track TMB, MSI, biomarkers

### Data Management
- [x] Encrypted export/import
- [x] Local SQLite database
- [x] No cloud dependency
- [x] Password-protected transfers

---

## 📸 Screenshots

*Coming soon - see the app in action*

---

## ⚙️ Technical Details

**Built with:**
- Electron (cross-platform desktop app)
- React (UI framework)
- SQLite (local database)
- Node.js (backend logic)
- Brave Search API (research scanner)

**Database:**
- SQLite 3 (encrypted at rest)
- Schema: research, treatments, genomic_reports, mutations
- Location: `~/Library/Application Support/MyTreatmentPath/data/`

**Research Scanner:**
- Runs via macOS cron jobs (2:00 AM, 2:30 AM, 3:00 AM, 3:30 AM EST)
- 20 searches across 4 categories
- Rate-limited to respect Brave API (1 req/sec)

---

## 🔧 For Developers

### Build from Source

```bash
# Clone the repo
git clone https://github.com/jeperkins4/medical-research-tracker.git
cd medical-research-tracker

# Install dependencies
npm install

# Run in development
npm start

# Build for production
npm run build
```

### Notarized Build (macOS)

```bash
# Requires Apple Developer ID and credentials
./build-notarized-complete.sh
```

See `NOTARIZATION-COMPLETE.md` for full details.

---

## 📝 Roadmap

**v0.2.0 (Next Release):**
- [ ] Intel Mac build (x86_64)
- [ ] Windows build
- [ ] Linux build (AppImage + .deb)
- [ ] Manual research entry (add papers without scanner)
- [ ] Export to CSV/PDF

**v0.3.0 (Future):**
- [ ] Treatment recommendations (AI-powered)
- [ ] Clinical trial matching
- [ ] Expert panel integration
- [ ] Multi-user profiles

**No timeline, no promises.** I'm a patient first, developer second. Features ship when they're ready.

---

## ❓ FAQ

**Q: Is this medical advice?**  
A: No. This is a research tracking tool. Always consult your oncologist before making treatment decisions.

**Q: Does it work for other cancers?**  
A: It's optimized for bladder cancer, but the core features (research scanner, treatment tracker) work for any condition. You'd need to customize the research queries.

**Q: Is my data private?**  
A: Yes. Everything is stored locally on your Mac. No cloud sync, no servers, no tracking. Your data never leaves your device unless you explicitly export it.

**Q: Can I use this on Windows/Linux?**  
A: Not yet. Currently macOS only (Apple Silicon). Windows and Linux builds are planned.

**Q: Do I need an API key?**  
A: The research scanner uses Brave Search API, which requires a free API key (1 million requests/month free tier). You'll need to add it in Settings on first launch.

**Q: What if I find a bug?**  
A: Open an issue on GitHub. I'll fix critical bugs ASAP. Feature requests may take longer (I'm a patient first).

**Q: Can I contribute?**  
A: Yes! Pull requests welcome. See `CONTRIBUTING.md` for guidelines.

---

## 🙏 Acknowledgments

Built with help from:
- **OpenClaw** - AI assistant framework
- **Brave Search API** - Research scanning
- **Electron** - Cross-platform desktop framework
- **React** - UI library

Inspired by the bladder cancer community at BCAN, Inspire.com, and r/bladder_cancer.

---

## 📄 License

MIT License - Free to use, modify, and distribute.

See `LICENSE` for full text.

---

## 💬 Support

**Questions?** Open an issue or reach out:
- GitHub Issues: [medical-research-tracker/issues](https://github.com/jeperkins4/medical-research-tracker/issues)
- Website: [website-ecru-ten-36.vercel.app](https://website-ecru-ten-36.vercel.app)

---

## ⚠️ Disclaimer

**This app is for educational and research tracking purposes only. It is not medical advice, diagnosis, or treatment.**

Always consult with qualified healthcare professionals before making any medical decisions. The information provided by this app should not replace professional medical advice.

By using this software, you acknowledge that:
- This is not a medical device
- Results are for informational purposes only
- You will consult your oncologist for medical decisions
- The author is not liable for any medical outcomes

---

**Built by a patient, for patients. Stay organized. Stay informed. Stay fighting.**

⭐ If this helps you, please star the repo and share with others who might benefit.
