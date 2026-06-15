# MyTreatmentPath v0.1.0 - Initial Release 🚀

**First public release** of MyTreatmentPath - Your personal medical research assistant.

## What's Included

### Core Features
- **📊 Health Tracking** - Track conditions, symptoms, medications, vitals, and test results
- **🧬 Genomic Integration** - Foundation One CDx genomic data with mutation → pathway → treatment mapping
- **🔬 Research Discovery** - Search PubMed and ClinicalTrials.gov with automated daily scans
- **📚 Research Library** - Save, annotate, and organize medical papers with custom tagging
- **🥗 Nutrition Tracker** - Document dietary habits and meal analysis with AI insights
- **🧠 AI Strategy Summary** - GPT-4 powered healthcare strategy synthesis
- **💊 Evidence-Based Medication Database** - 22 medications/supplements with peer-reviewed studies

### Security & Privacy
- **🔒 Privacy-First** - All health data stored locally (SQLite)
- **☁️ Optional Cloud Sync** - Supabase integration for research papers only (no PHI)
- **🔐 Encrypted Backups** - AES-256 encrypted daily backups

### Technical
- **Platform:** macOS (Apple Silicon M1/M2/M3)
- **Database:** Local SQLite with optional cloud sync
- **AI Features:** OpenAI GPT-4o integration (API key required)
- **Automation:** Scheduled research scans with notifications

## Download

### macOS (Apple Silicon)
- **DMG Installer:** MyTreatmentPath-0.1.0-arm64.dmg (134 MB)
- **ZIP Archive:** MyTreatmentPath-0.1.0-arm64-mac.zip (129 MB)

**System Requirements:**
- macOS 11.0 (Big Sur) or later
- Apple Silicon (M1/M2/M3/M4)
- 500 MB free disk space

## Installation

1. Download the DMG file
2. Open MyTreatmentPath-0.1.0-arm64.dmg
3. Drag MyTreatmentPath.app to Applications
4. Launch the app
5. Grant permissions if prompted (file access, notifications)

**First time users:** macOS may show a security warning. Right-click the app → "Open" to bypass Gatekeeper.

## Getting Started

1. **Create Account:** Set up your local account on first launch
2. **Import Genomic Data:** (Optional) Upload Foundation One CDx report
3. **Add Health Data:** Track your conditions, medications, and vitals
4. **Discover Research:** Search for relevant papers and clinical trials
5. **Configure AI:** (Optional) Add OpenAI API key for AI features

## Configuration

### Optional Features
- **OpenAI API Key** - Required for AI Healthcare Summary feature
- **Supabase Account** - Required for cloud sync (research papers only)
- **Research Scanner** - Automated daily PubMed/ClinicalTrials.gov scans

## Known Limitations

- **Platform:** macOS Apple Silicon only (Intel/Windows/Linux coming soon)
- **Database Encryption:** Requires additional setup (see docs)
- **Portal Integration:** Manual data entry for now (auto-sync planned)

## Roadmap

- [ ] Intel Mac support
- [ ] Windows and Linux builds
- [ ] Provider portal auto-sync
- [ ] Mobile companion app
- [ ] AI-powered paper summarization
- [ ] Treatment comparison view
- [ ] Interaction/contraindication checking

## Support

- **Documentation:** https://github.com/jeperkins4/medical-research-tracker
- **Issues:** https://github.com/jeperkins4/medical-research-tracker/issues
- **Website:** https://mytreatmentpath-landing.vercel.app (coming soon)

## Medical Disclaimer

MyTreatmentPath is a research and tracking tool. It is NOT medical advice and does not replace consultation with qualified healthcare professionals. Always consult your doctor before making treatment decisions.

## License

Copyright © 2026 John Perkins. All rights reserved.

---

**Thank you for trying MyTreatmentPath!** 🎉

Please report bugs and feature requests on GitHub Issues.
