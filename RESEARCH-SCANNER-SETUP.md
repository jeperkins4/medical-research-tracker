# Automated Research Scanner Setup

**Goal:** Automatically populate your Research Library every night with new research relevant to your diagnosis, tagged and categorized.

---

## How It Works

1. **Nightly Cron Job** (runs at 2 AM EST)
2. **OpenClaw Agent** with web_search tool access
3. **Searches 20+ terms** across categories:
   - Conventional treatments (immunotherapy, ADCs, chemotherapy)
   - Pipeline drugs (investigational agents)
   - Integrative (LDN, IV Vitamin C, supplements)
   - Clinical trials
   - Genomics (mutations, biomarkers)
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
- Pipeline drugs (investigational agents)
- Integrative (LDN, IV Vitamin C, supplements)
- Clinical trials
- Genomics (mutations, biomarkers)
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

Search terms and relevance scoring live in `scanner-config.js`, **not** in the
scanner scripts. The shipped defaults are intentionally generic oncology terms —
they name no specific cancer type, no specific genes, and no brand-name drugs —
organized into these categories:

| Category | Purpose |
|---|---|
| `conventional` | Established treatments (immunotherapy, ADCs, chemotherapy) |
| `pipeline` | Investigational and pipeline agents |
| `integrative` | Integrative/repurposed approaches (LDN, IV vitamin C, etc.) |
| `trials` | Recruiting clinical trials |
| `genomics` | Biomarkers, mutations, sequencing |
| `research` | Mechanisms and pathways |
| `guoncology` | Specialist oncology sources |

---

## Customizing for Your Diagnosis

You do **not** need to edit code. Both settings are overridable with environment
variables holding JSON:

```bash
# Terms used to score how relevant a result is
SCANNER_CONDITIONS='["<your cancer type>","<your histology>"]'

# Full search-term set (same category keys as above)
SCANNER_SEARCH_TERMS='{"conventional":["<drug> <your cancer type>"],"trials":["<your cancer type> trial recruiting"]}'
```

If a variable is unset or contains invalid JSON, the generic defaults apply.

To add a new category permanently, edit `DEFAULT_SEARCH_TERMS` in
`scanner-config.js` and add a matching entry to `TAG_MAP` in
`research-scanner-enhanced.js`:

```javascript
// scanner-config.js
const DEFAULT_SEARCH_TERMS = {
  // ... existing categories
  custom: ['your search term', 'another topic'],
};

// research-scanner-enhanced.js
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
