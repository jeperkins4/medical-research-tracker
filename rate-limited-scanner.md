# Medical Research Scanner - Rate Limiting Solution

## Problem
The Brave Search API free tier allows only **1 request per second**. With 20 search terms, a complete scan requires ~20 seconds of sequential execution with mandatory 1-second delays between searches.

## What Happened This Run
- **Attempted:** 20 searches across 5 categories
- **Completed:** 2 searches (Keytruda, ETx-22)
- **New Articles:** 6 articles added to database
- **Rate Limited:** 18 searches remaining

## Solution Options

### Option 1: Split into Multiple Cron Jobs (Recommended)
Create 4 separate cron jobs, each handling 5 searches, staggered by 30 minutes:

```javascript
// Job 1: Conventional Treatments (2:00 AM)
["Keytruda pembrolizumab bladder cancer", "Padcev enfortumab vedotin urothelial cancer", "pembrolizumab enfortumab combination bladder"]

// Job 2: Pipeline Drugs (2:30 AM)  
["BT8009 zelenectide pevedotin nectin-4", "ETx-22 nectin-4 bladder cancer", "nectin-4 ADC urothelial cancer trial"]

// Job 3: Integrative Supplements (3:00 AM)
["low dose naltrexone LDN bladder cancer", "IV vitamin C urothelial cancer", "Angiostop sea cucumber cancer", "fenbendazole cancer clinical", "ivermectin cancer research", "methylene blue cancer mitochondrial"]

// Job 4: Clinical Trials + Research (3:30 AM)
["bladder cancer clinical trial 2025", "urothelial carcinoma immunotherapy trial", "nectin-4 targeted therapy trial", "stage IV bladder cancer new treatment", "nectin-4 expression bladder cancer", "checkpoint inhibitor bladder cancer", "OGF-OGFr axis cancer", "angiogenesis inhibition bladder cancer"]
```

### Option 2: Use a Background Worker
Create a Node.js worker process that:
1. Reads searches from a queue
2. Performs them with 1-second delays
3. Writes results to database
4. Runs continuously in background

### Option 3: Upgrade Brave API Plan
- Free tier: 1 req/sec, 2000 req/month
- Paid tier: Higher rate limits
- Cost: Check https://brave.com/search/api/

## Completed Searches (This Run)

### ✅ Conventional - Keytruda (2 new articles)
- KEYTRUDA + Padcev combination showed improved event-free survival (Aug 2025)
- FDA approved updated indication for urothelial carcinoma (Mar 2025)

### ✅ Pipeline - ETx-22 (4 new articles)
- Novel nectin-4 ADC shows safety and potent antitumor activity (Nov 2024)
- Effective in low-nectin-4 expressing tumors
- Compared to EV in bladder cancer PDX models

## Remaining Searches (18)
- Padcev enfortumab vedotin urothelial cancer
- pembrolizumab enfortumab combination bladder
- BT8009 zelenectide pevedotin nectin-4
- nectin-4 ADC urothelial cancer trial
- low dose naltrexone LDN bladder cancer
- IV vitamin C urothelial cancer
- Angiostop sea cucumber cancer
- fenbendazole cancer clinical
- ivermectin cancer research
- methylene blue cancer mitochondrial
- bladder cancer clinical trial 2025
- urothelial carcinoma immunotherapy trial
- nectin-4 targeted therapy trial
- stage IV bladder cancer new treatment
- nectin-4 expression bladder cancer
- checkpoint inhibitor bladder cancer
- OGF-OGFr axis cancer
- angiogenesis inhibition bladder cancer

## Database Stats
- **Total articles:** 79
- **Unread:** 79
- **Last update:** Just now (6 new articles)

## Recommendation
Implement Option 1: Split into 4 staggered cron jobs, each running 5-10 searches with 1-second delays between them. This stays within rate limits and completes all searches within 2 hours.
