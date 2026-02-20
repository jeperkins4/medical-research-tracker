# MyTreatmentPath

**Your Personal Medical Research Assistant**

Track your health journey, discover relevant research, and make informed treatment decisions with AI-powered insights — all while keeping your data private and secure.

🌐 **Website:** [website-ecru-ten-36.vercel.app](https://website-ecru-ten-36.vercel.app)

[![Download](https://img.shields.io/badge/Download-Latest%20Release-blue)](https://github.com/jeperkins4/medical-research-tracker/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey)](https://github.com/jeperkins4/medical-research-tracker)

---

## 🚀 Quick Start

### Download

**macOS (Apple Silicon):**
- [Download .dmg](https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.2/MyTreatmentPath-0.1.1-arm64.dmg) (137 MB) ✅ **Fully Notarized**

**Install:** Double-click `.dmg` → Drag to Applications → Open

**First launch:** Right-click → Open (macOS Gatekeeper)

---

## ✨ Features

### 🧬 Precision Medicine
- **Genomic integration** - Foundation One, Tempus, Caris
- **Mutation analysis** - ARID1A, FGFR3, PIK3CA pathways
- **Targeted therapies** - FDA-approved + clinical trials
- **Drug-gene interactions** - AI-powered recommendations

### 💊 Medication Manager
- **Track treatments** - Chemotherapy, supplements, integrative
- **Evidence base** - Peer-reviewed studies for each medication
- **Genomic targeting** - Links to your specific mutations
- **Side effects** - Monitor symptoms and interactions

### 🥗 Nutrition Tracker
- **AI meal analysis** - Claude Sonnet 4.6 powered
- **Genomic compatibility** - Foods for YOUR mutations
- **Treatment interactions** - Drug-nutrient warnings
- **Macro tracking** - Calories, protein, carbs, fat, fiber

### 🔬 Research Scanner
- **Automated discovery** - Daily PubMed searches (2 AM)
- **Clinical trials** - ClinicalTrials.gov integration
- **Paper library** - Save, tag, annotate research
- **Evidence modal** - Quick access to studies

### ☁️ Cloud Sync (Optional)
- **Local-first** - Works 100% offline
- **PHI stays local** - Health data encrypted on device
- **Research syncs** - Papers accessible across devices
- **Encrypted backups** - Supabase Storage

### 📊 Analytics (Optional)
- **HIPAA Safe Harbor** - 11+ user minimum cell size
- **Anonymized only** - No PHI in analytics
- **Usage insights** - Feature adoption, trends
- **Opt-in** - Disabled by default

### 🔒 Security
- **AES-256 encryption** - All health data encrypted at rest
- **No cloud required** - Works completely offline
- **Automated backups** - Daily at 2 AM, 7-day retention
- **Audit logging** - All authentication events tracked

---

## 📚 Documentation

**Complete documentation:** [docs/README.md](docs/README.md)

### Quick Links

- **[Installation Guide](docs/getting-started/installation.md)** - Download, install, first run
- **[Quickstart](docs/getting-started/quickstart.md)** - 5-minute tour
- **[Account Setup](docs/getting-started/account-setup.md)** - Signup + cloud sync
- **[Cloud Sync](docs/features/cloud-sync.md)** - Local-first architecture
- **[API Reference](docs/development/api-reference.md)** - REST API docs
- **[Contributing](docs/development/contributing.md)** - Developer guide

---

## 🛠️ Development

### Prerequisites

- macOS (Apple Silicon)
- Node.js 25+
- Git

### Setup

```bash
# Clone repo
git clone https://github.com/jeperkins4/medical-research-tracker.git
cd medical-research-tracker

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your keys (see below)

# Start development
npm run dev      # Terminal 1: Frontend (http://localhost:5173)
npm run server   # Terminal 2: Backend (http://localhost:3000)
```

### Environment Variables

Create `.env` in project root:

```bash
# Required (generate with: openssl rand -hex 32)
DB_ENCRYPTION_KEY=your-32-byte-key-here
BACKUP_ENCRYPTION_KEY=your-32-byte-key-here
JWT_SECRET=your-32-byte-key-here

# Optional (for AI features)
ANTHROPIC_API_KEY=sk-ant-...  # Claude API key

# Optional (for cloud sync)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

**Get API keys:**
- Anthropic: https://console.anthropic.com/
- Supabase: https://supabase.com/

---

## 📦 Tech Stack

### Frontend
- **React 18.3** - UI framework
- **Vite 5.4** - Build tool
- **CSS Modules** - Styling

### Backend
- **Node.js 25** - Runtime
- **Express 4.21** - API server
- **SQLite 3** - Database (encrypted)
- **better-sqlite3-multiple-ciphers** - AES-256 encryption

### Desktop
- **Electron 34** - Desktop wrapper
- **electron-builder** - Packaging
- **@electron/notarize** - Apple notarization

### Cloud (Optional)
- **Supabase** - PostgreSQL + Auth + Storage
- **Vercel** - Static website hosting

### AI
- **Anthropic Claude** - Natural language processing
  - Sonnet 4.6 - Meal analysis, genomic recommendations
  - Haiku 4.5 - Lightweight tasks

---

## 🏗️ Architecture

```
Local Device (macOS)
├── React Frontend (http://localhost:5173)
├── Express API (http://localhost:3000)
└── Encrypted SQLite Database
    ├── PHI (NEVER syncs)
    │   ├── Medications, labs, vitals
    │   ├── Genomic data
    │   └── Patient profile
    └── Research (Syncs to cloud)
        ├── Papers, tags
        └── User preferences

Optional Cloud (Supabase)
├── PostgreSQL (research library)
├── Auth (cloud accounts)
└── Storage (encrypted backups)
```

**See:** [Architecture Guide](docs/development/architecture.md)

---

## 📖 Project Structure

```
medical-research-tracker/
├── src/                      # React frontend
│   ├── App.jsx              # Main app component
│   ├── components/          # UI components
│   ├── pages/               # Full-page views
│   └── utils/               # Helpers
├── server/                   # Express backend
│   ├── index.js             # Main server
│   ├── db-secure.js         # Encrypted SQLite
│   ├── auth.js              # JWT + bcrypt
│   ├── cloud-sync.js        # Supabase sync
│   └── migrations/          # Database migrations
├── electron/                 # Electron wrapper
│   └── main.js              # Main process
├── website/                  # Public marketing site
├── docs/                     # Documentation
└── build/                    # Build output (.dmg)
```

---

## 🔐 Security & Privacy

### What's Encrypted

✅ **All PHI** - AES-256-CBC encryption  
✅ **Database backups** - Encrypted before upload  
✅ **Passwords** - bcrypt hashing (10 rounds)  
✅ **JWT tokens** - HTTP-only cookies  

### What Stays Local (NEVER syncs)

❌ Medications  
❌ Lab results  
❌ Vitals  
❌ Genomic data  
❌ Meal analyses  
❌ Patient profile  

### What Can Sync (Optional)

✅ Research papers (public publications)  
✅ Tags (paper categories)  
✅ User preferences (search terms)  
✅ Encrypted database backups  

**See:** [Encryption Guide](docs/security/encryption.md)

---

## 📜 License

**MIT License** - See [LICENSE](LICENSE) file

Open source, free forever. Built by cancer patients, for patients.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/development/contributing.md)

**Ways to contribute:**
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve docs
- 💻 Submit code
- 🧪 Test new features

---

## 🐛 Support

- **Documentation:** [docs/README.md](docs/README.md)
- **Issues:** [GitHub Issues](https://github.com/jeperkins4/medical-research-tracker/issues)
- **Discussions:** [GitHub Discussions](https://github.com/jeperkins4/medical-research-tracker/discussions)

---

## 📝 Changelog

- **[v0.1.1](docs/changelog/v0.1.1.md)** - Multi-user signup + cloud sync (Feb 2026)
- **[v0.1.0](docs/changelog/v0.1.0.md)** - Initial release (Feb 2026)

---

## 🙏 Acknowledgments

**Inspired by:**
- Cancer patients who want control over their treatment
- Open-source health tech community
- Precision medicine research

**Built with:**
- Anthropic Claude (AI-powered features)
- Supabase (cloud infrastructure)
- React, Electron, SQLite (core stack)

---

**Built with ❤️ by cancer patients, for patients who want control over their treatment journey.**

[⬆️ Back to top](#mytreatmentpath)
