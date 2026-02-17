# Medical Research Tracker - Desktop App

**Electron desktop application** for personal health tracking and medical research discovery.

> **🌐 Marketing Website:** See [mytreatmentpath-landing](https://github.com/jeperkins4/mytreatmentpath-landing) repo  
> **📥 Download App:** See [Releases](https://github.com/jeperkins4/medical-research-tracker/releases)

Personal health records and medical research discovery tool. Track conditions, discover relevant research papers, find clinical trials, and evaluate both conventional and alternative treatments.

## Features

- **Health Profile**: Track conditions, symptoms, medications, test results
- **Precision Medicine Dashboard**: Foundation One CDx genomic integration with mutation → pathway → treatment mapping
- **AI Healthcare Strategy Summary**: Synthesize your multi-modal approach (genomics + diet + supplements + research)
- **Research Discovery**: Search and track medical research with tagging system
- **Research Library**: Save and annotate papers, compare treatments
- **Dietary Tracking**: Document your nutrition philosophy and daily routines
- **Private & Local**: All data stored locally in SQLite

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **APIs**: PubMed, ClinicalTrials.gov

## Getting Started

```bash
# Install dependencies
npm install

# Configure OpenAI API key (for AI Healthcare Summary feature)
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=sk-...

# Run development server (frontend + backend)
npm start

# Or run separately:
npm run server  # Backend on :3000
npm run dev     # Frontend on :5173
```

### AI Healthcare Summary Setup

The **🧠 Strategy** tab uses OpenAI's GPT-4o to synthesize your healthcare data into actionable insights.

1. Get an API key: https://platform.openai.com/api-keys
2. Create `.env` file in project root:
   ```
   OPENAI_API_KEY=sk-...
   ```
3. Restart the server (`npm run server`)
4. Click **✨ Generate Summary** in the Strategy tab

**What it analyzes:**
- Confirmed genomic mutations and affected pathways
- Current medications/supplements with genomic correlations
- Dietary approach and rationale
- Recent research papers and tags
- Latest vitals and lab results

**What it provides:**
- Strategy overview (how components work together)
- Alignment analysis (genomics → treatments → diet)
- Coverage gaps (under-addressed pathways/mutations)
- Research opportunities (specific search terms, trial categories)
- Data quality recommendations (missing info)

**Privacy:** Your data is sent to OpenAI's API for analysis. If this is a concern, simply don't configure the API key — all other features work without it.

## Project Structure

```
src/
  components/    # React components
  pages/         # Page-level components
  services/      # API clients (PubMed, trials, etc.)
  models/        # Data models
server/
  index.js       # Express server
  db.js          # Database layer
  routes/        # API endpoints
public/          # Static assets
```

## Privacy

This tool is designed for personal use. All health data stays local. No external services receive your health information — only search queries for research papers.

## Roadmap

- [x] MVP: Health profile + basic research search
- [x] Save & annotate research papers (with unlimited custom tagging)
- [x] Foundation One CDx genomic integration
- [x] Precision Medicine Dashboard (mutations → pathways → treatments → trials)
- [x] Treatment-genomic correlation tracking (Dr. Gildea protocol)
- [x] AI Healthcare Strategy Summary
- [x] Dietary habits tracking
- [x] Automated research scanner with Telegram notifications
- [ ] Treatment comparison view (side-by-side evidence evaluation)
- [ ] Export reports (PDF/MD)
- [ ] AI-powered paper summarization (individual papers)
- [ ] Interaction/contraindication checking
- [ ] Provider network management UI
- [ ] Appointment scheduling integration

## Architecture Principles

Following SOLID design:
- Single responsibility per module
- Open for extension (easy to add new research sources)
- Clear interfaces between layers
- Dependency injection for testability
