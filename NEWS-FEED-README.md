# Medical Research News Feed

Automated nightly scanner that searches for relevant research articles and clinical trials.

## How It Works

### 1. Automated Scanner (Nightly at 2 AM EST)

A cron job runs every night searching for:

**Current Treatments:**
- Keytruda (pembrolizumab) + bladder cancer updates
- Padcev (enfortumab vedotin) + urothelial cancer news
- Combination therapy results

**Pipeline Drugs:**
- BT8009 (zelenectide pevedotin) trial updates
- ETx-22 nectin-4 ADC development
- New nectin-4 targeting therapies

**Integrative Supplements:**
- Low Dose Naltrexone (LDN) research
- IV Vitamin C clinical studies
- Angiostop (sea cucumber extract)
- Fenbendazole, Ivermectin, Methylene Blue
- And more

**Clinical Trials:**
- New bladder/urothelial cancer trials
- Immunotherapy combinations
- Targeted therapy studies

### 2. Relevance Scoring

Articles are automatically scored based on:

**High Priority (+3 points each):**
- Phase 3 trials
- FDA approvals
- Breakthrough designations
- Complete response data
- Survival benefits
- Recent years (2025-2026)

**Medium Priority (+2 points each):**
- Phase 2 trials
- Efficacy data
- Safety updates
- Your specific cancer type mentions

**Threshold:** Only articles with relevance score > 0 are saved

### 3. Database Storage

Articles are stored in: `/Users/perkins/.openclaw/workspace/medical-research-tracker/data/health.db`

Table: `news_feed`
- ID, title, URL, snippet, source
- Published date, search term used
- Relevance score
- Read status
- Discovery timestamp

### 4. News Feed UI

Access at: **http://localhost:5173/news** (coming soon)

Features:
- View latest research articles
- Sort by relevance score
- Filter by category
- Mark as read/unread
- Direct links to sources
- Search within results

## API Endpoints

```
GET  /api/news              # Get articles (limit=50, unread=true)
GET  /api/news/stats        # Get counts and last update
PUT  /api/news/:id/read     # Mark article as read
PUT  /api/news/mark-all-read # Mark all as read
DELETE /api/news/:id        # Delete article
```

## Cron Job Details

- **Name:** Medical Research Scanner
- **Schedule:** Daily at 2:00 AM EST
- **Session:** Isolated (independent sub-agent)
- **Timeout:** 10 minutes
- **Notification:** Telegram message with summary
- **Job ID:** 45f63acc-75ca-40c1-9397-327c61e8a6ce

### View Cron Status

```bash
# Check if job is enabled
openclaw cron list

# View job details
openclaw cron status

# Manually trigger (for testing)
openclaw cron run --id 45f63acc-75ca-40c1-9397-327c61e8a6ce
```

## Search Terms Configuration

Edit search terms in: `research-scanner.js`

Categories:
- `conventional` - Current treatments
- `pipeline` - Drugs in development
- `integrative` - Supplements and natural compounds
- `trials` - Clinical trials
- `research` - Mechanisms and basic research

## Manual Testing

Test the scanner immediately:
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
node research-scanner.js
```

Note: Manual run won't perform actual web searches (placeholder function). The cron job uses OpenClaw's web_search tool.

## Notifications

You'll receive a Telegram message each morning summarizing:
- Number of searches performed
- New articles discovered
- Categories covered
- Total articles in database
- Unread count

## Future Enhancements

- [ ] News feed UI page in Medical Research Tracker
- [ ] Email digest option
- [ ] RSS feed export
- [ ] Article similarity detection
- [ ] Automatic tagging
- [ ] Integration with papers library
- [ ] PubMed direct search
- [ ] ClinicalTrials.gov API integration
- [ ] Alert for high-priority articles (Phase 3, FDA approvals)

## Troubleshooting

**Scanner not running:**
```bash
# Check cron status
openclaw cron list

# Enable if disabled
openclaw cron update --id 45f63acc-75ca-40c1-9397-327c61e8a6ce --enabled true
```

**No articles being found:**
- Check last run time in Telegram notifications
- Verify search terms are still relevant
- Check relevance scoring threshold

**Database issues:**
```bash
# View news feed table
sqlite3 data/health.db "SELECT COUNT(*) FROM news_feed;"

# Check recent articles
sqlite3 data/health.db "SELECT title, relevance_score, discovered_at FROM news_feed ORDER BY discovered_at DESC LIMIT 5;"
```

## Privacy & Data

- All data stored locally in SQLite database
- No cloud services or external APIs for storage
- Web searches performed via Brave Search API
- Results filtered and scored before storage
- You control retention (delete anytime via API)
