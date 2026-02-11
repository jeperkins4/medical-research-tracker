# Medical Research Tracker

Personal health records and medical research discovery tool. Track conditions, discover relevant research papers, find clinical trials, and evaluate both conventional and alternative treatments.

## Features

- **Health Profile**: Track conditions, symptoms, medications, test results
- **Research Discovery**: Search PubMed and ClinicalTrials.gov
- **Research Library**: Save and annotate papers, compare treatments
- **AI Summaries**: Extract key findings from medical literature
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

# Run development server (frontend + backend)
npm start

# Or run separately:
npm run server  # Backend on :3000
npm run dev     # Frontend on :5173
```

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

- [ ] MVP: Health profile + basic research search
- [ ] Save & annotate research papers
- [ ] Treatment comparison view
- [ ] Export reports (PDF/MD)
- [ ] Advanced filtering & tagging
- [ ] AI-powered paper summarization
- [ ] Interaction/contraindication checking

## Architecture Principles

Following SOLID design:
- Single responsibility per module
- Open for extension (easy to add new research sources)
- Clear interfaces between layers
- Dependency injection for testability
