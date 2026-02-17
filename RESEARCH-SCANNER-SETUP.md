# Automated Research Scanner Setup

**Goal:** Automatically populate your Research Library every night with new bladder cancer research, tagged and categorized.

---

## How It Works

1. **Nightly Cron Job** (runs at 2 AM EST)
2. **OpenClaw Agent** with web_search tool access
3. **Searches 20+ terms** across categories:
   - Conventional treatments (Keytruda, Padcev)
   - Pipeline drugs (BT8009, ETx-22)
   - Integrative (LDN, IV Vitamin C, supplements)
   - Clinical trials
   - Genomics (ARID1A, FGFR3, biomarkers)
   - Research mechanisms

4. **Smart Filtering:**
   - Relevance score (0-10+)
   - Only saves score ≥ 3 to Library
   - Auto-tags by category
   - Dedups by URL

5. **Dual Storage:**
   - **News Feed** → low-relevance items (score 2+)
   - **Library** → high-value research (score 3+)

---

## Setup via OpenClaw Cron

### Step 1: Create the Cron Job

Run this command in OpenClaw (or ask Jor-El to do it):

```javascript
cron.add({
  name: "Nightly Research Scanner",
  schedule: { kind: "cron", expr: "0 2 * * *", tz: "America/New_York" },
  sessionTarget: "isolated",
  payload: {
    kind: "agentTurn",
    message: `Run the medical research scanner for MRT:

1. cd ~/.openclaw/workspace/medical-research-tracker
2. Import the scanner: \`import { SEARCH_TERMS } from './research-scanner-enhanced.js'\`
3. For each search term, use web_search tool
4. Save results to encrypted database (health-secure.db)
5. Send summary to Telegram when complete

Search these categories:
- Conventional treatments
- Pipeline drugs (BT8009, ETx-22)
- Integrative (LDN, IV Vitamin C, Angiostop)
- Clinical trials
- Genomics (ARID1A, FGFR3)
- GU Oncology Now (specialist resource)

Only save papers with relevance score ≥ 3 to Library.
Auto-tag based on category.
Dedup by URL.

Report: Total searches, new papers added, Library count.`,
    timeoutSeconds: 600
  },
  delivery: {
    mode: "announce",
    channel: "telegram",
    to: "8425545852"
  }
});
```

### Step 2: Verify Setup

Check cron status:
```
cron list
```

Should see:
```
✅ Nightly Research Scanner
   Next run: Tomorrow at 2:00 AM EST
   Target: isolated session
   Delivery: Telegram notification
```

### Step 3: Test Run (Optional)

Trigger immediately to verify:
```
cron run <job-id> --mode force
```

---

## What You'll Get Each Morning

**Telegram notification:**
```
🔬 Research Scanner Complete

Searched: 28 terms
New in feed: 18 articles
Added to Library: 10 high-value papers

📚 Library now has 94 papers
🔔 18 unread items in News feed

Categories added:
  • Conventional: 3 papers
  • Pipeline: 2 papers
  • Integrative: 2 papers
  • Trials: 1 paper
  • Genomics: 1 paper
  • GU Oncology Now: 1 paper
```

**In your Library tab:**
- New papers appear automatically
- Tagged by category (Integrative, Conventional, etc.)
- Filterable by tag
- Sorted by relevance score

---

## Search Terms (Customizable)

Current searches (28 total):

**Conventional Treatments (4)**
- Keytruda pembrolizumab bladder cancer 2025 2026
- Padcev enfortumab vedotin urothelial cancer
- pembrolizumab enfortumab combination bladder
- gemcitabine cisplatin bladder cancer

**Pipeline Drugs (4)**
- BT8009 zelenectide pevedotin nectin-4
- ETx-22 nectin-4 bladder cancer
- nectin-4 ADC urothelial cancer trial
- FGFR inhibitor urothelial cancer

**Integrative (8)**
- low dose naltrexone LDN bladder cancer
- IV vitamin C urothelial cancer cisplatin
- Angiostop sea cucumber cancer
- fenbendazole cancer clinical study
- ivermectin cancer research bladder
- methylene blue cancer mitochondrial
- curcumin bladder cancer
- sulforaphane cancer stem cells

**Clinical Trials (4)**
- bladder cancer clinical trial 2026 recruiting
- urothelial carcinoma immunotherapy trial phase 2
- nectin-4 targeted therapy trial enrollment
- stage IV bladder cancer new treatment trial

**Genomics (5)**
- ARID1A mutation bladder cancer treatment
- FGFR3 mutation urothelial cancer therapy
- PIK3CA inhibitor bladder cancer
- nectin-4 expression biomarker
- tumor mutational burden bladder cancer

**Research Mechanisms (6)**
- OGF-OGFr axis cancer naltrexone
- angiogenesis inhibition bladder cancer
- hypoxia HIF-1 pathway cancer
- PD-L1 immune checkpoint bladder
- autophagy cancer treatment

**GU Oncology Now - Expert Source (6)**
- site:guoncologynow.com bladder cancer
- site:guoncologynow.com urothelial cancer
- site:guoncologynow.com nectin-4
- site:guoncologynow.com immunotherapy bladder
- site:guoncologynow.com clinical trial bladder
- site:guoncologynow.com FGFR inhibitor

---

## Adding Custom Search Terms

Edit `research-scanner-enhanced.js`:

```javascript
const SEARCH_TERMS = {
  // ... existing categories
  
  // Add your custom category
  custom: [
    'your search term bladder cancer',
    'another topic urothelial cancer',
  ],
};

// Add tag mapping
const TAG_MAP = {
  // ... existing mappings
  custom: ['your-tag', 'another-tag'],
};
```

Then update the cron job to include new category.

---

## Troubleshooting

**No papers appearing?**
- Check cron job ran: `cron runs <job-id>`
- Check Library has web_search permission
- Verify DB_ENCRYPTION_KEY in .env

**Too many irrelevant papers?**
- Increase relevance threshold (currently 3)
- Refine search terms to be more specific
- Add exclusion keywords

**Want more papers?**
- Lower relevance threshold to 2
- Add more search terms
- Increase search frequency (run twice daily)

---

## Privacy & Security

✅ All data stored locally in encrypted database  
✅ No external services get your health data  
✅ Web searches are anonymized queries  
✅ Papers stored with AES-256 encryption  

---

**Ready to activate?** Just ask Jor-El to set up the cron job with the command above!
